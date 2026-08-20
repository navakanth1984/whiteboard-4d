// v2/src/core/holodeck.js — 360° Procedural Skybox & Holodeck Environment Engine
import * as THREE from 'three';
import { getSceneState } from './scene.js';

export const ENVIRONMENTS = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Void',
    bgColor: 0x020617,
    ambientColor: 0x0f172a,
    ambientIntensity: 3.2,
    sunColor: 0xffffff,
    sunIntensity: 2.8,
    gridColor: 0x1e293b,
    gridCenter: 0x38bdf8,
    fogDensity: 0.008
  },
  vaporwave: {
    id: 'vaporwave',
    name: 'Vaporwave Sunset',
    bgColor: 0x2e0854,
    ambientColor: 0x4a0e4e,
    ambientIntensity: 3.5,
    sunColor: 0xf43f5e,
    sunIntensity: 3.2,
    gridColor: 0x701a75,
    gridCenter: 0xf472b6,
    fogDensity: 0.012
  },
  studio: {
    id: 'studio',
    name: 'Architect Studio',
    bgColor: 0xf8fafc,
    ambientColor: 0xe2e8f0,
    ambientIntensity: 4.0,
    sunColor: 0xffffff,
    sunIntensity: 3.0,
    gridColor: 0xcbd5e1,
    gridCenter: 0x0284c7,
    fogDensity: 0.005
  },
  nebula: {
    id: 'nebula',
    name: 'Deep Space Nebula',
    bgColor: 0x030712,
    ambientColor: 0x1e1b4b,
    ambientIntensity: 2.8,
    sunColor: 0x38bdf8,
    sunIntensity: 3.5,
    gridColor: 0x312e81,
    gridCenter: 0x818cf8,
    fogDensity: 0.006
  }
};

export const HOLODECK_PRESETS = ENVIRONMENTS;

let currentEnvId = 'cyber';
let skyMesh = null;

/**
 * Initializes the Holodeck Procedural Skybox & Dynamic Atmosphere
 */
export function initHolodeckSystem() {
  createProceduralSkyDome();
  initHolodeckUI();
}

function createProceduralSkyDome() {
  const { scene } = getSceneState();
  if (!scene) return;

  const skyGeo = new THREE.SphereGeometry(150, 32, 16);
  // Invert normals to view inside the sphere
  skyGeo.scale(-1, 1, 1);

  const skyMat = new THREE.MeshBasicMaterial({
    color: ENVIRONMENTS[currentEnvId].bgColor,
    side: THREE.BackSide
  });

  skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'HolodeckSkyDome';
  scene.add(skyMesh);
}

/**
 * Switches the 3D studio environment and lighting dynamically
 */
export function setEnvironment(envId) {
  const env = ENVIRONMENTS[envId];
  if (!env) return false;

  currentEnvId = envId;
  const { scene, renderer } = getSceneState();
  if (!scene) return false;

  // 1. Update background & Sky Dome
  if (scene.background) scene.background.set(env.bgColor);
  if (skyMesh && skyMesh.material) {
    skyMesh.material.color.set(env.bgColor);
  }

  // 2. Update Scene Fog if present
  if (scene.fog) {
    scene.fog.color.set(env.bgColor);
    scene.fog.density = env.fogDensity;
  }

  // 3. Update Lights
  scene.traverse(child => {
    if (child.isAmbientLight) {
      child.color.set(env.ambientColor);
      child.intensity = env.ambientIntensity;
    } else if (child.isDirectionalLight) {
      child.color.set(env.sunColor);
      child.intensity = env.sunIntensity;
    }
  });

  return true;
}

export function getCurrentEnvironment() {
  return currentEnvId;
}

export function getAvailableEnvironments() {
  return Object.values(ENVIRONMENTS);
}

function initHolodeckUI() {
  // Can be triggered from background picker or console probe
  const pickBg = document.getElementById('pick-bg');
  if (pickBg) {
    pickBg.addEventListener('input', (e) => {
      const col = e.target.value;
      const { scene } = getSceneState();
      if (scene && scene.background) scene.background.set(col);
      if (skyMesh) skyMesh.material.color.set(col);
    });
  }
}

export const initHolodeck = initHolodeckSystem;
export const setHolodeckAtmosphere = setEnvironment;
export function toggleHolodeckMenu() {}

