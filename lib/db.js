'use strict';
/*
 * Tiny data layer. Uses Upstash Redis over REST when its env vars are set (works on Vercel),
 * otherwise an in-memory store so you can run everything locally with no setup.
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL;
const restOk = !!(URL_ && TOKEN);
const remote = restOk || !!REDIS_URL;
let client = null, connecting = null;
async function tcp() {
  if (client && client.isOpen) return client;
  if (!connecting) {
    const { createClient } = require('redis');
    client = createClient({ url: REDIS_URL, socket: { connectTimeout: 5000, reconnectStrategy: (n) => (n > 3 ? new Error('redis unreachable') : 200 * n) } });
    client.on('error', () => {});
    connecting = client.connect().then(() => client).catch((e) => { connecting = null; client = null; throw e; });
  }
  return connecting;
}

async function rcmd(args) {
  if (!restOk) { const c = await tcp(); return c.sendCommand(args.map(String)); }
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(args.map(String)) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function memory() {
  const kv = new Map();
  const get = (k, make) => { if (!kv.has(k)) kv.set(k, make()); return kv.get(k); };
  const sorted = (z) => [...z.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
  return {
    async hgetall(k) { const h = kv.get(k); return h ? Object.fromEntries(h) : {}; },
    async hset(k, o) { const h = get(k, () => new Map()); Object.keys(o).forEach((f) => h.set(f, String(o[f]))); },
    async hincrby(k, f, n) { const h = get(k, () => new Map()); const v = (parseInt(h.get(f) || '0', 10) || 0) + n; h.set(f, String(v)); return v; },
    async zadd(k, score, m, nx) { const z = get(k, () => new Map()); if (nx && z.has(m)) return 0; const had = z.has(m); z.set(m, Number(score)); return had ? 0 : 1; },
    async zrevrange(k, a, b) { return sorted(get(k, () => new Map())).slice(a, b < 0 ? undefined : b + 1).map((x) => ({ m: x[0], s: x[1] })); },
    async zrange(k, a, b) { return [...get(k, () => new Map()).entries()].sort((x, y) => x[1] - y[1]).slice(a, b + 1).map((x) => ({ m: x[0], s: x[1] })); },
    async zcard(k) { return get(k, () => new Map()).size; },
    async zscore(k, m) { const z = get(k, () => new Map()); return z.has(m) ? z.get(m) : null; },
    async zrevrank(k, m) { const i = sorted(get(k, () => new Map())).findIndex((x) => x[0] === m); return i < 0 ? null : i; },
    async sadd(k, m) { const s = get(k, () => new Set()); if (s.has(m)) return 0; s.add(m); return 1; },
    async smembers(k) { return [...get(k, () => new Set())]; },
    async sismember(k, m) { return get(k, () => new Set()).has(m); },
    async incr(k) { const v = (parseInt(kv.get(k) || '0', 10) || 0) + 1; kv.set(k, String(v)); return v; },
    async expire(k, sec) { setTimeout(() => kv.delete(k), sec * 1000).unref(); }
  };
}

function upstash() {
  const pairs = (flat) => { const o = {}; for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1]; return o; };
  const withScores = (flat) => { const o = []; for (let i = 0; i < (flat || []).length; i += 2) o.push({ m: flat[i], s: parseFloat(flat[i + 1]) }); return o; };
  return {
    async hgetall(k) { return pairs(await rcmd(['HGETALL', k])); },
    async hset(k, o) { const a = ['HSET', k]; Object.keys(o).forEach((f) => { a.push(f, o[f]); }); await rcmd(a); },
    async hincrby(k, f, n) { return rcmd(['HINCRBY', k, f, n]); },
    async zadd(k, score, m, nx) { return rcmd(nx ? ['ZADD', k, 'NX', score, m] : ['ZADD', k, score, m]); },
    async zrevrange(k, a, b) { return withScores(await rcmd(['ZREVRANGE', k, a, b, 'WITHSCORES'])); },
    async zrange(k, a, b) { return withScores(await rcmd(['ZRANGE', k, a, b, 'WITHSCORES'])); },
    async zcard(k) { return rcmd(['ZCARD', k]); },
    async zscore(k, m) { const v = await rcmd(['ZSCORE', k, m]); return v == null ? null : parseFloat(v); },
    async zrevrank(k, m) { return rcmd(['ZREVRANK', k, m]); },
    async sadd(k, m) { return rcmd(['SADD', k, m]); },
    async smembers(k) { return rcmd(['SMEMBERS', k]); },
    async sismember(k, m) { return (await rcmd(['SISMEMBER', k, m])) === 1; },
    async incr(k) { return rcmd(['INCR', k]); },
    async expire(k, sec) { return rcmd(['EXPIRE', k, sec]); }
  };
}

const db = remote ? upstash() : memory();
db.remote = remote;
module.exports = db;
