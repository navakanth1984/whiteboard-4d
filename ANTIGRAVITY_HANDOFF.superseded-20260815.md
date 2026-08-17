# Handoff to Antigravity — 2026-07-31

Canonical detail lives in [`wiki/bleuboard.md`](../wiki/bleuboard.md) (Maintenance Log, "2026-07-30/31" entry)
and [`wiki/log.md`](../wiki/log.md) — read those first; this file is the immediate next-step scaffold only.

## What's running right now

- `index.html` served by `server.cjs` on `http://127.0.0.1:3000/` (background process)
- `spatial-bridge/server.js` on `http://127.0.0.1:3100/` (background process)

Both are plain `node <file>` — no build step, no hot reload. Kill and restart after editing either.

## What's verified vs. not

**Verified (backend, isolated):** `spatial-bridge/server.js`'s full pipeline — upload → `ffprobe` duration →
`ffmpeg` scene-cut detection → manifest JSON → file playback — tested against a synthetic ffmpeg-generated
red/blue clip, scene cut detected at the exact expected timestamp (t=1s). CORS preflight bug found and fixed
(`x-file-ext` custom header wasn't in `Access-Control-Allow-Headers`).

**Not verified:** driving `spatial-bridge` from a real in-app recording. The Claude Code Browser-pane test
harness reports `document.hidden = true` even when the tab is fronted via `tabs_select`, which stalls the
`requestAnimationFrame`-driven render loop that `canvas.captureStream()` depends on — every test recording
came back 0 bytes. This is a known limitation of that specific harness (documented in earlier sessions for
GSAP tweening too), not a defect in `spatial-bridge` or the wiring in `index.html`.

**Your first task, if you pick this up:** open `http://127.0.0.1:3000/` in a real foregrounded browser (not
an automated/headless one), open the 🔴 Presentation panel, check "🌉 Send to Spatial Bridge", record ~5s
of actual drawing, stop, and confirm the moment chips populate. If it works, this whole item moves from
"built" to "verified" — update `wiki/bleuboard.md` accordingly.

## Next real step: cloud deploy

User chose Fly.io/Railway as the target cloud host for `spatial-bridge`, but:
- No Dockerfile / fly.toml / railway config has been written yet
- Needs the user's account credentials — do not attempt this without them present and explicit deploy approval
- `spatial-bridge` currently binds `127.0.0.1` only (line `server.listen(PORT, '127.0.0.1', ...)` in
  `spatial-bridge/server.js`) — must change to `0.0.0.0` before it's reachable in any container/cloud host
- `ffmpeg`/`ffprobe` must be present in whatever base image is chosen (a Node Alpine image will need them
  installed explicitly, e.g. `apk add ffmpeg`)

## Explicitly out of scope, still open

- Full OpenMontage↔bleuuboard video pipeline (render worker + job queue + object storage) — scoped, not started.
  `spatial-bridge` is a much smaller, real first slice of this, not the whole thing.
- `recognizeStroke()`'s star-vs-square misclassification (found during stress testing, deferred)
- The pre-existing "To Text" button's `root.position` bug (stroke groups never get an explicit position;
  worked around for the new handwriting-assist flow via `lastStrokeCentroid`, not backported)
