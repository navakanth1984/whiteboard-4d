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
  const urlPath = req.url.split('?')[0]; // strip query string before comparing/joining
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
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
