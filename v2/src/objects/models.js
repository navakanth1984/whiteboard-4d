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
  const W = 512;
  const H = 280;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // Background Glassmorphic Rounded Surface
  const r = 24;
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

  // Dark slate gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(10, 20, 42, 0.94)');
  grad.addColorStop(1, 'rgba(4, 9, 22, 0.97)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer border with preset accent glow
  ctx.lineWidth = 4;
  ctx.strokeStyle = preset.hex || ink;
  ctx.stroke();

  // Tag Badge pill
  ctx.fillStyle = preset.hex || ink;
  ctx.beginPath();
  ctx.roundRect(32, 28, 120, 28, 14);
  ctx.fill();

  ctx.font = '700 12px "Roboto Mono", monospace';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.fillText(preset.tag.toUpperCase(), 32 + 60, 47);

  // Card Title
  ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(preset.label, 32, 105);

  // Separator Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 130);
  ctx.lineTo(W - 32, 130);
  ctx.stroke();

  // Metadata Description
  ctx.font = '400 14px "Roboto Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(preset.desc, 32, 175);

  // Status Indicator Dot
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(42, 225, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('ACTIVE TELEMETRY NODE', 58, 229);

  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function addSpatialCard(key, surf, ink = '#38bdf8') {
  const preset = CARD_PRESETS.find(c => c.id === key) || CARD_PRESETS[0];
  const tex = createCardTexture(preset, ink);
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true
    })
  );
  sp.scale.set(5.2, 2.8, 1);

  const root = new THREE.Group();
  root.add(sp);

  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, 1.4);

  const o = register(root, 'card', preset.label, preset.hex || ink);
  o.sprite = sp;
  o.preset = preset;
  return o;
}
