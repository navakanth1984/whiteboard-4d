// v2/src/input/hand_tracking.js — Dual-Hand Tracking & Spatial Gestures via Google MediaPipe Tasks Vision
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { getSceneState } from '../core/scene.js';
import { currentMode, setMode } from '../ui/modes.js';
import { beginStroke, addStrokePoint, endStroke, drawing } from '../draw/strokes.js';
import { selectObject, deselectObject, selectedObject } from '../nav/transform.js';
import { objects, removeObj } from '../core/history.js';
import { addSpatialCard, setCurCard } from '../objects/models.js';
import { showVoiceHUD } from '../agent/voice_commands.js';
import { setDraggingObject, syncBodyTransform } from '../physics/rapier_engine.js';

let handLandmarker = null;
let isTracking = false;
let videoElement = null;
let stream = null;
let animFrameId = null;

// Dual 3D Cursor Indicators (Right / Lead Hand + Left / Off Hand)
let cursorGroup0 = null;
let cursorMesh0 = null;
let cursorRing0 = null;

let cursorGroup1 = null;
let cursorMesh1 = null;
let cursorRing1 = null;

// Smoothed 3D Positions & Hand Tracking State
const handState = [
  {
    screenX: 0, screenY: 0,
    currentPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    prevPos: new THREE.Vector3(),
    isPinching: false,
    wasPinching: false,
    isOpenPalm: false,
    isVSign: false,
    pinchDist: 1.0,
    activeDragObj: null
  },
  {
    screenX: 0, screenY: 0,
    currentPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    prevPos: new THREE.Vector3(),
    isPinching: false,
    wasPinching: false,
    isOpenPalm: false,
    isVSign: false,
    pinchDist: 1.0,
    activeDragObj: null
  }
];

// Two-Hand Gesture Metrics
let initialTwoHandDist = 0;
let initialTwoHandAngle = 0;
let initialObjScale = new THREE.Vector3();
let initialObjRotY = 0;
let isTwoHandTransforming = false;
let lastVideoTime = -1;
let gestureCooldown = 0;

/**
 * Initializes the Hand Tracking System and binds topbar button
 */
export function initHandTrackingSystem() {
  initDualHandCursors();
  exposeDiagnostics();

  const btn = document.getElementById('btn-hand-tracking');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!isTracking) {
      await startHandTracking();
    } else {
      stopHandTracking();
    }
  });
}

function initDualHandCursors() {
  const { scene } = getSceneState();
  if (!scene) return;

  // 1. Right / Lead Hand Cursor (Cyan)
  cursorGroup0 = new THREE.Group();
  cursorGroup0.name = 'HandCursor_Right';
  cursorGroup0.visible = false;

  const dotGeo0 = new THREE.SphereGeometry(0.09, 16, 16);
  const dotMat0 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
  cursorMesh0 = new THREE.Mesh(dotGeo0, dotMat0);
  cursorGroup0.add(cursorMesh0);

  const ringGeo0 = new THREE.RingGeometry(0.13, 0.17, 32);
  const ringMat0 = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  cursorRing0 = new THREE.Mesh(ringGeo0, ringMat0);
  cursorGroup0.add(cursorRing0);
  scene.add(cursorGroup0);

  // 2. Left / Off Hand Cursor (Violet)
  cursorGroup1 = new THREE.Group();
  cursorGroup1.name = 'HandCursor_Left';
  cursorGroup1.visible = false;

  const dotGeo1 = new THREE.SphereGeometry(0.09, 16, 16);
  const dotMat1 = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.9 });
  cursorMesh1 = new THREE.Mesh(dotGeo1, dotMat1);
  cursorGroup1.add(cursorMesh1);

  const ringGeo1 = new THREE.RingGeometry(0.13, 0.17, 32);
  const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  cursorRing1 = new THREE.Mesh(ringGeo1, ringMat1);
  cursorGroup1.add(cursorRing1);
  scene.add(cursorGroup1);
}

/**
 * Starts the WebCam stream and initializes MediaPipe HandLandmarker
 */
export async function startHandTracking() {
  const statusDot = document.getElementById('hand-status-dot');
  const lbl = document.getElementById('hand-tracking-lbl');
  const container = document.getElementById('hand-cam-container');
  videoElement = document.getElementById('hand-video');

  if (statusDot) statusDot.style.background = '#eab308'; // Loading (Yellow)
  if (lbl) lbl.textContent = 'LOADING...';

  try {
    if (!handLandmarker) {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    }

    // Request WebCam feed
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    if (videoElement) {
      videoElement.srcObject = stream;
      await videoElement.play();
    }

    if (container) container.style.display = 'block';
    if (statusDot) statusDot.style.background = '#22c55e'; // Active (Green)
    if (lbl) lbl.textContent = 'HANDS ON';
    if (cursorGroup0) cursorGroup0.visible = true;

    isTracking = true;
    processVideoFrame();
    showVoiceHUD('Dual-Hand Tracking Active', 'Pinch to drag • 2-Hand Pinch to scale/rotate • Open Palm to delete');
  } catch (err) {
    console.error('Failed to initialize Hand Tracking:', err);
    if (statusDot) statusDot.style.background = '#ef4444'; // Error (Red)
    if (lbl) lbl.textContent = 'CAMERA ERR';
    alert('WebCam permission or MediaPipe initialization failed. Please check browser camera permissions.');
    stopHandTracking();
  }
}

/**
 * Stops WebCam stream and resets cursor state
 */
export function stopHandTracking() {
  isTracking = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  const container = document.getElementById('hand-cam-container');
  const statusDot = document.getElementById('hand-status-dot');
  const lbl = document.getElementById('hand-tracking-lbl');

  if (container) container.style.display = 'none';
  if (statusDot) statusDot.style.background = '#64748b'; // Inactive (Slate)
  if (lbl) lbl.textContent = 'HAND TRACK';

  if (cursorGroup0) cursorGroup0.visible = false;
  if (cursorGroup1) cursorGroup1.visible = false;

  if (drawing) endStroke();
}

/**
 * 60 FPS Dual-Rate Vision Process Loop
 */
function processVideoFrame() {
  if (!isTracking || !videoElement || !handLandmarker) return;

  if (gestureCooldown > 0) gestureCooldown--;

  if (videoElement.currentTime !== lastVideoTime && videoElement.readyState >= 2) {
    lastVideoTime = videoElement.currentTime;
    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(videoElement, startTimeMs);

    if (results && results.landmarks) {
      processDualHandLandmarks(results.landmarks);
    } else {
      resetHandStates();
    }
  }

  updateHandCursorsVisuals();
  animFrameId = requestAnimationFrame(processVideoFrame);
}

function processDualHandLandmarks(allLandmarks) {
  const { camera } = getSceneState();
  if (!camera) return;

  const count = Math.min(2, allLandmarks.length);

  // Update Left & Right Cursor Visibility
  if (cursorGroup0) cursorGroup0.visible = count > 0;
  if (cursorGroup1) cursorGroup1.visible = count > 1;

  for (let i = 0; i < count; i++) {
    const lm = allLandmarks[i];
    const state = handState[i];

    const thumbTip = lm[4];
    const indexTip = lm[8];
    const middleTip = lm[12];
    const ringTip = lm[16];
    const pinkyTip = lm[20];
    const wrist = lm[0];

    if (!thumbTip || !indexTip || !wrist) continue;

    // 1. Pinch Detection (Thumb Tip to Index Tip)
    const pinchDx = thumbTip.x - indexTip.x;
    const pinchDy = thumbTip.y - indexTip.y;
    const pinchDz = (thumbTip.z || 0) - (indexTip.z || 0);
    state.pinchDist = Math.hypot(pinchDx, pinchDy, pinchDz);
    state.isPinching = state.pinchDist < 0.07;

    // 2. Open Palm Detection (All 5 fingers extended beyond their PIP joints)
    const fingersExtended = (
      indexTip.y < lm[6].y &&
      middleTip.y < lm[10].y &&
      ringTip.y < lm[14].y &&
      pinkyTip.y < lm[18].y
    );
    state.isOpenPalm = fingersExtended && state.pinchDist > 0.15;

    // 3. Victory / V-Sign Detection (Index & Middle extended, Ring & Pinky folded)
    state.isVSign = (
      indexTip.y < lm[6].y &&
      middleTip.y < lm[10].y &&
      ringTip.y > lm[14].y &&
      pinkyTip.y > lm[18].y &&
      state.pinchDist > 0.12
    );

    // 4. Screen projection (mirrored front webcam)
    state.screenX = (1.0 - indexTip.x) * 2.0 - 1.0;
    state.screenY = -(indexTip.y * 2.0 - 1.0);

    const vector = new THREE.Vector3(state.screenX, state.screenY, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = 8.0;
    state.prevPos.copy(state.targetPos);
    state.targetPos.copy(camera.position).addScaledVector(dir, distance);
  }

  // ════════ TWO-HAND GESTURES (SCALE & ROTATE) ════════
  if (count >= 2 && handState[0].isPinching && handState[1].isPinching) {
    handleTwoHandTransform();
  } else {
    if (isTwoHandTransforming) setDraggingObject(null);
    isTwoHandTransforming = false;
    // ════════ SINGLE-HAND GESTURES (MOVE, DRAW, TAP, PALM DELETE) ════════
    if (count >= 1) {
      handleSingleHandGestures(handState[0]);
    }
  }

  // Save history state
  for (let i = 0; i < count; i++) {
    handState[i].wasPinching = handState[i].isPinching;
  }
}

function handleTwoHandTransform() {
  if (!selectedObject || !selectedObject.root) return;

  const dx = handState[0].screenX - handState[1].screenX;
  const dy = handState[0].screenY - handState[1].screenY;
  const currentDist = Math.hypot(dx, dy);
  const currentAngle = Math.atan2(dy, dx);

  if (!isTwoHandTransforming) {
    isTwoHandTransforming = true;
    initialTwoHandDist = currentDist;
    initialTwoHandAngle = currentAngle;
    initialObjScale.copy(selectedObject.root.scale);
    initialObjRotY = selectedObject.root.rotation.y;
    setDraggingObject(selectedObject.id);
    return;
  }

  // 1. Two-Hand Scaling
  if (initialTwoHandDist > 0.05) {
    const scaleRatio = currentDist / initialTwoHandDist;
    const clampedRatio = Math.max(0.3, Math.min(3.0, scaleRatio));
    selectedObject.root.scale.copy(initialObjScale).multiplyScalar(clampedRatio);
  }

  // 2. Two-Hand Rotation
  const deltaAngle = currentAngle - initialTwoHandAngle;
  selectedObject.root.rotation.y = initialObjRotY + deltaAngle * 1.5;
  selectedObject.root.updateMatrixWorld(true);
  syncBodyTransform(selectedObject.id, selectedObject.root.position, selectedObject.root.quaternion);
}

function handleSingleHandGestures(state) {
  const { camera } = getSceneState();
  if (!camera) return;

  // GESTURE 1: 5-Finger Open Palm Delete Gesture
  if (state.isOpenPalm && selectedObject && gestureCooldown === 0) {
    const objToDelete = selectedObject;
    const lbl = objToDelete.label || objToDelete.type;
    removeObj(objToDelete);
    deselectObject();
    gestureCooldown = 45; // 0.75s cooldown
    showVoiceHUD('Hand Gesture', `Open Palm: Deleted ${lbl}`);
    return;
  }

  // GESTURE 2: Victory V-Sign Quick Spawn
  if (state.isVSign && gestureCooldown === 0) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const spawnPos = camera.position.clone().addScaledVector(forward, 6.0);
    spawnPos.y = Math.max(1.5, spawnPos.y);

    setCurCard('gateway');
    const o = addSpatialCard('gateway', { point: spawnPos, normal: new THREE.Vector3(0, 0, 1) });
    setMode('nav');
    if (o) selectObject(o);

    gestureCooldown = 60; // 1s cooldown
    showVoiceHUD('Hand Gesture', 'V-Sign: Spawned API Gateway');
    return;
  }

  // GESTURE 3: Draw Mode 3D Air Inking
  if (currentMode === 'draw') {
    if (state.isPinching && !state.wasPinching) {
      beginStroke(state.screenX, state.screenY);
    } else if (state.isPinching && state.wasPinching) {
      addStrokePoint(state.screenX, state.screenY);
    } else if (!state.isPinching && state.wasPinching) {
      endStroke();
    }
    return;
  }

  // GESTURE 4: NAV Mode Pinch Grab & 3D Move
  if (currentMode === 'nav') {
    if (state.isPinching && !state.wasPinching) {
      // Raycast to check if pinching on an object
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(state.screenX, state.screenY), camera);
      const roots = objects.map(o => o.root).filter(Boolean);
      const hits = ray.intersectObjects(roots, true);

      if (hits.length > 0) {
        let hitObj = hits[0].object;
        let clickedObj = objects.find(o => {
          if (!o.root) return false;
          if (o.root === hitObj || o.collider === hitObj) return true;
          let found = false;
          o.root.traverse(child => { if (child === hitObj) found = true; });
          return found;
        });

        if (clickedObj) {
          selectObject(clickedObj);
          state.activeDragObj = clickedObj;
          setDraggingObject(clickedObj.id);
        }
      } else {
        deselectObject();
      }
    } else if (state.isPinching && state.wasPinching && (state.activeDragObj || selectedObject)) {
      const obj = state.activeDragObj || selectedObject;
      if (obj && obj.root) {
        // Delta motion translation relative to camera workspace plane
        const deltaWorld = state.targetPos.clone().sub(state.prevPos);
        obj.root.position.add(deltaWorld);
        obj.root.position.x = Math.max(-50, Math.min(50, obj.root.position.x));
        obj.root.position.y = Math.max(0.2, Math.min(30, obj.root.position.y));
        obj.root.position.z = Math.max(-50, Math.min(50, obj.root.position.z));
        obj.root.updateMatrixWorld(true);
        syncBodyTransform(obj.id, obj.root.position, obj.root.quaternion);
      }
    } else if (!state.isPinching && state.wasPinching) {
      if (state.activeDragObj) {
        syncBodyTransform(state.activeDragObj.id, state.activeDragObj.root.position, state.activeDragObj.root.quaternion);
      }
      setDraggingObject(null);
      state.activeDragObj = null;
    }
  }
}

function resetHandStates() {
  if (handState[0].wasPinching && drawing) {
    endStroke();
  }
  if (handState[0].activeDragObj) {
    syncBodyTransform(handState[0].activeDragObj.id, handState[0].activeDragObj.root.position, handState[0].activeDragObj.root.quaternion);
    handState[0].activeDragObj = null;
  }
  setDraggingObject(null);
  handState[0].wasPinching = false;
  handState[0].isPinching = false;
  handState[1].wasPinching = false;
  handState[1].isPinching = false;
  isTwoHandTransforming = false;
}

function updateHandCursorsVisuals() {
  // 1. Right Hand Cursor Update
  if (cursorGroup0 && cursorGroup0.visible) {
    handState[0].currentPos.lerp(handState[0].targetPos, 0.35);
    cursorGroup0.position.copy(handState[0].currentPos);

    if (cursorMesh0 && cursorRing0) {
      const scale = handState[0].isPinching ? 1.4 : 1.0;
      cursorMesh0.scale.setScalar(scale);
      cursorMesh0.material.color.setHex(handState[0].isPinching ? 0xf43f5e : 0x38bdf8);
      cursorRing0.rotation.z += 0.05;
    }
  }

  // 2. Left Hand Cursor Update
  if (cursorGroup1 && cursorGroup1.visible) {
    handState[1].currentPos.lerp(handState[1].targetPos, 0.35);
    cursorGroup1.position.copy(handState[1].currentPos);

    if (cursorMesh1 && cursorRing1) {
      const scale = handState[1].isPinching ? 1.4 : 1.0;
      cursorMesh1.scale.setScalar(scale);
      cursorMesh1.material.color.setHex(handState[1].isPinching ? 0xf59e0b : 0xa855f7);
      cursorRing1.rotation.z += 0.05;
    }
  }
}

export function isHandTrackingActive() {
  return isTracking;
}

function exposeDiagnostics() {
  if (typeof window !== 'undefined') {
    window.__handTrackingProbe = {
      isTracking: () => isTracking,
      getHandState: () => handState,
      start: startHandTracking,
      stop: stopHandTracking
    };
  }
}

export const initHandTracking = initHandTrackingSystem;
export const toggleHandTracking = async () => (!isTracking ? startHandTracking() : stopHandTracking());
export const handTrackingActive = () => isTracking;
