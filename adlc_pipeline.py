"""
adlc_pipeline.py — BLEUUBOARD Agentic Development Life Cycle Pipeline
Mirrors the pattern from agent_os/adlc_pipeline.py, scoped to whiteboard-4d.

Environments:
  non-prod (staging)  -> bleuboard-dev.vercel.app   (permanent alias, updated on every stage)
  prod                -> bleuboard.vercel.app        (only promoted after smoke test passes)

Branches:
  bleuuboard-dev  -> work-in-progress, maps to staging
  master          -> production-ready, maps to prod

Usage:
  python adlc_pipeline.py stage          # deploy to staging + pin bleuboard-dev.vercel.app
  python adlc_pipeline.py promote        # run smoke test -> if pass, deploy to prod
  python adlc_pipeline.py status         # show last CI run
  python adlc_pipeline.py deploy         # stage + smoke + promote + LIVE VERIFY
  python adlc_pipeline.py verify         # check the prod alias serves the local build
  python adlc_pipeline.py rollback [url] # roll prod back (defaults to previous deploy)

Two-stage verification (added after the 2026-07-18 stale-alias incident):
  1. smoke_test()  — static checks on the local index.html, BEFORE upload.
  2. verify_live() — fetches https://bleuboard.vercel.app AFTER deploy and
     confirms it actually serves this build. A `vercel rollback` pins the
     production alias, so `vercel --prod` can succeed while users keep seeing
     the old build; only the live check catches that. deploy_prod() therefore
     always runs `vercel promote`, and `deploy` fails if live verify fails.
"""

import sys
import os
import re
import json
import subprocess
import time
from pathlib import Path
from datetime import datetime

WORK_DIR = Path(__file__).parent
CI_LOG = WORK_DIR / "adlc_ci.json"
HTML_FILE = WORK_DIR / "index.html"

# This script prints box-drawing and status glyphs; the Windows console defaults
# to cp1252 and raises UnicodeEncodeError on them (broke `status` outright).
for _stream in (sys.stdout, sys.stderr):
    _reconfigure = getattr(_stream, "reconfigure", None)
    if _reconfigure is not None:
        try:
            _reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

# On Windows, npm scripts are .cmd wrappers — use vercel.cmd directly
VERCEL_CMD = "vercel.cmd" if sys.platform == "win32" else "vercel"

STAGING_ALIAS = "bleuboard-dev.vercel.app"
PROD_ALIAS    = "bleuboard.vercel.app"


# ── Helpers ──────────────────────────────────────────────────────────────────

def run(args: list[str], timeout: int = 120) -> tuple[int, str, str]:
    # encoding/errors are explicit: Vercel prints Unicode status glyphs and the
    # Windows default (cp1252) raises UnicodeDecodeError mid-deploy.
    try:
        r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=timeout, cwd=WORK_DIR,
                           shell=(sys.platform == "win32"))
        return r.returncode, r.stdout or "", r.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", f"Timed out after {timeout}s"
    except Exception as e:
        return -2, "", str(e)


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[ADLC {ts}] {msg}")


def write_ci_log(entry: dict):
    history = []
    if CI_LOG.exists():
        try:
            history = json.loads(CI_LOG.read_text())
        except Exception:
            history = []
    history.insert(0, entry)
    CI_LOG.write_text(json.dumps(history[:20], indent=2))  # keep last 20 runs


# ── Smoke Test ───────────────────────────────────────────────────────────────

def smoke_test() -> tuple[bool, str]:
    """
    Quick local smoke test on index.html before promoting to prod.
    Checks:
      1. File exists and is non-empty
      2. No obvious syntax errors (unclosed script tags, missing </html>)
      3. Key BLEUUBOARD identifiers are present
      4. WebGL renderer is wrapped in try-catch (the bug we fixed)
    """
    log("Running smoke test on index.html...")

    if not HTML_FILE.exists():
        return False, "index.html not found"

    html = HTML_FILE.read_text(encoding="utf-8")

    checks = [
        ("File non-empty", len(html) > 10_000),
        ("Closing </html> tag", "</html>" in html.lower()),
        ("BLEUUBOARD title present", "BLEUUBOARD" in html),
        ("WebGL try-catch guard", "try {" in html and "WebGLRenderer" in html),
        ("Guide Next button exists", "guide-next" in html),
        ("Draw suggest popup exists", "draw-suggest" in html),
        ("showSuggest uses offsetWidth", "offsetWidth" in html),
        ("No unclosed <script>", html.count("<script") == html.count("</script>")),
    ]

    failures = [name for name, passed in checks if not passed]

    if failures:
        return False, f"Smoke test FAILED — checks failed: {', '.join(failures)}"

    passed_count = len(checks)
    return True, f"Smoke test PASSED — {passed_count}/{passed_count} checks"


# ── Vercel Deploy ─────────────────────────────────────────────────────────────

def deploy_staging() -> tuple[bool, str]:
    log("Deploying to staging (Vercel preview)...")
    code, stdout, stderr = run([VERCEL_CMD, "--yes"], timeout=120)
    combined = stdout + stderr
    url_match = re.search(r"https://\S+\.vercel\.app", combined)
    url = url_match.group(0) if url_match else "(no URL found)"
    if code == 0:
        log(f"Staging deployed -> {url}")
        # Pin the permanent non-prod alias to this deploy
        a_code, a_out, a_err = run([VERCEL_CMD, "alias", "set", url, STAGING_ALIAS], timeout=30)
        if a_code == 0:
            log(f"Staging alias updated -> https://{STAGING_ALIAS}")
        else:
            log(f"Warning: alias update failed: {(a_out+a_err)[:120]}")
        return True, url
    else:
        log(f"Staging deploy FAILED: {combined[:300]}")
        return False, combined[:300]


def deploy_prod() -> tuple[bool, str]:
    log("Deploying to PRODUCTION (vercel --prod)...")
    code, stdout, stderr = run([VERCEL_CMD, "--prod", "--yes"], timeout=120)
    combined = stdout + stderr
    url_match = re.search(r"https://\S+\.vercel\.app", combined)
    url = url_match.group(0) if url_match else "(no URL found)"
    if code != 0:
        log(f"Prod deploy FAILED: {combined[:300]}")
        return False, combined[:300]
    log(f"Production deployed -> {url}")

    # A prior `vercel rollback` pins the production alias, so --prod alone can
    # leave bleuboard.vercel.app serving the OLD build while reporting success.
    # Always force the alias onto this deployment. (Incident: 2026-07-18.)
    p_code, p_out, p_err = run([VERCEL_CMD, "promote", url, "--yes"], timeout=90)
    p_combined = p_out + p_err
    if p_code == 0 or "already the current production" in p_combined or "already active" in p_combined:
        log(f"Production alias promoted -> https://{PROD_ALIAS}")
    else:
        log(f"WARNING: promote failed, prod alias may be stale: {p_combined[:200]}")
        return False, f"deployed {url} but promote failed"
    return True, url


# ── Live verification (the deploy is not done until the ALIAS serves it) ──────

def fetch(url: str, timeout: int = 20) -> tuple[int, str]:
    """Fetch a URL, returning (status_code, body). 0 on transport error."""
    import urllib.request
    import urllib.error
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "adlc-pipeline"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        log(f"Fetch error for {url}: {e}")
        return 0, ""


def verify_live(alias: str, expect_markers: list[str] | None = None,
                retries: int = 3, delay: int = 4) -> tuple[bool, str]:
    """
    Verify the live ALIAS serves the current local build.

    The pre-deploy smoke test reads the local index.html and therefore cannot
    detect a stale alias, a failed promote, or a CDN serving an older build.
    This checks what users actually receive.
    """
    url = f"https://{alias}"
    local = HTML_FILE.read_text(encoding="utf-8", errors="replace")

    # Fingerprint the local build with markers that must appear in the response.
    markers = list(expect_markers or [])
    if not markers:
        for candidate in ("sas-card", "SASCore", "coord-hud", "compass-pane"):
            if candidate in local:
                markers.append(candidate)
        markers = markers[:3]

    status = 0
    for attempt in range(1, max(1, retries) + 1):
        status, body = fetch(url)
        if status == 200 and body:
            missing = [m for m in markers if m not in body]
            size_ratio = len(body) / max(1, len(local))
            if not missing and 0.85 <= size_ratio <= 1.15:
                return True, (f"Live verify PASSED on {url} "
                              f"({len(markers)} markers, size ratio {size_ratio:.2f})")
            reason = (f"missing markers {missing}" if missing
                      else f"size ratio {size_ratio:.2f} outside 0.85-1.15 "
                           f"(live {len(body)}B vs local {len(local)}B)")
            if attempt < retries:
                log(f"Live verify attempt {attempt}/{retries}: {reason} — retrying in {delay}s "
                    "(CDN may still be propagating)")
                time.sleep(delay)
                continue
            return False, f"Live verify FAILED on {url}: {reason}"
        if attempt < retries:
            log(f"Live verify attempt {attempt}/{retries}: HTTP {status} — retrying in {delay}s")
            time.sleep(delay)
    return False, f"Live verify FAILED on {url}: HTTP {status}"


# ── Rollback ─────────────────────────────────────────────────────────────────

def list_prod_deployments(limit: int = 10) -> list[str]:
    code, stdout, stderr = run([VERCEL_CMD, "ls", "--prod"], timeout=60)
    urls, seen = [], set()
    for m in re.finditer(r"https://bleuboard-\S+?\.vercel\.app", stdout + stderr):
        u = m.group(0)
        if u not in seen:
            seen.add(u)
            urls.append(u)
    return urls[:limit]


def cmd_rollback(target: str | None = None):
    """Roll production back to the previous (or a named) deployment."""
    log("=== BLEUUBOARD ROLLBACK ===")
    deployments = list_prod_deployments()
    if not deployments:
        log("Could not list production deployments — aborting.")
        return 1

    if target is None:
        if len(deployments) < 2:
            log("Only one production deployment exists — nothing to roll back to.")
            return 1
        target = deployments[1]  # [0] is current
        log(f"Current : {deployments[0]}")
        log(f"Rolling back to previous: {target}")
    else:
        log(f"Rolling back to requested: {target}")

    code, stdout, stderr = run([VERCEL_CMD, "rollback", target, "--yes"], timeout=120)
    if code != 0:
        log(f"Rollback FAILED: {(stdout + stderr)[:300]}")
        write_ci_log({"timestamp": datetime.now().isoformat(), "action": "rollback",
                      "status": "FAIL", "detail": (stdout + stderr)[:300]})
        return 1
    log(f"Rolled back -> {target}")

    time.sleep(3)
    status, body = fetch(f"https://{PROD_ALIAS}")
    live_ok = status == 200 and bool(body)
    log(f"Post-rollback check: https://{PROD_ALIAS} HTTP {status} "
        f"({len(body)}B)" if live_ok else f"Post-rollback check FAILED: HTTP {status}")
    log("NOTE: rollback pins the prod alias. The next deploy must promote "
        "explicitly — `deploy` now does this automatically.")

    write_ci_log({"timestamp": datetime.now().isoformat(), "action": "rollback",
                  "status": "PASS" if live_ok else "FAIL", "detail": target})
    return 0 if live_ok else 1


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_stage():
    ok, result = deploy_staging()
    entry = {
        "timestamp": datetime.now().isoformat(),
        "action": "stage",
        "status": "PASS" if ok else "FAIL",
        "detail": result,
    }
    write_ci_log(entry)
    return 0 if ok else 1


def cmd_promote():
    smoke_ok, smoke_msg = smoke_test()
    log(smoke_msg)
    if not smoke_ok:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": "promote",
            "status": "FAIL",
            "detail": smoke_msg,
        }
        write_ci_log(entry)
        return 1

    prod_ok, prod_url = deploy_prod()
    entry = {
        "timestamp": datetime.now().isoformat(),
        "action": "promote",
        "status": "PASS" if prod_ok else "FAIL",
        "detail": prod_url,
    }
    write_ci_log(entry)
    return 0 if prod_ok else 1


def cmd_deploy():
    """Full ADLC loop: stage -> smoke -> promote."""
    log("=== BLEUUBOARD ADLC FULL DEPLOY ===")

    # Stage
    stage_ok, stage_url = deploy_staging()
    if not stage_ok:
        log("Aborting — staging deploy failed.")
        return 1
    log(f"Staging OK: {stage_url}")
    time.sleep(2)

    # Smoke test
    smoke_ok, smoke_msg = smoke_test()
    log(smoke_msg)
    if not smoke_ok:
        log("Aborting — smoke test failed. Prod NOT updated.")
        return 1

    # Promote to prod
    prod_ok, prod_url = deploy_prod()

    # Post-deploy gate: the deploy is only real if the ALIAS serves this build.
    live_ok, live_msg = (False, "skipped — prod deploy failed")
    if prod_ok:
        live_ok, live_msg = verify_live(PROD_ALIAS)
        log(live_msg)

    status = "PASS" if (prod_ok and live_ok) else "FAIL"
    entry = {
        "timestamp": datetime.now().isoformat(),
        "action": "deploy",
        "status": status,
        "staging_url": stage_url,
        "prod_url": prod_url,
        "smoke": smoke_msg,
        "live_verify": live_msg,
    }
    write_ci_log(entry)
    log(f"=== ADLC COMPLETE — {status} ===")
    if status == "PASS":
        log(f"Live at: https://{PROD_ALIAS}  ({prod_url})")
    else:
        log("Production is NOT serving this build. Investigate, or run: "
            "python adlc_pipeline.py rollback")
    return 0 if status == "PASS" else 1


def cmd_verify():
    """Check that the production alias currently serves the local build."""
    ok, msg = verify_live(PROD_ALIAS)
    log(msg)
    write_ci_log({"timestamp": datetime.now().isoformat(), "action": "verify",
                  "status": "PASS" if ok else "FAIL", "detail": msg})
    return 0 if ok else 1


def cmd_status():
    if not CI_LOG.exists():
        print("No CI runs yet. Run: python adlc_pipeline.py deploy")
        return 0
    history = json.loads(CI_LOG.read_text())
    print(f"\n{'─'*60}")
    print(f"  BLEUUBOARD ADLC — Last {min(5, len(history))} runs")
    print(f"{'─'*60}")
    for r in history[:5]:
        status_icon = "✓" if r["status"] == "PASS" else "✗"
        ts = r["timestamp"][:16].replace("T", " ")
        print(f"  {status_icon} [{ts}] {r['action']:10}  {r['status']:4}  {r.get('prod_url', r.get('detail', ''))[:50]}")
    print(f"{'─'*60}\n")
    return 0


# ── Entry ─────────────────────────────────────────────────────────────────────

COMMANDS = {
    "stage": cmd_stage,
    "promote": cmd_promote,
    "deploy": cmd_deploy,
    "status": cmd_status,
    "verify": cmd_verify,
    "rollback": cmd_rollback,
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "deploy"
    if cmd not in COMMANDS:
        print(f"Unknown command: {cmd}")
        print(f"Usage: python adlc_pipeline.py [{' | '.join(COMMANDS)}]")
        print("  rollback [deployment-url]   # defaults to the previous prod deployment")
        sys.exit(1)
    if cmd == "rollback":
        sys.exit(cmd_rollback(sys.argv[2] if len(sys.argv) > 2 else None))
    sys.exit(COMMANDS[cmd]())
