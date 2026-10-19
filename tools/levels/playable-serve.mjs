import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../outputs');
const port = Number(process.env.PLAYABLE_PORT || 8860);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); return response.end(); }
  let relative;
  try { relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); } catch { response.writeHead(400); return response.end(); }
  if (relative === '/') { response.writeHead(302, { Location: '/outputs/playable-battlefield-v1/index.html' }); return response.end(); }
  if (!relative.startsWith('/outputs/')) { response.writeHead(404); return response.end(); }
  const file = path.resolve(root, relative.slice('/outputs/'.length)), inside = path.relative(root, file), type = types[path.extname(file).toLowerCase()];
  if (!type || inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) { response.writeHead(403); return response.end(); }
  try {
    const stat = fs.statSync(file); if (!stat.isFile()) throw new Error('not-a-file');
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404); response.end(); }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Cloudstitch playable: http://127.0.0.1:${port}/outputs/playable-battlefield-v1/index.html\n`));
