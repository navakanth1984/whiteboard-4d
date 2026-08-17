import * as THREE from 'three';
import { objects, links, register, removeObj } from '../core/history.js';
import { addBlock, addShape, SHAPES } from '../objects/shapes.js';
import { addText3D, addCursiveText3D, addTextRing } from '../objects/text.js';
import { addSpatialCard, CARD_PRESETS } from '../objects/models.js';
import { addIconNode, ICON_CATEGORIES } from '../objects/stickers.js';
import { addImagePanel } from '../objects/media.js';
import { createLink } from '../graph/links.js';

export function serializeSession() {
  return {
    v: 2,
    objects: objects.map(o => ({
      id: o.id,
      type: o.type,
      label: o.label,
      color: o.color,
      pos: o.root.position.toArray(),
      rot: o.root.rotation.toArray().slice(0, 3),
      scale: o.userScale || 1,
      presetId: o.preset?.id,
      iconItem: o.iconItem,
      src: o.type === 'image' ? (o._blobUrl || null) : undefined
    })),
    links: links.map(l => ({ a: l.a, b: l.b, ink: '#' + (l.lineCol?.getHexString() || '38bdf8') }))
  };
}

export function loadSessionData(data) {
  [...objects].forEach(removeObj);
  let restored = 0;

  const idMap = new Map();

  (data.objects || []).forEach(rec => {
    const pos = new THREE.Vector3().fromArray(rec.pos || [0, 1, 0]);
    const surf = { point: pos.clone(), normal: new THREE.Vector3(0, 1, 0) };
    let newObj = null;

    if (rec.type === 'card') {
      newObj = addSpatialCard(rec.presetId || 'api-gateway', surf, rec.color || '#38bdf8');
    } else if (rec.type === 'icon' && rec.iconItem) {
      newObj = addIconNode(rec.iconItem, surf, rec.color || '#38bdf8');
    } else if (rec.type === 'text' && rec.label) {
      newObj = addText3D(rec.label, pos, rec.color || '#38bdf8');
    } else if (rec.type === 'text-cursive' && rec.label) {
      newObj = addCursiveText3D(rec.label, pos, rec.color || '#38bdf8');
    } else if (rec.type === 'textring' && rec.label) {
      newObj = addTextRing(rec.label, pos, rec.color || '#38bdf8');
    } else if (rec.type === 'shape' && SHAPES[rec.label]) {
      newObj = addShape(rec.label, surf, rec.color || '#38bdf8');
    } else if (rec.type === 'block') {
      newObj = addBlock(pos.x, pos.y, pos.z, rec.color || '#38bdf8');
    } else if (rec.type === 'image' && rec.src) {
      newObj = addImagePanel(rec.src, pos, rec.color || '#38bdf8');
    }

    if (newObj) {
      if (rec.rot) newObj.root.rotation.fromArray(rec.rot);
      if (rec.scale && rec.scale !== 1) {
        newObj.userScale = rec.scale;
        newObj.root.scale.setScalar(rec.scale);
      }
      idMap.set(rec.id, newObj);
      restored++;
    }
  });

  // Restore links
  setTimeout(() => {
    (data.links || []).forEach(lk => {
      const objA = idMap.get(lk.a);
      const objB = idMap.get(lk.b);
      if (objA && objB) {
        createLink(objA, objB, lk.ink || '#38bdf8');
      }
    });
  }, 100);

  return restored;
}

export function saveSessionToDownload(name = 'bleuboard-session') {
  const data = serializeSession();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.json`;
  a.click();
}
