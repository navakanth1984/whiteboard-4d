// v2/src/physics/rapier_engine.js — Rapier.js 3D Physics Engine (Zero-G, Bouncing & Spatial Tossing)
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { objects } from '../core/history.js';
import { getSceneState } from '../core/scene.js';

let world = null;
let isPhysicsInitialized = false;
let isPhysicsActive = false;
const bodyMap = new Map(); // objectId -> { rigidBody, collider, mesh }
let draggingObjectId = null; // object currently being manually moved (gizmo or direct-body drag)

/**
 * Initializes Rapier.js WASM and creates the 3D Physics World
 */
export async function initRapierPhysics() {
  if (isPhysicsInitialized) return;

  try {
    await RAPIER.init();
    const gravity = { x: 0.0, y: 0.0, z: 0.0 }; // Start in Zero-G
    world = new RAPIER.World(gravity);

    // Create Floor Boundary Collider
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const floorBody = world.createRigidBody(floorBodyDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.5, 50.0);
    world.createCollider(floorColliderDesc, floorBody);

    isPhysicsInitialized = true;
    isPhysicsActive = true;
    syncExistingObjectsToPhysics();
  } catch (err) {
    console.error('Failed to initialize Rapier.js physics:', err);
  }
}

/**
 * Registers a Three.js whiteboard object into the Rapier physics simulation
 */
export function registerPhysicsBody(obj) {
  if (!world || !obj || !obj.root || bodyMap.has(obj.id)) return;

  const pos = obj.root.position;
  const rot = obj.root.quaternion;

  // Compute bounding box dimensions
  const box = new THREE.Box3().setFromObject(obj.root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const hx = Math.max(0.2, size.x / 2);
  const hy = Math.max(0.2, size.y / 2);
  const hz = Math.max(0.1, size.z / 2);

  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
    .setLinearDamping(0.8)
    .setAngularDamping(0.8);

  const rigidBody = world.createRigidBody(rigidBodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setRestitution(0.65) // Bouncy cards
    .setFriction(0.3);

  const collider = world.createCollider(colliderDesc, rigidBody);

  bodyMap.set(obj.id, {
    rigidBody,
    collider,
    obj
  });
}

function syncExistingObjectsToPhysics() {
  objects.forEach(obj => {
    registerPhysicsBody(obj);
  });
}

/**
 * Steps the physics simulation and updates Three.js object transforms
 */
export function updatePhysics(dt) {
  if (!world || !isPhysicsActive) return;

  world.step();

  bodyMap.forEach(({ rigidBody, obj }) => {
    if (!obj.root || !rigidBody) return;

    // Skip physics->visual sync for the object currently being manually dragged —
    // otherwise this overwrites the user's drag with the rigid body's stale transform.
    if (obj.id === draggingObjectId) return;

    // Sync position
    const t = rigidBody.translation();
    obj.root.position.set(t.x, t.y, t.z);

    // Sync rotation
    const r = rigidBody.rotation();
    obj.root.quaternion.set(r.x, r.y, r.z, r.w);
  });
}

/**
 * Marks an object as under manual control (gizmo or direct-body drag) so the
 * physics step stops overwriting its transform. Call with null to release.
 */
export function setDraggingObject(objectId) {
  draggingObjectId = objectId ?? null;
}

/**
 * Pushes a manually-dragged object's current Three.js transform into its
 * Rapier rigid body, keeping physics in sync while the user is moving it
 * (and zeroing velocity so it doesn't drift once released).
 */
export function syncBodyTransform(objectId, position, quaternion) {
  const item = bodyMap.get(objectId);
  if (!item || !item.rigidBody) return;
  item.rigidBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
  if (quaternion) {
    item.rigidBody.setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }, true);
  }
  item.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  item.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/**
 * Applies a physical toss impulse to a specific object (e.g. on mouse release)
 */
export function applyImpulse(objectId, impulseVector) {
  const item = bodyMap.get(objectId);
  if (!item || !item.rigidBody) return;
  item.rigidBody.applyImpulse(impulseVector, true);
}

/**
 * Sets gravity environment
 */
export function setGravityMode(mode = 'zero-g') {
  if (!world) return;
  if (mode === 'earth') {
    world.gravity = { x: 0.0, y: -9.81, z: 0.0 };
  } else if (mode === 'moon') {
    world.gravity = { x: 0.0, y: -1.62, z: 0.0 };
  } else {
    world.gravity = { x: 0.0, y: 0.0, z: 0.0 }; // Zero-G
  }
}

export function togglePhysics(enable) {
  isPhysicsActive = (enable !== undefined) ? enable : !isPhysicsActive;
  return isPhysicsActive;
}

export function isPhysicsEnabled() {
  return isPhysicsActive;
}

export const initPhysics = initRapierPhysics;

