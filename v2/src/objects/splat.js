// v2/src/objects/splat.js — 3D Gaussian Splat Integration via Spark & SPZ
import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { register } from '../core/history.js';
import { placeTargets, getSceneState } from '../core/scene.js';
import { getDeviceBudget } from '../core/device_tier.js';

let sparkRenderer = null;

export const SPLAT_PRESETS = [
  {
    id: 'butterfly',
    label: 'Morpho Butterfly',
    tag: 'SPZ Splat',
    url: 'assets/splats/butterfly.spz',
    desc: 'Photorealistic 3D Gaussian Splat (Niantic .spz)',
    hex: '#38bdf8'
  }
];

export let curSplat = 'butterfly';

export function setCurSplat(key) {
  const p = SPLAT_PRESETS.find(s => s.id === key);
  if (p) curSplat = key;
}

export function initSparkRenderer() {
  const { scene, renderer } = getSceneState();
  if (!scene || !renderer) return null;
  if (!sparkRenderer) {
    sparkRenderer = new SparkRenderer({ renderer });
    scene.add(sparkRenderer);
  }
  return sparkRenderer;
}

export function getSparkRenderer() {
  return sparkRenderer;
}

export function addSplatObject(options = {}) {
  const { scene } = getSceneState();
  if (!scene) return null;

  initSparkRenderer();

  const preset = SPLAT_PRESETS.find(s => s.id === options.presetKey) || SPLAT_PRESETS[0];
  const splatUrl = options.url || preset.url;
  const label = options.label || preset.label;
  const ink = options.ink || preset.hex || '#38bdf8';
  const surf = options.surf || { point: new THREE.Vector3(0, 1, 0), normal: new THREE.Vector3(0, 1, 0) };

  const root = new THREE.Group();

  // 1. Spark SplatMesh (Gaussian Splat point cloud)
  const splatMesh = new SplatMesh({ url: splatUrl });
  root.add(splatMesh);

  // 2. Interactive Bounding Collider for Raycast Selection & Gizmo
  const colGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const colMat = new THREE.MeshBasicMaterial({ visible: false });
  const collider = new THREE.Mesh(colGeo, colMat);
  root.add(collider);

  // 3. Subtle Holographic Base Ring indicator
  const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(ink),
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = -1.18;
  root.add(ringMesh);

  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, 1.2);

  const o = register(root, 'splat', label, ink);
  o.splatMesh = splatMesh;
  o.collider = collider;
  o.preset = preset;
  placeTargets.push(collider);

  return o;
}

export function loadSplatFile(file, surf, ink = '#38bdf8') {
  if (!file) return null;

  const budget = getDeviceBudget();
  const maxBytes = budget.maxSplatSizeMB * 1024 * 1024;
  if (file.size && file.size > maxBytes) {
    console.warn(`[DeviceTier] Splat asset ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds ${budget.tier} tier limit of ${budget.maxSplatSizeMB}MB.`);
    alert(`File is too large for ${budget.tier} performance (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed: ${budget.maxSplatSizeMB}MB.`);
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  const cleanName = file.name.replace(/\.[^/.]+$/, '');
  return addSplatObject({
    url: objectUrl,
    label: cleanName || 'Custom Splat',
    surf,
    ink
  });
}
