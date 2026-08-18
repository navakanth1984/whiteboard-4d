// v2/src/ui/orbital_menu.js — VisionOS 3D Holographic Orbital Action Ring Menu
import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { removeObject, objects, register } from '../core/history.js';
import { playHoverSound, playClickSound, playWhoosh } from '../audio/haptics.js';

let orbitalGroup = null;
let currentTarget = null;
let isOpen = false;
let orbitalButtons = [];

const ORBITAL_ACTIONS = [
  { id: 'dup', label: 'DUPLICATE', icon: '📑', color: '#0284c7' },
  { id: 'toss', label: 'PHYSICS TOSS', icon: '🚀', color: '#8b5cf6' },
  { id: 'link', label: 'CONNECT', icon: '⚡', color: '#f59e0b' },
  { id: 'tint', label: 'NEON TINT', icon: '🎨', color: '#ec4899' },
  { id: 'ocr', label: '3D OCR', icon: '🔤', color: '#10b981' },
  { id: 'delete', label: 'DISSOLVE', icon: '🗑️', color: '#ef4444' }
];

/**
 * Initializes the VisionOS 3D Orbital Menu Subsystem
 */
export function initOrbitalMenuSystem() {
  const { scene } = getSceneState();
  if (!scene) return;

  orbitalGroup = new THREE.Group();
  orbitalGroup.visible = false;
  orbitalGroup.scale.set(0.001, 0.001, 0.001);

  // Outer Holographic Circle Guide Ring
  const ringGeo = new THREE.RingGeometry(3.15, 3.25, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  orbitalGroup.add(ring);

  // 6 Action Buttons arranged radially
  const radius = 3.2;
  const count = ORBITAL_ACTIONS.length;

  ORBITAL_ACTIONS.forEach((action, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const bx = Math.cos(angle) * radius;
    const by = Math.sin(angle) * radius;

    const btnGroup = createOrbitalButtonMesh(action);
    btnGroup.position.set(bx, by, 0.05);
    btnGroup.userData.actionId = action.id;

    orbitalGroup.add(btnGroup);
    orbitalButtons.push(btnGroup);
  });

  scene.add(orbitalGroup);
}

function createOrbitalButtonMesh(action) {
  const group = new THREE.Group();

  // Button Backing Disc
  const discGeo = new THREE.CircleGeometry(0.7, 32);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  group.add(disc);

  // Outer Glowing Rim
  const rimGeo = new THREE.RingGeometry(0.68, 0.74, 32);
  const rimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(action.color),
    side: THREE.DoubleSide
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.z = 0.01;
  group.add(rim);

  // 2D Canvas Texture for Icon and Text
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = action.color;
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(action.icon, 128, 100);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(action.label, 128, 190);

  const texture = new THREE.CanvasTexture(canvas);
  const textMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });
  const textMesh = new THREE.Mesh(discGeo, textMat);
  textMesh.position.z = 0.02;
  group.add(textMesh);

  return group;
}

/**
 * Opens the 3D orbital menu focused on a selected object
 */
export function openOrbitalMenu(targetObject, camera = null) {
  if (!orbitalGroup || !targetObject || !targetObject.root) return;

  currentTarget = targetObject;
  orbitalGroup.position.copy(targetObject.root.position);
  if (camera) {
    orbitalGroup.quaternion.copy(camera.quaternion);
  }

  orbitalGroup.visible = true;
  isOpen = true;
  playHoverSound();

  // Spring animation from 0.001 to 1.0
  if (typeof window.gsap !== 'undefined') {
    window.gsap.to(orbitalGroup.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.35,
      ease: 'back.out(1.7)'
    });
  } else {
    orbitalGroup.scale.set(1, 1, 1);
  }
}

/**
 * Closes and hides the 3D orbital menu
 */
export function closeOrbitalMenu() {
  if (!orbitalGroup || !isOpen) return;

  if (typeof window.gsap !== 'undefined') {
    window.gsap.to(orbitalGroup.scale, {
      x: 0.001, y: 0.001, z: 0.001,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        orbitalGroup.visible = false;
        isOpen = false;
        currentTarget = null;
      }
    });
  } else {
    orbitalGroup.scale.set(0.001, 0.001, 0.001);
    orbitalGroup.visible = false;
    isOpen = false;
    currentTarget = null;
  }
}

/**
 * Triggers a specific action on the active orbital target
 */
export function triggerOrbitalAction(actionId) {
  if (!currentTarget) return null;
  playClickSound();

  const o = currentTarget;
  switch (actionId) {
    case 'delete':
      playWhoosh();
      removeObject(o);
      closeOrbitalMenu();
      return { action: 'delete', success: true };

    case 'toss':
      if (window.__physicsProbe) {
        window.__physicsProbe.applyImpulse(o.id, 0, 10, -8);
      }
      closeOrbitalMenu();
      return { action: 'toss', success: true };

    case 'ocr':
      if (window.__ocrProbe) {
        window.__ocrProbe.convertHandwritingTo3DText([o]);
      }
      closeOrbitalMenu();
      return { action: 'ocr', success: true };

    case 'dup':
      if (o.root) {
        const cloneMesh = o.root.clone();
        cloneMesh.position.add(new THREE.Vector3(2, 0, 2));
        const dupRecord = {
          id: 'dup-' + Math.random().toString(36).substring(2, 9),
          type: o.type,
          root: cloneMesh,
          collider: cloneMesh
        };
        register(dupRecord);
      }
      closeOrbitalMenu();
      return { action: 'dup', success: true };

    case 'tint':
      if (o.root) {
        const neonPalette = [0x00f0ff, 0xf43f5e, 0x10b981, 0xa855f7, 0xf59e0b];
        const randomColor = neonPalette[Math.floor(Math.random() * neonPalette.length)];
        o.root.traverse(c => {
          if (c.isMesh && c.material) {
            c.material.color = new THREE.Color(randomColor);
            if (c.material.emissive) c.material.emissive = new THREE.Color(randomColor).multiplyScalar(0.3);
          }
        });
      }
      closeOrbitalMenu();
      return { action: 'tint', success: true };

    default:
      closeOrbitalMenu();
      return { action: actionId, success: true };
  }
}

/**
 * Updates the orbital ring billboard orientation towards the camera each frame
 */
export function updateOrbitalMenu(camera) {
  if (orbitalGroup && isOpen && camera) {
    orbitalGroup.quaternion.copy(camera.quaternion);
  }
}

export function isOrbitalMenuOpen() {
  return isOpen;
}

export function getOrbitalTarget() {
  return currentTarget;
}
