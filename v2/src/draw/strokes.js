import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { ray, m2, setMouse, getHit } from '../core/input.js';
import { register } from '../core/history.js';
import { smoothPointsCatmullRom, detectDrawnShape, showStrokeActionPopup, assistEnabled } from './assist.js';

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
let activeBoard = null;
let activeBoardStrokeGroup = null;

export let lastRecogPts = [];
export let lastStrokeCentroid = null;
export let lastStrokeEndScreen = null;

let liveGeo = null;
let liveLine = null;

export function initStrokeSystem() {
  const { scene } = getSceneState();
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
  const { camera, controls } = getSceneState();
  if (!camera) return;

  activeBoard = null;
  activeBoardStrokeGroup = null;

  // Check if drawing on a 3D Mini-Board surface
  const hit = getHit(cx, cy);
  if (hit && hit.object && hit.object.userData.isBoardSurface) {
    activeBoard = hit.object.userData.boardRoot;
    activeBoardStrokeGroup = hit.object.userData.strokeGroup;

    // Set plane from board surface normal & point
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 0, 1);
    drawPlane.setFromNormalAndCoplanarPoint(normal, hit.point);
  } else {
    const nrm = new THREE.Vector3();
    camera.getWorldDirection(nrm);
    const target = (controls && controls.target) ? controls.target.clone() : new THREE.Vector3(0, 5, -5);
    drawPlane.setFromNormalAndCoplanarPoint(nrm, target);
  }

  drawing = true;
  drawPts = [];
  addStrokePoint(cx, cy);
}

export function planePoint(cx, cy) {
  setMouse(cx, cy);
  const { camera } = getSceneState();
  if (!camera) return null;
  ray.setFromCamera(m2, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(drawPlane, p) ? p : null;
}

export function addStrokePoint(cx, cy) {
  const p = planePoint(cx, cy);
  if (!p) return;
  if (drawPts.length === 0 || p.distanceTo(drawPts[drawPts.length - 1]) > 0.08) {
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
  let smoothedPts = smoothPointsCatmullRom(drawPts, 0.45);
  // Ensure at least 2 distinct points
  smoothedPts = smoothedPts.filter((pt, idx) => {
    if (idx === 0) return true;
    return pt.distanceTo(smoothedPts[idx - 1]) > 0.02;
  });
  if (smoothedPts.length < 2) {
    drawPts = [];
    return null;
  }
  if (smoothedPts.length === 2) {
    smoothedPts.splice(1, 0, smoothedPts[0].clone().lerp(smoothedPts[1], 0.5));
  }
  const curve = new THREE.CatmullRomCurve3(smoothedPts);
  const seg = Math.min(300, Math.max(16, smoothedPts.length * 4));
  const b = BRUSHES[brushStyle] || BRUSHES.pen;
  const geo = new THREE.TubeGeometry(curve, seg, b.radius, b.radSeg || 6, false);
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

  let registeredObj = null;

  if (activeBoard && activeBoardStrokeGroup) {
    // If drawn on a Mini-Board, attach mesh directly to board's local stroke group
    mesh.position.copy(activeBoard.worldToLocal(new THREE.Vector3()));
    activeBoardStrokeGroup.add(mesh);
    registeredObj = { root: mesh, label: 'Board Stroke', type: 'board_stroke' };
  } else {
    // Standard spatial canvas stroke
    const root = new THREE.Group();
    root.add(mesh);
    registeredObj = register({ root, label: '3D Ink Stroke', type: 'stroke', inkColor });
  }

  // Compute screen coords & centroid for Writing Assistance AI Popup
  const { camera } = getSceneState();
  if (camera) {
    const projected = lastPt.clone().project(camera);
    const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    lastStrokeEndScreen = { x: sx, y: sy };

    if (assistEnabled) {
      const detected = detectDrawnShape(drawPts);
      if (detected) {
        showStrokeActionPopup(lastStrokeEndScreen, detected, registeredObj, inkColor);
      }
    }
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
