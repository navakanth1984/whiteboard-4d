// v2/src/agent/voice_commands.js — Continuous Web Speech Voice Assistant for BleuBoard v2
import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { setMode, getCurrentMode } from '../ui/modes.js';
import { addSpatialCard, CARD_PRESETS, setCurCard } from '../objects/models.js';
import { addIconNode, ICON_CATEGORIES } from '../objects/stickers.js';
import { addMiniBoard } from '../objects/board.js';
import { addSplatObject } from '../objects/splat.js';
import { addText3D } from '../objects/text.js';
import { selectObject, deselectObject, selectedObject, setGizmoMode } from '../nav/transform.js';
import { clearAllObjects, undo, redo, removeObj, objects } from '../core/history.js';
import { setPOVMode, resetNavigation, povMode } from '../nav/gamer_nav.js';
import { startRecording, stopRecording, isRecording } from '../capture/record.js';
import { showGuide } from '../ui/guide.js';
import { syncBodyTransform } from '../physics/rapier_engine.js';

let recognition = null;
let isListening = false;
let autoRestart = true;
let voiceHudTimeout = null;

export function initVoiceCommandsSystem() {
  exposeDiagnostics();
  const btn = document.getElementById('btn-voice-control');
  if (!btn) return;

  btn.addEventListener('click', () => {
    toggleVoiceRecognition();
  });

  setupSpeechRecognition();
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported in this browser environment.');
    return;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      if (result && result[0]) {
        const transcript = result[0].transcript.trim();
        if (transcript) {
          parseAndExecuteVoiceCommand(transcript);
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Voice Recognition Error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        autoRestart = false;
        updateVoiceButtonUI(false, 'MIC DENIED');
      }
    };

    recognition.onend = () => {
      if (isListening && autoRestart) {
        try {
          recognition.start();
        } catch (e) {}
      } else {
        updateVoiceButtonUI(false);
      }
    };
  } catch (err) {
    console.warn('SpeechRecognition initialization error:', err);
  }
}

export function startVoiceRecognition() {
  if (!recognition) setupSpeechRecognition();
  if (!recognition) {
    showVoiceHUD('Voice Not Supported', 'Web Speech API unavailable in this browser');
    return;
  }

  try {
    autoRestart = true;
    recognition.start();
    isListening = true;
    updateVoiceButtonUI(true);
    showVoiceHUD('Listening...', 'Say "create card", "move left", "orbit view", etc.');
  } catch (err) {
    if (err.name === 'InvalidStateError') {
      isListening = true;
      updateVoiceButtonUI(true);
    } else {
      console.error('Failed to start voice recognition:', err);
    }
  }
}

export function stopVoiceRecognition() {
  autoRestart = false;
  isListening = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }
  updateVoiceButtonUI(false);
  showVoiceHUD('Voice Paused', 'Microphone standby');
}

export function toggleVoiceRecognition() {
  if (isListening) {
    stopVoiceRecognition();
  } else {
    startVoiceRecognition();
  }
}

function updateVoiceButtonUI(active, errorMsg) {
  const btn = document.getElementById('btn-voice-control');
  const dot = document.getElementById('voice-status-dot');
  const lbl = document.getElementById('voice-status-lbl');

  if (btn) {
    btn.classList.toggle('active', active);
  }
  if (dot) {
    dot.style.background = active ? '#22c55e' : (errorMsg ? '#ef4444' : '#64748b');
  }
  if (lbl) {
    lbl.textContent = active ? 'VOICE ON' : (errorMsg || 'VOICE');
  }
}

export function parseAndExecuteVoiceCommand(raw) {
  const text = raw.toLowerCase().trim();
  let actionTaken = null;
  const { camera } = getSceneState();

  // 1. CARDS: "create card [name]" / "add card [name]"
  if (text.includes('card')) {
    let presetKey = 'gateway';
    if (text.includes('vector') || text.includes('database')) presetKey = 'vector';
    else if (text.includes('agent') || text.includes('llm')) presetKey = 'agent';
    else if (text.includes('stream') || text.includes('pipeline')) presetKey = 'stream';
    else if (text.includes('auth') || text.includes('identity')) presetKey = 'auth';
    else if (text.includes('telemetry') || text.includes('analytics')) presetKey = 'analytics';

    setCurCard(presetKey);
    const pos = getSpawnPosition();
    const o = addSpatialCard(presetKey, { point: pos, normal: new THREE.Vector3(0, 0, 1) });
    setMode('nav');
    if (o) selectObject(o);
    actionTaken = `Created Card: ${o ? o.label : presetKey}`;
  }

  // 2. NODES: "create node [name]" / "add node [name]"
  else if (text.includes('node') || text.includes('icon') || text.includes('cloud')) {
    let item = { label: 'Snowflake', icon: '❄️', hex: '#38bdf8', category: 'cloud', brand: 'Snowflake' };
    if (text.includes('aws') || text.includes('amazon')) item = { label: 'AWS', icon: '☁️', hex: '#ff9900', category: 'cloud', brand: 'AWS' };
    else if (text.includes('azure') || text.includes('microsoft')) item = { label: 'Azure', icon: '🔷', hex: '#0089d6', category: 'cloud', brand: 'Azure' };
    else if (text.includes('gcp') || text.includes('google')) item = { label: 'Google Cloud', icon: '🌐', hex: '#4285f4', category: 'cloud', brand: 'GCP' };
    else if (text.includes('docker')) item = { label: 'Docker', icon: '🐳', hex: '#2496ed', category: 'devops', brand: 'Docker' };
    else if (text.includes('kubernetes') || text.includes('k8s')) item = { label: 'Kubernetes', icon: '☸️', hex: '#326ce5', category: 'devops', brand: 'Kubernetes' };
    else if (text.includes('databricks')) item = { label: 'Databricks', icon: '🧱', hex: '#ff3621', category: 'data', brand: 'Databricks' };

    const pos = getSpawnPosition();
    const o = addIconNode(item, { point: pos, normal: new THREE.Vector3(0, 0, 1) });
    setMode('nav');
    if (o) selectObject(o);
    actionTaken = `Created Node: ${item.label}`;
  }

  // 3. BOARDS: "create board" / "add whiteboard"
  else if (text.includes('board') || text.includes('whiteboard')) {
    const pos = getSpawnPosition();
    const o = addMiniBoard({ styleKey: 'cyber-dark', position: pos });
    setMode('nav');
    if (o) selectObject(o);
    actionTaken = 'Created Whiteboard';
  }

  // 4. SPLAT: "butterfly" / "splat" / "gaussian"
  else if (text.includes('butterfly') || text.includes('splat') || text.includes('morpho')) {
    const pos = getSpawnPosition();
    const o = addSplatObject({ presetKey: 'morpho', surf: { point: pos, normal: new THREE.Vector3(0, 1, 0) } });
    setMode('nav');
    if (o) selectObject(o);
    actionTaken = 'Loaded 3D Gaussian Splat';
  }

  // 5. 3D TEXT: "write [text]" / "text [text]"
  else if (text.startsWith('write ') || text.startsWith('text ')) {
    const content = raw.replace(/^(write|text)\s+/i, '').trim();
    if (content) {
      const pos = getSpawnPosition();
      const o = addText3D(content, pos, '#00ccff');
      setMode('nav');
      if (o) selectObject(o);
      actionTaken = `Created 3D Text: "${content}"`;
    }
  }

  // 6. OBJECT MANIPULATION: "move left / right / up / down"
  else if (text.includes('move') || text.includes('shift') || text.includes('slide')) {
    if (selectedObject && selectedObject.root) {
      const step = 2.0;
      if (text.includes('left')) selectedObject.root.position.x -= step;
      else if (text.includes('right')) selectedObject.root.position.x += step;
      else if (text.includes('up')) selectedObject.root.position.y += step;
      else if (text.includes('down')) selectedObject.root.position.y = Math.max(0.2, selectedObject.root.position.y - step);
      else if (text.includes('forward') || text.includes('closer')) selectedObject.root.position.z += step;
      else if (text.includes('back') || text.includes('farther')) selectedObject.root.position.z -= step;
      selectedObject.root.updateMatrixWorld(true);
      syncBodyTransform(selectedObject.id, selectedObject.root.position, selectedObject.root.quaternion);
      actionTaken = `Moved Object ${text.includes('left') ? 'Left' : text.includes('right') ? 'Right' : text.includes('up') ? 'Up' : text.includes('down') ? 'Down' : 'in 3D'}`;
    } else {
      actionTaken = 'Select an object first to move';
    }
  }

  // 7. SCALE: "scale up" / "scale down" / "bigger" / "smaller"
  else if (text.includes('scale') || text.includes('bigger') || text.includes('smaller') || text.includes('enlarge') || text.includes('shrink')) {
    if (selectedObject && selectedObject.root) {
      const factor = (text.includes('bigger') || text.includes('up') || text.includes('enlarge')) ? 1.25 : 0.8;
      selectedObject.root.scale.multiplyScalar(factor);
      selectedObject.root.updateMatrixWorld(true);
      syncBodyTransform(selectedObject.id, selectedObject.root.position, selectedObject.root.quaternion);
      actionTaken = `Scaled Object: ${factor > 1 ? '+25%' : '-20%'}`;
    } else {
      actionTaken = 'Select an object first to scale';
    }
  }

  // 8. ROTATE: "rotate" / "spin" / "turn"
  else if (text.includes('rotate') || text.includes('spin') || text.includes('turn')) {
    if (selectedObject && selectedObject.root) {
      selectedObject.root.rotation.y += Math.PI / 4;
      selectedObject.root.updateMatrixWorld(true);
      syncBodyTransform(selectedObject.id, selectedObject.root.position, selectedObject.root.quaternion);
      actionTaken = 'Rotated Object 45°';
    } else {
      actionTaken = 'Select an object first to rotate';
    }
  }

  // 9. DELETE / REMOVE: "delete" / "remove" / "erase"
  else if (text.includes('delete') || text.includes('remove') || text.includes('trash') || text.includes('erase')) {
    if (selectedObject) {
      const lbl = selectedObject.label || selectedObject.type;
      removeObj(selectedObject);
      deselectObject();
      actionTaken = `Deleted: ${lbl}`;
    } else {
      actionTaken = 'No object selected to delete';
    }
  }

  // 10. CLEAR SCENE: "clear all" / "clear canvas" / "reset canvas"
  else if (text.includes('clear all') || text.includes('clear canvas') || text.includes('clean scene') || text.includes('delete all')) {
    clearAllObjects();
    actionTaken = 'Cleared All Objects';
  }

  // 11. UNDO / REDO
  else if (text.includes('undo')) {
    undo();
    actionTaken = 'Undo Last Action';
  } else if (text.includes('redo')) {
    redo();
    actionTaken = 'Redo Action';
  }

  // 12. CAMERA & NAVIGATION POVs
  else if (text.includes('orbit')) {
    setPOVMode('orbit');
    actionTaken = 'Switched to Orbit Camera';
  } else if (text.includes('first person') || text.includes('fps')) {
    setPOVMode('fps');
    actionTaken = 'Switched to FPS Camera';
  } else if (text.includes('third person') || text.includes('tps') || text.includes('avatar view')) {
    setPOVMode('tps');
    actionTaken = 'Switched to TPS Camera';
  } else if (text.includes('reset camera') || text.includes('reset view') || text.includes('re-center') || text.includes('home view')) {
    resetNavigation();
    actionTaken = 'Reset Camera & Avatar View';
  }

  // 13. MODE SWITCHING
  else if (text.includes('draw') || text.includes('ink') || text.includes('pen')) {
    setMode('draw');
    actionTaken = 'Draw Mode Active';
  } else if (text.includes('navigation') || text.includes('nav mode') || text.includes('select mode')) {
    setMode('nav');
    actionTaken = 'NAV Mode Active';
  } else if (text.includes('connect') || text.includes('link') || text.includes('flow')) {
    setMode('connect');
    actionTaken = 'Connect Flow Mode Active';
  }

  // 14. PRESENTATION & RECORDING
  else if (text.includes('presentation') || text.includes('record') || text.includes('screen share')) {
    if (!isRecording) {
      startRecording();
      actionTaken = 'Started Presentation Recording';
    } else {
      stopRecording();
      actionTaken = 'Stopped Presentation Recording';
    }
  }

  // 15. GUIDE / MANUAL
  else if (text.includes('guide') || text.includes('help') || text.includes('manual') || text.includes('tutorial')) {
    showGuide();
    actionTaken = 'Opened 6-Chapter Studio Guide';
  }

  else {
    actionTaken = `Unrecognized: "${raw}" (Say "help" for commands)`;
  }

  showVoiceHUD(raw, actionTaken);
  return { raw, actionTaken };
}

function getSpawnPosition() {
  const { camera } = getSceneState();
  if (camera) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const spawnPos = camera.position.clone().addScaledVector(forward, 6.0);
    spawnPos.y = Math.max(1.0, Math.min(20.0, spawnPos.y));
    return spawnPos;
  }
  return new THREE.Vector3(0, 2.5, -4);
}

export function showVoiceHUD(transcript, actionFeedback) {
  let hud = document.getElementById('voice-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'voice-hud';
    document.body.appendChild(hud);
  }

  hud.innerHTML = `
    <div class="vh-header">
      <span class="vh-mic-icon">🎙️</span>
      <span class="vh-heard">"${transcript}"</span>
    </div>
    <div class="vh-action">${actionFeedback}</div>
  `;

  hud.classList.add('show');

  if (voiceHudTimeout) clearTimeout(voiceHudTimeout);
  voiceHudTimeout = setTimeout(() => {
    hud.classList.remove('show');
  }, 3500);
}

export function isVoiceActive() {
  return isListening;
}

function exposeDiagnostics() {
  if (typeof window !== 'undefined') {
    window.__voiceCommandsProbe = {
      isListening: () => isListening,
      execute: parseAndExecuteVoiceCommand,
      start: startVoiceRecognition,
      stop: stopVoiceRecognition,
      toggle: toggleVoiceRecognition
    };
  }
}
