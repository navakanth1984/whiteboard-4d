// v2/src/agent/ocr_engine.js — 3D Handwriting-to-Typography AI OCR Engine via Tesseract.js
import * as THREE from 'three';
import { objects, removeObject, register } from '../core/history.js';
import { addText3D, addCursiveText3D } from '../objects/text.js';
import { getSceneState } from '../core/scene.js';

let isRecognizing = false;

/**
 * Initializes the AI OCR subsystem and UI event listeners
 */
export function initOCREngine() {
  initOCRUI();
}

/**
 * Converts 3D handwriting strokes into clean, formatted 3D typography
 * @param {Array} targetStrokes Optional array of specific stroke objects to convert
 * @param {boolean} cursive Whether to output cursive typography
 */
export async function convertHandwritingTo3DText(targetStrokes = null, cursive = false) {
  if (isRecognizing) return null;

  // Filter for stroke objects
  const strokes = targetStrokes || objects.filter(o => o.type === 'stroke' && o.root && o.root.visible);
  if (!strokes || strokes.length === 0) {
    alert('No 3D handwriting strokes found to convert. Draw some ink first in Ink mode!');
    return null;
  }

  isRecognizing = true;
  updateOCRHUD('OCR: ANALYZING STROKES...');

  try {
    // 1. Calculate Bounding Box and Center of Strokes
    const box = new THREE.Box3();
    strokes.forEach(s => {
      box.expandByObject(s.root);
    });

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // 2. Render Strokes to 2D Offscreen Canvas for Tesseract
    const canvas = renderStrokesToCanvas(strokes, box);

    // 3. Run OCR via Tesseract.js
    if (typeof window.Tesseract === 'undefined') {
      throw new Error('Tesseract.js is not loaded');
    }

    updateOCRHUD('OCR: RECOGNIZING TEXT...');
    const result = await window.Tesseract.recognize(canvas, 'eng');
    const recognizedText = (result?.data?.text || '').trim();

    if (!recognizedText) {
      updateOCRHUD('OCR: NO TEXT DETECTED');
      isRecognizing = false;
      return null;
    }

    // 4. Color from original strokes
    const strokeColor = strokes[0]?.color || '#00ccff';

    // 5. Replace rough stroke meshes with crisp 3D Text
    strokes.forEach(s => {
      removeObject(s);
    });

    // Place 3D typography at center
    const textPos = new THREE.Vector3(center.x, center.y, center.z);
    let textObj = null;
    if (cursive) {
      textObj = addCursiveText3D(recognizedText, textPos, strokeColor);
    } else {
      textObj = addText3D(recognizedText, textPos, strokeColor);
    }

    updateOCRHUD(`OCR: "${recognizedText}" (${Math.round(result.data.confidence || 90)}%)`);
    isRecognizing = false;
    return {
      text: recognizedText,
      confidence: result.data.confidence,
      object: textObj
    };
  } catch (err) {
    console.error('Handwriting OCR Error:', err);
    updateOCRHUD('OCR: ERROR');
    isRecognizing = false;
    return null;
  }
}

/**
 * Renders 3D stroke geometry projected onto a high-contrast 2D offscreen canvas
 */
export function renderStrokesToCanvas(strokes, box) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');

  // Fill White Background for maximum OCR contrast
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const minX = box.min.x;
  const maxX = box.max.x;
  const minY = box.min.y;
  const maxY = box.max.y;
  const spanX = Math.max(0.1, maxX - minX);
  const spanY = Math.max(0.1, maxY - minY);

  strokes.forEach(stroke => {
    if (!stroke.root) return;
    stroke.root.traverse(child => {
      if (child.isMesh && child.geometry && child.geometry.attributes.position) {
        const posAttr = child.geometry.attributes.position;
        const pts = [];
        for (let i = 0; i < posAttr.count; i += 2) {
          const worldPt = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i)
          ).applyMatrix4(child.matrixWorld);

          const px = 50 + ((worldPt.x - minX) / spanX) * (canvas.width - 100);
          const py = 50 + (1.0 - (worldPt.y - minY) / spanY) * (canvas.height - 100);
          pts.push({ x: px, y: py });
        }

        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let p = 1; p < pts.length; p++) {
            ctx.lineTo(pts[p].x, pts[p].y);
          }
          ctx.stroke();
        }
      }
    });
  });

  return canvas;
}

function updateOCRHUD(msg) {
  const hud = document.getElementById('hud-desktop');
  if (hud) hud.textContent = msg;
}

function initOCRUI() {
  const btnOCR = document.getElementById('btn-ocr');
  if (btnOCR) {
    btnOCR.addEventListener('click', () => {
      convertHandwritingTo3DText();
    });
  }
}
