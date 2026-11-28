'use strict';
// Solve every level for several fake players straight through the shell simulator.
const crypto = require('crypto');
const { makeCtx, simulate } = require('../lib/shell');
const cat = require('../lib/catalog');
const only = process.argv[2];
const players = ['alice', 'bob'];
let bad = 0, n = 0; const secret = 'test-secret';
cat.FAMS.forEach((f) => {
  if (only && f.id !== only) return;
  for (let lv = 1; lv <= f.levels; lv++) {
    const id = f.id + '-' + lv, ch = cat.getChallenge(id);
    players.forEach((u) => {
      n++;
      try {
        const ctx = makeCtx(secret, id, u), built = ch.build(ctx), cmds = ch.solve(built, ctx);
        const r = simulate(ch, makeCtx(secret, id, u), cmds), want = ch.type === 'flag' ? ctx.flag : (ch.type === 'site' ? null : built.answer);
        if (want && r.out.toLowerCase().indexOf(String(want).toLowerCase()) < 0) { bad++; if (bad < 25) console.log('FAIL', id, u, JSON.stringify(cmds).slice(0, 200), '\n   out:', r.out.slice(0, 160).replace(/\n/g, '|'), '\n   want:', want); }
      } catch (e) { bad++; if (bad < 25) console.log('ERR', id, u, e.message); }
    });
  }
});
console.log(n + ' runs, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
