import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(__dirname, '..', 'Knowladge-Graph');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const port = process.env.PORT || 3333;

const server = http.createServer((req, res) => {
  const cleanPath = req.url.split('?')[0];
  let file = path.join(base, cleanPath === '/' ? 'index.html' : cleanPath);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const dirIndex = path.join(file, 'index.html');
    if (fs.existsSync(dirIndex)) {
      file = dirIndex;
    }
  }
  if (!fs.existsSync(file)) {
    file = path.join(base, 'index.html');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  const stream = fs.createReadStream(file);
  stream.on('error', (_err) => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error loading file');
  });
  stream.pipe(res);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Knowledge Graph local server live at http://localhost:${port}/`);
});
