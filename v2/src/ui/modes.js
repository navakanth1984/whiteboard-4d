// v2/src/ui/modes.js — Mode Selector, Palette Builders & Mode State Management
import { getSceneState } from '../core/scene.js';
import { CARD_PRESETS, curCard, setCurCard } from '../objects/models.js';
import { STICKERS, curSticker, setCurSticker, ICON_CATEGORIES, curIconCat, curIconKey, setIconCategory, setCurIconIndex } from '../objects/stickers.js';
import { BOARD_STYLES, curBoardStyle, setCurBoardStyle } from '../objects/board.js';
import { setBrushStyle, setInkColor } from '../draw/strokes.js';
import { povMode } from '../nav/gamer_nav.js';

export let currentMode = 'nav';
if (typeof window !== 'undefined') {
  window.__currentMode = 'nav';
}

// Populate Spatial Cards in Palette
export function buildCardPalette() {
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
export function buildStickerPalette() {
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
export function buildIconPalette() {
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
export function buildBoardPalette() {
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

export function setMode(mode) {
  currentMode = mode;
  if (typeof window !== 'undefined') {
    window.__currentMode = mode;
  }
  document.querySelectorAll('#bottombar .tb').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const bp = document.getElementById('brush-picker');
  if (bp) {
    bp.classList.toggle('show', mode === 'draw');
  }
  const pal = document.getElementById('palette');
  if (pal) {
    const isPaletteMode = (mode === 'card' || mode === 'icon' || mode === 'board' || mode === 'sticker');
    pal.classList.toggle('show', isPaletteMode);
    if (mode === 'card') buildCardPalette();
    else if (mode === 'icon') buildIconPalette();
    else if (mode === 'board') buildBoardPalette();
    else if (mode === 'sticker') buildStickerPalette();
  }
  const { controls: liveControls } = getSceneState();
  if (liveControls) {
    liveControls.enabled = (mode === 'nav' && povMode === 'orbit');
  }
}

export function initModeSystem() {
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
}
