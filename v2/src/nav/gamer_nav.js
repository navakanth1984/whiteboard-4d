import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { avatarConfig, avatarRoot, updateAvatar } from './character.js';

export let isNavActive = true;
export let keysPressed = {};
export let playerVelocity = new THREE.Vector3();
export let playerHeading = 0; // Yaw angle (radians)
export let playerPitch = 0.15; // Pitch angle (radians)

export let povMode = 'tps'; // 'fps', 'tps', 'orbit'
export let flySpeed = 18.0;
export let sprintMultiplier = 2.4;

let isPointerDown = false;
let pointerButton = 0;
let prevPointerPos = { x: 0, y: 0 };
let focusTarget = null;
let focusTween = null;

export function setPOVMode(mode) {
  if (['fps', 'tps', 'orbit'].includes(mode)) {
    povMode = mode;
    avatarConfig.povMode = mode;
    const { controls } = getSceneState();
    if (controls) {
      controls.enabled = (mode === 'orbit');
    }
  }
}

export function handlePointerDown(e) {
  if (window.__currentMode === 'nav' || povMode !== 'orbit') {
    isPointerDown = true;
    pointerButton = e.button !== undefined ? e.button : 0;
    prevPointerPos = { x: e.clientX, y: e.clientY };
  }
}

export function handlePointerMove(e) {
  if (!isPointerDown) return;
  if (window.__transformControl && window.__transformControl.dragging) return;

  const dx = e.clientX - prevPointerPos.x;
  const dy = e.clientY - prevPointerPos.y;
  prevPointerPos = { x: e.clientX, y: e.clientY };

  if (povMode === 'orbit') return;

  if (pointerButton === 1 || e.shiftKey) {
    // Middle Click / Shift+Drag: Pan Avatar & Camera in 3D space
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);
    const up = new THREE.Vector3(0, 1, 0);
    if (avatarRoot) {
      avatarRoot.position.addScaledVector(right, -dx * 0.025);
      avatarRoot.position.addScaledVector(up, dy * 0.025);
    }
  } else {
    // Left Click / Right Click Drag: Smooth Free Look & Orbit
    const sens = 0.0035;
    playerHeading -= dx * sens;
    playerPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, playerPitch - dy * sens));
  }
}

export function handlePointerUp() {
  isPointerDown = false;
}

export function initGamerNav() {
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    keysPressed[e.code] = true;

    // Hotkey: 'F' to focus camera on selected object
    if (e.code === 'KeyF' && window.__selectedObject) {
      focusOnObject(window.__selectedObject);
    }
    // Hotkey: 'V' to cycle POV modes (FPS -> TPS -> Orbit)
    if (e.code === 'KeyV') {
      const nextMode = povMode === 'tps' ? 'fps' : (povMode === 'fps' ? 'orbit' : 'tps');
      setPOVMode(nextMode);
    }
  });

  window.addEventListener('keyup', e => {
    keysPressed[e.code] = false;
  });

  const canvas = document.getElementById('c');
  if (canvas) {
    // 1. Pointer Down
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);

    // 2. Mouse Wheel: 3D Dolly / Zoom / Spatial Elevation
    canvas.addEventListener('wheel', e => {
      if (window.__currentMode === 'nav' && povMode !== 'orbit' && avatarRoot) {
        e.preventDefault();
        const zoomDelta = e.deltaY * 0.02;

        if (e.ctrlKey) {
          // Ctrl + Wheel: Elevate Up / Down in 3D
          avatarRoot.position.y += (e.deltaY > 0 ? -0.8 : 0.8);
        } else {
          // Regular Wheel: Move along forward/backward 3D sight vector
          const forward = new THREE.Vector3(
            Math.sin(playerHeading) * Math.cos(playerPitch),
            Math.sin(playerPitch),
            -Math.cos(playerHeading) * Math.cos(playerPitch)
          );
          avatarRoot.position.addScaledVector(forward, -zoomDelta * 1.5);
        }
      }
    }, { passive: false });

    canvas.addEventListener('contextmenu', e => {
      if (povMode !== 'orbit') e.preventDefault();
    });
  }

  // 3. Setup On-Screen 3D Navigation Controls (D-Pad)
  setupOnScreenNavControls();
}

function setupOnScreenNavControls() {
  const padWrap = document.getElementById('spatial-dpad');
  if (!padWrap) return;

  const bindPadBtn = (id, keyCode) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const start = (e) => {
      e.preventDefault();
      keysPressed[keyCode] = true;
    };
    const end = (e) => {
      e.preventDefault();
      keysPressed[keyCode] = false;
    };

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
  };

  bindPadBtn('dpad-up', 'KeyW');
  bindPadBtn('dpad-down', 'KeyS');
  bindPadBtn('dpad-left', 'KeyA');
  bindPadBtn('dpad-right', 'KeyD');
  bindPadBtn('dpad-elev-up', 'Space');
  bindPadBtn('dpad-elev-down', 'KeyC');
}

export function focusOnObject(obj) {
  if (!obj || !obj.root) return;
  const { camera, controls } = getSceneState();
  if (!camera) return;

  const box = new THREE.Box3().setFromObject(obj.root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 2.0);

  if (avatarRoot) {
    avatarRoot.position.set(center.x, center.y, center.z + maxDim * 2.0);
  }

  if (window.gsap) {
    window.gsap.to(camera.position, {
      x: center.x + maxDim * 1.5,
      y: center.y + maxDim * 0.8,
      z: center.z + maxDim * 2.5,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (controls) {
          controls.target.copy(center);
          controls.update();
        } else {
          camera.lookAt(center);
        }
      }
    });
  }
}

export function updateGamerNav(dt) {
  const { camera, controls } = getSceneState();
  if (!camera) return;

  // 1. Calculate 6-DOF input movement vector (above, below, sideways, diagonal)
  const moveDir = new THREE.Vector3();

  if (keysPressed['KeyW'] || keysPressed['ArrowUp']) moveDir.z -= 1;
  if (keysPressed['KeyS'] || keysPressed['ArrowDown']) moveDir.z += 1;
  if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) moveDir.x -= 1;
  if (keysPressed['KeyD'] || keysPressed['ArrowRight']) moveDir.x += 1;
  if (keysPressed['Space'] || keysPressed['KeyE']) moveDir.y += 1; // Elevate Up
  if (keysPressed['KeyC'] || keysPressed['ControlLeft'] || keysPressed['KeyQ']) moveDir.y -= 1; // Elevate Down

  const isMoving = moveDir.lengthSq() > 0.001;
  const isSprinting = keysPressed['ShiftLeft'] || keysPressed['ShiftRight'];
  const curSpeed = flySpeed * (isSprinting ? sprintMultiplier : 1.0);

  if (isMoving) {
    moveDir.normalize();

    // Rotate horizontal & depth motion by player heading
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);

    const worldMove = forward.multiplyScalar(-moveDir.z)
      .add(right.multiplyScalar(moveDir.x))
      .add(new THREE.Vector3(0, moveDir.y, 0));

    playerVelocity.lerp(worldMove.multiplyScalar(curSpeed), 0.18);
  } else {
    playerVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.18);
  }

  // 2. Update Avatar Position & 3D Flight / Diagonal Movement
  if (avatarRoot) {
    avatarRoot.position.addScaledVector(playerVelocity, dt);

    if (isMoving && Math.abs(moveDir.x) + Math.abs(moveDir.z) > 0.1) {
      const motionAngle = Math.atan2(playerVelocity.x, playerVelocity.z);
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, motionAngle, 0.2);

      // Banking Roll when moving sideways/diagonally
      const bankTilt = (-moveDir.x * 0.15);
      avatarRoot.rotation.z = THREE.MathUtils.lerp(avatarRoot.rotation.z, bankTilt, 0.15);
      // Pitch tilt when ascending/descending
      const pitchTilt = (moveDir.y * 0.12);
      avatarRoot.rotation.x = THREE.MathUtils.lerp(avatarRoot.rotation.x, pitchTilt, 0.15);
    } else if (povMode !== 'orbit') {
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, playerHeading, 0.15);
      avatarRoot.rotation.z = THREE.MathUtils.lerp(avatarRoot.rotation.z, 0, 0.15);
      avatarRoot.rotation.x = THREE.MathUtils.lerp(avatarRoot.rotation.x, 0, 0.15);
    }

    updateAvatar(dt, playerVelocity, isMoving);
  }

  // 3. Update Camera based on POV Mode
  if (povMode === 'fps' && avatarRoot) {
    // 1st Person (FPS)
    camera.position.set(
      avatarRoot.position.x,
      avatarRoot.position.y + 2.1,
      avatarRoot.position.z
    );

    const lookTarget = camera.position.clone().add(
      new THREE.Vector3(
        Math.sin(playerHeading) * Math.cos(playerPitch),
        Math.sin(playerPitch),
        -Math.cos(playerHeading) * Math.cos(playerPitch)
      )
    );
    camera.lookAt(lookTarget);

  } else if (povMode === 'tps' && avatarRoot) {
    // 3rd Person (TPS): Dynamic Over-the-Shoulder follow camera with 3D elevation
    const shoulderOffset = new THREE.Vector3(1.2, 2.0, 4.4);
    shoulderOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);

    const targetCamPos = avatarRoot.position.clone().add(shoulderOffset);
    camera.position.lerp(targetCamPos, 0.18);

    const lookAtPos = avatarRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0)).add(
      new THREE.Vector3(
        Math.sin(playerHeading) * Math.cos(playerPitch) * 10,
        Math.sin(playerPitch) * 10,
        -Math.cos(playerHeading) * Math.cos(playerPitch) * 10
      )
    );
    camera.lookAt(lookAtPos);

  } else if (povMode === 'orbit') {
    // Studio Orbit mode handled by controls.update()
  }

  // Update Telemetry for HUD
  window.__gamerTelemetry = {
    pos: avatarRoot ? avatarRoot.position : camera.position,
    speed: playerVelocity.length(),
    heading: playerHeading,
    pitch: playerPitch,
    pov: povMode,
    isSprinting
  };
}
