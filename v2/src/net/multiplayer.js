// v2/src/net/multiplayer.js — Real-Time Multi-User Spatial Collaboration Engine via WebRTC PeerJS
import * as THREE from 'three';
import { Peer } from 'peerjs';
import { getSceneState } from '../core/scene.js';
import { register, objects } from '../core/history.js';

let peerInstance = null;
let activeConnections = new Map();
let remoteAvatars = new Map();
let lastBroadcastTime = 0;
let localPeerId = null;

/**
 * Initializes the Multi-User Collaboration system
 */
export function initMultiplayerSystem() {
  initMultiplayerUI();
}

/**
 * Connects to a spatial collaboration room via WebRTC
 */
export function connectRoom(roomId = 'bleuboard-room-alpha') {
  if (peerInstance) return Promise.resolve(localPeerId);

  return new Promise((resolve) => {
    try {
      const generatedId = 'bb-user-' + Math.random().toString(36).substring(2, 8);
      peerInstance = new Peer(generatedId, {
        debug: 1
      });

      peerInstance.on('open', (id) => {
        localPeerId = id;
        console.log('Connected to WebRTC Signaling Mesh with ID:', id);
        updatePeerBadge(activeConnections.size + 1);
        resolve(id);
      });

      peerInstance.on('connection', (conn) => {
        setupDataConnection(conn);
      });

      peerInstance.on('error', (err) => {
        console.warn('WebRTC Peer Warning:', err);
      });
    } catch (e) {
      console.warn('WebRTC Connection initialization warning:', e);
      resolve(null);
    }
  });
}

function setupDataConnection(conn) {
  conn.on('open', () => {
    activeConnections.set(conn.peer, conn);
    updatePeerBadge(activeConnections.size + 1);
    console.log(`Peer connected: ${conn.peer}`);
  });

  conn.on('data', (data) => {
    handleRemoteMessage(data, conn.peer);
  });

  conn.on('close', () => {
    activeConnections.delete(conn.peer);
    removeRemoteAvatar(conn.peer);
    updatePeerBadge(activeConnections.size + 1);
  });
}

function handleRemoteMessage(msg, senderId) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'avatar_pose') {
    updateRemoteAvatarPose(senderId, msg.pos, msg.rot);
  }
}

/**
 * Updates remote avatar interpolation and broadcasts local avatar pose at 20Hz
 */
export function updateMultiplayer(dt, avatarPos, avatarRot) {
  // 1. Interpolate remote avatars smoothly
  const lerpFactor = Math.min(1.0, dt * 12.0);
  remoteAvatars.forEach((avatar) => {
    if (avatar.targetPos) {
      avatar.mesh.position.lerp(avatar.targetPos, lerpFactor);
    }
    if (avatar.targetRot) {
      avatar.mesh.quaternion.slerp(avatar.targetRot, lerpFactor);
    }
  });

  // 2. Broadcast local avatar pose at 20Hz
  const now = performance.now();
  if (now - lastBroadcastTime > 50 && activeConnections.size > 0 && avatarPos) {
    lastBroadcastTime = now;
    const poseMsg = {
      type: 'avatar_pose',
      pos: { x: avatarPos.x, y: avatarPos.y, z: avatarPos.z },
      rot: avatarRot ? { x: avatarRot.x, y: avatarRot.y, z: avatarRot.z, w: avatarRot.w } : null
    };
    broadcastAction(poseMsg);
  }
}

/**
 * Broadcasts an event to all connected peers
 */
export function broadcastAction(data) {
  activeConnections.forEach((conn) => {
    if (conn.open) {
      conn.send(data);
    }
  });
}

function updateRemoteAvatarPose(peerId, pos, rot) {
  const { scene } = getSceneState();
  if (!scene) return;

  let avatar = remoteAvatars.get(peerId);
  if (!avatar) {
    const mesh = createHolographicAvatarMesh(peerId);
    scene.add(mesh);
    avatar = {
      mesh,
      targetPos: new THREE.Vector3(pos.x, pos.y, pos.z),
      targetRot: new THREE.Quaternion()
    };
    remoteAvatars.set(peerId, avatar);
  }

  if (pos) avatar.targetPos.set(pos.x, pos.y, pos.z);
  if (rot) avatar.targetRot.set(rot.x, rot.y, rot.z, rot.w);
}

function createHolographicAvatarMesh(peerId) {
  const group = new THREE.Group();

  // Hologram head visor
  const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const holoMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.6
  });
  const head = new THREE.Mesh(headGeo, holoMat);
  head.position.y = 1.8;
  group.add(head);

  // Hologram chest
  const chestGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.8, 8);
  const chest = new THREE.Mesh(chestGeo, holoMat);
  chest.position.y = 1.1;
  group.add(chest);

  return group;
}

function removeRemoteAvatar(peerId) {
  const avatar = remoteAvatars.get(peerId);
  if (avatar) {
    const { scene } = getSceneState();
    if (scene) scene.remove(avatar.mesh);
    remoteAvatars.delete(peerId);
  }
}

function updatePeerBadge(count) {
  const badge = document.getElementById('peer-count-badge');
  if (badge) {
    badge.textContent = `👥 ${count} LIVE`;
  }
}

function initMultiplayerUI() {
  const btnShare = document.getElementById('btn-share-room');
  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      const id = await connectRoom();
      alert(`Multiplayer Room Live! Your Peer ID is:\n${id}`);
    });
  }
}

export function getConnectedPeers() {
  return Array.from(activeConnections.keys());
}
