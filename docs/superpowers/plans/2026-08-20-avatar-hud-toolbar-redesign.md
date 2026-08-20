# Avatar-HUD Toolbar Redesign (Track 1: DOM/CSS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle BleuuBoard v2's toolbar, telemetry HUD, POV switch, D-pad, and 4D scrubber bar
into the Avatar-RDA-HUD visual language (radial-dial active-tool treatment, dense bracket-framed
telemetry panels, neutral-cyan-base + amber-accent palette) — the DOM/CSS track from
`docs/superpowers/specs/2026-08-20-holographic-toolbar-redesign-design.md` §2/§3.

**Architecture:** Pure CSS + one small vanilla-JS init module (`v2/src/ui/toolbar_hud.js`) that
injects a shared SVG progress-ring partial into each `.tb` button once at startup, matching the
existing `init*()` module pattern (`initGuide()`, `init4DTimelineUI()`, etc.) already wired up in
`v2/index.html`. `v2/src/ui/hud.js`'s `updateHUD()` is upgraded from `.textContent` to structured
`.innerHTML` for the desktop telemetry panel only (mobile `#hud` stays plain text — no room for a
dense panel at that size). No build step, no new dependencies, matches repo convention.

**Tech Stack:** Vanilla JS (ES modules, no bundler), CSS custom properties, inline SVG. No test
framework in this repo — verification is live Browser-tool screenshot + `read_console_messages`
(0 errors), matching every prior `wiki/log.md` entry's "Live CDP verification" pattern.

**Not in this plan (spec §2 Icons):** swapping toolbar icons from Material Symbols to
Game-icons.net is intentionally excluded here — it's an isolated, independently-shippable change
(icon font/asset swap, no layout impact) with lower visual payoff than the structural changes this
plan covers, and doesn't block seeing the redesign work live. Track as a follow-up task once this
plan's PR merges, not a gap in this plan.

## Global Constraints (from spec)

- **"Pull not push"**: resting state must read calm — no panel visually dominates at rest; glow
  intensity increases only on hover/active, never as an ambient/looping default.
- **Palette**: neutral cyan-glass base + single amber (`#ffcf5c`-family) accent reserved for
  active/important state only — never one hero-color per tool.
- **Must not regress PR #8's accessibility work**: `#btn-4d`'s `role="switch"`/`aria-pressed`,
  `#tl-scrubber`'s `aria-label`, all 6 icon-only close buttons' `aria-label="Close"`, and every
  `:focus-visible` ring must survive unchanged.
- **`prefers-reduced-motion: reduce`**: all new animations (ring arc transition, pulse dot) must be
  disabled, static end-state remains legible.
- **No new runtime dependencies, no build step** — hand-written CSS/SVG only.
- Every task must be verified live (local `server.cjs` + Browser tool) before commit — this repo's
  standard is "prove it works," not "it should work."

---

## File Structure

- **Modify:** `v2/styles/main.css` — new `--hud-*` design-token custom properties (top of file);
  restyled `.tb`, `.tb.active`, `.tb-hud`, `#hud`, `.tb-pov-switch`/`.pov-btn`, `#spatial-dpad`,
  `#timeline-4d` rule blocks.
- **Modify:** `v2/index.html` — add `<script type="module">` import + init call for the new toolbar
  HUD module; no structural markup changes to existing buttons (the SVG ring is injected by JS, not
  hand-written per button, to avoid 14x repetitive markup).
- **Modify:** `v2/src/ui/hud.js` — `updateHUD()` desktop-panel branch upgraded to structured HTML.
- **Create:** `v2/src/ui/toolbar_hud.js` — single-responsibility module: injects the SVG progress-ring
  partial into every `.tb` button once at startup, and drives its `stroke-dashoffset` via a CSS class
  toggle (no per-frame JS — the ring's "fill" is a fixed full-circle reveal on `.active`, not an
  animated progress value, since there's no real "progress" quantity for a tool-select button; this
  matches the spec's "arc-progress ring technique" used as a decorative activation ring, not a
  literal progress meter).

---

## Task 1: HUD design tokens

**Files:**
- Modify: `v2/styles/main.css:1-4` (top of file, after the `*{...}` reset rule)

**Interfaces:**
- Produces: CSS custom properties `--hud-glass-bg-1`, `--hud-glass-bg-2`, `--hud-edge`,
  `--hud-edge-hover`, `--hud-glow`, `--hud-glow-hover`, `--hud-accent`, `--hud-accent-glow`,
  `--hud-text-value`, `--hud-text-label` — every later task consumes these instead of hardcoding
  colors, so the palette can be tuned in one place.

- [ ] **Step 1: Add the token block**

Insert immediately after line 1 (`*{margin:0;padding:0;box-sizing:border-box;}`) in
`v2/styles/main.css`:

```css
:root{
  --hud-glass-bg-1: rgba(15,45,60,.35);
  --hud-glass-bg-2: rgba(5,15,25,.55);
  --hud-edge: rgba(120,235,255,.35);
  --hud-edge-hover: rgba(120,235,255,.6);
  --hud-glow: rgba(80,220,255,.18);
  --hud-glow-hover: rgba(80,220,255,.35);
  --hud-accent: #ffcf5c;
  --hud-accent-glow: rgba(255,180,60,.5);
  --hud-text-value: #e8fbff;
  --hud-text-label: #6fb8d0;
}
```

- [ ] **Step 2: Verify no visual change yet (tokens unused so far)**

Start the local server and confirm the page still loads with 0 console errors — this step only adds
unused custom properties, so it's a pure no-op sanity check before building on top of it.

Run:
```bash
cd C:\Users\navka\navakanth001\whiteboard-4d
node server.cjs
```
Open `http://127.0.0.1:3000/v2/` in the Browser tool, call `read_console_messages` with
`onlyErrors: true` — expected: no output (no errors). Take one screenshot to confirm the page still
renders identically to before this change (nothing should look different).

- [ ] **Step 3: Commit**

```bash
git add v2/styles/main.css
git commit -m "feat(hud): add design token custom properties for HUD redesign"
```

---

## Task 2: Radial-dial active-tool treatment

**Files:**
- Create: `v2/src/ui/toolbar_hud.js`
- Modify: `v2/index.html` (add script import near the other `init*()` calls)
- Modify: `v2/styles/main.css:377-393` (the `.tb` rule block)

**Interfaces:**
- Consumes: `--hud-*` tokens from Task 1.
- Produces: `initToolbarHUD()` — exported function, called once at startup, no arguments, no return
  value. Injects one `<svg class="tb-ring">...</svg>` as the first child of every `button.tb` in
  `#bottombar`. Later tasks don't depend on this function's internals, only that every `.tb` button
  ends up with a `.tb-ring` child after it runs.

- [ ] **Step 1: Find where other `init*()` functions are called, to match the pattern**

```bash
cd C:\Users\navka\navakanth001\whiteboard-4d
grep -n "initGuide\|init4DTimelineUI\|initHUDSystem" v2/index.html
```

Expected: a `<script type="module">` block (likely near the bottom of `v2/index.html`, before
`</body>`) that imports and calls these functions. Note the exact import path style used (e.g.
`import { initGuide } from './src/ui/guide.js';`) so Step 3 matches it exactly.

- [ ] **Step 2: Create the module**

Write `v2/src/ui/toolbar_hud.js`:

```javascript
// v2/src/ui/toolbar_hud.js — injects the decorative activation ring behind each toolbar button's icon
const RING_SVG = `<svg class="tb-ring" viewBox="0 0 52 52" aria-hidden="true">
  <circle class="tb-ring-track" cx="26" cy="26" r="23" />
  <circle class="tb-ring-arc" cx="26" cy="26" r="23" />
</svg>`;

export function initToolbarHUD() {
  const buttons = document.querySelectorAll('#bottombar button.tb');
  buttons.forEach((btn) => {
    if (btn.querySelector('.tb-ring')) return; // idempotent, safe to call more than once
    btn.insertAdjacentHTML('afterbegin', RING_SVG);
  });
}
```

- [ ] **Step 3: Wire the import + call into `v2/index.html`**

In the `<script type="module">` block found in Step 1, add an import line alongside the existing
`init*` imports:

```javascript
import { initToolbarHUD } from './src/ui/toolbar_hud.js';
```

And add a call alongside the other `init*()` calls (same block where `initGuide()`, etc. are
invoked):

```javascript
initToolbarHUD();
```

- [ ] **Step 4: Style the ring — replace the `.tb` rule block**

In `v2/styles/main.css`, replace the existing block (currently lines 377–393, from `.tb{` through
`.tb.toggle.on::after{display:none;}`) with:

```css
.tb{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  flex:0 0 46px;width:46px;height:46px;border:none;background:none;color:#94a3b8;
  cursor:pointer;border-radius:23px;font-size:17px;transition:all .18s cubic-bezier(0.34, 1.56, 0.64, 1);
  touch-action:manipulation;position:relative;
}
.tb .tb-icon{font-size:19px;transition:transform .2s ease;position:relative;z-index:1;}
.tb .tb-label{font-family:'Outfit',sans-serif;font-size:8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;position:relative;z-index:1;}
.tb .tb-ring{position:absolute;inset:-3px;width:calc(100% + 6px);height:calc(100% + 6px);pointer-events:none;transform:rotate(-90deg);}
.tb .tb-ring-track{fill:none;stroke:var(--hud-edge);stroke-width:1.5;opacity:.25;}
.tb .tb-ring-arc{fill:none;stroke:var(--hud-accent);stroke-width:2;stroke-linecap:round;
  stroke-dasharray:144.5; /* 2*pi*23 */
  stroke-dashoffset:144.5;
  filter:drop-shadow(0 0 6px var(--hud-accent-glow));
  transition:stroke-dashoffset .35s ease;
}
.tb:hover{background:rgba(255, 255, 255, 0.08);color:#f8fafc;transform:translateY(-2px) scale(1.05);}
.tb:focus-visible, .pov-btn:focus-visible, .tb-avatar-btn:focus-visible, .obj-dock-btn:focus-visible, .bp-btn:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
.tb:hover .tb-icon{transform:scale(1.15);}
.tb:hover .tb-ring-track{opacity:.5;}
.tb.active{color:#fff;background:var(--hud-glass-bg-1);border:1px solid var(--hud-edge-hover);box-shadow:0 0 20px var(--hud-glow-hover);}
.tb.active .tb-ring-arc{stroke-dashoffset:0;}
.tb.danger.active{color:#fff;background:linear-gradient(135deg, rgba(244,63,94,0.4) 0%, rgba(225,29,72,0.4) 100%);border:1px solid rgba(244,63,94,0.6);box-shadow:0 0 20px rgba(244,63,94,0.4);}
.tb.danger.active .tb-ring-arc{stroke:#f43f5e;filter:drop-shadow(0 0 6px rgba(244,63,94,.5));}
.tb.toggle.on{color:#fff;background:linear-gradient(135deg, rgba(168,85,247,0.4) 0%, rgba(139,92,246,0.4) 100%);border:1px solid rgba(168,85,247,0.6);box-shadow:0 0 20px rgba(168,85,247,0.4);}
.tb.toggle.on .tb-ring-arc{stroke:#a855f7;filter:drop-shadow(0 0 6px rgba(168,85,247,.5));}

@media (prefers-reduced-motion: reduce) {
  .tb .tb-ring-arc{transition:none;}
}
```

(This preserves every existing `.tb`/`.tb.active`/`.tb.danger.active`/`.tb.toggle.on` selector and
behavior — it only adds the ring layer and swaps the flat cyan glow for the token-driven amber
accent on the plain `.active` state, per the spec's "single accent reserved for active" rule. The
danger/toggle color-coded states are intentionally left red/purple, matching existing semantic
meaning — those aren't "one hero-color per tool," they're existing status colors already
distinguishable from the new neutral/accent system.)

- [ ] **Step 5: Verify live**

Start `node server.cjs`, open `http://127.0.0.1:3000/v2/` in the Browser tool.
- Screenshot the toolbar at rest — confirm every button shows a faint dim ring track (per "pull not
  push," this should read as subtle, not attention-grabbing).
- Click a different tool button (e.g. "Text") — screenshot again, confirm its ring now shows a full
  bright amber arc with glow, and the previously-active "Nav" button's ring returns to dim.
- Hover (without clicking) a third button — screenshot, confirm the ring track brightens slightly
  (opacity .25 → .5) but does **not** show the amber arc (that's reserved for `.active`, per the
  "hover intensifies, active pays off" principle).
- `read_console_messages` with `onlyErrors: true` — expected: no errors.
- Toggle OS/browser `prefers-reduced-motion` (or use `resize_window` with the reduced-motion
  emulation the Browser tool exposes, if available; otherwise inspect computed styles via
  `javascript_tool` to confirm `transition: none` applies under that media query) and confirm the
  ring still shows the correct dim/bright state without animating.

- [ ] **Step 6: Commit**

```bash
git add v2/src/ui/toolbar_hud.js v2/index.html v2/styles/main.css
git commit -m "feat(hud): add radial activation ring to toolbar buttons"
```

---

## Task 3: Dense telemetry panel (desktop HUD)

**Files:**
- Modify: `v2/src/ui/hud.js:19-29` (the `updateHUD` function's desktop-panel branch)
- Modify: `v2/styles/main.css:361-362` (the `.tb-hud` rule)

**Interfaces:**
- Consumes: `--hud-*` tokens from Task 1.
- Produces: no new exports — `updateHUD(currentMode)`'s signature and mobile (`#hud`) behavior are
  unchanged; only the desktop (`#hud-desktop` / `.tb-hud`) branch's DOM content changes from plain
  text to structured markup. Any other file calling `updateHUD()` (there are none outside
  `v2/src/ui/hud.js` itself per the earlier grep) needs no changes.

- [ ] **Step 1: Replace the desktop-panel branch in `updateHUD()`**

In `v2/src/ui/hud.js`, replace:

```javascript
  if (hudModeEl) {
    hudModeEl.textContent = hudFullText;
  }
```

with:

```javascript
  if (hudModeEl) {
    hudModeEl.innerHTML = `
      <span class="hud-stat"><span class="hud-stat-label">MODE</span><span class="hud-stat-value">${currentMode.toUpperCase()}</span></span>
      <span class="hud-stat"><span class="hud-stat-label">OBJ</span><span class="hud-stat-value">${objects.length}</span></span>
      <span class="hud-stat"><span class="hud-stat-label">LINK</span><span class="hud-stat-value">${links.length}</span></span>
      <span class="hud-stat"><span class="hud-stat-label">POV</span><span class="hud-stat-value">${povMode.toUpperCase()}</span></span>
    `;
  }
```

(`hudFullText` becomes unused by this branch — leave the variable declaration in place, since
`hudShortText`, used two lines below for the mobile `#hud` element, is derived independently and
`hudFullText` is harmless dead code removal that's out of scope for this visual task. If a linter
flags it, that's a one-line removal, not a functional change — not required for this task.)

- [ ] **Step 2: Restyle `.tb-hud` as a bracket-framed panel**

In `v2/styles/main.css`, replace:

```css
.tb-hud{padding:0 16px;font-size:11px;font-family:'JetBrains Mono',monospace;color:#38bdf8;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:1px solid rgba(255,255,255,0.08);display:none;}
@media(min-width:680px){.tb-hud{display:block;}}
```

with:

```css
.tb-hud{
  position:relative;display:none;align-items:center;gap:14px;
  padding:6px 18px;margin:0 4px;
  font-family:'JetBrains Mono',monospace;
  background:linear-gradient(160deg, var(--hud-glass-bg-1), var(--hud-glass-bg-2));
  border:1px solid var(--hud-edge);
  box-shadow:0 0 16px var(--hud-glow);
  backdrop-filter:blur(4px);
  white-space:nowrap;
}
.tb-hud::before, .tb-hud::after{content:'';position:absolute;width:10px;height:10px;border-color:var(--hud-edge-hover);}
.tb-hud::before{top:-1px;left:-1px;border-top:2px solid;border-left:2px solid;}
.tb-hud::after{bottom:-1px;right:-1px;border-bottom:2px solid;border-right:2px solid;}
.hud-stat{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;}
.hud-stat-label{font-size:8px;letter-spacing:1.5px;color:var(--hud-text-label);}
.hud-stat-value{font-size:12px;font-weight:700;color:var(--hud-text-value);}
@media(min-width:680px){.tb-hud{display:flex;}}
```

- [ ] **Step 3: Verify live**

Start `node server.cjs`, open at a viewport ≥680px wide (desktop breakpoint — use
`resize_window` with `preset: "desktop"` if the Browser tool's default viewport is narrower).
- Screenshot the top bar — confirm the telemetry panel now shows 4 labeled stat columns (MODE / OBJ
  / LINK / POV) with hairline corner brackets, not a single plain text string.
- Place an object (any tool) and confirm the OBJ count updates live in the new panel.
- Switch POV mode (FPS/TPS/Orbit) and confirm the POV stat updates live.
- `read_console_messages` with `onlyErrors: true` — expected: no errors (confirms the `innerHTML`
  swap didn't break anything reading `hudModeEl.textContent` elsewhere — re-run the grep from Task
  2 Step 1's search style if any error mentions `hud`).

- [ ] **Step 4: Commit**

```bash
git add v2/src/ui/hud.js v2/styles/main.css
git commit -m "feat(hud): restyle desktop telemetry chip as dense bracket-framed panel"
```

---

## Task 4: POV switch + D-pad bracket framing

**Files:**
- Modify: `v2/styles/main.css:46-78` (`.tb-pov-switch`, `.pov-btn` rules)
- Modify: `v2/styles/main.css` (locate and modify `#spatial-dpad`, `.dpad-btn` rules — search first)

**Interfaces:**
- Consumes: `--hud-*` tokens from Task 1. No JS changes, no new exports — pure CSS restyle of
  existing, already-functional elements.

- [ ] **Step 1: Locate the D-pad CSS block**

```bash
cd C:\Users\navka\navakanth001\whiteboard-4d
grep -n "#spatial-dpad\|\.dpad-btn\|\.dpad-cross" v2/styles/main.css
```

Note the line ranges returned — this task edits those blocks in place (exact line numbers aren't
hardcoded here since this repo's file has shifted line numbers after Tasks 1-3's insertions; use
the grep output as the source of truth for where to edit).

- [ ] **Step 2: Restyle `.tb-pov-switch` / `.pov-btn`**

Replace the existing block:

```css
.tb-pov-switch {
  position: fixed;
  top: 8px;
  left: 230px;
  z-index: 350;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(2, 6, 23, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 3px 5px;
  backdrop-filter: blur(20px);
}
.pov-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #94a3b8;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.pov-btn span.material-symbols-outlined { font-size: 16px; }
.pov-btn:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.08); }
.pov-btn.active {
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  color: #020617;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.4);
}
```

with:

```css
.tb-pov-switch {
  position: fixed;
  top: 8px;
  left: 230px;
  z-index: 350;
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(160deg, var(--hud-glass-bg-1), var(--hud-glass-bg-2));
  border: 1px solid var(--hud-edge);
  box-shadow: 0 0 14px var(--hud-glow);
  padding: 3px 5px;
  backdrop-filter: blur(20px);
}
.pov-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #94a3b8;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.pov-btn span.material-symbols-outlined { font-size: 16px; }
.pov-btn:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.08); }
.pov-btn.active {
  background: var(--hud-glass-bg-1);
  color: var(--hud-accent);
  border: 1px solid var(--hud-accent);
  box-shadow: 0 0 14px var(--hud-accent-glow);
}
```

(Border-radius removed on the pill shape in favor of the sharper HUD-panel look already established
in Tasks 2/3 — square-cornered buttons inside a container that itself has no radius either now.
This is a deliberate visual-language consistency choice: every restyled element in this pass uses
hairline/sharp framing, not the old fully-rounded pill style.)

- [ ] **Step 3: Restyle the D-pad using the located block from Step 1**

Apply the same token substitution pattern used in Step 2 to whatever `#spatial-dpad` /
`.dpad-btn` / `.dpad-cross` rules Step 1 located: replace hardcoded `rgba(2, 6, 23, ...)` /
`rgba(255,255,255,...)` background/border colors with `var(--hud-glass-bg-1)` /
`var(--hud-glass-bg-2)` / `var(--hud-edge)`, and any cyan accent color (`#38bdf8` or
`rgba(56,189,248,...)`) on the active/pressed D-pad button state with `var(--hud-accent)` /
`var(--hud-accent-glow)` — matching the exact substitution pattern from Step 2. Since the located
block's exact current content isn't reproduced here (line numbers shift), read the actual current
rule via the Read tool at the line numbers Step 1's grep returned before editing, to edit the real
current content rather than guessing.

- [ ] **Step 4: Verify live**

Screenshot the POV switch (FPS/TPS/Orbit buttons) at rest and with one active — confirm the active
state now shows amber accent instead of cyan-to-indigo gradient, consistent with Task 2/3's palette.
Screenshot the D-pad similarly. `read_console_messages` with `onlyErrors: true` — expected: no
errors (this is a pure-CSS task, an error here would indicate a typo breaking the stylesheet parse,
not a logic bug).

- [ ] **Step 5: Commit**

```bash
git add v2/styles/main.css
git commit -m "feat(hud): restyle POV switch and D-pad with HUD accent palette"
```

---

## Task 5: 4D scrubber bar visual pass (a11y-preserving)

**Files:**
- Modify: `v2/styles/main.css` (locate `#timeline-4d` block — search first, per Task 4's pattern)

**Interfaces:**
- Consumes: `--hud-*` tokens from Task 1. **Must not modify** any HTML attribute on `#tl-scrubber`,
  `#tl-play-btn`, `#tl-count-lbl`, or `#btn-4d` (all carry PR #8 accessibility attributes) — this
  task is CSS-only, zero HTML changes.

- [ ] **Step 1: Locate the current `#timeline-4d` CSS**

```bash
cd C:\Users\navka\navakanth001\whiteboard-4d
grep -n "#timeline-4d" v2/styles/main.css v2/index.html
```

Note: per earlier investigation in this session (the PR #8 accessibility fix), `#timeline-4d`'s
styling is currently **inline** in `v2/index.html` (`style="..."` attribute on the div), not in
`main.css`. Read the actual current inline style at the line grep returns before editing.

- [ ] **Step 2: Move the styling to `main.css` and apply the HUD palette**

Replace the inline `style="..."` attribute on `<div id="timeline-4d" ...>` in `v2/index.html` with
just `id="timeline-4d"` (no `style` attribute), and add the equivalent rule to `v2/styles/main.css`
(append near the other HUD rules from Task 3):

```css
#timeline-4d{
  display:none;position:fixed;bottom:76px;left:50%;transform:translateX(-50%);z-index:9000;
  background:linear-gradient(160deg, var(--hud-glass-bg-1), var(--hud-glass-bg-2));
  backdrop-filter:blur(16px);
  border:1px solid var(--hud-edge);
  border-radius:4px;
  padding:8px 16px;
  align-items:center;gap:12px;
  box-shadow:0 8px 32px rgba(0,0,0,0.6), 0 0 16px var(--hud-glow);
  color:#fff;width:min(90vw,640px);
}
#timeline-4d.show{display:flex;}
```

(Preserve whatever the existing show/hide toggle mechanism is — check `v2/src/temporal/history4d.js`
for whether it toggles `display` directly via `style.display` or via a `.show` class; if it's
`style.display` directly per the earlier PR #8 session's finding of
`container.style.display = isShowing ? 'flex' : 'none'` in `init4DTimelineUI()`, then keep
`display:none` as the base rule without a separate `.show` variant, matching that existing JS
toggle exactly rather than introducing a class the JS doesn't set.)

- [ ] **Step 3: Verify live — explicit PR #8 regression check**

This is the highest-risk task in this plan for accessibility regression (touches the same element
PR #8 fixed). Verify all of the following explicitly, not just "no console errors":
- `javascript_tool`: `document.getElementById('tl-scrubber').getAttribute('aria-label')` →
  expected: `"4D timeline position"` (unchanged from PR #8).
- `javascript_tool`: `document.getElementById('tl-play-btn').getAttribute('aria-label')` →
  expected: `"Play or pause 4D timeline replay"` (unchanged).
- `javascript_tool`: `document.getElementById('tl-count-lbl').getAttribute('role')` → expected:
  `"status"` (unchanged).
- Click `#btn-4d`, confirm the panel still shows/hides correctly (the toggle mechanism from Step 2
  wasn't broken) and `aria-pressed` still flips (re-run the exact check from the PR #8 session:
  `document.getElementById('btn-4d').getAttribute('aria-pressed')` before/after click).
- Screenshot the panel open — confirm it now shows the HUD glass/glow treatment instead of the old
  flat dark panel.
- `read_console_messages` with `onlyErrors: true` — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add v2/index.html v2/styles/main.css
git commit -m "feat(hud): restyle 4D scrubber bar with HUD glass palette, preserve PR #8 a11y attrs"
```

---

## Task 6: Final regression pass + PR

**Files:** None (verification-only task).

- [ ] **Step 1: Full "pull not push" screenshot check**

Fresh page load, no interaction yet. Take one full-viewport screenshot. Confirm: no single panel
looks visually dominant or "loud" — the toolbar ring tracks are dim, the telemetry panel glow is
subtle, nothing is mid-animation or flashing. This is the spec's core acceptance criterion from §1.

- [ ] **Step 2: Full interaction sweep**

In one continuous session: place at least 3 different object types (exercises Task 3's live OBJ
count), switch POV mode at least once (exercises Task 4), open and close the 4D panel (exercises
Task 5), hover and then click at least 3 different toolbar buttons in sequence (exercises Task 2's
ring transitions — confirm only one ring is ever in the "active" bright state at a time). Screenshot
at 2-3 points during this sequence.

- [ ] **Step 3: Console + regression re-check**

`read_console_messages` with `onlyErrors: true` after the full sweep — expected: no errors.
Re-run every PR #8 attribute check from Task 5 Step 3 one final time now that all 5 tasks are
combined (confirms no later task's CSS accidentally affected an earlier task's a11y surface).

- [ ] **Step 4: Push and open PR**

```bash
cd C:\Users\navka\navakanth001\whiteboard-4d
git push -u origin design/holographic-toolbar
gh pr create --base fix/qa-accessibility-labels --head design/holographic-toolbar \
  --title "feat(hud): Avatar-RDA-HUD toolbar redesign (radial dial, dense telemetry panels)" \
  --body "Implements the DOM/CSS track (§2/§3) of docs/superpowers/specs/2026-08-20-holographic-toolbar-redesign-design.md. Radial activation ring on toolbar buttons, dense bracket-framed telemetry panel, HUD accent palette on POV switch/D-pad/4D scrubber. PR #8 accessibility attributes explicitly re-verified unchanged (see Task 5/6 of the implementation plan). Avatar sourcing and in-scene WebGL atmosphere tracks are separate follow-up plans, not in this PR."
```

(Base is `fix/qa-accessibility-labels`, matching this branch's actual parent per the repo's current
branch state — not `master`, which is stale per this session's earlier findings.)

- [ ] **Step 5: Update the KB**

Add a dated entry to `wiki/log.md` and update the "v2 — Current State" section of
`wiki/whiteboard-4d_gbrain.md` per the repo's standing KB-sync convention (every significant work
item gets logged) — summarize what shipped, link the PR, and note that avatar/atmosphere tracks
remain as separate follow-up work.
