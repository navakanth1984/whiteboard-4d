import * as THREE from 'three';
import { scene } from '../core/scene.js';

let auraGroup = null;

export function initAuraSystem() {
  auraGroup = new THREE.Group();
  if (scene) scene.add(auraGroup);
}

export function createObjectAura(objRoot, colorHex = '#38bdf8') {
  const col = new THREE.Color(colorHex);
  const ringGeo = new THREE.RingGeometry(2.5, 3.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: col,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  objRoot.add(ring);
  return ring;
}

export function tickAuras(time) {
  if (!auraGroup) return;
  // Pulsing animation
  const s = 1.0 + Math.sin(time * 2.5) * 0.08;
  auraGroup.children.forEach(c => {
    c.scale.set(s, s, s);
  });
}
