import { objects, links } from '../core/history.js';
import { povMode } from '../nav/gamer_nav.js';
import { avatarConfig } from '../nav/character.js';

let hudCoordsEl = null;
let hudSpeedEl = null;
let hudModeEl = null;
let reticleEl = null;

export function initHUDSystem() {
  hudCoordsEl = document.getElementById('hud-coords');
  hudSpeedEl = document.getElementById('hud-speed');
  hudModeEl = document.getElementById('hud-desktop');
  reticleEl = document.getElementById('gamer-reticle');
}

export function updateHUD(currentMode = 'nav') {
  if (hudModeEl) {
    const execTag = avatarConfig.executionMode === 'avatar' ? '🤖 AVATAR' : '⚡ DIRECT';
    hudModeEl.textContent = `${currentMode.toUpperCase()} · ${objects.length} objs · ${links.length} links · ${execTag} · ${povMode.toUpperCase()}`;
  }

  const telemetry = window.__gamerTelemetry;
  if (telemetry) {
    if (hudCoordsEl && telemetry.pos) {
      hudCoordsEl.textContent = `X:${telemetry.pos.x.toFixed(1)} Y:${telemetry.pos.y.toFixed(1)} Z:${telemetry.pos.z.toFixed(1)}`;
    }
    if (hudSpeedEl) {
      const spd = telemetry.speed ? telemetry.speed.toFixed(1) : '0.0';
      hudSpeedEl.textContent = `${spd} m/s ${telemetry.isSprinting ? '⚡BOOST' : ''}`;
    }
  }

  if (reticleEl) {
    reticleEl.style.display = (povMode !== 'orbit') ? 'block' : 'none';
  }
}
