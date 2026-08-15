import * as THREE from 'three';
import { initScene, updateDust, updateTesseract, render, controls, fill, ambient } from './core/scene.js';

// Boot scene & render loop
const canvasEl = document.getElementById('c');
initScene(canvasEl);

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
