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
    roughness: 0.05,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
    hasStand: false,
    hasWheels: false,
    isGlass: true
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

  const slabThick = 0.08;

  // 1. Board Main Writing Slab
  const boardGeo = new THREE.BoxGeometry(cfg.width, cfg.height, slabThick);
  let boardMat;

  if (cfg.isGlass) {
    // Clean, high-clarity translucent cyber glass material with zero Z-fighting
    boardMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(cfg.boardColor),
      emissive: new THREE.Color(cfg.boardColor).multiplyScalar(0.2),
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.82,
      transparent: true,
      opacity: 0.72,
      ior: 1.52,
      depthWrite: true,
      side: THREE.DoubleSide
    });
  } else {
    boardMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.boardColor),
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      side: THREE.DoubleSide
    });
  }

  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.castShadow = !cfg.isGlass;
  boardMesh.receiveShadow = true;
  boardMesh.name = 'BoardSurface';
  root.add(boardMesh);

  // 2. Non-Intersecting Perimeter Frame Rails (No hollow Z-fighting box)
  const railThick = 0.12;
  const railDepth = slabThick + 0.04;
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.frameColor),
    roughness: 0.35,
    metalness: cfg.isGlass ? 0.9 : 0.6
  });

  if (cfg.isGlass) {
    // For Cyber Glassboard: 4 Floating Sleek L-Corner Brackets
    const bracketSize = 0.5;
    const bracketThick = 0.08;
    const bracketDepth = slabThick + 0.06;
    const bracketMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.frameColor),
      emissive: new THREE.Color(colorHex).multiplyScalar(0.4),
      roughness: 0.2,
      metalness: 0.9
    });

    const corners = [
      { x: -cfg.width / 2, y: cfg.height / 2 },
      { x: cfg.width / 2, y: cfg.height / 2 },
      { x: -cfg.width / 2, y: -cfg.height / 2 },
      { x: cfg.width / 2, y: -cfg.height / 2 }
    ];

    corners.forEach(c => {
      const bH = new THREE.Mesh(new THREE.BoxGeometry(bracketSize, bracketThick, bracketDepth), bracketMat);
      bH.position.set(c.x + (c.x > 0 ? -bracketSize / 2 : bracketSize / 2), c.y + (c.y > 0 ? -bracketThick / 2 : bracketThick / 2), 0);
      root.add(bH);

      const bV = new THREE.Mesh(new THREE.BoxGeometry(bracketThick, bracketSize, bracketDepth), bracketMat);
      bV.position.set(c.x + (c.x > 0 ? -bracketThick / 2 : bracketThick / 2), c.y + (c.y > 0 ? -bracketSize / 2 : bracketSize / 2), 0);
      root.add(bV);
    });

    // Glass edge neon outline
    const edgeGeo = new THREE.EdgesGeometry(boardGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.85
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    root.add(edgeLines);

  } else {
    // For Whiteboard / Chalkboard: 4 Perimeter Rails around the borders
    // Top & Bottom Rails
    const hRailGeo = new THREE.BoxGeometry(cfg.width + railThick * 2, railThick, railDepth);
    const topRail = new THREE.Mesh(hRailGeo, frameMat);
    topRail.position.set(0, cfg.height / 2 + railThick / 2, 0);
    topRail.castShadow = true;
    root.add(topRail);

    const botRail = new THREE.Mesh(hRailGeo, frameMat);
    botRail.position.set(0, -cfg.height / 2 - railThick / 2, 0);
    botRail.castShadow = true;
    root.add(botRail);

    // Left & Right Rails
    const vRailGeo = new THREE.BoxGeometry(railThick, cfg.height, railDepth);
    const leftRail = new THREE.Mesh(vRailGeo, frameMat);
    leftRail.position.set(-cfg.width / 2 - railThick / 2, 0, 0);
    leftRail.castShadow = true;
    root.add(leftRail);

    const rightRail = new THREE.Mesh(vRailGeo, frameMat);
    rightRail.position.set(cfg.width / 2 + railThick / 2, 0, 0);
    rightRail.castShadow = true;
    root.add(rightRail);
  }

  // 3. Marker / Chalk Shelf Tray (for Whiteboard, Chalkboard, Smartboard)
  if (!cfg.isGlass) {
    const trayGeo = new THREE.BoxGeometry(cfg.width * 0.75, 0.08, 0.32);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 });
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.position.set(0, -cfg.height * 0.5 - railThick - 0.04, 0.14);
    root.add(trayMesh);

    // Markers / Eraser
    const markerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8);
    markerGeo.rotateZ(Math.PI / 2);
    const m1 = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    m1.position.set(-1.0, -cfg.height * 0.5 - railThick, 0.16);
    root.add(m1);

    const m2 = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
    m2.position.set(-0.4, -cfg.height * 0.5 - railThick, 0.16);
    root.add(m2);

    const eraserGeo = new THREE.BoxGeometry(0.48, 0.08, 0.18);
    const eraser = new THREE.Mesh(eraserGeo, new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 }));
    eraser.position.set(0.6, -cfg.height * 0.5 - railThick, 0.16);
    root.add(eraser);
  }

  // 4. Stand and Wheels (if enabled)
  if (cfg.hasStand) {
    const standMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.standColor), roughness: 0.3, metalness: 0.85 });
    const legHeight = cfg.height + 2.4;
    const legGeo = new THREE.CylinderGeometry(0.07, 0.07, legHeight, 12);

    const lLeg = new THREE.Mesh(legGeo, standMat);
    lLeg.position.set(-cfg.width * 0.46, -1.0, 0);
    lLeg.castShadow = true;
    root.add(lLeg);

    const rLeg = new THREE.Mesh(legGeo, standMat);
    rLeg.position.set(cfg.width * 0.46, -1.0, 0);
    rLeg.castShadow = true;
    root.add(rLeg);

    // Crossbar
    const barGeo = new THREE.CylinderGeometry(0.05, 0.05, cfg.width * 0.92, 12);
    barGeo.rotateZ(Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, standMat);
    bar.position.set(0, -cfg.height * 0.5 - 1.2, 0);
    root.add(bar);

    // Wheeled base feet
    if (cfg.hasWheels) {
      [-cfg.width * 0.46, cfg.width * 0.46].forEach(x => {
        const footGeo = new THREE.BoxGeometry(0.12, 0.08, 1.4);
        const foot = new THREE.Mesh(footGeo, standMat);
        foot.position.set(x, -cfg.height * 0.5 - 1.8, 0);
        foot.castShadow = true;
        root.add(foot);

        // Castor Wheels
        [-0.55, 0.55].forEach(z => {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.2 })
          );
          wheel.rotateZ(Math.PI / 2);
          wheel.position.set(x, -cfg.height * 0.5 - 1.88, z);
          wheel.castShadow = true;
          root.add(wheel);
        });
      });
    }
  }

  // 5. Direct Surface Drawing Group attached in local coordinates
  const strokeGroup = new THREE.Group();
  strokeGroup.name = 'BoardLocalStrokes';
  strokeGroup.position.z = slabThick * 0.5 + 0.015; // Slightly in front of board surface
  root.add(strokeGroup);

  // Surface Raycast Collider for writing
  const surfaceColliderGeo = new THREE.PlaneGeometry(cfg.width, cfg.height);
  const surfaceColliderMat = new THREE.MeshBasicMaterial({ visible: false });
  const surfaceCollider = new THREE.Mesh(surfaceColliderGeo, surfaceColliderMat);
  surfaceCollider.position.z = slabThick * 0.5 + 0.01;
  surfaceCollider.userData.isBoardSurface = true;
  surfaceCollider.userData.boardRoot = root;
  surfaceCollider.userData.strokeGroup = strokeGroup;
  surfaceCollider.userData.boardWidth = cfg.width;
  surfaceCollider.userData.boardHeight = cfg.height;
  root.add(surfaceCollider);

  const { placeTargets } = getSceneState();
  if (placeTargets) {
    placeTargets.push(surfaceCollider);
  }

  // Register in canvas history
  const record = register(root, 'mini_board', cfg.label, colorHex);
  record.strokeGroup = strokeGroup;
  record.surfaceMesh = surfaceCollider;
  record.boardStyle = styleKey;
  record.isBoard = true;

  return record;
}
