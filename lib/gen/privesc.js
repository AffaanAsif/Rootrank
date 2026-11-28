'use strict';
const U = require('./util');
const { GH, ip, pubip, NAMES, word, uniqWords, text, readme, noiseLine, hexs } = U;

const fam = [];
const DECOY_SUID = ['/usr/bin/passwd', '/usr/bin/mount', '/usr/bin/su', '/usr/bin/chsh', '/usr/bin/newgrp', '/usr/bin/gpasswd', '/usr/bin/umount', '/usr/bin/chfn', '/usr/lib/dbus-1.0/dbus-daemon-launch-helper'];
const decoyFiles = (r, n) => { const f = {}; r.shuffle(DECOY_SUID.slice()).slice(0, n).forEach((p) => { f[p] = { c: 'ELF', m: 4755 }; }); return f; };
const decoyBins = (files) => { const b = {}; Object.keys(files).forEach((p) => { const n = p.split('/').pop(); b[p] = () => ({ o: n + ': this is a pretend system, nothing to do here.' }); }); return b; };

/* ---------------- sudoer ---------------- */
fam.push({
  id: 'sudoer', title: "Rights of the Sovereign", cat: 'Privesc', levels: 30, tier: (lv) => (lv <= 10 ? 3 : lv <= 20 ? 4 : 5), type: 'flag',
  blurb: 'sudo -l shows what you may run as root. Even harmless-looking commands can read root files.',
  brief: (lv) => 'You are guest. The flag belongs to root. Run sudo -l to see what you are allowed to run as root, then use exactly that.' + (lv > 20 ? ' You do not know the file name this time. Only find is allowed.' : ''),
  build: (c, lv) => {
    const r = c.rnd, files = {}, stage = lv <= 10 ? 0 : lv <= 20 ? 1 : 2;
    const cmds = [['cat', 'head', 'tail', 'sort'], ['grep', 'sed', 'awk'], ['find']][stage], allow = r.pick(cmds);
    let flagPath = '/root/flag.txt', note;
    if (stage < 2) note = 'The flag is in /root/flag.txt, but guest cannot read /root.';
    else { const nm = 'loot-' + r.hex(5) + '.txt'; flagPath = '/root/' + word(r) + '/' + nm; note = 'The flag is in a file called ' + nm + ' somewhere under /root.'; for (let i = 0; i < 4; i++) files['/root/' + word(r) + i + '/loot-' + r.hex(5) + '.txt'] = { c: 'nothing\n', m: 600, o: 'root' }; }
    files[flagPath] = { c: c.flag + '\n', m: 600, o: 'root' };
    if (stage < 2) files['/root/.profile'] = { c: '# root profile\n', m: 600, o: 'root' };
    Object.assign(files, readme(note + '\nSee what guest may run with sudo.'), { [GH + '/notes.txt']: 'meeting at 10\n' });
    const list = ['Matching Defaults entries for guest on arena:', '    env_reset, secure_path=/usr/bin', '', 'User guest may run the following commands on arena:', '    (root) NOPASSWD: /usr/bin/' + allow];
    return { motd: 'You are guest. The flag belongs to root.', hosts: { main: { name: 'arena', files, sudo: { list, allow: [allow] } } }, meta: { allow, flagPath, stage } };
  },
  solve: (b) => {
    const a = b.meta.allow, p = b.meta.flagPath;
    const cmd = { cat: 'sudo cat ' + p, head: 'sudo head -n 5 ' + p, tail: 'sudo tail -n 5 ' + p, sort: 'sudo sort ' + p, grep: 'sudo grep flag ' + p, sed: "sudo sed -n 1p " + p, awk: "sudo awk '/flag/ {print $0}' " + p, find: 'sudo find /root -name ' + p.split('/').pop() + ' -exec cat {} \\;' }[a];
    return ['sudo -l', cmd];
  }
});

/* ---------------- suid ---------------- */
fam.push({
  id: 'suid', title: "Usurper's Seal", cat: 'Privesc', levels: 30, tier: (lv) => (lv <= 10 ? 3 : lv <= 20 ? 4 : 5), type: 'flag',
  blurb: 'A helper program runs with more power than it should. Find it and bend it.',
  brief: () => 'The flag is in a file only root can read. Somewhere on this machine a custom helper runs as its owner (setuid). Find it with find / -perm -4000, read how it behaves, and make it read the flag for you.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, files = {}, nm = r.pick(['logview', 'reportr', 'peek', 'viewer', 'inspect', 'showit', 'taillog', 'dumper']) + r.int(1, 99), dir = r.pick(['/usr/local/bin', '/opt/bin', '/usr/libexec/tools']), path = dir + '/' + nm, rp = '/root/' + r.pick(['flag', 'vault', 'secret']) + '.' + (v === 2 ? 'conf' : 'txt');
    Object.assign(files, decoyFiles(r, 2 + Math.floor(lv / 6)), { [path]: { c: 'ELF', m: 4755 }, [rp]: { c: c.flag + '\n', m: 600, o: 'root' }, '/var/log/app.log': iso1() + ' INFO started\n' + iso1() + ' INFO ready\n', '/srv/public/readme.txt': 'public file\n' });
    Object.assign(files, readme('The flag is in ' + rp + '. guest cannot read it.\nLook for programs that run with the power of their owner (setuid).'));
    const bins = decoyBins(files);
    const bad = (m) => ({ e: nm + ': ' + m });
    bins[path] = (a, s, st, io) => {
      const rd = (p) => { const q = io.resolve(p), n = io.fs[q]; if (!n) return { e: nm + ': no such file: ' + p }; if (n.t !== 'f') return { e: nm + ': not a file' }; return { n }; };
      if (v === 0) {
        if (!a[0]) return bad('usage: ' + nm + ' FILE   (shows log files from /var/log)');
        if (a[0].indexOf('/var/log/') !== 0) return bad('access denied, only files in /var/log are allowed');
        const x = rd(a[0]); return x.e ? x : { o: x.n.c.replace(/\n$/, '') };
      }
      if (v === 1) {
        if (!a[0]) return bad('usage: ' + nm + ' FILE   (adds line numbers; /root is blocked)');
        if (a[0].indexOf('/root') === 0) return bad('access denied: /root is off limits');
        const x = rd(a[0]); return x.e ? x : { o: x.n.c.replace(/\n$/, '').split('\n').map((l, i) => (i + 1) + '  ' + l).join('\n') };
      }
      if (v === 2) {
        if (!a[0]) return bad('usage: ' + nm + ' FILE.conf   (checks a config file, any folder, .conf only)');
        if (!/\.conf$/.test(a[0])) return bad('only .conf files can be checked');
        const x = rd(a[0]); return x.e ? x : { o: x.n.c.replace(/\n$/, '') };
      }
      if (v === 3) {
        if (a.length < 2) return bad('usage: ' + nm + ' N FILE   (last N lines of a file in /var/log)');
        if (a[1].indexOf('/var/log/') !== 0) return bad('access denied, only /var/log');
        const x = rd(a[1]); return x.e ? x : { o: x.n.c.replace(/\n$/, '').split('\n').slice(-Math.max(1, parseInt(a[0], 10) || 1)).join('\n') };
      }
      if (!a[0]) return bad('usage: ' + nm + ' FILE   (prints the file as hex; only /srv/public is allowed)');
      if (a[0].indexOf('/srv/public/') !== 0) return bad('access denied, only /srv/public');
      const x = rd(a[0]); return x.e ? x : { o: Buffer.from(x.n.c.replace(/\n$/, ''), 'utf8').toString('hex') };
    };
    return { motd: 'A helper program runs with more power than it should.', hosts: { main: { name: 'arena', files, bins } }, meta: { v, nm, path, rp } };
  },
  solve: (b) => {
    const { v, nm, path, rp } = b.meta, up = rp.slice(1);
    return ['find / -perm -4000 2>/dev/null', path, v === 0 ? path + ' /var/log/../../' + up : v === 1 ? path + ' /etc/../' + up : v === 2 ? path + ' ' + rp : v === 3 ? path + ' 5 /var/log/../../' + up : path + ' /srv/public/../../' + up + ' | xxd -r -p'];
  }
});
function iso1() { return '2026-11-26T10:00:00Z'; }

/* ---------------- audit ---------------- */
fam.push({
  id: 'audit', title: "Inquisition of Titles", cat: 'Privesc', levels: 25, tier: (lv) => (lv <= 12 ? 3 : 4), type: 'answer',
  blurb: 'Hunt risky permissions across a filesystem: world-writable, setuid and odd owners.',
  brief: () => 'Audit the machine with find. The README asks one question. find understands -perm, -user, -name and -type.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, files = {}, N = 30 + lv * 3, dirs = ['/etc/app', '/srv/shared', '/opt/tools', '/var/lib/svc', '/usr/local/share'];
    const mk = (p, m, o, content) => { files[p] = { c: content || 'x\n', m, o: o || 'root' }; };
    const safeModes = [644, 640, 600, 755, 750, 700, 664];
    let ans, ask, T;
    const fname = (ext) => dirs[r.int(0, dirs.length - 1)] + '/' + word(r) + '-' + r.hex(4) + (ext || '.cfg');
    if (v === 0) {
      for (let i = 0; i < N; i++) mk(fname(), r.pick(safeModes.filter((m) => m !== 664 && m !== 666)), r.pick(['root', 'ops']));
      T = fname('.cfg'); mk(T, 666, 'root'); ans = T; ask = 'Exactly one regular file under /etc, /srv, /opt, /var or /usr is writable by everyone (others have w). Which? Give the full path.';
      files[T].m = 666;
    } else if (v === 1) {
      let n = 0; for (let i = 0; i < N; i++) mk(fname(), r.pick(safeModes), 'root');
      const k = r.int(3, 9); for (let i = 0; i < k; i++) { mk('/opt/tools/' + word(r) + '-' + r.hex(4), 4755, 'root'); n++; }
      ans = String(n); ask = 'How many setuid files (mode 4xxx) exist on this machine?'; T = null;
    } else if (v === 2) {
      const who = r.pick(['ops', 'deploy', 'backup']); for (let i = 0; i < N; i++) mk(fname(), r.pick(safeModes), 'root');
      T = fname('.cfg'); mk(T, 640, who); ans = T; ask = 'One file is owned by ' + who + '. Which one? Give the full path.'; files[GH + '/who.txt'] = who + '\n'; T = { p: T, who };
    } else if (v === 3) {
      for (let i = 0; i < N; i++) mk(fname(i % 3 ? '.cfg' : '.pem'), r.pick([644, 640, 750, 755, 664]), 'root');
      for (let i = 0; i < 3; i++) mk(fname('.pem'), 600, 'root'); const t = fname('.key'); mk(t, 600, 'root');
      const exact = Object.keys(files).filter((p) => files[p].m === 600 && /\.pem$/.test(p));
      ans = String(exact.length); ask = 'How many .pem files have permissions of exactly 600?'; T = null;
    } else {
      for (let i = 0; i < N; i++) mk(fname(), r.pick([644, 640, 600, 660, 750, 740]), 'root');
      T = '/srv/shared/' + word(r) + '-' + r.hex(4) + '.sh'; mk(T, 755, 'root'); ans = T; ask = 'Exactly one file under /srv/shared can be EXECUTED by everyone (others have x). Which? Give the full path.';
      Object.keys(files).forEach((p) => { if (p !== T && p.indexOf('/srv/shared') === 0 && files[p].m >= 700 && (files[p].m % 10) & 1) files[p].m = 740; });
      for (let i = 0; i < 5; i++) mk('/srv/shared/' + word(r) + '-' + r.hex(4) + '.sh', 750, 'root');
    }
    Object.assign(files, readme(ask + '\nSubmit just the answer.'));
    return { motd: 'Trust nothing. Check the bits.', hosts: { main: { name: 'arena', files } }, answer: ans, meta: { v, T } };
  },
  solve: (b) => [['find /etc /srv /opt /var /usr -type f -perm -002', 'find / -perm -4000 2>/dev/null | wc -l', 'find / -user ' + (b.meta.T && b.meta.T.who) + ' -type f 2>/dev/null', 'find / -name "*.pem" -perm 600 2>/dev/null | wc -l', 'find /srv/shared -type f -perm -001'][b.meta.v]]
});

module.exports = fam;
