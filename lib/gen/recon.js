'use strict';
const U = require('./util');
const { GH, pad, iso, ip, pubip, NAMES, WORDS, word, uniqWords, text, readme, noiseLine, b64 } = U;

const fam = [];

/* ---------------- cronchain ---------------- */
fam.push({
  id: 'cronchain', title: "Bellringer's Trail", cat: 'Recon', levels: 30, tier: (lv) => (lv <= 10 ? 2 : lv <= 20 ? 3 : 4), type: 'flag',
  blurb: 'Scheduled jobs call scripts that call configs. Follow the chain to the secret.',
  brief: () => 'A job under /etc/cron.d runs a script that sources another file, which sources another, and so on. The last file in the chain stores a password in the clear. Follow every link.',
  build: (c, lv) => {
    const r = c.rnd, depth = 2 + Math.floor((lv - 1) / 6), files = {}, chain = [];
    const cronUser = r.pick(['root', 'backup', 'ops']);
    const names = uniqWords(r, 3 + depth + 4).map((x) => x.replace('-', ''));
    let ni = 0; const nm = () => names[ni++];
    const first = '/etc/cron.d/' + nm(); chain.push(first);
    const scripts = []; for (let i = 0; i < depth; i++) scripts.push('/opt/jobs/' + nm() + (i === depth - 1 ? '.conf' : '.sh'));
    files[first] = '# m h dom mon dow user command\n*/10 * * * * ' + cronUser + ' ' + scripts[0] + '\n';
    for (let i = 0; i < 3; i++) { const d = '/etc/cron.d/' + nm(); files[d] = '0 3 * * * root /opt/jobs/decoy' + i + '.sh\n'; files['/opt/jobs/decoy' + i + '.sh'] = '#!/bin/bash\nrm -rf /tmp/*\n'; }
    for (let i = 0; i < depth - 1; i++) { files[scripts[i]] = '#!/bin/bash\n# step ' + (i + 1) + '\nsource ' + scripts[i + 1] + '\necho "' + word(r) + ' done"\n'; chain.push(scripts[i]); }
    files[scripts[depth - 1]] = 'DB_HOST=localhost\nDB_USER=svc\nDB_PASSWORD=' + c.flag + '\n'; chain.push(scripts[depth - 1]);
    Object.assign(files, readme('A job leaks a password. Start at /etc/cron.d, follow what each file runs or sources, until you reach the config.'));
    return { motd: 'Scheduled jobs leave footprints.', hosts: { main: { name: 'arena', files } }, meta: { chain } };
  },
  solve: (b) => b.meta.chain.map((f) => 'cat ' + f)
});

/* ---------------- secrets ---------------- */
fam.push({
  id: 'secrets', title: "Quest of the Hidden Seal", cat: 'Recon', levels: 30, tier: (lv) => (lv <= 10 ? 2 : lv <= 20 ? 3 : 4), type: 'flag',
  blurb: 'Developers leave credentials in strange places. Search a whole project for them.',
  brief: (lv) => 'A web project under /srv/app leaks a secret. Search the whole tree. ' + ['It is in a .env file.', 'It is in a config file under a key named secret.', 'It sits in a backup copy someone forgot (look for .bak).', 'It is in a comment inside a source file.', 'It is stored base64 encoded in a yaml value.'][lv % 5],
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, files = {}, dirs = ['src', 'config', 'public', 'lib', 'scripts', 'docs'], N = 20 + lv * 2;
    for (let i = 0; i < N; i++) {
      const d = r.pick(dirs), ext = r.pick(['js', 'py', 'conf', 'md', 'yml']), f = '/srv/app/' + d + '/' + word(r) + r.int(1, 99) + '.' + ext;
      files[f] = text([ext === 'py' ? '# ' + word(r) : '// ' + word(r), 'name = "' + word(r) + '"', 'debug = ' + r.pick(['true', 'false']), 'password = "changeme"', 'token = "' + r.hex(8) + '"', 'port = ' + r.int(1000, 9999)]);
    }
    const dec = (n) => { for (let i = 0; i < n; i++) files['/srv/app/' + r.pick(dirs) + '/' + word(r) + '.env.example'] = 'API_KEY=your-key-here\nSECRET=replace-me\n'; };
    dec(4);
    let hint;
    if (v === 0) files['/srv/app/.env'] = 'APP_ENV=prod\nAPI_SECRET=' + c.flag + '\n';
    else if (v === 1) files['/srv/app/config/' + word(r) + 'x.conf'] = 'name = "live"\nsecret = "' + c.flag + '"\n';
    else if (v === 2) files['/srv/app/config/old-' + word(r) + '.conf.bak'] = 'user = admin\nadmin_pass = ' + c.flag + '\n';
    else if (v === 3) files['/srv/app/src/' + word(r) + 'zz.js'] = '// TODO remove before release: key ' + c.flag + '\nmodule.exports = {};\n';
    else files['/srv/app/config/prod.yml'] = 'service: billing\ncredential: ' + b64(c.flag) + '\n';
    Object.assign(files, readme('Somewhere under /srv/app a real secret is stored.\nThe project has ' + N + '+ files. Do not read them one by one.'));
    return { motd: 'A big project. A small mistake.', hosts: { main: { name: 'arena', files } }, meta: { v } };
  },
  solve: (b) => [['grep -r API_SECRET /srv/app', 'grep -r "secret =" /srv/app', 'find /srv/app -name "*.bak" -exec cat {} \\;', 'grep -r "TODO remove" /srv/app', 'grep credential: /srv/app/config/prod.yml | cut -d" " -f2 | base64 -d'][b.meta.v]]
});

/* ---------------- passwd ---------------- */
fam.push({
  id: 'passwd', title: "Roll of the Realm", cat: 'Recon', levels: 25, tier: (lv) => (lv <= 12 ? 2 : 3), type: 'answer',
  blurb: 'Read /etc/passwd and /etc/shadow like an auditor.',
  brief: () => 'A copy of /etc/passwd and /etc/shadow is under /srv/audit. Fields are separated by colons: name:pw:uid:gid:comment:home:shell. Answer the README question with grep, cut and awk -F:.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, users = uniqWords(r, 14 + lv).map((x) => x.split('-')[0] + r.int(1, 99)), P = [], S = [];
    const shells = ['/bin/bash', '/usr/sbin/nologin', '/bin/sh', '/bin/false'];
    P.push('root:x:0:0:root:/root:/bin/bash'); S.push('root:$6$' + r.hex(10) + ':19000:0:99999:7:::');
    let ans, ask, back = r.pick(users), who = r.pick(users.filter((x) => x !== back)), nopw = r.pick(users.filter((x) => x !== back && x !== who));
    let nBash = 0;
    users.forEach((u, i) => {
      const uid = u === back ? 0 : 1000 + i, sh = r.pick(shells);
      P.push(u + ':x:' + uid + ':' + (1000 + i) + ':' + u + ':/home/' + u + ':' + sh);
      if (sh === '/bin/bash') nBash++;
      S.push(u + ':' + (u === nopw ? '' : '$6$' + r.hex(10)) + ':19000:0:99999:7:::');
    });
    const home = '/home/' + who;
    if (v === 0) { ans = back; ask = 'One account other than root has user id 0. Which one?'; }
    else if (v === 1) { ans = String(nBash + 1); ask = 'How many accounts use /bin/bash as their shell (root counts)?'; }
    else if (v === 2) { ans = home; ask = 'What is the home directory of ' + who + '?'; }
    else if (v === 3) { ans = nopw; ask = 'In the shadow file, which account has an EMPTY password field?'; }
    else { ans = String(P.length); ask = 'How many accounts exist in total?'; }
    return { motd: 'Accounts tell stories.', hosts: { main: { name: 'arena', files: Object.assign(readme(ask), { '/srv/audit/passwd': text(P), '/srv/audit/shadow': text(S) }) } }, answer: ans, meta: { v, who } };
  },
  solve: (b) => [["awk -F: '$3==0 {print $1}' /srv/audit/passwd", 'grep -c /bin/bash /srv/audit/passwd', 'grep ^' + b.meta.who + ': /srv/audit/passwd | cut -d: -f6', 'grep "^[a-z0-9]*::" /srv/audit/shadow | cut -d: -f1', 'wc -l /srv/audit/passwd'][b.meta.v]]
});

/* ---------------- sshcfg ---------------- */
fam.push({
  id: 'sshcfg', title: "Treaty of Passage", cat: 'Recon', levels: 25, tier: (lv) => (lv <= 12 ? 2 : 3), type: (lv) => (lv % 5 === 4 ? 'flag' : 'answer'),
  blurb: 'Read ssh config files and known hosts to map out a network.',
  brief: () => 'Your ~/.ssh/config lists hosts as Host blocks (HostName, User, Port, IdentityFile). Answer the README question. grep -A prints lines after a match.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, N = 6 + Math.floor(lv / 2), hosts = [], used = new Set();
    for (let i = 0; i < N; i++) { let al; do al = word(r) + r.int(1, 99); while (used.has(al)); used.add(al); hosts.push({ al, hn: pubip(r), user: r.pick(NAMES), port: r.pick([22, 22, 2222, 2200, 22022]) + (i % 3), key: '~/.ssh/id_' + word(r) + r.int(1, 99) }); }
    const t = r.pick(hosts), cfg = [];
    hosts.forEach((h) => { cfg.push('Host ' + h.al, '  HostName ' + h.hn, '  User ' + h.user, '  Port ' + h.port, '  IdentityFile ' + h.key, ''); });
    let ans, ask, files = {};
    if (v === 0) { ans = t.hn; ask = 'What IP address does the alias ' + t.al + ' point to?'; }
    else if (v === 1) { ans = t.user; ask = 'Which user is used for ' + t.al + '?'; }
    else if (v === 2) { ans = t.key; ask = 'Which identity file belongs to ' + t.al + '? Submit it exactly as written.'; }
    else if (v === 3) { ans = String(hosts.filter((h) => h.port !== 22).length); ask = 'How many hosts use a port other than 22?'; }
    else { const k = r.int(0, cfg.length - 1); const m = r.pick(hosts); files['/home/guest/.ssh/known_hosts'] = text(hosts.map((h) => h.hn + ' ssh-ed25519 AAAA' + r.hex(24) + (h === m ? ' # ' + c.flag : ''))); ask = 'One known_hosts entry carries a comment with the flag.'; }
    Object.assign(files, readme(ask), { [GH + '/.ssh/config']: text(cfg) });
    return { motd: 'Your own config knows the whole network.', hosts: { main: { name: 'arena', files } }, answer: ans === undefined ? undefined : String(ans), meta: { v, t } };
  },
  solve: (b) => [['grep -A1 "Host ' + b.meta.t.al + '$" ~/.ssh/config', 'grep -A2 "Host ' + b.meta.t.al + '$" ~/.ssh/config', 'grep -A4 "Host ' + b.meta.t.al + '$" ~/.ssh/config', 'grep Port ~/.ssh/config | grep -vc " 22$"', 'grep flag ~/.ssh/known_hosts'][b.meta.v]]
});

/* ---------------- services ---------------- */
fam.push({
  id: 'services', title: "Gates of the Citadel", cat: 'Recon', levels: 20, tier: (lv) => (lv <= 10 ? 2 : 3), type: (lv) => (lv % 4 === 3 ? 'flag' : 'answer'),
  blurb: 'Which service listens where? Read a netstat dump.',
  brief: () => 'listening.txt is a netstat style dump: proto, address:port, process. Answer the README question.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 4, procs = ['sshd', 'nginx', 'postgres', 'redis', 'cron', 'mysqld', 'node', 'python3', 'dnsmasq', 'cupsd', 'ntpd', 'httpd'], ports = [22, 80, 443, 5432, 6379, 3306, 3000, 8000, 53, 631, 123, 8080];
    const n = 7 + Math.floor(lv / 3), idx = r.shuffle(procs.map((_, i) => i)).slice(0, n), L = []; let pub = 0, ans, ask, bad, bp;
    idx.forEach((i) => { const pu = r.int(0, 1); if (pu) pub++; L.push('tcp ' + (pu ? '0.0.0.0' : '127.0.0.1') + ':' + ports[i] + ' ' + procs[i]); });
    const files = {};
    if (v === 0) { const t = r.pick(idx); ans = procs[t]; ask = 'Which process listens on port ' + ports[t] + '?'; bp = ports[t]; }
    else if (v === 1) { ans = String(pub); ask = 'How many services listen on 0.0.0.0 (all interfaces)?'; }
    else if (v === 2) { const hp = r.int(40000, 65000); L.splice(r.int(0, L.length), 0, 'tcp 0.0.0.0:' + hp + ' ' + r.pick(['kworkerd', 'syslogd2', 'updated'])); ans = String(hp); ask = 'One listener sits on an unusual high port (5 digits). Which port?'; }
    else { const hp = r.int(40000, 65000); L.splice(r.int(0, L.length), 0, 'tcp 0.0.0.0:' + hp + ' backdoor'); files['/srv/banners/' + hp + '.txt'] = 'banner: ' + c.flag + '\n'; for (let i = 0; i < 5; i++) files['/srv/banners/' + r.int(1000, 9999) + '.txt'] = 'banner: nothing\n'; bp = hp; ask = 'A process called backdoor is listening. Its banner is stored as /srv/banners/PORT.txt. Read it.'; }
    Object.assign(files, readme(ask), { [GH + '/listening.txt']: text(L) });
    return { motd: 'Who is listening?', hosts: { main: { name: 'arena', files } }, answer: ans, meta: { v, bp } };
  },
  solve: (b) => [['grep ":' + b.meta.bp + ' " listening.txt', 'grep -c 0.0.0.0: listening.txt', "grep -E ':[0-9]{5} ' listening.txt", 'cat /srv/banners/' + b.meta.bp + '.txt'][b.meta.v]]
});

module.exports = fam;
