import * as THREE from 'three';
import { getSceneState } from './scene.js';

export const ray = new THREE.Raycaster();
export const m2 = new THREE.Vector2();

export let currentMouse = { x: 0, y: 0 };
export let ghostMesh = null;

export function setGhost(mesh) {
  ghostMesh = mesh;
}

export function setMouse(cx, cy) {
  const { canvas } = getSceneState();
  const cvs = canvas || document.getElementById('c');
  if (!cvs) return;
  const r = cvs.getBoundingClientRect();
  m2.x = ((cx - r.left) / r.width) * 2 - 1;
  m2.y = -((cy - r.top) / r.height) * 2 + 1;
  currentMouse.x = cx;
  currentMouse.y = cy;
}

export function getHit(cx, cy) {
  setMouse(cx, cy);
  const { camera, placeTargets } = getSceneState();
  if (!camera || !placeTargets) return null;
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
  if (h) {
    const n = h.face
      ? h.face.normal.clone().transformDirection(h.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);
    return { point: h.point.clone(), normal: n };
  }

  // Smart Fallback Projection Plane:
  // When clicking into open sky or high viewports without hitting a floor/wall mesh,
  // project the ray onto the floor plane or eye-level vertical workspace plane in front of the camera.
  const { camera } = getSceneState();
  if (!camera) return null;
  setMouse(cx, cy);
  ray.setFromCamera(m2, camera);

  // 1. Try floor plane (Y = 0) within reasonable distance
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const floorHit = new THREE.Vector3();
  if (ray.ray.intersectPlane(floorPlane, floorHit) && floorHit.distanceTo(camera.position) < 80) {
    floorHit.x = Math.max(-50, Math.min(50, floorHit.x));
    floorHit.z = Math.max(-50, Math.min(50, floorHit.z));
    return { point: floorHit, normal: new THREE.Vector3(0, 1, 0) };
  }

  // 2. Fallback: Vertical billboard plane at distance 8 units in front of camera
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const planeCenter = camera.position.clone().addScaledVector(forward, 8);
  const eyePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward.clone().negate(), planeCenter);
  const eyeHit = new THREE.Vector3();
  if (ray.ray.intersectPlane(eyePlane, eyeHit)) {
    eyeHit.y = Math.max(0.5, Math.min(25, eyeHit.y));
    return { point: eyeHit, normal: forward.clone().negate() };
  }

  return { point: camera.position.clone().addScaledVector(forward, 6), normal: new THREE.Vector3(0, 0, 1) };
}

export function rayPlane(plane, cx, cy) {
  setMouse(cx, cy);
  const { camera } = getSceneState();
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
  const { canvas } = getSceneState();
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
