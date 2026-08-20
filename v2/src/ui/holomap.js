// v2/src/ui/holomap.js — Isometric 3D Holomap Radar HUD & 1-Click Spatial Teleporter
import * as THREE from 'three';
import { objects } from '../core/history.js';
import { getSceneState } from '../core/scene.js';
import { playWhoosh, playClickSound } from '../audio/haptics.js';

let radarCanvas = null;
let radarCtx = null;
let radarContainer = null;
let isRadarVisible = true;
let sweepAngle = 0;
const RADAR_WORLD_RADIUS = 100; // 100 units coverage

/**
 * Initializes the 3D Holomap Radar HUD widget
 */
export function initHolomapSystem() {
  createRadarDOM();
}

function createRadarDOM() {
  if (document.getElementById('holomap-radar-widget')) return;

  radarContainer = document.createElement('div');
  radarContainer.id = 'holomap-radar-widget';
  radarContainer.style.position = 'fixed';
  radarContainer.style.bottom = '90px';
  radarContainer.style.right = '20px';
  radarContainer.style.width = '140px';
  radarContainer.style.height = '140px';
  radarContainer.style.borderRadius = '50%';
  radarContainer.style.background = 'rgba(2, 6, 23, 0.85)';
  radarContainer.style.border = '2px solid rgba(56, 189, 248, 0.6)';
  radarContainer.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.25), inset 0 0 15px rgba(2, 132, 199, 0.3)';
  radarContainer.style.backdropFilter = 'blur(8px)';
  radarContainer.style.zIndex = '50';
  radarContainer.style.cursor = 'crosshair';
  radarContainer.style.overflow = 'hidden';
  radarContainer.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

  radarContainer.addEventListener('mouseenter', () => {
    radarContainer.style.transform = 'scale(1.08)';
  });
  radarContainer.addEventListener('mouseleave', () => {
    radarContainer.style.transform = 'scale(1.0)';
  });

  radarCanvas = document.createElement('canvas');
  radarCanvas.width = 140;
  radarCanvas.height = 140;
  radarCanvas.style.width = '100%';
  radarCanvas.style.height = '100%';
  radarCtx = radarCanvas.getContext('2d');
  radarContainer.appendChild(radarCanvas);

  // 1-Click Spatial Teleport Listener
  radarCanvas.addEventListener('click', (e) => {
    const rect = radarCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const center = 70;
    const dx = (cx - center) / center;
    const dy = (cy - center) / center;

    if (dx * dx + dy * dy <= 1.0) {
      const targetWorldX = dx * RADAR_WORLD_RADIUS;
      const targetWorldZ = dy * RADAR_WORLD_RADIUS;
      teleportToSector(targetWorldX, targetWorldZ);
    }
  });

  document.body.appendChild(radarContainer);
}

/**
 * Renders the top-down radar sweep, world object blips, and avatar heading each frame
 */
export function updateHolomap(camera, avatarPos, dt = 0.016) {
  if (!radarCtx || !isRadarVisible || !camera) return;

  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const center = w / 2;

  radarCtx.clearRect(0, 0, w, h);

  // 1. Radar Grid Rings
  radarCtx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  radarCtx.lineWidth = 1;

  radarCtx.beginPath(); radarCtx.arc(center, center, 25, 0, Math.PI * 2); radarCtx.stroke();
  radarCtx.beginPath(); radarCtx.arc(center, center, 45, 0, Math.PI * 2); radarCtx.stroke();
  radarCtx.beginPath(); radarCtx.arc(center, center, 65, 0, Math.PI * 2); radarCtx.stroke();

  // Crosshairs
  radarCtx.beginPath();
  radarCtx.moveTo(center, 5); radarCtx.lineTo(center, h - 5);
  radarCtx.moveTo(5, center); radarCtx.lineTo(w - 5, center);
  radarCtx.stroke();

  // 2. Animated Sweep Line
  sweepAngle += dt * 3.0;
  radarCtx.save();
  radarCtx.translate(center, center);
  radarCtx.rotate(sweepAngle);

  const grad = radarCtx.createLinearGradient(0, 0, center, 0);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
  radarCtx.fillStyle = grad;

  radarCtx.beginPath();
  radarCtx.moveTo(0, 0);
  radarCtx.arc(0, 0, center - 2, 0, 0.5);
  radarCtx.closePath();
  radarCtx.fill();
  radarCtx.restore();

  // 3. Plot Object Blips
  objects.forEach((o) => {
    if (!o.root) return;
    const ox = o.root.position.x;
    const oz = o.root.position.z;

    const rx = center + (ox / RADAR_WORLD_RADIUS) * center;
    const ry = center + (oz / RADAR_WORLD_RADIUS) * center;

    // Inside circular boundary
    const distSq = (rx - center) * (rx - center) + (ry - center) * (ry - center);
    if (distSq < (center - 5) * (center - 5)) {
      radarCtx.fillStyle = '#00f0ff';
      radarCtx.shadowColor = '#00f0ff';
      radarCtx.shadowBlur = 4;
      radarCtx.fillRect(rx - 2, ry - 2, 4, 4);
      radarCtx.shadowBlur = 0;
    }
  });

  // 4. Plot Player Avatar Position & Heading Triangle
  const px = avatarPos ? center + (avatarPos.x / RADAR_WORLD_RADIUS) * center : center;
  const py = avatarPos ? center + (avatarPos.z / RADAR_WORLD_RADIUS) * center : center;

  radarCtx.save();
  radarCtx.translate(px, py);

  // Rotation from camera yaw
  const yaw = Math.atan2(camera.position.x - (avatarPos ? avatarPos.x : 0), camera.position.z - (avatarPos ? avatarPos.z : 0));
  radarCtx.rotate(-yaw);

  radarCtx.fillStyle = '#f43f5e';
  radarCtx.beginPath();
  radarCtx.moveTo(0, -6);
  radarCtx.lineTo(4, 5);
  radarCtx.lineTo(-4, 5);
  radarCtx.closePath();
  radarCtx.fill();

  radarCtx.restore();
}

/**
 * Teleports the camera / avatar to a target world coordinate with smooth flight
 */
export function teleportToSector(worldX, worldZ) {
  const { camera } = getSceneState();
  if (!camera) return;

  playWhoosh();

  if (typeof window.gsap !== 'undefined') {
    window.gsap.to(camera.position, {
      x: worldX,
      z: worldZ + 15,
      y: 12,
      duration: 0.8,
      ease: 'power2.inOut'
    });
  } else {
    camera.position.set(worldX, 12, worldZ + 15);
  }
}

export function toggleRadarVisibility() {
  isRadarVisible = !isRadarVisible;
  if (radarContainer) {
    radarContainer.style.display = isRadarVisible ? 'block' : 'none';
  }
  return isRadarVisible;
}

export function getRadarObjectCount() {
  return objects.length;
}

export const toggleHolomap = toggleRadarVisibility;

