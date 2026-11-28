'use strict';
process.env.ARENA_DEV = '1';
const handler = require('../api/arena.js');
const cat = require('../lib/catalog');
const { makeCtx, siteFlag } = require('../lib/shell');

function call(method, op, data, token, extraQuery) {
  return new Promise((resolve) => {
    const req = { method, query: Object.assign({ op }, extraQuery || {}), body: method === 'POST' ? Object.assign({ op }, data) : {}, headers: token ? { authorization: 'Bearer ' + token } : {}, socket: { remoteAddress: '1.1.1.1' } };
    const hdr = {};
    const res = { setHeader(k, v) { hdr[k] = v; }, end(b) { resolve({ code: this.statusCode, json: JSON.parse(b), hdr }); } };
    handler(req, res);
  });
}
const SECRET = 'dev-only-secret';
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };

(async () => {
  const tokens = {};
  for (const n of ['alice', 'bob']) { const r = await call('POST', 'signup', { user: n, pass: 'password123' }); ok(r.code === 200 && r.json.token, 'signup ' + n); tokens[n] = r.json.token; }
  ok((await call('POST', 'signup', { user: 'alice', pass: 'password123' })).code === 409, 'duplicate signup rejected');
  ok((await call('POST', 'login', { user: 'alice', pass: 'wrongwrong' })).code === 401, 'wrong password rejected');
  ok((await call('POST', 'login', { user: 'alice', pass: 'password123' })).code === 200, 'login works');

  const tr = await call('GET', 'tracks', {}, tokens.alice);
  ok(tr.json.total === cat.TOTAL && tr.json.tracks.length === cat.FAMS.length, 'tracks op lists ' + tr.json.total + ' levels in ' + tr.json.tracks.length + ' tracks');
  ok(tr.json.total >= 1000, 'at least 1000 levels');

  let total = 0, n = 0;
  for (const f of cat.FAMS) {
    for (let lv = 1; lv <= f.levels; lv++) {
      const id = f.id + '-' + lv, c = cat.getChallenge(id); n++;
      const ctx = makeCtx(SECRET, id, 'alice'), built = c.build(ctx), cmds = c.solve(built, ctx);
      const expected = c.type === 'flag' ? ctx.flag : c.type === 'site' ? siteFlag(SECRET, c.level) : String(built.answer);
      if (c.type !== 'site') {
        const r = await call('POST', 'exec', { id, history: cmds }, tokens.alice);
        ok((r.json.out || '').toLowerCase().indexOf(expected.toLowerCase()) >= 0, id + ' solvable via terminal');
      }
      if (c.type === 'flag') { const w = await call('POST', 'submit', { id, answer: expected }, tokens.bob); ok(w.json.ok === false, id + ' alice flag rejected for bob'); }
      else if (c.type === 'answer') { const eb = String(c.build(makeCtx(SECRET, id, 'bob')).answer); if (eb.toLowerCase() !== expected.toLowerCase()) { const w = await call('POST', 'submit', { id, answer: expected }, tokens.bob); ok(w.json.ok === false, id + ' alice answer rejected for bob'); } }
      const s = await call('POST', 'submit', { id, answer: expected }, tokens.alice);
      ok(s.json.ok === true && s.json.points > 0, id + ' accepted for alice');
      total += s.json.points || 0;
      if (lv === 1) { const again = await call('POST', 'submit', { id, answer: expected }, tokens.alice); ok(again.json.already === true, id + ' no double scoring'); }
    }
  }
  const me = await call('GET', 'me', {}, tokens.alice);
  ok(me.json.points === total, 'points add up: ' + me.json.points + ' rank ' + me.json.rank + ' pos ' + me.json.pos);
  const board = await call('GET', 'board', {}, null);
  ok(board.json.board[0].user === 'alice', 'leaderboard leader is alice');
  const prof = await call('GET', 'user', {}, null, { u: 'alice' });
  ok(prof.json.count === cat.TOTAL && prof.json.recent.length === 30 && prof.json.tracks.length === cat.FAMS.length, 'profile shows all solves by track');
  const tk = await call('GET', 'track', {}, tokens.alice, { id: 'nav' });
  ok(tk.json.levels.length === 30 && tk.json.levels.every((l) => l.solved) && tk.json.levels[0].solves === 1, 'track page lists solved levels with counts');
  const ch = await call('GET', 'challenge', {}, tokens.bob, { id: 'nav-1' });
  ok(ch.json.firstBlood === 'alice' && ch.json.solves === 1 && !('flag' in ch.json) && ch.json.next === 'nav-2' && ch.json.prev === null, 'first blood, links, no flag leakage');
  const h = await call('POST', 'hint', { id: 'weblog-2', n: 0 }, tokens.bob);
  const ch2 = await call('GET', 'challenge', {}, tokens.bob, { id: 'weblog-2' });
  ok(h.json.text && ch2.json.reward < ch2.json.points, 'hint costs points');
  const bad = await call('POST', 'exec', { id: 'nav-1', history: ['cat /etc/passwd; rm -rf /'] }, tokens.bob);
  ok(bad.code === 200, 'dangerous-looking command stays in sandbox: ' + JSON.stringify(bad.json.out).slice(0, 60));
  ok((await call('POST', 'exec', { id: 'nav-1', history: [] }, null)).code === 401, 'exec requires sign in');
  ok((await call('GET', 'challenge', {}, null, { id: 'nope-1' })).code === 404, 'unknown challenge is 404');
  ok((await call('GET', 'challenge', {}, null, { id: 'nav-31' })).code === 404, 'level out of range is 404');

  // daily, feed, streak, badges
  const dl = await call('GET', 'daily', {}, tokens.bob);
  ok(dl.json.id && cat.getChallenge(dl.json.id) && dl.json.reward > cat.getChallenge(dl.json.id).points && dl.json.solved === false, 'daily challenge is valid and carries a bonus');
  ok((await call('GET', 'daily', {}, tokens.alice)).json.solved === true && (await call('GET', 'daily', {}, tokens.alice)).json.solvedToday === 1, 'daily shows solved + count for alice');
  const dch = cat.getChallenge(dl.json.id), dctx = makeCtx(SECRET, dch.id, 'bob'), dbuilt = dch.build(dctx);
  const dans = dch.type === 'flag' ? dctx.flag : dch.type === 'site' ? siteFlag(SECRET, dch.level) : String(dbuilt.answer);
  const ds = await call('POST', 'submit', { id: dch.id, answer: dans }, tokens.bob);
  ok(ds.json.ok && ds.json.daily === true && ds.json.points >= Math.round(dch.points * 1.2) - 1 && ds.json.streak === 1, 'bob solves the daily: bonus applied and streak starts');
  const fd = await call('GET', 'feed', {}, null);
  ok(fd.json.feed.length === 12 && fd.json.feed[0].user === 'bob' && fd.json.feed.every((x) => x.id && x.title), 'live feed lists latest solves, newest first');
  const pb = await call('GET', 'user', {}, null, { u: 'bob' });
  ok(pb.json.streak === 1 && pb.json.badges.some((b) => b.id === 'daily'), 'bob profile has streak and daily badge');
  const pa = await call('GET', 'user', {}, null, { u: 'alice' });
  const ids = pa.json.badges.map((b) => b.id);
  ok(['first_blood', 'century', 'legend', 'finisher', 'daily'].every((x) => ids.indexOf(x) >= 0) && pa.json.streak >= 1, 'alice earned expected badges: ' + ids.join(','));

  // signal flags
  ok(tr.hdr['X-Rootrank-Signal'] === siteFlag(SECRET, 1), 'signal 1 header');
  ok((await call('GET', 'beacon', {}, null, { t: 'neon' })).json.beacon === siteFlag(SECRET, 2), 'signal 2 beacon');
  ok((await call('GET', 'beacon', {}, null, { t: 'x' })).code === 404, 'beacon needs token');
  ok(Buffer.from(tr.json._s, 'base64').toString() === siteFlag(SECRET, 3), 'signal 3 hidden payload');
  const rr = await call('POST', 'exec', { id: 'signal-4', history: ['rootrank'] }, tokens.bob);
  ok(/signal received/.test(rr.json.out) && rr.json.out.indexOf(Buffer.from(siteFlag(SECRET, 4)).toString('base64')) >= 0, 'signal 4 terminal command');
  console.log(checks + ' checks, ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
