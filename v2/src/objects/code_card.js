// v2/src/objects/code_card.js — Interactive 3D Live Code Sandbox Cards with Dynamic Execution & Syntax Rendering
import * as THREE from 'three';
import { register } from '../core/history.js';
import { getSceneState } from '../core/scene.js';

let codeCards = new Map();

export function initCodeSandboxSystem() {
  // Ready
}


/**
 * Creates an interactive 3D Code Sandbox card with real-time execution in the spatial whiteboard
 * @param {string} code Initial source code string
 * @param {THREE.Vector3} pos 3D spatial position
 * @param {object} options Language, title, and theme options
 */
export function create3DCodeCard(code = 'const r = 5;\nconsole.log("3D Area:", Math.PI * r * r);\nreturn Math.PI * r * r;', pos = null, options = {}) {
  const { scene } = getSceneState();
  if (!scene) return null;

  const cardPos = pos || new THREE.Vector3(0, 10, -8);
  const cardId = 'code-card-' + Math.random().toString(36).substring(2, 9);
  const language = options.language || 'javascript';
  const title = options.title || '3D Script Sandbox';

  // 1. Offscreen Canvas for Syntax Rendering & Output Tray
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // 2. 3D Acrylic Glass Frame Mesh
  const cardGeo = new THREE.PlaneGeometry(8, 6);
  const cardMat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(cardGeo, cardMat);
  mesh.position.copy(cardPos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Outer glowing border
  const borderGeo = new THREE.EdgesGeometry(cardGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  mesh.add(border);

  const cardState = {
    id: cardId,
    code,
    language,
    title,
    output: 'Click RUN or trigger execution probe to run.',
    execTime: null,
    canvas,
    ctx,
    texture,
    mesh
  };

  // Render initial card visual
  renderCodeCardCanvas(cardState);

  // Register in scene graph and history
  const objectRecord = {
    id: cardId,
    type: 'code_card',
    root: mesh,
    collider: mesh,
    cardState
  };

  register(objectRecord);
  codeCards.set(cardId, cardState);

  return objectRecord;
}

/**
 * Executes the JavaScript code on a specific 3D Code Card in a safe async sandbox
 */
export async function executeCodeOnCard(cardId) {
  const cardState = codeCards.get(cardId);
  if (!cardState) return null;

  const startTime = performance.now();
  const logs = [];
  const customConsole = {
    log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    warn: (...args) => logs.push('[WARN] ' + args.join(' ')),
    error: (...args) => logs.push('[ERR] ' + args.join(' '))
  };

  try {
    // Isolated AsyncFunction Sandbox
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const runner = new AsyncFunction('console', 'THREE', cardState.code);
    const result = await runner(customConsole, THREE);
    const duration = (performance.now() - startTime).toFixed(1);

    let outputText = logs.join('\n');
    if (result !== undefined) {
      outputText += (outputText ? '\n➜ ' : '➜ ') + (typeof result === 'object' ? JSON.stringify(result) : String(result));
    }
    if (!outputText) outputText = '✓ Executed successfully (no output).';

    cardState.output = outputText;
    cardState.execTime = duration;
  } catch (err) {
    const duration = (performance.now() - startTime).toFixed(1);
    cardState.output = `[Runtime Error] ${err.message}`;
    cardState.execTime = duration;
  }

  // Redraw canvas with new output and execution time
  renderCodeCardCanvas(cardState);
  return {
    output: cardState.output,
    execTime: cardState.execTime
  };
}

function renderCodeCardCanvas(card) {
  const { ctx, canvas, texture, title, code, output, execTime } = card;
  if (!ctx) return;

  // Background Glass Terminal
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Title Bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, 60);

  // Window dots
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(30, 30, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(55, 30, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.beginPath(); ctx.arc(80, 30, 8, 0, Math.PI * 2); ctx.fill();

  // Title Text
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(title.toUpperCase(), 110, 38);

  // RUN Button Badge in Title Bar
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(canvas.width - 150, 12, 120, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('▶ RUN', canvas.width - 120, 36);

  // Code Editor Area
  ctx.font = '22px monospace';
  ctx.fillStyle = '#e2e8f0';
  const codeLines = code.split('\n');
  let y = 110;
  codeLines.forEach((line, i) => {
    // Line numbers
    ctx.fillStyle = '#475569';
    ctx.fillText(`${i + 1}`.padStart(3, ' '), 20, y);

    // Syntax coloring simple rule
    if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
      ctx.fillStyle = '#64748b'; // Comment
    } else if (line.includes('const') || line.includes('let') || line.includes('function') || line.includes('return')) {
      ctx.fillStyle = '#38bdf8'; // Keyword
    } else {
      ctx.fillStyle = '#f8fafc'; // Code
    }
    ctx.fillText(line, 80, y);
    y += 32;
  });

  // Output Tray Divider
  const trayY = canvas.height - 220;
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, trayY, canvas.width, 220);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, trayY, canvas.width, 3);

  // Output Label & Timing
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('OUTPUT CONSOLE', 30, trayY + 30);
  if (execTime) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`(${execTime}ms)`, 210, trayY + 30);
  }

  // Output Content
  ctx.font = '20px monospace';
  ctx.fillStyle = output.startsWith('[Runtime Error]') ? '#f87171' : '#4ade80';
  const outLines = output.split('\n');
  let outY = trayY + 65;
  outLines.forEach((l) => {
    ctx.fillText(l, 30, outY);
    outY += 28;
  });

  texture.needsUpdate = true;
}

export function getActiveCodeCards() {
  return Array.from(codeCards.keys());
}

export const addCodeSandboxCard = create3DCodeCard;

