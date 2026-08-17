# BleuBoard v2 — Gaussian Splat Integration Design

**Date:** 2026-08-16
**Repo:** `C:\Users\navka\navakanth001\whiteboard-4d` (standalone git repo)
**Depends on:** `2026-08-15-bleuboard-v2-design.md` (the modular fork + craft pass). **This spec's
Phase 0 is: PR #1 merged.** Do not start this work while that PR is still open — per the existing
spec's own rule, one module per iteration, never two concurrent efforts against the same codebase.

**Author's note (QA/PO review, this session):** live-tested `v2/` against the real dev server —
0 console errors, 22 modules loading, real scene content confirmed (18 scene children, 35
geometries, active composer). PR #1 is currently draft, pending a manual FPS check and a decision
on three dead stub files (`ui/guide.js`, `ui/modes.js`, `agent/interpret.js`). See PR #1 for the
full record.

---

## 1. Why

The server already serves Gaussian Splat + WASM MIME types (commit `1d0271a`, merged into
`feat/bleuboard-v2`) — forward-looking groundwork with no renderer wired to it yet. This spec closes
that gap: let a user drop a real-world 3D-scanned scene (a room, an object, a landscape) onto the
board as a genuinely photorealistic object, sitting alongside the existing shapes/stickers/3D-model
object types.

This is additive to the existing object system (`v2/src/objects/{board,media,models,shapes,
stickers,text}.js`), not a replacement for anything, and not a change to the rendering engine —
v2 is staying on Three.js, which is exactly what makes this tractable (see §2).

## 2. Tool selection — and the one hard constraint that drove it

v2 is Three.js-based (ES modules, modern API per the parent spec's Phase 1 migration). This
eliminates most Babylon-only or standalone options and points at one clear choice:

| Tool | License | Role here | Why |
|---|---|---|---|
| **Spark (sparkjsdev/spark)** | MIT | Runtime splat renderer | Built specifically for Three.js's scene graph — correct sorting when splats and regular meshes (existing board objects) share a scene, which every other web splat renderer either can't do or wasn't built for. Actively maintained, real production usage (69.7k weekly npm downloads). |
| **SPZ (Niantic, .spz format)** | MIT | Splat file format | ~10x smaller than raw `.ply` with no perceptible quality loss — matters for a whiteboard where splat objects load over the network like any other asset. Spark and SuperSplat both read it natively. |
| **splat-transform (PlayCanvas)** | MIT | Offline asset-prep CLI | Converts/compresses splat captures (PLY/SOG/KSPLAT/etc.) down to `.spz` before they ever reach the app. Not a runtime dependency — a build-time/content-prep tool. |
| **SuperSplat (PlayCanvas)** | MIT | Offline asset editor | Browser-based, no install — crop/clean/compress a captured splat before export. Human-in-the-loop content prep, not app code. |

**Explicitly not used:**
- `graphdeco-inria/gaussian-splatting` — non-commercial license, would poison any splat trained with it. Irrelevant here anyway since this spec doesn't train scenes, only renders pre-made ones.
- `gsplat` (nerfstudio, Apache-2.0) — genuinely fine license-wise, but it's a *training* pipeline (CUDA/PyTorch, needs a 24GB-class GPU), not a web runtime library. Only relevant if/when this project starts capturing its own scenes from raw photos rather than using pre-captured `.spz` assets. Not in scope for this spec — see §7.
- `gsplat.js` (Hugging Face) — standalone, doesn't integrate with Three.js's scene graph. Would mean a second, separately-managed render layer instead of one shared scene. Rejected for the same reason Babylon was rejected for the (now-parked) alternate track.
- `mkkellogg/GaussianSplats3D` — also Three.js-based and a reasonable alternative to Spark, but Spark is the more actively-developed successor and its own docs/community point toward it. Worth knowing as a fallback if Spark hits an integration wall.

## 3. Where content comes from (asset pipeline, not app code)

This spec does not build a capture tool. Real-world scenes come from existing mobile apps —
**Luma AI**, **Polycam**, or **Niantic Scaniverse** (all free-tier capable; Scaniverse has no paid
tier at all and exports SPZ natively). The human workflow is: scan on phone → export → run through
SuperSplat for cleanup/crop → `splat-transform` to `.spz` if not already → drop into the app's
asset folder. None of this is automated by v2; it's how a user or Navakanth would produce a splat
asset to test with.

## 4. Control-layer architecture (reused, not reinvented)

Same loop as the parent spec — this is not a new process, it's the existing one applied to a new
module:

```
EXTRACT (read Spark's API) → PORT (write v2/src/objects/splat.js) → RENDER_CHECK → TASTE_GATE → COMMIT
```

`RENDER_CHECK` gains one new row specific to this module:

| Check | Threshold | How |
|---|---|---|
| (existing 5 rows from parent spec, unchanged) | | |
| Splat object loads without throwing | no console error on `.spz` load | `read_console_messages` |
| Splat renders inside the shared scene, correctly sorted against existing mesh objects | no z-fighting/pop-through when a splat and a regular board object overlap in depth | screenshot + manual check at `TASTE_GATE` (sorting correctness is not scalar-checkable, per the parent spec's own "beauty is not measurable" principle — but *sorting* here is closer to correctness than taste, so flag any visible pop-through as a `RENDER_CHECK` fail, not just a taste note) |

Same hard cap: **3 iterations before mandatory human escalation.**

## 5. Phases

### Phase 0 — Precondition
PR #1 merged. v1 recoverable at tag `v1-final` (per parent spec Phase 4). Do not branch this work
off an unmerged `feat/bleuboard-v2`.

### Phase 1 — Renderer wiring
1. `npm`-equivalent: add Spark via the existing import-map pattern (v2 has no bundler — pin a
   specific Spark CDN/ESM build in the import map, same approach already used for Three.js itself).
2. New module: `v2/src/objects/splat.js` — mirrors the existing object modules' shape (see
   `board.js`/`models.js` for the pattern this codebase already uses for object types).
3. Wire `window.__sceneProbe` to also expose whatever Spark-specific state is useful for QA
   (e.g. splat count, load state) — extending the existing instrumentation, not creating parallel
   instrumentation.
4. `RENDER_CHECK` → `TASTE_GATE` → commit, same as every other module in this codebase.

### Phase 2 — One real test asset
1. Capture or source **one** small `.spz` test scene (a single object, not a full room — keep the
   first real test cheap to iterate on).
2. Confirm it loads, renders, and sorts correctly against at least one existing object type
   (e.g. a text label placed in front of it).
3. `RENDER_CHECK` → `TASTE_GATE` → commit.

### Phase 3 — Object-system integration
1. Add splat objects to whatever selection/manipulation system the other object types already use
   (the gizmo-raycast-guarded selection + floating Object Action Dock from `feat/bleuboard-v2`'s
   most recent commits) — splats should be selectable/movable like any other board object, not a
   special case.
2. Add a UI entry point (toolbar/palette) to place a splat object, matching the existing
   shapes/stickers palette pattern.
3. `RENDER_CHECK` → `TASTE_GATE` → commit.

### Phase 4 — Performance budget check
Splats are not free — large scenes can be expensive to render. Confirm the ≥45fps threshold (parent
spec's own bar) holds with at least one splat object active alongside a normally-populated board.
If it doesn't, the fix is asset-side (smaller/more-compressed `.spz`, per §3's SuperSplat step),
not a new engine decision — do not reopen the Spark-vs-alternative question over one heavy test asset.

### Phase 5 — Cut over
Same mechanism as the parent spec: PR into `master`, `DEPLOY_GATE` as a separate explicit approval.
Do not bundle this PR with unrelated work.

## 6. Explicitly out of scope

- Training new splat scenes from raw photos (`gsplat`/nerfstudio pipeline) — a genuinely separate,
  GPU-dependent offline pipeline. If this becomes a real need later, it's its own spec, not an
  addendum here.
- Any change to the rendering engine itself (Babylon.js or otherwise) — v2 stays on Three.js. A
  separate, now-parked exploration already evaluated Babylon.js for this product; it was not
  adopted, and this spec does not reopen that question.
- Video/animated splats (the `.gsd`/4DGS format some Unreal-side tools support) — static scenes only
  for this pass.
- Any UI for in-app capture (phone camera → splat, in-browser) — out of scope; capture happens in
  third-party apps per §3.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Sorting bugs between splats and existing mesh objects | Spark was chosen specifically because it solves this; still needs the explicit `RENDER_CHECK` row in §4, not just trust in the library |
| Large `.spz` assets tank frame rate | Phase 4 gate; fix is asset compression, not engine change |
| Scope creep into training/capture tooling | §6 states it explicitly; a future need there is a new spec |
| This spec starts before PR #1 is actually merged, compounding two unverified changes | Phase 0 is a hard precondition, stated up front |

## 8. Definition of done

> A user can place a real-world-captured `.spz` scene onto the board, select/move it like any other
> object, see it render correctly (sorted, no pop-through) against existing board content, at
> ≥45fps with zero console errors — reached through its own PR into `master`, after PR #1 has
> already merged.
