// v2/src/objects/flip_deck.js — 3D Multi-Page Interactive Flip Deck & Document Carousel
import * as THREE from 'three';
import { register } from '../core/history.js';
import { playWhoosh, playSnapChime, playClickSound } from '../audio/haptics.js';

let activeDecks = new Map();

export function initFlipDeckSystem() {
  // Ready
}


/**
 * Creates an interactive 3D multi-page flip deck in spatial coordinates
 * @param {Array<{title: string, body: string, bg: string}>} pages
 * @param {THREE.Vector3} position
 */
export function createFlipDeck(pages = null, position = null) {
  const defaultPages = pages || [
    { title: 'BLEUUBOARD 4D', body: 'Next-Gen Spatial Collaboration Studio\n\n- Real-Time 3D Canvas\n- Gaussian Splatting\n- AI In-World Copilot', bg: '#0f172a' },
    { title: 'SPATIAL ARCHITECTURE', body: 'Universal Kinematics & Physics\n\n- Rapier.js 3D Physics\n- VRM Humanoid Avatars\n- WebXR 6DoF Controllers', bg: '#1e1b4b' },
    { title: 'LIVE MULTIPLAYER', body: 'Mesh P2P WebRTC Sync\n\n- 20Hz Transform Broadcast\n- 3D Positional Audio Cones\n- 1-Click Sector Teleport', bg: '#064e3b' }
  ];

  const deckGroup = new THREE.Group();
  const deckId = 'deck-' + Math.random().toString(36).substring(2, 9);
  deckGroup.userData.deckId = deckId;
  deckGroup.userData.currentPage = 0;
  deckGroup.userData.totalPages = defaultPages.length;

  const pageMeshes = [];
  const cardWidth = 5.0;
  const cardHeight = 3.2;

  // Deck Backing / Base Stand
  const standGeo = new THREE.BoxGeometry(cardWidth + 0.4, 0.15, 0.6);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.2,
    metalness: 0.8
  });
  const stand = new THREE.Mesh(standGeo, standMat);
  stand.position.set(cardWidth / 2, -cardHeight / 2 - 0.1, 0);
  deckGroup.add(stand);

  // Build each page mounted on a spine hinge at x=0
  defaultPages.forEach((pageData, idx) => {
    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(0, 0, idx * -0.02);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');

    // Draw Page Layout
    ctx.fillStyle = pageData.bg || '#0f172a';
    ctx.fillRect(0, 0, 512, 340);

    // Cyan Border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 328);

    // Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(pageData.title, 30, 55);

    // Page number badge
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`PAGE ${idx + 1} / ${defaultPages.length}`, 380, 55);

    // Body
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px monospace';
    const lines = pageData.body.split('\n');
    lines.forEach((line, lIdx) => {
      ctx.fillText(line, 30, 110 + lIdx * 28);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const pageMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const pageGeo = new THREE.PlaneGeometry(cardWidth, cardHeight);
    const pageMesh = new THREE.Mesh(pageGeo, pageMat);
    pageMesh.position.set(cardWidth / 2, 0, 0); // Offset so hinge rotates around left spine edge

    hingeGroup.add(pageMesh);
    deckGroup.add(hingeGroup);

    pageMeshes.push({
      index: idx,
      hinge: hingeGroup,
      mesh: pageMesh,
      canvas,
      ctx,
      texture
    });
  });

  const pos = position || new THREE.Vector3(0, 10, -5);
  deckGroup.position.copy(pos);

  const deckRecord = {
    id: deckId,
    type: 'flipdeck',
    root: deckGroup,
    collider: stand,
    pageMeshes,
    pages: defaultPages
  };

  activeDecks.set(deckId, deckRecord);
  register(deckRecord);
  playSnapChime();

  return deckRecord;
}

/**
 * Flips the deck to a specific target page with realistic 3D curl rotation
 */
export function flipToPage(deckId, targetIndex) {
  const deck = activeDecks.get(deckId);
  if (!deck) return;

  const total = deck.pages.length;
  const clampedIdx = Math.max(0, Math.min(total - 1, targetIndex));
  deck.root.userData.currentPage = clampedIdx;

  playWhoosh();

  deck.pageMeshes.forEach((p, idx) => {
    const targetAngle = idx < clampedIdx ? -Math.PI * 0.98 : 0;
    if (typeof window.gsap !== 'undefined') {
      window.gsap.to(p.hinge.rotation, {
        y: targetAngle,
        duration: 0.6,
        ease: 'power2.out'
      });
    } else {
      p.hinge.rotation.y = targetAngle;
    }
  });

  return clampedIdx;
}

export function getActiveFlipDecks() {
  return Array.from(activeDecks.values());
}

export const addFlipDeckCard = createFlipDeck;

