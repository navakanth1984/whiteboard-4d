import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';

export const GENDERS = {
  female: {
    label: 'Female Cyber Architect',
    torsoScale: [0.75, 1.1, 0.45],
    shoulderWidth: 0.9,
    hipWidth: 0.85,
    height: 2.3,
    hairStyle: 'bob',
    hairColor: '#f43f5e'
  },
  male: {
    label: 'Male Cyber Architect',
    torsoScale: [0.95, 1.15, 0.55],
    shoulderWidth: 1.15,
    hipWidth: 0.75,
    height: 2.45,
    hairStyle: 'tactical',
    hairColor: '#0ea5e9'
  },
  nonbinary: {
    label: 'Cyber Android (Non-Binary)',
    torsoScale: [0.85, 1.12, 0.48],
    shoulderWidth: 1.0,
    hipWidth: 0.8,
    height: 2.38,
    hairStyle: 'holo_antenna',
    hairColor: '#a855f7'
  }
};

export const SKIN_TONES = [
  '#ffd1b3', // Fair
  '#e0a97c', // Medium Warm
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
let avatarLimbs = {};
let laserBeam = null;
let currentAction = null;
let actionTimer = 0;
let animWalkTime = 0;

export function setAvatarConfig(cfg) {
  avatarConfig = { ...avatarConfig, ...cfg };
  rebuildAvatar();
  rebuildFPHand();
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

  const spec = GENDERS[avatarConfig.gender] || GENDERS.female;
  const suitCol = new THREE.Color(avatarConfig.suitColor);
  const skinCol = new THREE.Color(avatarConfig.skinTone);
  const darkSuitMat = new THREE.MeshStandardMaterial({
    color: 0x090f24,
    roughness: 0.25,
    metalness: 0.85
  });
  const accentSuitMat = new THREE.MeshStandardMaterial({
    color: suitCol,
    emissive: suitCol.clone().multiplyScalar(0.45),
    roughness: 0.15,
    metalness: 0.6
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinCol,
    roughness: 0.6,
    metalness: 0.1
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: suitCol,
    emissive: suitCol,
    emissiveIntensity: 1.2,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.85
  });

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(spec.torsoScale[0], spec.torsoScale[1], spec.torsoScale[2]);
  const torso = new THREE.Mesh(torsoGeo, darkSuitMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  avatarRoot.add(torso);

  // Chest Armor & Glowing Core
  const chestGeo = new THREE.BoxGeometry(spec.torsoScale[0] * 0.9, spec.torsoScale[1] * 0.5, spec.torsoScale[2] * 0.3);
  const chest = new THREE.Mesh(chestGeo, accentSuitMat);
  chest.position.set(0, 0.2, spec.torsoScale[2] * 0.45);
  torso.add(chest);

  const coreGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const core = new THREE.Mesh(coreGeo, visorMat);
  core.position.set(0, 0.15, spec.torsoScale[2] * 0.6);
  torso.add(core);

  // 2. Head
  const headGeo = new THREE.SphereGeometry(0.28, 20, 20);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.85;
  head.castShadow = true;
  torso.add(head);

  // Visor / Cyber Goggles
  const visorGeo = new THREE.BoxGeometry(0.42, 0.14, 0.25);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.04, 0.18);
  head.add(visor);

  // Hair / Headgear
  if (spec.hairStyle === 'bob') {
    const hairGeo = new THREE.BoxGeometry(0.55, 0.35, 0.45);
    const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.hairColor), roughness: 0.4 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.15, -0.05);
    head.add(hair);
  } else if (spec.hairStyle === 'tactical') {
    const hairGeo = new THREE.BoxGeometry(0.48, 0.18, 0.42);
    const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.hairColor), roughness: 0.5 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.22, 0);
    head.add(hair);
  } else {
    // Holographic Antenna
    const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
    const ant = new THREE.Mesh(antGeo, visorMat);
    ant.position.set(0.18, 0.3, 0);
    ant.rotation.z = -0.3;
    head.add(ant);
  }

  // 3. Left Arm
  const lArmGroup = new THREE.Group();
  lArmGroup.position.set(-spec.shoulderWidth * 0.55, 0.45, 0);
  torso.add(lArmGroup);

  const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.8, 12);
  const lArm = new THREE.Mesh(armGeo, darkSuitMat);
  lArm.position.y = -0.4;
  lArm.castShadow = true;
  lArmGroup.add(lArm);

  const lHandGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const lHand = new THREE.Mesh(lHandGeo, skinMat);
  lHand.position.y = -0.85;
  lArmGroup.add(lHand);

  // 4. Right Arm (Weapon / Cyber Stylus Tool Arm)
  const rArmGroup = new THREE.Group();
  rArmGroup.position.set(spec.shoulderWidth * 0.55, 0.45, 0);
  torso.add(rArmGroup);

  const rArm = new THREE.Mesh(armGeo, darkSuitMat);
  rArm.position.y = -0.4;
  rArm.castShadow = true;
  rArmGroup.add(rArm);

  const rHand = new THREE.Mesh(lHandGeo, skinMat);
  rHand.position.y = -0.85;
  rArmGroup.add(rHand);

  // Cyber Stylus in Right Hand
  const stylusGeo = new THREE.CylinderGeometry(0.025, 0.015, 0.65, 8);
  stylusGeo.rotateX(Math.PI / 2);
  const stylus = new THREE.Mesh(stylusGeo, accentSuitMat);
  stylus.position.set(0, -0.9, 0.25);
  rArmGroup.add(stylus);

  // Stylus Tip Glow
  const tipGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const tip = new THREE.Mesh(tipGeo, visorMat);
  tip.position.set(0, -0.9, 0.58);
  rArmGroup.add(tip);

  // 5. Left & Right Legs
  const legGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.95, 12);
  const lLegGroup = new THREE.Group();
  lLegGroup.position.set(-spec.hipWidth * 0.4, 0.8, 0);
  avatarRoot.add(lLegGroup);

  const lLeg = new THREE.Mesh(legGeo, darkSuitMat);
  lLeg.position.y = -0.45;
  lLeg.castShadow = true;
  lLegGroup.add(lLeg);

  const rLegGroup = new THREE.Group();
  rLegGroup.position.set(spec.hipWidth * 0.4, 0.8, 0);
  avatarRoot.add(rLegGroup);

  const rLeg = new THREE.Mesh(legGeo, darkSuitMat);
  rLeg.position.y = -0.45;
  rLeg.castShadow = true;
  rLegGroup.add(rLeg);

  // 6. Laser Holographic Beam (for action execution)
  const beamGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: suitCol,
    transparent: true,
    opacity: 0.85
  });
  laserBeam = new THREE.Mesh(beamGeo, beamMat);
  laserBeam.visible = false;
  const { scene } = getSceneState();
  if (scene) scene.add(laserBeam);

  avatarLimbs = {
    torso,
    head,
    lArmGroup,
    rArmGroup,
    lLegGroup,
    rLegGroup,
    stylusTip: tip
  };
}

export function initFPHand() {
  const { camera } = getSceneState();
  if (!camera) return;

  fpHandRoot = new THREE.Group();
  fpHandRoot.position.set(0.35, -0.3, -0.65);
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

  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x090f24, roughness: 0.3, metalness: 0.8 });
  const accentMat = new THREE.MeshStandardMaterial({ color: suitCol, emissive: suitCol.clone().multiplyScalar(0.5) });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 });

  // Forearm
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 12), gloveMat);
  arm.rotation.x = Math.PI / 2.8;
  arm.position.set(0, 0, 0.1);
  fpHandRoot.add(arm);

  // Hand & Bracer
  const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 12), accentMat);
  bracer.rotation.x = Math.PI / 2.8;
  bracer.position.set(0, 0, 0.18);
  fpHandRoot.add(bracer);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), skinMat);
  hand.position.set(0, 0.05, -0.12);
  fpHandRoot.add(hand);

  // Stylus
  const stylus = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.38, 8), accentMat);
  stylus.rotation.x = Math.PI / 3;
  stylus.position.set(0, 0.12, -0.26);
  fpHandRoot.add(stylus);

  // Tip
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: suitCol }));
  tip.position.set(0, 0.26, -0.42);
  fpHandRoot.add(tip);

  fpHandRoot.visible = (avatarConfig.povMode === 'fps');
}

export function updateAvatar(dt, velocity = new THREE.Vector3(), isMoving = false) {
  if (!avatarRoot) return;

  // Visibility based on POV
  avatarRoot.visible = (avatarConfig.povMode !== 'fps');
  if (fpHandRoot) fpHandRoot.visible = (avatarConfig.povMode === 'fps');

  // Procedural Animation
  if (isMoving) {
    animWalkTime += dt * 8.5;
    const legAngle = Math.sin(animWalkTime) * 0.55;
    const armAngle = Math.cos(animWalkTime) * 0.55;

    if (avatarLimbs.lLegGroup) avatarLimbs.lLegGroup.rotation.x = legAngle;
    if (avatarLimbs.rLegGroup) avatarLimbs.rLegGroup.rotation.x = -legAngle;

    if (!currentAction) {
      if (avatarLimbs.lArmGroup) avatarLimbs.lArmGroup.rotation.x = -armAngle;
      if (avatarLimbs.rArmGroup) avatarLimbs.rArmGroup.rotation.x = armAngle;
    }
  } else {
    // Idle breathing
    animWalkTime += dt * 2.0;
    const breath = Math.sin(animWalkTime) * 0.03;
    if (avatarLimbs.torso) avatarLimbs.torso.position.y = 1.35 + breath;

    if (!currentAction) {
      if (avatarLimbs.lLegGroup) avatarLimbs.lLegGroup.rotation.x = 0;
      if (avatarLimbs.rLegGroup) avatarLimbs.rLegGroup.rotation.x = 0;
      if (avatarLimbs.lArmGroup) avatarLimbs.lArmGroup.rotation.x = Math.sin(animWalkTime) * 0.08;
      if (avatarLimbs.rArmGroup) avatarLimbs.rArmGroup.rotation.x = -Math.sin(animWalkTime) * 0.08;
    }
  }

  // Handle in-progress action (drawing / placing)
  if (currentAction) {
    actionTimer += dt;
    const arm = avatarLimbs.rArmGroup;
    if (arm) {
      arm.rotation.x = -Math.PI / 2.2 + Math.sin(actionTimer * 12) * 0.1;
      arm.rotation.y = -0.2;
    }

    if (fpHandRoot && fpHandRoot.visible) {
      fpHandRoot.position.y = -0.3 + Math.sin(actionTimer * 14) * 0.03;
      fpHandRoot.position.z = -0.65 + Math.cos(actionTimer * 14) * 0.04;
    }

    if (laserBeam && currentAction.targetPos) {
      const tipPos = new THREE.Vector3();
      if (avatarLimbs.stylusTip) avatarLimbs.stylusTip.getWorldPosition(tipPos);
      else avatarRoot.getWorldPosition(tipPos).add(new THREE.Vector3(0.5, 1.2, 0));

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
      if (avatarLimbs.rArmGroup) {
        avatarLimbs.rArmGroup.rotation.set(0, 0, 0);
      }
    }
  }
}

export function performAvatarAction(type, targetPos, onComplete, duration = 0.35) {
  if (avatarConfig.executionMode !== 'avatar') {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  // Turn avatar towards target
  if (avatarRoot && targetPos) {
    const dx = targetPos.x - avatarRoot.position.x;
    const dz = targetPos.z - avatarRoot.position.z;
    avatarRoot.rotation.y = Math.atan2(dx, dz);
  }

  currentAction = {
    type,
    targetPos: targetPos ? targetPos.clone() : null,
    duration,
    onComplete
  };
  actionTimer = 0;
}
