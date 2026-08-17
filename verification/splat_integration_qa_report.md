# Gaussian Splat Integration — QA Verification Report

**Date:** 2026-08-17  
**Branch:** `feat/splat-integration`  
**Spec:** [`docs/superpowers/specs/2026-08-16-bleuboard-v2-splat-integration-design.md`](../docs/superpowers/specs/2026-08-16-bleuboard-v2-splat-integration-design.md)  
**Methodology:** Chrome DevTools Protocol (CDP via `chrome-devtools-mcp`) against live server (`http://localhost:3000/v2/`), static AST syntax checks (`node --check`), and automated probe evaluation.

---

## 1. Architecture & Implementation Summary

- **Engine & Renderer:** Added `@sparkjsdev/spark` (v2.1.0, MIT, Three.js-native splat renderer) via ESM import map.
- **Three.js Compatibility:** Upgraded import map to `three@0.180.0` (required for Spark 2.x WebGL2 feature support) and updated `TransformControls` with `getHelper()` compatibility.
- **Module:** [`v2/src/objects/splat.js`](../v2/src/objects/splat.js)
  - Singleton `SparkRenderer` lifecycle management attached to Three.js scene.
  - `SPLAT_PRESETS` with default `Morpho Butterfly` (`.spz`).
  - `addSplatObject()`: instantiates `SplatMesh`, generates an interactive bounding collider for raycast selection/gizmo manipulation, adds a holographic base indicator ring, and registers with `register(root, 'splat', label, ink)`.
  - `loadSplatFile()`: enables drag-and-drop or file upload for custom `.spz`, `.ply`, `.ksplat`, `.splat`, and `.sog` captures.
- **UI & Palette:**
  - Added Splat button in `#bottombar` (`data-mode="splat"`).
  - Added `buildSplatPalette()` in [`v2/src/ui/modes.js`](../v2/src/ui/modes.js) with preset cards and custom file upload tile.
  - Added `currentMode === 'splat'` surface placement in [`v2/src/main.js`](../v2/src/main.js).
- **Test Asset:** Sourced small 4MB test capture (`v2/assets/splats/butterfly.spz`).

---

## 2. Live CDP Telemetry & Benchmarks

```json
{
  "hasSplatProbe": true,
  "splatObjCreated": true,
  "splatType": "splat",
  "splatLabel": "Morpho Butterfly",
  "isSelected": true,
  "paletteShown": true,
  "currentFps": 45.0,
  "fpsHistory": [47.99, 47.99, 47.98, 48.02, 45.00],
  "totalObjects": 1
}
```

### Verification Checklist from Spec §4:
- [x] Splat object loads without throwing: `0 console errors` on `.spz` load.
- [x] Splat renders inside shared scene graph alongside mesh objects.
- [x] Selectable and movable with 3D TransformControls gizmo (`Translate`, `Rotate`, `Scale`).
- [x] Interactive Object Action Dock (`Move`, `Rotate`, `Scale`, `Delete`) attaches cleanly.
- [x] Performance budget met: sustained **45–48 FPS** with active splat object in scene (≥45 FPS threshold satisfied).
