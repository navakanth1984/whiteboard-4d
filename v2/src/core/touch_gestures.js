// v2/src/core/touch_gestures.js — Multi-Touch Gesture Layer for Mobile Object Manipulation
import * as THREE from 'three';
import { getSceneState } from './scene.js';
import { selectedObject, isGizmoHit } from '../nav/transform.js';

let touchStartDistance = 0;
let touchStartAngle = 0;
let touchStartPos = new THREE.Vector2();
let initialObjPos = new THREE.Vector3();
let initialObjRotY = 0;
let isTouchingObject = false;

/**
 * Initializes multi-touch gesture handlers on the primary canvas.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initTouchGestures(canvasEl) {
  const canvas = canvasEl || document.getElementById('c');
  if (!canvas) return;

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

function getTouchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

function getTouchAngle(t1, t2) {
  return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
}

function onTouchStart(e) {
  if (!selectedObject) {
    isTouchingObject = false;
    return;
  }

  const touches = e.touches;
  const { camera } = getSceneState();
  if (!camera) return;

  const rect = e.target.getBoundingClientRect();
  const t0 = touches[0];
  const cx = ((t0.clientX - rect.left) / rect.width) * 2 - 1;
  const cy = -((t0.clientY - rect.top) / rect.height) * 2 + 1;

  // If touching the transform gizmo or action dock, let transform system handle it
  if (isGizmoHit(t0.clientX, t0.clientY)) {
    isTouchingObject = false;
    return;
  }

  isTouchingObject = true;
  touchStartPos.set(t0.clientX, t0.clientY);
  initialObjPos.copy(selectedObject.root.position);
  initialObjRotY = selectedObject.root.rotation.y;

  if (touches.length >= 2) {
    touchStartDistance = getTouchDistance(touches[0], touches[1]);
    touchStartAngle = getTouchAngle(touches[0], touches[1]);
  }
}

function onTouchMove(e) {
  if (!isTouchingObject || !selectedObject) return;

  const touches = e.touches;
  const { camera, controls } = getSceneState();
  if (!camera) return;

  // Prevent default scrolling and orbit when manipulating an active object
  e.preventDefault();
  if (controls) controls.enabled = false;

  if (touches.length === 1) {
    // 1-Finger Drag: translate object relative to camera plane
    const t0 = touches[0];
    const dx = (t0.clientX - touchStartPos.x) * 0.015;
    const dy = (t0.clientY - touchStartPos.y) * 0.015;

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

    selectedObject.root.position.copy(initialObjPos)
      .addScaledVector(right, dx)
      .addScaledVector(up, -dy);

  } else if (touches.length >= 2) {
    // 2-Finger Twist: rotate object around Y axis
    const currentAngle = getTouchAngle(touches[0], touches[1]);
    const deltaAngle = currentAngle - touchStartAngle;
    selectedObject.root.rotation.y = initialObjRotY + deltaAngle;
  }
}

function onTouchEnd(e) {
  if (isTouchingObject) {
    isTouchingObject = false;
    const { controls } = getSceneState();
    if (controls) controls.enabled = true;
  }
}
