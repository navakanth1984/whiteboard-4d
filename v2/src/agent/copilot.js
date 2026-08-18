// v2/src/agent/copilot.js — Autonomous In-World AI Spatial Copilot & Voice Directive Engine
import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { objects, links, register } from '../core/history.js';
import { createLink } from '../graph/links.js';

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
 * Speech Recognition Integration (Web Speech API)
 */
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = false;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    executeDirective(transcript);
  };

  speechRecognizer.onerror = (err) => {
    console.warn('Voice Recognition Error:', err);
    stopVoiceControl();
  };
}

export function startVoiceControl() {
  if (!speechRecognizer || isListening) return;
  try {
    speechRecognizer.start();
    isListening = true;
    updateVoiceUI();
  } catch (err) {
    console.error(err);
  }
}

export function stopVoiceControl() {
  if (!speechRecognizer || !isListening) return;
  speechRecognizer.stop();
  isListening = false;
  updateVoiceUI();
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
