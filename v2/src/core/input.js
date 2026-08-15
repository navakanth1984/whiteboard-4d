import * as THREE from 'three';
import { canvas, camera, placeTargets } from './scene.js';

export const ray = new THREE.Raycaster();
export const m2 = new THREE.Vector2();

export let currentMouse = { x: 0, y: 0 };
export let ghostMesh = null;

export function setGhost(mesh) {
  ghostMesh = mesh;
}

export function setMouse(cx, cy) {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  m2.x = ((cx - r.left) / r.width) * 2 - 1;
  m2.y = -((cy - r.top) / r.height) * 2 + 1;
  currentMouse.x = cx;
  currentMouse.y = cy;
}

export function getHit(cx, cy) {
  setMouse(cx, cy);
  if (!camera) return null;
  ray.setFromCamera(m2, camera);
  const targets = ghostMesh ? placeTargets.filter(o => o !== ghostMesh) : placeTargets;
  return ray.intersectObjects(targets, true)[0] || null;
}

export function hitToPos(hit) {
  if (!hit) return null;
  const n = hit.face
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    : new THREE.Vector3(0, 1, 0);
  const raw = hit.point.clone().addScaledVector(n, 0.5);
  return {
    x: Math.round(raw.x),
    y: Math.round(raw.y),
    z: Math.round(raw.z)
  };
}

// Free (un-snapped) point just off the surface — for media/text/strokes
export function hitToFree(hit) {
  if (!hit) return null;
  const n = hit.face
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    : new THREE.Vector3(0, 0, 1);
  return hit.point.clone().addScaledVector(n, 0.05);
}

// Surface helper: world point + normal under the pointer
export function hitToSurface(cx, cy) {
  const h = getHit(cx, cy);
  if (!h) return null;
  const n = h.face
    ? h.face.normal.clone().transformDirection(h.object.matrixWorld)
    : new THREE.Vector3(0, 1, 0);
  return { point: h.point.clone(), normal: n };
}

export function rayPlane(plane, cx, cy) {
  setMouse(cx, cy);
  if (!camera) return null;
  ray.setFromCamera(m2, camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, p)) return null;
  // Clamp X and Z to workspace boundaries to prevent horizontal camera explosions
  p.x = Math.max(-50, Math.min(50, p.x));
  p.z = Math.max(-50, Math.min(50, p.z));
  return p;
}

// Global pointer event listeners connector
export function setupPointerEvents(handlers = {}) {
  const cvs = canvas || document.getElementById('c');
  if (!cvs) return;

  cvs.style.touchAction = 'none';

  cvs.addEventListener('pointerdown', (e) => {
    if (handlers.onDown) handlers.onDown(e.clientX, e.clientY, e);
  });

  cvs.addEventListener('pointermove', (e) => {
    if (handlers.onMove) handlers.onMove(e.clientX, e.clientY, e);
  });

  cvs.addEventListener('pointerup', (e) => {
    if (handlers.onUp) handlers.onUp(e.clientX, e.clientY, e);
  });
}
