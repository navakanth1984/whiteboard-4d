import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

export const HOME_POS = new THREE.Vector3(0, 11, 24);
export const HOME_TGT = new THREE.Vector3(0, 11, -9);

export let canvas = null;
export let renderer = null;
export let scene = null;
export let camera = null;
export let controls = null;
export let composer = null;
export let bloomPass = null;
export let outlinePass = null;

export function getSceneState() {
  return { canvas, renderer, scene, camera, controls, composer, bloomPass, outlinePass, placeTargets };
}

export let ambient = null;
export let sun = null;
export let fill = null;
export let floor = null;
export let wall = null;
export let wEdge = null;
export let grid = null;
export let placeTargets = [];

// Dust particle system
export let dustGeo = null;
export let dustPositions = null;
export let dustVelocities = [];
export const dustCount = 180;

// 4D Tesseract backdrop
let tGrp = null;
let v4 = [];
let e4 = [];
let eObjs = [];

export function initScene(canvasEl) {
  canvas = canvasEl || document.getElementById('c');

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (e) {
    console.warn('WebGL fallback in initScene', e);
    renderer = { render: () => {}, setSize: () => {}, shadowMap: { enabled: false, type: null } };
  }

  // Scene
  scene = new THREE.Scene();
  const bgCol = new THREE.Color(0x00000d);
  scene.background = bgCol;
  scene.fog = new THREE.FogExp2(bgCol.clone(), 0.010);

  // Camera & OrbitControls
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 10000);
  camera.position.copy(HOME_POS);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.5;
  controls.maxDistance = 2000;
  controls.target.copy(HOME_TGT);

  // Postprocessing (Composer / Bloom / Outline)
  if (renderer instanceof THREE.WebGLRenderer) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
      outlinePass.edgeStrength = 4.0;
      outlinePass.edgeGlow = 1.2;
      outlinePass.edgeThickness = 1.5;
      outlinePass.pulsePeriod = 2.2;
      outlinePass.visibleEdgeColor.set(0x66d9ff);
      outlinePass.hiddenEdgeColor.set(0x1a3a55);
      outlinePass.selectedObjects = [];
      composer.addPass(outlinePass);

      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.75,
        0.65,
        0.55
      );
      composer.addPass(bloomPass);
    } catch (e) {
      console.error('Bloom/Outline postprocessing unavailable, falling back to plain render:', e);
      composer = null;
    }
  }

  // Lights & Cyber Glow Studio Environment
  ambient = new THREE.AmbientLight(0x0f172a, 3.2);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(20, 35, 20);
  sun.castShadow = true;
  sun.target.position.copy(HOME_TGT);
  scene.add(sun.target);
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -50;
  sun.shadow.camera.right = sun.shadow.camera.top = 50;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Key Rim Lighting (Electric Cyan & Neon Violet)
  const rimCyan = new THREE.PointLight(0x38bdf8, 3.5, 120);
  rimCyan.position.set(-18, 16, 8);
  scene.add(rimCyan);

  const rimViolet = new THREE.PointLight(0xa855f7, 3.0, 120);
  rimViolet.position.set(18, 16, 8);
  scene.add(rimViolet);

  // Surfaces
  // Studio Cyber Grid & Floor
  placeTargets = [];
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  floorGeo.rotateX(-Math.PI / 2);
  floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.85, metalness: 0.2 }));
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);
  placeTargets.push(floor);

  grid = new THREE.GridHelper(160, 80, 0x38bdf8, 0x1e293b);
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  const wallGeo = new THREE.PlaneGeometry(60, 30);
  wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, transparent: true, opacity: 0.45, side: THREE.FrontSide }));
  wall.position.set(0, 15, -12);
  wall.name = 'wall';
  wall.receiveShadow = true;
  scene.add(wall);
  placeTargets.push(wall);

  wEdge = new THREE.LineSegments(new THREE.EdgesGeometry(wallGeo), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 }));
  wEdge.position.copy(wall.position);
  scene.add(wEdge);

  // Deep Space Atmosphere
  const N = 4000;
  const p = new Float32Array(N * 3);
  const c = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 500 + Math.random() * 1200;
    const t = Math.random() * Math.PI * 2;
    const a = Math.acos(2 * Math.random() - 1);
    p[i * 3] = r * Math.sin(a) * Math.cos(t);
    p[i * 3 + 1] = r * Math.sin(a) * Math.sin(t);
    p[i * 3 + 2] = r * Math.cos(a);
    const b = 0.4 + Math.random() * 0.6;
    c[i * 3] = b * 0.7;
    c[i * 3 + 1] = b * 0.85;
    c[i * 3 + 2] = b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.5 })));

  // Resize handler
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, controls, composer };
}

export function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  if (outlinePass) outlinePass.setSize(window.innerWidth, window.innerHeight);
}

function proj4(v, wx, wy) {
  let [x, y, z, w] = v;
  let x2 = x * Math.cos(wx) - w * Math.sin(wx), w2 = x * Math.sin(wx) + w * Math.cos(wx);
  let y2 = y * Math.cos(wy) - w2 * Math.sin(wy), w3 = y * Math.sin(wy) + w2 * Math.cos(wy);
  const d = 2.8 / (2.8 - w3);
  return new THREE.Vector3(x2 * d * 20, y2 * d * 20, z * d * 20);
}

export function updateTesseract(t) {
  if (!tGrp || eObjs.length === 0) return;
  const p = v4.map(v => proj4(v, t * 0.25, t * 0.15));
  e4.forEach(([i, j], k) => {
    const a = p[i], b = p[j];
    const at = eObjs[k].geo.attributes.position;
    at.setXYZ(0, a.x, a.y, a.z);
    at.setXYZ(1, b.x, b.y, b.z);
    at.needsUpdate = true;
  });
  tGrp.rotation.y = t * 0.06;
}

export function updateDust(dt) {
  if (!dustGeo) return;
  const posArr = dustGeo.attributes.position.array;
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3 + 1] += dustVelocities[i].y * dt;
    dustPositions[i * 3] += dustVelocities[i].x * dt;
    dustPositions[i * 3 + 2] += dustVelocities[i].z * dt;
    if (posArr[i * 3 + 1] > 20) {
      posArr[i * 3 + 1] = 0;
      posArr[i * 3] = (Math.random() - 0.5) * 60;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
}

export function render(interp, o) {
  if (composer) {
    composer.render();
  } else if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
