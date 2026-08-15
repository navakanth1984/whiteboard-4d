import * as THREE from 'three';
import { register } from '../core/history.js';
import { placeTargets } from '../core/scene.js';

export const CARD_PRESETS = [
  { id: 'gateway',   icon: 'dns',                 label: 'API Gateway',     tag: 'Microservice', desc: 'Latency: 18ms · RPS: 4.2k · TLS 1.3',  hex: '#38bdf8' },
  { id: 'vector',    icon: 'scatter_plot',        label: 'Vector Database', tag: 'Storage',      desc: 'HNSW Index · 1536 dims · Qdrant Cluster', hex: '#a855f7' },
  { id: 'agent',     icon: 'smart_toy',           label: 'LLM Agent Core',  tag: 'Inference',    desc: 'Model: Claude 3.5 · Temp: 0.2 · ReAct', hex: '#f43f5e' },
  { id: 'stream',    icon: 'stream',              label: 'Realtime Stream', tag: 'Pipeline',     desc: 'Throughput: 140MB/s · Lag: 0.01s',    hex: '#10b981' },
  { id: 'auth',      icon: 'lock',                label: 'Auth & Identity', tag: 'Security',     desc: 'OAuth2 / OIDC · JWT Claims · RBAC',    hex: '#f59e0b' },
  { id: 'analytics', icon: 'query_stats',         label: 'Telemetry Engine',tag: 'Observability',desc: 'Prometheus · OpenTelemetry · Grafana', hex: '#ec4899' }
];

export let curCard = 'gateway';
export function setCurCard(key) {
  const p = CARD_PRESETS.find(c => c.id === key);
  if (p) curCard = key;
}

export function createCardTexture(preset, ink = '#38bdf8') {
  const W = 1024;
  const H = 560;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // Background Glassmorphic Rounded Surface
  const r = 48;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.arcTo(W, 0, W, r, r);
  ctx.lineTo(W, H - r);
  ctx.arcTo(W, H, W - r, H, r);
  ctx.lineTo(r, H);
  ctx.arcTo(0, H, 0, H - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();

  // Obsidian glass gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#040d21');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer border with preset accent glow
  ctx.lineWidth = 8;
  ctx.strokeStyle = preset.hex || ink;
  ctx.stroke();

  // Tag Badge pill
  ctx.fillStyle = preset.hex || ink;
  ctx.beginPath();
  ctx.roundRect(64, 56, 240, 56, 28);
  ctx.fill();

  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(preset.tag.toUpperCase(), 64 + 120, 56 + 28);

  // Card Title
  ctx.font = '800 48px "Syne", "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(preset.label, 64, 210);

  // Separator Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 260);
  ctx.lineTo(W - 64, 260);
  ctx.stroke();

  // Metadata Description
  ctx.font = '600 28px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(preset.desc, 64, 350);

  // Status Indicator Dot
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(84, 450, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '700 26px "Outfit", sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('ACTIVE TELEMETRY NODE', 116, 458);

  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

export function addSpatialCard(key, surf, ink = '#38bdf8') {
  const preset = CARD_PRESETS.find(c => c.id === key) || CARD_PRESETS[0];
  const tex = createCardTexture(preset, ink);

  // 1. Front Glass Face with High-DPI Texture
  const faceMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.FrontSide
  });
  const faceGeo = new THREE.PlaneGeometry(5.2, 2.8);
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = 0.08;

  // 2. Physical 3D Translucent Glass Slab Body
  const slabCol = new THREE.Color(preset.hex || ink);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x050d24,
    emissive: slabCol.clone().multiplyScalar(0.25),
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.92
  });
  const slabGeo = new THREE.BoxGeometry(5.3, 2.9, 0.15);
  const slabMesh = new THREE.Mesh(slabGeo, slabMat);
  slabMesh.castShadow = true;
  slabMesh.receiveShadow = true;

  // 3. Glowing Neon Accent Frame Wire
  const edgeGeo = new THREE.EdgesGeometry(slabGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: slabCol,
    transparent: true,
    opacity: 0.8
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);

  const root = new THREE.Group();
  root.add(slabMesh);
  root.add(faceMesh);
  root.add(edgeLines);

  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, 1.4);
  root.userData.billboardY = true;

  const o = register(root, 'card', preset.label, preset.hex || ink);
  o.preset = preset;
  o.collider = slabMesh;
  placeTargets.push(slabMesh);
  return o;
}
