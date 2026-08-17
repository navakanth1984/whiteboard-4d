// v2/src/input/hand_tracking.js — WebCam & Mobile Hand Tracking via Google MediaPipe Tasks Vision
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { getSceneState } from '../core/scene.js';
import { currentMode } from '../ui/modes.js';
import { beginStroke, addStrokePoint, endStroke, drawing } from '../draw/strokes.js';
import { selectObject, selectedObject } from '../nav/transform.js';
import { objects } from '../core/history.js';

let handLandmarker = null;
let isTracking = false;
let videoElement = null;
let stream = null;
let animFrameId = null;

// Holographic 3D Cursor indicator
let handCursorGroup = null;
let handCursorMesh = null;
let handCursorRing = null;

// Smoothed 3D Position and Pinch state
const currentHandPos = new THREE.Vector3();
const targetHandPos = new THREE.Vector3();
let wasPinching = false;
let isPinching = false;
let lastVideoTime = -1;

/**
 * Initializes the Hand Tracking System and binds topbar button
 */
export function initHandTrackingSystem() {
  const btn = document.getElementById('btn-hand-tracking');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!isTracking) {
      await startHandTracking();
    } else {
      stopHandTracking();
    }
  });

  initHandCursor();
}

function initHandCursor() {
  const { scene } = getSceneState();
  if (!scene) return;

  handCursorGroup = new THREE.Group();
  handCursorGroup.name = 'HandTrackingCursor';
  handCursorGroup.visible = false;

  const dotGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
  handCursorMesh = new THREE.Mesh(dotGeo, dotMat);
  handCursorGroup.add(handCursorMesh);

  const ringGeo = new THREE.RingGeometry(0.12, 0.16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  handCursorRing = new THREE.Mesh(ringGeo, ringMat);
  handCursorGroup.add(handCursorRing);

  scene.add(handCursorGroup);
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

    // Request WebCam feed (compatible with front mobile camera)
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
    if (lbl) lbl.textContent = 'TRACKING';
    if (handCursorGroup) handCursorGroup.visible = true;

    isTracking = true;
    processVideoFrame();
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
  if (handCursorGroup) handCursorGroup.visible = false;

  if (drawing) endStroke();
}

/**
 * 60 FPS Dual-Rate Vision Process Loop
 */
function processVideoFrame() {
  if (!isTracking || !videoElement || !handLandmarker) return;

  if (videoElement.currentTime !== lastVideoTime && videoElement.readyState >= 2) {
    lastVideoTime = videoElement.currentTime;
    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(videoElement, startTimeMs);

    if (results && results.landmarks && results.landmarks.length > 0) {
      handleHandLandmarks(results.landmarks[0]);
    } else {
      if (wasPinching && drawing) {
        endStroke();
        wasPinching = false;
      }
    }
  }

  updateHandCursor();
  animFrameId = requestAnimationFrame(processVideoFrame);
}

function handleHandLandmarks(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  if (!thumbTip || !indexTip) return;

  // Compute Pinch Distance
  const dx = thumbTip.x - indexTip.x;
  const dy = thumbTip.y - indexTip.y;
  const dz = (thumbTip.z || 0) - (indexTip.z || 0);
  const pinchDist = Math.hypot(dx, dy, dz);
  isPinching = (pinchDist < 0.065);

  // Map Mirrored Screen X (0..1) and Y (0..1) to Normalized Device Coordinates (-1..1)
  // Mirroring indexTip.x since front camera is mirrored (1 - indexTip.x)
  const screenX = (1.0 - indexTip.x) * 2.0 - 1.0;
  const screenY = -(indexTip.y * 2.0 - 1.0);

  const { camera } = getSceneState();
  if (!camera) return;

  // Project 3D Point in front of camera
  const vector = new THREE.Vector3(screenX, screenY, 0.5);
  vector.unproject(camera);
  const dir = vector.sub(camera.position).normalize();
  const distance = 8.0; // Standard 8m projection depth
  targetHandPos.copy(camera.position).addScaledVector(dir, distance);

  // Interaction Handlers
  if (currentMode === 'draw') {
    if (isPinching && !wasPinching) {
      beginStroke(screenX, screenY);
    } else if (isPinching && wasPinching) {
      addStrokePoint(screenX, screenY);
    } else if (!isPinching && wasPinching) {
      endStroke();
    }
  } else if (currentMode === 'nav') {
    if (isPinching && !wasPinching) {
      // Raycast to check if pinching near an object
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(screenX, screenY), camera);
      const roots = objects.map(o => o.root);
      const hits = ray.intersectObjects(roots, true);
      if (hits.length > 0) {
        let cur = hits[0].object;
        let clickedObj = null;
        while (cur && !clickedObj) {
          clickedObj = objects.find(o => o.root === cur || o.collider === cur);
          cur = cur.parent;
        }
        if (clickedObj) selectObject(clickedObj);
      }
    }
  }

  wasPinching = isPinching;
}

function updateHandCursor() {
  if (!handCursorGroup || !handCursorGroup.visible) return;

  // Smoothly interpolate cursor position for zero-jitter rendering at 60 FPS
  currentHandPos.lerp(targetHandPos, 0.35);
  handCursorGroup.position.copy(currentHandPos);

  if (handCursorMesh && handCursorRing) {
    const scale = isPinching ? 1.4 : 1.0;
    handCursorMesh.scale.setScalar(scale);
    handCursorMesh.material.color.setHex(isPinching ? 0xf43f5e : 0x38bdf8); // Red when pinching, blue idle
    handCursorRing.rotation.z += 0.05;
  }
}

export function isHandTrackingActive() {
  return isTracking;
}
