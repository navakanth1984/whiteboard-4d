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
  // Load standard typeface for 3D extruded text (Three.js 0.180.0)
  new FontLoader().load(
    'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_bold.typeface.json',
    f => { FONT = f; },
    undefined,
    e => console.warn('Typeface font load failed, using high-res canvas 3D typography fallback:', e)
  );

  // Load cursive TTF for handwriting tube text via opentype.js
  if (typeof window.opentype !== 'undefined') {
    window.opentype.load(
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/caveat/Caveat%5Bwght%5D.ttf',
      (err, f) => {
        if (err) console.warn('Cursive font failed to load:', err);
        else CURSIVE_FONT = f;
      }
    );
  }

  // Load common English words for mobile thumb / keypad prediction
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
  const left = Math.max(16, Math.min(cx || window.innerWidth / 2, window.innerWidth - 320));
  const top = Math.max(70, Math.min(cy || window.innerHeight / 2, window.innerHeight - 180));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  inp.value = '';
  const row = document.getElementById('word-predict-row');
  if (row) row.style.display = 'none';

  setTimeout(() => inp.focus(), 50);
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
    btn.style.background = on ? 'rgba(56,189,248,.85)' : 'rgba(15,23,42,.7)';
    btn.style.color = on ? '#020617' : '#93c5fd';
    btn.style.fontWeight = on ? '700' : '500';
  }
  if (hint) {
    hint.textContent = on
      ? 'Press Enter = ✒️ Cursive · Shift+Enter = 🔵 Ring · Esc = Cancel'
      : 'Press Enter = 3D Solid · Shift+Enter = 🔵 Ring · Esc = Cancel';
  }
}

function flattenOpentypePath(path, curveSamples = 8) {
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

  // Filter subpaths to ensure at least 2 distinct points with positive distance
  return subpaths.map(sp => {
    const cleaned = [];
    sp.forEach(p => {
      if (!cleaned.length || Math.hypot(p.x - cleaned[cleaned.length - 1].x, p.y - cleaned[cleaned.length - 1].y) > 0.05) {
        cleaned.push(p);
      }
    });
    return cleaned;
  }).filter(sp => sp.length >= 2);
}

export function addCanvasText3D(text, pos, hex) {
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  cvs.width = 1024;
  cvs.height = 320;

  // Background Glass Card
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.roundRect(16, 16, 992, 288, 36);
  ctx.fill();

  // Neon Border
  ctx.strokeStyle = hex || '#38bdf8';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Text with Glow
  ctx.font = 'bold 84px Outfit, "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = hex || '#38bdf8';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 512, 160);

  const texture = new THREE.CanvasTexture(cvs);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });

  const geo = new THREE.PlaneGeometry(5.2, 1.6);
  const mesh = new THREE.Mesh(geo, mat);
  const root = new THREE.Group();
  root.position.copy(pos);
  root.add(mesh);
  root.userData.billboardY = true;

  return register(root, 'text', text, hex);
}

export function addCursiveText3D(text, pos, hex) {
  if (!CURSIVE_FONT) {
    return addText3D(text, pos, hex);
  }
  const fontSize = 6.5;
  const path = CURSIVE_FONT.getPath(text, 0, 0, fontSize);
  const subpaths = flattenOpentypePath(path, 8);
  if (!subpaths.length) return addCanvasText3D(text, pos, hex);

  const bbox = path.getBoundingBox();
  const ox = (bbox.x1 + bbox.x2) / 2, oy = (bbox.y1 + bbox.y2) / 2;

  const col = new THREE.Color(hex);
  const b = BRUSHES.pen;
  const root = new THREE.Group();

  for (const sp of subpaths) {
    const pts = sp.map(p => new THREE.Vector3(p.x - ox, -(p.y - oy), 0));
    if (pts.length < 2) continue;
    // Ensure at least 3 points for smooth CatmullRom
    if (pts.length === 2) {
      pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = Math.min(240, Math.max(16, pts.length * 4));
    const geo = new THREE.TubeGeometry(curve, seg, b.radius * 1.4, 6, false);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col.clone().multiplyScalar(0.4),
      roughness: 0.4,
      opacity: 1.0,
      transparent: false
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
  if (!FONT) {
    return addCanvasText3D(text, pos, hex);
  }
  try {
    const geo = new TextGeometry(text, {
      font: FONT,
      size: 1.1,
      depth: 0.28,
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
      emissive: col.clone().multiplyScalar(0.22),
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
  } catch (err) {
    console.warn('TextGeometry generation failed, falling back to canvas text:', err);
    return addCanvasText3D(text, pos, hex);
  }
}

export function addTextRing(text, pos, hex, ringR) {
  if (!FONT) return addCanvasText3D(text, pos, hex);
  const chars = [...text.replace(/\s/g, '')];
  if (!chars.length) return null;
  const radius = ringR || Math.max(2.0, chars.length * 0.28);
  const col = new THREE.Color(hex);
  const root = new THREE.Group();
  root.position.copy(pos);
  const step = (Math.PI * 2) / chars.length;

  chars.forEach((ch, i) => {
    try {
      const geo = new TextGeometry(ch, {
        font: FONT,
        size: 0.75,
        depth: 0.18,
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
    } catch (e) {}
  });

  root.userData.spin = true;
  return register(root, 'text-ring', text, hex);
}

function submitText() {
  const inp = document.getElementById('text-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) {
    hideTextInput();
    return;
  }
  const hex = document.getElementById('pick-ink')?.value || '#00ccff';
  const pos = pendingTextPos || new THREE.Vector3(0, 11, -9);

  if (cursiveMode) {
    addCursiveText3D(val, pos, hex);
  } else {
    addText3D(val, pos, hex);
  }
  hideTextInput();
}

function setupTextOverlayEvents() {
  const inp = document.getElementById('text-input');
  const btnSubmit = document.getElementById('btn-text-submit');
  const btnClose = document.getElementById('btn-text-close');
  const btnCursive = document.getElementById('btn-text-cursive');
  const btnRing = document.getElementById('btn-text-ring');

  if (inp) {
    inp.addEventListener('input', updateWordPredictions);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const val = e.target.value.trim();
        const hex = document.getElementById('pick-ink')?.value || '#00ccff';
        const pos = pendingTextPos || new THREE.Vector3(0, 11, -9);
        if (val) {
          if (e.shiftKey) {
            addTextRing(val, pos, hex);
          } else if (cursiveMode) {
            addCursiveText3D(val, pos, hex);
          } else {
            addText3D(val, pos, hex);
          }
        }
        hideTextInput();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hideTextInput();
      }
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', submitText);
  }

  if (btnClose) {
    btnClose.addEventListener('click', hideTextInput);
  }

  if (btnCursive) {
    btnCursive.addEventListener('click', () => setCursiveMode(!cursiveMode));
  }

  if (btnRing) {
    btnRing.addEventListener('click', () => {
      const val = inp?.value.trim();
      const hex = document.getElementById('pick-ink')?.value || '#00ccff';
      const pos = pendingTextPos || new THREE.Vector3(0, 11, -9);
      if (val) {
        addTextRing(val, pos, hex);
        hideTextInput();
      }
    });
  }
}
