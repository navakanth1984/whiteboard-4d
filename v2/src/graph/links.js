import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { objects, links } from '../core/history.js';

export let flowMotionEnabled = true;

export function setFlowMotion(on) {
  flowMotionEnabled = on;
}

export function center(o) {
  if (!o || !o.root) return new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(o.root);
  return box.getCenter(new THREE.Vector3());
}

function makeArrowHead(col) {
  const { scene } = getSceneState();
  const geo = new THREE.ConeGeometry(0.35, 0.75, 16);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 1.2,
    roughness: 0.1,
    metalness: 0.5
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (scene) scene.add(mesh);
  return mesh;
}

function makeLinkParticle(col, scale = 1.0) {
  const { scene } = getSceneState();
  const geo = new THREE.SphereGeometry(0.18 * scale, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 1.5,
    roughness: 0.1,
    transparent: true,
    opacity: 0.95
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (scene) scene.add(mesh);
  return mesh;
}

export function createLink(a, b, ink = '#38bdf8') {
  const { scene } = getSceneState();
  const pa = center(a);
  const pb = center(b);
  const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, 2.2, 0));
  const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);

  const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.14, 10, false);
  const lineCol = new THREE.Color(ink);
  const mat = new THREE.MeshStandardMaterial({
    color: lineCol,
    emissive: lineCol,
    emissiveIntensity: 1.1,
    roughness: 0.15,
    metalness: 0.6,
    transparent: true,
    opacity: 0.92
  });
  const lineMesh = new THREE.Mesh(tubeGeo, mat);
  if (scene) scene.add(lineMesh);

  const arrowHead = makeArrowHead(lineCol);
  const tangent = curve.getTangent(0.95);
  const targetPt = curve.getPoint(0.95);
  arrowHead.position.copy(targetPt);
  arrowHead.lookAt(targetPt.clone().add(tangent));

  const particles = [
    makeLinkParticle(lineCol, 1.4),
    makeLinkParticle(lineCol, 1.2),
    makeLinkParticle(lineCol, 1.0),
    makeLinkParticle(lineCol, 0.8),
    makeLinkParticle(lineCol, 0.6)
  ];

  const link = {
    line: lineMesh,
    geo: tubeGeo,
    curve,
    a: a.id,
    b: b.id,
    flowT: 0,
    flowDir: 1,
    particles,
    arrowHead,
    lineCol,
    lastPa: pa.clone(),
    lastPb: pb.clone()
  };

  links.push(link);
  return link;
}

// Performance optimization: Bolt ⚡
// Skip expensive TubeGeometry allocation/disposal unless endpoints have actually moved.
export function refreshLinks() {
  links.forEach(lk => {
    const a = objects.find(o => o.id === lk.a);
    const b = objects.find(o => o.id === lk.b);
    if (!a || !b) return;

    const pa = center(a);
    const pb = center(b);

    // If endpoints haven't moved significantly and geometry/curve exists, skip TubeGeometry rebuild
    if (lk.curve && lk.line?.geometry && lk.lastPa && lk.lastPb &&
        lk.lastPa.distanceToSquared(pa) < 0.0001 &&
        lk.lastPb.distanceToSquared(pb) < 0.0001) {
      return;
    }

    if (!lk.lastPa) lk.lastPa = new THREE.Vector3();
    if (!lk.lastPb) lk.lastPb = new THREE.Vector3();
    lk.lastPa.copy(pa);
    lk.lastPb.copy(pb);

    const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, 2.2, 0));
    lk.curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);

    if (lk.line && lk.line.geometry) {
      lk.line.geometry.dispose();
      lk.line.geometry = new THREE.TubeGeometry(lk.curve, 36, 0.14, 10, false);
    }
    if (lk.arrowHead) {
      const tangent = lk.curve.getTangent(lk.flowDir > 0 ? 0.95 : 0.05);
      const targetPt = lk.curve.getPoint(lk.flowDir > 0 ? 0.95 : 0.05);
      lk.arrowHead.position.copy(targetPt);
      lk.arrowHead.lookAt(targetPt.clone().add(tangent));
    }
  });
}

export function tickLinks(dt) {
  if (!flowMotionEnabled) return;
  links.forEach(lk => {
    lk.flowT = (lk.flowT + dt * 0.55 * lk.flowDir + 1) % 1;
    if (lk.curve && lk.particles) {
      lk.particles.forEach((pt, idx) => {
        const offsetT = (lk.flowT + idx * 0.20) % 1;
        const pos = lk.curve.getPoint(offsetT);
        pt.position.copy(pos);
      });
    }
  });
}
