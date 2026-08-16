import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { avatarConfig, avatarRoot, updateAvatar } from './character.js';

export let isNavActive = true;
export let keysPressed = {};
export let playerVelocity = new THREE.Vector3();
export let playerHeading = 0; // Yaw angle (radians)
export let playerPitch = 0;   // Pitch angle (radians)

export let povMode = 'tps'; // 'fps', 'tps', 'orbit'
export let flySpeed = 16.0;
export let sprintMultiplier = 2.4;

let isRightMouseDown = false;
let prevMousePos = { x: 0, y: 0 };
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
    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) { // Right click for gamer mouselook
        isRightMouseDown = true;
        prevMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 2) isRightMouseDown = false;
    });

    window.addEventListener('mousemove', e => {
      if (isRightMouseDown && povMode !== 'orbit') {
        const dx = e.clientX - prevMousePos.x;
        const dy = e.clientY - prevMousePos.y;
        prevMousePos = { x: e.clientX, y: e.clientY };

        const sens = 0.0035;
        playerHeading -= dx * sens;
        playerPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, playerPitch - dy * sens));
      }
    });

    canvas.addEventListener('contextmenu', e => {
      if (povMode !== 'orbit') e.preventDefault();
    });
  }
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
    avatarRoot.position.set(center.x, Math.max(0, center.y - 1.0), center.z + maxDim * 2.0);
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

  // 1. Calculate input movement vector relative to player heading
  const moveDir = new THREE.Vector3();

  if (keysPressed['KeyW'] || keysPressed['ArrowUp']) moveDir.z -= 1;
  if (keysPressed['KeyS'] || keysPressed['ArrowDown']) moveDir.z += 1;
  if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) moveDir.x -= 1;
  if (keysPressed['KeyD'] || keysPressed['ArrowRight']) moveDir.x += 1;
  if (keysPressed['Space'] || keysPressed['KeyE']) moveDir.y += 1; // Ascend
  if (keysPressed['KeyC'] || keysPressed['ControlLeft'] || keysPressed['KeyQ']) moveDir.y -= 1; // Descend

  const isMoving = moveDir.lengthSq() > 0.001;
  const isSprinting = keysPressed['ShiftLeft'] || keysPressed['ShiftRight'];
  const curSpeed = flySpeed * (isSprinting ? sprintMultiplier : 1.0);

  if (isMoving) {
    moveDir.normalize();

    // Rotate horizontal motion by player heading
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);

    const worldMove = forward.multiplyScalar(-moveDir.z)
      .add(right.multiplyScalar(moveDir.x))
      .add(new THREE.Vector3(0, moveDir.y, 0));

    playerVelocity.lerp(worldMove.multiplyScalar(curSpeed), 0.15);
  } else {
    playerVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.18);
  }

  // 2. Update Avatar Position in Space
  if (avatarRoot) {
    avatarRoot.position.addScaledVector(playerVelocity, dt);
    // Keep avatar above floor
    avatarRoot.position.y = Math.max(0, avatarRoot.position.y);

    if (isMoving && Math.abs(moveDir.x) + Math.abs(moveDir.z) > 0.1) {
      const motionAngle = Math.atan2(playerVelocity.x, playerVelocity.z);
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, motionAngle, 0.2);
    } else if (povMode !== 'orbit') {
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, playerHeading, 0.15);
    }

    updateAvatar(dt, playerVelocity, isMoving);
  }

  // 3. Update Camera based on POV Mode
  if (povMode === 'fps' && avatarRoot) {
    // 1st Person: Camera located at eye level of avatar
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
    // 3rd Person: Dynamic over-the-shoulder follow camera
    const shoulderOffset = new THREE.Vector3(1.2, 2.2, 4.2);
    shoulderOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerHeading);

    const targetCamPos = avatarRoot.position.clone().add(shoulderOffset);
    camera.position.lerp(targetCamPos, 0.15);

    const lookAtPos = avatarRoot.position.clone().add(new THREE.Vector3(0, 1.8, 0)).add(
      new THREE.Vector3(Math.sin(playerHeading) * 10, Math.sin(playerPitch) * 10, -Math.cos(playerHeading) * 10)
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
