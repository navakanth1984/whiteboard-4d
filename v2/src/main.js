import * as THREE from 'three';
import { initScene, updateDust, updateTesseract, render, getSceneState, camera, controls, fill, ambient, scene } from './core/scene.js';
import { ray, m2, setMouse, getHit, hitToPos, hitToFree, hitToSurface, rayPlane, setupPointerEvents } from './core/input.js';
import { register, undoLast, redoLast, updateUndoRedoBtns, clearAllObjects, objects, links, undoStack, redoStack } from './core/history.js';
import {
  initStrokeSystem,
  beginStroke,
  addStrokePoint,
  updateLive,
  endStroke,
  setBrushStyle,
  setInkColor,
  drawing,
  drawPts
} from './draw/strokes.js';
import {
  initTextSystem,
  showTextInput,
  addText3D,
  addCursiveText3D,
  addTextRing
} from './objects/text.js';
import {
  SHAPES,
  curShape,
  setCurShape,
  addShape,
  addBlock
} from './objects/shapes.js';
import {
  ICON_CATEGORIES,
  curIconCat,
  curIconKey,
  getActiveIconItem,
  setIconCategory,
  setCurIconIndex,
  STICKERS,
  curSticker,
  setCurSticker,
  addSticker,
  addIconNode
} from './objects/stickers.js';

import {
  CARD_PRESETS,
  curCard,
  setCurCard,
  addSpatialCard
} from './objects/models.js';

import {
  BOARD_STYLES,
  curBoardStyle,
  setCurBoardStyle,
  addMiniBoard
} from './objects/board.js';

import {
  SPLAT_PRESETS,
  curSplat,
  setCurSplat,
  addSplatObject,
  loadSplatFile,
  initSparkRenderer
} from './objects/splat.js';

import {
  addImagePanel,
  addVideoPanel,
  addSpatialAudio,
  addLiveScreenShare
} from './objects/media.js';

import {
  createLink,
  tickLinks,
  refreshLinks,
  setFlowMotion,
  flowMotionEnabled
} from './graph/links.js';

import {
  serializeSession,
  loadSessionData,
  saveSessionToDownload
} from './session/persist.js';

import {
  startRecording,
  stopRecording
} from './capture/record.js';

import {
  initAuraSystem,
  tickAuras
} from './fx/aura.js';

import {
  initAvatarSystem,
  avatarConfig,
  setExecutionMode,
  setAvatarPreset,
  setAvatarSkinTone,
  performAvatarAction,
  avatarRoot,
  loadCustomAccuRigModel
} from './nav/character.js';

import {
  initGamerNav,
  updateGamerNav,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  setPOVMode,
  povMode,
  setPointerLocked,
  resetNavigation
} from './nav/gamer_nav.js';

import {
  initTransformSystem,
  selectObject,
  deselectObject,
  selectedObject,
  isGizmoHit,
  setGizmoMode,
  startDirectObjectDrag,
  updateDirectObjectDrag,
  endDirectObjectDrag,
  isDirectDragging
} from './nav/transform.js';

import { initAvatarPickerUI } from './ui/avatar_picker.js';
import { initHUDSystem, updateHUD } from './ui/hud.js';
import { initGuideSystem, showGuide } from './ui/guide.js';
import { initWritingAssistEvents } from './draw/assist.js';
import { initModeSystem, setMode, currentMode, getCurrentMode } from './ui/modes.js';
import { detectDeviceTier, getDeviceBudget } from './core/device_tier.js';
import { initTouchGestures } from './core/touch_gestures.js';
import { initHandTracking, toggleHandTracking, handTrackingActive } from './input/hand_tracking.js';
import { initHistory4D, recordTimelineEvent } from './temporal/history4d.js';
import { initCopilot, toggleCopilot, updateCopilot, executeDirective } from './agent/copilot.js';
import { initHolodeck, setHolodeckAtmosphere, toggleHolodeckMenu, HOLODECK_PRESETS } from './core/holodeck.js';
import { initVRMLoader, loadVRMAvatar, updateVRM } from './nav/vrm_loader.js';
import { initOCREngine, runOCRFromPoints } from './agent/ocr_engine.js';
import { initWebXREngine, isXRSessionActive } from './xr/webxr_engine.js';
import { initMultiplayer, updateMultiplayer, broadcastObjectCreation } from './net/multiplayer.js';
import { initSpatialAudioSystem, playSpatialSynthTone } from './audio/spatial_audio.js';
import { initCodeSandboxSystem, addCodeSandboxCard } from './objects/code_card.js';
import { initHapticsAudioSystem, playHapticSynth, vibrateDevice } from './audio/haptics.js';
import { initOrbitalMenuSystem, summonOrbitalMenu, dismissOrbitalMenu, updateOrbitalMenu } from './ui/orbital_menu.js';
import { initHolomapSystem, updateHolomap, toggleHolomap } from './ui/holomap.js';
import { initPostprocessing, setBloomEnabled, setBloomStrength } from './fx/postprocessing.js';
import { initFlipDeckSystem, addFlipDeckCard } from './objects/flip_deck.js';
import { exportSceneToGLB } from './export/scene_export.js';
import { initPhysics, updatePhysics, registerPhysicsBody } from './physics/rapier_engine.js';

// Setup Diagnostic Probes for Browser Verification
window.__historyProbe = { objects, links, undoStack, redoStack };
window.__avatarProbe = { avatarConfig, performAvatarAction };
window.__handTrackingProbe = { initHandTracking, toggleHandTracking, active: () => handTrackingActive };
window.__copilotProbe = { initCopilot, toggleCopilot, executeDirective };
window.__physicsProbe = { initPhysics, registerPhysicsBody };
window.__holodeckProbe = { initHolodeck, setHolodeckAtmosphere, HOLODECK_PRESETS };
window.__vrmProbe = { initVRMLoader, loadVRMAvatar };
window.__ocrProbe = { initOCREngine, runOCRFromPoints };
window.__webxrProbe = { initWebXREngine, isXRSessionActive };
window.__multiplayerProbe = { initMultiplayer, broadcastObjectCreation };
window.__spatialAudioProbe = { initSpatialAudioSystem, playSpatialSynthTone };
window.__codeCardProbe = { initCodeSandboxSystem, addCodeSandboxCard };
window.__hapticsProbe = { initHapticsAudioSystem, playHapticSynth, vibrateDevice };
window.__orbitalMenuProbe = { initOrbitalMenuSystem, summonOrbitalMenu, dismissOrbitalMenu };
window.__holomapProbe = { initHolomapSystem, toggleHolomap };
window.__bloomProbe = { initPostprocessing, setBloomEnabled, setBloomStrength };
window.__flipDeckProbe = { initFlipDeckSystem, addFlipDeckCard };

// Initialize Complete Core Spatial Engine
const deviceBudget = detectDeviceTier();
initScene();
initStrokeSystem();
initTextSystem();
initAuraSystem();
initHUDSystem();
initAvatarSystem();
initGamerNav();
initTransformSystem();
initAvatarPickerUI();
initGuideSystem();
initWritingAssistEvents();
initModeSystem();
initTouchGestures();
initHistory4D();
initCopilot();
initPhysics();
initHolodeck();
initVRMLoader();
initOCREngine();
initWebXREngine();
initMultiplayer();
initSpatialAudioSystem();
initCodeSandboxSystem();
initHapticsAudioSystem();
initOrbitalMenuSystem();
initHolomapSystem();
initPostprocessing();
initFlipDeckSystem();

// Wire Utilities Drawer & UI Controls
function setupUIUtilities() {
  const btnUtils = document.getElementById('btn-utilities');
  const utilsDrawer = document.getElementById('utils-drawer');
  const utilsClose = document.getElementById('utils-close');

  if (btnUtils && utilsDrawer) {
    btnUtils.addEventListener('click', () => {
      utilsDrawer.classList.toggle('show');
      playHapticSynth('click');
    });
  }
  if (utilsClose && utilsDrawer) {
    utilsClose.addEventListener('click', () => {
      utilsDrawer.classList.remove('show');
      playHapticSynth('pop');
    });
  }

  // Reset Camera View
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetNavigation();
      playHapticSynth('whoosh');
      if (utilsDrawer) utilsDrawer.classList.remove('show');
    });
  }

  // Save Session JSON
  const btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      saveSessionToDownload('bleuboard-session');
      playHapticSynth('snap');
      if (utilsDrawer) utilsDrawer.classList.remove('show');
    });
  }

  // Load Session JSON
  const btnImport = document.getElementById('btn-import');
  const importInput = document.getElementById('import-input');
  if (btnImport && importInput) {
    btnImport.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            loadSessionData(data);
            playHapticSynth('snap');
            if (utilsDrawer) utilsDrawer.classList.remove('show');
          } catch (err) {
            alert('Invalid session JSON file.');
          }
        };
        reader.readAsText(file);
      }
    });
  }

  // 1-Click GLB Export
  const btnExportGLB = document.getElementById('btn-export-glb');
  if (btnExportGLB) {
    btnExportGLB.addEventListener('click', () => {
      exportSceneToGLB('bleuboard-3d-scene');
      playHapticSynth('snap');
      if (utilsDrawer) utilsDrawer.classList.remove('show');
    });
  }

  // Clear All Objects (instant with haptic feedback)
  const btnClear = document.getElementById('btn-clear');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      clearAllObjects();
      playHapticSynth('whoosh');
      if (utilsDrawer) utilsDrawer.classList.remove('show');
    });
  }

  // Presentation & Screen Recording Toggle
  const btnRec = document.getElementById('btn-rec');
  let isPresenting = false;
  if (btnRec) {
    btnRec.addEventListener('click', async () => {
      if (!isPresenting) {
        try {
          await startRecording(true, false, status => {
            if (status === 'stopped') {
              isPresenting = false;
              btnRec.innerHTML = '<span class="material-symbols-outlined">videocam</span>🔴 Presentation';
              btnRec.style.background = '';
            }
          });
          isPresenting = true;
          btnRec.innerHTML = '<span class="material-symbols-outlined">stop_circle</span>⏹ Stop Presentation';
          btnRec.style.background = 'rgba(239,68,68,0.4)';
          playHapticSynth('pop');
        } catch (err) {
          console.warn('Presentation recording error:', err);
        }
      } else {
        stopRecording();
        isPresenting = false;
        btnRec.innerHTML = '<span class="material-symbols-outlined">videocam</span>🔴 Presentation';
        btnRec.style.background = '';
        playHapticSynth('snap');
      }
    });
  }

  // Scene Colors Toggle
  const btnScene = document.getElementById('btn-scene');
  const scenePanel = document.getElementById('scene-panel');
  if (btnScene && scenePanel) {
    btnScene.addEventListener('click', () => {
      scenePanel.style.display = scenePanel.style.display === 'flex' ? 'none' : 'flex';
      playHapticSynth('click');
    });
  }

  // Scene Colors Pickers
  const pickWall = document.getElementById('pick-wall');
  const pickFloor = document.getElementById('pick-floor');
  const pickBg2 = document.getElementById('pick-bg2');
  const { scene: currentScene } = getSceneState();

  if (pickWall && currentScene) {
    pickWall.addEventListener('input', e => {
      if (currentScene.background) currentScene.background.set(e.target.value);
    });
  }
  if (pickFloor && currentScene) {
    pickFloor.addEventListener('input', e => {
      const grid = currentScene.getObjectByName('GroundGrid');
      if (grid && grid.material) grid.material.color.set(e.target.value);
    });
  }
  if (pickBg2 && currentScene) {
    pickBg2.addEventListener('input', e => {
      if (currentScene.background) currentScene.background.set(e.target.value);
    });
  }

  // Share & Export Hub Modal
  const btnShareLink = document.getElementById('btn-share-link');
  const exportHubModal = document.getElementById('export-hub-modal');
  const exportHubClose = document.getElementById('export-hub-close');
  if (btnShareLink && exportHubModal) {
    btnShareLink.addEventListener('click', () => {
      exportHubModal.style.display = 'flex';
      playHapticSynth('pop');
      if (utilsDrawer) utilsDrawer.classList.remove('show');
    });
  }
  if (exportHubClose && exportHubModal) {
    exportHubClose.addEventListener('click', () => {
      exportHubModal.style.display = 'none';
    });
  }

  // Palette Close Button
  const palClose = document.getElementById('pal-close');
  const pal = document.getElementById('palette');
  if (palClose && pal) {
    palClose.addEventListener('click', () => {
      pal.classList.remove('show');
      setMode('nav');
    });
  }

  // Guide Re-entry Button
  const btnGuide = document.getElementById('btn-guide');
  if (btnGuide) {
    btnGuide.addEventListener('click', () => {
      showGuide();
      playHapticSynth('pop');
    });
  }
}

setupUIUtilities();

// Wire Handlers & Locomotion
let pendingLinkSource = null;

setupPointerEvents({
  onDown: (cx, cy, e) => {
    const mode = getCurrentMode();
    const ink = document.getElementById('pick-ink')?.value || '#00ccff';

    if (mode === 'draw') {
      if (avatarConfig.executionMode === 'avatar') {
        const surf = hitToSurface(cx, cy);
        if (surf) performAvatarAction('draw', surf.point, () => {}, 0.1);
      }
      beginStroke(cx, cy);
    } else if (mode === 'card') {
      const surf = hitToSurface(cx, cy) || { point: new THREE.Vector3(0, 3.5, -6), normal: new THREE.Vector3(0, 0, 1) };
      performAvatarAction('place', surf.point, () => {
        const o = addSpatialCard(curCard, surf, ink);
        setMode('nav');
        if (o) selectObject(o);
      });
    } else if (mode === 'board') {
      const surf = hitToSurface(cx, cy) || { point: new THREE.Vector3(0, 2.0, -6), normal: new THREE.Vector3(0, 0, 1) };
      const pos = surf.point.clone().add(new THREE.Vector3(0, 2.5, 0));
      performAvatarAction('place', pos, () => {
        const o = addMiniBoard({ styleKey: curBoardStyle, position: pos, colorHex: ink });
        setMode('nav');
        if (o) selectObject(o);
      });
    } else if (mode === 'icon') {
      const surf = hitToSurface(cx, cy) || { point: new THREE.Vector3(0, 3.5, -6), normal: new THREE.Vector3(0, 0, 1) };
      const item = getActiveIconItem();
      if (item) {
        performAvatarAction('place', surf.point, () => {
          const o = addIconNode(item, surf, ink);
          setMode('nav');
          if (o) selectObject(o);
        });
      }
    } else if (mode === 'splat') {
      const surf = hitToSurface(cx, cy) || { point: new THREE.Vector3(0, 0.5, -4), normal: new THREE.Vector3(0, 1, 0) };
      performAvatarAction('place', surf.point, () => {
        const o = addSplatObject({ presetKey: curSplat, surf, ink });
        setMode('nav');
        if (o) selectObject(o);
      });
    } else if (mode === 'connect') {
      const { camera } = getSceneState();
      setMouse(cx, cy);
      ray.setFromCamera(m2, camera);
      const roots = objects.map(o => o.root).filter(Boolean);
      const hits = ray.intersectObjects(roots, true);
      if (hits.length > 0) {
        let cur = hits[0].object;
        let clickedObj = null;
        while (cur && !clickedObj) {
          clickedObj = objects.find(o => o.root === cur || o.collider === cur);
          cur = cur.parent;
        }
        if (clickedObj) {
          if (!pendingLinkSource) {
            pendingLinkSource = clickedObj;
            selectObject(clickedObj);
          } else if (pendingLinkSource !== clickedObj) {
            performAvatarAction('link', clickedObj.root.position, () => {
              createLink(pendingLinkSource, clickedObj, ink);
              pendingLinkSource = null;
            });
          }
        }
      }
    } else if (mode === 'image') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = ev => {
          const file = ev.target.files[0];
          if (file) {
            performAvatarAction('place', surf.point, () => {
              const o = addImagePanel(URL.createObjectURL(file), surf.point, ink);
              setMode('nav');
              if (o) selectObject(o);
            });
          }
        };
        inp.click();
      }
    } else if (mode === 'video') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'video/*';
        inp.onchange = ev => {
          const file = ev.target.files[0];
          if (file) {
            performAvatarAction('place', surf.point, () => {
              const o = addVideoPanel(URL.createObjectURL(file), surf.point, ink);
              setMode('nav');
              if (o) selectObject(o);
            });
          }
        };
        inp.click();
      }
    } else if (mode === 'audio') {
      const surf = hitToSurface(cx, cy);
      if (surf) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'audio/*';
        inp.onchange = ev => {
          const file = ev.target.files[0];
          if (file) {
            performAvatarAction('place', surf.point, () => {
              const o = addSpatialAudio(URL.createObjectURL(file), surf, ink);
              setMode('nav');
              if (o) selectObject(o);
            });
          }
        };
        inp.click();
      }
    } else if (mode === 'text') {
      const hit = getHit(cx, cy);
      const free = hitToFree(hit);
      showTextInput(cx, cy, free || new THREE.Vector3(0, 11, -9));
    } else if (mode === 'nav') {
      const { camera } = getSceneState();
      setMouse(cx, cy);
      ray.setFromCamera(m2, camera);

      // 1. If clicking on 3D Gizmo handles, let TransformControls handle axis drag
      if (isGizmoHit(ray)) {
        return;
      }

      // 2. Raycast existing canvas objects
      const roots = objects.map(o => o.root).filter(Boolean);
      const hits = ray.intersectObjects(roots, true);
      if (hits.length > 0) {
        let hitObj = hits[0].object;
        let clickedObj = objects.find(o => {
          if (!o.root) return false;
          if (o.root === hitObj || o.collider === hitObj) return true;
          let found = false;
          o.root.traverse(child => {
            if (child === hitObj) found = true;
          });
          return found;
        });

        if (clickedObj) {
          // Select object (or keep selected) and initiate direct body drag
          selectObject(clickedObj);
          startDirectObjectDrag(clickedObj, hits[0].point);
          return;
        }
      }

      // 3. If clicking empty background, deselect active object and enable camera look
      deselectObject();
      handlePointerDown(e || { clientX: cx, clientY: cy, button: 0 });
    }
  },
  onMove: (cx, cy, e) => {
    const mode = getCurrentMode();
    setMouse(cx, cy);
    if (mode === 'nav') {
      if (isDirectDragging) {
        const { camera } = getSceneState();
        if (camera) ray.setFromCamera(m2, camera);
        updateDirectObjectDrag(cx, cy, ray);
        return;
      }
      handlePointerMove(e || { clientX: cx, clientY: cy });
    }
    if (mode === 'draw' && drawing) {
      addStrokePoint(cx, cy);
    }
  },
  onUp: (cx, cy, e) => {
    const mode = getCurrentMode();
    if (mode === 'nav') {
      if (isDirectDragging) {
        endDirectObjectDrag();
      }
      handlePointerUp();
    }
    if (mode === 'draw') {
      endStroke();
    }
  }
});

const clock = new THREE.Clock();
let elapsed = 0;

// FPS Measurement Probe for QA / RENDER_CHECK Gate
window.__fpsStats = {
  frames: 0,
  lastTime: performance.now(),
  currentFps: 60,
  history: []
};

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  elapsed += dt;
  const t = elapsed;

  // FPS tracking
  const now = performance.now();
  window.__fpsStats.frames++;
  if (now - window.__fpsStats.lastTime >= 1000) {
    window.__fpsStats.currentFps = (window.__fpsStats.frames * 1000) / (now - window.__fpsStats.lastTime);
    window.__fpsStats.history.push(window.__fpsStats.currentFps);
    if (window.__fpsStats.history.length > 30) window.__fpsStats.history.shift();
    window.__fpsStats.frames = 0;
    window.__fpsStats.lastTime = now;
  }

  if (controls && povMode === 'orbit') controls.update();
  updateGamerNav(dt);
  updateHUD(currentMode);
  updateDust(dt);
  updateLive();
  tickLinks(dt);
  refreshLinks();
  tickAuras(t);
  updateCopilot(t, dt);
  updatePhysics(dt);
  updateVRM(dt, camera?.position);
  updateMultiplayer(dt, avatarRoot?.position, avatarRoot?.quaternion);
  updateOrbitalMenu(camera);
  updateHolomap(camera, avatarRoot?.position, dt);

  // Tick object billboard and spin rotations
  objects.forEach(o => {
    if (o.root.userData.billboardY && camera) {
      const dx = camera.position.x - o.root.position.x;
      const dz = camera.position.z - o.root.position.z;
      o.root.rotation.y = Math.atan2(dx, dz);
    }
    if (o.root.userData.spin && o.root.children[0]) {
      o.root.children[0].rotation.y += 0.01;
      o.root.children[0].rotation.x += 0.004;
    }
  });

  if (fill) {
    fill.intensity = 1.1 + Math.sin(t * 0.85) * 0.3;
    fill.position.x = Math.sin(t * 0.28) * 12;
    fill.position.z = Math.cos(t * 0.28) * 12;
  }
  if (ambient) {
    ambient.intensity = 2.4 + Math.sin(t * 0.5) * 0.4;
  }

  render();
}

animate();
