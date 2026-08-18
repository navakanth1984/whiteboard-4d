// v2/src/nav/vrm_loader.js — VRM Anime & Cyberpunk Humanoid Avatar Loader with SpringBones & Blendshapes
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { getSceneState } from '../core/scene.js';
import { avatarRoot } from './character.js';

let currentVRM = null;
let blinkTimer = 0;
let nextBlinkTime = 3.0;
let isBlinking = false;

/**
 * Initializes the VRM Humanoid Avatar subsystem
 */
export function initVRMSystem() {
  initVRMUploadListener();
}

/**
 * Loads a .vrm avatar file from URL or ArrayBuffer
 */
export function loadVRMAvatar(urlOrBuffer) {
  const { scene } = getSceneState();
  if (!scene) return Promise.reject(new Error('Scene not ready'));

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  return new Promise((resolve, reject) => {
    const onLoad = (gltf) => {
      const vrm = gltf.userData.vrm;
      if (!vrm) {
        reject(new Error('Loaded model is not a valid VRM 1.0/0.x avatar'));
        return;
      }

      // Clean up previous VRM avatar if active
      if (currentVRM) {
        scene.remove(currentVRM.scene);
        VRMUtils.deepDispose(currentVRM.scene);
      }

      // Optimize materials & rotate to face standard camera
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);

      vrm.scene.traverse((obj) => {
        obj.frustumCulled = false;
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      // Align VRM inside the in-world avatar anchor
      if (avatarRoot) {
        // Hide default procedural avatar meshes when VRM is active
        avatarRoot.children.forEach(c => {
          if (c !== vrm.scene) c.visible = false;
        });
        avatarRoot.add(vrm.scene);
      } else {
        scene.add(vrm.scene);
      }

      currentVRM = vrm;
      resolve(vrm);
    };

    if (typeof urlOrBuffer === 'string') {
      loader.load(urlOrBuffer, onLoad, undefined, reject);
    } else {
      loader.parse(urlOrBuffer, '', onLoad, reject);
    }
  });
}

/**
 * Updates SpringBones, Look-At IK, and procedural blinking per animation frame
 */
export function updateVRM(dt, cameraPos) {
  if (!currentVRM) return;

  // 1. Update SpringBone physics and expressions
  currentVRM.update(dt);

  // 2. Procedural Natural Eye Blinking
  blinkTimer += dt;
  if (blinkTimer >= nextBlinkTime) {
    isBlinking = true;
    if (currentVRM.expressionManager) {
      currentVRM.expressionManager.setValue('blink', 1.0);
    }
    if (blinkTimer >= nextBlinkTime + 0.15) {
      if (currentVRM.expressionManager) {
        currentVRM.expressionManager.setValue('blink', 0.0);
      }
      isBlinking = false;
      blinkTimer = 0;
      nextBlinkTime = 2.0 + Math.random() * 4.0; // Random interval between 2-6s
    }
  }

  // 3. Look-At IK (Turn eyes and head smoothly toward camera or focus target)
  if (currentVRM.lookAt && cameraPos) {
    currentVRM.lookAt.target = cameraPos;
  }
}

export function getActiveVRM() {
  return currentVRM;
}

export function setVRMExpression(name, weight = 1.0) {
  if (currentVRM && currentVRM.expressionManager) {
    currentVRM.expressionManager.setValue(name, weight);
  }
}

function initVRMUploadListener() {
  const uploadInput = document.getElementById('avatar-file-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.name.toLowerCase().endsWith('.vrm')) {
        const buffer = await file.arrayBuffer();
        try {
          await loadVRMAvatar(buffer);
          alert(`VRM Avatar "${file.name}" loaded successfully!`);
        } catch (err) {
          console.error('Failed to load VRM file:', err);
          alert('Could not load VRM avatar. Please ensure it is a valid .vrm file.');
        }
      }
    });
  }
}

export const initVRMLoader = initVRMSystem;

