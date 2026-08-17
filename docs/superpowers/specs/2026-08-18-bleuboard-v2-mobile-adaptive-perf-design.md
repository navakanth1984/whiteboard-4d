# BleuBoard v2 — Mobile Adaptive Performance Architecture

**Date:** 2026-08-18
**Repo:** `C:\Users\navka\navakanth001\whiteboard-4d`
**Depends on:** PR #3 (Blender/AccuRig pipeline) merged. Same one-module-per-iteration rule as
every prior spec in this queue.

**Origin of this spec, stated plainly:** a chat response (not a Claude Code session, not tested
against this repo) described six features — 4D Temporal Time Scrubber, Autonomous AI Copilot,
Rapier.js physics, "1M-splat Holodecks," multi-pass volumetric glass, and MediaPipe webcam hand
tracking — with specific FPS numbers and device names, framed as a completed, benchmarked system.
**Verified against the actual codebase this session: none of the six exist.** `v2/src/objects/
splat.js` is real but is 101 lines with one 4MB test asset, not a tiered 1M-splat system. The only
`getUserMedia` call in the repo is for the existing presentation-recording feature, not gesture
tracking. No Rapier import, no time-scrubber code, no AI-copilot code exist anywhere in `v2/src/`.

This spec covers **only the pieces concrete enough to design against**: adaptive device-tiered
rendering budgets (extending the real `splat.js` and the DPR clamp already in `core/scene.js`) and
genuine multi-touch gesture handling (there is currently none — only a `touchAction: none` CSS
reset relying on `OrbitControls`' default touch support). The other four items are listed in §5
with what each would need before it could be specced honestly — not designed here, because
designing against an undefined feature name produces a spec that looks rigorous and isn't.

## 1. Why

Real gap, not a made-up one: nothing in this codebase currently scales rendering cost down for
phone-class hardware. `renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))` in
`core/scene.js:50` is the only adaptive-ish line in the entire mobile story — a flat cap, not a
device-tier decision. If a splat asset larger than `butterfly.spz`'s 4MB gets added later (per the
already-merged splat spec's own asset-size risk note), there's currently no mechanism stopping it
from being loaded identically on a $300 Android phone and a desktop.

## 2. Tool/technique selection

No new external library needed for §3 (device tiering) or §4 (touch gestures) — both are
first-party code extending what's already in `v2/src/core/` and `v2/src/objects/splat.js`. This is
deliberately not a new dependency; the risk this spec addresses is scaling cost down, not adding
capability up.

## 3. Adaptive device-tier rendering budget

### 3a. Device-tier detection

New module `v2/src/core/device_tier.js` — same shape as the (parked, Babylon-track) precedent that
already proved this pattern out once: user-agent + touch-point heuristic, returns `'mobile'` or
`'desktop'`.

```javascript
export function detectDeviceTier() {
  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  return (isMobileUA || hasTouch) ? 'mobile' : 'desktop';
}
```

**Known, accepted tradeoff** (same as before): touch-capable laptops classify as `'mobile'`. Stated
explicitly so it isn't rediscovered as a surprise later.

### 3b. Pixel ratio, tiered not flat

`core/scene.js:50` changes from a flat `Math.min(dpr, 2)` cap to a tier-aware one:
- Desktop tier: `Math.min(window.devicePixelRatio || 1, 2)` (unchanged)
- Mobile tier: `Math.min(window.devicePixelRatio || 1, 1.5)`

### 3c. Splat budget, gated at load time — not a size guess

`objects/splat.js` gains a tier check before loading any splat asset. Concretely: refuse (or
downgrade to a lower-res variant, if one is provided) any asset whose file size exceeds a
per-tier ceiling, checked via a `HEAD` request or the already-fetched blob size before it's handed
to Spark's loader — not an estimated splat count, which nothing in this codebase currently measures.

| Tier | Max asset size before load |
|---|---|
| Desktop | No cap from this spec (existing behavior) |
| Mobile | 8MB (2x `butterfly.spz`'s current size — a real, testable ceiling, not a guess) |

**This number is a starting point, not a measured optimum.** The plan's own `RENDER_CHECK` gate
(FPS + console errors) is what validates or invalidates it — see §3d.

### 3d. RENDER_CHECK addition

| Check | Threshold | How |
|---|---|---|
| Mobile tier does not fetch a splat asset over its size ceiling | confirmed via network log, not code inspection alone | `read_network_requests`, same method used to verify the original splat spec's mobile gating |
| FPS holds on mobile with a splat active | ≥45fps (existing bar), on an *actual* phone-class device or the closest available emulation — not asserted from a spec | manual check, same limitation already logged twice this session (Browser-pane `visibilityState: hidden` blocks automated FPS reads) |

## 4. Multi-touch gesture layer

### 4a. What exists today

`core/input.js:85` sets `touchAction: none` on the canvas, which hands all touch interpretation to
`OrbitControls`' built-in (one-finger orbit, two-finger pinch/pan) — functional, not custom, not
tuned for this app's specific object-manipulation needs (moving/rotating a selected board object
via touch, distinct from camera orbit).

### 4b. What this spec adds

A `v2/src/core/touch_gestures.js` module that distinguishes two touch contexts, reusing the
existing `isGizmoHit` raycast-guard pattern from `nav/transform.js` (already proven, not
reinvented):
- **No object selected**: touch passes through to `OrbitControls` unchanged (orbit/pinch-zoom/pan)
- **Object selected**: one-finger drag moves the object (mirroring the existing gizmo-drag desktop
  behavior), two-finger twist rotates it — gated by the same `isGizmoHit` check so it doesn't
  fight the existing Object Action Dock

This is additive to the existing selection system, not a parallel one.

## 5. Explicitly NOT specced here — and what each would actually need

| Feature | Why it's not designed in this spec |
|---|---|
| **4D Temporal Time Scrubber** | "4D" and "temporal" aren't defined against this app's actual data model. Does it mean undo-history playback (real, `core/history.js` already exists) exposed as a UI scrubber? Or something else? Needs one clarifying question answered before a spec is possible. |
| **Autonomous AI Copilot** | No defined scope: what actions can it take, what triggers it, what model/API does it call. This is a brainstorm-from-zero, not an extension of existing code. |
| **Rapier.js physics** | No stated use case yet — what in this app currently needs physics that raycasting/manual transforms don't already handle? Needs a concrete problem statement first. |
| **MediaPipe hand tracking** | Real feature, zero existing code. Needs its own spec: camera permission UX, the dual-rate interpolation pipeline (vision model async, render loop smooth) described in the original pitch is a reasonable *pattern*, but nothing here has been built or tested against this app's actual scene graph. |
| **"1M-splat Holodecks"** | Not a real target until an actual large splat asset is sourced and tested — §3c's 8MB ceiling is deliberately conservative and asset-driven, not aspirational. |

Any of these becomes speccable the moment it has a concrete problem statement — that's a
brainstorming-skill conversation, not something to invent scope for here.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Mobile splat size ceiling (8MB) is wrong in either direction | It's stated as a starting point in §3c, validated by §3d's `RENDER_CHECK`, not treated as final |
| Touch gesture layer conflicts with existing gizmo/dock interaction | Explicitly reuses `isGizmoHit`, the same guard that already prevents this class of conflict on desktop |
| This spec gets read as covering the full original pitch (time scrubber, AI copilot, physics, hand tracking) | §5 exists specifically to prevent that — each is named and explicitly deferred, not silently dropped |

## 7. Definition of done

> Device-tier detection is real and tested (mobile vs. desktop, same UA+touch heuristic already
> proven once). Pixel ratio and splat asset-size ceiling are tier-aware, verified via network log
> that mobile genuinely skips over-ceiling assets — not just claims to. A selected object can be
> moved and rotated via touch without fighting the existing gizmo/dock system. None of §5's five
> items are touched by this PR.
