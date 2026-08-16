import * as THREE from 'three';
import { initScene, updateDust, updateTesseract, render, getSceneState, camera, controls, fill, ambient, scene } from './core/scene.js';
import { setMouse, getHit, hitToPos, hitToFree, hitToSurface, rayPlane, setupPointerEvents } from './core/input.js';
import { register, undoLast, redoLast, updateUndoRedoBtns, objects, links, undoStack, redoStack } from './core/history.js';
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
  getActiveIconItem,
  setIconCategory,
  setCurIconIndex,
  STICKERS,
  curSticker,
  setCurSticker,
  addSticker,
  addIconNode
} from './objects/stickers.js';

import {
  CARD_PRESETS,
  curCard,
  setCurCard,
  addSpatialCard
} from './objects/models.js';

import {
  BOARD_STYLES,
  curBoardStyle,
  setCurBoardStyle,
  addMiniBoard
} from './objects/board.js';

import {
  addImagePanel,
  addVideoPanel,
  addSpatialAudio,
  addLiveScreenShare
} from './objects/media.js';

import {
  createLink,
  tickLinks,
  refreshLinks,
  setFlowMotion,
  flowMotionEnabled
} from './graph/links.js';

import {
  serializeSession,
  loadSessionData,
  saveSessionToDownload
} from './session/persist.js';

import {
  startRecording,
  stopRecording
} from './capture/record.js';

import {
  initAuraSystem,
  tickAuras
} from './fx/aura.js';

import {
  initAvatarSystem,
  avatarConfig,
  performAvatarAction,
  GENDERS,
  setAvatarConfig
} from './nav/character.js';

import {
  initGamerNav,
  updateGamerNav,
  setPOVMode,
  focusOnObject,
  povMode,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp
} from './nav/gamer_nav.js';

import {
  initTransformSystem,
  selectObject,
  deselectObject,
  selectedObject,
  transformControl
} from './nav/transform.js';

import {
  initAvatarPickerUI,
  updatePOVUI
} from './ui/avatar_picker.js';

import {
  initHUDSystem,
  updateHUD
} from './ui/hud.js';

// Boot scene & render loop
const canvasEl = document.getElementById('c');
initScene(canvasEl);
initStrokeSystem();
initTextSystem();
initAuraSystem();
initAvatarSystem();
initGamerNav();
initTransformSystem();
initAvatarPickerUI();
initHUDSystem();

// Populate Spatial Cards in Palette
function buildCardPalette() {
  const pal = document.getElementById('palette');
  const tabs = document.getElementById('pal-tabs');
  const grid = document.getElementById('pal-grid');
  const title = document.getElementById('pal-title');
  if (!grid || !title || !tabs) return;

  tabs.style.display = 'none';
  title.textContent = 'Spatial Architecture & Telemetry Cards';
  grid.innerHTML = '';

  CARD_PRESETS.forEach(item => {
    const b = document.createElement('div');
    b.className = 'pal-item' + (item.id === curCard ? ' sel' : '');
    b.innerHTML = `<span class="material-symbols-outlined">${item.icon}</span><span class="pal-lbl">${item.label}</span>`;
    b.title = item.label;
    b.addEventListener('click', () => {
      setCurCard(item.id);
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

// Populate Mini Lecture Boards in Palette
function buildBoardPalette() {
  const pal = document.getElementById('palette');
  const tabs = document.getElementById('pal-tabs');
  const grid = document.getElementById('pal-grid');
  const title = document.getElementById('pal-title');
  if (!grid || !title || !tabs) return;

  tabs.style.display = 'none';
  title.textContent = '3D Lecture & Classroom Boards';
  grid.innerHTML = '';

  Object.keys(BOARD_STYLES).forEach(key => {
    const item = BOARD_STYLES[key];
    const b = document.createElement('div');
    b.className = 'pal-item' + (key === curBoardStyle ? ' sel' : '');
    const icon = key === 'chalkboard' ? 'edit_note' : (key === 'glassboard' ? 'blur_on' : 'co_present');
    b.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span class="pal-lbl">${item.label}</span>`;
    b.title = item.desc;
    b.addEventListener('click', () => {
      setCurBoardStyle(key);
      grid.querySelectorAll('.pal-item').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    });
    grid.appendChild(b);
  });
}

// Mode state
export let currentMode = 'nav';
window.__currentMode = 'nav';

export function setMode(mode) {
  currentMode = mode;
  window.__currentMode = mode;
  document.querySelectorAll('#bottombar .tb').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const bp = document.getElementById('brush-picker');
  if (bp) {
    bp.classList.toggle('show', mode === 'draw');
  }
  const pal = document.getElementById('palette');
  if (pal) {
    const isPaletteMode = (mode === 'card' || mode === 'icon' || mode === 'board');
    pal.classList.toggle('show', isPaletteMode);
    if (mode === 'card') buildCardPalette();
    else if (mode === 'icon') buildIconPalette();
    else if (mode === 'board') buildBoardPalette();
  }
  const { controls: liveControls } = getSceneState();
  if (liveControls) {
    liveControls.enabled = (mode === 'nav' && povMode === 'orbit');
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
  links,
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

window.__sceneProbe = {
  get camera() { return getSceneState().camera; },
  get controls() { return getSceneState().controls; },
  get scene() { return getSceneState().scene; },
  get composer() { return getSceneState().composer; },
  get renderer() { return getSceneState().renderer; }
};

window.__mediaProbe = {
  addImagePanel,
  addVideoPanel,
  addSpatialAudio,
  addLiveScreenShare,
  serializeSession,
  loadSessionData,
  saveSessionToDownload,
  createLink
};

window.__boardProbe = {
  addMiniBoard,
  BOARD_STYLES,
  curBoardStyle,
  setCurBoardStyle
};

window.__stickersProbe = {
  addIconNode,
  ICON_CATEGORIES,
  getActiveIconItem
};

window.__modelsProbe = {
  addSpatialCard,
  CARD_PRESETS
};

window.__transformProbe = {
  selectObject,
  deselectObject,
  get transformControl() { return transformControl; },
  get selectedObject() { return selectedObject; }
};

const btnWindow = document.getElementById('btn-window');
if (btnWindow) {
  btnWindow.addEventListener('click', () => {
    const ink = document.getElementById('pick-ink')?.value || '#00ccff';
    addLiveScreenShare(ink);
  });
}

const btnExport = document.getElementById('btn-export');
if (btnExport) {
  btnExport.addEventListener('click', () => {
    saveSessionToDownload('bleuboard-session');
  });
}

const btnImport = document.getElementById('btn-import');
const importInput = document.getElementById('import-input');
if (btnImport && importInput) {
  btnImport.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        loadSessionData(data);
      } catch (err) {
        console.error('Failed to parse session json:', err);
      }
    };
    reader.readAsText(file);
  });
}

const recStartBtn = document.getElementById('rec-start');
if (recStartBtn) {
  recStartBtn.addEventListener('click', () => {
    const withMic = document.getElementById('rec-mic')?.checked !== false;
    const withCam = document.getElementById('rec-cam')?.checked === true;
    startRecording(withMic, withCam);
  });
}

let pendingLinkSource = null;

setupPointerEvents({
  onDown: (cx, cy) => {
    const ink = document.getElementById('pick-ink')?.value || '#00ccff';

    if (currentMode === 'draw') {
      if (avatarConfig.executionMode === 'avatar') {
        const surf = hitToSurface(cx, cy);
        if (surf) performAvatarAction('draw', surf.point, () => {}, 0.1);
      }
      beginStroke(cx, cy);
    } else if (currentMode === 'card') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        performAvatarAction('place', surf.point, () => {
          const o = addSpatialCard(curCard, surf, ink);
          selectObject(o);
        });
      }
    } else if (currentMode === 'board') {
      const surf = hitToSurface(cx, cy);
      const pos = surf ? surf.point.clone().add(new THREE.Vector3(0, 2.5, 0)) : new THREE.Vector3(0, 4.5, -5);
      performAvatarAction('place', pos, () => {
        const o = addMiniBoard({ styleKey: curBoardStyle, position: pos, colorHex: ink });
        if (o) selectObject(o);
      });
    } else if (currentMode === 'icon') {
      const surf = hitToSurface(cx, cy);
      const item = getActiveIconItem();
      if (surf && item) {
        performAvatarAction('place', surf.point, () => {
          const o = addIconNode(item, surf, ink);
          selectObject(o);
        });
      }
    } else if (currentMode === 'connect') {
      const { camera } = getSceneState();
      setMouse(cx, cy);
      ray.setFromCamera(m2, camera);
      const roots = objects.map(o => o.root);
      const hits = ray.intersectObjects(roots, true);
      if (hits.length > 0) {
        let cur = hits[0].object;
        let clickedObj = null;
        while (cur && !clickedObj) {
          clickedObj = objects.find(o => o.root === cur || o.collider === cur);
          cur = cur.parent;
        }
        if (clickedObj) {
          if (!pendingLinkSource) {
            pendingLinkSource = clickedObj;
            selectObject(clickedObj);
          } else if (pendingLinkSource !== clickedObj) {
            performAvatarAction('link', clickedObj.root.position, () => {
              createLink(pendingLinkSource, clickedObj, ink);
              pendingLinkSource = null;
            });
          }
        }
      }
    } else if (currentMode === 'image') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = e => {
          const file = e.target.files[0];
          if (file) {
            performAvatarAction('place', surf.point, () => {
              const o = addImagePanel(URL.createObjectURL(file), surf.point, ink);
              if (o) selectObject(o);
            });
          }
        };
        inp.click();
      }
    } else if (currentMode === 'video') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'video/*';
        inp.onchange = e => {
          const file = e.target.files[0];
          if (file) {
            performAvatarAction('place', surf.point, () => {
              addVideoPanel(URL.createObjectURL(file), surf.point, ink);
            });
          }
        };
        inp.click();
      }
    } else if (currentMode === 'audio') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'audio/*';
        inp.onchange = e => {
          const file = e.target.files[0];
          if (file) {
            performAvatarAction('place', surf.point, () => {
              addSpatialAudio(URL.createObjectURL(file), surf, ink);
            });
          }
        };
        inp.click();
      }
    } else if (currentMode === 'text') {
      const hit = getHit(cx, cy);
      const free = hitToFree(hit);
      showTextInput(cx, cy, free || new THREE.Vector3(0, 11, -9));
    } else if (currentMode === 'nav') {
      handlePointerDown(e || { clientX: cx, clientY: cy, button: 0 });
      const { camera } = getSceneState();
      setMouse(cx, cy);
      ray.setFromCamera(m2, camera);
      const roots = objects.map(o => o.root).filter(Boolean);
      const hits = ray.intersectObjects(roots, true);
      if (hits.length > 0) {
        let hitObj = hits[0].object;
        let clickedObj = objects.find(o => {
          if (!o.root) return false;
          if (o.root === hitObj || o.collider === hitObj) return true;
          let found = false;
          o.root.traverse(child => {
            if (child === hitObj) found = true;
          });
          return found;
        });

        if (clickedObj) {
          selectObject(clickedObj);
        }
      } else {
        if (!transformControl || !transformControl.dragging) {
          deselectObject();
        }
      }
    }
  },
  onMove: (cx, cy, e) => {
    setMouse(cx, cy);
    if (currentMode === 'nav') {
      handlePointerMove(e || { clientX: cx, clientY: cy });
    }
    if (currentMode === 'draw' && drawing) {
      addStrokePoint(cx, cy);
    }
  },
  onUp: (cx, cy, e) => {
    if (currentMode === 'nav') {
      handlePointerUp();
    }
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

  if (controls && povMode === 'orbit') controls.update();
  updateGamerNav(dt);
  updateHUD(currentMode);
  updateDust(dt);
  updateLive();
  tickLinks(dt);
  refreshLinks();
  tickAuras(t);

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
