import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { getSceneState } from '../core/scene.js';
import { objects, removeObj } from '../core/history.js';
import { SASCore, SASCard } from '../agent/interpret.js';

export let transformControl = null;
export let gizmoHelper = null;
export let selectedObject = null;
let dropLine = null;
let floorShadowCircle = null;
let boxHelper = null;
export let gizmoMode = 'translate'; // 'translate', 'rotate', 'scale'

export function isGizmoHit(raycaster) {
  if (!transformControl || !selectedObject) return false;
  if (transformControl.dragging || (transformControl.axis && transformControl.axis !== 'null')) {
    return true;
  }
  try {
    const target = (typeof transformControl.getHelper === 'function') ? transformControl.getHelper() : transformControl;
    const visibleMeshes = [];
    target.traverse(c => {
      if (c.isMesh && c.visible && c.name && ['X', 'Y', 'Z', 'XY', 'YZ', 'XZ', 'XYZ', 'E', 'START', 'END'].includes(c.name)) {
        visibleMeshes.push(c);
      }
    });
    if (visibleMeshes.length === 0) return false;
    const hits = raycaster.intersectObjects(visibleMeshes, true);
    return hits && hits.length > 0;
  } catch (e) {
    return false;
  }
}

export function setGizmoMode(mode) {
  if (['translate', 'rotate', 'scale'].includes(mode)) {
    gizmoMode = mode;
    if (transformControl) {
      transformControl.setMode(mode);
    }
    updateActionDockUI();
  }
}

export function initTransformSystem() {
  const { scene, camera, renderer, controls } = getSceneState();
  if (!scene || !camera || !renderer) return;

  transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.size = 1.15;
  transformControl.setSpace('world');
  gizmoHelper = (typeof transformControl.getHelper === 'function') ? transformControl.getHelper() : transformControl;
  scene.add(gizmoHelper);
  if (typeof window !== 'undefined') {
    window.__transformControl = transformControl;
  }

  // Disable orbit controls while dragging gizmo
  transformControl.addEventListener('dragging-changed', event => {
    if (controls) controls.enabled = !event.value;
    if (event.value && selectedObject) {
      const interp = SASCore.interpret(selectedObject);
      if (interp) {
        SASCard.render(interp, selectedObject);
        SASCore.record({ evt: 'drag-start', type: selectedObject.type, frame: interp.frame, id: selectedObject.id });
      }
    } else if (!event.value && selectedObject) {
      const interp = SASCore.interpret(selectedObject);
      SASCore.record({ evt: 'drag-end', type: selectedObject.type, frame: interp ? interp.frame : '?', id: selectedObject.id });
    }
  });

  transformControl.addEventListener('change', () => {
    updateDropLine();
    if (boxHelper && selectedObject) boxHelper.update();
    if (selectedObject) {
      const interp = SASCore.interpret(selectedObject);
      if (interp) SASCard.render(interp, selectedObject);
    }
  });

  // Bounding Box Highlight Helper
  boxHelper = new THREE.BoxHelper(new THREE.Mesh(), 0x38bdf8);
  boxHelper.visible = false;
  scene.add(boxHelper);

  // Create Floor Elevation Drop Line Helper
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 0.3,
    gapSize: 0.2,
    transparent: true,
    opacity: 0.75
  });
  dropLine = new THREE.Line(lineGeo, lineMat);
  dropLine.visible = false;
  scene.add(dropLine);

  // Floor Shadow Indicator Disc
  const discGeo = new THREE.RingGeometry(0.2, 0.65, 24);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  floorShadowCircle = new THREE.Mesh(discGeo, discMat);
  floorShadowCircle.visible = false;
  scene.add(floorShadowCircle);

  // Keyboard Shortcuts for 3D Object Manipulation
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Tab to cycle through objects
    if (e.code === 'Tab' && objects.length > 0) {
      e.preventDefault();
      const curIdx = selectedObject ? objects.indexOf(selectedObject) : -1;
      const nextIdx = (curIdx + 1) % objects.length;
      selectObject(objects[nextIdx]);
      return;
    }

    if (!selectedObject) return;

    if (e.code === 'KeyG') {
      setGizmoMode('translate');
    } else if (e.code === 'KeyR') {
      setGizmoMode('rotate');
    } else if (e.code === 'KeyS') {
      setGizmoMode('scale');
    } else if (e.code === 'Escape') {
      deselectObject();
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (selectedObject) {
        removeObj(selectedObject);
        deselectObject();
      }
    }
  });

  setupActionDockEvents();
}

function updateActionDockUI() {
  const dock = document.getElementById('object-action-dock');
  if (!dock) return;

  if (!selectedObject) {
    dock.classList.remove('show');
    return;
  }

  dock.classList.add('show');
  const labelEl = document.getElementById('obj-dock-label');
  if (labelEl) {
    labelEl.textContent = selectedObject.label || 'Selected 3D Object';
  }

  // Update active state on gizmo mode buttons
  const btnMove = document.getElementById('btn-gizmo-move');
  const btnRotate = document.getElementById('btn-gizmo-rotate');
  const btnScale = document.getElementById('btn-gizmo-scale');

  if (btnMove) btnMove.classList.toggle('active', gizmoMode === 'translate');
  if (btnRotate) btnRotate.classList.toggle('active', gizmoMode === 'rotate');
  if (btnScale) btnScale.classList.toggle('active', gizmoMode === 'scale');
}

function setupActionDockEvents() {
  const btnMove = document.getElementById('btn-gizmo-move');
  const btnRotate = document.getElementById('btn-gizmo-rotate');
  const btnScale = document.getElementById('btn-gizmo-scale');
  const btnDelete = document.getElementById('btn-gizmo-delete');
  const btnClose = document.getElementById('btn-gizmo-close');

  if (btnMove) btnMove.addEventListener('click', () => setGizmoMode('translate'));
  if (btnRotate) btnRotate.addEventListener('click', () => setGizmoMode('rotate'));
  if (btnScale) btnScale.addEventListener('click', () => setGizmoMode('scale'));
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (selectedObject) {
        removeObj(selectedObject);
        deselectObject();
      }
    });
  }
  if (btnClose) btnClose.addEventListener('click', () => deselectObject());
}

export function selectObject(obj) {
  if (!obj || !obj.root) {
    deselectObject();
    return;
  }

  selectedObject = obj;
  window.__selectedObject = obj;
  if (transformControl) {
    transformControl.attach(obj.root);
    transformControl.setMode(gizmoMode);
  }

  if (boxHelper) {
    boxHelper.setFromObject(obj.root);
    boxHelper.visible = true;
  }

  updateDropLine();
  updateActionDockUI();
  SASCard.hover(obj);
}

export function deselectObject() {
  selectedObject = null;
  window.__selectedObject = null;
  if (transformControl) {
    transformControl.detach();
  }
  if (boxHelper) boxHelper.visible = false;
  if (dropLine) dropLine.visible = false;
  if (floorShadowCircle) floorShadowCircle.visible = false;
  updateActionDockUI();
  SASCard.hide();
}
if (typeof window !== 'undefined') {
  window.__deselectObject = deselectObject;
}

export function updateDropLine() {
  if (!selectedObject || !dropLine || !floorShadowCircle) {
    if (dropLine) dropLine.visible = false;
    if (floorShadowCircle) floorShadowCircle.visible = false;
    return;
  }

  const rootPos = new THREE.Vector3();
  selectedObject.root.getWorldPosition(rootPos);

  const floorPos = new THREE.Vector3(rootPos.x, 0.05, rootPos.z);

  const posAttr = dropLine.geometry.attributes.position;
  posAttr.setXYZ(0, rootPos.x, rootPos.y, rootPos.z);
  posAttr.setXYZ(1, floorPos.x, floorPos.y, floorPos.z);
  posAttr.needsUpdate = true;
  dropLine.computeLineDistances();
  dropLine.visible = (rootPos.y > 0.2);

  floorShadowCircle.position.copy(floorPos);
  floorShadowCircle.visible = (rootPos.y > 0.2);
}

// ════════ DIRECT OBJECT BODY DRAGGING ════════
export let isDirectDragging = false;
const directDragPlane = new THREE.Plane();
const directDragOffset = new THREE.Vector3();

export function startDirectObjectDrag(obj, hitPoint) {
  if (!obj || !obj.root) return;
  const { camera, controls } = getSceneState();
  if (!camera) return;

  isDirectDragging = true;
  if (typeof window !== 'undefined') window.__isDirectDragging = true;
  if (controls) controls.enabled = false;

  // Create a plane facing the camera coplanar with the object position
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  directDragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), obj.root.position);

  // Offset from hit point to object root position
  if (hitPoint) {
    directDragOffset.copy(obj.root.position).sub(hitPoint);
  } else {
    directDragOffset.set(0, 0, 0);
  }
}

export function updateDirectObjectDrag(cx, cy, raycaster) {
  if (!isDirectDragging || !selectedObject || !selectedObject.root) return;
  const { camera } = getSceneState();
  if (!camera || !raycaster) return;

  const planeHit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(directDragPlane, planeHit)) {
    selectedObject.root.position.copy(planeHit.add(directDragOffset));
    // Clamp within world coordinates
    selectedObject.root.position.x = Math.max(-50, Math.min(50, selectedObject.root.position.x));
    selectedObject.root.position.y = Math.max(0.2, Math.min(30, selectedObject.root.position.y));
    selectedObject.root.position.z = Math.max(-50, Math.min(50, selectedObject.root.position.z));

    if (transformControl) {
      transformControl.updateMatrixWorld();
    }
    if (boxHelper) {
      boxHelper.update();
    }
    updateDropLine();
  }
}

export function endDirectObjectDrag() {
  if (isDirectDragging) {
    isDirectDragging = false;
    if (typeof window !== 'undefined') window.__isDirectDragging = false;
    const { controls } = getSceneState();
    if (controls && window.__currentMode === 'nav') {
      controls.enabled = true;
    }
  }
}
