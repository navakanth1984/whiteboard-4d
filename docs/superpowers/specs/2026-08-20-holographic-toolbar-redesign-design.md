# BleuuBoard v2 — Holographic Toolbar + HUD Redesign

**Date:** 2026-08-20
**Repo:** `C:\Users\navka\navakanth001\whiteboard-4d` (branch: new `design/holographic-toolbar` off `master`)
**Scope decision:** Toolbar + HUD only, first pass. Modals/drawers, onboarding guide, and 3D scene
assets (avatars, environment, materials) are explicitly deferred to later phases — see §6.

---

## 1. Design direction (established via visual brainstorming)

Reference: **holographic touch-consoles** — the floating translucent glass panels from *Avatar*'s
science consoles / Iron Man's Jarvis interface, not literal COD/Fortnite skins. Three visual
directions were mocked up and compared (tactical-military, vibrant-stylized-opaque, and
glass-glow-hybrid); the tactical and opaque-plastic directions were explicitly rejected in favor of
translucent, edge-lit glass with volumetric glow.

**Core principle: "pull, not push."** The interface should invite engagement, not perform at the
user constantly:
- **Resting state is quiet** — dim glass, faint edge-light, near-imperceptible scanline. Calm,
  dormant, waiting.
- **Hover/proximity is the invitation** — glow gently intensifies as the cursor approaches/lands.
- **Active/touch is the payoff** — full amber bloom + ripple fires only on real interaction, so it
  reads as a reward, not a default visual state.
- **No ambient animation competes for attention.** The scanline sweep is felt, not watched — subtle
  enough that a user who isn't looking for it won't consciously register it.

This principle is why the palette approach (from the visual brainstorm) is **neutral base + single
accent reserved for active/important state**, not one hero-color per tool — constant multi-color
noise is the "push" failure mode this design explicitly avoids.

---

## 2. Visual system

### Palette
| Token | Value | Use |
|---|---|---|
| `--holo-glass-bg` | `rgba(20,45,60,.10)` → `rgba(10,25,40,.04)` gradient | Resting panel fill |
| `--holo-edge` | `rgba(120,235,255,.35)` (dim) → `.5` (hover) | Resting/hover border |
| `--holo-glow` | `rgba(80,220,255,.18)` (dim) → `.35` (hover) | Resting/hover box-shadow bloom |
| `--holo-accent-bg` | `rgba(255,200,80,.14)` → `rgba(255,140,20,.05)` gradient | Active panel fill |
| `--holo-accent-edge` | `rgba(255,210,110,.85)` | Active border |
| `--holo-accent-glow` | `rgba(255,180,60,.5)` + `rgba(255,140,20,.22)` (two-layer bloom) | Active box-shadow |
| `--holo-text` | `#bfefff` (resting) / `#ffe9a8` (active) | Label + icon color |

This keeps the existing cyan (`#38bdf8`-family) identity — it becomes the *glass* color rather than
the *accent* color — and reuses amber/gold as the single accent, consistent across every screen
compared during brainstorming.

### Typography
No change — `Outfit` (labels), `Syne` (logo), `JetBrains Mono` (HUD numerics) are already in
`v2/index.html`'s font stack and already read as "console/HUD-appropriate." Not in scope to replace.

### Icons
- **Base layer (quiet, load-bearing):** [Game-icons.net](https://game-icons.net) (CC BY 3.0) for
  toolbar tool icons where a thematically-precise shape exists (node/graph, flow/link, card/board,
  splat/particle, camera modes). These are line/silhouette SVGs — recolor to `currentColor` so they
  inherit the glow treatment for free.
- **Fallback for generic actions** (close, save, delete, etc. — where no thematic icon adds value):
  keep the current **Material Symbols Outlined** icons already wired up in the codebase. Not worth
  a wholesale icon-library swap for icons nobody will consciously notice — see §4 licensing note.
- **HUD frame elements** (corner brackets, panel border accents, if used): 
  [Kenney "Sci-Fi UI"](https://kenney.nl) pack (CC0) as a reference/source for shapes, redrawn as
  inline SVG/CSS rather than imported as image assets (keeps them recolorable and glow-able, and
  avoids shipping a raster/vector asset that can't inherit the effect system).
- Attribution: add a `CREDITS.md` (or extend `Credits – navakanth.csv`) entry for Game-icons.net
  (CC-BY requires it); Kenney/CC0 needs no attribution but crediting is good practice.

### Effect system (the actual "wow" — hand-coded, not imported)
Built as reusable CSS custom properties + one shared class pattern (`.holo-panel`, `.holo-panel.active`),
so every toolbar button/HUD badge gets the treatment from one definition, not per-element rules:
1. **Glass fill** — soft gradient + `backdrop-filter: blur()`, matches existing `.glass-drawer` blur
   approach already in the codebase (`v2/styles/main.css`), extended with translucency tuned lower.
2. **Edge glow** — `border` + layered `box-shadow` (outer bloom + inset rim light), two states
   (resting/hover) plus a third (active) per the palette table above.
3. **Scanline shimmer** — a single subtle horizontal light-sweep, CSS `@keyframes`, long duration
   (~4-6s), low opacity (~0.15-0.2 max), pauses/hidden on `prefers-reduced-motion: reduce`.
4. **Touch ripple** — on click/tap, a brief expanding ring pulse from the touch point (CSS animation
   triggered by a JS class toggle), reinforcing "you touched a pane of light" rather than "you
   clicked a button."
5. **Deferred to a later pass** (explicitly out of scope for this spec, per your "hard code later"
   call): chromatic-aberration edge fringing, particle/noise grain, flicker/instability micro-jitter,
   more elaborate volumetric bloom. These are real "wow" additions but add render cost and
   complexity — ship the core glass/glow/scanline/ripple system first, verify it feels right live,
   then layer these in as a follow-up pass once the base is proven.

---

## 3. Component scope (this pass)

Applies the effect system to, in `v2/index.html` + `v2/styles/main.css`:
- `#topbar` and all `.tb` buttons (main tool row: NAV/INK/TEXT/NODES/CARDS/BOARDS/SPLAT/IMAGE/
  VIDEO/AUDIO/FLOW/ERASE/FLOW MOTION/4D)
- `.tb-pov-switch` (FPS/TPS/Orbit buttons)
- `#hud` (object/link counter) and `.tb-hud`
- `#timeline-4d` (4D scrubber bar) — already touched by the 2026-08-20 a11y fix (PR #8); this pass
  restyles it visually on top of those accessibility attributes, doesn't change them
- D-pad / flight controls cluster

**Explicitly NOT touched this pass** (existing dark-glass styling stays as-is):
- Modals: Avatar Engine, Utilities drawer, Session Save/Load, Export Hub, asset-picker palettes
  (`#palette`, `.pal-item` grids)
- Onboarding guide (`#guide-overlay`)
- 3D scene content — placed objects, avatar model, environment/skybox, materials

Rationale: smallest change that's still a complete, coherent, shippable "wow" moment (the toolbar
and HUD are what's on-screen 100% of the time), lowest regression risk, fastest to verify live.
Modals/guide get a follow-up pass once this one is validated against real use.

---

## 4. Licensing

| Source | License | Obligation |
|---|---|---|
| Game-icons.net | CC BY 3.0 | Attribution required — add to `CREDITS.md` / existing credits file |
| Kenney Sci-Fi UI (shape reference only, redrawn) | CC0 | None, credit is courtesy only |
| Material Symbols (existing, unchanged) | Apache 2.0 | None |

No new runtime dependencies, no build step change — icons are inlined as SVG or added to the
existing icon-font approach; the effect system is hand-written CSS.

---

## 5. Testing / verification plan

Per the repo's CDLC: implement on a new branch, verify live before commit.
- Local `server.cjs` + Browser tool, both light-touch (hover, resting) and interaction (click/active)
  states screenshotted for each restyled component.
- Regression-check the 2026-08-20 a11y fixes (PR #8) aren't visually or functionally broken —
  `aria-label`s, `#tl-scrubber`, focus-visible rings, `#btn-4d` toggle behavior all re-verified.
- `prefers-reduced-motion` check: scanline/ripple animations disabled, static glow remains.
- Console clean (0 new errors) after the change.
- Real interaction test matching the "pull not push" principle: confirm resting state is visually
  calm in a full screenshot (no panel should visually dominate at rest), and that hover/active states
  are the only place bloom intensity increases.

---

## 6. Deferred to later phases (not in this spec)

1. Modal/drawer/guide-overlay restyle to match (same effect system, applied to remaining surfaces).
2. Additional effect layers: chromatic aberration, particle/noise, flicker/jitter, deeper volumetric
   bloom.
3. **3D scene asset upgrade** (separate, larger effort — original request's second half):
   ultrarealistic materials/environment/avatar assets sourced from Poly Haven (CC0 HDRIs/PBR
   textures), Sketchfab (CC0/CC-BY models), Quaternius (CC0 low-poly-to-mid-poly packs), and
   Mixamo (free rigging/animation) — not started, needs its own brainstorm/spec once this UI pass
   ships, since it's a materially different kind of work (3D asset pipeline vs. CSS/DOM styling).
