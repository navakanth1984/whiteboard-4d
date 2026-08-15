import * as THREE from 'three';
import { initScene, updateDust, updateTesseract, render, controls, fill, ambient, scene } from './core/scene.js';
import { setMouse, getHit, hitToPos, hitToFree, hitToSurface, rayPlane, setupPointerEvents } from './core/input.js';
import { register, undoLast, redoLast, updateUndoRedoBtns, objects, undoStack, redoStack } from './core/history.js';
import {
  initStrokeSystem,
  beginStroke,
  addStrokePoint,
  updateLive,
  endStroke,
  setBrushStyle,
  setInkColor,
  drawing,
  drawPts
} from './draw/strokes.js';
import {
  initTextSystem,
  showTextInput,
  addText3D,
  addCursiveText3D,
  addTextRing
} from './objects/text.js';
import {
  SHAPES,
  curShape,
  setCurShape,
  addShape,
  addBlock
} from './objects/shapes.js';
import {
  ICON_CATEGORIES,
  curIconCat,
  curIconKey,
  setIconCategory,
  setCurIconIndex,
  STICKERS,
  curSticker,
  setCurSticker,
  addSticker,
  addIconNode
} from './objects/stickers.js';

// Boot scene & render loop
const canvasEl = document.getElementById('c');
initScene(canvasEl);
initStrokeSystem();
initTextSystem();

// Populate Shapes in Palette
function buildShapePalette() {
  const pal = document.getElementById('palette');
  const tabs = document.getElementById('pal-tabs');
  const grid = document.getElementById('pal-grid');
  const title = document.getElementById('pal-title');
  if (!grid || !title || !tabs) return;

  tabs.style.display = 'none';
  title.textContent = '3D Solids & 2D Shapes';
  grid.innerHTML = '';

  Object.keys(SHAPES).forEach(key => {
    const item = SHAPES[key];
    const b = document.createElement('div');
    b.className = 'pal-item' + (key === curShape ? ' sel' : '');
    b.innerHTML = `<span class="material-symbols-outlined">${item.icon}</span><span class="pal-lbl">${item.label}</span>`;
    b.title = item.label;
    b.addEventListener('click', () => {
      setCurShape(key);
      grid.querySelectorAll('.pal-item').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    });
    grid.appendChild(b);
  });
}

// Populate Stickers in Palette
function buildStickerPalette() {
  const pal = document.getElementById('palette');
  const tabs = document.getElementById('pal-tabs');
  const grid = document.getElementById('pal-grid');
  const title = document.getElementById('pal-title');
  if (!grid || !title || !tabs) return;

  tabs.style.display = 'none';
  title.textContent = 'Emoji & Nature Stickers';
  grid.innerHTML = '';

  STICKERS.forEach(s => {
    const b = document.createElement('div');
    b.className = 'pal-item' + (s === curSticker ? ' sel' : '');
    b.style.fontSize = '22px';
    b.textContent = s;
    b.addEventListener('click', () => {
      setCurSticker(s);
      grid.querySelectorAll('.pal-item').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    });
    grid.appendChild(b);
  });
}

// Populate Official Architecture Nodes in Palette with Category Tabs
function buildIconPalette() {
  const pal = document.getElementById('palette');
  const tabs = document.getElementById('pal-tabs');
  const grid = document.getElementById('pal-grid');
  const title = document.getElementById('pal-title');
  if (!grid || !title || !tabs) return;

  tabs.style.display = 'flex';
  tabs.innerHTML = '';
  title.textContent = 'Tech & AI Architecture Nodes';

  Object.keys(ICON_CATEGORIES).forEach(cat => {
    const tabBtn = document.createElement('button');
    tabBtn.className = 'pal-tab' + (cat === curIconCat ? ' active' : '');
    tabBtn.textContent = cat;
    tabBtn.addEventListener('click', () => {
      setIconCategory(cat);
      tabs.querySelectorAll('.pal-tab').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
      renderIconGrid();
    });
    tabs.appendChild(tabBtn);
  });

  function renderIconGrid() {
    grid.innerHTML = '';
    const items = ICON_CATEGORIES[curIconCat] || [];
    items.forEach((item, idx) => {
      const b = document.createElement('div');
      b.className = 'pal-item' + (idx === curIconKey ? ' sel' : '');
      b.innerHTML = `<img src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${item.slug}.svg" style="width:20px;height:20px;filter:invert(1);" alt="${item.label}"><span class="pal-lbl">${item.label}</span>`;
      b.title = item.label;
      b.addEventListener('click', () => {
        setCurIconIndex(idx);
        grid.querySelectorAll('.pal-item').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
      });
      grid.appendChild(b);
    });
  }

  renderIconGrid();
}

// Mode state
export let currentMode = 'nav';
export function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('#bottombar .tb').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const bp = document.getElementById('brush-picker');
  if (bp) {
    bp.classList.toggle('show', mode === 'draw');
  }
  const pal = document.getElementById('palette');
  if (pal) {
    const isPaletteMode = (mode === 'shape' || mode === 'sticker' || mode === 'icon');
    pal.classList.toggle('show', isPaletteMode);
    if (mode === 'shape') buildShapePalette();
    else if (mode === 'sticker') buildStickerPalette();
    else if (mode === 'icon') buildIconPalette();
  }
  if (controls) {
    controls.enabled = (mode === 'nav');
  }
}

// Connect Bottombar mode buttons
document.querySelectorAll('#bottombar .tb').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode) setMode(mode);
  });
});

// Connect Brush Picker buttons
document.querySelectorAll('#brush-picker .bp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#brush-picker .bp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const brush = btn.dataset.brush;
    if (brush) setBrushStyle(brush);
  });
});

// Connect Ink Color Picker
const pickInk = document.getElementById('pick-ink');
if (pickInk) {
  pickInk.addEventListener('input', (e) => {
    setInkColor(e.target.value);
  });
}

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

window.__drawProbe = {
  beginStroke,
  addStrokePoint,
  endStroke,
  setMode,
  setBrushStyle,
  getDrawing: () => drawing,
  getDrawPts: () => drawPts
};

window.__shapeProbe = {
  SHAPES,
  curShape: () => curShape,
  setCurShape,
  addShape,
  addBlock
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
    const ink = document.getElementById('pick-ink')?.value || '#00ccff';

    if (currentMode === 'draw') {
      beginStroke(cx, cy);
    } else if (currentMode === 'shape') {
      const surf = hitToSurface(cx, cy);
      if (surf) addShape(curShape, surf, ink);
    } else if (currentMode === 'sticker') {
      const surf = hitToSurface(cx, cy);
      if (surf) addSticker(curSticker, surf, ink);
    } else if (currentMode === 'icon') {
      const surf = hitToSurface(cx, cy);
      const items = ICON_CATEGORIES[curIconCat] || [];
      const item = items[curIconKey] || items[0];
      if (surf && item) addIconNode(item, surf, ink);
    } else if (currentMode === 'block') {
      const hit = getHit(cx, cy);
      const pos = hitToPos(hit);
      if (pos) addBlock(pos.x, pos.y, pos.z, ink);
    } else if (currentMode === 'text') {
      const hit = getHit(cx, cy);
      const free = hitToFree(hit);
      showTextInput(cx, cy, free || new THREE.Vector3(0, 11, -9));
    } else if (currentMode === 'nav') {
      const hit = getHit(cx, cy);
      window.__inputProbe.lastHit = hit ? { point: hit.point, name: hit.object.name } : null;
      window.__inputProbe.hitCount++;
    }
  },
  onMove: (cx, cy) => {
    setMouse(cx, cy);
    if (currentMode === 'draw' && drawing) {
      addStrokePoint(cx, cy);
    }
  },
  onUp: () => {
    if (currentMode === 'draw') {
      endStroke();
    }
  }
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
  updateLive();

  // Tick object billboard and spin rotations
  objects.forEach(o => {
    if (o.root.userData.billboardY && camera) {
      const dx = camera.position.x - o.root.position.x;
      const dz = camera.position.z - o.root.position.z;
      o.root.rotation.y = Math.atan2(dx, dz);
    }
    if (o.root.userData.spin && o.root.children[0]) {
      o.root.children[0].rotation.y += 0.01;
      o.root.children[0].rotation.x += 0.004;
    }
  });

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
