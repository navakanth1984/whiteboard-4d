import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getSceneState } from '../core/scene.js';

export const GENDERS = {
  female: {
    label: 'Female Cyber Architect',
    torsoScale: [0.72, 1.05, 0.42],
    shoulderWidth: 0.85,
    hipWidth: 0.78,
    height: 2.25,
    hairStyle: 'bob',
    hairColor: '#f43f5e',
    jacketColor: 0x0f172a
  },
  male: {
    label: 'Male Cyber Architect',
    torsoScale: [0.92, 1.15, 0.52],
    shoulderWidth: 1.12,
    hipWidth: 0.74,
    height: 2.42,
    hairStyle: 'tactical',
    hairColor: '#0ea5e9',
    jacketColor: 0x090f24
  },
  nonbinary: {
    label: 'Cyber Android (Non-Binary)',
    torsoScale: [0.82, 1.10, 0.46],
    shoulderWidth: 0.98,
    hipWidth: 0.76,
    height: 2.35,
    hairStyle: 'holo_crest',
    hairColor: '#a855f7',
    jacketColor: 0x030712
  },
  custom: {
    label: 'AccuRig / Custom Humanoid Avatar',
    torsoScale: [0.80, 1.10, 0.45],
    shoulderWidth: 0.95,
    hipWidth: 0.75,
    height: 2.30,
    hairStyle: 'custom',
    hairColor: '#38bdf8',
    jacketColor: 0x0f172a
  }
};

export const SKIN_TONES = [
  '#ffd1b3', // Fair
  '#e0a97c', // Warm
  '#b07a53', // Tan
  '#6b4423', // Deep
  '#00f0ff', // Cyber Neon
  '#94a3b8'  // Chrome Android
];

export let avatarConfig = {
  gender: 'female',
  skinTone: '#ffd1b3',
  suitColor: '#38bdf8',
  executionMode: 'avatar', // 'direct' or 'avatar'
  povMode: 'tps' // 'fps', 'tps', 'orbit'
};

export let avatarRoot = null;
export let fpHandRoot = null;
export let customAvatarModel = null;
export let customMixer = null;

// Rig Limb References for Kinematics
let rig = {
  pelvis: null,
  torso: null,
  chest: null,
  neck: null,
  head: null,
  visor: null,
  lShoulder: null,
  lUpperArm: null,
  lForearm: null,
  lHand: null,
  rShoulder: null,
  rUpperArm: null,
  rForearm: null,
  rHand: null,
  rStylus: null,
  stylusTip: null,
  lThighGroup: null,
  lCalfGroup: null,
  lBoot: null,
  rThighGroup: null,
  rCalfGroup: null,
  rBoot: null
};

let laserBeam = null;
let currentAction = null;
let actionTimer = 0;
let animWalkTime = 0;

export function setAvatarConfig(cfg) {
  Object.assign(avatarConfig, cfg);
  rebuildAvatar();
  rebuildFPHand();
}

export function setExecutionMode(mode) {
  setAvatarConfig({ executionMode: mode });
}

export function setAvatarPreset(gender) {
  setAvatarConfig({ gender });
}

export function setAvatarSkinTone(skinTone) {
  setAvatarConfig({ skinTone });
}


export function initAvatarSystem() {
  const { scene } = getSceneState();
  if (!scene) return;

  avatarRoot = new THREE.Group();
  avatarRoot.name = 'SpatialAvatar';
  avatarRoot.position.set(0, 0, 5);
  scene.add(avatarRoot);

  rebuildAvatar();
  initFPHand();
}

export function rebuildAvatar() {
  if (!avatarRoot) return;
  while (avatarRoot.children.length > 0) {
    avatarRoot.remove(avatarRoot.children[0]);
  }

  if (avatarConfig.gender === 'custom' && customAvatarModel) {
    avatarRoot.add(customAvatarModel);
    return;
  }

  const spec = GENDERS[avatarConfig.gender] || GENDERS.female;
  const suitCol = new THREE.Color(avatarConfig.suitColor);
  const skinCol = new THREE.Color(avatarConfig.skinTone);
  const darkClothMat = new THREE.MeshStandardMaterial({
    color: spec.jacketColor,
    roughness: 0.45,
    metalness: 0.35
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: suitCol,
    emissive: suitCol.clone().multiplyScalar(0.55),
    roughness: 0.2,
    metalness: 0.8
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinCol,
    roughness: 0.55,
    metalness: 0.1
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: suitCol,
    emissive: suitCol,
    emissiveIntensity: 1.4,
    roughness: 0.1,
    metalness: 0.95,
    transparent: true,
    opacity: 0.9
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.9
  });

  // 1. Pelvis / Base Center
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.15;
  avatarRoot.add(pelvis);

  // 2. Torso & Tech Jacket
  const torsoGroup = new THREE.Group();
  pelvis.add(torsoGroup);

  const torsoGeo = new THREE.CylinderGeometry(spec.torsoScale[0] * 0.48, spec.torsoScale[0] * 0.42, spec.torsoScale[1], 16);
  const torso = new THREE.Mesh(torsoGeo, darkClothMat);
  torso.position.y = spec.torsoScale[1] * 0.5;
  torso.castShadow = true;
  torsoGroup.add(torso);

  // Chest Armor & Glowing Energy Reactor
  const chestPlate = new THREE.Mesh(
    new THREE.BoxGeometry(spec.torsoScale[0] * 0.85, spec.torsoScale[1] * 0.45, spec.torsoScale[2] * 0.4),
    darkClothMat
  );
  chestPlate.position.set(0, spec.torsoScale[1] * 0.65, spec.torsoScale[2] * 0.38);
  torsoGroup.add(chestPlate);

  const coreGeo = new THREE.SphereGeometry(0.1, 16, 16);
  const core = new THREE.Mesh(coreGeo, visorMat);
  core.position.set(0, spec.torsoScale[1] * 0.65, spec.torsoScale[2] * 0.55);
  torsoGroup.add(core);

  // Collar
  const collarGeo = new THREE.TorusGeometry(0.22, 0.05, 8, 16);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, accentMat);
  collar.position.set(0, spec.torsoScale[1] * 0.98, 0);
  torsoGroup.add(collar);

  // 3. Neck & Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.22, 12), skinMat);
  neck.position.set(0, spec.torsoScale[1] * 1.05, 0);
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.2, 0);
  neck.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.24, 24, 24);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Sleek Cyber Visor
  const visorGeo = new THREE.BoxGeometry(0.38, 0.12, 0.26);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.02, 0.14);
  headGroup.add(visor);

  // Headset Earcomms
  [-0.24, 0.24].forEach(x => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), jointMat);
    ear.rotateZ(Math.PI / 2);
    ear.position.set(x, 0.02, 0);
    headGroup.add(ear);
  });

  // Stylized Hair
  if (spec.hairStyle === 'bob') {
    const hairGeo = new THREE.SphereGeometry(0.28, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.hairColor), roughness: 0.35 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.05, -0.04);
    headGroup.add(hair);
  } else if (spec.hairStyle === 'tactical') {
    const hairGeo = new THREE.BoxGeometry(0.42, 0.14, 0.36);
    const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.hairColor), roughness: 0.45 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.2, -0.02);
    headGroup.add(hair);
  } else {
    // Holographic Crest Antenna
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.35), visorMat);
    crest.position.set(0, 0.26, 0);
    headGroup.add(crest);
  }

  // 4. Left Arm (Shoulder -> Upper Arm -> Forearm -> Hand)
  const lShoulder = new THREE.Group();
  lShoulder.position.set(-spec.shoulderWidth * 0.54, spec.torsoScale[1] * 0.85, 0);
  torsoGroup.add(lShoulder);

  const lShoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), accentMat);
  lShoulder.add(lShoulderPad);

  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 12), darkClothMat);
  lUpperArm.position.y = -0.22;
  lUpperArm.castShadow = true;
  lShoulder.add(lUpperArm);

  const lForearm = new THREE.Group();
  lForearm.position.set(0, -0.45, 0);
  lShoulder.add(lForearm);

  const lElbow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), jointMat);
  lForearm.add(lElbow);

  const lForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.42, 12), darkClothMat);
  lForearmMesh.position.y = -0.2;
  lForearm.add(lForearmMesh);

  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), skinMat);
  lHand.position.set(0, -0.44, 0);
  lForearm.add(lHand);

  // 5. Right Arm (Weapon / Stylus Grip)
  const rShoulder = new THREE.Group();
  rShoulder.position.set(spec.shoulderWidth * 0.54, spec.torsoScale[1] * 0.85, 0);
  torsoGroup.add(rShoulder);

  const rShoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), accentMat);
  rShoulder.add(rShoulderPad);

  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 12), darkClothMat);
  rUpperArm.position.y = -0.22;
  rUpperArm.castShadow = true;
  rShoulder.add(rUpperArm);

  const rForearm = new THREE.Group();
  rForearm.position.set(0, -0.45, 0);
  rShoulder.add(rForearm);

  const rElbow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), jointMat);
  rForearm.add(rElbow);

  const rForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.42, 12), darkClothMat);
  rForearmMesh.position.y = -0.2;
  rForearm.add(rForearmMesh);

  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), skinMat);
  rHand.position.set(0, -0.44, 0);
  rForearm.add(rHand);

  // High-Tech Cyber Stylus Pen
  const stylusGroup = new THREE.Group();
  stylusGroup.position.set(0, -0.44, 0.12);
  stylusGroup.rotation.x = Math.PI / 2.5;
  rForearm.add(stylusGroup);

  const stylusGeo = new THREE.CylinderGeometry(0.02, 0.012, 0.65, 10);
  const stylusMesh = new THREE.Mesh(stylusGeo, accentMat);
  stylusGroup.add(stylusMesh);

  const stylusTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), visorMat);
  stylusTip.position.y = 0.34;
  stylusGroup.add(stylusTip);

  // 6. Left Leg (Thigh -> Knee -> Calf -> Boot)
  const lThighGroup = new THREE.Group();
  lThighGroup.position.set(-spec.hipWidth * 0.44, 0, 0);
  pelvis.add(lThighGroup);

  const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.55, 14), darkClothMat);
  lThigh.position.y = -0.28;
  lThigh.castShadow = true;
  lThighGroup.add(lThigh);

  const lCalfGroup = new THREE.Group();
  lCalfGroup.position.set(0, -0.58, 0);
  lThighGroup.add(lCalfGroup);

  const lKnee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), jointMat);
  lCalfGroup.add(lKnee);

  const lCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.55, 14), darkClothMat);
  lCalf.position.y = -0.28;
  lCalf.castShadow = true;
  lCalfGroup.add(lCalf);

  // High-Top Cyber Sneaker / Boot
  const bootGeo = new THREE.BoxGeometry(0.16, 0.14, 0.35);
  const lBoot = new THREE.Mesh(bootGeo, accentMat);
  lBoot.position.set(0, -0.55, 0.08);
  lBoot.castShadow = true;
  lCalfGroup.add(lBoot);

  // 7. Right Leg (Thigh -> Knee -> Calf -> Boot)
  const rThighGroup = new THREE.Group();
  rThighGroup.position.set(spec.hipWidth * 0.44, 0, 0);
  pelvis.add(rThighGroup);

  const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.55, 14), darkClothMat);
  rThigh.position.y = -0.28;
  rThigh.castShadow = true;
  rThighGroup.add(rThigh);

  const rCalfGroup = new THREE.Group();
  rCalfGroup.position.set(0, -0.58, 0);
  rThighGroup.add(rCalfGroup);

  const rKnee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), jointMat);
  rCalfGroup.add(rKnee);

  const rCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.55, 14), darkClothMat);
  rCalf.position.y = -0.28;
  rCalf.castShadow = true;
  rCalfGroup.add(rCalf);

  const rBoot = new THREE.Mesh(bootGeo, accentMat);
  rBoot.position.set(0, -0.55, 0.08);
  rBoot.castShadow = true;
  rCalfGroup.add(rBoot);

  // 8. Laser Holographic Emitter Beam
  const beamGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 8);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: suitCol, transparent: true, opacity: 0.85 });
  laserBeam = new THREE.Mesh(beamGeo, beamMat);
  laserBeam.visible = false;
  const { scene } = getSceneState();
  if (scene) scene.add(laserBeam);

  rig = {
    pelvis,
    torso: torsoGroup,
    chest: chestPlate,
    neck,
    head: headGroup,
    visor,
    lShoulder,
    lUpperArm,
    lForearm,
    lHand,
    rShoulder,
    rUpperArm,
    rForearm,
    rHand,
    rStylus: stylusGroup,
    stylusTip,
    lThighGroup,
    lCalfGroup,
    lBoot,
    rThighGroup,
    rCalfGroup,
    rBoot
  };
}

export function initFPHand() {
  const { camera } = getSceneState();
  if (!camera) return;

  fpHandRoot = new THREE.Group();
  fpHandRoot.position.set(0.35, -0.32, -0.65);
  fpHandRoot.rotation.set(0.1, -0.2, 0);
  camera.add(fpHandRoot);

  rebuildFPHand();
}

export function rebuildFPHand() {
  if (!fpHandRoot) return;
  while (fpHandRoot.children.length > 0) {
    fpHandRoot.remove(fpHandRoot.children[0]);
  }

  const suitCol = new THREE.Color(avatarConfig.suitColor);
  const skinCol = new THREE.Color(avatarConfig.skinTone);

  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x090f24, roughness: 0.35, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: suitCol, emissive: suitCol.clone().multiplyScalar(0.5) });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.55 });

  // Sleek Arm Mesh
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 12), gloveMat);
  arm.rotation.x = Math.PI / 2.8;
  arm.position.set(0, 0, 0.1);
  fpHandRoot.add(arm);

  // Holographic Bracer
  const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 12), accentMat);
  bracer.rotation.x = Math.PI / 2.8;
  bracer.position.set(0, 0, 0.18);
  fpHandRoot.add(bracer);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), skinMat);
  hand.position.set(0, 0.05, -0.12);
  fpHandRoot.add(hand);

  // Stylus
  const stylus = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.42, 10), accentMat);
  stylus.rotation.x = Math.PI / 3;
  stylus.position.set(0, 0.14, -0.28);
  fpHandRoot.add(stylus);

  // Glow Tip
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: suitCol }));
  tip.position.set(0, 0.28, -0.46);
  fpHandRoot.add(tip);

  fpHandRoot.visible = (avatarConfig.povMode === 'fps');
}

export function updateAvatar(dt, velocity = new THREE.Vector3(), isMoving = false) {
  if (!avatarRoot) return;

  avatarRoot.visible = (avatarConfig.povMode !== 'fps');
  if (fpHandRoot) fpHandRoot.visible = (avatarConfig.povMode === 'fps');

  // Realistic Human Kinematics
  if (isMoving) {
    animWalkTime += dt * 7.5;

    // Pelvis vertical bounce and hip sway
    const bounce = Math.abs(Math.sin(animWalkTime * 2)) * 0.07;
    const hipRoll = Math.sin(animWalkTime) * 0.06;
    if (rig.pelvis) {
      rig.pelvis.position.y = 1.15 + bounce;
      rig.pelvis.rotation.z = hipRoll;
      rig.pelvis.rotation.y = -Math.sin(animWalkTime) * 0.08; // Torso counter-rotation
    }

    // Legs: Thigh and Knee Articulation
    const leftLegCycle = Math.sin(animWalkTime);
    const rightLegCycle = -Math.sin(animWalkTime);

    if (rig.lThighGroup) {
      rig.lThighGroup.rotation.x = leftLegCycle * 0.65;
      if (rig.lCalfGroup) {
        rig.lCalfGroup.rotation.x = Math.max(0, -leftLegCycle) * 0.75;
      }
    }

    if (rig.rThighGroup) {
      rig.rThighGroup.rotation.x = rightLegCycle * 0.65;
      if (rig.rCalfGroup) {
        rig.rCalfGroup.rotation.x = Math.max(0, -rightLegCycle) * 0.75;
      }
    }

    // Arms: Counter-Swing with Elbow Flexion
    if (!currentAction) {
      if (rig.lShoulder) {
        rig.lShoulder.rotation.x = -leftLegCycle * 0.55;
        if (rig.lForearm) rig.lForearm.rotation.x = -0.25 + Math.abs(leftLegCycle) * 0.2;
      }
      if (rig.rShoulder) {
        rig.rShoulder.rotation.x = -rightLegCycle * 0.55;
        if (rig.rForearm) rig.rForearm.rotation.x = -0.25 + Math.abs(rightLegCycle) * 0.2;
      }
    }
  } else {
    // Idle Breathing and Weight Shift
    animWalkTime += dt * 2.2;
    const breath = Math.sin(animWalkTime) * 0.025;
    if (rig.pelvis) {
      rig.pelvis.position.y = 1.15 + breath;
      rig.pelvis.rotation.z = Math.sin(animWalkTime * 0.5) * 0.02;
    }
    if (rig.head) {
      rig.head.rotation.y = Math.sin(animWalkTime * 0.7) * 0.05;
    }

    if (!currentAction) {
      if (rig.lThighGroup) rig.lThighGroup.rotation.set(0, 0, 0);
      if (rig.rThighGroup) rig.rThighGroup.rotation.set(0, 0, 0);
      if (rig.lCalfGroup) rig.lCalfGroup.rotation.set(0, 0, 0);
      if (rig.rCalfGroup) rig.rCalfGroup.rotation.set(0, 0, 0);
      if (rig.lShoulder) rig.lShoulder.rotation.x = Math.sin(animWalkTime) * 0.05;
      if (rig.rShoulder) rig.rShoulder.rotation.x = -Math.sin(animWalkTime) * 0.05;
      if (rig.lForearm) rig.lForearm.rotation.x = -0.15;
      if (rig.rForearm) rig.rForearm.rotation.x = -0.15;
    }
  }

  // Handle in-progress action (drawing / placing)
  if (currentAction) {
    actionTimer += dt;
    if (rig.rShoulder) {
      rig.rShoulder.rotation.x = -Math.PI / 2.3 + Math.sin(actionTimer * 14) * 0.12;
      rig.rShoulder.rotation.y = -0.25;
    }
    if (rig.rForearm) {
      rig.rForearm.rotation.x = -0.1 + Math.cos(actionTimer * 14) * 0.08;
    }

    if (fpHandRoot && fpHandRoot.visible) {
      fpHandRoot.position.y = -0.32 + Math.sin(actionTimer * 14) * 0.03;
      fpHandRoot.position.z = -0.65 + Math.cos(actionTimer * 14) * 0.04;
    }

    if (laserBeam && currentAction.targetPos) {
      const tipPos = new THREE.Vector3();
      if (rig.stylusTip) rig.stylusTip.getWorldPosition(tipPos);
      else avatarRoot.getWorldPosition(tipPos).add(new THREE.Vector3(0.5, 1.4, 0));

      const dist = tipPos.distanceTo(currentAction.targetPos);
      laserBeam.position.copy(tipPos).lerp(currentAction.targetPos, 0.5);
      laserBeam.lookAt(currentAction.targetPos);
      laserBeam.scale.set(1, 1, Math.max(0.1, dist));
      laserBeam.visible = true;
    }

    if (actionTimer >= currentAction.duration) {
      if (currentAction.onComplete) currentAction.onComplete();
      currentAction = null;
      if (laserBeam) laserBeam.visible = false;
      if (rig.rShoulder) rig.rShoulder.rotation.set(0, 0, 0);
      if (rig.rForearm) rig.rForearm.rotation.set(0, 0, 0);
    }
  }

  if (customMixer) {
    customMixer.update(dt);
  }
}

export function performAvatarAction(type, targetPos, onComplete, duration = 0.35) {
  if (typeof onComplete === 'function') onComplete();

  if (avatarConfig.executionMode !== 'avatar') {
    return;
  }

  if (avatarRoot && targetPos) {
    const dx = targetPos.x - avatarRoot.position.x;
    const dz = targetPos.z - avatarRoot.position.z;
    avatarRoot.rotation.y = Math.atan2(dx, dz);
  }

  currentAction = {
    type,
    targetPos: targetPos ? targetPos.clone() : null,
    duration,
    onComplete: null
  };
  actionTimer = 0;
}

export function loadCustomAvatar(source, onLoad, onError) {
  const loader = new GLTFLoader();
  const url = (typeof source === 'string') ? source : URL.createObjectURL(source);

  loader.load(url, (gltf) => {
    customAvatarModel = gltf.scene;

    // Normalize height and centering
    const box = new THREE.Box3().setFromObject(customAvatarModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.01) {
      const targetHeight = 2.3;
      const scale = targetHeight / size.y;
      customAvatarModel.scale.setScalar(scale);
    }

    // Traverse and search for bones
    customAvatarModel.traverse((node) => {
      if (node.isMesh || node.isSkinnedMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
      if (node.isBone) {
        const n = node.name.toLowerCase();
        if (n.includes('hip') || n.includes('pelvis')) rig.pelvis = node;
        else if (n.includes('spine') || n.includes('chest')) rig.torso = node;
        else if (n.includes('head')) rig.head = node;
        else if (n.includes('left') && (n.includes('arm') || n.includes('shoulder'))) rig.lShoulder = node;
        else if (n.includes('left') && n.includes('forearm')) rig.lForearm = node;
        else if (n.includes('right') && (n.includes('arm') || n.includes('shoulder'))) rig.rShoulder = node;
        else if (n.includes('right') && n.includes('forearm')) rig.rForearm = node;
        else if (n.includes('left') && (n.includes('thigh') || n.includes('upleg'))) rig.lThighGroup = node;
        else if (n.includes('left') && (n.includes('calf') || n.includes('leg'))) rig.lCalfGroup = node;
        else if (n.includes('right') && (n.includes('thigh') || n.includes('upleg'))) rig.rThighGroup = node;
        else if (n.includes('right') && (n.includes('calf') || n.includes('leg'))) rig.rCalfGroup = node;
      }
    });

    if (gltf.animations && gltf.animations.length > 0) {
      customMixer = new THREE.AnimationMixer(customAvatarModel);
      const action = customMixer.clipAction(gltf.animations[0]);
      action.play();
    } else {
      customMixer = null;
    }

    avatarConfig.gender = 'custom';
    rebuildAvatar();

    if (typeof onLoad === 'function') onLoad(gltf);
  }, undefined, (err) => {
    console.error('Error loading custom avatar glTF:', err);
    if (typeof onError === 'function') onError(err);
  });
}

export const loadCustomAccuRigModel = loadCustomAvatar;

