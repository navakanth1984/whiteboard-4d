import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';
import { register, objects } from '../core/history.js';

export const BOARD_STYLES = {
  whiteboard: {
    label: 'Classroom Whiteboard',
    desc: 'Glossy magnetic lecture whiteboard on rolling stand',
    width: 6.8,
    height: 4.2,
    boardColor: 0xf8fafc,
    frameColor: 0x475569,
    standColor: 0x334155,
    roughness: 0.15,
    metalness: 0.1,
    hasStand: true,
    hasWheels: true
  },
  chalkboard: {
    label: 'Academic Chalkboard',
    desc: 'Deep slate blackboard with natural oak wood frame',
    width: 7.2,
    height: 4.4,
    boardColor: 0x1e293b,
    frameColor: 0x78350f,
    standColor: 0x451a03,
    roughness: 0.85,
    metalness: 0.05,
    hasStand: true,
    hasWheels: false
  },
  glassboard: {
    label: 'Cyber Glass Drafting Board',
    desc: 'Floating semi-transparent holographic glass with neon brackets',
    width: 6.5,
    height: 4.0,
    boardColor: 0x0ea5e9,
    frameColor: 0x38bdf8,
    standColor: 0x0284c7,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.65,
    hasStand: false,
    hasWheels: false
  },
  smartboard: {
    label: 'Lecture Smart Board',
    desc: 'Digital interactive smart panel with telemetry bezel',
    width: 7.5,
    height: 4.5,
    boardColor: 0x090f24,
    frameColor: 0x1e293b,
    standColor: 0x0f172a,
    roughness: 0.2,
    metalness: 0.7,
    hasStand: true,
    hasWheels: true,
    isDigital: true
  }
};

export let curBoardStyle = 'whiteboard';

export function setCurBoardStyle(styleKey) {
  if (BOARD_STYLES[styleKey]) {
    curBoardStyle = styleKey;
  }
}

export function addMiniBoard(options = {}) {
  const { scene } = getSceneState();
  if (!scene) return null;

  const styleKey = options.styleKey || curBoardStyle;
  const cfg = BOARD_STYLES[styleKey] || BOARD_STYLES.whiteboard;
  const position = options.position || new THREE.Vector3(0, 4.5, -5);
  const colorHex = options.colorHex || '#38bdf8';

  const root = new THREE.Group();
  root.position.copy(position);
  root.userData.type = 'mini_board';
  root.userData.boardStyle = styleKey;

  // 1. Board Main Writing Slab
  const boardGeo = new THREE.BoxGeometry(cfg.width, cfg.height, 0.12);
  let boardMat;

  if (cfg.transparent) {
    boardMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.boardColor),
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.7,
      transparent: true,
      opacity: cfg.opacity,
      reflectivity: 0.9
    });
  } else {
    boardMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.boardColor),
      roughness: cfg.roughness,
      metalness: cfg.metalness
    });
  }

  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  boardMesh.name = 'BoardSurface';
  root.add(boardMesh);

  // 2. Outer Frame Bezel
  const frameThick = 0.15;
  const frameGeo = new THREE.BoxGeometry(cfg.width + frameThick * 2, cfg.height + frameThick * 2, 0.16);
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.frameColor),
    roughness: 0.35,
    metalness: 0.8
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.z = -0.02;
  frameMesh.castShadow = true;
  root.add(frameMesh);

  // 3. Frame Edge Glow / Accents
  const edgeGeo = new THREE.EdgesGeometry(frameGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.6
  });
  const frameEdges = new THREE.LineSegments(edgeGeo, edgeMat);
  frameEdges.position.z = -0.02;
  root.add(frameEdges);

  // 4. Marker / Chalk Shelf Tray
  const trayGeo = new THREE.BoxGeometry(cfg.width * 0.75, 0.08, 0.35);
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 });
  const trayMesh = new THREE.Mesh(trayGeo, trayMat);
  trayMesh.position.set(0, -cfg.height * 0.5 - 0.05, 0.16);
  root.add(trayMesh);

  // Colored Markers / Eraser on tray
  const markerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
  markerGeo.rotateZ(Math.PI / 2);
  const m1 = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  m1.position.set(-1.0, -cfg.height * 0.5, 0.18);
  root.add(m1);

  const m2 = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
  m2.position.set(-0.4, -cfg.height * 0.5, 0.18);
  root.add(m2);

  const eraserGeo = new THREE.BoxGeometry(0.5, 0.1, 0.2);
  const eraser = new THREE.Mesh(eraserGeo, new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 }));
  eraser.position.set(0.6, -cfg.height * 0.5, 0.18);
  root.add(eraser);

  // 5. Stand and Wheels (if enabled)
  if (cfg.hasStand) {
    const standMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.standColor), roughness: 0.3, metalness: 0.85 });
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, cfg.height + 2.5, 12);

    const lLeg = new THREE.Mesh(legGeo, standMat);
    lLeg.position.set(-cfg.width * 0.46, -1.0, 0);
    lLeg.castShadow = true;
    root.add(lLeg);

    const rLeg = new THREE.Mesh(legGeo, standMat);
    rLeg.position.set(cfg.width * 0.46, -1.0, 0);
    rLeg.castShadow = true;
    root.add(rLeg);

    // Crossbar
    const barGeo = new THREE.CylinderGeometry(0.06, 0.06, cfg.width * 0.92, 12);
    barGeo.rotateZ(Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, standMat);
    bar.position.set(0, -cfg.height * 0.5 - 1.2, 0);
    root.add(bar);

    // Base Feet & Rolling Wheels
    const footGeo = new THREE.BoxGeometry(0.14, 0.12, 1.8);
    const lFoot = new THREE.Mesh(footGeo, standMat);
    lFoot.position.set(-cfg.width * 0.46, -cfg.height * 0.5 - 2.2, 0);
    root.add(lFoot);

    const rFoot = new THREE.Mesh(footGeo, standMat);
    rFoot.position.set(cfg.width * 0.46, -cfg.height * 0.5 - 2.2, 0);
    root.add(rFoot);

    if (cfg.hasWheels) {
      const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

      [-0.7, 0.7].forEach(zOffset => {
        const lw = new THREE.Mesh(wheelGeo, wheelMat);
        lw.position.set(-cfg.width * 0.46, -cfg.height * 0.5 - 2.32, zOffset);
        root.add(lw);

        const rw = new THREE.Mesh(wheelGeo, wheelMat);
        rw.position.set(cfg.width * 0.46, -cfg.height * 0.5 - 2.32, zOffset);
        root.add(rw);
      });
    }
  }

  // 6. Child Stroke Group (for direct local surface writing)
  const strokeGroup = new THREE.Group();
  strokeGroup.name = 'BoardLocalStrokes';
  strokeGroup.position.set(0, 0, 0.07); // slightly in front of surface
  root.add(strokeGroup);

  // 7. Register collider for surface raycasting
  const collider = boardMesh;
  collider.userData.boardRoot = root;
  collider.userData.isBoardSurface = true;
  collider.userData.strokeGroup = strokeGroup;

  const { placeTargets } = getSceneState();
  if (placeTargets) {
    placeTargets.push(collider);
  }

  scene.add(root);

  const objRecord = {
    id: 'board_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    root,
    collider,
    surfaceMesh: boardMesh,
    strokeGroup,
    label: cfg.label,
    type: 'mini_board',
    styleKey,
    clearStrokes: () => {
      while (strokeGroup.children.length > 0) {
        const c = strokeGroup.children[0];
        strokeGroup.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      }
    }
  };

  register(objRecord);
  return objRecord;
}
