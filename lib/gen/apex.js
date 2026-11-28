'use strict';
/*
 * Apex: the hardest tracks on Rootrank. Every level is Root tier and chains several skills at once:
 * decoding, log forensics, hash hunting, permissions, pivoting and privilege escalation.
 * Decoys are everywhere and wrong answers are plausible. Nothing here is a single trick.
 */
const U = require('./util');
const { GH, NAMES, word, uniqWords, text, readme, noiseLine, iso, pubip, ip, md5, privkey, LAYERS } = U;

const fam = [];
const KINDS = Object.keys(LAYERS);
const kinds = (r, n) => { const out = []; for (let i = 0; i < n; i++) { let k; do k = r.pick(KINDS); while ((out.length && out[out.length - 1] === k && n > 1) || (k === 'hex' && out.filter((x) => x === 'hex').length >= 2)); out.push(k); } return out; };
const enc = (s, ks) => ks.reduce((t, k) => LAYERS[k].enc(t), s);
const fit = (r, n, str, max) => { let ks; for (let t = 0; t < 40; t++) { ks = kinds(r, n); if (enc(str, ks).length <= (max || 2500)) return ks; } return ks; };
const dec = (ks) => ks.slice().reverse().map((k) => LAYERS[k].cmd).join(' | ');
const takeName = (r, used, pool) => { let n; do n = r.pick(pool); while (used.has(n)); used.add(n); return n; };
const hostId = (r, used) => { let n; do n = word(r) + r.int(1, 99); while (used.has(n)); used.add(n); return n; };
const P = 20;

/* ---------------- regicide: the full kill chain ---------------- */
fam.push({
  id: 'regicide', title: 'The Regicide Protocol', cat: 'Apex', levels: P, tier: () => 6, type: 'flag',
  blurb: 'A full kill chain. Decode, pivot through several machines, then take the crown as root.',
  brief: (lv) => 'You are guest on web01. The crown is a flag in root\'s home on the LAST machine of a chain ' + (2 + Math.floor((lv - 1) / 5)) + ' hops long. Each machine hides the way to the next behind layered encodings, locked folders or the right key. Stale credentials and decoy keys are everywhere. Trust the logs, not the filenames.',
  build: (c, lv) => {
    const r = c.rnd, H = 2 + Math.floor((lv - 1) / 5), nl = Math.min(6, 2 + Math.floor((lv - 1) / 3)), used = new Set(['web01']);
    const names = ['web01'], users = ['guest'], pass = [null], keys = [null], useKey = [false];
    for (let i = 1; i <= H; i++) {
      names.push(hostId(r, used)); users.push(takeName(r, new Set(users), NAMES.filter((x) => x !== 'guest')));
      pass.push('p' + r.hex(12)); keys.push('KEY-' + r.hex(18)); useKey.push(lv >= 4 && i % 2 === 1 && i < H);
    }
    const hosts = {}, cmds = [], stale = [];
    for (let i = 0; i <= H; i++) {
      const home = i === 0 ? GH : '/home/' + users[i], files = {};
      files[home + '/README'] = i === 0 ? 'You only have guest on web01.\nThe admins were careless. Look at what they left behind, and at the logs.\n' : 'working machine ' + names[i] + '\n';
      for (let n = 0; n < 4 + Math.floor(lv / 2); n++) files[home + '/' + word(r) + r.int(1, 99) + '.txt'] = noiseLine(r) + '\n';
      hosts[names[i]] = { name: names[i], files, start: { user: users[i], cwd: home }, auth: {} };
    }
    for (let i = 1; i <= H; i++) hosts[names[i]].auth[users[i]] = useKey[i] ? { key: keys[i] } : { pass: pass[i] };
    for (let i = 0; i < H; i++) {
      const home = i === 0 ? GH : '/home/' + users[i], f = hosts[names[i]].files, nx = i + 1, nu = users[nx], nh = names[nx];
      if (useKey[nx]) {
        const good = home + '/.ssh/id_' + word(r) + r.int(1, 9);
        f[good] = { c: privkey(keys[nx]), m: 600 };
        for (let d = 0; d < 3 + Math.floor(lv / 3); d++) f[home + '/.ssh/id_' + word(r) + r.int(10, 99)] = { c: privkey('KEY-' + r.hex(18)), m: 600 };
        f[home + '/.ssh/config'] = 'Host ' + nh + '\n  HostName ' + nh + '\n  User ' + nu + '\n  IdentityFile ' + good + '\n';
        if (i === 0) f[GH + '/.bash_history'] = 'ssh -i ~/.ssh/id_old ' + nu + '@' + nh + '\nls\n';
        cmds.push('cat ' + home + '/.ssh/config', 'ssh -i ' + good + ' ' + nu + '@' + nh);
      } else if (i === 0) {
        const ks = kinds(r, nl), cur = 'creds-' + r.hex(6) + '.bak', rotated = [];
        const total = 10 + Math.floor(lv * 1.5);
        for (let d = 0; d < total; d++) {
          const nm = 'creds-' + r.hex(6) + '.bak', fake = enc(nu + ':' + 'p' + r.hex(12), kinds(r, nl));
          f['/var/backups/' + nm] = fake + '\n'; rotated.push(nm);
        }
        f['/var/backups/' + cur] = enc(nu + ':' + pass[nx], ks) + '\n';
        const lg = []; rotated.forEach((nm) => lg.push(iso(r.int(0, 86399)) + ' rotate: ' + nm + ' (retired)'));
        lg.splice(r.int(0, lg.length), 0, iso(r.int(0, 86399)) + ' rotate: ' + cur + ' (current)');
        f['/var/log/rotate.log'] = text(lg);
        f[GH + '/.bash_history'] = 'sshpass -p ' + 'p' + r.hex(12) + ' ssh ' + nu + '@' + nh + '\n';
        cmds.push('grep current /var/log/rotate.log', 'cat /var/backups/' + cur + ' | ' + dec(ks), 'sshpass -p ' + pass[nx] + ' ssh ' + nu + '@' + nh);
      } else {
        const ks = kinds(r, 2), locked = lv >= 6 && i % 2 === 0, dir = home + '/.vault', file = dir + '/next.enc';
        f[file] = { c: enc(nu + ':' + pass[nx], ks) + '\n', m: locked ? 600 : 644 };
        if (locked) f[dir + '/'] = { m: 0, o: users[i] };
        f[home + '/notes.txt'] = 'the next machine is ' + nh + '. the secret is in ~/.vault, I always lock it\n';
        if (locked) cmds.push('chmod u+rx ' + dir);
        cmds.push('cat ' + file + ' | ' + dec(ks), 'sshpass -p ' + pass[nx] + ' ssh ' + nu + '@' + nh);
      }
    }
    const last = hosts[names[H]], viaFind = r.int(0, 1) === 0;
    last.files['/root/flag.txt'] = { c: c.flag + '\n', m: 600, o: 'root' };
    last.sudo = { list: ['User ' + users[H] + ' may run the following commands on ' + names[H] + ':', '    (root) NOPASSWD: /usr/bin/' + (viaFind ? 'find' : 'sed')], allow: [viaFind ? 'find' : 'sed'] };
    cmds.push('sudo -l', viaFind ? 'sudo find /home/' + users[H] + '/README -exec cat /root/flag.txt \\;' : 'sudo sed -n 1p /root/flag.txt');
    return { motd: 'A long way to the crown.', hosts, meta: { cmds } };
  },
  solve: (b) => b.meta.cmds
});

/* ---------------- oubliette: ledger, hash hunt, layered cell ---------------- */
fam.push({
  id: 'oubliette', title: 'The Deep Oubliette', cat: 'Apex', levels: P, tier: () => 6, type: 'flag',
  blurb: 'A royal warrant names a prisoner. Find the right cell among dozens by its seal, then unwrap the layers.',
  brief: (lv) => 'The Royal Warrant in your home names a prisoner. The ledger gives the seal (an md5 hash) of that prisoner\'s cell file. Dozens of cells share the dungeon and every one looks the same. Find the cell whose hash matches, then peel back ' + Math.min(7, 3 + Math.floor((lv - 1) / 3)) + ' layers of encoding to reach the flag.',
  build: (c, lv) => {
    const r = c.rnd, nl = Math.min(7, 3 + Math.floor((lv - 1) / 3)), nCells = 30 + lv * 4, files = {}, cells = [], names = new Set();
    const target = r.int(0, nCells - 1), ks = fit(r, nl, c.flag), ledger = ['prisoner,seal,status'];
    let tName = '', tPath = '';
    for (let i = 0; i < nCells; i++) {
      const who = r.pick(['rupert', 'osric', 'edmund', 'godwin', 'aldric', 'cedric', 'leofric', 'wulfric', 'eadric', 'hereward', 'ranulf', 'baldwin', 'tancred', 'roland', 'gisla', 'matilda', 'adela', 'isolde', 'maude', 'agnes', 'beatrix', 'cecily']) + '-' + r.hex(3); if (names.has(who)) { i--; continue; } names.add(who);
      const cellPath = '/srv/oubliette/' + (i % 5 === 0 ? 'tower/' : i % 5 === 1 ? 'keep/' : i % 5 === 2 ? 'cellar/' : i % 5 === 3 ? 'gate/' : '') + 'cell-' + r.hex(5) + '.dat';
      const body = i === target ? enc(c.flag, ks) + '\n' : enc('flag{' + r.hex(20) + '}', fit(r, nl, 'flag{' + r.hex(20) + '}')) + '\n';
      files[cellPath] = body; const seal = md5(body);
      ledger.push(who + ',' + seal + ',' + (i === target ? 'held' : r.pick(['held', 'held', 'released', 'transferred'])));
      if (i === target) { tName = who; tPath = cellPath; }
    }
    // decoy ledger lines with a near-identical name for the wrong cells (name + suffix)
    for (let d = 0; d < 3 + Math.floor(lv / 3); d++) ledger.push(tName + '-' + r.pick(['the-elder', 'junior', 'of-york', 'of-kent']) + ',' + md5('decoy' + r.hex(8)) + ',held');
    files['/etc/crown/ledger.csv'] = 'prisoner,seal,status\n' + text(r.shuffle(ledger.slice(1)));
    files[GH + '/ROYAL_WARRANT.txt'] = 'By order of the Crown:\nThe prisoner known as ' + tName + ' is to be questioned.\nTheir cell is sealed. Consult the ledger in /etc/crown. Do not confuse them with any namesake.\n';
    Object.assign(files, readme('Read ROYAL_WARRANT.txt first.\nThe cells live under /srv/oubliette. Their files look alike, so hash them: find ... -exec md5sum {} \\;'));
    const seal = md5(files[tPath]);
    return { motd: 'Stone, damp and silence.', hosts: { main: { name: 'dungeon', files } }, meta: { tName, tPath, ks, seal } };
  },
  solve: (b) => ['cat ROYAL_WARRANT.txt', 'grep ' + b.meta.tName + ', /etc/crown/ledger.csv', 'find /srv/oubliette -type f -exec md5sum {} \\; | grep ' + b.meta.seal, 'cat ' + b.meta.tPath + ' | ' + dec(b.meta.ks)]
});

/* ---------------- ravens: log forensics with compound conditions ---------------- */
fam.push({
  id: 'ravens', title: 'Parliament of Ravens', cat: 'Apex', levels: P, tier: () => 6, type: 'flag',
  blurb: 'Three logs and one traitor. Find the attacker by behaviour, then follow their drop to the loot.',
  brief: (lv) => 'An intruder broke into the realm. The attacker is the one address that failed many times and THEN got in, as shown in /var/log/auth.log. Other addresses fail often but never succeed, or succeed on the first try. The web log shows which drop file that address uploaded. The loot sits in /srv/evidence/ under a folder named for that address (dots become dashes). Decode it for the flag.',
  build: (c, lv) => {
    const r = c.rnd, files = {}, ks = kinds(r, Math.min(7, 2 + Math.floor((lv - 1) / 4))), t0 = 3600 * 2;
    const atk = pubip(r), fails = 14 + lv, brutes = [], goods = [], used = new Set([atk]);
    const uniq = () => { let a; do a = pubip(r); while (used.has(a)); used.add(a); return a; };
    for (let i = 0; i < 3 + Math.floor(lv / 3); i++) brutes.push(uniq());
    for (let i = 0; i < 4 + Math.floor(lv / 2); i++) goods.push(uniq());
    const ev = []; let ts = t0;
    const line = (t, ok, user, a) => ({ t, s: iso(t).replace('2026-11-26T', '2026-11-26 ') + ' sshd[' + r.int(200, 9999) + ']: ' + (ok ? 'Accepted password' : 'Failed password') + ' for ' + user + ' from ' + a + ' port ' + r.int(1024, 65000) });
    for (let i = 0; i < fails; i++) { ts += r.int(3, 90); ev.push(line(ts, false, r.pick(['admin', 'root', 'deploy', 'ops']), atk)); }
    ts += r.int(30, 400); ev.push(line(ts, true, 'deploy', atk));
    brutes.forEach((b) => { const n = fails + r.int(0, 8); for (let i = 0; i < n; i++) ev.push(line(r.int(t0, t0 + 20000), false, r.pick(['admin', 'root']), b)); });
    goods.forEach((g) => { ev.push(line(r.int(t0, t0 + 20000), true, r.pick(NAMES), g)); if (r.int(0, 1)) ev.push(line(r.int(t0, t0 + 20000), false, r.pick(NAMES), g)); });
    for (let i = 0; i < 60 + lv * 6; i++) { const t = r.int(t0, t0 + 20000); ev.push({ t, s: iso(t).replace('2026-11-26T', '2026-11-26 ') + ' sshd[' + r.int(200, 9999) + ']: Connection closed by ' + uniq() + ' port ' + r.int(1024, 65000) }); }
    ev.sort((a, b) => a.t - b.t);
    files['/var/log/auth.log'] = text(ev.map((e) => e.s));
    const drop = r.hex(10) + '.bin', web = [];
    const hit = (a, path, m) => web.push(a + ' - - [26/Nov/2026:' + U.hmsOf(r.int(0, 86399)) + '] "' + (m || 'GET') + ' ' + path + ' HTTP/1.1" ' + r.pick([200, 200, 404, 302]) + ' ' + r.int(100, 9999));
    hit(atk, '/drop/' + drop, 'POST');
    brutes.concat(goods).forEach((a) => { for (let i = 0; i < 3; i++) hit(a, r.pick(U.PATHS)); hit(a, '/drop/' + r.hex(10) + '.bin', 'POST'); });
    for (let i = 0; i < 80 + lv * 5; i++) hit(uniq(), r.pick(U.PATHS));
    files['/var/log/web.log'] = text(r.shuffle(web));
    const dir = '/srv/evidence/' + atk.replace(/\./g, '-') + '/';
    files[dir + drop] = enc(c.flag, ks) + '\n';
    [atk].concat(brutes, goods).forEach((a) => { const d = '/srv/evidence/' + a.replace(/\./g, '-') + '/'; if (d !== dir) files[d + r.hex(10) + '.bin'] = enc('flag{' + r.hex(20) + '}', kinds(r, 2)) + '\n'; else files[d + r.hex(10) + '.bin'] = enc('flag{' + r.hex(20) + '}', kinds(r, 2)) + '\n'; });
    Object.assign(files, readme('Logs are in /var/log. Evidence folders are in /srv/evidence.\nThe attacker FAILED a lot and then SUCCEEDED. Others only failed, or only succeeded.'));
    return { motd: 'Black feathers on the windowsill.', hosts: { main: { name: 'rookery', files } }, meta: { atk, drop, dir, ks } };
  },
  solve: (b) => ['grep Failed /var/log/auth.log | awk \'{print $9}\' | sort | uniq -c | sort -n -r', 'grep Accepted /var/log/auth.log | awk \'{print $9}\' | sort | uniq', 'grep ' + b.meta.atk + ' /var/log/web.log | grep POST', 'cat ' + b.meta.dir + b.meta.drop + ' | ' + dec(b.meta.ks)]
});

/* ---------------- labyrinth: permissions maze, setuid traversal ---------------- */
fam.push({
  id: 'labyrinth', title: 'Labyrinth of Seals', cat: 'Apex', levels: P, tier: () => 6, type: 'flag',
  blurb: 'Locked chambers, a forged seal and one setuid helper that trusts paths too much.',
  brief: (lv) => 'The throne room is a root-only file whose name is written in a decree deep inside a maze of locked chambers (' + (3 + Math.floor(lv / 3)) + ' deep). Open them in order, read the decree, then find the one setuid helper that can be talked into leaving its allowed folder. Many setuid files exist. Only one runs.',
  build: (c, lv) => {
    const r = c.rnd, depth = 3 + Math.floor(lv / 3), files = {}, bins = {}, chain = [], cmds = [];
    let cur = GH + '/chambers';
    for (let i = 0; i < depth; i++) {
      cur += '/' + word(r) + '-' + i; chain.push(cur);
      files[cur + '/'] = { m: i === 0 ? 755 : 0, o: 'guest' };
      for (let d = 0; d < 2 + Math.floor(lv / 5); d++) files[cur + '/' + word(r) + '-' + r.hex(3) + '.txt'] = 'an empty vault\n';
    }
    chain.forEach((p) => { /* dirs after the first stay locked until chmod */ });
    const throne = '/root/' + word(r) + '-' + r.hex(6) + '.flag', decree = cur + '/DECREE.txt';
    files[decree] = { c: 'The Sovereign\'s true flag lies at ' + throne + '\nOnly the Seal-Wright may carry it out.\n', m: 600, o: 'guest' };
    files[throne] = { c: c.flag + '\n', m: 600, o: 'root' };
    const nm = 'sealwright' + r.int(1, 99), path = '/usr/local/bin/' + nm;
    files[path] = { c: 'ELF', m: 4755 };
    const names = new Set(['passwd', 'su', 'mount', 'umount', 'chsh', 'newgrp', nm]);
    for (let d = 0; d < 6 + Math.floor(lv / 2); d++) { const n2 = word(r) + r.int(1, 99); if (names.has(n2)) continue; names.add(n2); files['/usr/bin/' + n2] = { c: 'ELF', m: r.pick([4755, 4755, 2755, 755]) }; bins['/usr/bin/' + n2] = () => ({ e: 'segmentation fault (core dumped)' }); }
    ['passwd', 'su', 'mount', 'umount', 'chsh', 'newgrp'].forEach((n) => { files['/usr/bin/' + n] = { c: 'ELF', m: 4755 }; bins['/usr/bin/' + n] = () => ({ o: n + ': pretend system' }); });
    files['/var/seals/ledger.txt'] = 'seal log\n';
    bins[path] = (a, s, st, io) => {
      if (!a[0]) return { e: 'usage: ' + nm + ' FILE (the /var/seals folder only)' };
      if (a[0].indexOf('/var/seals/') !== 0) return { e: nm + ': access denied' };
      const n = io.fs[io.resolve(a[0])]; return n && n.t === 'f' ? { o: n.c.replace(/\n$/, '') } : { e: nm + ': no such file' };
    };
    files[GH + '/README'] = 'The way in is locked at every door of the maze.\nchmod opens what is yours. The decree names a file you cannot read as guest.\n';
    chain.forEach((p, i) => { if (i > 0) cmds.push('chmod u+rx ' + p); });
    cmds.push('cat ' + decree, 'find / -perm -4000 2>/dev/null', path + ' /var/seals/../../' + throne.slice(1));
    return { motd: 'Doors inside doors.', hosts: { main: { name: 'citadel', files, bins } }, meta: { cmds, decree } };
  },
  solve: (b) => b.meta.cmds
});

/* ---------------- ouroboros: a pointer chain with traps ---------------- */
fam.push({
  id: 'ouroboros', title: 'Crown of Ouroboros', cat: 'Apex', levels: P, tier: () => 6, type: 'flag',
  blurb: 'Each file tells you where the next one is, but only after you decode it. The serpent eats its tail.',
  brief: (lv) => 'Start at /srv/crown/start.txt. Every file names the next one, behind encodings. The chain is ' + (8 + lv * 2) + ' links long and heavily decoyed: false trails look identical. Follow only the trail whose first line says TRUE LINK.',
  build: (c, lv) => {
    const r = c.rnd, N = 8 + lv * 2, files = {}, steps = [], paths = [];
    for (let i = 0; i <= N; i++) paths.push('/srv/crown/' + word(r) + '/' + r.hex(6) + '.txt');
    paths[0] = '/srv/crown/start.txt';
    const ksAll = [];
    for (let i = 0; i < N; i++) {
      const ks = kinds(r, 1 + (lv >= 8 ? 1 : 0)); ksAll.push(ks);
      files[paths[i]] = 'TRUE LINK\n' + enc(paths[i + 1], ks) + '\n';
      for (let d = 0; d < 1 + Math.floor(lv / 4); d++) files[paths[i].replace(/[^/]*$/, '') + r.hex(6) + '.txt'] = 'FALSE LINK\n' + enc('/srv/crown/' + word(r) + '/' + r.hex(6) + '.txt', kinds(r, 1)) + '\n';
      steps.push('cat ' + paths[i] + ' | tail -n 1 | ' + dec(ks));
    }
    files[paths[N]] = 'TRUE LINK\n' + c.flag + '\n';
    steps.push('cat ' + paths[N] + ' | tail -n 1');
    Object.assign(files, readme('Begin at /srv/crown/start.txt.\nOnly TRUE LINK files lead onward. The second line is the pointer. tail -n 1 reads it.'));
    return { motd: 'The serpent has no end.', hosts: { main: { name: 'crown', files } }, meta: { steps } };
  },
  solve: (b) => b.meta.steps
});

module.exports = fam;
