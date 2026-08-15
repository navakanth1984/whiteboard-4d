# Whiteboard-4D / Bleuboard — Canonical KB

## System Identity

**Status**: Verified 2026-08-14

BLEUUBOARD (aka whiteboard-4d) is a single-file Three.js 4D creative whiteboard: users draw 3D
strokes, place shapes/images/video/animated critters, and can push objects into a 4th-dimension
tesseract projection. Deployed live at **bleuboard.vercel.app**.

Core interaction system: **SASCore** (Spatial Awareness System) — a client-side, per-drag
interpretation engine. It decides, live, whether an object being dragged is `frame: 'ground'`
or `'screen-follow'`, whether the user is overriding that default, and whether the choice should
be `remembered` for that object going forward. **SASCard** renders that interpretation to the
user (HUD explains the intention, never the raw engine mechanics — this is a stated design
principle, not incidental UI copy).

**Important distinction** (source of a mid-session correction on 2026-08-14): SASCore's
`{frame, override, remembered}` state is ephemeral and client-side only. It is **not** part of
the network-syncable session format. The actual serializable "wire format" is
`serializeSession()`'s output:

```js
{ v: 2, objects: [{id, type, label, color, fourD, pos, rot, scale, orbitPattern, orbitRadius, src}], links: [{a, b}] }
```

This shape is structurally similar to Excalidraw's `ExcalidrawElement` (flat per-object
records), but currently has **no per-element `version`/`versionNonce`** — only one global
schema version (`v: 2`) for the whole session. Any future multiplayer/live-sync work needs to
add per-element versioning to this shape; SASCore itself never needs to be touched for that,
since it operates purely on local object state regardless of how that state got there.

### Verified
- `serializeSession()` / `loadSessionData()` shape — verified by reading
  `index.html` lines ~3808–3838 directly (grep + read, 2026-08-14).
- SASCore/SASCard existence and role — verified via grep in `index.html` (lines ~2937–3438),
  not just inferred from session-log descriptions.
- Site is live and serving real content — verified via WebFetch content check
  ("BLEUUBOARD — 4D Creative Whiteboard, ALPHA_") plus response header freshness
  (`Age: 25s` immediately after a fresh `vercel --prod` deploy), 2026-08-14.
- Repo structure: standalone, `master` branch, root commit `e99afc3` (2026-08-14), pushed to
  `github.com/navakanth1984/whiteboard-4d` (public). Vercel project `bleuboard`
  (`prj_iKxcmpHegBoNf4pTt67cfuScAM6h`, team `navakanth1984s-projects`) git integration is
  connected to this repo — verified via `vercel git connect` CLI output ("Connected") and the
  project's "Updated" timestamp jumping to `13s` immediately after.

### Known Gaps
- **No git history before 2026-08-14.** The prior local `.git` (which lived at
  `C:\Users\navka\navakanth001\whiteboard-4d`, remote `navakanth1984/AgentOSClaude`) was lost
  when the folder was moved to `E:\navakanth001` (exFAT) — the move silently dropped the
  hidden `.git` directory. Attempting to recover from the GitHub remote failed: cloning
  `AgentOSClaude` at `main` showed a completely different, unrelated codebase (a memory/hooks
  framework, not Bleuboard) — meaning either the remote was repurposed/force-pushed over at
  some point, or the Bleuboard commits were local-only and never pushed. Neither is
  distinguishable from here. **All commit-by-commit history for this project prior to
  2026-08-14 is permanently unrecoverable** from any source checked.
- **No multiplayer/live-sync exists.** Current sharing model is a compressed-URL link
  (LZ-String), single-creator, recipients get read-only "viewer mode" navigation — not live
  co-editing. This was explored as a *possible future direction* (see Design Notes below) but
  is explicitly NOT built or currently scoped, per `visual-interactor/docs/HANDOFF.md`.
- **`visual-interactor` is a separate project, not a merge target.** Its own handoff doc
  treats this repo as a read-only reference and states not to modify it. Do not merge the two
  codebases — different stacks (this is a single-file vanilla app; visual-interactor is a
  Vite + Three.js app with its own package.json, no React).
- exFAT (E: drive) cannot reliably hold this repo's `.git` — confirmed empirically, not just
  inferred from the general NTFS-junctions rule. Keep this repo on C: (NTFS) going forward.

## Design Notes — Multiplayer Sync (exploratory, not built)

Two candidate architectures were researched and compared on 2026-08-14, in case live
multiplayer editing is ever added to the roadmap:

1. **Excalidraw-room pattern** — a dumb Socket.IO relay server (no server-side state), clients
   union-merge elements by `version`, use `versionNonce` to break ties on concurrent edits to
   the same element, tombstone deletes via `isDeleted` rather than removing them. **Less
   adaptation work**: Bleuboard's `serializeSession()` object shape is already close to
   `ExcalidrawElement`'s — would need `version` + `versionNonce` fields added, and the relay
   server is largely reusable as-is.
2. **Mozilla Hubs pattern (NAF/Reticulum)** — Networked-Aframe syncs entity properties near-
   continuously over WebRTC; backend is Reticulum (Elixir/Phoenix), a real service with its own
   infra (Hubs-Ops/AWS). **More adaptation work**: assumes continuous property broadcast, not
   discrete merge-on-reconnect; would need Bleuboard's objects re-modeled as networked entities;
   introduces a new language/runtime (Elixir) into the stack.

Neither requires touching SASCore — it stays purely local regardless of which sync model (or
neither) is chosen.

Related, evaluated and rejected:
- **Babylon.js** as a Three.js replacement — not worth it. Bleuboard's SASCore and
  bloom/Fresnel/OutlinePass post-processing pipeline are deeply Three.js-specific; Babylon.js's
  more opinionated, batteries-included architecture would mean reimplementing both, for a
  benefit (octree-based large-scene performance) this project doesn't need.
- **Excalidraw as a competitor/replacement** — no, different category. Excalidraw is 2D
  diagramming; Bleuboard is a 3D spatial authoring tool with its own intent-based interaction
  model. Not a replacement candidate.
- **Excalidraw as an embedded 2D panel inside the 3D scene** — technically feasible
  (`@excalidraw/excalidraw` is a mountable React component; would need a "React island" pattern
  since `visual-interactor` — the likely host for this, not this repo — is vanilla Three.js/Vite,
  no React) but not yet decided or built. Flagged tension: this repo's sibling project
  (`ivd`, a 2D document format) was explicitly superseded in favor of 3D-native — a bounded 2D
  panel *inside* the 3D scene is narrower than what was superseded, but worth a conscious
  decision rather than drifting back into it.

---

## v2 Architecture Direction (fork + craft pass)

**Status**: Unverified — design only. Specced 2026-08-15, nothing implemented.

Full design: `docs/superpowers/specs/2026-08-15-bleuboard-v2-design.md`.

v1 stays the served app until a v2 cutover is explicitly approved. v2 is built alongside it in
`v2/`, never in place. v1's pre-fork state is to be tagged `v1-final` as the permanent reference.

### The constraint that drives everything

`index.html` is 3,817 lines carrying markup, CSS, and all Three.js logic. No visual craft pass can
be applied to it reliably — an agent cannot hold the whole file in context and edit it precisely at
the same time. **The fork is a precondition for the craft pass, not housekeeping.**

Three.js is pinned at **r146 via CDN**, using the legacy `examples/js/*` global-script builds.
**Those were removed from Three.js in r160.** Every modern reference (post-processing composers,
KTX2, WebGPU) assumes ES modules. v2 therefore migrates to ES modules + an import map *before* any
feature port. No bundler and no build step — the "plain `node server.cjs`, edit and reload"
workflow is preserved deliberately.

### Control layer: Harness + Loop + Graph

The automated gate uses an **inverted metric**. It never scores "looks good" — visual quality is a
domain where autonomous loops drift randomly (`agentic-engineering` Guideline 1). It scores the
negative: zero console errors, canvas luminance strictly between 2/255 and 253/255, ≥45fps
sustained 3s, and screenshot differs from the previous iteration.

**Rationale**: in Three.js the dominant failure is a black canvas, not ugliness. The luminance
bound exists specifically because the Fresnel hologram shader regressed to a dark screen in a prior
session. Taste is judged by a human at an explicit gate, capped at 3 iterations per module before
mandatory escalation.

### Reference strategy (split)

- **Logic/feature parity** is checked against v1, using the extracted inventory in spec §4.
- **Visual direction** is checked against a new target still-frame, not against v1.

Design references (Kage, Towers, Sketchbook, CollectUI) are mined for *technique* — camera
movement, parallax depth, foreground transparent-PNG layering, material and lighting quality —
**not for structure**. They are scroll-driven marketing sites; copying their structure is how this
project would accidentally become the rejected option B.

### Verified
- `index.html` line count (3,817) and the r146 `examples/js/*` CDN dependency list — verified by
  reading the file and grepping its script tags directly, 2026-08-15.
- v2 module/function inventory (spec §4) — extracted by grep over function declarations and
  element ids, 2026-08-15. Not recalled from any prior session.

### Known Gaps
- **Nothing in this section has been implemented.** No v2 directory exists. The spec is a plan.
- `index.html` and `server.cjs` carry **uncommitted WIP** (postprocessing/hologram pass) on
  branch `master`. Spec Phase 0 blocks on Navakanth choosing commit vs stash. Until then a fork
  risks losing that work.
- **Unanswered**: whether any v1 feature may be dropped in v2. Asked 2026-08-15, no answer given.
  Porting all 18 modules is the expensive default; this blocks spec Phase 2.
- The ≥45fps threshold is an **assumed** target, never measured against v1. v1's actual baseline
  frame rate on this machine is unknown — the threshold may prove wrong in either direction.
- Two pre-existing bugs are to be ported **as-is**, deliberately, so parity stays honest:
  `recognizeStroke()` star-vs-square misclassification, and stroke groups never getting an explicit
  `root.position` (which breaks "To Text"; a `lastStrokeCentroid` workaround exists but was never
  backported).
- Mobbin MCP is **not connected** to the Claude Code session (absent from the server list). Figma
  MCP is present but **unauthorized** (needs OAuth via claude.ai connector settings or `/mcp` in an
  interactive terminal). The spec assumes neither is available.
