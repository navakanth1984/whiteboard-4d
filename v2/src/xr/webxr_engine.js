// v2/src/xr/webxr_engine.js — WebXR Spatial VR/AR Mode for Apple Vision Pro & Meta Quest 3
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { getSceneState } from '../core/scene.js';
import { beginStroke, addStrokePoint, endStroke } from '../draw/strokes.js';
import { selectObject, deselectObject } from '../nav/transform.js';
import { objects } from '../core/history.js';

let controller1 = null;
let controller2 = null;
let controllerGrip1 = null;
let controllerGrip2 = null;
let isXRActive = false;

/**
 * Initializes WebXR support on the Three.js renderer
 */
export function initWebXRSystem() {
  const { renderer, scene } = getSceneState();
  if (!renderer || !scene) return;

  // 1. Enable WebXR on WebGLRenderer
  renderer.xr.enabled = true;

  // 2. Add VR/AR Entrance Buttons to Bottombar
  initXRButtons(renderer);

  // 3. Setup 6DoF Motion Controllers & Laser Pointer Rays
  initXRControllers(renderer, scene);

  // 4. Session Start / End Listeners
  renderer.xr.addEventListener('sessionstart', () => {
    isXRActive = true;
    console.log('WebXR Session Started (6DoF Headset Connected)');
  });

  renderer.xr.addEventListener('sessionend', () => {
    isXRActive = false;
    console.log('WebXR Session Ended');
  });
}

function initXRButtons(renderer) {
  const bottombar = document.getElementById('bottombar');
  if (!bottombar) return;

  if ('xr' in navigator) {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (supported) {
        const vrBtn = VRButton.createButton(renderer);
        vrBtn.id = 'btn-webxr-vr';
        vrBtn.style.position = 'relative';
        vrBtn.style.bottom = 'auto';
        vrBtn.style.left = 'auto';
        vrBtn.style.padding = '6px 12px';
        vrBtn.style.fontSize = '12px';
        vrBtn.style.borderRadius = '8px';
        vrBtn.style.background = '#0284c7';
        vrBtn.style.color = '#fff';
        vrBtn.style.border = '1px solid #38bdf8';
        bottombar.appendChild(vrBtn);
      }
    });

    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (supported) {
        const arBtn = ARButton.createButton(renderer);
        arBtn.id = 'btn-webxr-ar';
        arBtn.style.position = 'relative';
        arBtn.style.bottom = 'auto';
        arBtn.style.left = 'auto';
        arBtn.style.padding = '6px 12px';
        arBtn.style.fontSize = '12px';
        arBtn.style.borderRadius = '8px';
        arBtn.style.background = '#7c3aed';
        arBtn.style.color = '#fff';
        arBtn.style.border = '1px solid #a855f7';
        bottombar.appendChild(arBtn);
      }
    });
  }
}

function initXRControllers(renderer, scene) {
  // Controller 1 (Right Hand - Pointer & Drawer)
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('selectstart', onSelectStart);
  controller1.addEventListener('selectend', onSelectEnd);
  controller1.add(buildLaserRay());
  scene.add(controller1);

  // Controller 2 (Left Hand - Palette & Laser)
  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('selectstart', onSelectStart);
  controller2.addEventListener('selectend', onSelectEnd);
  controller2.add(buildLaserRay());
  scene.add(controller2);
}

function buildLaserRay() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -5)
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75
  });
  return new THREE.Line(geo, mat);
}

function onSelectStart(e) {
  const controller = e.target;
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  const ray = new THREE.Raycaster();
  ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  ray.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  // Raycast objects
  const roots = objects.map(o => o.root).filter(Boolean);
  const hits = ray.intersectObjects(roots, true);
  if (hits.length > 0) {
    let hitObj = hits[0].object;
    let clicked = objects.find(o => o.root === hitObj || o.collider === hitObj);
    if (clicked) selectObject(clicked);
  }
}

function onSelectEnd() {
  // End selection
}

export function isWebXRActive() {
  return isXRActive;
}

export function isWebXRSupported() {
  return ('xr' in navigator);
}
