# Blender Asset-Prep Pipeline Guide (General-Purpose 3D Optimization)

**Version:** 1.0.0  
**Target:** Web 3D / Three.js Realtime Assets (BleuBoard v2)  
**Tools:** Blender 4.x / 3.6+ (GPL, Free & Open Source)

---

## Overview

This pipeline establishes the canonical, repeatable workflow for converting raw, unoptimized, or high-poly 3D models (scanned meshes, photogrammetry, CAD exports, high-poly digital sculpts) into lightweight, PBR-textured glTF/GLB models optimized for web rendering at 60 FPS.

```
[Raw / High-Poly Mesh] 
       │
       ▼
1. Retopology (Decimate Modifier / Quadriflow)
       │
       ▼
2. UV Unwrapping (Smart UV Project + Seams)
       │
       ▼
3. Texture & Normal Baking (Cycles Bake Engine)
       │
       ▼
4. PBR Material Assembly (Principled BSDF)
       │
       ▼
5. glTF 2.0 Binary (.glb) Export
       │
       ▼
[BleuBoard v2 Models Pipeline (v2/src/objects/models.js)]
```

---

## Step-by-Step Execution

### Step 1: Geometry Retopology (Target Polycount)
- **Goal:** Reduce raw polygons (often 500k–5M tris) to 5k–30k triangles suitable for web performance.
1. Open Blender, select the high-poly mesh.
2. Duplicate the high-poly mesh (`Shift + D`) and rename to `Mesh_LowPoly`. Keep the original as `Mesh_HighPoly`.
3. Add a **Decimate** modifier to `Mesh_LowPoly`:
   - Mode: `Collapse`.
   - Ratio: Adjust until face count is between `5,000` and `25,000` triangles (check Statistics in Viewport Overlays).
4. Apply the modifier (`Ctrl + A`).
5. (Optional) Run `Mesh → Clean Up → Degenerate Dissolve` and `Mesh → Normals → Set From Faces` to ensure clean topology.

### Step 2: UV Unwrapping
- **Goal:** Create non-overlapping UV islands with sufficient margin padding for mipmap filtering.
1. Switch to the `UV Editing` workspace.
2. Select `Mesh_LowPoly` in Edit Mode (`Tab`).
3. Press `U → Smart UV Project`:
   - **Angle Limit:** `66.0°`
   - **Island Margin:** `0.005` (prevents texture bleeding between UV islands during mipmapping).
   - **Area Weight:** `0.0`
4. Confirm UV packing has no overlapping islands.

### Step 3: PBR Texture Baking in Cycles
- **Goal:** Transfer high-poly surface detail and color to the low-poly UV coordinates.
1. Set Render Engine to **Cycles** (Device: `GPU Compute` if available).
2. In the Shader Editor for `Mesh_LowPoly`, create a new material with an `Image Texture` node (unconnected):
   - Click **New Image** → Name: `Asset_Bake_Normal` (Resolution: `2048x2048`, 32-bit Float unchecked).
   - Keep this node active/selected in the shader graph.
3. In Viewport: Select `Mesh_HighPoly` first, then `Shift + Click` `Mesh_LowPoly` (active object).
4. In Render Properties → **Bake**:
   - **Bake Type:** `Normal` (or `Diffuse` / `Ambient Occlusion`).
   - Check **Selected to Active**.
   - **Extrusion:** `0.02 m` (adjust if ray misses surface).
   - **Max Ray Distance:** `0.05 m`.
5. Click **Bake**. Repeat for `Roughness`, `Metallic`, or `Base Color` if source possesses procedural shaders.

### Step 4: PBR Material Setup
1. In `Mesh_LowPoly`'s material:
   - Connect Baked Base Color to `Principled BSDF → Base Color`.
   - Connect Baked Normal Map via a `Normal Map` node (Tangent Space) to `Principled BSDF → Normal`.
   - Connect Baked AO/Roughness as needed.
2. Test lighting in Viewport Shading mode (Material Preview / Rendered).

### Step 5: glTF 2.0 Export Settings
1. Select only `Mesh_LowPoly`.
2. Go to `File → Export → glTF 2.0 (.glb/.gltf)`:
   - **Format:** `glTF Binary (.glb)`
   - **Include:** `Selected Objects`, `Custom Properties`
   - **Transform:** `+Y Up` (Standard Three.js coordinate system)
   - **Geometry:** Check `Apply Modifiers`, `UVs`, `Normals`, `Tangents`
   - **Images:** `Automatic` (JPEG quality 85% or WebP)
   - **Compression:** Optional Draco compression (or keep uncompressed for instant web parsing).
3. Export directly to project asset directory or upload via BleuBoard v2's 3D Model picker.
