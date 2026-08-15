import * as THREE from 'three';
import { initScene, updateDust, updateTesseract, render, controls, fill, ambient, scene } from './core/scene.js';
import { setMouse, getHit, hitToPos, hitToFree, hitToSurface, rayPlane, setupPointerEvents } from './core/input.js';
import { register, undoLast, redoLast, updateUndoRedoBtns, objects, undoStack, redoStack } from './core/history.js';

// Boot scene & render loop
const canvasEl = document.getElementById('c');
initScene(canvasEl);

// Connect UI Undo / Redo buttons
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
if (btnUndo) btnUndo.addEventListener('click', () => undoLast());
if (btnRedo) btnRedo.addEventListener('click', () => redoLast());
updateUndoRedoBtns();

// Wire input handlers & test diagnostic probe
window.__historyProbe = {
  register,
  undoLast,
  redoLast,
  objects,
  undoStack,
  redoStack
};

window.__inputProbe = {
  lastHit: null,
  hitCount: 0,
  getHit,
  hitToPos,
  hitToFree,
  hitToSurface,
  rayPlane
};

setupPointerEvents({
  onDown: (cx, cy) => {
    const hit = getHit(cx, cy);
    window.__inputProbe.lastHit = hit ? { point: hit.point, name: hit.object.name } : null;
    window.__inputProbe.hitCount++;
  },
  onMove: (cx, cy) => {
    setMouse(cx, cy);
  },
  onUp: () => {}
});


const clock = new THREE.Clock();
let elapsed = 0;

// FPS Measurement Probe for QA / RENDER_CHECK Gate
window.__fpsStats = {
  frames: 0,
  lastTime: performance.now(),
  currentFps: 60,
  history: []
};

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  elapsed += dt;
  const t = elapsed;

  // FPS tracking
  const now = performance.now();
  window.__fpsStats.frames++;
  if (now - window.__fpsStats.lastTime >= 1000) {
    window.__fpsStats.currentFps = (window.__fpsStats.frames * 1000) / (now - window.__fpsStats.lastTime);
    window.__fpsStats.history.push(window.__fpsStats.currentFps);
    if (window.__fpsStats.history.length > 30) window.__fpsStats.history.shift();
    window.__fpsStats.frames = 0;
    window.__fpsStats.lastTime = now;
  }

  if (controls) controls.update();
  updateDust(dt);
  updateTesseract(t);

  if (fill) {
    fill.intensity = 1.1 + Math.sin(t * 0.85) * 0.3;
    fill.position.x = Math.sin(t * 0.28) * 12;
    fill.position.z = Math.cos(t * 0.28) * 12;
  }
  if (ambient) {
    ambient.intensity = 2.4 + Math.sin(t * 0.5) * 0.4;
  }

  render();
}

animate();
