'use strict';
// Local preview: node dev.js  (uses an in-memory database, resets every restart)
process.env.ARENA_DEV = process.env.ARENA_DEV || '1';
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const handler = require('./api/arena.js');
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/api/arena') {
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => { req.query = u.query; try { req.body = b ? JSON.parse(b) : {}; } catch (e) { req.body = {}; } handler(req, res); });
    return;
  }
  let f = path.join(PUB, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) f = path.join(PUB, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Rootrank on http://localhost:' + (process.env.PORT || 3000)));
