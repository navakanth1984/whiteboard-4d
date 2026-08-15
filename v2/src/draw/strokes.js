import * as THREE from 'three';
import { scene, camera, controls } from '../core/scene.js';
import { ray, m2, setMouse } from '../core/input.js';
import { register } from '../core/history.js';

export const BRUSHES = {
  pen:         { radius: 0.035, radSeg: 6,  opacity: 1.0,  roughness: 0.5,  emissive: 0.35, transparent: false },
  pencil:      { radius: 0.022, radSeg: 5,  opacity: 0.70, roughness: 0.95, emissive: 0.05, transparent: true  },
  marker:      { radius: 0.11,  radSeg: 8,  opacity: 0.95, roughness: 0.85, emissive: 0.08, transparent: false },
  brush:       { radius: 0.07,  radSeg: 10, opacity: 0.82, roughness: 0.25, emissive: 0.55, transparent: true  },
  highlighter: { radius: 0.20,  radSeg: 8,  opacity: 0.28, roughness: 0.05, emissive: 0.90, transparent: true  },
};

export const BRUSH_ICONS = {
  pen: 'edit',
  pencil: 'border_color',
  marker: 'format_paint',
  brush: 'brush',
  highlighter: 'auto_awesome'
};

export let brushStyle = 'pen';
export let inkColor = '#00ccff';
export let drawing = false;
export let drawPts = [];
export const drawPlane = new THREE.Plane();

export let lastRecogPts = [];
export let lastStrokeCentroid = null;
export let lastStrokeEndScreen = null;

// Live preview line while drawing
let liveGeo = null;
let liveLine = null;

export function initStrokeSystem() {
  if (!scene) return;
  liveGeo = new THREE.BufferGeometry();
  liveLine = new THREE.Line(
    liveGeo,
    new THREE.LineBasicMaterial({ color: 0x99ccff, transparent: true, opacity: 0.9 })
  );
  liveLine.visible = false;
  scene.add(liveLine);
}

export function setBrushStyle(style) {
  if (BRUSHES[style]) {
    brushStyle = style;
    const di = document.getElementById('draw-icon');
    if (di) di.textContent = BRUSH_ICONS[brushStyle] || 'draw';
  }
}

export function setInkColor(color) {
  inkColor = color;
}

export function beginStroke(cx, cy) {
  if (!camera || !controls) return;
  const nrm = new THREE.Vector3();
  camera.getWorldDirection(nrm);
  drawPlane.setFromNormalAndCoplanarPoint(nrm, controls.target.clone());
  drawing = true;
  drawPts = [];
  addStrokePoint(cx, cy);
}

export function planePoint(cx, cy) {
  setMouse(cx, cy);
  if (!camera) return null;
  ray.setFromCamera(m2, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(drawPlane, p) ? p : null;
}

export function addStrokePoint(cx, cy) {
  const p = planePoint(cx, cy);
  if (!p) return;
  if (drawPts.length === 0 || p.distanceTo(drawPts[drawPts.length - 1]) > 0.12) {
    drawPts.push(p);
  }
}

export function updateLive() {
  if (drawing && drawPts.length && liveGeo && liveLine) {
    liveGeo.setFromPoints(drawPts);
    liveLine.visible = true;
  } else if (liveLine) {
    liveLine.visible = false;
  }
}

export function endStroke(onComplete) {
  drawing = false;
  if (drawPts.length < 2) {
    drawPts = [];
    return null;
  }

  const lastPt = drawPts[drawPts.length - 1].clone();
  const curve = new THREE.CatmullRomCurve3(drawPts);
  const seg = Math.min(400, Math.max(20, drawPts.length * 6));
  const b = BRUSHES[brushStyle] || BRUSHES.pen;
  const geo = new THREE.TubeGeometry(curve, seg, b.radius, b.radSeg, false);
  const col = new THREE.Color(inkColor);

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

  const root = new THREE.Group();
  root.add(mesh);

  const registeredObj = register(root, 'stroke', 'Stroke', inkColor);

  // Compute screen coords & centroid
  if (camera) {
    const projected = lastPt.clone().project(camera);
    const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    lastStrokeEndScreen = { x: sx, y: sy };
  }

  lastRecogPts = [...drawPts];
  lastStrokeCentroid = lastRecogPts
    .reduce((s, p) => s.add(p), new THREE.Vector3())
    .multiplyScalar(1 / lastRecogPts.length);

  drawPts = [];

  if (typeof onComplete === 'function') {
    onComplete({
      object: registeredObj,
      rawPoints: lastRecogPts,
      centroid: lastStrokeCentroid,
      screenEnd: lastStrokeEndScreen
    });
  }

  return registeredObj;
}
