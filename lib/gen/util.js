'use strict';
const crypto = require('crypto');
const GH = '/home/guest';
const pad = (n) => (n < 10 ? '0' : '') + n;
const hms = (r) => pad(r.int(0, 23)) + ':' + pad(r.int(0, 59)) + ':' + pad(r.int(0, 59));
const hmsOf = (sec) => pad(Math.floor(sec / 3600) % 24) + ':' + pad(Math.floor(sec / 60) % 60) + ':' + pad(sec % 60);
const iso = (sec) => '2026-11-26T' + hmsOf(sec) + 'Z';
const ip = (r) => r.pick(['10.0.', '172.16.', '192.168.']) + r.int(0, 20) + '.' + r.int(2, 250);
const pubip = (r) => r.int(23, 198) + '.' + r.int(1, 250) + '.' + r.int(1, 250) + '.' + r.int(2, 250);
const WORDS = ['alpha', 'bravo', 'cobalt', 'delta', 'ember', 'falcon', 'garnet', 'harbor', 'ion', 'jade', 'krypton', 'lumen', 'matrix', 'nebula', 'onyx', 'pixel', 'quartz', 'raven', 'sable', 'tundra', 'umbra', 'vector', 'warden', 'xenon', 'yonder', 'zephyr', 'atlas', 'beacon', 'cipher', 'drift', 'echo', 'forge', 'glyph', 'helix', 'indigo', 'jolt', 'kernel', 'lattice', 'mirage', 'nova', 'orbit', 'prism', 'quill', 'relay', 'signal', 'token', 'unity', 'vortex', 'wraith', 'zenith'];
const NAMES = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy', 'mallory', 'nina', 'oscar', 'peggy', 'quinn', 'rupert', 'sybil', 'trent', 'uma', 'victor', 'wendy', 'xavier', 'yara', 'zane', 'admin', 'deploy', 'git', 'backup', 'jenkins', 'oracle', 'ubuntu', 'test', 'www', 'ops'];
const PATHS = ['/home', '/login', '/about', '/api/user', '/api/token', '/dashboard', '/static/app.js', '/static/logo.png', '/search', '/cart', '/checkout', '/contact', '/blog', '/api/items', '/health'];
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const hexs = (s) => Buffer.from(s, 'utf8').toString('hex');
const revs = (s) => s.split('').reverse().join('');
const rot = (t, k) => t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + k) % 26 + b); });
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const privkey = (marker) => '-----BEGIN PRETEND KEY-----\n' + marker + '\n(pretend key material, not a real key)\n-----END PRETEND KEY-----\n';
const q = (s) => "'" + s + "'";
const word = (r) => r.pick(WORDS);
const uniqWords = (r, n) => { const out = new Set(); while (out.size < n) out.add(r.pick(WORDS) + '-' + r.hex(3)); return [...out]; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (lv, n, a, b) => Math.round(a + (b - a) * (n <= 1 ? 0 : (lv - 1) / (n - 1)));
const NOISE = ['processed job', 'cache refreshed for key', 'heartbeat from worker', 'connection opened by', 'request completed in', 'queue depth', 'session renewed for', 'config reloaded'];
const noiseLine = (r) => iso(r.int(0, 86399)) + ' INFO ' + r.pick(['worker-1', 'worker-2', 'worker-3', 'api', 'scheduler']) + ' ' + r.pick(NOISE) + ' ' + r.int(100, 9999);
const text = (a) => a.join('\n') + '\n';
const readme = (t) => ({ [GH + '/README.txt']: t.replace(/\n?$/, '\n') });
// layers: encode functions and the decoding commands the player would use
const LAYERS = {
  b64: { enc: b64, cmd: 'base64 -d', name: 'base64' },
  hex: { enc: hexs, cmd: 'xxd -r -p', name: 'hex' },
  rev: { enc: revs, cmd: 'rev', name: 'reversed text' },
  rot13: { enc: (t) => rot(t, 13), cmd: "tr 'A-Za-z' 'N-ZA-Mn-za-m'", name: 'rot13' }
};
module.exports = { GH, pad, hms, hmsOf, iso, ip, pubip, WORDS, NAMES, PATHS, b64, hexs, revs, rot, md5, sha256, privkey, q, word, uniqWords, clamp, lerp, noiseLine, text, readme, LAYERS };
