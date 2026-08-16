import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { getSceneState } from '../core/scene.js';
import { objects, removeObj } from '../core/history.js';

export let transformControl = null;
export let selectedObject = null;
let dropLine = null;
let floorShadowCircle = null;

export function initTransformSystem() {
  const { scene, camera, renderer, controls } = getSceneState();
  if (!scene || !camera || !renderer) return;

  transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.size = 0.85;
  transformControl.setSpace('world');
  scene.add(transformControl);

  // Disable orbit controls while dragging gizmo
  transformControl.addEventListener('dragging-changed', event => {
    if (controls) controls.enabled = !event.value;
  });

  transformControl.addEventListener('change', () => {
    updateDropLine();
  });

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
    if (!selectedObject) return;

    if (e.code === 'KeyG') {
      transformControl.setMode('translate');
    } else if (e.code === 'KeyR') {
      transformControl.setMode('rotate');
    } else if (e.code === 'KeyS') {
      transformControl.setMode('scale');
    } else if (e.code === 'Escape') {
      deselectObject();
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (selectedObject) {
        removeObj(selectedObject);
        deselectObject();
      }
    }
  });
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
  }

  updateDropLine();
}

export function deselectObject() {
  selectedObject = null;
  window.__selectedObject = null;
  if (transformControl) {
    transformControl.detach();
  }
  if (dropLine) dropLine.visible = false;
  if (floorShadowCircle) floorShadowCircle.visible = false;
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
