# BleuuBoard v2 — Avatar-HUD Interface Redesign + Alien-Humanoid Avatar

**Date:** 2026-08-20
**Repo:** `C:\Users\navka\navakanth001\whiteboard-4d` (branch: `design/holographic-toolbar` off
`fix/qa-accessibility-labels` — note: **branch name predates the final direction below and is kept
as-is to avoid rewriting pushed history; the design superseded the branch's namesake.**)
**Scope decision:** Three coordinated tracks — (1) toolbar + HUD visual redesign (CSS/DOM,
ceiling-limited, see §1.1), (2) sourcing an alien-humanoid VRM avatar (3D asset), and
(3) genuine WebGL-rendered atmosphere elements in the scene itself (real bloom/particles, the only
route to real cinematic depth — see §1.1 and §4a). Modals/drawers, onboarding guide, and the wider
3D scene (skybox/materials beyond the avatar) remain deferred to later phases — see §7.

---

## 1. Design direction — how we got here (context for future sessions)

Three directions were mocked up and compared live via the brainstorming visual companion before
landing on the final one. Recording the rejections, not just the winner, so this isn't re-litigated:

1. **Fully holographic glass** (translucent panes, cyan glow, scanline shimmer) — **rejected**:
   "flat and lame." This is the generic every-AI-SaaS-site look; it read as cheap, not premium.
2. **Bold flat esports-broadcast graphic** (Valorant/Apex-style diagonal cuts, hard offset shadows,
   no transparency) — mocked up as an alternative, no explicit verdict given before the reference
   image below superseded discussion.
3. **Avatar (2009 film) RDA science-console HUD** — a reference image of the film's in-world
   interface was provided directly: layered floating panels at different depths (not one flat
   strip), a **circular radial dial as the hero touch element**, dense multi-tier data panels with
   real typographic hierarchy (label/value/unit), hairline corner-bracket framing, live-camera-style
   imagery embedded in panels, and genuine atmospheric bloom against a dark backdrop. **This is the
   locked direction** — confirmed explicitly ("overall UI feel should be somewhere like this").

**Why 1 and 2 failed and 3 works:** flat CSS gradients and single-strip toolbars can't carry
"premium" — the reference's richness comes from *structural* depth (layered panels, a hero radial
element, dense information design), not from color choice alone. The lesson for implementation:
detail and layering matter more than picking the right glow color.

**Core principle carried forward from the earlier brainstorm: "pull, not push."** Still valid,
independent of which visual skin sits on top of it:
- Resting state reads calm — dim glow, no panel visually dominates the frame at rest.
- Hover/proximity intensifies glow — the interface "wakes up" for the user's attention.
- Full bloom + response fires only on real interaction — a reward, not a default state.
- No ambient animation loud enough to consciously notice unprompted.

This is also why the palette stays **neutral cyan base + single amber/gold accent for
active/important state** (proven out in the radial-dial mockup's progress arc) rather than a
multi-color toolbar — constant color noise is exactly the "push" failure mode.

### 1.1 The DOM/CSS ceiling, and the architecture fork it forced

After the radial-dial + telemetry-panel structure was approved, two further rounds of iteration
(adding atmospheric fog/blur/grain backdrop; then swapping hand-drawn CSS for real pre-made assets
— Kenney's CC0 "UI Pack: Sci-Fi", actually downloaded and composited into a live mockup) both still
read as "still off." Diagnosis: **the reference image is a movie VFX concept render** (real
depth-of-field, painted lighting, photographic environment integration). A DOM/CSS overlay is
structurally a flat 2D layer painted *above* the 3D scene — no amount of glow/blur closes that gap,
because the gap is architectural, not stylistic. (The Kenney pack was also independently the wrong
fidelity tier for hero elements — its crosshair sprites are 30×30px game reticles, visibly blocky
blown up to a 180px dial; fine for small ancillary icons, not for hero HUD pieces.)

This forced a real fork, evaluated explicitly:
- **(A) CSS3DRenderer** — keeps real accessible DOM, adds genuine 3D positioning/parallax via
  Three.js's CSS3DRenderer addon, but panels still don't participate in the WebGL pixel buffer, so
  no real bloom/fog/lighting integration. Partial fix, zero accessibility risk.
- **(B) Fully WebGL-native HUD** (canvas-texture panels as real 3D meshes) — the only way to get
  genuine bloom/fog/lighting integration, closest to the reference. **Rejected**: every control
  becomes a raycasted click target instead of a native `<button>`, all text becomes a rasterized
  texture — this would require rebuilding the PR #8 accessibility work (`aria-label`s, focus-visible,
  `role="switch"` semantics) from scratch via a parallel invisible DOM shadow layer for assistive
  tech. Real, unacceptable cost for a toolbar people interact with constantly.
- **(C) Hybrid — CHOSEN.** The interactive DOM toolbar stays exactly as scoped in §2/§3 (protects
  PR #8, no interaction-model rewrite, ships fast). Separately, **add genuine WebGL-rendered
  atmosphere elements directly in the 3D scene** — real bloom-lit holographic geometry, particles,
  volumetric light — that make the overall experience read as cinematic and integrated, without
  touching how the toolbar works. See §4a.

**Implication for the rest of this spec:** §2/§3 (DOM toolbar) ship as a real, honest visual
improvement over the current toolbar, but explicitly **will not** look like the reference image on
their own — that ceiling is accepted, not hidden. §4a is where the actual "wow" now lives.

---

## 2. Visual system

### Structure (the actual differentiator — see §1)
- **Layered depth, not a flat strip.** Panels should read at (at least) two implied distances —
  e.g. a hero element slightly "closer" than surrounding data chips, via size/glow-intensity/
  z-index, not literal 3D transforms (keep it DOM/CSS, no WebGL needed for this layer).
- **Circular radial dial as the hero interaction** for the primary/active tool selector — an SVG
  arc-progress ring (`stroke-dasharray` technique) with a glowing center icon, replacing a plain
  square "active" button. Reference implementation approach: same technique as
  [react-circular-progressbar](https://github.com/iqnivek/react-circular-progressbar) (MIT) —
  hand-rolled in vanilla SVG to respect the no-build-step constraint, not an added dependency.
- **Dense data panels** for HUD/telemetry (object count, links, session stats, POV mode): multi-tier
  typography (small mono label → large value → small unit), a thin progress/status bar, a live-status
  dot, hairline corner-bracket framing (`::before`/`::after` L-shaped borders, not full panel borders).

### Palette
| Token | Value | Use |
|---|---|---|
| `--hud-glass-bg` | `rgba(15,45,60,.35)` → `rgba(5,15,25,.55)` gradient | Panel fill |
| `--hud-edge` | `rgba(120,235,255,.35–.6)` | Border / corner-bracket color |
| `--hud-glow` | `rgba(80,220,255,.12–.35)` layered box-shadow | Ambient + hover bloom |
| `--hud-accent` | `#ffcf5c` (amber) | Radial dial active arc, live-status highlights, "this matters" state |
| `--hud-text` | `#e8fbff` (values) / `#5a8a9a`–`#8fe8ff` (labels) | Typography hierarchy |

### Typography
No change — `Outfit`, `Syne`, `JetBrains Mono` already in `v2/index.html`'s font stack and already
read as console-appropriate. `JetBrains Mono` becomes the primary voice for the denser telemetry
panels (labels, stat values) — already used for HUD numerics, just extended more consistently.

### Icons
Revised after live-testing real Kenney pack assets (see §1.1): downloaded and composited the actual
CC0 pack into a mockup, verdict was **wrong fidelity tier for hero elements** (blocky small-sprite
crosshairs, plain corner squares, not the fine hairline detail the reference needs). Scoped down:
- **Kenney "Sci-Fi UI"** (CC0) — keep only for small ancillary elements (cursors, minor status
  glyphs) where its native pixel-sprite scale is appropriate. **Not** used for the hero radial dial
  or panel corner-bracket framing — those stay hand-drawn inline SVG (thin `stroke`, precise,
  scales cleanly at any size, which is exactly what the sprite approach couldn't do).
- **Game-icons.net** (CC BY 3.0) — thematically-precise tool icons (node/graph, flow, card/board).
  Attribution required — add to `CREDITS.md` / `Credits – navakanth.csv`.
- Generic actions (close, save, delete) keep existing Material Symbols Outlined — no value in
  swapping icons nobody consciously looks at.

### Effect system (hand-coded, per the earlier "hard code later" decision)
Ship first: glass fill (gradient + `backdrop-filter: blur()`), layered edge glow (box-shadow,
resting/hover/active tiers), radial dial arc animation, corner-bracket framing, a live-status pulse
dot. **Still explicitly deferred** to a follow-up pass: chromatic aberration, particle/noise grain,
flicker/jitter, deeper volumetric bloom — unchanged from the original decision, not revisited.

---

## 3. Component scope (UI track)

Same target surfaces as originally scoped — **unchanged**:
- `#topbar` and all `.tb` buttons (NAV/INK/TEXT/NODES/CARDS/BOARDS/SPLAT/IMAGE/VIDEO/AUDIO/FLOW/
  ERASE/FLOW MOTION/4D) — the currently-active tool becomes the radial-dial treatment; others stay
  as simpler bracket-framed rectangular buttons (a full ring-dial per tool would be visual noise —
  reserve the "hero" treatment for what's active, consistent with the accent-restraint principle).
- `.tb-pov-switch` (FPS/TPS/Orbit), `#hud` + `.tb-hud`, `#timeline-4d` (visual restyle only —
  doesn't touch the PR #8 a11y attributes), D-pad/flight cluster.

**Explicitly NOT touched this pass:** modals (Avatar Engine, Utilities, Session, Export Hub,
palette pickers), onboarding guide, 3D scene environment/materials — deferred, see §7.

---

## 4. Avatar track — alien-humanoid VRM character

**New scope, added this session.** The in-world avatar model should read as an alien-humanoid in
the spirit of the *Avatar* reference (tall, blue-toned, otherworldly), sourced and integrated
alongside the UI work rather than deferred, since the reference image was explicitly named as the
target feel for "overall UI" including the world the UI sits over.

### IP constraint (binding, not optional)
The Na'vi character design (blue striped skin, specific facial proportions, tail, ear shape) is a
copyrighted character design (Disney/20th Century). This work targets the **aesthetic** — tall,
blue/bioluminescent-toned, elegant alien-humanoid — via genuinely free/CC-licensed third-party
assets. **Do not attempt to reproduce the Na'vi design feature-for-feature.**

### Sourcing (both, compared live — per explicit decision)
1. **VRoid Hub (primary candidate)** — native VRM, zero conversion, drops directly into the
   existing `@pixiv/three-vrm` loader (`v2/src/nav/vrm_loader.js`). Candidates found:
   - [Alien Girl](https://hub.vroid.com/en/characters/2883369553102616793/models/3390903002810894116)
   - [Free Alien Model](https://hub.vroid.com/en/characters/5639149099865727656/models/5925224587623355702)
     — **license: free to use, credit to creator "Cryinadonut" required, no resale/redistribution
     as own work.** Add to `CREDITS.md` if selected.
   - [ALIEN](https://hub.vroid.com/en/characters/7212851844340800823/models/673723520194694360)
   - Trade-off: anime-stylized, not painterly-realistic — may or may not read as "premium enough"
     next to the redesigned HUD; verify live before committing.
2. **Sketchfab CC0 (secondary candidate)** — more sculpted/realistic potential. Candidate:
   [Alien Original Character](https://sketchfab.com/3d-models/alien-character-rigged-f2072fbe2db24ee3b975d104822cd53e)
   (rigged, Maya/Blender, CC-licensed — verify exact license tier on download page before use).
   Trade-off: exports glTF, not VRM — the existing avatar loader expects VRM blendshapes for facial
   expression (per the VRM loader's "procedural eye blinking, look-at IK" features documented in
   `wiki/log.md`); a Sketchfab model likely won't drive those without either (a) a VRM conversion
   pass (e.g. via VRoid Studio import/export, if the mesh/rig is compatible) or (b) extending the
   avatar system to handle a plain-glTF avatar without expression blendshapes as a fallback path.
3. **Ready Player Me — considered, not pursued.** Fully customizable skin color but realistic-human
   proportions only; can't produce an "alien" read regardless of skin tint. Also now Netflix-owned
   (2025 acquisition) — noted in case that's relevant to a future licensing decision, not currently
   a blocker since not selected.

### Decision process
Pull both a VRoid candidate and the Sketchfab candidate into the actual live scene, compare against
the redesigned HUD, and decide based on how each actually reads in context — not from thumbnails
alone. This is exploratory integration work, not a committed final pick yet.

---

## 4a. In-scene atmosphere track (WebGL-native — this is where the real "wow" lives)

Per the §1.1 architecture decision (hybrid, option C): real cinematic depth comes from genuine
WebGL-rendered elements participating in the existing bloom/fog pipeline
(`v2/src/fx/postprocessing.js`'s `UnrealBloomPass`), not from DOM/CSS. This track adds actual
`THREE.Object3D` content to the scene — not an overlay.

### Concrete elements (first pass — keep scoped, more can follow once this is proven live)
1. **A holographic ring/dial mesh** near the avatar or as a floating world-space element — real
   geometry (e.g. a torus or ring `THREE.Mesh` with an emissive material tuned above the bloom
   `threshold` of `0.82`), so it genuinely blooms with the scene's lighting rather than faking glow
   via CSS. This is the actual 3D counterpart to the DOM radial dial's visual language — echoing it,
   not duplicating its function (the DOM dial stays the real interactive control; this is ambient).
2. **Volumetric light shafts / particle atmosphere** — reuses the existing holodeck environment
   system (`v2/src/core/holodeck.js`, "Cyber Void, Vaporwave Sunset, Architect Studio, Deep Space
   Nebula" presets per `wiki/log.md`) as the base fog/atmosphere; adds a lightweight particle system
   (`THREE.Points` with an emissive/additive material) for drifting motes, tuned to also cross the
   bloom threshold subtly — this is what gives the reference image's sense of "air" and depth.
3. Both elements are **decorative, non-interactive** — no raycasting, no click handling, no
   accessibility surface needed, because they carry zero functional weight. This is precisely what
   keeps this track low-risk relative to option B's rejected full-HUD-in-WebGL approach.

### Explicitly not in this pass
Moving the actual toolbar/telemetry panels into WebGL (rejected, §1.1); a full environment/material
overhaul (§7, deferred); anything requiring raycasted interaction.

---

## 5. Licensing summary

| Source | License | Obligation |
|---|---|---|
| Game-icons.net | CC BY 3.0 | Attribution required |
| Kenney Sci-Fi UI (shapes, redrawn) | CC0 | None, credit courtesy |
| Material Symbols (existing) | Apache 2.0 | None |
| VRoid Hub "Free Alien Model" (if selected) | Free, credit required, no resale | Attribution required |
| Sketchfab alien candidate (if selected) | CC-tier TBD on download | Verify before committing |

---

## 6. Testing / verification plan

**UI track** (per repo CDLC — new branch, verify live before commit):
- Local `server.cjs` + Browser tool; resting, hover, and active states screenshotted per component.
- Regression-check PR #8's a11y attributes (`aria-label`s, `#tl-scrubber`, focus-visible rings,
  `#btn-4d` toggle) survive the visual restyle unchanged.
- `prefers-reduced-motion`: dial/pulse animations disabled, static state remains legible.
- Console clean (0 new errors).
- "Pull not push" check: full-screen screenshot at rest should have no panel visually dominating;
  bloom intensity increase should only be observable on hover/active.

**Avatar track:**
- Both candidates loaded into the live scene via the existing Avatar Engine modal / VRM loader path.
- Confirm no console errors on load for either.
- Confirm existing avatar features (SpringBone physics, eye blink, look-at IK per `wiki/log.md`)
  still function with whichever is selected — if the Sketchfab glTF candidate lacks blendshapes,
  explicitly verify what degrades gracefully vs. breaks.

**In-scene atmosphere track:**
- Confirm the ring mesh / particle system actually bloom (visually brighter/glowing vs. the same
  element with bloom temporarily disabled — a real before/after, not assumed).
- Frame-rate check against the existing device-tier budget system (`v2/src/core/device_tier.js`) —
  confirm no regression below the previously-verified 44–48 FPS baseline on mobile tier.
- Confirm zero interactivity was accidentally added (no raycasting/click handlers on the decorative
  elements) — this is what keeps the track's risk low, verify it stayed that way.
- Console clean (0 new errors).

---

## 7. Deferred to later phases (unchanged from original) + explicitly rejected

**Deferred (may revisit later, not rejected):**
1. Modal/drawer/guide-overlay restyle to match the new HUD language.
2. Chromatic aberration, particle/noise, flicker/jitter, deeper volumetric bloom on the DOM layer.
3. Wider 3D scene asset upgrade (environment/skybox, materials) beyond the avatar itself — Poly
   Haven (CC0 HDRIs/PBR textures), Quaternius (CC0 packs) remain candidate sources, not started.
4. CSS3DRenderer-based DOM parallax (§1.1 option A) — not chosen for this pass, but a legitimate
   lower-risk upgrade path if the hybrid approach's DOM/WebGL visual disconnect ever becomes a
   problem worth solving later.

**Explicitly rejected, do not re-propose without new information:**
- Fully WebGL-native HUD with raycasted controls (§1.1 option B) — rejected specifically because of
  the accessibility rebuild cost, not because it wouldn't look good. If ever reconsidered, that cost
  needs to be re-evaluated fresh, not assumed away.
- Kenney "Sci-Fi UI" pack sprites as hero-element assets (§2 Icons) — tested live, wrong fidelity
  tier. Fine for small ancillary icons only.
