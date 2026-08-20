// v2/src/agent/interpret.js — Spatial Awareness System (SASCore & SASCard)
// + Gemini 2.0 Flash NL interpreter (online) with local regex fallback (offline)
//
// Credit consumed: GenAI App Builder (₹94,804 remaining, expires 2027-04-26)
// when interpretNL() / interpretAudioNL() are called online.
import * as THREE from 'three';
import { objects } from '../core/history.js';
import { getSceneState } from '../core/scene.js';
import { interpretWithGemini, interpretAudioWithGemini, buildSceneSnapshot } from './vertex_search.js';

// ── Gemini upgrade wrapper ────────────────────────────────────────────────────
// Call this from voice_commands.js instead of local regex parsing.
// Tries Gemini first (online), falls back to local function on error/timeout.
export async function interpretNL(utterance, { fallbackFn } = {}) {
  const { camera } = getSceneState();
  buildSceneSnapshot(objects, camera);           // refresh snapshot before every call

  const geminiResult = await interpretWithGemini(utterance);
  if (geminiResult && geminiResult.action && geminiResult.action !== 'unknown') {
    console.info(`[interpret] Gemini → ${geminiResult.action}:${geminiResult.target} (confidence ${(geminiResult.confidence || 0).toFixed(2)})`);
    return geminiResult;
  }

  // Offline fallback — pass the local parser function from the caller
  if (typeof fallbackFn === 'function') {
    const local = fallbackFn(utterance);
    if (local) {
      console.info('[interpret] local fallback →', local.action || 'unknown');
      return { ...local, _source: 'local' };
    }
  }
  return null;
}

// Audio path: Gemini Live Audio transcription + action, from MediaRecorder blob
export async function interpretAudioNL(audioBlob) {
  const { camera } = getSceneState();
  buildSceneSnapshot(objects, camera);

  const geminiResult = await interpretAudioWithGemini(audioBlob);
  if (geminiResult && geminiResult.action && geminiResult.action !== 'unknown') {
    console.info(`[interpret] Gemini Audio → ${geminiResult.action} ("${geminiResult.utterance_understood}")`);
    return geminiResult;
  }
  return null;
}

export const SASCore = (() => {
  const GROUNDED = new Set(['block', 'shape', 'model', 'icon', 'card', 'board', 'splat']);
  const memory = new Map(); // objectId -> frame
  const modifiers = { shift: false, ctrl: false };
  const log = []; // telemetry ring buffer

  function interpret(o) {
    if (!o) return null;
    const { camera, controls } = getSceneState();
    const dir = new THREE.Vector3();
    if (camera) camera.getWorldDirection(dir);
    const pitch = Math.abs(dir.y);
    const camDist = camera && controls ? camera.position.distanceTo(controls.target) : 0;

    // Manual modifier overrides
    if (modifiers.shift) {
      return {
        intent: 'Following Screen',
        frame: 'screen',
        override: true,
        remembered: false,
        decisionData: {
          event: 'drag-decision',
          cameraPitch: pitch,
          cameraDistance: camDist,
          groundScore: 0,
          screenScore: 100,
          selectedFrame: 'screen',
          confidence: 1.0,
          override: true,
          userCorrected: true,
          correctionType: 'shift_override',
          reasons: ['shift_modifier_held']
        }
      };
    }

    if (modifiers.ctrl) {
      return {
        intent: 'Moving on Floor',
        frame: 'ground',
        override: true,
        remembered: false,
        decisionData: {
          event: 'drag-decision',
          cameraPitch: pitch,
          cameraDistance: camDist,
          groundScore: 100,
          screenScore: 0,
          selectedFrame: 'ground',
          confidence: 1.0,
          override: true,
          userCorrected: true,
          correctionType: 'ctrl_override',
          reasons: ['ctrl_modifier_held']
        }
      };
    }

    if (memory.has(o.id)) {
      const f = memory.get(o.id);
      return {
        intent: f === 'ground' ? 'Moving on Floor' : 'Following Screen',
        frame: f,
        override: false,
        remembered: true,
        decisionData: {
          event: 'drag-decision',
          cameraPitch: pitch,
          cameraDistance: camDist,
          groundScore: f === 'ground' ? 80 : 0,
          screenScore: f === 'screen' ? 80 : 0,
          selectedFrame: f,
          confidence: 0.8,
          override: false,
          userCorrected: false,
          remembered: true,
          reasons: ['object_memory_retrieval']
        }
      };
    }

    // Weighted scoring model
    const isGrounded = GROUNDED.has(o.type);
    let groundScore = 0;
    let screenScore = 0;
    const activeReasons = [];

    if (isGrounded) {
      groundScore += 10;
      activeReasons.push('grounded_object');
    } else {
      screenScore += 40;
      activeReasons.push('floating_object');
    }

    if (pitch >= 0.75) {
      groundScore += 60;
      activeReasons.push('camera_topdown');
    } else {
      screenScore += 50;
      activeReasons.push('camera_perspective');
    }

    const selectedFrame = groundScore >= screenScore ? 'ground' : 'screen';
    const confidence = Math.abs(groundScore - screenScore) / Math.max(1, groundScore, screenScore);

    return {
      intent: selectedFrame === 'ground' ? 'Moving on Floor' : 'Following Screen',
      frame: selectedFrame,
      override: false,
      remembered: false,
      decisionData: {
        event: 'drag-decision',
        cameraPitch: pitch,
        cameraDistance: camDist,
        groundScore,
        screenScore,
        selectedFrame,
        confidence,
        override: false,
        userCorrected: false,
        reasons: activeReasons
      }
    };
  }

  function remember(o, frame) {
    if (!o || !o.id) return false;
    if (memory.get(o.id) === frame) return false;
    memory.set(o.id, frame);
    return true;
  }

  function record(evt) {
    const { camera } = getSceneState();
    const camDir = new THREE.Vector3();
    if (camera) camera.getWorldDirection(camDir);
    log.push({
      t: Date.now(),
      camPos: camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
      camDir: { x: camDir.x, y: camDir.y, z: camDir.z },
      ...evt
    });
    if (log.length > 1000) log.shift();
  }

  return { interpret, remember, record, modifiers, log };
})();

export const SASCard = (() => {
  let lastIntent = '';

  function semanticRelationship(p, ref, label) {
    const dx = p.x - ref.x;
    const dy = p.y - ref.y;
    const dz = p.z - ref.z;
    const dist = p.distanceTo(ref);
    if (dist < 0.8) return `<span class="sas-ref">Right next to ${label}</span>`;

    let rel = '';
    if (Math.abs(dy) > 1.5) {
      rel = `${Math.abs(dy).toFixed(1)}m ${dy > 0 ? 'Above' : 'Below'} ${label}`;
    } else if (Math.abs(dx) > Math.abs(dz)) {
      rel = `${Math.abs(dx).toFixed(1)}m ${dx > 0 ? 'Right of' : 'Left of'} ${label}`;
    } else {
      rel = `${Math.abs(dz).toFixed(1)}m ${dz > 0 ? 'In front of' : 'Behind'} ${label}`;
    }
    return `<span class="sas-ref">${rel}</span>`;
  }

  function nearestRef(o) {
    let best = null;
    let bd = 1e9;
    if (!o || !o.root) return null;
    for (const q of objects) {
      if (q === o || !q.root) continue;
      const d = q.root.position.distanceTo(o.root.position);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return (best && bd < 16) ? best : null;
  }

  function render(interp, o) {
    const el = document.getElementById('sas-card');
    if (!el || !interp || !o || !o.root) return;

    const ref = nearestRef(o);
    let html = `<div class="sas-intent${interp.intent !== lastIntent ? ' flip' : ''}">${interp.intent}</div>`;

    const refLabel = ref ? (ref.label || ref.type) : 'Workspace Center';
    const refPos = ref ? ref.root.position : new THREE.Vector3(0, 0.5, 0);

    html += `<div class="sas-dim">Relation</div><div>${semanticRelationship(o.root.position, refPos, refLabel)}</div>`;

    const p = o.root.position;
    if ([p.x, p.z].some(v => Math.abs(v - Math.round(v)) < 0.08)) {
      html += `<div class="sas-snap">⌗ on the 1 u grid</div>`;
    }
    if (interp.override) html += `<div class="sas-badge">Manual Override</div>`;
    if (interp.remembered) html += `<div class="sas-badge mem">Remembered</div>`;

    el.innerHTML = html;
    el.classList.add('show');
    lastIntent = interp.intent;
  }

  function hover(o) {
    const el = document.getElementById('sas-card');
    if (!el || !o) return;
    el.innerHTML = `<div class="sas-intent${'Hover' !== lastIntent ? ' flip' : ''}"><span class="sas-ref">${o.label || o.type}</span></div>`;
    el.classList.add('show');
    lastIntent = 'Hover';
  }

  function depth() {
    const el = document.getElementById('sas-card');
    if (!el) return;
    el.innerHTML = `<div class="sas-intent flip">Moving Closer / Farther</div><div class="sas-dim">Scroll to adjust depth</div>`;
    el.classList.add('show');
    lastIntent = 'Depth';
  }

  function note(msg) {
    const el = document.getElementById('sas-card');
    if (!el) return;
    el.innerHTML = `<div class="sas-intent flip">Remembered</div><div>${msg}</div>`;
    el.classList.add('show');
    lastIntent = 'Note';
    clearTimeout(el._t);
    el._t = setTimeout(hide, 2200);
  }

  function pulse() {
    const el = document.getElementById('sas-card');
    if (!el) return;
    el.classList.remove('snap-pulse');
    void el.offsetWidth;
    el.classList.add('snap-pulse');
  }

  function hide() {
    const el = document.getElementById('sas-card');
    if (!el) return;
    el.classList.remove('show');
    lastIntent = '';
  }

  return { render, hover, depth, note, pulse, hide };
})();

export function getLegoSnapPosition(pos, targetObj) {
  if (!targetObj || !targetObj.root) return null;
  let bestPos = null;
  let minDistance = 2.5; // snap distance threshold

  const boxTarget = new THREE.Box3().setFromObject(targetObj.root);
  const sizeTarget = new THREE.Vector3();
  boxTarget.getSize(sizeTarget);
  if (sizeTarget.lengthSq() < 0.01) {
    sizeTarget.set(1, 1, 1);
  }

  for (const other of objects) {
    if (other.id === targetObj.id) continue;
    if (!other.root) continue;

    const boxOther = new THREE.Box3().setFromObject(other.root);
    const sizeOther = new THREE.Vector3();
    boxOther.getSize(sizeOther);
    if (sizeOther.lengthSq() < 0.01) {
      sizeOther.set(1, 1, 1);
    }
    const centerOther = new THREE.Vector3();
    boxOther.getCenter(centerOther);

    const candidates = [
      { pos: new THREE.Vector3(centerOther.x, boxOther.max.y + sizeTarget.y / 2, centerOther.z), label: 'Top' },
      { pos: new THREE.Vector3(centerOther.x, boxOther.min.y - sizeTarget.y / 2, centerOther.z), label: 'Bottom' },
      { pos: new THREE.Vector3(boxOther.max.x + sizeTarget.x / 2, centerOther.y, centerOther.z), label: 'Right' },
      { pos: new THREE.Vector3(boxOther.min.x - sizeTarget.x / 2, centerOther.y, centerOther.z), label: 'Left' },
      { pos: new THREE.Vector3(centerOther.x, centerOther.y, boxOther.max.z + sizeTarget.z / 2), label: 'Front' },
      { pos: new THREE.Vector3(centerOther.x, centerOther.y, boxOther.min.z - sizeTarget.z / 2), label: 'Back' }
    ];

    for (const c of candidates) {
      const dist = pos.distanceTo(c.pos);
      if (dist < minDistance) {
        minDistance = dist;
        bestPos = c.pos.clone();
      }
    }
  }
  return bestPos;
}

export function setMovePlaneFor(frame, pos, plane) {
  const { camera } = getSceneState();
  if (!plane) return;
  if (frame === 'ground') {
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), pos);
  } else {
    const n = new THREE.Vector3();
    if (camera) camera.getWorldDirection(n);
    plane.setFromNormalAndCoplanarPoint(n, pos);
  }
}

export function initInterpretSystem() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') SASCore.modifiers.shift = true;
    if (e.key === 'Control') SASCore.modifiers.ctrl = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') SASCore.modifiers.shift = false;
    if (e.key === 'Control') SASCore.modifiers.ctrl = false;
  });
}
