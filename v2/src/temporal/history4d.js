// v2/src/temporal/history4d.js — 4D Temporal Time-Travel & Chronological Playback Engine
import * as THREE from 'three';
import { objects, links, register } from '../core/history.js';
import { getSceneState } from '../core/scene.js';

export const actionTimeline = [];
let isPlaying = false;
let playbackSpeed = 1.0;
let playbackTime = 0;
let maxTimelineDuration = 10; // seconds
let animLoopId = null;
let isScrubbing = false;
let sessionStartTime = Date.now();

/**
 * Records a discrete spatial event into the 4D chronological timeline.
 */
export function recordTimelineEvent(type, targetObj, payload = {}) {
  const timestamp = (Date.now() - sessionStartTime) / 1000;
  maxTimelineDuration = Math.max(maxTimelineDuration, timestamp + 1);

  const event = {
    id: actionTimeline.length,
    time: timestamp,
    type,
    objectId: targetObj?.id,
    label: targetObj?.label || type,
    pos: targetObj?.root?.position?.clone() || new THREE.Vector3(),
    rot: targetObj?.root?.rotation?.clone() || new THREE.Euler(),
    payload
  };

  actionTimeline.push(event);
  updateTimelineUI();
  return event;
}

/**
 * Reconstructs the 3D scene state at a given normalized timeline ratio (0.0 to 1.0).
 */
export function seekToRatio(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const targetTime = clamped * maxTimelineDuration;
  playbackTime = targetTime;

  // Determine active objects up to targetTime
  objects.forEach((obj, idx) => {
    // Find creation event
    const createEvt = actionTimeline.find(e => e.objectId === obj.id && (e.type === 'create' || e.type === 'register'));
    if (createEvt) {
      obj.root.visible = (createEvt.time <= targetTime);
    } else {
      // Fallback: estimate visibility based on registration order
      const estTime = (idx / Math.max(1, objects.length)) * maxTimelineDuration * 0.8;
      obj.root.visible = (estTime <= targetTime);
    }
  });

  // Re-evaluate link visibility
  links.forEach(link => {
    if (link.source && link.target) {
      link.mesh.visible = link.source.root.visible && link.target.root.visible;
    }
  });

  updateScrubberDisplay();
}

/**
 * Starts automatic chronological time-lapse replay of the 3D canvas
 */
export function playReplay() {
  if (isPlaying) return;
  isPlaying = true;

  if (playbackTime >= maxTimelineDuration) {
    playbackTime = 0;
  }

  let lastFrameTime = performance.now();

  function loop(now) {
    if (!isPlaying) return;
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    playbackTime += dt * playbackSpeed;
    if (playbackTime > maxTimelineDuration) {
      playbackTime = maxTimelineDuration;
      pauseReplay();
    }

    seekToRatio(playbackTime / maxTimelineDuration);
    animLoopId = requestAnimationFrame(loop);
  }

  animLoopId = requestAnimationFrame(loop);
  updateTimelineUI();
}

/**
 * Pauses replay playback
 */
export function pauseReplay() {
  isPlaying = false;
  if (animLoopId) cancelAnimationFrame(animLoopId);
  updateTimelineUI();
}

/**
 * Resets 4D timeline back to live real-time state with all objects visible
 */
export function jumpToLive() {
  pauseReplay();
  playbackTime = maxTimelineDuration;
  objects.forEach(o => { if (o.root) o.root.visible = true; });
  links.forEach(l => { if (l.mesh) l.mesh.visible = true; });
  seekToRatio(1.0);
}

/**
 * Initializes the bottom 4D Timeline Scrubber UI
 */
export function init4DTimelineUI() {
  const btn4D = document.getElementById('btn-4d');
  const container = document.getElementById('timeline-4d');

  if (btn4D && container) {
    btn4D.addEventListener('click', () => {
      const isShowing = container.style.display === 'none' || !container.classList.contains('show');
      container.classList.toggle('show', isShowing);
      container.style.display = isShowing ? 'flex' : 'none';
      btn4D.classList.toggle('active', isShowing);
      btn4D.setAttribute('aria-pressed', isShowing ? 'true' : 'false');
      if (!isShowing) jumpToLive();
    });
  }

  const playBtn = document.getElementById('tl-play-btn');
  const scrubSlider = document.getElementById('tl-scrubber');
  const speedBtn = document.getElementById('tl-speed-btn');
  const liveBtn = document.getElementById('tl-live-btn');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (isPlaying) pauseReplay();
      else playReplay();
    });
  }

  if (scrubSlider) {
    scrubSlider.addEventListener('input', (e) => {
      isScrubbing = true;
      pauseReplay();
      const val = parseFloat(e.target.value) / 100;
      seekToRatio(val);
    });
    scrubSlider.addEventListener('change', () => {
      isScrubbing = false;
    });
  }

  if (speedBtn) {
    speedBtn.addEventListener('click', () => {
      if (playbackSpeed === 1.0) playbackSpeed = 2.0;
      else if (playbackSpeed === 2.0) playbackSpeed = 4.0;
      else playbackSpeed = 1.0;
      speedBtn.textContent = `${playbackSpeed}x`;
    });
  }

  if (liveBtn) {
    liveBtn.addEventListener('click', () => {
      jumpToLive();
    });
  }
}

function updateTimelineUI() {
  const playBtn = document.getElementById('tl-play-btn');
  if (playBtn) {
    playBtn.innerHTML = `<span class="material-symbols-outlined">${isPlaying ? 'pause' : 'play_arrow'}</span>`;
  }
  updateScrubberDisplay();
}

function updateScrubberDisplay() {
  const scrubSlider = document.getElementById('tl-scrubber');
  const timeLbl = document.getElementById('tl-time-lbl');
  const countLbl = document.getElementById('tl-count-lbl');

  if (scrubSlider && !isScrubbing) {
    const ratio = (playbackTime / Math.max(0.1, maxTimelineDuration)) * 100;
    scrubSlider.value = ratio.toFixed(1);
  }

  if (timeLbl) {
    const mins = Math.floor(playbackTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(playbackTime % 60).toString().padStart(2, '0');
    const maxMins = Math.floor(maxTimelineDuration / 60).toString().padStart(2, '0');
    const maxSecs = Math.floor(maxTimelineDuration % 60).toString().padStart(2, '0');
    timeLbl.textContent = `${mins}:${secs} / ${maxMins}:${maxSecs}`;
  }

  if (countLbl) {
    const visibleCount = objects.filter(o => o.root && o.root.visible).length;
    countLbl.textContent = `${visibleCount}/${objects.length} OBJS`;
  }
}

export const initHistory4D = init4DTimelineUI;


