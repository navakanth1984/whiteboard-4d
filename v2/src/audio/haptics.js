// v2/src/audio/haptics.js — Procedural Synthesized Cyber Micro-Audio & Mobile Haptics
let audioCtx = null;
let isAudioEnabled = true;

/**
 * Initializes the procedural Web Audio synthesizer and unlocks on user interaction
 */
export function initHapticsAudioSystem() {
  const unlock = () => {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('click', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock);

  // Attach hover sounds to toolbar buttons
  attachUIHoverListeners();
}

function getContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Plays a tactile sub-20ms cyber pop on button / card hover
 */
export function playHoverSound() {
  if (!isAudioEnabled) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.018);

  gain.gain.setValueAtTime(0.02, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.018);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.018);
}

/**
 * Plays a sharp tactile cyber click on selection or mode switch
 */
export function playClickSound() {
  if (!isAudioEnabled) return;
  triggerHaptic(8);
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(2200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.035);

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.035);
}

/**
 * Plays a smooth aerodynamic vacuum whoosh on Delete, Undo, or Teleport
 */
export function playWhoosh() {
  if (!isAudioEnabled) return;
  triggerHaptic(15);
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.18);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.18);

  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

/**
 * Plays a harmonic crystal chime on object snap or link creation
 */
export function playSnapChime() {
  if (!isAudioEnabled) return;
  triggerHaptic([10, 20, 15]);
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;

  const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  freqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.025);

    gain.gain.setValueAtTime(0.03, ctx.currentTime + idx * 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.025 + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + idx * 0.025);
    osc.stop(ctx.currentTime + idx * 0.025 + 0.25);
  });
}

/**
 * Triggers hardware haptic vibration on mobile devices
 * @param {number|number[]} pattern Duration in ms or vibration pattern array
 */
export function triggerHaptic(pattern = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function attachUIHoverListeners() {
  document.querySelectorAll('button, .dock-btn, .view-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', () => playHoverSound());
    btn.addEventListener('click', () => playClickSound());
  });
}
