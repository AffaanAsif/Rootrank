'use strict';
/*
 * Rootrank catalog. Tracks (families) generate many levels each. Every level builds a fresh,
 * per-player instance from ctx = { flag, rnd, site }, so flags and answers differ for each
 * player and cannot be shared.
 */
const GROUPS = ['apex','legends','linux', 'crypto', 'logs', 'recon', 'privesc', 'pivot', 'meta'];
const NOTES = require('./gen/notes');

const TIERS = [null, { n: 1, name: 'Guest', pts: 10 }, { n: 2, name: 'User', pts: 20 }, { n: 3, name: 'Operator', pts: 40 },
  { n: 4, name: 'Sudoer', pts: 80 }, { n: 5, name: 'Admin', pts: 150 }, { n: 6, name: 'Root', pts: 300 }];
const RANKS = [
  { min: 0, name: 'Guest' }, { min: 150, name: 'User' }, { min: 800, name: 'Operator' }, { min: 3000, name: 'Sudoer' },
  { min: 9000, name: 'Admin' }, { min: 20000, name: 'Root' }, { min: 40000, name: 'Ghost' }
];
function rankOf(points) { let r = RANKS[0]; RANKS.forEach((x) => { if (points >= x.min) r = x; }); return r; }

const FAMS = [];
GROUPS.forEach((g) => { try { require('./gen/' + g).forEach((f) => FAMS.push(f)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !/gen\//.test(e.message)) throw e; } });
const FAM_BY_ID = {}; FAMS.forEach((f) => { FAM_BY_ID[f.id] = f; });

function tierOf(f, lv) { return typeof f.tier === 'function' ? f.tier(lv) : f.tier; }
function typeOf(f, lv) { return typeof f.type === 'function' ? f.type(lv) : f.type; }
function pointsOf(f, lv) { return TIERS[tierOf(f, lv)].pts; }

function parseId(id) {
  const m = /^([a-z0-9]+)-(\d{1,3})$/.exec(String(id || ''));
  if (!m) return null;
  const f = FAM_BY_ID[m[1]], lv = parseInt(m[2], 10);
  if (!f || lv < 1 || lv > f.levels) return null;
  return { f, lv };
}

const HELPER_HINT = 'Stuck on a command? Type man followed by its name, for example man grep.';

function getChallenge(id) {
  const p = parseId(id); if (!p) return null;
  const { f, lv } = p, n = NOTES[f.id] || { notes: '', hints: [] };
  const base = f.id === 'meta' ? 0 : 0;
  const hints = (n.hints || []).slice(0, 3);
  if (lv <= 2) hints.unshift(HELPER_HINT);
  return {
    id, track: f.id, level: lv, levels: f.levels, title: f.cat === 'Legends' ? f.title + ' / Stage ' + lv : f.title + ' ' + lv, cat: f.cat, tier: tierOf(f, lv),
    points: pointsOf(f, lv), type: typeOf(f, lv), brief: f.brief(lv), notes: n.notes || '', hints: hints.slice(0, 4),
    build: (ctx) => f.build(ctx, lv),
    solve: (built, ctx) => f.solve(built, lv, ctx),
    prev: lv > 1 ? f.id + '-' + (lv - 1) : null, next: lv < f.levels ? f.id + '-' + (lv + 1) : null
  };
}

function listTracks() {
  return FAMS.map((f) => {
    const tiers = []; for (let i = 1; i <= f.levels; i++) tiers.push(tierOf(f, i));
    return { id: f.id, title: f.title, cat: f.cat, blurb: f.blurb, levels: f.levels, minTier: Math.min.apply(null, tiers), maxTier: Math.max.apply(null, tiers), points: tiers.reduce((s, t) => s + TIERS[t].pts, 0), signal: !!f.signal };
  });
}
function levelsOf(trackId) {
  const f = FAM_BY_ID[trackId]; if (!f) return null;
  const out = []; for (let i = 1; i <= f.levels; i++) out.push({ id: f.id + '-' + i, level: i, tier: tierOf(f, i), points: pointsOf(f, i), type: typeOf(f, i) });
  return out;
}
const TOTAL = FAMS.reduce((s, f) => s + f.levels, 0);

module.exports = { FAMS, FAM_BY_ID, TIERS, RANKS, rankOf, getChallenge, listTracks, levelsOf, parseId, TOTAL };
