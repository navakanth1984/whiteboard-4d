import * as THREE from 'three';
import { register } from '../core/history.js';
import { placeTargets } from '../core/scene.js';

// ── Official Brand & Architecture Node Definitions (Simple Icons & Lucide) ─
export const ICON_CATEGORIES = {
  'Data Eng': [
    { id: 'databricks', label: 'Databricks', slug: 'databricks', hex: '#FF3621' },
    { id: 'apachespark', label: 'Spark', slug: 'apachespark', hex: '#E25A1C' },
    { id: 'snowflake', label: 'Snowflake', slug: 'snowflake', hex: '#29B5E8' },
    { id: 'apachekafka', label: 'Kafka', slug: 'apachekafka', hex: '#231F20' },
    { id: 'apacheairflow', label: 'Airflow', slug: 'apacheairflow', hex: '#017CEE' },
    { id: 'dbt', label: 'dbt', slug: 'dbt', hex: '#FF694B' },
    { id: 'apacheflink', label: 'Flink', slug: 'apacheflink', hex: '#E6526F' },
    { id: 'trino', label: 'Trino', slug: 'trino', hex: '#DD00A1' },
    { id: 'postgresql', label: 'Postgres', slug: 'postgresql', hex: '#4169E1' },
    { id: 'mongodb', label: 'MongoDB', slug: 'mongodb', hex: '#47A248' },
    { id: 'redis', label: 'Redis', slug: 'redis', hex: '#DC382D' },
    { id: 'elasticsearch', label: 'Elastic', slug: 'elastic', hex: '#005571' }
  ],
  'Cloud': [
    { id: 'aws', label: 'AWS', slug: 'amazonwebservices', hex: '#FF9900' },
    { id: 'azure', label: 'Azure', slug: 'microsoftazure', hex: '#0078D4' },
    { id: 'gcp', label: 'Google Cloud', slug: 'googlecloud', hex: '#4285F4' },
    { id: 'kubernetes', label: 'Kubernetes', slug: 'kubernetes', hex: '#326CE5' },
    { id: 'docker', label: 'Docker', slug: 'docker', hex: '#2496ED' },
    { id: 'terraform', label: 'Terraform', slug: 'terraform', hex: '#844FBA' },
    { id: 'cloudflare', label: 'Cloudflare', slug: 'cloudflare', hex: '#F38020' },
    { id: 'vercel', label: 'Vercel', slug: 'vercel', hex: '#FFFFFF' },
    { id: 'supabase', label: 'Supabase', slug: 'supabase', hex: '#3FCF8E' },
    { id: 'firebase', label: 'Firebase', slug: 'firebase', hex: '#FFCA28' },
    { id: 'githubactions', label: 'CI / CD', slug: 'githubactions', hex: '#2088FF' },
    { id: 'grafana', label: 'Grafana', slug: 'grafana', hex: '#F46800' }
  ],
  'AI & Frontier': [
    { id: 'openai', label: 'OpenAI', slug: 'openai', hex: '#412991' },
    { id: 'googlegemini', label: 'Gemini', slug: 'googlegemini', hex: '#8E75FF' },
    { id: 'anthropic', label: 'Claude', slug: 'anthropic', hex: '#D97757' },
    { id: 'huggingface', label: 'HuggingFace', slug: 'huggingface', hex: '#FFD21E' },
    { id: 'pytorch', label: 'PyTorch', slug: 'pytorch', hex: '#EE4C2C' },
    { id: 'tensorflow', label: 'TensorFlow', slug: 'tensorflow', hex: '#FF6F00' },
    { id: 'langchain', label: 'LangChain', slug: 'langchain', hex: '#1C3C3C' },
    { id: 'nvidia', label: 'NVIDIA NIM', slug: 'nvidia', hex: '#76B900' },
    { id: 'ollama', label: 'Ollama', slug: 'ollama', hex: '#FFFFFF' },
    { id: 'pinecone', label: 'Pinecone', slug: 'pinecone', hex: '#000000' },
    { id: 'qdrant', label: 'Qdrant', slug: 'qdrant', hex: '#DC2626' },
    { id: 'meta', label: 'Llama 3', slug: 'meta', hex: '#0081FB' }
  ],
  'Dev & Tools': [
    { id: 'react', label: 'React', slug: 'react', hex: '#61DAFB' },
    { id: 'typescript', label: 'TypeScript', slug: 'typescript', hex: '#3178C6' },
    { id: 'python', label: 'Python', slug: 'python', hex: '#3776AB' },
    { id: 'rust', label: 'Rust', slug: 'rust', hex: '#000000' },
    { id: 'go', label: 'Go', slug: 'go', hex: '#00ADD8' },
    { id: 'nodedotjs', label: 'Node.js', slug: 'nodedotjs', hex: '#5FA04E' },
    { id: 'graphql', label: 'GraphQL', slug: 'graphql', hex: '#E10098' },
    { id: 'tailwindcss', label: 'Tailwind', slug: 'tailwindcss', hex: '#06B6D4' },
    { id: 'threejs', label: 'Three.js', slug: 'threedotjs', hex: '#000000' },
    { id: 'figma', label: 'Figma', slug: 'figma', hex: '#F24E1E' },
    { id: 'github', label: 'GitHub', slug: 'github', hex: '#181717' },
    { id: 'postman', label: 'Postman', slug: 'postman', hex: '#FF6C37' }
  ]
};

export let curIconCat = 'Data Eng';
export let curIconKey = 0;

export function getActiveIconItem() {
  const items = ICON_CATEGORIES[curIconCat] || [];
  return items[curIconKey] || items[0] || null;
}

export function setIconCategory(cat) {
  if (ICON_CATEGORIES[cat]) {
    curIconCat = cat;
    curIconKey = 0;
  }
}

export function setCurIconIndex(idx) {
  curIconKey = idx;
}

// ── Sticker Library ─────────────────────────────────────────
export const STICKERS = [
  '😀', '😎', '🥳', '🤖', '👽', '💀', '❤️', '🔥', '⭐', '🌟', '✨', '⚡', '💎', '🎈', '🚀', '🌈',
  '🦅', '🐦', '🕊️', '🦜', '🦢', '🦋', '🐝', '🐞', '🐱', '🐶', '🦊', '🐼', '🦁', '🐯', '🐰', '🐸',
  '🐢', '🐙', '🐠', '🦈', '🌳', '🌲', '🌸', '🌺', '🍄', '🍎', '🌙', '☀️', '☁️', '💧', '🎵', '💡'
];

export let curSticker = '🦋';
export function setCurSticker(s) {
  curSticker = s;
}

// Helper to create high-resolution emoji textures
export function emojiTexture(ch) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.font = '200px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, S / 2, S / 2 + 12);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function addSticker(ch, surf, ink = '#00ccff') {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: emojiTexture(ch),
      transparent: true,
      depthTest: true
    })
  );
  sp.scale.set(3.2, 3.2, 1);
  const root = new THREE.Group();
  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, 1.6);
  root.add(sp);
  const o = register(root, 'sticker', ch, ink);
  o.sprite = sp;
  return o;
}

// ── Official Simple Icons SVG Rasterizer & 3D Glowing Node Creator ─
export function createIconTexture(item, isRect = false) {
  const W = isRect ? 680 : 512;
  const H = isRect ? 440 : 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);

    // Background Glassmorphic Rounded Slab
    const rr = 44;
    ctx.beginPath();
    ctx.moveTo(rr, 0);
    ctx.lineTo(W - rr, 0);
    ctx.arcTo(W, 0, W, rr, rr);
    ctx.lineTo(W, H - rr);
    ctx.arcTo(W, H, W - rr, H, rr);
    ctx.lineTo(rr, H);
    ctx.arcTo(0, H, 0, H - rr, rr);
    ctx.lineTo(0, rr);
    ctx.arcTo(0, 0, rr, 0, rr);
    ctx.closePath();

    // Dark Obsidian Glass gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#040e28');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fill();

    // Glowing Neon Accent Border
    ctx.lineWidth = 8;
    ctx.strokeStyle = item.hex || '#38bdf8';
    ctx.stroke();

    // Inner subtle circuit grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Draw bottom label strip
    const stripH = isRect ? 100 : 130;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.fillRect(0, H - stripH, W, stripH);

    ctx.font = '700 32px "Syne", "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(item.label, W / 2, H - stripH / 2);

    // Mini Corner Status LED
    ctx.fillStyle = item.hex || '#38bdf8';
    ctx.beginPath();
    ctx.arc(W - 44, 44, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBackground();

  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;

  // Fetch official Simple Icons vector SVG, inject fill color, and render
  fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${item.slug}.svg`)
    .then(r => r.text())
    .then(svgText => {
      // Colorize the SVG with white fill
      const coloredSvg = svgText.replace('<svg ', '<svg fill="#ffffff" ');
      const blob = new Blob([coloredSvg], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        drawBackground();
        const iconSize = isRect ? 190 : 210;
        const ix = (W - iconSize) / 2;
        const iy = isRect ? 44 : 56;
        ctx.drawImage(img, ix, iy, iconSize, iconSize);
        tex.needsUpdate = true;
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    })
    .catch(() => {
      // Fallback: draw brand letter
      ctx.font = '900 110px "Syne", sans-serif';
      ctx.fillStyle = item.hex || '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label.slice(0, 2).toUpperCase(), W / 2, isRect ? H * 0.35 : H * 0.4);
      tex.needsUpdate = true;
    });

  return tex;
}

export function addIconNode(item, surf, ink = '#00ccff', format = 'square') {
  const isRect = (format === 'rect');
  const width = isRect ? 3.4 : 2.8;
  const height = isRect ? 2.2 : 2.8;
  const depth = 0.22;

  const tex = createIconTexture(item, isRect);

  // 1. Front High-DPI Vector Face
  const faceMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide
  });
  const faceGeo = new THREE.PlaneGeometry(width * 0.96, height * 0.96);
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = depth * 0.5 + 0.01;

  // 2. Physical 3D Glowing Glass Chip Body
  const brandCol = new THREE.Color(item.hex || ink);
  const chipMat = new THREE.MeshStandardMaterial({
    color: 0x050d24,
    emissive: brandCol.clone().multiplyScalar(0.35),
    roughness: 0.12,
    metalness: 0.88,
    transparent: true,
    opacity: 0.94
  });
  const chipGeo = new THREE.BoxGeometry(width, height, depth);
  const chipMesh = new THREE.Mesh(chipGeo, chipMat);
  chipMesh.castShadow = true;
  chipMesh.receiveShadow = true;

  // 3. Vibrant Glowing Neon Perimeter Wireframe
  const edgeGeo = new THREE.EdgesGeometry(chipGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: brandCol,
    transparent: true,
    opacity: 0.9
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);

  // 4. 4 Glowing Corner L-Brackets for 3D Cyber Depth
  const bracketGroup = new THREE.Group();
  const bSize = 0.35;
  const bThick = 0.05;
  const bDepth = depth + 0.03;
  const bMat = new THREE.MeshStandardMaterial({
    color: 0x020617,
    emissive: brandCol.clone().multiplyScalar(0.6),
    roughness: 0.2,
    metalness: 0.9
  });

  const corners = [
    { x: -width / 2, y: height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 }
  ];

  corners.forEach(c => {
    const bH = new THREE.Mesh(new THREE.BoxGeometry(bSize, bThick, bDepth), bMat);
    bH.position.set(c.x + (c.x > 0 ? -bSize / 2 : bSize / 2), c.y + (c.y > 0 ? -bThick / 2 : bThick / 2), 0);
    bracketGroup.add(bH);

    const bV = new THREE.Mesh(new THREE.BoxGeometry(bThick, bSize, bDepth), bMat);
    bV.position.set(c.x + (c.x > 0 ? -bThick / 2 : bThick / 2), c.y + (c.y > 0 ? -bSize / 2 : bSize / 2), 0);
    bracketGroup.add(bV);
  });

  const root = new THREE.Group();
  root.add(chipMesh);
  root.add(faceMesh);
  root.add(edgeLines);
  root.add(bracketGroup);

  const normal = surf.normal || new THREE.Vector3(0, 1, 0);
  const point = surf.point || surf;
  root.position.copy(point).addScaledVector(normal, 1.4);
  root.userData.billboardY = true;
  root.userData.is3DIcon = true;

  const o = register(root, 'icon', item.label, item.hex || ink);
  o.iconItem = item;
  o.collider = chipMesh;
  placeTargets.push(chipMesh);
  return o;
}
