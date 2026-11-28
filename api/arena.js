'use strict';
const crypto = require('crypto');
const cat = require('../lib/catalog');
const { RANKS, rankOf, TIERS } = cat;
const { simulate, makeCtx, siteFlag } = require('../lib/shell');
const db = require('../lib/db');

const DEV = process.env.ARENA_DEV === '1';
const SECRET = process.env.ARENA_SECRET || (DEV ? 'dev-only-secret' : '');
const TOKEN_DAYS = 30;
const SCORE_BASE = 1e10;

function send(res, code, obj) {
  res.statusCode = code;
  if (SECRET) res.setHeader('X-Rootrank-Signal', siteFlag(SECRET, 1));
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
const b64u = (s) => Buffer.from(s).toString('base64url');
function sign(payload) { return b64u(JSON.stringify(payload)) + '.' + crypto.createHmac('sha256', SECRET).update('tok:' + b64u(JSON.stringify(payload))).digest('base64url'); }
function verify(tok) {
  if (!tok || tok.indexOf('.') < 0) return null;
  const [body, sig] = tok.split('.');
  const good = crypto.createHmac('sha256', SECRET).update('tok:' + body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.e > Date.now() ? p.u : null; } catch (e) { return null; }
}
function pwHash(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 120000, 32, 'sha256').toString('hex'); }
function who(req) { const h = req.headers.authorization || ''; return h.indexOf('Bearer ') === 0 ? verify(h.slice(7)) : null; }
function clientIp(req) { return String((req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'x').trim(); }
async function rate(key, limit, sec) {
  if (DEV) limit *= 100; const n = await db.incr('rl:' + key); if (n === 1) await db.expire('rl:' + key, sec); return n <= limit; }
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
function dailyId(day) {
  const ts = cat.listTracks().filter((t) => t.cat !== 'Legends');
  const h = crypto.createHash('sha1').update('daily:' + day).digest();
  const t = ts[h.readUInt16BE(0) % ts.length];
  const lv = 1 + (h.readUInt16BE(2) % t.levels);
  return t.id + '-' + lv;
}
const DAILY_BONUS = 0.2;
function liveStreak(h) { const n = Date.now(); return h.last === dayOf(n) || h.last === dayOf(n - 86400000) ? parseInt(h.streak || '0', 10) : 0; }
const BADGES = [
  ['first_blood', 'First blood', 'Solved a level before anyone else', (s) => s.fb > 0],
  ['streak3', '3-day streak', 'Solved something three days in a row', (s) => s.best >= 3],
  ['streak7', '7-day streak', 'A full week without missing a day', (s) => s.best >= 7],
  ['streak30', '30-day streak', 'A month of daily solves', (s) => s.best >= 30],
  ['daily', 'Daily driver', 'Solved a daily challenge on its day', (s) => s.daily > 0],
  ['century', 'Century', '100 levels solved', (s) => s.count >= 100],
  ['legend', 'Legend slayer', 'Solved a level in the Hall of Legends', (s) => s.legend > 0],
  ['finisher', 'Finisher', 'Completed every level of a course', (s) => s.finished > 0]
];
function badgesOf(s) { return BADGES.filter((b) => b[3](s)).map((b) => ({ id: b[0], name: b[1], desc: b[2] })); }
const scoreOf = (points, t) => points * SCORE_BASE + (SCORE_BASE - Math.floor(t / 1000));
const pointsOfScore = (s) => Math.floor(s / SCORE_BASE);

function award(base, hintsUsed) { return Math.round(base * Math.max(0.4, 1 - 0.15 * hintsUsed)); }

const LEGENDS_MIN = parseInt(process.env.LEGENDS_MIN || '0', 10), GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '', GH_ID = process.env.GITHUB_CLIENT_ID || '', GH_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
async function legendLocked(c, user) { if (c.cat !== 'Legends' || DEV || LEGENDS_MIN <= 0) return false; const h = await db.hgetall('u:' + user); return parseInt(h.points || '0', 10) < LEGENDS_MIN; }
const trackOf = (id) => String(id).split('-')[0];
const lvOf = (id) => parseInt(String(id).split('-')[1], 10);

module.exports = async function handler(req, res) {
  try {
    if (!SECRET || (!db.remote && !DEV)) {
      return send(res, 500, { error: 'Server is not configured. Set ARENA_SECRET and the Upstash Redis environment variables (see README).' });
    }
    const q = req.query || {};
    const body = typeof req.body === 'string' ? (req.body ? JSON.parse(req.body) : {}) : (req.body || {});
    const op = q.op || body.op;
    const user = who(req);

    /* ---------- public reads ---------- */
    if (op === 'beacon') {
      if (q.t !== 'neon') return send(res, 404, { error: 'nothing here' });
      return send(res, 200, { beacon: siteFlag(SECRET, 2), note: 'two down. the page itself hides one more.' });
    }
    if (op === 'tracks') {
      const [solved, tc, players] = await Promise.all([user ? db.smembers('s:' + user) : [], db.hgetall('tc'), db.zcard('lb')]);
      const mine = {}; solved.forEach((id) => { const t = trackOf(id); mine[t] = (mine[t] || 0) + 1; });
      const tracks = cat.listTracks().map((t) => Object.assign({}, t, { mine: mine[t.id] || 0, solves: parseInt(tc[t.id] || '0', 10) }));
      return send(res, 200, { tracks, total: cat.TOTAL, tiers: TIERS, ranks: RANKS, players, mineTotal: solved.length, cfg: { google: GOOGLE_ID, github: GH_ID, legendsMin: LEGENDS_MIN }, _s: Buffer.from(siteFlag(SECRET, 3)).toString('base64') });
    }
    if (op === 'track') {
      const f = cat.FAM_BY_ID[q.id]; if (!f) return send(res, 404, { error: 'Unknown track' });
      const [solved, lc] = await Promise.all([user ? db.smembers('s:' + user) : [], db.hgetall('lc:' + f.id)]);
      const set = {}; solved.forEach((id) => { set[id] = 1; });
      const levels = cat.levelsOf(f.id).map((l) => Object.assign({}, l, { solved: !!set[l.id], solves: parseInt(lc[l.level] || '0', 10) }));
      const t = cat.listTracks().find((x) => x.id === f.id);
      return send(res, 200, { track: t, levels, notes: (cat.getChallenge(f.id + '-1') || {}).notes || '' });
    }
    if (op === 'challenge') {
      const c = cat.getChallenge(q.id); if (!c) return send(res, 404, { error: 'Unknown challenge' });
      const [solves, first, solved, used] = await Promise.all([
        db.zcard('solves:' + c.id), db.zrange('solves:' + c.id, 0, 0),
        user ? db.sismember('s:' + user, c.id) : false, user ? db.smembers('h:' + user + ':' + c.id) : []
      ]);
      const lockedNow = c.cat === 'Legends' && !DEV && LEGENDS_MIN > 0 ? (user ? await legendLocked(c, user) : true) : false;
      const hints = (solved ? c.hints.map((h, i) => ({ i, text: h })) : c.hints.map((h, i) => (used.indexOf(String(i)) >= 0 ? { i, text: h } : { i, locked: true })));
      return send(res, 200, {
        id: c.id, track: c.track, level: c.level, levels: c.levels, prev: c.prev, next: c.next, title: c.title, tier: c.tier, cat: c.cat, points: c.points, type: c.type, brief: lockedNow ? '' : c.brief, notes: lockedNow ? '' : c.notes,
        solves, firstBlood: first[0] ? first[0].m : null, solved: !!solved, hints: lockedNow ? [] : hints,
        reward: user ? award(c.points, solved ? 0 : used.length) : c.points,
        locked: lockedNow, legendsMin: LEGENDS_MIN
      });
    }
    if (op === 'wall') {
      const legs = cat.FAMS.filter((f) => f.cat === 'Legends');
      const out = await Promise.all(legs.map(async (f) => { const top = await db.zrange('solves:' + f.id + '-' + f.levels, 0, 9); return { id: f.id, title: f.title, solvers: top.map((x) => ({ user: x.m, at: x.s })) }; }));
      return send(res, 200, { legends: out, min: LEGENDS_MIN });
    }
    if (op === 'daily') {
      const day = dayOf(Date.now()), id = dailyId(day), c = cat.getChallenge(id);
      const [n, mine] = await Promise.all([db.zcard('dsolve:' + day), user ? db.sismember('s:' + user, id) : false]);
      const t = new Date(day + 'T00:00:00Z').getTime() + 86400000;
      return send(res, 200, { id, title: c.title, track: c.track, tier: c.tier, level: c.level, reward: Math.round(c.points * (1 + DAILY_BONUS)), bonus: DAILY_BONUS, solvedToday: n, solved: !!mine, endsAt: t });
    }
    if (op === 'feed') {
      const now = Date.now(), keys = ['feed:' + dayOf(now), 'feed:' + dayOf(now - 86400000)];
      const parts = await Promise.all(keys.map((k) => db.zrevrange(k, 0, 11)));
      const all = [].concat(parts[0], parts[1]).sort((a, b) => b.s - a.s).slice(0, 12);
      const out = all.map((x) => { const [u, id, fb, pts] = x.m.split('|'); const c = cat.getChallenge(id); return c ? { user: u, id, title: c.title, tier: c.tier, first: fb === '1', points: +pts, at: x.s } : null; }).filter(Boolean);
      return send(res, 200, { feed: out });
    }
    if (op === 'board') {
      const top = await db.zrevrange('lb', 0, 99);
      return send(res, 200, { board: top.map((x, i) => { const p = pointsOfScore(x.s); return { pos: i + 1, user: x.m, points: p, rank: rankOf(p).name }; }) });
    }
    if (op === 'user') {
      const name = String(q.u || '').toLowerCase();
      const h = await db.hgetall('u:' + name);
      if (!h.hash) return send(res, 404, { error: 'No such player' });
      const [solvedIds, recent] = await Promise.all([db.smembers('s:' + name), db.zrevrange('st:' + name, 0, 29)]);
      const pts = parseInt(h.points || '0', 10), pos = await db.zrevrank('lb', name);
      const byTrack = {}; solvedIds.forEach((id) => { const t = trackOf(id); byTrack[t] = (byTrack[t] || 0) + 1; });
      const tracks = cat.listTracks().map((t) => ({ id: t.id, title: t.title, levels: t.levels, done: byTrack[t.id] || 0 })).filter((t) => t.done);
      const rec = recent.map((x) => { const c = cat.getChallenge(x.m); return c ? { id: c.id, title: c.title, tier: c.tier, points: c.points, at: x.s } : null; }).filter(Boolean);
      return send(res, 200, { user: name, points: pts, rank: rankOf(pts).name, pos: pos == null ? null : pos + 1, joined: parseInt(h.created || '0', 10), count: solvedIds.length, tracks, recent: rec, streak: liveStreak(h), best: parseInt(h.best || '0', 10), badges: badgesOf({ fb: +(h.fb || 0), best: +(h.best || 0), daily: +(h.daily || 0), count: solvedIds.length, legend: +(h.legend || 0), finished: tracks.filter((t) => t.done >= t.levels).length }) });
    }
    if (op === 'me') {
      if (!user) return send(res, 401, { error: 'Not signed in' });
      const h = await db.hgetall('u:' + user); const pts = parseInt(h.points || '0', 10), pos = await db.zrevrank('lb', user);
      return send(res, 200, { user, points: pts, rank: rankOf(pts).name, pos: pos == null ? null : pos + 1, streak: liveStreak(h) });
    }

    /* ---------- accounts ---------- */
    if (op === 'signup' || op === 'login') {
      if (!(await rate('auth:' + clientIp(req), 12, 60))) return send(res, 429, { error: 'Too many attempts, wait a minute' });
      const name = String(body.user || '').toLowerCase(), pw = String(body.pass || '');
      if (!/^[a-z0-9_]{3,20}$/.test(name)) return send(res, 400, { error: 'Username must be 3 to 20 characters: letters, numbers, underscore' });
      if (pw.length < 8 || pw.length > 100) return send(res, 400, { error: 'Password must be 8 to 100 characters' });
      const h = await db.hgetall('u:' + name);
      if (op === 'signup') {
        if (h.hash) return send(res, 409, { error: 'That username is taken' });
        const salt = crypto.randomBytes(16).toString('hex');
        await db.hset('u:' + name, { salt, hash: pwHash(pw, salt), created: Date.now(), points: 0 });
      } else {
        const ok = h.hash && crypto.timingSafeEqual(Buffer.from(pwHash(pw, h.salt)), Buffer.from(h.hash));
        if (!ok) return send(res, 401, { error: 'Wrong username or password' });
      }
      return send(res, 200, { token: sign({ u: name, e: Date.now() + TOKEN_DAYS * 864e5 }), user: name });
    }

    if (op === 'google') {
      if (!GOOGLE_ID) return send(res, 400, { error: 'Google sign-in is not configured' });
      if (!(await rate('auth:' + clientIp(req), 12, 60))) return send(res, 429, { error: 'Too many attempts, wait a minute' });
      const cred = String(body.credential || ''); if (cred.length < 20 || cred.length > 4000) return send(res, 400, { error: 'Bad credential' });
      let info; try { const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred)); info = await r.json(); if (!r.ok) info = null; } catch (e) { info = null; }
      if (!info || info.aud !== GOOGLE_ID || String(info.email_verified) !== 'true' || !info.sub || !/^(accounts\.google\.com|https:\/\/accounts\.google\.com)$/.test(info.iss || '')) return send(res, 401, { error: 'Google sign-in failed' });
      let name = (await db.hgetall('g:' + info.sub)).u;
      if (!name) {
        let base = String(info.email || 'player').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'player'; if (base.length < 3) base += 'user';
        name = base; for (let i = 0; i < 20; i++) { const h = await db.hgetall('u:' + name); if (!h.hash) break; name = base + crypto.randomInt(100, 9999); }
        const salt = crypto.randomBytes(16).toString('hex');
        await db.hset('u:' + name, { salt, hash: pwHash(crypto.randomBytes(24).toString('hex'), salt), created: Date.now(), points: 0, google: info.sub });
        await db.hset('g:' + info.sub, { u: name });
      }
      return send(res, 200, { token: sign({ u: name, e: Date.now() + TOKEN_DAYS * 864e5 }), user: name });
    }

    if (op === 'github') {
      if (!GH_ID || !GH_SECRET) return send(res, 400, { error: 'GitHub sign-in is not configured' });
      if (!(await rate('auth:' + clientIp(req), 12, 60))) return send(res, 429, { error: 'Too many attempts, wait a minute' });
      const code = String(body.code || ''); if (!/^[A-Za-z0-9_-]{6,80}$/.test(code)) return send(res, 400, { error: 'Bad code' });
      let gh = null;
      try {
        const tr = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ client_id: GH_ID, client_secret: GH_SECRET, code }) });
        const tj = await tr.json();
        if (tj && tj.access_token) { const ur = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + tj.access_token, 'User-Agent': 'rootrank', Accept: 'application/vnd.github+json' } }); if (ur.ok) gh = await ur.json(); }
      } catch (e) { gh = null; }
      if (!gh || !gh.id || !gh.login) return send(res, 401, { error: 'GitHub sign-in failed' });
      let name = (await db.hgetall('gh:' + gh.id)).u;
      if (!name) {
        let base = String(gh.login).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'player'; if (base.length < 3) base += 'user';
        name = base; for (let i = 0; i < 20; i++) { const h = await db.hgetall('u:' + name); if (!h.hash) break; name = base + crypto.randomInt(100, 9999); }
        const salt = crypto.randomBytes(16).toString('hex');
        await db.hset('u:' + name, { salt, hash: pwHash(crypto.randomBytes(24).toString('hex'), salt), created: Date.now(), points: 0, github: String(gh.id) });
        await db.hset('gh:' + gh.id, { u: name });
      }
      return send(res, 200, { token: sign({ u: name, e: Date.now() + TOKEN_DAYS * 864e5 }), user: name });
    }

    /* ---------- authenticated actions ---------- */
    if (!user) return send(res, 401, { error: 'Sign in first' });
    const c = cat.getChallenge(body.id); if (!c) return send(res, 404, { error: 'Unknown challenge' });
    if (await legendLocked(c, user)) return send(res, 403, { error: 'Legends unlock at Admin rank (' + LEGENDS_MIN + ' points).' });

    if (op === 'exec') {
      if (!(await rate('exec:' + user, 150, 60))) return send(res, 429, { error: 'Slow down a little' });
      const history = Array.isArray(body.history) ? body.history.map(String) : [];
      if (history.length > 60) return send(res, 400, { error: 'Session too long. Reset the terminal.' });
      const r = simulate(c, makeCtx(SECRET, c.id, user), history);
      return send(res, 200, { out: r.out, clear: r.clear, prompt: r.prompt, motd: history.length ? '' : r.motd });
    }

    if (op === 'hint') {
      const n = parseInt(body.n, 10); if (!(n >= 0 && n < c.hints.length)) return send(res, 400, { error: 'No such hint' });
      const solved = await db.sismember('s:' + user, c.id);
      if (!solved) await db.sadd('h:' + user + ':' + c.id, String(n));
      const used = await db.smembers('h:' + user + ':' + c.id);
      return send(res, 200, { text: c.hints[n], reward: award(c.points, solved ? 0 : used.length) });
    }

    if (op === 'submit') {
      if (!(await rate('sub:' + user, 30, 60))) return send(res, 429, { error: 'Too many guesses, wait a minute' });
      if (await db.sismember('s:' + user, c.id)) return send(res, 200, { ok: true, already: true });
      const ctx = makeCtx(SECRET, c.id, user);
      const expected = c.type === 'flag' ? ctx.flag : c.type === 'site' ? siteFlag(SECRET, c.level) : String(c.build(ctx).answer);
      const given = String(body.answer || '').trim();
      const ok = c.type === 'flag' || c.type === 'site' ? given === expected : given.toLowerCase() === expected.toLowerCase();
      if (!ok) {
        const wk = 'wg:' + user + ':' + c.id, w = await db.incr('rl:' + wk); if (w === 1) await db.expire('rl:' + wk, 900);
        if (w > (DEV ? 500 : 6)) return send(res, 429, { error: 'Too many wrong answers on this level. Wait 15 minutes and think it through.' });
        return send(res, 200, { ok: false });
      }
      const now = Date.now();
      const added = await db.zadd('solves:' + c.id, now, user, true);
      if (!added) return send(res, 200, { ok: true, already: true });
      await db.sadd('s:' + user, c.id);
      await Promise.all([db.hincrby('tc', c.track, 1), db.hincrby('lc:' + c.track, String(c.level), 1), db.zadd('st:' + user, now, c.id)]);
      const used = (await db.smembers('h:' + user + ':' + c.id)).length;
      const solvers = await db.zcard('solves:' + c.id);
      const first = solvers === 1;
      const pts = award(c.points, used) + (first ? Math.round(c.points * 0.1) : 0);
      const day = dayOf(now), isDaily = c.id === dailyId(day);
      const bonus = isDaily ? Math.round(c.points * DAILY_BONUS) : 0;
      const total = await db.hincrby('u:' + user, 'points', pts + bonus);
      const uh = await db.hgetall('u:' + user);
      const streak = uh.last === day ? parseInt(uh.streak || '1', 10) : uh.last === dayOf(now - 86400000) ? parseInt(uh.streak || '0', 10) + 1 : 1;
      const upd = { last: day, streak, best: Math.max(streak, parseInt(uh.best || '0', 10)) };
      if (first) await db.hincrby('u:' + user, 'fb', 1);
      if (isDaily) { await db.hincrby('u:' + user, 'daily', 1); await db.zadd('dsolve:' + day, now, user, true); await db.expire('dsolve:' + day, 259200); }
      if (c.cat === 'Legends') await db.hincrby('u:' + user, 'legend', 1);
      await db.hset('u:' + user, upd);
      const fk = 'feed:' + day; await db.zadd(fk, now, user + '|' + c.id + '|' + (first ? 1 : 0) + '|' + (pts + bonus)); await db.expire(fk, 259200);
      await db.zadd('lb', scoreOf(total, now), user);
      const pos = await db.zrevrank('lb', user);
      return send(res, 200, { ok: true, points: pts + bonus, daily: isDaily, streak, firstBlood: first, total, rank: rankOf(total).name, pos: pos == null ? null : pos + 1 });
    }

    return send(res, 400, { error: 'Unknown operation' });
  } catch (e) {
    return send(res, 500, { error: 'Server error' });
  }
};
