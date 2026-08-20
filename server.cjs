const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.spz': 'application/octet-stream',
  '.splat': 'application/octet-stream',
  '.ply': 'application/octet-stream',
  '.sog': 'application/octet-stream',
  '.ksplat': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm'
};

http.createServer((req, res) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400);
    return res.end('400 Bad Request');
  }

  let normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  if (normalizedPath === '/v2' || normalizedPath === '/v2/' || normalizedPath === 'v2' || normalizedPath === 'v2/') {
    normalizedPath = '/v2/index.html';
  }

  // Prevent path traversal by resolving relative to __dirname and enforcing jail boundary
  const safeBase = path.resolve(__dirname);
  const filePath = path.resolve(safeBase, '.' + path.normalize('/' + normalizedPath));

  if (!filePath.startsWith(safeBase + path.sep) && filePath !== safeBase) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  let extname = path.extname(filePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[extname] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
