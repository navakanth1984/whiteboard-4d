import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { register } from '../core/history.js';
import { BRUSHES } from '../draw/strokes.js';

export let FONT = null;
export let CURSIVE_FONT = null;
export let COMMON_WORDS = [];
export let cursiveMode = false;
export let pendingTextPos = null;

export function initTextSystem() {
  // Load standard typeface for 3D extruded text
  new FontLoader().load(
    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
    f => { FONT = f; },
    undefined,
    e => console.warn('Typeface font load failed:', e)
  );

  // Load cursive TTF for handwriting tube text via opentype.js
  if (typeof window.opentype !== 'undefined') {
    window.opentype.load(
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/caveat/Caveat%5Bwght%5D.ttf',
      (err, f) => {
        if (err) console.error('Cursive font failed to load:', err);
        else CURSIVE_FONT = f;
      }
    );
  }

  // Load 10,000 common English words for mobile thumb / keypad prediction
  fetch('https://cdn.jsdelivr.net/gh/first20hours/google-10000-english@master/google-10000-english-no-swears.txt')
    .then(r => r.text())
    .then(txt => {
      COMMON_WORDS = txt.split('\n').map(w => w.trim()).filter(Boolean);
    })
    .catch(e => console.warn('Word prediction list failed to load:', e));

  setupTextOverlayEvents();
}

export function topWordMatches(prefix, limit = 3) {
  if (!prefix) return [];
  const p = prefix.toLowerCase();
  const out = [];
  for (let i = 0; i < COMMON_WORDS.length && out.length < limit; i++) {
    const w = COMMON_WORDS[i];
    if (w.startsWith(p) && w !== p) out.push(w);
  }
  return out;
}

export function updateWordPredictions() {
  const row = document.getElementById('word-predict-row');
  const inp = document.getElementById('text-input');
  if (!row || !inp) return;

  const trailingWord = inp.value.split(/\s+/).pop();
  const matches = topWordMatches(trailingWord, 3);
  row.innerHTML = '';
  if (!matches.length) {
    row.style.display = 'none';
    return;
  }

  matches.forEach(w => {
    const chip = document.createElement('button');
    chip.className = 'word-chip';
    chip.textContent = w;
    chip.addEventListener('mousedown', e => {
      e.preventDefault();
      const parts = inp.value.split(/\s+/);
      parts[parts.length - 1] = w;
      inp.value = parts.join(' ') + ' ';
      updateWordPredictions();
      inp.focus();
    });
    row.appendChild(chip);
  });
  row.style.display = 'flex';
}

export function showTextInput(cx, cy, pos) {
  pendingTextPos = pos || new THREE.Vector3(0, 11, -9);
  const el = document.getElementById('text-overlay');
  const inp = document.getElementById('text-input');
  if (!el || !inp) return;

  el.style.display = 'flex';
  el.style.left = Math.min(cx, window.innerWidth - 240) + 'px';
  el.style.top = Math.min(cy, window.innerHeight - 80) + 'px';
  inp.value = '';
  const row = document.getElementById('word-predict-row');
  if (row) row.style.display = 'none';

  requestAnimationFrame(() => inp.focus());
}

export function hideTextInput() {
  const el = document.getElementById('text-overlay');
  if (el) el.style.display = 'none';
  pendingTextPos = null;
}

export function setCursiveMode(on) {
  cursiveMode = on;
  const btn = document.getElementById('btn-text-cursive');
  const hint = document.getElementById('text-hint');
  if (btn) {
    btn.style.background = on ? 'rgba(80,190,255,.85)' : 'rgba(20,90,140,.7)';
    btn.style.color = on ? '#001a26' : '#9ef';
    btn.style.fontWeight = on ? '700' : '400';
  }
  if (hint) {
    hint.textContent = on
      ? 'Enter = ✒️ Cursive · Shift+Enter = 🔵 Ring'
      : 'Enter = 3D text · Shift+Enter = 🔵 Ring';
  }
}

function flattenOpentypePath(path, curveSamples) {
  const subpaths = [];
  let current = null, cx = 0, cy = 0;
  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      current = []; subpaths.push(current);
      current.push({ x: cmd.x, y: cmd.y }); cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === 'L') {
      if (!current) { current = []; subpaths.push(current); current.push({ x: cx, y: cy }); }
      current.push({ x: cmd.x, y: cmd.y }); cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === 'C') {
      if (!current) { current = []; subpaths.push(current); current.push({ x: cx, y: cy }); }
      for (let i = 1; i <= curveSamples; i++) {
        const t = i / curveSamples, mt = 1 - t;
        const x = mt * mt * mt * cx + 3 * mt * mt * t * cmd.x1 + 3 * mt * t * t * cmd.x2 + t * t * t * cmd.x;
        const y = mt * mt * mt * cy + 3 * mt * mt * t * cmd.y1 + 3 * mt * t * t * cmd.y2 + t * t * t * cmd.y;
        current.push({ x, y });
      }
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === 'Q') {
      if (!current) { current = []; subpaths.push(current); current.push({ x: cx, y: cy }); }
      for (let i = 1; i <= curveSamples; i++) {
        const t = i / curveSamples, mt = 1 - t;
        const x = mt * mt * cx + 2 * mt * t * cmd.x1 + t * t * cmd.x;
        const y = mt * mt * cy + 2 * mt * t * cmd.y1 + t * t * cmd.y;
        current.push({ x, y });
      }
      cx = cmd.x; cy = cmd.y;
    }
  }
  return subpaths.filter(sp => sp.length >= 2);
}

export function addCursiveText3D(text, pos, hex) {
  if (!CURSIVE_FONT) {
    return addText3D(text, pos, hex);
  }
  const fontSize = 6.5;
  const path = CURSIVE_FONT.getPath(text, 0, 0, fontSize);
  const subpaths = flattenOpentypePath(path, 8);
  if (!subpaths.length) return null;

  const bbox = path.getBoundingBox();
  const ox = (bbox.x1 + bbox.x2) / 2, oy = (bbox.y1 + bbox.y2) / 2;

  const col = new THREE.Color(hex);
  const b = BRUSHES.pen;
  const root = new THREE.Group();

  for (const sp of subpaths) {
    const pts = sp.map(p => new THREE.Vector3(p.x - ox, -(p.y - oy), 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = Math.min(400, Math.max(20, pts.length * 4));
    const geo = new THREE.TubeGeometry(curve, seg, b.radius, b.radSeg, false);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col.clone().multiplyScalar(b.emissive),
      roughness: b.roughness,
      opacity: b.opacity,
      transparent: b.transparent,
      depthWrite: !b.transparent,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  root.position.copy(pos);
  root.userData.billboardY = true;
  return register(root, 'text-cursive', text, hex);
}

export function addText3D(text, pos, hex) {
  if (!FONT) return null;
  const geo = new TextGeometry(text, {
    font: FONT,
    size: 1.1,
    height: 0.28,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2
  });
  geo.computeBoundingBox();
  const w = geo.boundingBox.max.x - geo.boundingBox.min.x;
  const h = geo.boundingBox.max.y - geo.boundingBox.min.y;
  const d = geo.boundingBox.max.z - geo.boundingBox.min.z;
  geo.translate(-w / 2, -h / 2, -d / 2);

  const col = new THREE.Color(hex);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col.clone().multiplyScalar(0.18),
    roughness: 0.35,
    metalness: 0.25
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  const root = new THREE.Group();
  root.position.copy(pos);
  root.add(mesh);
  root.userData.billboardY = true;
  return register(root, 'text', text, hex);
}

export function addTextRing(text, pos, hex, ringR) {
  if (!FONT) return null;
  const chars = [...text.replace(/\s/g, '')];
  if (!chars.length) return null;
  const radius = ringR || Math.max(2.0, chars.length * 0.28);
  const col = new THREE.Color(hex);
  const root = new THREE.Group();
  root.position.copy(pos);
  const step = (Math.PI * 2) / chars.length;

  chars.forEach((ch, i) => {
    const geo = new TextGeometry(ch, {
      font: FONT,
      size: 0.75,
      height: 0.18,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 1
    });
    geo.computeBoundingBox();
    const cw = geo.boundingBox.max.x - geo.boundingBox.min.x;
    const ch_h = geo.boundingBox.max.y - geo.boundingBox.min.y;
    const ch_d = geo.boundingBox.max.z - geo.boundingBox.min.z;
    geo.translate(-cw / 2, -ch_h / 2, -ch_d / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col.clone().multiplyScalar(0.2),
      roughness: 0.35
    });
    const mesh = new THREE.Mesh(geo, mat);
    const angle = i * step;
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    mesh.rotation.y = -angle + Math.PI / 2;
    root.add(mesh);
  });

  root.userData.spin = true;
  return register(root, 'text-ring', text, hex);
}

function setupTextOverlayEvents() {
  const inp = document.getElementById('text-input');
  const btnCursive = document.getElementById('btn-text-cursive');
  const btnRing = document.getElementById('btn-text-ring');

  if (inp) {
    inp.addEventListener('input', updateWordPredictions);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.value.trim() && pendingTextPos) {
        const val = e.target.value.trim();
        const hex = document.getElementById('pick-ink')?.value || '#00ccff';
        if (e.shiftKey) {
          addTextRing(val, pendingTextPos, hex);
        } else if (cursiveMode) {
          addCursiveText3D(val, pendingTextPos, hex);
        } else {
          addText3D(val, pendingTextPos, hex);
        }
        hideTextInput();
      }
      if (e.key === 'Escape') {
        hideTextInput();
      }
      e.stopPropagation();
    });
  }

  if (btnCursive) {
    btnCursive.addEventListener('click', () => setCursiveMode(!cursiveMode));
  }

  if (btnRing) {
    btnRing.addEventListener('click', () => {
      const val = inp?.value.trim();
      const hex = document.getElementById('pick-ink')?.value || '#00ccff';
      if (val && pendingTextPos) {
        addTextRing(val, pendingTextPos, hex);
        hideTextInput();
      }
    });
  }
}
