'use strict';
const U = require('./util');
const { GH, pubip, NAMES, word, uniqWords, text, readme, noiseLine, b64, hexs, revs, privkey } = U;

const fam = [];
const hostName = (r, used) => { let n; do n = word(r) + r.int(1, 99); while (used.has(n)); used.add(n); return n; };

/* ---------------- hops ---------------- */
fam.push({
  id: 'hops', title: "Regent's Procession", cat: 'Pivoting', levels: 35, tier: (lv) => (lv <= 9 ? 4 : lv <= 18 ? 5 : 6), type: 'flag',
  blurb: 'Jump from machine to machine. Every box leaves the key to the next one.',
  brief: (lv) => 'The flag is on the LAST machine of a chain. Each machine leaves the way to the next one lying around: an ssh key or a stored password. Chain ' + (lv <= 9 ? '2' : lv <= 18 ? '3' : lv <= 27 ? '4' : '5') + ' machines deep. Beware of decoy keys.',
  build: (c, lv) => {
    const r = c.rnd, h = 1 + Math.ceil(lv / 9), used = new Set(), names = [], users = [];
    for (let i = 0; i <= h; i++) { names.push(i === 0 ? 'web' + r.int(1, 9) + '1' : hostName(r, used)); users.push(i === 0 ? 'guest' : r.pick(NAMES.filter((x) => users.indexOf(x) < 0 && x !== 'guest'))); }
    const hosts = {}, steps = [];
    for (let i = 0; i <= h; i++) {
      const home = i === 0 ? GH : '/home/' + users[i], files = {};
      files[home + '/notes.txt'] = 'nothing here\n';
      hosts[names[i]] = { name: names[i], files, start: { user: users[i], cwd: home }, auth: {} };
    }
    for (let i = 0; i < h; i++) {
      const home = i === 0 ? GH : '/home/' + users[i], useKey = (i + lv) % 2 === 0, f = hosts[names[i]].files, u = users[i + 1];
      f[home + '/todo.txt'] = 'migrate the job to ' + u + '@' + names[i + 1] + ' (credentials are on this box)\n';
      if (useKey) {
        const marker = 'KEY-' + r.hex(16), kn = home + '/.ssh/id_' + word(r);
        f[kn] = { c: privkey(marker), m: 600 }; f[home + '/.ssh/id_old'] = { c: privkey('KEY-' + r.hex(16)), m: 600 };
        hosts[names[i + 1]].auth[u] = { key: marker }; steps.push({ k: 'key', file: kn.replace(home, '~'), u, h: names[i + 1] });
      } else {
        const pass = 'p' + r.hex(10), cn = home + '/.cache/creds.b64';
        f[cn] = b64(u + ':' + pass) + '\n'; hosts[names[i + 1]].auth[u] = { pass }; steps.push({ k: 'pass', file: cn.replace(home, '~'), u, h: names[i + 1], pass });
      }
      if (lv > 9) { const dn = hostName(r, used); hosts[dn] = { name: dn, files: { '/home/x/e': '' }, start: { user: 'x', cwd: '/home/x' }, auth: { x: { key: 'KEY-never' } } }; f['/var/log/deploy.log'] = '2026-11-20 pushed release to x@' + dn + ' using the old key\n2026-11-20 ' + dn + ' refused the key, skipping\n'; }
    }
    hosts[names[h]].files['/home/' + users[h] + '/flag.txt'] = c.flag + '\n';
    hosts[names[0]].files[GH + '/README.txt'] = 'You landed on ' + names[0] + '. The flag is on the last machine of a chain.\nRead todo.txt on each box to learn the next hop. Credentials lie around on the same box.\n';
    return { motd: 'You are on ' + names[0] + '. The real prize is further in.', hosts, meta: { steps } };
  },
  solve: (b) => {
    const cmds = [];
    b.meta.steps.forEach((s) => { cmds.push('cat todo.txt'); if (s.k === 'key') cmds.push('ssh -i ' + s.file + ' ' + s.u + '@' + s.h); else { cmds.push('cat ' + s.file + ' | base64 -d'); cmds.push('sshpass -p ' + s.pass + ' ssh ' + s.u + '@' + s.h); } });
    cmds.push('cat flag.txt'); return cmds;
  }
});

/* ---------------- drops ---------------- */
const DEC = [
  { n: 'base64', enc: (t) => b64(t), dec: 'base64 -d' },
  { n: 'hex', enc: (t) => hexs(t), dec: 'xxd -r -p' },
  { n: 'reversed base64', enc: (t) => b64(revs(t)), dec: 'base64 -d $F | rev' }
];
fam.push({
  id: 'drops', title: "Courier's Oubliette", cat: 'Pivoting', levels: 30, tier: (lv) => (lv <= 10 ? 3 : lv <= 20 ? 4 : 5), type: 'flag',
  blurb: 'Dozens of encoded files, one passphrase, one locked vault.',
  brief: (lv) => 'A passphrase for the vault is hidden among the encoded drop files in /srv/drop. Decode them all in a loop, find the passphrase, use it to log in, then open what is locked.' + (lv > 20 ? ' The encoding is two-layered.' : ''),
  build: (c, lv) => {
    const r = c.rnd, e = DEC[lv <= 10 ? 0 : lv <= 20 ? 1 : 2], N = 30 + lv * 3, pass = 'k' + r.hex(12), files = {}, which = r.int(3, N - 3), user = r.pick(['keeper', 'curator', 'warden']);
    const bodies = ['nothing to report', 'maintenance window moved', 'ticket ' + 1234 + ' closed', 'badge audit pending', 'printer is out of toner'];
    for (let i = 0; i < N; i++) {
      const body = i === which ? 'PASSPHRASE for vault01 user ' + user + ': ' + pass : (i % 9 === 4 ? 'PASSPHRASE for backup02 user nobody: ' + 'x' + r.hex(8) : r.pick(['NOTE: ', 'MEMO: ', 'LOG: ']) + r.pick(bodies) + ' ' + r.int(10, 99));
      files['/srv/drop/' + r.hex(8) + '.dat'] = e.enc(body + '\n') + '\n';
    }
    files[GH + '/README.txt'] = 'A passphrase for vault01 is hidden among the files in /srv/drop. They are encoded (' + e.n + ').\nBeware: some decoy lines also say passphrase. Ours is the one for vault01.\nThe flag is on vault01 and the file is locked.\n';
    const vf = '/home/' + user + '/.vault/flag.txt';
    return { motd: 'Dozens of files. One passphrase. One locked vault.', hosts: { web01: { name: 'web01', files }, vault01: { name: 'vault01', auth: { [user]: { pass } }, start: { user, cwd: '/home/' + user }, files: { ['/home/' + user + '/readme.txt']: 'vault access granted\n', [vf]: { c: c.flag + '\n', m: 0 } } } }, meta: { e: lv <= 10 ? 0 : lv <= 20 ? 1 : 2, user, pass } };
  },
  solve: (b) => {
    const e = b.meta.e, loop = e === 0 ? 'for f in $(ls /srv/drop); do base64 -d /srv/drop/$f; done | grep vault01' : e === 1 ? 'for f in $(ls /srv/drop); do xxd -r -p /srv/drop/$f; done | grep vault01' : 'for f in $(ls /srv/drop); do base64 -d /srv/drop/$f | rev; done | grep vault01';
    return [loop, 'sshpass -p ' + b.meta.pass + ' ssh ' + b.meta.user + '@vault01', 'chmod u+r .vault/flag.txt', 'chmod u+x .vault', 'cat .vault/flag.txt'];
  }
});

/* ---------------- gauntlet ---------------- */
fam.push({
  id: 'gauntlet', title: "Trial by Combat", cat: 'Chain', levels: 40, tier: (lv) => (lv <= 20 ? 5 : 6), type: 'flag',
  blurb: 'Full attack chains: loot, pivot, escalate. Several skills in one run.',
  brief: (lv) => ['You start as guest on web01. Admin leftovers hold the first step. Pivot to app01, then escalate to root there.', 'A leaked key sits somewhere in the logs. Use it to reach app01, where a setuid helper guards the flag.', 'Credentials hide behind two encodings. Break in, then use what sudo allows.', 'Two hops: db01 then vault01. The final file is locked.'][lv % 4],
  build: (c, lv) => {
    const r = c.rnd, v = lv % 4, noise = Math.floor(lv / 2), pass = 'p' + r.hex(10), marker = 'KEY-' + r.hex(16), files = {}, hosts = {}, meta = { v, pass };
    const rd = readme('Your target is a flag on another machine. You only have guest on web01.\nStart with what the admins left lying around.');
    Object.assign(files, rd, { [GH + '/TODO']: 'finish credential rotation (old copies in /var/backups and /var/log)\n' });
    for (let i = 0; i < 4 + noise; i++) files['/var/backups/' + word(r) + r.int(1, 99) + '.tgz'] = 'binary\n';
    const sudoFind = { list: ['User ops may run the following commands on app01:', '    (root) NOPASSWD: /usr/bin/find'], allow: ['find'] };
    if (v === 0) {
      files['/var/backups/creds.b64'] = b64('ops:' + pass) + '\n';
      hosts.app01 = { name: 'app01', auth: { ops: { pass } }, start: { user: 'ops', cwd: '/home/ops' }, files: { '/home/ops/README': 'app server\n', '/root/flag.txt': { c: c.flag + '\n', m: 600, o: 'root' } }, sudo: sudoFind };
      meta.cmds = ['cat /var/backups/creds.b64 | base64 -d', 'sshpass -p ' + pass + ' ssh ops@app01', 'sudo -l', 'sudo find /home/ops/README -exec cat /root/flag.txt \\;'];
    } else if (v === 1) {
      for (let i = 0; i < 30 + noise * 2; i++) files['/var/log/' + word(r) + '/' + r.hex(4) + '.log'] = text([noiseLine(r), noiseLine(r)]);
      files['/var/log/deploy/' + r.hex(4) + '.log'] = '2026-11-20 deploy key rotated, old key left in ' + GH + '/.ssh/id_deploy\n';
      files[GH + '/.ssh/id_deploy'] = { c: privkey(marker), m: 600 };
      const nm = 'logview' + r.int(1, 99), path = '/usr/local/bin/' + nm;
      const bf = { '/home/ops/README': 'app server\n', '/var/log/app.log': 'started\nready\n', '/root/flag.txt': { c: c.flag + '\n', m: 600, o: 'root' }, [path]: { c: 'ELF', m: 4755 }, '/usr/bin/passwd': { c: 'ELF', m: 4755 } };
      hosts.app01 = { name: 'app01', auth: { ops: { key: marker } }, start: { user: 'ops', cwd: '/home/ops' }, files: bf, bins: { '/usr/bin/passwd': () => ({ o: 'passwd: pretend system' }), [path]: (a, s, st, io) => { if (!a[0]) return { e: 'usage: ' + nm + ' FILE (log files only)' }; if (a[0].indexOf('/var/log/') !== 0) return { e: nm + ': access denied' }; const n = io.fs[io.resolve(a[0])]; return n && n.t === 'f' ? { o: n.c.replace(/\n$/, '') } : { e: nm + ': no such file' }; } } };
      meta.cmds = ['ls -a ~/.ssh', 'ssh -i ~/.ssh/id_deploy ops@app01', 'find / -perm -4000 2>/dev/null', path + ' /var/log/../../root/flag.txt'];
    } else if (v === 2) {
      files['/var/backups/vault.enc'] = hexs(b64('ops:' + pass)) + '\n';
      hosts.app01 = { name: 'app01', auth: { ops: { pass } }, start: { user: 'ops', cwd: '/home/ops' }, files: { '/home/ops/README': 'app server\n', '/root/flag.txt': { c: c.flag + '\n', m: 600, o: 'root' } }, sudo: { list: ['User ops may run the following commands on app01:', '    (root) NOPASSWD: /usr/bin/sed'], allow: ['sed'] } };
      meta.cmds = ['cat /var/backups/vault.enc | xxd -r -p | base64 -d', 'sshpass -p ' + pass + ' ssh ops@app01', 'sudo -l', 'sudo sed -n 1p /root/flag.txt'];
    } else {
      const p2 = 'q' + r.hex(10); files['/var/backups/creds.b64'] = b64('dba:' + pass) + '\n';
      hosts.db01 = { name: 'db01', auth: { dba: { pass } }, start: { user: 'dba', cwd: '/home/dba' }, files: { '/home/dba/notes.txt': 'the vault password is in ~/.pw (base64)\n', '/home/dba/.pw': b64(p2) + '\n' } };
      hosts.vault01 = { name: 'vault01', auth: { keeper: { pass: p2 } }, start: { user: 'keeper', cwd: '/home/keeper' }, files: { '/home/keeper/.safe/flag.txt': { c: c.flag + '\n', m: 0 }, '/home/keeper/readme.txt': 'welcome\n' } };
      meta.cmds = ['cat /var/backups/creds.b64 | base64 -d', 'sshpass -p ' + pass + ' ssh dba@db01', 'cat .pw | base64 -d', 'sshpass -p ' + p2 + ' ssh keeper@vault01', 'chmod u+rx .safe', 'chmod u+r .safe/flag.txt', 'cat .safe/flag.txt'];
    }
    return { motd: 'Several steps. Each one opens the next.', hosts: Object.assign({ web01: { name: 'web01', files } }, hosts), meta };
  },
  solve: (b) => b.meta.cmds
});

module.exports = fam;
