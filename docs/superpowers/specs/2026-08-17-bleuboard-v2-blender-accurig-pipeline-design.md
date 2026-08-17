# BleuBoard v2 — Blender Asset-Prep + AccuRig Avatar Pipeline

**Date:** 2026-08-17
**Repo:** `C:\Users\navka\navakanth001\whiteboard-4d` (standalone git repo)
**Depends on:** `2026-08-15-bleuboard-v2-design.md` (modular fork, PR #1) and
`2026-08-16-bleuboard-v2-splat-integration-design.md` (Gaussian splat objects). **This spec's
Phase 0 is: the splat integration spec's own work merged.** Same rule as that spec stated for
itself: one module per iteration, never two concurrent efforts against this codebase.

---

## 1. Why

Two separate, unrelated gaps, addressed by two free tools that happen to pair naturally:

1. **Asset optimization has no defined pipeline.** Any future 3D asset (a splat-adjacent prop, an
   environment piece, a new object type) currently has no documented path from raw/high-poly source
   to something this codebase actually wants to load — low triangle count, baked textures, sane
   UVs. Blender fills this gap generally, not for one specific asset.
2. **The existing in-world avatars can be upgraded, not rebuilt.** `feat/bleuboard-v2` already
   shipped "polished human avatars with natural kinematics" and "all-gender in-world avatars" (see
   PR #1's commit history). AccuRig doesn't replace that work — it's a free, faster path to
   *better-rigged* character skeletons for whatever avatar meshes come next, exporting straight to
   FBX/USD → glTF, which Three.js already consumes for every other object type in this app.

Both tools are genuinely free with no commercial-use restriction (verified this session — see the
licensing note in §2), which matters after Tripo AI's free tier turned out to be CC BY 4.0 / no
commercial use.

## 2. Tools

| Tool | License / cost | Role here |
|---|---|---|
| **Blender** | Free, open source (GPL) | Retopology (Decimate modifier), UV unwrapping (Smart UV Project), baking Colour/AO/Normal maps (Cycles) — general asset-prep step, not tied to one object type |
| **AccuRig** (Reallusion) | Free to download and use; free ActorCore account required only to export | Auto-rigs humanoid character meshes — full-body + finger rigs, exports FBX/USD |

**Explicitly not included here:** Tripo AI (commercial-use gate on the free tier — a separate
decision if/when needed, not bundled into this spec) and Patina (pricing/licensing unconfirmed as
of this session — do not adopt until actually verified against fal.ai's published terms).

## 3. Pipeline

### 3a. Blender asset-prep pipeline (general-purpose, reusable)

```
raw/high-poly source (any origin: hand-modeled, scanned, AI-generated)
  → Blender: Decimate modifier (retopology)
  → Blender: Smart UV Project (UV unwrap)
  → Blender: Cycles bake — Colour, AO, Normal maps onto the low-poly mesh
  → export glTF
  → drops into v2/src/objects/models.js's existing loading path (no new object type needed —
     this is a prep step for assets that already fit the existing 3D-model object system)
```

This does not require a new module — `v2/src/objects/models.js` already handles arbitrary 3D
models. This spec's Blender work is upstream of the app, not a code change to it.

### 3b. AccuRig avatar-rigging upgrade

```
avatar mesh (existing or new humanoid character)
  → AccuRig: auto-rig (full body + fingers)
  → export FBX/USD via free ActorCore account
  → Blender (optional cleanup pass, reusing 3a's toolchain) → export glTF
  → v2/src/nav/character.js (the existing avatar/kinematics module) — wire the new rig in,
     following whatever skeleton/animation binding pattern that module already uses
```

**RENDER_CHECK addition**, same pattern as the splat spec added its own row:

| Check | Threshold | How |
|---|---|---|
| Rigged avatar loads and animates without console error | 0 console errors on load + on entering a movement/flight state | `read_console_messages` during a live nav interaction |
| Bone count/weight sanity | no visibly broken limbs at a joint extreme (test by driving a full range of motion) | `TASTE_GATE` — this is a visual/correctness hybrid check, same category as the splat spec's sorting-correctness row |

Same 3-iteration cap before escalation, same `TASTE_GATE` human approval, same commit discipline as
every other module in this codebase.

## 4. Explicitly out of scope

- Tripo AI or any other paid/commercially-gated AI 3D generation tool — a separate decision, not
  bundled here
- Patina or any other unverified-pricing texture tool
- Building new avatar *characters* from scratch — this spec upgrades the rigging of whatever avatar
  work already exists or is separately planned, it does not design new characters
- Any change to the splat integration spec's scope — these are independent asset pipelines that
  happen to share Blender as a common prep tool, not a merged effort

## 5. Risks

| Risk | Mitigation |
|---|---|
| Re-rigging breaks existing avatar animation bindings in `nav/character.js` | `RENDER_CHECK`'s animation check catches this before `TASTE_GATE`; 3-iteration cap same as everywhere else |
| Blender pipeline becomes a bottleneck for future assets if not documented | This spec's §3a is written to be reusable — reference it for any future asset, don't re-derive per-asset |
| Scope creep into new-character design | §4 states it explicitly |

## 6. Definition of done

> Blender's retopology→UV→bake pipeline is documented and has processed at least one real asset
> through it (proving it's usable, not just described). At least one avatar in the existing
> in-world avatar system is re-rigged via AccuRig, loads and animates with zero console errors,
> and passes `TASTE_GATE` — reached through its own PR into `master`, after the splat integration
> spec's PR has already merged.
