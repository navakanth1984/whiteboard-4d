import * as THREE from 'three';
import { addSpatialCard } from '../objects/models.js';
import { addShape } from '../objects/shapes.js';
import { addText3D } from '../objects/text.js';
import { createLink } from '../graph/links.js';

export let assistEnabled = true;
export let snapToBaseline = false;
let popupEl = null;

export function setAssistEnabled(val) {
  assistEnabled = !!val;
}

export function setSnapToBaseline(val) {
  snapToBaseline = !!val;
}

// 1. Spline Curve Smoothing (Catmull-Rom)
export function smoothPointsCatmullRom(pts, tension = 0.5) {
  if (!pts || pts.length < 3) return pts;

  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', tension);
  const sampleCount = Math.min(200, Math.max(pts.length * 3, 24));
  return curve.getPoints(sampleCount);
}

// 2. Real-time Geometric Shape & Gesture Detection
export function detectDrawnShape(pts) {
  if (!pts || pts.length < 5) return null;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const totalDist = start.distanceTo(end);

  // Compute bounding box & center
  const box = new THREE.Box3().setFromPoints(pts);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const minDim = Math.min(size.x, size.y, size.z);

  if (maxDim < 0.3) return null; // Too small

  const isClosed = totalDist < maxDim * 0.28;

  // 2a. Circle / Ellipse Detection
  if (isClosed) {
    let avgRadius = 0;
    const radii = pts.map(p => {
      const r = p.distanceTo(center);
      avgRadius += r;
      return r;
    });
    avgRadius /= pts.length;

    let variance = 0;
    radii.forEach(r => {
      variance += Math.pow(r - avgRadius, 2);
    });
    const stdDev = Math.sqrt(variance / pts.length);
    const roundness = stdDev / (avgRadius || 1);

    if (roundness < 0.22) {
      return {
        type: 'circle',
        label: 'Circle / 3D Sphere',
        center,
        radius: avgRadius,
        box
      };
    }

    // 2b. Rectangle / Box Detection
    const aspectRatio = size.x / (size.y || 1);
    if (aspectRatio > 0.3 && aspectRatio < 3.5) {
      return {
        type: 'rectangle',
        label: '3D Spatial Glass Card / Box',
        center,
        size,
        box
      };
    }
  } else {
    // 2c. Straight Line or Arrow
    const chordLen = totalDist;
    let pathLen = 0;
    for (let i = 1; i < pts.length; i++) {
      pathLen += pts[i].distanceTo(pts[i - 1]);
    }
    const straightness = chordLen / (pathLen || 1);

    if (straightness > 0.88) {
      return {
        type: 'line',
        label: '3D Flow Link / Arrow',
        start,
        end,
        center,
        length: totalDist
      };
    }
  }

  return {
    type: 'text_stroke',
    label: 'Convert Handwriting to 3D Text',
    center,
    box
  };
}

// 3. UI Action Popup for Instant Transformation
export function showStrokeActionPopup(screenPos, detected, strokeObj, inkColor) {
  if (!assistEnabled || !detected) return;

  if (!popupEl) {
    popupEl = document.createElement('div');
    popupEl.id = 'stroke-assist-popup';
    document.body.appendChild(popupEl);
  }

  popupEl.innerHTML = `
    <div class="assist-badge">
      <span class="material-symbols-outlined assist-ico">auto_fix_high</span>
      <strong>${detected.label}</strong>
    </div>
    <div class="assist-actions">
      <button class="assist-btn" id="btn-conv-shape"><span class="material-symbols-outlined">shapes</span> Convert</button>
      <button class="assist-btn" id="btn-conv-card"><span class="material-symbols-outlined">dashboard_customize</span> Glass Card</button>
      <button class="assist-btn" id="btn-conv-dismiss">✕</button>
    </div>
  `;

  popupEl.style.left = Math.min(window.innerWidth - 220, Math.max(10, screenPos.x - 60)) + 'px';
  popupEl.style.top = Math.min(window.innerHeight - 80, Math.max(70, screenPos.y - 45)) + 'px';
  popupEl.style.display = 'flex';

  const btnConv = document.getElementById('btn-conv-shape');
  const btnCard = document.getElementById('btn-conv-card');
  const btnDismiss = document.getElementById('btn-conv-dismiss');

  if (btnConv) {
    btnConv.onclick = () => {
      if (detected.type === 'circle') {
        addShape('sphere', { point: detected.center, normal: new THREE.Vector3(0, 0, 1) }, inkColor);
      } else if (detected.type === 'rectangle') {
        addSpatialCard('agent', { point: detected.center, normal: new THREE.Vector3(0, 0, 1) }, inkColor);
      } else {
        addText3D('TEXT NODE', detected.center, inkColor);
      }
      hideStrokeActionPopup();
    };
  }

  if (btnCard) {
    btnCard.onclick = () => {
      addSpatialCard('database', { point: detected.center, normal: new THREE.Vector3(0, 0, 1) }, inkColor);
      hideStrokeActionPopup();
    };
  }

  if (btnDismiss) {
    btnDismiss.onclick = () => hideStrokeActionPopup();
  }

  // Auto-dismiss after 6 seconds
  setTimeout(() => {
    hideStrokeActionPopup();
  }, 6000);
}

export function hideStrokeActionPopup() {
  if (popupEl) popupEl.style.display = 'none';
}

export function initWritingAssistEvents() {
  // Ready
}

