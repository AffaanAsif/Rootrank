'use strict';
const U = require('./util');
const { GH, pad, iso, ip, pubip, WORDS, NAMES, word, uniqWords, text, readme, noiseLine, lerp } = U;

const fam = [];

/* ---------------- nav ---------------- */
fam.push({
  id: 'nav', title: "Wayfarer's Charter", cat: 'Linux', levels: 30, tier: (lv) => (lv <= 15 ? 1 : 2), type: 'flag',
  blurb: 'Move through deep folder trees and read what you find.',
  brief: (lv) => (lv <= 10 ? 'The flag sits at the bottom of a chain of folders. The README gives you the route. Walk it with cd and ls, then read the flag.' : 'The flag is in a file named flag.txt buried somewhere under /srv/vault. Searching by hand is slow. Let find do the walking.'),
  build: (c, lv) => {
    const r = c.rnd, depth = 2 + Math.floor(lv / 3), files = {};
    let cur = '/srv/vault';
    for (let i = 0; i < depth; i++) {
      for (let k = 0; k < 2 + Math.floor(lv / 6); k++) files[cur + '/' + word(r) + '_' + k + i + '/notes.txt'] = 'nothing here\n';
      cur += '/' + word(r) + '-' + i; files[cur + '/readme.txt'] = 'keep going\n';
    }
    files[cur + '/flag.txt'] = c.flag + '\n'; files[cur + '/flag.txt.old'] = 'old copy, not the flag\n';
    Object.assign(files, readme(lv <= 10 ? 'The flag is in flag.txt inside ' + cur + '\nUse cd to get there, ls to look around, cat to read.' : 'The flag is in a file named exactly flag.txt somewhere under /srv/vault.'));
    return { motd: 'A deep folder tree. One file matters.', hosts: { main: { name: 'arena', files } }, meta: { final: cur } };
  },
  solve: (b, lv) => (lv <= 10 ? ['ls', 'cd ' + b.meta.final, 'ls', 'cat flag.txt'] : ['find /srv/vault -name flag.txt -exec cat {} \\;'])
});

/* ---------------- hidden ---------------- */
fam.push({
  id: 'hidden', title: "Secret Chambers", cat: 'Linux', levels: 30, tier: (lv) => (lv <= 15 ? 1 : 2), type: 'flag',
  blurb: 'Dot files, dot folders and things that do not show up in plain ls.',
  brief: () => 'Something is hidden in your home folder. Plain ls will not show it, because names that start with a dot are hidden.',
  build: (c, lv) => {
    const r = c.rnd, depth = 1 + Math.floor(lv / 4), files = {};
    let cur = GH;
    for (let i = 0; i < depth; i++) {
      files[cur + '/.' + word(r) + '_decoy' + i + '/.note'] = 'not this one\n';
      cur += '/.' + word(r) + i; files[cur + '/.cache'] = 'just cache\n';
    }
    files[cur + '/.secret'] = c.flag + '\n';
    Object.assign(files, readme('Nothing to see here. Or is there?\nHidden things start with a dot.'), { [GH + '/notes.txt']: 'buy milk\n' });
    return { motd: 'Look closer than ls does.', hosts: { main: { name: 'arena', files } }, meta: { depth } };
  },
  solve: (b, lv) => ['ls -a', 'find /home/guest -name .secret -exec cat {} \\;']
});

/* ---------------- finder ---------------- */
fam.push({
  id: 'finder', title: "The Seeker's Decree", cat: 'Linux', levels: 30, tier: (lv) => (lv <= 10 ? 1 : lv <= 20 ? 2 : 3), type: 'flag',
  blurb: 'Locate one file by name, owner and permissions with find.',
  brief: (lv) => 'Dozens of files look alike. Exactly one matches every condition in the README. Combine find tests (' + (lv <= 10 ? '-name' : lv <= 20 ? '-name, -user' : '-name, -user, -perm') + ') to isolate it, then read it.',
  build: (c, lv) => {
    const r = c.rnd, k = 1 + Math.floor((lv - 1) / 10), files = {};
    const owners = ['root', 'guest', 'ops', 'www', 'backup'], modes = [644, 664, 666, 604, 755, 745, 654], exts = ['conf', 'log', 'bak', 'txt', 'key', 'dat'];
    const T = { pre: word(r), ext: r.pick(exts), owner: r.pick(owners), mode: r.pick(modes) };
    const dirs = ['a', 'b', 'c', 'd', 'e'].map((x) => '/srv/data/' + x + r.int(1, 9));
    const put = (name, owner, mode, content) => { files[r.pick(dirs) + '/' + name + '-' + r.hex(3)] = { c: content, o: owner, m: mode }; };
    // target: name is "<pre>-<hex>.<ext>" so the glob is "<pre>-*.<ext>"
    files[dirs[0] + '/' + T.pre + '-' + r.hex(3) + '.' + T.ext] = { c: c.flag + '\n', o: T.owner, m: T.mode };
    const nameOf = (pre, ext) => pre + '-' + r.hex(4) + '.' + ext;
    for (let i = 0; i < 40 + lv * 2; i++) {
      const d = { pre: T.pre, ext: T.ext, owner: T.owner, mode: T.mode }, which = r.pick(['name', 'owner', 'mode'].slice(0, k === 1 ? 1 : k === 2 ? 2 : 3));
      if (which === 'name') { if (r.int(0, 1)) d.pre = word(r) + 'x'; else d.ext = r.pick(exts.filter((e) => e !== T.ext)); }
      else if (which === 'owner') d.owner = r.pick(owners.filter((o) => o !== T.owner));
      else d.mode = r.pick(modes.filter((m) => m !== T.mode));
      files[r.pick(dirs) + '/' + nameOf(d.pre, d.ext)] = { c: 'not the flag\n', o: d.owner, m: d.mode };
    }
    const conds = ['named like ' + T.pre + '-*.' + T.ext];
    if (k >= 2) conds.push('owned by ' + T.owner);
    if (k >= 3) conds.push('with permissions exactly ' + T.mode);
    Object.assign(files, readme('Under /srv/data there is exactly one regular file ' + conds.join(', ') + '.\nRead it.'));
    return { motd: 'One file, several conditions.', hosts: { main: { name: 'arena', files } }, meta: { T, k } };
  },
  solve: (b) => ['find /srv/data -type f -name ' + b.meta.T.pre + '-*.' + b.meta.T.ext + (b.meta.k >= 2 ? ' -user ' + b.meta.T.owner : '') + (b.meta.k >= 3 ? ' -perm ' + b.meta.T.mode : '') + ' -exec cat {} \\;']
});

/* ---------------- perms ---------------- */
fam.push({
  id: 'perms', title: "Keys of the Realm", cat: 'Permissions', levels: 30, tier: (lv) => (lv <= 15 ? 2 : 3), type: 'flag',
  blurb: 'Read the permission bits, then change them to open what you own.',
  brief: (lv) => 'You own every file in ~/lab but they are locked. Folders need the x bit to enter, files need r to read. Work from the top down with chmod.' + (lv > 15 ? ' This one is several layers deep.' : ''),
  build: (c, lv) => {
    const r = c.rnd, L = 1 + Math.floor(lv / 6), files = {}, chain = [];
    let cur = GH + '/lab';
    files[cur + '/'] = { m: 0 }; chain.push(cur);
    for (let i = 1; i < L; i++) { cur += '/' + word(r) + i; files[cur + '/'] = { m: r.pick([0, 400, 600, 100]) }; chain.push(cur); }
    const file = cur + '/note.txt'; files[file] = { c: c.flag + '\n', m: 0 };
    Object.assign(files, readme('The note is at ' + file + '\nEvery folder on the way is locked, and so is the note itself.\nYou own them all, so you may change their permissions.'));
    return { motd: 'You own it all. It just will not let you in.', hosts: { main: { name: 'arena', files } }, meta: { chain, file } };
  },
  solve: (b) => b.meta.chain.map((d) => 'chmod 755 ' + d).concat(['chmod u+r ' + b.meta.file, 'ls -l ' + b.meta.file, 'cat ' + b.meta.file])
});

/* ---------------- slice ---------------- */
fam.push({
  id: 'slice', title: "Scribe's Quill", cat: 'Text', levels: 30, tier: (lv) => (lv <= 15 ? 1 : 2), type: 'flag',
  blurb: 'Pull exact lines out of big files with head, tail and sed.',
  brief: (lv) => 'A big file hides the flag on one exact line. The README says which. Do not scroll: use head, tail or sed -n.',
  build: (c, lv) => {
    const r = c.rnd, N = 80 + lv * 25, K = r.int(10, N - 10), v = lv % 3, L = [];
    for (let i = 1; i <= N; i++) L.push(i === K ? 'secret = ' + c.flag : noiseLine(r));
    const how = v === 0 ? 'on line ' + K : v === 1 ? 'on line number ' + (N - K + 1) + ' counting from the END of the file' : 'on line ' + K + ' (hint: head and tail can be combined)';
    return { motd: 'A very long file.', hosts: { main: { name: 'arena', files: Object.assign(readme('The flag is in data.txt, ' + how + '.\nIt looks like: secret = flag{...}\nThe file has ' + N + ' lines.'), { [GH + '/data.txt']: text(L) }) } }, meta: { N, K, v } };
  },
  solve: (b) => [b.meta.v === 0 ? 'sed -n ' + b.meta.K + 'p data.txt' : b.meta.v === 1 ? 'tail -n ' + (b.meta.N - b.meta.K + 1) + ' data.txt | head -n 1' : 'head -n ' + b.meta.K + ' data.txt | tail -n 1']
});

/* ---------------- counter ---------------- */
fam.push({
  id: 'counter', title: "Exchequer's Tally", cat: 'Text', levels: 30, tier: () => 2, type: 'answer',
  blurb: 'Answer how-many questions with grep -c, wc and sort -u.',
  brief: () => 'Do not count by eye. Ask the machine: grep -c, wc -l, find | wc -l or sort -u | wc -l. Submit the number.',
  build: (c, lv) => {
    const r = c.rnd, N = 40 + lv * 12, v = lv % 4, files = {};
    let answer, ask;
    if (v === 0 || v === 1) {
      const L = []; let n = 0;
      for (let i = 0; i < N; i++) { const lvl = r.pick(['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG']); L.push(iso(r.int(0, 86399)) + ' ' + lvl + ' ' + word(r) + ' ' + r.int(1, 999)); }
      const key = v === 0 ? 'ERROR' : 'INFO';
      answer = v === 0 ? L.filter((l) => l.indexOf('ERROR') >= 0).length : L.filter((l) => l.indexOf('INFO') < 0).length;
      files['/var/log/app.log'] = text(L);
      ask = v === 0 ? 'How many lines in /var/log/app.log contain ERROR?' : 'How many lines in /var/log/app.log do NOT contain INFO?';
    } else if (v === 2) {
      let n = 0; const exts = ['csv', 'txt', 'log', 'json'];
      for (let i = 0; i < N; i++) { const e = r.pick(exts); if (e === 'csv') n++; files['/srv/inbox/' + r.pick(['mon', 'tue', 'wed', 'thu', 'fri']) + '/' + word(r) + '-' + i + '.' + e] = 'x\n'; }
      answer = n; ask = 'How many .csv files are under /srv/inbox (including sub folders)?';
    } else {
      const set = []; for (let i = 0; i < 15 + Math.floor(lv / 2); i++) set.push(ip(r));
      const L = []; for (let i = 0; i < N; i++) L.push(r.pick(set) + ' GET ' + r.pick(U.PATHS));
      answer = new Set(L.map((l) => l.split(' ')[0])).size; files['/var/log/hits.log'] = text(L);
      ask = 'How many different IP addresses appear in /var/log/hits.log?';
    }
    Object.assign(files, readme(ask + '\nSubmit just the number.'));
    return { motd: 'Count it properly.', hosts: { main: { name: 'arena', files } }, answer: String(answer), meta: { v } };
  },
  solve: (b) => [['grep -c ERROR /var/log/app.log', 'grep -vc INFO /var/log/app.log', "find /srv/inbox -name '*.csv' | wc -l", "cut -d' ' -f1 /var/log/hits.log | sort -u | wc -l"][b.meta.v]]
});

/* ---------------- grepper ---------------- */
fam.push({
  id: 'grepper', title: "Falconer's Edict", cat: 'Text', levels: 40, tier: (lv) => (lv <= 20 ? 2 : 3), type: 'flag',
  blurb: 'Search across many log files. Learn -r, -i, -v and -w by need.',
  brief: (lv) => 'The flag leaked into one line of the logs under /var/log/svc. The README describes the line. ' + ['Plain grep -r will do.', 'Case will not match unless you ask for -i.', 'Chain two greps: keep one pattern, drop another with -v.', 'Whole words only: -w saves you from lookalikes.'][lv % 4],
  build: (c, lv) => {
    const r = c.rnd, v = lv % 4, nf = 3 + Math.floor(lv / 5), files = {}, names = uniqWords(r, nf);
    const target = r.int(0, nf - 1); let desc;
    names.forEach((nm, i) => {
      const L = [];
      for (let k = 0; k < 60 + lv * 3; k++) {
        if (v === 0) L.push(noiseLine(r));
        else if (v === 1) L.push(r.int(0, 5) === 0 ? iso(r.int(0, 86399)) + ' WARN ' + r.pick(['Leaked', 'LEAKED', 'leaked']) + ' cache entry ' + r.int(1, 999) : r.int(0, 9) === 0 ? iso(r.int(0, 86399)) + ' INFO token=redacted' : noiseLine(r));
        else if (v === 2) L.push(r.int(0, 4) === 0 ? iso(r.int(0, 86399)) + ' ERROR upstream timeout after ' + r.int(1, 30) + 's' : noiseLine(r));
        else L.push(r.int(0, 6) === 0 ? iso(r.int(0, 86399)) + ' INFO ' + r.pick(['monkey', 'keystone', 'turkey', 'keyboard']) + '=' + r.hex(8) : iso(r.int(0, 86399)) + ' INFO worker processed job ' + r.int(100, 9999));
      }
      if (i === target) {
        const at = r.int(5, L.length - 5);
        L[at] = v === 0 ? iso(r.int(0, 86399)) + ' LEAK token=' + c.flag : v === 1 ? iso(r.int(0, 86399)) + ' WARN leaked token=' + c.flag : v === 2 ? iso(r.int(0, 86399)) + ' ERROR bad key detail=' + c.flag : iso(r.int(0, 86399)) + ' INFO key=' + c.flag;
      }
      files['/var/log/svc/' + nm + '.log'] = text(L);
    });
    desc = ['a line containing the word LEAK', 'a line that says leaked (in any capitalisation) and also contains token=', 'an ERROR line that is not a timeout', 'a line with the whole word key (not monkey, keystone or turkey)'][v];
    Object.assign(files, readme('The flag is in ' + desc + ' in one of the files in /var/log/svc.'));
    return { motd: 'Many logs. One leak.', hosts: { main: { name: 'arena', files } }, meta: { v } };
  },
  solve: (b) => [['grep -r LEAK /var/log/svc', 'grep -ri leaked /var/log/svc | grep token', 'grep -r ERROR /var/log/svc | grep -v timeout', 'grep -rw key /var/log/svc'][b.meta.v]]
});

/* ---------------- regex ---------------- */
const KINDS = [
  { name: 'IPv4 address', gen: (r) => pubip(r), dec: (r) => [r.int(11, 99) + '.' + r.int(1, 99) + '.' + r.int(1, 99), r.int(256, 399) + '.' + r.int(1, 99) + '.' + r.int(1, 99) + '.' + r.int(1, 99), 'x.' + r.int(1, 99) + '.' + r.int(1, 99) + '.' + r.int(1, 99)], re: '\\b((25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\\.){3}(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\\b' },
  { name: 'email address', gen: (r) => word(r) + '.' + word(r) + '@' + word(r) + '.' + r.pick(['com', 'org', 'io', 'net']), dec: (r) => [word(r) + '@localhost', '@' + word(r) + '.com', word(r) + '.' + word(r) + '.com', word(r) + '@' + word(r)], re: '\\b[a-z0-9._-]+@[a-z0-9-]+\\.[a-z]{2,}\\b' },
  { name: 'MAC address', gen: (r) => [0, 1, 2, 3, 4, 5].map(() => r.hex(2)).join(':'), dec: (r) => [[0, 1, 2, 3, 4].map(() => r.hex(2)).join(':'), 'zz:' + [0, 1, 2, 3, 4].map(() => r.hex(2)).join(':'), [0, 1, 2, 3, 4, 5].map(() => r.hex(2)).join('-')], re: '\\b([0-9a-f]{2}:){5}[0-9a-f]{2}\\b' },
  { name: 'UUID', gen: (r) => [r.hex(8), r.hex(4), r.hex(4), r.hex(4), r.hex(12)].join('-'), dec: (r) => [[r.hex(8), r.hex(4), r.hex(4), r.hex(12)].join('-'), [r.hex(7), r.hex(4), r.hex(4), r.hex(4), r.hex(12)].join('-'), [r.hex(8), r.hex(4), r.hex(4), r.hex(4), r.hex(13)].join('-')], re: '\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b' },
  { name: 'calendar date (YYYY-MM-DD)', gen: (r) => '20' + r.int(30, 49) + '-' + pad(r.int(1, 12)) + '-' + pad(r.int(1, 28)), dec: (r) => ['20' + r.int(30, 49) + '-13-' + pad(r.int(10, 28)), '17-04-20' + r.int(30, 49), '20' + r.int(30, 49) + '/' + pad(r.int(1, 12)) + '/' + pad(r.int(1, 28))], re: '\\b20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\\b' },
  { name: 'MD5 hash', gen: (r) => r.hex(32), dec: (r) => [r.hex(31), r.hex(33), r.hex(30) + 'zz'], re: '\\b[0-9a-f]{32}\\b' },
  { name: 'SHA-1 hash', gen: (r) => r.hex(40), dec: (r) => [r.hex(39), r.hex(41), r.hex(32)], re: '\\b[0-9a-f]{40}\\b' }
];
fam.push({
  id: 'regex', title: "Archmage's Grimoire", cat: 'Text', levels: 40, tier: (lv) => (lv <= 12 ? 2 : lv <= 28 ? 3 : 4), type: 'answer',
  blurb: 'Describe shapes of text with regular expressions and catch only the real one.',
  brief: () => 'A noisy dump contains exactly one VALID value of the requested kind, plus many lookalikes. A loose pattern catches the fakes too. Write a pattern that describes the real shape, extract it with grep -Eo and submit it.',
  build: (c, lv) => {
    const r = c.rnd, K = KINDS[(lv - 1) % KINDS.length], real = K.gen(r), L = [];
    const nd = 4 + Math.floor(lv / 3), N = 150 + lv * 5;
    for (let i = 0; i < N; i++) L.push(noiseLine(r));
    const slots = r.shuffle([...Array(N).keys()]).slice(0, nd + 1);
    const decs = []; for (let i = 0; i < nd; i++) decs.push(r.pick(K.dec(r)));
    slots.forEach((s, i) => { L[s] += ' ref=' + (i === 0 ? real : decs[i - 1]); });
    return { motd: 'Needle, haystack, and a lot of fake needles.', hosts: { main: { name: 'arena', files: Object.assign(readme('Find the one valid ' + K.name + ' in dump.txt.\nSubmit it exactly as written.'), { [GH + '/dump.txt']: text(L) }) } }, answer: real, meta: { re: K.re } };
  },
  solve: (b) => ["grep -Eo '" + b.meta.re + "' dump.txt"]
});

/* ---------------- ranker ---------------- */
fam.push({
  id: 'ranker', title: "Court Census", cat: 'Logs', levels: 30, tier: (lv) => (lv <= 15 ? 2 : 3), type: 'answer',
  blurb: 'Rank values by how often they occur: the cut, sort, uniq pattern.',
  brief: (lv) => 'The log has four columns: ip, user, path, status. Work out which value in the column the README names is the ' + (lv <= 10 ? 'most' : lv <= 20 ? '2nd most' : '3rd most') + ' frequent. Submit that value.',
  build: (c, lv) => {
    const r = c.rnd, K = 1 + Math.floor((lv - 1) / 10), col = 1 + (lv % 4), pools = [null, () => ip(r), () => r.pick(NAMES), () => r.pick(U.PATHS), () => r.pick(['200', '301', '302', '401', '403', '404', '500', '503'])];
    const vals = new Set(); while (vals.size < 7) vals.add(pools[col]());
    const V = [...vals]; const base = 10 + Math.floor(lv / 3), counts = V.map((_, i) => 6 + (V.length - i) * 7 + base);
    const L = [];
    V.forEach((v, i) => { for (let k = 0; k < counts[i]; k++) { const row = [ip(r), r.pick(NAMES), r.pick(U.PATHS), r.pick(['200', '404', '500'])]; row[col - 1] = v; L.push(row.join(' ')); } });
    const colName = ['', 'ip', 'user', 'path', 'status'][col];
    return { motd: 'Which one is most common?', hosts: { main: { name: 'arena', files: Object.assign(readme('Columns: ip user path status (separated by spaces).\nFind the ' + (K === 1 ? 'most' : K === 2 ? '2nd most' : '3rd most') + ' frequent value in the ' + colName + ' column of /var/log/traffic.log.'), { '/var/log/traffic.log': text(r.shuffle(L)) }) } }, answer: V[K - 1], meta: { col, K } };
  },
  solve: (b) => ["cut -d' ' -f" + b.meta.col + ' /var/log/traffic.log | sort | uniq -c | sort -nr | head -n ' + b.meta.K + ' | tail -n 1']
});

/* ---------------- columns ---------------- */
const DEPTS = ['sales', 'eng', 'ops', 'legal', 'hr'], CITIES = ['lahore', 'oslo', 'lima', 'cairo', 'tokyo', 'quito', 'turin', 'accra'];
fam.push({
  id: 'columns', title: "Loom of the Weavers", cat: 'Text', levels: 40, tier: (lv) => (lv <= 20 ? 2 : 3), type: 'answer',
  blurb: 'Treat text files like tables: cut, awk and numeric sort.',
  brief: () => 'staff.csv has the columns id,name,dept,salary,city. Answer the question in the README using cut, awk, grep and sort. Submit just the value.',
  build: (c, lv) => {
    const r = c.rnd, N = 20 + lv * 2, names = uniqWords(r, N), rows = [];
    for (let i = 0; i < N; i++) rows.push({ id: 100 + i, name: names[i], dept: r.pick(DEPTS), salary: r.int(30, 150) * 1000 + r.int(0, 9) * 100 + i, city: r.pick(CITIES) });
    const v = lv % 4, pick = r.pick(rows), dept = r.pick(DEPTS); let ask, ans;
    if (v === 0) { ask = 'In which city does ' + pick.name + ' work?'; ans = pick.city; }
    else if (v === 1) { ask = 'What is the salary of the employee with id ' + pick.id + '?'; ans = String(pick.salary); }
    else if (v === 2) { const d = rows.filter((x) => x.dept === dept).sort((a, b) => b.salary - a.salary)[0]; ask = 'Who is the highest paid employee in the ' + dept + ' department? Give the name.'; ans = d.name; }
    else { ask = 'What is the total salary of the ' + dept + ' department?'; ans = String(rows.filter((x) => x.dept === dept).reduce((s, x) => s + x.salary, 0)); }
    const csv = rows.map((x) => [x.id, x.name, x.dept, x.salary, x.city].join(','));
    return { motd: 'A table in a text file.', hosts: { main: { name: 'arena', files: Object.assign(readme(ask), { [GH + '/staff.csv']: text(csv) }) } }, answer: ans, meta: { v, pick, dept } };
  },
  solve: (b) => [['grep ' + b.meta.pick.name + ' staff.csv | cut -d, -f5', "awk -F, '$1==" + b.meta.pick.id + " {print $4}' staff.csv", 'grep ,' + b.meta.dept + ', staff.csv | sort -t, -k4 -nr | head -n 1 | cut -d, -f2', 'grep ,' + b.meta.dept + ", staff.csv | awk -F, '{s+=$4} END {print s}'"][b.meta.v]]
});

/* ---------------- sedlab ---------------- */
fam.push({
  id: 'sedlab', title: "Chancellor's Amendments", cat: 'Text', levels: 25, tier: () => 3, type: 'flag',
  blurb: 'Strip junk out of text with sed substitutions.',
  brief: (lv) => 'msg.txt is the flag with junk characters sprinkled through it. The junk is listed in the README. Remove each kind with sed s/junk//g. ' + (lv > 6 ? 'More than one kind this time. Pipe sed into sed.' : ''),
  build: (c, lv) => {
    const r = c.rnd, L = 1 + Math.floor((lv - 1) / 6), toks = r.shuffle(['#', '@@', '~~', 'XQ', '%%', '__']).slice(0, L);
    let t = c.flag.split('');
    toks.forEach((tk) => { for (let i = 0; i < 4 + L; i++) t.splice(r.int(1, t.length - 1), 0, tk); });
    return { motd: 'The flag is in there somewhere, wearing a disguise.', hosts: { main: { name: 'arena', files: Object.assign(readme('msg.txt contains the flag with this junk mixed in: ' + toks.join('   ') + '\nRemove the junk.'), { [GH + '/msg.txt']: t.join('') + '\n' }) } }, meta: { toks } };
  },
  solve: (b) => ['cat msg.txt' + b.meta.toks.map((t) => " | sed 's/" + t + "//g'").join('')]
});

module.exports = fam;
