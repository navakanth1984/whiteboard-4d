import * as THREE from 'three';
import { register } from '../core/history.js';
import { getSceneState, placeTargets } from '../core/scene.js';

let audioListener = null;

export function ensureAudioListener() {
  const { camera } = getSceneState();
  if (!camera) return null;
  if (!audioListener) {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
  }
  if (audioListener.context.state === 'suspended') {
    audioListener.context.resume();
  }
  return audioListener;
}

// ── 3D Physical Image Panel ──────────────────────────────────
export function addImagePanel(url, pos, ink = '#38bdf8') {
  new THREE.TextureLoader().load(url, tex => {
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;

    const img = tex.image;
    const ar = (img.width && img.height) ? (img.width / img.height) : (16 / 9);
    const h = 4.2;
    const w = h * ar;

    // 1. Front Texture Face
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide });
    const faceGeo = new THREE.PlaneGeometry(w, h);
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.08;

    // 2. Physical Glass Slab Body
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x050d24,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.95
    });
    const slabGeo = new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.15);
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;

    // 3. Glowing Neon Accent Frame Wire
    const edgeGeo = new THREE.EdgesGeometry(slabGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(ink),
      transparent: true,
      opacity: 0.85
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);

    const root = new THREE.Group();
    root.position.copy(pos);
    root.add(slabMesh);
    root.add(faceMesh);
    root.add(edgeLines);
    root.userData.billboardY = true;

    const o = register(root, 'image', 'Image Panel', ink);
    o._blobUrl = url;
    o.collider = slabMesh;
    placeTargets.push(slabMesh);
    return o;
  });
}

// ── 3D Physical Video Panel ──────────────────────────────────
export function makeVideoPanel(vid, pos, hex = '#38bdf8', baseW = 7.5) {
  const ar = (vid.videoWidth && vid.videoHeight) ? (vid.videoWidth / vid.videoHeight) : (16 / 9);
  const w = baseW;
  const h = w / ar;

  const tex = new THREE.VideoTexture(vid);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  // 1. Front Video Face
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide });
  const faceGeo = new THREE.PlaneGeometry(w, h);
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = 0.08;

  // 2. Physical Slab Body
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x050d24,
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.95
  });
  const slabGeo = new THREE.BoxGeometry(w + 0.15, h + 0.15, 0.15);
  const slabMesh = new THREE.Mesh(slabGeo, slabMat);
  slabMesh.castShadow = true;
  slabMesh.receiveShadow = true;

  // 3. Glowing Neon Accent Frame Wire
  const edgeGeo = new THREE.EdgesGeometry(slabGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(hex),
    transparent: true,
    opacity: 0.85
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);

  // 4. Play/Pause Indicator Icon
  const tri = new THREE.Shape();
  tri.moveTo(-0.5, 0.7);
  tri.lineTo(-0.5, -0.7);
  tri.lineTo(0.7, 0);
  tri.lineTo(-0.5, 0.7);
  const icon = new THREE.Mesh(
    new THREE.ShapeGeometry(tri),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })
  );
  icon.position.z = 0.15;
  icon.visible = false;

  const root = new THREE.Group();
  root.position.copy(pos);
  root.add(slabMesh);
  root.add(faceMesh);
  root.add(edgeLines);
  root.add(icon);
  root.userData.billboardY = true;

  return { root, icon, collider: slabMesh };
}

export function addVideoPanel(url, pos, hex = '#38bdf8') {
  const vid = document.createElement('video');
  vid.src = url;
  vid.loop = true;
  vid.muted = true;
  vid.playsInline = true;
  vid.crossOrigin = 'anonymous';
  vid.play().catch(() => {});

  vid.addEventListener('loadeddata', () => {
    const { root, icon, collider } = makeVideoPanel(vid, pos, hex, 7.5);
    const o = register(root, 'video', 'Video Player', hex);
    o.video = vid;
    o.playIcon = icon;
    o._blobUrl = url;
    o.collider = collider;
    placeTargets.push(collider);

    vid.addEventListener('play', () => (icon.visible = false));
    vid.addEventListener('pause', () => (icon.visible = true));
    icon.visible = vid.paused;
  }, { once: true });
}

// ── 3D Spatial Audio Emitter ─────────────────────────────────
export function addSpatialAudio(url, surf, ink = '#a855f7') {
  const listener = ensureAudioListener();
  if (!listener) return;

  const col = new THREE.Color(ink);
  const root = new THREE.Group();
  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, 0.9);

  // Visual Spatial Audio Core
  const bodyGeo = new THREE.SphereGeometry(0.7, 24, 18);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col.clone().multiplyScalar(0.4),
    roughness: 0.2,
    metalness: 0.8
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  root.add(body);

  // Pulse Rings
  const ringGeo = new THREE.RingGeometry(1.2, 1.4, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  root.add(ring);

  const sound = new THREE.PositionalAudio(listener);
  new THREE.AudioLoader().load(url, buf => {
    sound.setBuffer(buf);
    sound.setRefDistance(5);
    sound.setLoop(true);
    sound.play();
  });
  root.add(sound);
  root.userData.spin = true;

  const o = register(root, 'audio', 'Spatial Audio', ink);
  o.sound = sound;
  o._blobUrl = url;
  o.collider = body;
  placeTargets.push(body);
  return o;
}

// ── Live Screen / Window Share to 3D Space ───────────────────
export async function addLiveScreenShare(ink = '#38bdf8') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const vid = document.createElement('video');
    vid.srcObject = stream;
    vid.muted = true;
    vid.playsInline = true;

    const { controls } = getSceneState();
    const pos = controls ? controls.target.clone().add(new THREE.Vector3(0, 3, 0)) : new THREE.Vector3(0, 14, -9);

    const setupPanel = () => {
      const { root, icon, collider } = makeVideoPanel(vid, pos, ink, 11);
      icon.visible = false;
      const o = register(root, 'window', 'Screen Share', ink);
      o.video = vid;
      o.stream = stream;
      o.collider = collider;
      placeTargets.push(collider);

      const trk = stream.getVideoTracks()[0];
      if (trk) {
        trk.onended = () => {
          if (o.root && o.root.parent) o.root.parent.remove(o.root);
        };
      }
    };

    if (vid.readyState >= 1) setupPanel();
    else vid.addEventListener('loadedmetadata', setupPanel, { once: true });
    await vid.play();
  } catch (e) {
    console.warn('Screen share canceled or failed:', e);
  }
}
