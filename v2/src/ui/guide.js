// v2/src/ui/guide.js — Master Spatial Studio Guide & Interactive User Manual
import { playHoverSound, playClickSound, playWhoosh } from '../audio/haptics.js';

let guideStep = 0;
const GUIDE_TOTAL = 6;

export function goGuideStep(next, direction = 'fwd') {
  const steps = [];
  for (let i = 0; i < GUIDE_TOTAL; i++) {
    steps.push(document.getElementById(`gstep-${i}`));
  }
  const dots = document.querySelectorAll('.gdot');

  if (!steps[guideStep] || !steps[next]) return;

  steps[guideStep].classList.remove('active', 'back-anim');
  guideStep = Math.max(0, Math.min(GUIDE_TOTAL - 1, next));
  steps[guideStep].classList.add('active');

  if (direction === 'back') {
    steps[guideStep].classList.add('back-anim');
  }

  dots.forEach((d, i) => d.classList.toggle('active', i === guideStep));

  const isLast = guideStep === GUIDE_TOTAL - 1;
  const guideNav = document.getElementById('guide-nav');
  const guideBack = document.getElementById('guide-back');

  if (guideNav) guideNav.style.display = isLast ? 'none' : 'flex';
  if (guideBack) guideBack.style.visibility = guideStep === 0 ? 'hidden' : 'visible';

  playHoverSound();
}

export function showGuide() {
  const overlay = document.getElementById('guide-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    goGuideStep(0, 'fwd');
  }
}

export function hideGuide() {
  const overlay = document.getElementById('guide-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    playWhoosh();
  }
}

export function initGuide() {
  const nextBtn = document.getElementById('guide-next');
  const backBtn = document.getElementById('guide-back');
  const startBtn = document.getElementById('guide-start-btn');
  const skipBtn = document.getElementById('guide-skip-btn');
  const btnGuide = document.getElementById('btn-guide');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      playClickSound();
      goGuideStep(guideStep + 1, 'fwd');
    });
  }
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      playClickSound();
      goGuideStep(guideStep - 1, 'back');
    });
  }
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      hideGuide();
      try {
        localStorage.setItem('bleuuboard_guided', '1');
      } catch (err) {}
    });
  }
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      hideGuide();
      try {
        localStorage.setItem('bleuuboard_guided', '1');
      } catch (err) {}
    });
  }
  if (btnGuide) {
    btnGuide.addEventListener('click', () => {
      showGuide();
    });
  }

  // Click direct dots to jump to any chapter
  document.querySelectorAll('.gdot').forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      goGuideStep(idx, idx < guideStep ? 'back' : 'fwd');
    });
    dot.style.cursor = 'pointer';
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('guide-overlay');
      if (overlay && overlay.style.display === 'flex') {
        hideGuide();
      }
    }
  });

  // Automatically show on initial visit if not previously dismissed
  try {
    if (!localStorage.getItem('bleuuboard_guided')) {
      showGuide();
    }
  } catch (err) {}
}

export const initGuideSystem = initGuide;


