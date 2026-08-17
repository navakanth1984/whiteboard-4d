import * as THREE from 'three';
import { register } from '../core/history.js';
import { placeTargets } from '../core/scene.js';

export function flatShape(fn) {
  const s = new THREE.Shape();
  fn(s);
  return new THREE.ShapeGeometry(s);
}

export function polyGeo(n, r) {
  return flatShape(s => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i) s.lineTo(x, y); else s.moveTo(x, y);
    }
    s.closePath();
  });
}

export function starGeo(pts, ro, ri) {
  return flatShape(s => {
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 ? ri : ro;
      const a = Math.PI / 2 + (i * Math.PI) / pts;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i) s.lineTo(x, y); else s.moveTo(x, y);
    }
    s.closePath();
  });
}

export function heartGeo() {
  return flatShape(s => {
    s.moveTo(0, 0.35);
    s.bezierCurveTo(0, 0.7, -0.5, 1.0, -0.75, 0.55);
    s.bezierCurveTo(-1.0, 0.1, -0.4, -0.2, 0, -0.7);
    s.bezierCurveTo(0.4, -0.2, 1.0, 0.1, 0.75, 0.55);
    s.bezierCurveTo(0.5, 1.0, 0, 0.7, 0, 0.35);
  });
}

export const SHAPES = {
  // 3D solids
  cube:     { d3: true,  icon: 'view_in_ar',            label: 'Cube',        make: () => new THREE.BoxGeometry(1.4, 1.4, 1.4) },
  sphere:   { d3: true,  icon: 'radio_button_unchecked', label: 'Sphere',      make: () => new THREE.SphereGeometry(0.9, 32, 24) },
  cone:     { d3: true,  icon: 'change_history',        label: 'Cone',        make: () => new THREE.ConeGeometry(0.9, 1.6, 32) },
  cylinder: { d3: true,  icon: 'view_column',           label: 'Cylinder',    make: () => new THREE.CylinderGeometry(0.7, 0.7, 1.5, 32) },
  torus:    { d3: true,  icon: 'adjust',                label: 'Torus',       make: () => new THREE.TorusGeometry(0.7, 0.28, 16, 40) },
  knot:     { d3: true,  icon: 'all_inclusive',         label: 'Torus Knot',  make: () => new THREE.TorusKnotGeometry(0.6, 0.22, 80, 12) },
  ico:      { d3: true,  icon: 'diamond',               label: 'Icosahedron', make: () => new THREE.IcosahedronGeometry(0.95, 0) },
  dodeca:   { d3: true,  icon: 'hexagon',               label: 'Dodecahedron', make: () => new THREE.DodecahedronGeometry(0.95, 0) },
  octa:     { d3: true,  icon: 'grain',                 label: 'Octahedron',   make: () => new THREE.OctahedronGeometry(0.95, 0) },
  tetra:    { d3: true,  icon: 'details',               label: 'Tetrahedron',  make: () => new THREE.TetrahedronGeometry(1.05, 0) },
  prism:    { d3: true,  icon: 'change_history',        label: 'Prism',       make: () => new THREE.CylinderGeometry(0.85, 0.85, 1.4, 3) },
  capsule:  { d3: true,  icon: 'medication',            label: 'Capsule',     make: () => new THREE.CylinderGeometry(0.5, 0.5, 1.3, 20) },

  // 2D flats
  circle:   { d3: false, icon: 'circle',                label: 'Circle',   make: () => new THREE.CircleGeometry(0.95, 48) },
  square:   { d3: false, icon: 'square',                label: 'Square',   make: () => new THREE.PlaneGeometry(1.7, 1.7) },
  triangle: { d3: false, icon: 'change_history',        label: 'Triangle', make: () => flatShape(s => { s.moveTo(0, 1); s.lineTo(-0.95, -0.7); s.lineTo(0.95, -0.7); s.closePath(); }) },
  star:     { d3: false, icon: 'star',                  label: 'Star',     make: () => starGeo(5, 1, 0.45) },
  heart:    { d3: false, icon: 'favorite',              label: 'Heart',    make: () => heartGeo() },
  hexagon:  { d3: false, icon: 'hexagon',               label: 'Hexagon',  make: () => polyGeo(6, 1) },
  pentagon: { d3: false, icon: 'pentagon',              label: 'Pentagon', make: () => polyGeo(5, 1) },
  diamond:  { d3: false, icon: 'diamond',               label: 'Diamond',  make: () => polyGeo(4, 1) },
};

export let curShape = 'cube';
export function setCurShape(key) {
  if (SHAPES[key]) curShape = key;
}

export function addShape(key, surf, hex) {
  const def = SHAPES[key] || SHAPES.cube;
  const col = new THREE.Color(hex);

  // Modern Luminous Glassmorphic Material (Glass + Inner Core Glow)
  const mat = def.d3
    ? new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: col.clone().multiplyScalar(0.35),
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.65, // Frosted glass transmission
        thickness: 1.2,
        ior: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.95
      })
    : new THREE.MeshStandardMaterial({
        color: col,
        emissive: col.clone().multiplyScalar(0.4),
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });

  const mesh = new THREE.Mesh(def.make(), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  const root = new THREE.Group();

  // Inner Luminous Core Mesh for 3D shapes to create volumetric depth glow
  if (def.d3) {
    const coreGeo = def.make();
    coreGeo.scale(0.55, 0.55, 0.55);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mesh.add(coreMesh);
  }

  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, def.d3 ? 1.0 : 0.05);
  root.add(mesh);

  if (!def.d3) root.userData.billboardY = true;
  else root.userData.spin = true;

  const o = register(root, 'shape', key, hex);
  o.is3D = def.d3;
  if (def.d3) {
    placeTargets.push(mesh);
    o.collider = mesh;
  }
  return o;
}

export function addBlock(gx, gy, gz, hex) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const col = new THREE.Color(hex);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col.clone().multiplyScalar(0.07),
      roughness: 0.55,
      metalness: 0.05
    })
  );
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    )
  );
  const root = new THREE.Group();
  root.position.set(gx, gy, gz);
  root.add(mesh);

  const o = register(root, 'block', 'Block', hex);
  placeTargets.push(mesh);
  o.collider = mesh;
  return o;
}
