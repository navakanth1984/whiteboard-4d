// v2/src/agent/copilot.js — Autonomous In-World AI Spatial Copilot & Voice Directive Engine
// Voice pipeline (priority order):
//   1. Gemini Live Audio (MediaRecorder blob → Cloud Run proxy → structured action)
//      Credit consumed: GenAI App Builder (₹94,804 remaining, expires 2027-04-26)
//   2. Browser SpeechRecognition → interpretNL() → Gemini text API → local fallback
//   3. Pure local executeDirective() regex (always available, credit-free)
import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { objects, links, register } from '../core/history.js';
import { createLink } from '../graph/links.js';
import { interpretNL, interpretAudioNL } from './interpret.js';

let copilotGroup = null;
let coreMesh = null;
let ringMesh = null;
let scanBeam = null;
let isHovering = true;
let flightTarget = new THREE.Vector3(0, 3, 0);
let speechRecognizer = null;
let isListening = false;

/**
 * Initializes the In-World AI Copilot Drone and Voice Directive Engine
 */
export function initCopilotSystem() {
  createCopilotDrone();
  initVoiceRecognition();
  initCopilotUI();
}

function createCopilotDrone() {
  const { scene } = getSceneState();
  if (!scene) return;

  copilotGroup = new THREE.Group();
  copilotGroup.name = 'BleuuCopilotDrone';
  copilotGroup.position.set(0, 3.5, 2);

  // 1. Central Plasma Energy Core
  const coreGeo = new THREE.SphereGeometry(0.22, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  copilotGroup.add(coreMesh);

  // 2. Orbital Gyroscopic Rings
  const ringGeo = new THREE.TorusGeometry(0.35, 0.02, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
  ringMesh = new THREE.Mesh(ringGeo, ringMat);
  copilotGroup.add(ringMesh);

  // 3. Scanning Laser Hologram Cone
  const coneGeo = new THREE.ConeGeometry(0.8, 2.5, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  scanBeam = new THREE.Mesh(coneGeo, coneMat);
  scanBeam.position.set(0, -1.25, 0);
  copilotGroup.add(scanBeam);

  scene.add(copilotGroup);
}

/**
 * Updates Copilot Hover Kinematics & Ring Rotations (called per animation frame)
 */
export function updateCopilot(time, dt) {
  if (!copilotGroup) return;

  // Gyroscopic Ring Rotations
  if (ringMesh) {
    ringMesh.rotation.x += dt * 1.5;
    ringMesh.rotation.y += dt * 2.0;
  }

  if (coreMesh) {
    const pulse = 1.0 + Math.sin(time * 4) * 0.15;
    coreMesh.scale.setScalar(pulse);
  }

  // Smooth Hover & Flight Physics
  const hoverY = flightTarget.y + Math.sin(time * 2.5) * 0.18;
  const targetPos = new THREE.Vector3(flightTarget.x, hoverY, flightTarget.z);
  copilotGroup.position.lerp(targetPos, 0.05);
}

/**
 * Executes high-level spatial AI directives on the 3D canvas
 */
export function executeDirective(directiveText) {
  const text = (directiveText || '').toLowerCase().trim();
  const hud = document.getElementById('copilot-speech-status');
  if (hud) hud.textContent = `AI: "${directiveText}"`;

  if (text.includes('circle') || text.includes('radial') || text.includes('orbit')) {
    arrangeInCircle();
    flyTo(0, 4, 0);
    return 'Arranged objects in 3D circle.';
  } else if (text.includes('grid') || text.includes('matrix')) {
    arrangeInGrid();
    flyTo(0, 4, 0);
    return 'Arranged objects in 3D grid.';
  } else if (text.includes('line') || text.includes('align') || text.includes('clean')) {
    arrangeInLine();
    flyTo(0, 3.5, 0);
    return 'Cleaned up and aligned objects.';
  } else if (text.includes('connect') || text.includes('link')) {
    connectClosestNodes();
    flyTo(0, 4, 0);
    return 'Connected closest spatial nodes.';
  } else if (text.includes('inspect') || text.includes('tour')) {
    startInspectionTour();
    return 'Starting 3D spatial inspection tour.';
  } else {
    // Default: fly toward user avatar or center
    flyTo((Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4);
    return 'Command recognized by Copilot.';
  }
}

export function flyTo(x, y, z) {
  flightTarget.set(x, y, z);
}

function arrangeInCircle() {
  const activeObjs = objects.filter(o => o.root && o.root.visible);
  if (activeObjs.length === 0) return;
  const radius = Math.max(3, activeObjs.length * 0.8);
  const step = (Math.PI * 2) / activeObjs.length;

  activeObjs.forEach((obj, idx) => {
    const angle = idx * step;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    obj.root.position.set(x, 1.5, z);
    obj.root.lookAt(0, 1.5, 0);
  });
}

function arrangeInGrid() {
  const activeObjs = objects.filter(o => o.root && o.root.visible);
  if (activeObjs.length === 0) return;
  const cols = Math.ceil(Math.sqrt(activeObjs.length));
  const spacing = 3.2;

  activeObjs.forEach((obj, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = (col - cols / 2) * spacing;
    const y = 1.5 + (row * spacing * 0.6);
    const z = -2.0;
    obj.root.position.set(x, y, z);
    obj.root.rotation.set(0, 0, 0);
  });
}

function arrangeInLine() {
  const activeObjs = objects.filter(o => o.root && o.root.visible);
  if (activeObjs.length === 0) return;
  const spacing = 3.0;
  const startX = -((activeObjs.length - 1) * spacing) / 2;

  activeObjs.forEach((obj, idx) => {
    obj.root.position.set(startX + idx * spacing, 1.5, -2);
    obj.root.rotation.set(0, 0, 0);
  });
}

function connectClosestNodes() {
  const activeObjs = objects.filter(o => o.root && o.root.visible);
  if (activeObjs.length < 2) return;

  for (let i = 0; i < activeObjs.length - 1; i++) {
    createLink(activeObjs[i], activeObjs[i + 1]);
  }
}

function startInspectionTour() {
  const activeObjs = objects.filter(o => o.root && o.root.visible);
  if (activeObjs.length === 0) {
    flyTo(0, 5, 5);
    return;
  }
  let currentIdx = 0;
  const tourInterval = setInterval(() => {
    if (currentIdx >= activeObjs.length) {
      clearInterval(tourInterval);
      flyTo(0, 3.5, 0);
      return;
    }
    const pos = activeObjs[currentIdx].root.position;
    flyTo(pos.x, pos.y + 1.2, pos.z + 1.5);
    currentIdx++;
  }, 1800);
}

/**
 * Voice pipeline — Gemini Live Audio primary, browser SpeechRecognition fallback.
 *
 * Gemini path (preferred, online):
 *   MediaRecorder captures mic audio → on silence/utterance-end → audio blob sent to
 *   Cloud Run proxy /live-audio → Gemini 2.0 Flash transcribes + returns spatial action
 *   → executeGeminiAction() applies it to the Three.js scene.
 *
 * Browser fallback (offline or proxy unreachable):
 *   SpeechRecognition transcript → interpretNL() (Gemini text API or local regex)
 *   → executeDirective() / executeGeminiAction().
 */

let mediaRecorder = null;
let audioChunks = [];
let silenceTimer = null;
const SILENCE_MS = 1200; // send after 1.2 s of silence

function initVoiceRecognition() {
  // ── Gemini Live Audio path (primary) ──────────────────────────────────────
  if (navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream, { mimeType: _bestMime() });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) audioChunks.push(e.data);
        // Reset silence timer on each chunk
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => _flushAudioToGemini(), SILENCE_MS);
      };

      mediaRecorder.onerror = (err) => {
        console.warn('[copilot] MediaRecorder error, switching to SpeechRecognition:', err);
        _initSpeechRecognitionFallback();
      };
    }).catch(() => _initSpeechRecognitionFallback());
  } else {
    _initSpeechRecognitionFallback();
  }

  // ── Browser SpeechRecognition fallback ────────────────────────────────────
  _initSpeechRecognitionFallback();
}

async function _flushAudioToGemini() {
  if (!audioChunks.length) return;
  const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
  audioChunks = [];

  const hud = document.getElementById('copilot-speech-status');
  if (hud) hud.textContent = '🔮 Gemini thinking…';

  const action = await interpretAudioNL(blob);
  if (action) {
    executeGeminiAction(action);
  } else {
    // Audio path gave nothing — handled by SpeechRecognition path running in parallel
    if (hud) hud.textContent = 'Say a command…';
  }
}

function _initSpeechRecognitionFallback() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || speechRecognizer) return;

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = false;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onresult = async (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    const hud = document.getElementById('copilot-speech-status');
    if (hud) hud.textContent = `🎤 "${transcript}"`;

    // Try Gemini text API first, then local fallback
    const action = await interpretNL(transcript, { fallbackFn: executeDirective });
    if (action && action._source !== 'local') {
      executeGeminiAction(action);
    }
    // If _source === 'local', executeDirective already ran inside interpretNL fallback
  };

  speechRecognizer.onerror = (err) => {
    console.warn('[copilot] SpeechRecognition error:', err);
    stopVoiceControl();
  };
}

/**
 * Execute a structured Gemini spatial action on the Three.js scene.
 * Handles the actions the Gemini proxy can return.
 */
function executeGeminiAction(action) {
  const hud = document.getElementById('copilot-speech-status');
  if (hud) hud.textContent = `AI: ${action.utterance_understood || action.action}`;

  switch (action.action) {
    case 'navigate':
      if (action.target === 'camera') flyTo(0, 3.5, 5);
      else _flyToNamed(action.target);
      break;
    case 'move':    _moveNamed(action.target, action.params); break;
    case 'circle':
    case 'arrange': arrangeInCircle(); flyTo(0, 4, 0); break;
    case 'grid':    arrangeInGrid();   flyTo(0, 4, 0); break;
    case 'line':    arrangeInLine();   flyTo(0, 3.5, 0); break;
    case 'link':    connectClosestNodes(); break;
    case 'search': {
      // Highlight matching objects returned by Gemini
      const matches = action.params?.matches || [];
      matches.forEach(m => _highlightNamed(m.name));
      break;
    }
    default:
      // Unknown structured action — fall back to old regex path
      executeDirective(action.utterance_understood || action.action);
  }
}

function _flyToNamed(name) {
  if (!name) return;
  const obj = objects.find(o =>
    (o.userData?.label || o.name || '').toLowerCase().includes(name.toLowerCase())
  );
  if (obj?.root) flyTo(obj.root.position.x, obj.root.position.y + 2, obj.root.position.z + 3);
  else flyTo(0, 3.5, 5);
}

function _moveNamed(name, params = {}) {
  const obj = objects.find(o =>
    (o.userData?.label || o.name || '').toLowerCase().includes((name || '').toLowerCase())
  );
  if (!obj?.root) return;
  const dir = (params.direction || 'up').toLowerCase();
  const amt = params.amount || 1;
  if (dir === 'left')  obj.root.position.x -= amt;
  if (dir === 'right') obj.root.position.x += amt;
  if (dir === 'up')    obj.root.position.y += amt;
  if (dir === 'down')  obj.root.position.y -= amt;
  if (dir === 'forward' || dir === 'closer') obj.root.position.z -= amt;
  if (dir === 'back'  || dir === 'farther') obj.root.position.z += amt;
}

function _highlightNamed(name) {
  const obj = objects.find(o =>
    (o.userData?.label || o.name || '').toLowerCase().includes((name || '').toLowerCase())
  );
  if (obj?.root) {
    const orig = obj.root.position.clone();
    obj.root.position.y += 0.4;
    setTimeout(() => obj.root.position.copy(orig), 600);
  }
}

function _bestMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}


export function startVoiceControl() {
  if (isListening) return;
  isListening = true;
  updateVoiceUI();
  // Start MediaRecorder (Gemini path)
  if (mediaRecorder && mediaRecorder.state === 'inactive') {
    audioChunks = [];
    mediaRecorder.start(250); // 250 ms timeslices → ondataavailable fires frequently
  }
  // Start browser SpeechRecognition (fallback path, runs in parallel)
  try { if (speechRecognizer) speechRecognizer.start(); } catch (_) {}
}

export function stopVoiceControl() {
  if (!isListening) return;
  isListening = false;
  updateVoiceUI();
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  try { if (speechRecognizer) speechRecognizer.stop(); } catch (_) {}
  clearTimeout(silenceTimer);
}

function updateVoiceUI() {
  const dot = document.getElementById('copilot-status-dot');
  const lbl = document.getElementById('copilot-voice-lbl');
  if (dot) dot.style.background = isListening ? '#22c55e' : '#64748b';
  if (lbl) lbl.textContent = isListening ? 'LISTENING...' : 'COPILOT';
}

function initCopilotUI() {
  const btn = document.getElementById('btn-copilot');
  if (btn) {
    btn.addEventListener('click', () => {
      if (!isListening) startVoiceControl();
      else stopVoiceControl();
    });
  }
}

export const initCopilot = initCopilotSystem;
export const toggleCopilot = () => (!isListening ? startVoiceControl() : stopVoiceControl());

