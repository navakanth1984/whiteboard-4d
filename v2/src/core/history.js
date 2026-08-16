import { scene, placeTargets } from './scene.js';

export let idCtr = 0;
export const objects = [];
export const links = [];
export const undoStack = [];
export const redoStack = [];

// Session / 4D State flags
export let fourDOn = false;
export let curOrbitPattern = 'circle';
export let curOrbitRadius = 2.5;
export let moveTarget = null;

export function setFourDState(on, pattern = 'circle', radius = 2.5) {
  fourDOn = on;
  curOrbitPattern = pattern;
  curOrbitRadius = radius;
}

export function setMoveTarget(target) {
  moveTarget = target;
}

export function register(root, type, label, color, opts = {}) {
  const id = idCtr++;
  const o = {
    id,
    root,
    type,
    label,
    color,
    fourD: fourDOn,
    wPhase: Math.random() * Math.PI * 2,
    basePos: root.position.clone(),
    orbitPattern: curOrbitPattern,
    orbitRadius: curOrbitRadius,
    orbitSpeed: 0.38,
    ...opts
  };

  objects.push(o);
  undoStack.push(o);
  redoStack.length = 0;

  if (scene) {
    scene.add(root);
  }

  updateUndoRedoBtns();
  if (window.compassViewport && typeof window.compassViewport.markDirty === 'function') {
    window.compassViewport.markDirty();
  }

  return o;
}

export function updateUndoRedoBtns() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  const empty = undoStack.length === 0;
  const noRedo = redoStack.length === 0;

  if (u) {
    u.disabled = empty;
    u.style.opacity = empty ? '0.35' : '1';
  }
  if (r) {
    r.disabled = noRedo;
    r.style.opacity = noRedo ? '0.35' : '1';
  }
}

export function undoLast() {
  const o = undoStack.pop();
  if (!o) return null;

  if (scene) {
    scene.remove(o.root);
  }

  const i = objects.indexOf(o);
  if (i > -1) objects.splice(i, 1);

  if (o.collider) {
    const ci = placeTargets.indexOf(o.collider);
    if (ci > -1) placeTargets.splice(ci, 1);
  }

  if (o.video && typeof o.video.pause === 'function') {
    o.video.pause();
  }
  if (o.sound && typeof o.sound.pause === 'function') {
    try { o.sound.pause(); } catch (e) {}
  }

  for (let k = links.length - 1; k >= 0; k--) {
    if (links[k].a === o.id || links[k].b === o.id) {
      if (scene) scene.remove(links[k].line);
      if (links[k].line?.material?.dispose) links[k].line.material.dispose();
      if (links[k].geo?.dispose) links[k].geo.dispose();
      if (links[k].particle) {
        if (scene) scene.remove(links[k].particle);
        if (links[k].particle.geometry?.dispose) links[k].particle.geometry.dispose();
        if (links[k].particle.material?.dispose) links[k].particle.material.dispose();
      }
      links.splice(k, 1);
    }
  }

  if (moveTarget === o) moveTarget = null;
  redoStack.push(o);

  updateUndoRedoBtns();
  if (window.compassViewport && typeof window.compassViewport.markDirty === 'function') {
    window.compassViewport.markDirty();
  }

  return o;
}

export function redoLast() {
  const o = redoStack.pop();
  if (!o) return null;

  if (scene) {
    scene.add(o.root);
  }

  objects.push(o);
  undoStack.push(o);

  if (o.collider) {
    placeTargets.push(o.collider);
  }
  if (o.video && typeof o.video.play === 'function') {
    o.video.play().catch(() => {});
  }
  if (o.sound && typeof o.sound.play === 'function') {
    try { o.sound.play(); } catch (e) {}
  }

  updateUndoRedoBtns();
  if (window.compassViewport && typeof window.compassViewport.markDirty === 'function') {
    window.compassViewport.markDirty();
  }

  return o;
}

export function removeObj(o) {
  if (!o) return;
  if (scene && o.root) {
    scene.remove(o.root);
  }

  const i = objects.indexOf(o);
  if (i > -1) objects.splice(i, 1);

  if (o.collider) {
    const ci = placeTargets.indexOf(o.collider);
    if (ci > -1) placeTargets.splice(ci, 1);
  }

  if (o.video && typeof o.video.pause === 'function') {
    o.video.pause();
  }
  if (o.sound && typeof o.sound.pause === 'function') {
    try { o.sound.pause(); } catch (e) {}
  }
  if (o._blobUrl) {
    URL.revokeObjectURL(o._blobUrl);
  }

  for (let k = links.length - 1; k >= 0; k--) {
    if (links[k].a === o.id || links[k].b === o.id) {
      if (scene) scene.remove(links[k].line);
      if (links[k].particles) {
        links[k].particles.forEach(pt => {
          if (scene) scene.remove(pt);
        });
      }
      if (links[k].arrowHead && scene) {
        scene.remove(links[k].arrowHead);
      }
      links.splice(k, 1);
    }
  }

  if (moveTarget === o) moveTarget = null;
  updateUndoRedoBtns();
}
