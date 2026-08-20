## 2026-07-18 - Caching static graph link geometries in render loop
**Learning:** In Three.js render loops, calling `refreshLinks()` every frame was re-instantiating and disposing `TubeGeometry` buffers for every link in the graph even when connected nodes were stationary.
**Action:** Cache last known node center positions (`lastPa`, `lastPb`) and check `distanceToSquared` before regenerating `TubeGeometry` and `QuadraticBezierCurve3`.
