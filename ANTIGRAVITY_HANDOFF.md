# Handoff to Antigravity — 2026-08-15

**Task:** BleuBoard v2 — fork the single-file app into ES modules, then apply the visual craft pass.

**Read first, in this order:**
1. `docs/superpowers/specs/2026-08-15-bleuboard-v2-design.md` — the full design. **Authoritative.**
2. `wiki/whiteboard-4d_gbrain.md` → "v2 Architecture Direction" — invariants + Known Gaps.
3. `wiki/log.md` → 2026-08-15 entry — what happened and what was corrected.

This file is the executable step list only. Where it and the spec disagree, **the spec wins.**

The previous handoff is preserved at `ANTIGRAVITY_HANDOFF.superseded-20260815.md` (Spatial Bridge
verification + cloud deploy — still open, still valid, but **not** this task).

---

## Rules that apply to every step

| Rule | Why |
|---|---|
| **Never commit to `master`.** Branch → PR → merge. | Repo has no branch protection; discipline is procedural and has been breached before. |
| **Never merge a PR yourself — open it, then stop.** Wait for Navakanth's explicit go-ahead, even if QA/RENDER_CHECK is fully clean. | PR #1 was merged to `master` via a local `git merge` + push on 2026-08-17 in the same session Navakanth said "not yet, I want to look at it myself first" to a separate reviewing session. QA-clean is necessary, not sufficient — merge authority is a separate, explicit approval, same category as `DEPLOY_GATE`. |
| **Never `--no-verify`.** | The pyrefly pre-commit hook is load-bearing. |
| **Never score "looks good" automatically.** | Visual quality is not machine-verifiable. Taste is a human gate, always. |
| **3 failures = stop and ask.** | Three failed attempts means the context is wrong, not that a fourth will land. |
| **Read the diff, never the note.** | A memory note mis-described the working-tree diff by 180° in the session that produced this plan. `git diff` is the only source of truth about a diff. |
| **v1 stays working and served throughout.** | It is the parity reference. Breaking it destroys the ability to check anything. |
| **One module per iteration. Never two.** | A failed check must point at exactly one change. |

---

## Phase 0 — Protect existing work `[BLOCKING — first, before anything]`

The working tree holds **two unrelated changes**. They must not share a fate.

```bash
git diff --stat        # expect: index.html ~915 deletions, server.cjs +9
```

**`index.html` — DO NOT COMMIT.** It deletes ~900 lines of *shipped, committed* features:
post-processing chain (`EffectComposer`/`RenderPass`/`ShaderPass`/`Pass`), handwriting/OCR
(`opentype.js`, `tesseract.js`, `btn-text-cursive`, `ds-handwriting`, `word-predict-row`), the whole
Share & Export Hub modal, the Spatial Bridge UI panel (`bridge-panel`, `bridge-moments`,
`rec-bridge`), GSAP, lz-string, and the `btn-motion-toggle` WCAG motion toggle.

**`server.cjs` — safe and useful.** Adds MIME types for `.spz`/`.splat`/`.ply`/`.ksplat`/`.sog`/
`.bin`/`.wasm` (Gaussian splat + WASM).

```bash
git stash push index.html          # recoverable via `git stash pop`
git add server.cjs
git commit -m "feat(server): serve Gaussian splat + WASM MIME types"
git status --short                 # MUST be empty before continuing
git tag v1-final                   # permanent parity reference
```

**Do not proceed until `git status --short` prints nothing.**

---

## Phase 1 — Scaffold v2 alongside v1

```bash
git checkout -b feat/bleuboard-v2
```

1. Create `v2/` **beside** `index.html`. v1 is never edited in this project. Both must be servable
   simultaneously — that is what makes every parity check cheap.
2. `v2/index.html` — markup only. Add an **import map** pinned to one modern Three.js version.
   **Why this is step 1:** v1 uses r146's `examples/js/*` global scripts, removed from Three.js in
   r160. Every modern reference assumes ES modules. Migrating the import layer before porting any
   feature avoids doing the migration 18 times.
3. `v2/styles/` — CSS extracted from v1's `<style>` block, split by concern.
4. `v2/src/` — the 18-module tree from spec §4. **Empty stubs first.**
5. Extend `server.cjs` to serve `v2/`. Note: it has a documented route-query-order bug — verify it
   still holds before assuming a routing failure is yours.

**No bundler. No build step.** The `node server.cjs`, edit, reload workflow is preserved
deliberately. An import map buys module syntax without a toolchain.

**Gate:** empty v2 shell renders, **0 console errors**, ≥45fps. Commit.

---

## Phase 2 — Port module by module

**Decision already made: drop nothing. All 18 modules get ported.** `deferred` needs a written
reason; `dropped` is not available without asking Navakanth.

Dependency order — do not reorder:

```
core/scene → core/input → core/history → draw/strokes → objects/shapes
→ objects/text → objects/media → objects/models → objects/stickers
→ graph/links → fx/aura → ui/hud → ui/modes → ui/guide
→ session/persist → capture/record → agent/interpret → draw/recognize
```

`draw/recognize` is last on purpose: it carries a known bug, so it must not block anything.

**Per module, every time:**

1. Read **only** the functions listed for that module in spec §4 — *not* the whole `index.html`.
   That table exists precisely so this step stays cheap. Reading the full 3,817-line file per module
   is the failure this entire fork exists to prevent.
2. Port to the module. Convert globals to explicit imports/exports.
3. Run **RENDER_CHECK** (below).
4. FAIL → fix, retry. **Hard stop at 3 attempts** → escalate to Navakanth.
5. PASS → screenshot → **TASTE_GATE**: post it, wait for Navakanth's verdict. Do not self-approve.
6. APPROVE → commit, marking that module's §4 parity items in the message.

### RENDER_CHECK — the automated gate

Never scores beauty. Scores only that the thing is not broken:

| Check | Threshold | Method |
|---|---|---|
| Console errors | `0` | `read_console_messages` |
| Canvas not blank | mean luminance **> 2/255 and < 253/255** | screenshot sample |
| Frame rate | ≥ 45fps sustained 3s | `requestAnimationFrame` probe |
| Pixels changed | differs from previous screenshot | image diff |
| Parity | module's §4 items reachable | manual/scripted |

**The luminance bound is mandatory and must never be disabled.** The Fresnel hologram shader
regressed to a black screen in a prior session; in Three.js the dominant failure is a blank canvas,
not ugliness. This one check converts most of a design loop into verifiable territory.

**≥45fps is an assumption, not a measurement.** v1's real baseline on this machine was never
measured. Measure v1 first and adjust if it is wrong — but say so in the log rather than silently
lowering the bar to make a module pass.

**Do not start Phase 3 until every §4 row is marked `ported` or `deferred` in writing.**

---

## Phase 3 — Craft pass

Only now — modules are finally small enough to iterate on. Each item is its own
RENDER_CHECK → TASTE_GATE → commit cycle.

| # | Item | Notes |
|---|---|---|
| 1 | **Lighting & materials** | PBR for stone/wood/grass. Highest visual return per unit effort — do it first. |
| 2 | **Post-processing** | Port the `UnrealBloomPass` + `OutlinePass` work to the modern module API. |
| 3 | **Foreground depth** | Transparent-PNG layers + parallax (technique from Towers). |
| 4 | **Camera movement** | Eased transitions between board modes. |
| 5 | **Typography** | `FontLoader`/`TextGeometry` both moved namespace in modern Three.js. |
| 6 | **Ambient motion** | Wisps/particles. **Budget-capped: must not cost more than 5fps.** |
| 7 | **Custom cursor** | Already in v1; refine. |
| 8 | **Icon & surface language (M3 tokens)** | See "Material Symbols & M3 tokens" below. **Not** the rejected React/MUI migration. |

**Design references — mine for technique, never for structure:**
CollectUI (https://collectui.com/), Kage (https://mengto.github.io/kage/ ·
https://github.com/MengTo/kage), Towers (https://github.com/MengTo/towers), Sketchbook
(https://github.com/MengTo/sketchbook).

Kage and Towers are scroll-driven **marketing sites**. Copying their *structure* turns this project
into the option that was explicitly rejected. Take the camera work, the parallax depth, the material
and lighting quality. Leave the scroll narrative.

**Tooling that does not exist — do not plan around it:** Mobbin MCP is not connected. Figma MCP is
present but unauthorized (needs OAuth from an interactive session). Both are additive if they land.

### Item 8 in detail — Material Symbols & M3 tokens

Proposed 2026-08-15, scoped in rather than rejected outright — **this is not** the out-of-scope
"React + MUI + Keycloak migration" line below. That line means the npm `@mui/material` component
framework and a rebuild of the app's UI layer on React. This item means two much narrower things,
both static assets/CSS, both usable from the existing vanilla-JS `v2/src/ui/*` without a framework:

1. **Google Material Symbols** — a font/SVG icon set, swapped in for the current emoji toolbar
   glyphs (`🖊️` → `draw`, `🅣` → `text_fields`, etc). No dependency beyond a font file or inline SVGs.
2. **Material 3 design tokens** — CSS custom properties for surface color, elevation, and
   backdrop-filter blur, applied to `v2/styles/main.css`. Concept and values only, not the MUI
   `ThemeProvider`/component runtime.

**Explicitly not in scope under this item:** any `@mui/*` package, any React component, ripple/Speed
Dial/Bottom-Sheet *components* (the concepts — thumb-reachable action placement — are fair game; the
literal MUI React widgets are not, per the rejection below).

**Sequencing:** this is Phase 3 work like every other row in this table — it does not start until
every §4 module is `ported` or `deferred` in writing. Restyling `ui/hud.js` / `ui/modes.js` before
they exist in `v2/` is not possible; port them first.

**Gate:** same as every Phase 3 item — RENDER_CHECK → screenshot → TASTE_GATE, one icon/token pass
at a time, not a single sweeping restyle commit.

---

## Phase 4 — Cut over

1. Full parity audit against spec §4. Every row accounted for **in writing**.
2. Side-by-side v1 vs v2, reviewed by Navakanth.
3. On approval: v2 becomes the served root. v1 stays recoverable at tag `v1-final`.
4. **PR into `master`.** Never push directly.
5. **`DEPLOY_GATE` — Vercel deploy is a separate, explicit approval.** Passing Phase 4 does not
   authorize a deploy. Ask.

---

## Phase 5 — Capture reusable skills

Only after something has actually worked, and only if it clears the promotion bar (repeated ≥2×,
non-derivable, load-bearing). Candidate: the RENDER_CHECK harness — genuinely reusable across any
Three.js project, but **it has never been run even once**, so it does not qualify yet. Re-evaluate
after Phase 2 has caught two or three real regressions.

**One canonical copy at `~/.claude/skills/<name>/`, junctions everywhere else. Never duplicate.**

---

## Out of scope

- Scroll-driven marketing site — **rejected**, deliberately
- React + MUI + Keycloak migration — a different project, not this one
- `spatial-bridge` cloud deploy — open, needs credentials + explicit approval
- OpenMontage↔bleuuboard video pipeline
- `recognizeStroke()` star-vs-square bug — **port as-is**, fix separately
- `root.position` / "To Text" bug — **port as-is**, fix separately

Porting a bug faithfully is deliberate: fixing while porting makes it impossible to tell whether a
v2 difference is an improvement or a regression.

---

## Definition of done

> v2 serves a board that does everything spec §4 lists, at ≥45fps, with zero console errors, that
> Navakanth judges better-looking than v1 in a side-by-side — merged via PR into `master`, with v1
> recoverable at tag `v1-final`.

## If you get stuck

Escalate to Navakanth rather than guessing on: any RENDER_CHECK failing 3×; any parity item you
cannot reproduce in v2; anything requiring credentials; any deploy; any proposal to drop a feature.

---

## Queue status

1. [x] **PR #1 (Modular Fork + Craft Pass)** — merged into `master` (commit `37e4c75`), v1 tagged `v1-final` as baseline reference.
2. [x] **PR #2 (Gaussian Splat Integration)** — merged into `master` (commit `df12ca0`), Spark & `.spz` live in scene graph.
3. [x] **Blender + AccuRig Asset Pipeline** — implemented on `feat/blender-accurig-pipeline`, verified via CDP at 48.0 FPS with 0 console errors. QA report at `verification/blender_accurig_pipeline_qa_report.md`. Ready for Draft PR #3 & PO review per `MERGE_GATE`.

---

## Deliverables Summary

- **Blender 3D Asset Prep Guide:** [`docs/superpowers/pipelines/blender-asset-prep-guide.md`](docs/superpowers/pipelines/blender-asset-prep-guide.md)
- **AccuRig Avatar Rigging & SkinnedMesh System:** [`v2/src/nav/character.js`](v2/src/nav/character.js)
- **Avatar Engine Modal UI:** [`v2/src/ui/avatar_picker.js`](v2/src/ui/avatar_picker.js)
- **QA Verification Report:** [`verification/blender_accurig_pipeline_qa_report.md`](verification/blender_accurig_pipeline_qa_report.md)
