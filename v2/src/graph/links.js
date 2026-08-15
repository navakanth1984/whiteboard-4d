import * as THREE from 'three';
import { scene } from '../core/scene.js';
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
  const geo = new THREE.ConeGeometry(0.22, 0.55, 16);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 0.8,
    roughness: 0.2
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

function makeLinkParticle(col, scale = 1.0) {
  const geo = new THREE.SphereGeometry(0.14 * scale, 12, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: col,
    transparent: true,
    opacity: 0.95
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

export function createLink(a, b, ink = '#38bdf8') {
  const pa = center(a);
  const pb = center(b);
  const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, 2.2, 0));
  const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);

  const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.08, 8, false);
  const lineCol = new THREE.Color(ink);
  const mat = new THREE.MeshStandardMaterial({
    color: lineCol,
    emissive: lineCol,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.4,
    transparent: true,
    opacity: 0.85
  });
  const lineMesh = new THREE.Mesh(tubeGeo, mat);
  scene.add(lineMesh);

  const arrowHead = makeArrowHead(lineCol);
  const tangent = curve.getTangent(0.95);
  const targetPt = curve.getPoint(0.95);
  arrowHead.position.copy(targetPt);
  arrowHead.lookAt(targetPt.clone().add(tangent));

  const particles = [
    makeLinkParticle(lineCol, 1.4),
    makeLinkParticle(lineCol, 1.0),
    makeLinkParticle(lineCol, 0.7)
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
    lineCol
  };

  links.push(link);
  return link;
}

export function refreshLinks() {
  links.forEach(lk => {
    const a = objects.find(o => o.id === lk.a);
    const b = objects.find(o => o.id === lk.b);
    if (!a || !b) return;

    const pa = center(a);
    const pb = center(b);
    const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, 2.2, 0));
    lk.curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);

    if (lk.line && lk.line.geometry) {
      lk.line.geometry.dispose();
      lk.line.geometry = new THREE.TubeGeometry(lk.curve, 32, 0.08, 8, false);
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
    lk.flowT = (lk.flowT + dt * 0.45 * lk.flowDir + 1) % 1;
    if (lk.curve && lk.particles) {
      lk.particles.forEach((pt, idx) => {
        const offsetT = (lk.flowT + idx * 0.25) % 1;
        const pos = lk.curve.getPoint(offsetT);
        pt.position.copy(pos);
      });
    }
  });
}
