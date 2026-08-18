// v2/src/fx/postprocessing.js — Selective Neon Bloom Post-Processing FX Pipeline
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getSceneState } from '../core/scene.js';
import { detectDeviceTier, getDeviceBudget } from '../core/device_tier.js';

let composer = null;
let renderPass = null;
let bloomPass = null;
let outputPass = null;
let isBloomActive = true;

const BLOOM_PARAMS = {
  threshold: 0.82,
  strength: 0.75,
  radius: 0.45
};

/**
 * Initializes the Selective Neon Bloom Post-Processing Pipeline
 */
export function initPostProcessingSystem() {
  const state = getSceneState();
  if (state.composer) {
    composer = state.composer;
    bloomPass = state.bloomPass;
    return;
  }

  const { renderer, scene, camera } = state;
  if (!renderer || !scene || !camera) return;

  const budget = getDeviceBudget ? getDeviceBudget() : { tier: 'desktop', targetDPR: 1.0 };
  const width = window.innerWidth;
  const height = window.innerHeight;

  // On low-tier mobile devices, reduce resolution or skip
  const isMobile = budget.tier === 'mobile';
  const renderTargetScale = isMobile ? 0.75 : 1.0;

  try {
    const renderTarget = new THREE.WebGLRenderTarget(
      Math.floor(width * renderTargetScale),
      Math.floor(height * renderTargetScale),
      {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: tier.isMobile ? 0 : 2
      }
    );

    composer = new EffectComposer(renderer, renderTarget);

    // 1. Base Scene Render Pass
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 2. Selective Neon Unreal Bloom Pass
    const bloomResolution = new THREE.Vector2(
      Math.floor(width * renderTargetScale),
      Math.floor(height * renderTargetScale)
    );
    bloomPass = new UnrealBloomPass(
      bloomResolution,
      BLOOM_PARAMS.strength,
      BLOOM_PARAMS.radius,
      BLOOM_PARAMS.threshold
    );
    composer.addPass(bloomPass);

    // 3. Color Management Output Pass
    outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Window Resize Handler
    window.addEventListener('resize', onWindowResize);
  } catch (e) {
    console.warn('Post-Processing Bloom initialization fallback:', e);
    composer = null;
  }
}

/**
 * Renders the frame using the post-processing composer (or fallback to renderer)
 */
export function renderPostProcessingFrame() {
  const { renderer, scene, camera } = getSceneState();
  if (composer && isBloomActive) {
    composer.render();
  } else if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function onWindowResize() {
  if (!composer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  composer.setSize(width, height);
}

export function setBloomEnabled(enabled) {
  isBloomActive = !!enabled;
  return isBloomActive;
}

export function setBloomStrength(val) {
  if (bloomPass) {
    bloomPass.strength = Math.max(0, Math.min(3.0, val));
  }
}

export function isBloomEnabled() {
  return isBloomActive && !!composer;
}

export function getBloomParams() {
  return {
    isActive: isBloomActive,
    hasComposer: !!composer,
    params: BLOOM_PARAMS
  };
}

export const initPostprocessing = initPostProcessingSystem;

