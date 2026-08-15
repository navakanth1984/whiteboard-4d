# BleuBoard v2 — Modular Fork + Craft Pass

**Date:** 2026-08-15
**Repo:** `C:\Users\navka\navakanth001\whiteboard-4d` (standalone git repo, branch `master`, 2 commits)
**Scope decision:** Options **A + C** — fork to a modular v2 codebase, then apply the design-quality
craft pass inside it. Option B (a scroll-driven marketing site) was explicitly rejected: it builds a
showcase, not a better product.

---

## 1. Why the fork is a precondition, not housekeeping

`index.html` is **3,817 lines** containing markup, CSS, and all Three.js logic. A craft pass cannot
be applied to it reliably, because no agent can hold the whole file in context and edit it precisely
at the same time. Every visual iteration against a file this size thrashes.

This is a `context-engineering` failure, not a taste failure. Splitting the file is what makes the
craft pass mechanically possible. **A alone would have stalled; C alone would produce a tidy but
unimproved board. The pairing is the point.**

### Load-bearing technical constraint

The app uses **Three.js r146 via CDN**, with the legacy global-script builds:

```
three@0.146.0/build/three.min.js
three@0.146.0/examples/js/controls/OrbitControls.js
three@0.146.0/examples/js/loaders/{GLTFLoader,OBJLoader}.js
three@0.146.0/examples/js/{geometries/TextGeometry,loaders/FontLoader}.js
```

`examples/js/*` was **removed from Three.js in r160**. Every modern reference (post-processing
composers, KTX2 textures, WebGPU, anything copied from a current Three.js example) assumes ES
modules. Therefore:

> **Decision: v2 migrates to ES modules + an import map, pinned to a single modern Three.js
> version, as step 1. No build step, no bundler** — the project's "plain `node server.cjs`, edit and
> reload" workflow is preserved. An import map buys module syntax without introducing a toolchain.

---

## 2. Control-layer architecture

Classified via `control-layer-architect`. Verdict: **Harness + Loop + Graph.**

```
        ┌──────────────────────────────────────────────┐
        │                                              │
START → EXTRACT → PORT ──► RENDER_CHECK ──FAIL──►──────┘
        (read v1)  (write      │      (automated, scalar)
                    v2 module) │
                             PASS
                               │
                               ▼
                        TASTE_GATE  ◄── human. Screenshot reviewed.
                        ┌──────┴──────┐
                     REJECT        APPROVE
                        │              │
                        ▼              ▼
                      PORT          COMMIT
                                       │
                                       ▼
                                 DEPLOY_GATE ◄── separate, explicit
```

### The inverted metric (the critical design choice)

`agentic-engineering` Guideline 1: autonomous loops only work in **verifiable** domains, and names
"more intuitive UX" / "feels more professional" as domains where **the loop drifts randomly**.
Visual craft is that category.

The reference prompt *"self-verify until it's perfect"* is an unbounded loop with a subjective
terminator — no compass, no stopping condition. This project has already paid for that lesson once
(recorded as "adaptive visual pipeline — postprocessing tuning via iterative dark-screen regress
feedback").

**Resolution:** the automated metric is *not* "is it beautiful." It is the negative check:

| Check | Threshold | How |
|---|---|---|
| Console errors | `0` | `read_console_messages` |
| Canvas is not blank | mean luminance > 2/255 AND < 253/255 | screenshot sample |
| Frame rate | ≥ 45 fps sustained 3s | `requestAnimationFrame` probe |
| Pixels actually changed | screenshot differs from previous | image diff |
| Feature parity | target module's checklist items all reachable | manual/scripted |

**Rationale:** in Three.js the dominant failure mode is not ugliness, it is a **black canvas**.
That single check converts most of a design loop into verifiable territory without pretending taste
is measurable. Beauty is judged at `TASTE_GATE` by a human, every time. This is non-negotiable.

### Hard iteration cap

**Maximum 3 iterations per module before mandatory human review.** If a module fails
`RENDER_CHECK` three times, stop and escalate — per `north-star-protocol`, three failures means the
context is wrong, not that a fourth attempt will land.

---

## 3. Reference strategy — Option C (split references)

Two different reference types for two different check types:

| Check type | Reference | Source of truth |
|---|---|---|
| **Logic / feature parity** | v1 | The extracted inventory in §4 |
| **Visual direction** | New target | A target still-frame agreed at TASTE_GATE, informed by the design references |

Consequence: v1 is consulted for *behaviour*, never for *looks*. A v2 module is "done" when it
passes its parity checklist **and** its visual target is approved — the two are graded separately.

### Design references (research inputs, not things to copy)

- CollectUI — https://collectui.com/ (UI pattern breadth)
- Kage — https://mengto.github.io/kage/ · source https://github.com/MengTo/kage
- Towers — https://github.com/MengTo/towers
- Sketchbook — https://github.com/MengTo/sketchbook

**Note:** Kage and Towers are scroll-driven 3D *sites*. They are mined for technique (camera
movement, parallax depth, foreground transparent-PNG layering, material/lighting quality), **not**
for structure. Copying their structure is how this project accidentally becomes option B.

### Unavailable tooling (do not plan around these)

- **Mobbin MCP is not connected** to the current session — it is absent from the server list
  entirely. If it is wanted, it must be added as an MCP server first.
- **Figma MCP is present but unauthorized.** Requires OAuth via claude.ai connector settings or
  `/mcp` in an interactive terminal.

Plan assumes neither is available. Both are additive if they land later.

---

## 4. v1 feature inventory (extracted, not guessed)

Extracted from `index.html` on 2026-08-15 by grepping element ids and function declarations. This
is the **parity checklist**. Every item must be explicitly marked *ported*, *deferred*, or *dropped*
— silence is not an acceptable outcome for any line.

### Modules and their v1 functions

| v2 Module | v1 functions | Parity notes |
|---|---|---|
| `core/scene.js` | renderer/camera/scene setup, `render`, `depth` | Import-map migration lands here first |
| `core/input.js` | `setMouse`, `getHit`, `hitToPos`, `hitToFree`, `hitToSurface`, `rayPlane`, `onDown`, `onMove`, `onUp` | Highest-risk port: pointer maths is subtle and silently wrong |
| `core/history.js` | `register`, `undoLast`, `redoLast`, `updateUndoRedoBtns` | |
| `draw/strokes.js` | `beginStroke`, `addStrokePoint`, `endStroke`, `planePoint`, `updateLive` | |
| `draw/recognize.js` | `recognizeStroke`, `recognizeAndReplace`, `showSuggest`, `hideSuggest` | **Known bug: star-vs-square misclassification.** Port as-is, fix separately |
| `objects/text.js` | `addText3D`, `addTextRing`, `showTextInput` | **Known bug: `root.position` never set on stroke groups** — "To Text" is broken; `lastStrokeCentroid` workaround exists but was never backported |
| `objects/shapes.js` | `addShape`, `flatShape`, `polyGeo`, `starGeo`, `heartGeo` | |
| `objects/media.js` | `addImage`, `addVideo`, `makeVideoPanel`, `addAudio`, `ensureAudio` | |
| `objects/models.js` | `addModel`, `loadModelFile`, `placeObject3D`, `createProceduralAutorikshaw` | GLTFLoader/OBJLoader must move to module imports |
| `objects/stickers.js` | `addSticker`, `emojiTexture`, `addIconNode`, `iconNodeTexture` | |
| `graph/links.js` | `createLink`, `refreshLinks`, `tickLinks`, `makeLinkParticle`, `semanticRelationship`, `nearestRef` | |
| `fx/aura.js` | `makeSplatAura`, `gaussRand`, `pulse` | Fresnel hologram shader work lives here |
| `ui/hud.js` | `updateCoordHud`, `bearingArrow`, `snapMark`, `fmtN`, `toast`, `showModeTip` | |
| `ui/modes.js` | `setMode`, `buildPalette`, `updateGridStyle`, `updateSnapPreview`, `setMovePlaneFor`, `getLegoSnapPosition` | |
| `ui/guide.js` | guide overlay + `gstep-*` steps | |
| `session/persist.js` | session save/download/upload/close, import/export | |
| `capture/record.js` | `record`, `stopRecording`, `stopAudioRecording` | Feeds `spatial-bridge` |
| `agent/interpret.js` | `interpret`, `remember`, `note`, `hover`, `objAt`, `removeObj`, `center`, `proj4`, `updTess` | |

### UI surfaces to preserve (from element ids)

Toolbar: `btn-4d`, `btn-compass`, `btn-scene`, `btn-window`, `btn-text-ring`, `btn-upload3d`,
`btn-import`, `btn-export`, `btn-clear`, `btn-reset`, `btn-undo`, `btn-redo`, `btn-guide`,
`btn-rec`, `btn-audio-rec`.
Panels/HUD: `hud`, `hud-desktop`, `coord-hud`, `bottombar`, `brush-picker`, `orbit-panel`,
`orbit-radius`, `mode-tip`, `conn-banner`, `draw-suggest` (+ `ds-*`), `guide-overlay` (+ `guide-*`,
`gstep-0..3`), `cine-*` (cinematic intro), `audio-rec-panel` (+ `audio-*`), session buttons.

**Open decision, unanswered:** nothing has yet been marked *drop*. Navakanth was asked whether any
v1 feature could be dropped and the session moved on before answering. **Antigravity must obtain
this answer before starting Phase 2** — porting everything is the expensive default.

---

## 5. Step-by-step implementation plan (for Antigravity)

### Phase 0 — Protect existing work `[BLOCKING — do this first]`

`index.html` and `server.cjs` have **uncommitted changes** (the postprocessing/hologram pass from a
prior session). A fork over uncommitted WIP is how work gets lost.

1. `git status` and `git diff --stat` — confirm what is actually modified.
2. **Ask Navakanth** whether the WIP is good (commit it) or exploratory (stash it). Do not decide
   this unilaterally.
3. Commit or stash accordingly. Working tree must be clean before Phase 1.
4. Tag the pre-fork state: `git tag v1-final` — this is the permanent reference for parity checks.

### Phase 1 — Scaffold v2 alongside v1

Per the repo's ADLC: branch first, never commit to `master` directly.

1. `git checkout -b feat/bleuboard-v2`
2. Create `v2/` beside the existing `index.html`. **v1 stays working and untouched throughout.**
   Both are servable; switching between them must be trivial (this is what makes the parity check
   cheap).
3. `v2/index.html` — markup only, plus an **import map** pinned to one modern Three.js version.
4. `v2/styles/` — CSS extracted from v1's `<style>` block, split by concern.
5. `v2/src/` — the module tree from §4. Empty stubs first; verify the empty shell boots with zero
   console errors before porting a single feature.
6. Extend `server.cjs` to serve `v2/` (note: it has a documented route-query-order bug — check it
   still holds).

**Gate:** empty v2 shell renders a blank scene, 0 console errors, ≥45fps. Commit.

### Phase 2 — Port module by module

**One module per iteration. Never two.** Order matters — dependencies first:

```
core/scene → core/input → core/history → draw/strokes → objects/shapes
→ objects/text → objects/media → objects/models → objects/stickers
→ graph/links → fx/aura → ui/* → session/persist → capture/record
→ agent/interpret → draw/recognize
```

`draw/recognize` is deliberately last: it has a known bug, so it must not block anything else.

Per module:
1. Read only the relevant v1 functions (§4 table) — **not the whole file**. This is the entire
   reason the table exists.
2. Port to the module. Convert globals to explicit imports/exports.
3. Run `RENDER_CHECK` (§2 table).
4. On FAIL → fix and retry. **Hard stop at 3 attempts**, then escalate to Navakanth.
5. On PASS → screenshot → **TASTE_GATE** → wait for the human verdict.
6. On APPROVE → commit with the parity checklist items marked off in the message.

**Do not begin Phase 3 until every §4 row is marked ported / deferred / dropped.**

### Phase 3 — Craft pass (only now)

With modules small enough to iterate on, apply the visual work. Each is its own loop + gate:

1. **Lighting & materials** — replace flat lighting; PBR materials for stone/wood/grass surfaces
   using texture references. Highest visual return per unit effort; do it first.
2. **Post-processing** — port the existing `UnrealBloomPass` + `OutlinePass` work forward to the
   modern module API. **The Fresnel hologram shader already regressed to a dark screen once** —
   `RENDER_CHECK`'s luminance bound exists specifically to catch this. Do not disable it.
3. **Foreground depth** — transparent-PNG layers with parallax (technique from Towers).
4. **Camera movement** — eased transitions between board modes.
5. **Typography** — v1 uses `FontLoader`/`TextGeometry`; both moved namespace in modern Three.js.
6. **Ambient motion** — wisps/particles. Budget-capped: must not cost more than 5fps.
7. **Custom cursor** — already exists in v1; refine.

Each item: implement → `RENDER_CHECK` → screenshot → `TASTE_GATE` → commit.

### Phase 4 — Cut over

1. Full parity audit against §4. Every row accounted for, in writing.
2. Side-by-side comparison, v1 vs v2, reviewed by Navakanth.
3. On approval: v2 becomes the served root; v1 preserved at tag `v1-final`.
4. PR into `master`. **Never push directly** — this repo has no branch protection, so the
   discipline is procedural, and it has been breached before.
5. `DEPLOY_GATE`: Vercel deploy is a **separate, explicit approval**. Passing Phase 4 does not
   authorize a deploy.

### Phase 5 — Capture reusable skills

Only after something actually works. Per `skillify`: do not skillify a one-off. Candidates, if and
only if they proved themselves:
- the `RENDER_CHECK` harness (genuinely reusable across any Three.js project)
- material/lighting recipes that survived TASTE_GATE
- the parallax-depth technique

**One canonical copy at `~/.claude/skills/<name>/`, junctions everywhere else. Never duplicate.**

---

## 6. Explicitly out of scope

- Option B (scroll-driven marketing site) — rejected
- React migration — the earlier `bleuuboard-v2` fork note proposed React to enable MUI + Keycloak
  SSO. **That is a different project** with different goals; mixing it into this craft pass would
  double the risk surface. Not in this spec.
- `spatial-bridge` cloud deploy — still open, still unstarted, still needs credentials
- The full OpenMontage↔bleuuboard video pipeline
- Fixing `recognizeStroke`'s star-vs-square bug — ported as-is, fixed separately
- Fixing the `root.position` / "To Text" bug — same

## 7. Risks

| Risk | Mitigation |
|---|---|
| Uncommitted WIP lost in the fork | Phase 0 is blocking |
| Feature silently dropped | §4 is exhaustive and extracted, not remembered; every row must be marked |
| Taste loop drifts, burns budget | Inverted metric + 3-iteration cap + mandatory human gate |
| r146→modern API breakage | Phase 1 migrates the import layer *before* any feature port |
| Dark-screen regression recurs | Luminance bound in `RENDER_CHECK`; it is not optional |
| Accidental drift into option B | Phase 3 items are all board-internal; no scroll narrative anywhere |
| Direct push to `master` | PR-only, per ADLC; previously breached, so state it explicitly |

## 8. Definition of done

> v2 serves a board that does everything §4 lists, at ≥45fps, with zero console errors, that
> Navakanth judges better-looking than v1 in a side-by-side — reached through PR into `master`,
> with v1 recoverable at tag `v1-final`.
