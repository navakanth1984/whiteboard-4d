// spatial-bridge: local render/analysis service bridging whiteboard-4d captures
// through an OpenMontage-style ffmpeg pipeline (scene-detect + audio-energy),
// producing a "moments" manifest for spatial/interactive playback.
//
// Local-only for now: binds 127.0.0.1. Promote to a cloud host (Fly.io/Railway)
// once the local pipeline is verified end-to-end.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = 3100;
const DATA_DIR = path.join(__dirname, 'jobs');
fs.mkdirSync(DATA_DIR, { recursive: true });

function runFfprobe(filePath) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath];
    const p = spawn('ffprobe', args);
    let out = '';
    p.stdout.on('data', d => out += d);
    p.on('close', code => {
      if (code !== 0) return reject(new Error('ffprobe exited ' + code));
      try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
    });
    p.on('error', reject);
  });
}

// Scene-cut detection via ffmpeg's scene filter, mirroring OpenMontage's
// local ffmpeg-based scene_detect tool. Parses showinfo pts_time lines from stderr.
function runSceneDetect(filePath, threshold = 0.35) {
  return new Promise((resolve, reject) => {
    const args = ['-i', filePath, '-filter:v', `select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-'];
    const p = spawn('ffmpeg', args);
    let stderr = '';
    p.stderr.on('data', d => stderr += d);
    p.on('close', () => {
      const times = [];
      const re = /pts_time:([0-9.]+)/g;
      let m;
      while ((m = re.exec(stderr))) times.push(parseFloat(m[1]));
      resolve(times);
    });
    p.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-file-ext'
    });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/jobs') {
    const id = crypto.randomBytes(8).toString('hex');
    const ext = (req.headers['x-file-ext'] || 'webm').replace(/[^a-z0-9]/gi, '');
    const filePath = path.join(DATA_DIR, `${id}.${ext}`);
    const ws = fs.createWriteStream(filePath);
    req.pipe(ws);
    ws.on('finish', async () => {
      try {
        const [probe, scenes] = await Promise.all([runFfprobe(filePath), runSceneDetect(filePath)]);
        const duration = parseFloat(probe.format && probe.format.duration || '0');
        const manifest = {
          id, ext, duration,
          sizeBytes: fs.statSync(filePath).size,
          moments: scenes.map((t, i) => ({ index: i, t: Math.round(t * 100) / 100 })),
          createdAt: new Date().toISOString()
        };
        fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(manifest, null, 2));
        sendJson(res, 200, manifest);
      } catch (e) {
        sendJson(res, 500, { error: String(e.message || e) });
      }
    });
    ws.on('error', e => sendJson(res, 500, { error: String(e.message || e) }));
    return;
  }

  const jobMatch = req.url.match(/^\/jobs\/([a-f0-9]+)$/);
  if (req.method === 'GET' && jobMatch) {
    const manifestPath = path.join(DATA_DIR, `${jobMatch[1]}.json`);
    if (!fs.existsSync(manifestPath)) return sendJson(res, 404, { error: 'not found' });
    return sendJson(res, 200, JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  }

  const fileMatch = req.url.match(/^\/jobs\/([a-f0-9]+)\/file$/);
  if (req.method === 'GET' && fileMatch) {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith(fileMatch[1] + '.') && !f.endsWith('.json'));
    if (!files.length) return sendJson(res, 404, { error: 'not found' });
    const fp = path.join(DATA_DIR, files[0]);
    res.writeHead(200, { 'Content-Type': 'video/webm', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(fp).pipe(res);
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`spatial-bridge running at http://127.0.0.1:${PORT}/`);
});
