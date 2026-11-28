'use strict';
/*
 * A pretend shell. It never runs real commands: every command below is plain JavaScript
 * working on an in-memory filesystem that is rebuilt for each player. Nothing here touches
 * the real machine, the network, or the process list.
 */

const crypto = require('crypto');

const LIMITS = { history: 60, cmd: 400, out: 8000, loop: 500, segs: 8, pattern: 140 };

/* ---------- filesystem ---------- */
function defaultOwner(p) {
  if (p.indexOf('/home/') === 0) return p.split('/')[2] || 'root';
  if (p === '/tmp' || p.indexOf('/tmp/') === 0) return 'guest';
  return 'root';
}
function makeFS(spec) {
  const fs = { '/': { t: 'd', m: 755, o: 'root' }, '/tmp': { t: 'd', m: 777, o: 'guest' } };
  const ensureDir = (p) => {
    const parts = p.split('/').filter(Boolean); let cur = '';
    parts.forEach((x) => { cur += '/' + x; if (!fs[cur]) fs[cur] = { t: 'd', m: cur === '/root' ? 700 : 755, o: defaultOwner(cur) }; });
  };
  Object.keys(spec || {}).forEach((k) => {
    const v = spec[k];
    if (k.endsWith('/')) {
      const p = k.replace(/\/+$/, '') || '/'; ensureDir(p);
      if (v && typeof v === 'object') Object.assign(fs[p], { m: v.m != null ? v.m : fs[p].m, o: v.o || fs[p].o });
      return;
    }
    const dir = k.slice(0, k.lastIndexOf('/')) || '/'; ensureDir(dir);
    const node = typeof v === 'string' ? { c: v } : v;
    fs[k] = { t: 'f', m: node.m != null ? node.m : 644, o: node.o || defaultOwner(k), c: node.c };
  });
  return fs;
}
function bits(m) { return parseInt(String(m), 8); }
function modeStr(n) {
  const b = bits(n.m); let s = n.t === 'd' ? 'd' : '-';
  [[6, 0o4000, 'x'], [3, 0o2000, 'x'], [0, 0o1000, 'x']].forEach((g, i) => {
    const r = (b >> g[0]) & 7;
    s += (r & 4 ? 'r' : '-') + (r & 2 ? 'w' : '-');
    const x = r & 1;
    s += i === 0 && (b & 0o4000) ? (x ? 's' : 'S') : (x ? 'x' : '-');
  });
  return s;
}
function pbits(node, st) { return st.user === 'root' ? 7 : (bits(node.m) >> (node.o === st.user ? 6 : 0)) & 7; }

/* ---------- parsing helpers ---------- */
function tokens(s) {
  const t = []; let cur = '', q = '', has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = ''; else cur += c; }
    else if (c === '\\' && i + 1 < s.length) { cur += s[++i]; has = true; }
    else if (c === '"' || c === "'") { q = c; has = true; }
    else if (/\s/.test(c)) { if (cur || has) { t.push(cur); cur = ''; has = false; } }
    else cur += c;
  }
  if (cur || has) t.push(cur);
  return t;
}
function splitTop(line, seps) {
  // split on any of the separator strings, outside quotes, ignoring escaped ones
  const parts = []; let cur = '', q = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = ''; cur += c; continue; }
    if (c === '\\') { cur += c + (line[i + 1] || ''); i++; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    let hit = null;
    for (const sp of seps) if (line.startsWith(sp, i)) { hit = sp; break; }
    if (hit) { parts.push(cur); cur = ''; i += hit.length - 1; } else cur += c;
  }
  parts.push(cur); return parts;
}
function safeRegex(pat, flags) {
  if (pat.length > LIMITS.pattern) throw new Error('pattern too long');
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pat) || /(\.\*){3,}/.test(pat)) throw new Error('pattern too complex');
  return new RegExp(pat, flags || '');
}
function lines(t) { const l = String(t).split('\n'); if (l[l.length - 1] === '') l.pop(); return l; }
function globRe(g) { return new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); }

/* ---------- session ---------- */
function createSession(chal, ctx) {
  const built = chal.build(ctx);
  const hosts = {};
  Object.keys(built.hosts).forEach((k) => {
    const h = built.hosts[k];
    hosts[k] = { name: h.name || k, fs: makeFS(h.files), auth: h.auth || {}, sudo: h.sudo || null, bins: h.bins || {}, start: h.start || { user: 'guest', cwd: '/home/guest' } };
  });
  const first = Object.keys(hosts)[0], h0 = hosts[first];
  return { chal, hosts, host: first, user: h0.start.user, cwd: h0.start.cwd, stack: [], motd: built.motd || '', nextPass: null, site: ctx.site || null };
}
function cur(st) { return st.hosts[st.host]; }
function resolve(st, p) {
  if (!p) return st.cwd;
  const home = st.user === 'root' ? '/root' : '/home/' + st.user;
  if (p === '~') p = home; else if (p.indexOf('~/') === 0) p = home + p.slice(1);
  const parts = (p[0] === '/' ? p : st.cwd + '/' + p).split('/'), out = [];
  parts.forEach((x) => { if (!x || x === '.') return; if (x === '..') out.pop(); else out.push(x); });
  return '/' + out.join('/');
}
function traverseOK(st, p) {
  const fs = cur(st).fs; if (st.user === 'root') return true;
  const parts = p.split('/').filter(Boolean); let c = '';
  for (let i = 0; i < parts.length - 1; i++) { c += '/' + parts[i]; const n = fs[c]; if (n && !(pbits(n, st) & 1)) return false; }
  return true;
}
function children(st, dir) {
  const fs = cur(st).fs, pre = dir === '/' ? '/' : dir + '/', names = [];
  Object.keys(fs).forEach((k) => { if (k !== dir && k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0) names.push(k.slice(pre.length)); });
  return names.sort();
}
function pretty(st, p) {
  const home = st.user === 'root' ? '/root' : '/home/' + st.user;
  return p === home ? '~' : p.indexOf(home + '/') === 0 ? '~' + p.slice(home.length) : p;
}
function promptOf(st) { return st.user + '@' + cur(st).name + ':' + pretty(st, st.cwd) + (st.user === 'root' ? '#' : '$'); }

function readNode(st, name, cmd) {
  const p = resolve(st, name), n = cur(st).fs[p];
  if (!n) return { e: cmd + ': ' + name + ': No such file or directory' };
  if (n.t === 'd') return { e: cmd + ': ' + name + ': Is a directory' };
  if (!traverseOK(st, p) || !(pbits(n, st) & 4)) return { e: cmd + ': ' + name + ': Permission denied' };
  return { c: n.c, p };
}
function inputOf(st, args, stdin, cmd) {
  const files = args.filter((a) => a[0] !== '-' || a === '-');
  if (!files.length) return { t: stdin == null ? '' : stdin };
  let t = '';
  for (const f of files) { const r = readNode(st, f, cmd); if (r.e) return { err: r.e }; t += r.c; }
  return { t };
}
function nopt(a, d) { const i = a.indexOf('-n'); return i >= 0 && a[i + 1] ? parseInt(a[i + 1], 10) : d; }
function stripN(a) { return a.filter((x, i) => !(x === '-n' || a[i - 1] === '-n')); }
function expandSet(s) {
  s = s.replace(/\[:upper:\]/g, 'A-Z').replace(/\[:lower:\]/g, 'a-z').replace(/\[:digit:\]/g, '0-9');
  let o = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i + 1] === '-' && i + 2 < s.length) { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) o += String.fromCharCode(c); i += 2; } else o += s[i];
  }
  return o;
}


const MAN = {
  ls: 'ls [-a] [-l] [PATH]  list files. -a shows hidden files (names starting with a dot). -l shows permissions, owner and size.',
  cd: 'cd [PATH]  move to a folder. cd .. goes up, cd ~ goes home, cd - is not supported here.',
  pwd: 'pwd  print the folder you are in.',
  cat: 'cat FILE...  print a file. With no file it copies its input, which is how pipes work.',
  head: 'head -n N [FILE]  show the first N lines (default 10).',
  tail: 'tail -n N [FILE]  show the last N lines (default 10).',
  wc: 'wc -l|-w|-c [FILE]  count lines, words or characters.',
  grep: 'grep [-i -v -n -c -o -w -r -E -A N -B N] PATTERN [FILE...]  print lines that match. -i ignore case, -v invert, -c count, -o only the match, -w whole words, -r search folders, -E extended regex. -A N shows N lines after each match, -B N before.',
  sort: 'sort [-n -r -u] [-t SEP] [-k N]  sort lines. -n numeric, -r reverse, -u unique, -t sets the field separator, -k picks the field.',
  uniq: 'uniq [-c]  collapse neighbouring duplicate lines. -c counts them. Sort first.',
  cut: "cut -d SEP -f N[,M]  pick fields from each line. Example: cut -d: -f1 /etc/passwd",
  tr: "tr SET1 SET2  swap characters. tr -d SET deletes them. Ranges work: tr 'a-z' 'A-Z'. Use '\n' for a newline.",
  rev: 'rev  reverse each line of text.',
  sed: "sed 's/old/new/g' [FILE]  replace text. sed -n '5p' prints line 5, sed -n '2,4p' prints lines 2 to 4.",
  awk: "awk -F SEP '{print $1, $3}'  pick fields. Also: '/pat/ {print $2}', '$3==0 {print $1}', '{s+=$2} END {print s}'.",
  find: 'find PATH [-name GLOB] [-type f|d] [-user U] [-perm MODE|-MODE] [-exec CMD {} ;]  search the filesystem. -perm -4000 finds setuid files.',
  base64: 'base64 [-d]  encode, or decode with -d.',
  xxd: 'xxd -p  text to hex. xxd -r -p  hex back to text.',
  chmod: 'chmod MODE FILE  change permissions. Numbers: 6=rw, 4=r, 7=rwx (owner, group, others). Letters: chmod u+r FILE.',
  sudo: 'sudo -l  list what you may run as root.  sudo COMMAND  run it as root if allowed.',
  ssh: 'ssh [-i KEYFILE] user@host  log in to another machine. sshpass -p PASSWORD ssh user@host uses a password. exit comes back.',
  caesar: 'caesar N  shift letters forward by N (a training tool, not a real command).',
  sha256sum: 'sha256sum [FILE]  print the SHA-256 hash of a file or of input.',
  md5sum: 'md5sum [FILE]  print the MD5 hash of a file or of input.',
  seq: 'seq A B  print the numbers A to B.',
  echo: 'echo TEXT  print text.',
  touch: 'touch FILE  create an empty file.', mkdir: 'mkdir DIR  create a folder.', file: 'file FILE  guess what kind of file it is.',
  man: 'man COMMAND  show a short manual for a command.'
};

/* ---------- commands: (args, stdin, st) => {o, e} ---------- */
const C = {
  help() {
    return { o: 'Available: ls cd pwd cat head tail wc echo grep sort uniq cut tr rev sed awk find base64 xxd file chmod touch mkdir\n' +
      'sha256sum md5sum seq caesar sudo ssh sshpass whoami id hostname uname date man clear exit help\n' +
      'Type man COMMAND for a short manual, for example: man grep\n' +
      'You can use pipes (|), > and >> to files, < for input, $(command) substitution, and one-line loops:\n' +
      '  for i in {1..5}; do echo $i; done' };
  },
  man(a) { if (!a[0]) return { e: 'man: which command? try: man grep' }; return MAN[a[0]] ? { o: MAN[a[0]] } : { e: 'No manual entry for ' + a[0] }; },
  rootrank(a, s, st) { const sf = st.site && st.site[4]; return { o: sf ? 'signal received.\nencoded: ' + Buffer.from(sf).toString('base64') + '\n(you know what to do with it)' : 'rootrank: nothing here' }; },
  pwd(a, s, st) { return { o: st.cwd }; },
  whoami(a, s, st) { return { o: st.user }; },
  id(a, s, st) { return { o: st.user === 'root' ? 'uid=0(root) gid=0(root) groups=0(root)' : 'uid=1000(' + st.user + ') gid=1000(' + st.user + ') groups=1000(' + st.user + ')' }; },
  hostname(a, s, st) { return { o: cur(st).name }; },
  uname(a) { return { o: a.indexOf('-a') >= 0 ? 'Linux arena 6.1.0-rootrank #1 SMP x86_64 GNU/Linux' : 'Linux' }; },
  date() { return { o: 'Fri Nov 27 09:00:00 UTC 2026' }; },
  clear() { return { o: '', clear: true }; },
  echo(a) { let nl = true; if (a[0] === '-n') { nl = false; a = a.slice(1); } return { o: a.join(' '), nonl: !nl }; },
  seq(a) { const n = a.map(Number); const lo = n.length > 1 ? n[0] : 1, hi = n.length > 1 ? n[1] : n[0]; const o = []; for (let i = lo; i <= hi && o.length < 1000; i++) o.push(i); return { o: o.join('\n') }; },
  ls(a, s, st) {
    const flags = a.filter((x) => x[0] === '-').join(''), all = flags.indexOf('a') >= 0, long = flags.indexOf('l') >= 0;
    const paths = a.filter((x) => x[0] !== '-'); if (!paths.length) paths.push('.');
    const fs = cur(st).fs, rows = [], errs = [];
    paths.forEach((pa) => {
      const p = resolve(st, pa), n = fs[p];
      if (!n) { errs.push("ls: cannot access '" + pa + "': No such file or directory"); return; }
      let names;
      if (n.t === 'f') names = [p];
      else {
        if (!traverseOK(st, p + '/x') || !(pbits(n, st) & 4)) { errs.push("ls: cannot open directory '" + pa + "': Permission denied"); return; }
        names = children(st, p).map((x) => (p === '/' ? '' : p) + '/' + x);
      }
      if (!all) names = names.filter((x) => x.split('/').pop()[0] !== '.');
      else if (n.t === 'd') names = [p + '/.', p + '/..'].concat(names);
      if (paths.length > 1 && n.t === 'd') rows.push(pa + ':');
      names.forEach((x) => {
        const base = x.split('/').pop(), nd = fs[x] || { t: 'd', m: 755, o: 'root', c: '' };
        rows.push(long ? modeStr(nd) + ' 1 ' + nd.o + ' ' + nd.o + ' ' + ('     ' + (nd.t === 'f' ? nd.c.length : 4096)).slice(-5) + ' Nov 26 ' + base : base);
      });
    });
    return { o: long || paths.length > 1 ? rows.join('\n') : rows.join('  '), e: errs.join('\n') };
  },
  cd(a, s, st) {
    const p = resolve(st, a[0] || '~'), n = cur(st).fs[p];
    if (!n) return { e: 'cd: ' + a[0] + ': No such file or directory' };
    if (n.t !== 'd') return { e: 'cd: ' + a[0] + ': Not a directory' };
    if (!traverseOK(st, p + '/x') || !(pbits(n, st) & 1)) return { e: 'cd: ' + a[0] + ': Permission denied' };
    st.cwd = p; return { o: '' };
  },
  cat(a, s, st) { const r = inputOf(st, a, s, 'cat'); return r.err ? { e: r.err } : { o: r.t.replace(/\n$/, '') }; },
  head(a, s, st) { const r = inputOf(st, stripN(a), s, 'head'); return r.err ? { e: r.err } : { o: lines(r.t).slice(0, nopt(a, 10)).join('\n') }; },
  tail(a, s, st) { const r = inputOf(st, stripN(a), s, 'tail'); return r.err ? { e: r.err } : { o: lines(r.t).slice(-nopt(a, 10)).join('\n') }; },
  tac(a, s, st) { const r = inputOf(st, a, s, 'tac'); return r.err ? { e: r.err } : { o: lines(r.t).reverse().join('\n') }; },
  rev(a, s, st) { const r = inputOf(st, a, s, 'rev'); return r.err ? { e: r.err } : { o: lines(r.t).map((x) => x.split('').reverse().join('')).join('\n') }; },
  wc(a, s, st) {
    const r = inputOf(st, a, s, 'wc'); if (r.err) return { e: r.err };
    const n = lines(r.t).length;
    if (a.indexOf('-l') >= 0) return { o: String(n) };
    if (a.indexOf('-w') >= 0) return { o: String(r.t.split(/\s+/).filter(Boolean).length) };
    if (a.indexOf('-c') >= 0) return { o: String(r.t.length) };
    return { o: n + ' ' + r.t.split(/\s+/).filter(Boolean).length + ' ' + r.t.length };
  },
  sort(a, s, st) {
    let sep = null, key = null; const rest = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i].indexOf('-t') === 0 && a[i].length > 2 && a[i] !== '-t') sep = a[i].slice(2);
      else if (a[i] === '-t') sep = a[++i];
      else if (/^-k\d/.test(a[i])) key = parseInt(a[i].slice(2), 10);
      else if (a[i] === '-k') key = parseInt(a[++i], 10);
      else rest.push(a[i]);
    }
    const r = inputOf(st, rest, s, 'sort'); if (r.err) return { e: r.err };
    const fl = rest.filter((x) => x[0] === '-').join(''), num = fl.indexOf('n') >= 0, rev = fl.indexOf('r') >= 0, uq = fl.indexOf('u') >= 0;
    const kf = (x) => { if (key == null) return x; const p = sep == null ? x.trim().split(/\s+/) : x.split(sep); return p[key - 1] == null ? '' : p[key - 1]; };
    let l = lines(r.t);
    l.sort((x, y) => { const a1 = kf(x), b1 = kf(y); return num ? (parseFloat(a1) || 0) - (parseFloat(b1) || 0) : (a1 < b1 ? -1 : a1 > b1 ? 1 : 0); });
    if (uq) l = l.filter((x, i) => i === 0 || x !== l[i - 1]);
    if (rev) l.reverse(); return { o: l.join('\n') };
  },
  uniq(a, s, st) {
    const r = inputOf(st, a, s, 'uniq'); if (r.err) return { e: r.err };
    const res = []; let prev = null, n = 0;
    lines(r.t).forEach((x) => { if (x === prev) n++; else { if (prev !== null) res.push([prev, n]); prev = x; n = 1; } });
    if (prev !== null) res.push([prev, n]);
    return { o: res.map((p) => (a.indexOf('-c') >= 0 ? ('      ' + p[1]).slice(-7) + ' ' + p[0] : p[0])).join('\n') };
  },
  cut(a, s, st) {
    let d = '\t', f = '1'; const files = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i].indexOf('-d') === 0) { if (a[i].length > 2) d = a[i].slice(2); else { d = a[i + 1]; i++; } }
      else if (a[i].indexOf('-f') === 0) { if (a[i].length > 2) f = a[i].slice(2); else { f = a[i + 1]; i++; } }
      else files.push(a[i]);
    }
    const r = inputOf(st, files, s, 'cut'); if (r.err) return { e: r.err };
    const idx = String(f).split(',').map((x) => parseInt(x, 10) - 1);
    return { o: lines(r.t).map((x) => { const p = x.split(d); return idx.map((i) => p[i] == null ? '' : p[i]).join(d); }).join('\n') };
  },
  tr(a, s) {
    const del = a[0] === '-d', args = a.filter((x) => x[0] !== '-' || x.length === 1);
    const nl = (x) => x.replace(/\\n/g, '\n');
    const s1 = expandSet(nl(args[0] || '')), s2 = expandSet(nl(args[1] || '')); let o = '';
    for (const ch of String(s || '')) {
      const i = s1.indexOf(ch);
      if (i < 0) o += ch; else if (del) continue; else o += s2.length ? s2[Math.min(i, s2.length - 1)] : ch;
    }
    return { o: del ? o : o.replace(/\n$/, '') };
  },
  base64(a, s, st) {
    const r = inputOf(st, a, s, 'base64'); if (r.err) return { e: r.err };
    if (a.indexOf('-d') >= 0 || a.indexOf('--decode') >= 0) {
      const t = r.t.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t)) return { e: 'base64: invalid input' };
      return { o: Buffer.from(t, 'base64').toString('utf8') };
    }
    const enc = Buffer.from(r.t.replace(/\n$/, ''), 'utf8').toString('base64');
    return { o: enc.replace(/(.{76})/g, '$1\n').replace(/\n$/, '') };
  },
  xxd(a, s, st) {
    const r = inputOf(st, a, s, 'xxd'); if (r.err) return { e: r.err };
    if (a.indexOf('-r') >= 0) {
      const t = r.t.replace(/\s+/g, '');
      if (!/^([0-9a-fA-F]{2})*$/.test(t)) return { e: 'xxd: invalid hex input' };
      return { o: Buffer.from(t, 'hex').toString('utf8') };
    }
    const hex = Buffer.from(r.t.replace(/\n$/, ''), 'utf8').toString('hex');
    return { o: a.indexOf('-p') >= 0 ? hex.replace(/(.{60})/g, '$1\n').replace(/\n$/, '') : hex };
  },
  caesar(a, s, st) {
    const k = ((parseInt(a[0], 10) || 0) % 26 + 26) % 26, r = inputOf(st, a.slice(1), s, 'caesar'); if (r.err) return { e: r.err };
    return { o: r.t.replace(/\n$/, '').replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + k) % 26 + b); }) };
  },
  sha256sum(a, s, st) { return hashCmd('sha256', 'sha256sum', a, s, st); },
  md5sum(a, s, st) { return hashCmd('md5', 'md5sum', a, s, st); },
  file(a, s, st) {
    const o = a.map((f) => { const n = cur(st).fs[resolve(st, f)]; return f + ': ' + (!n ? 'cannot open (No such file or directory)' : n.t === 'd' ? 'directory' : /^[\x20-\x7e\n\t]*$/.test(n.c) ? 'ASCII text' : 'data'); });
    return { o: o.join('\n') };
  },
  grep(a, s, st) {
    let ctxA = 0, ctxB = 0;
    a = a.slice();
    for (let i = 0; i < a.length; i++) { const m = /^-([ABC])(\d*)$/.exec(a[i]); if (m) { let n = m[2] ? +m[2] : NaN; a.splice(i, 1); if (isNaN(n)) { n = parseInt(a[i], 10) || 0; a.splice(i, 1); } n = Math.min(n, 20); if (m[1] !== 'B') ctxA = n; if (m[1] !== 'A') ctxB = n; i--; } }
    const fl = a.filter((x) => x[0] === '-' && x.length > 1).join(''), rest = a.filter((x) => !(x[0] === '-' && x.length > 1));
    const pat = rest.shift(); if (pat === undefined) return { e: 'Usage: grep [-ivnrcoE] pattern [file...]' };
    const ic = fl.indexOf('i') >= 0, nl = fl.indexOf('n') >= 0, inv = fl.indexOf('v') >= 0, rec = fl.indexOf('r') >= 0 || fl.indexOf('R') >= 0, cnt = fl.indexOf('c') >= 0, oo = fl.indexOf('o') >= 0, ww = fl.indexOf('w') >= 0;
    let re; try { re = safeRegex(ww ? '\\b(?:' + pat + ')\\b' : pat, ic ? 'i' : ''); } catch (e) { return { e: 'grep: ' + e.message }; }
    const reG = oo ? new RegExp(re.source, re.flags + 'g') : null;
    const sources = [];
    let files = rest.slice();
    if (!files.length) { if (rec) files = ['.']; else sources.push({ n: '', t: s || '' }); }
    files.forEach((f) => {
      const p = resolve(st, f), n = cur(st).fs[p];
      if (!n) { sources.push({ err: 'grep: ' + f + ': No such file or directory' }); return; }
      if (n.t === 'f') { const r = readNode(st, f, 'grep'); if (r.e) sources.push({ err: r.e }); else sources.push({ n: files.length > 1 || rec ? (rec ? p : f) : '', t: r.c }); return; }
      if (!rec) { sources.push({ err: 'grep: ' + f + ': Is a directory' }); return; }
      Object.keys(cur(st).fs).sort().forEach((k) => {
        const kn = cur(st).fs[k];
        if (kn.t === 'f' && (k + '/').indexOf(p === '/' ? '/' : p + '/') === 0 && traverseOK(st, k) && (pbits(kn, st) & 4)) sources.push({ n: k, t: kn.c });
      });
    });
    const o = [], e = [];
    sources.forEach((src) => {
      if (src.err) { e.push(src.err); return; }
      let c = 0; const LL = lines(src.t), shown = {};
      const emit = (i, sep) => { if (shown[i]) return; shown[i] = 1; o.push((src.n ? src.n + sep : '') + (nl ? (i + 1) + sep : '') + LL[i]); };
      LL.forEach((l, i) => {
        if (re.test(l) !== inv) {
          c++;
          if (cnt) return;
          const pre = (src.n ? src.n + ':' : '') + (nl ? (i + 1) + ':' : '');
          if (oo && !inv) { const m = l.match(reG); (m || []).forEach((x) => o.push(pre + x)); }
          else { for (let k = Math.max(0, i - ctxB); k < i; k++) emit(k, '-'); if (!shown[i]) { shown[i] = 1; o.push(pre + l); } for (let k = i + 1; k <= Math.min(LL.length - 1, i + ctxA); k++) emit(k, '-'); }
        }
      });
      if (cnt) o.push((src.n ? src.n + ':' : '') + c);
    });
    return { o: o.join('\n'), e: e.join('\n'), found: o.length > 0 };
  },
  sed(a, s, st) {
    const quiet = a.indexOf('-n') >= 0, rest = a.filter((x) => x !== '-n' && x !== '-E' && x !== '-e'), prog = rest.shift() || '';
    const r = inputOf(st, rest, s, 'sed'); if (r.err) return { e: r.err };
    const L = lines(r.t);
    let m = /^(\d+)(?:,(\d+))?p$/.exec(prog);
    if (m) { const lo = +m[1], hi = m[2] ? +m[2] : lo; return { o: L.slice(lo - 1, hi).join('\n') }; }
    m = /^s(.)(.*?)\1(.*?)\1([gi]*)$/.exec(prog);
    if (!m) return { e: "sed: unsupported expression (supported: s/old/new/[g|i], 5p, 2,4p)" };
    let re; try { re = safeRegex(m[2], (m[4].indexOf('g') >= 0 ? 'g' : '') + (m[4].indexOf('i') >= 0 ? 'i' : '')); } catch (e) { return { e: 'sed: ' + e.message }; }
    const out = L.map((l) => l.replace(re, m[3]));
    return { o: quiet ? '' : out.join('\n') };
  },
  awk(a, s, st) {
    let sep = /\s+/; const rest = [];
    for (let i = 0; i < a.length; i++) { if (a[i].indexOf('-F') === 0) { const v = a[i].length > 2 ? a[i].slice(2) : a[++i]; sep = v === ' ' ? /\s+/ : v; } else rest.push(a[i]); }
    const prog = rest.shift() || '';
    const split = (l) => (l.trim() === '' ? [''] : (typeof sep === 'string' ? l.split(sep) : l.trim().split(sep)));
    const sum = /^\{\s*(\w+)\s*\+=\s*\$(\d+)\s*\}\s*END\s*\{\s*print\s+\1\s*\}$/.exec(prog);
    if (sum) {
      const r0 = inputOf(st, rest, s, 'awk'); if (r0.err) return { e: r0.err };
      let t = 0; lines(r0.t).forEach((l) => { t += parseFloat(split(l)[+sum[2] - 1]) || 0; });
      return { o: String(t) };
    }
    const m = /^(?:\/(.*?)\/\s*|\$(\d+)\s*(==|!=|>=|<=|>|<)\s*("[^"]*"|[\w./-]+)\s*)?\{\s*print\s*(.*?)\s*\}$/.exec(prog);
    if (!m) return { e: "awk: unsupported program (supported: '{print $1, $3}', '/pat/ {print $2}', '$3==0 {print $1}', '{s+=$2} END {print s}')" };
    const r = inputOf(st, rest, s, 'awk'); if (r.err) return { e: r.err };
    let re = null; if (m[1]) { try { re = safeRegex(m[1]); } catch (e) { return { e: 'awk: ' + e.message }; } }
    const items = m[5] ? m[5].split(/\s*,\s*/) : ['$0'];
    const out = [];
    lines(r.t).forEach((l, n) => {
      const f = split(l);
      if (re && !re.test(l)) return;
      if (m[2]) {
        const lhs = f[+m[2] - 1] == null ? '' : f[+m[2] - 1], rhs = m[4].replace(/^"|"$/g, '');
        const num = !isNaN(parseFloat(lhs)) && !isNaN(parseFloat(rhs)), L = num ? parseFloat(lhs) : lhs, R = num ? parseFloat(rhs) : rhs;
        const ok = m[3] === '==' ? L === R : m[3] === '!=' ? L !== R : m[3] === '>' ? L > R : m[3] === '<' ? L < R : m[3] === '>=' ? L >= R : L <= R;
        if (!ok) return;
      }
      out.push(items.map((it) => {
        if (it === '$0') return l;
        if (it === '$NF') return f[f.length - 1];
        if (it === 'NR') return String(n + 1);
        if (it === 'NF') return String(f.length);
        const q = /^\$(\d+)$/.exec(it); if (q) return f[+q[1] - 1] == null ? '' : f[+q[1] - 1];
        const lit = /^"(.*)"$/.exec(it); return lit ? lit[1] : it;
      }).join(' '));
    });
    return { o: out.join('\n') };
  },
  find(a, s, st) {
    const starts = []; let i = 0;
    while (i < a.length && a[i][0] !== '-') starts.push(a[i++]);
    if (!starts.length) starts.push('.');
    let name = null, type = null, perm = null, user = null, exec = null;
    for (; i < a.length; i++) {
      if (a[i] === '-name') name = globRe(a[++i]);
      else if (a[i] === '-iname') { const g = globRe(a[++i]); name = new RegExp(g.source, 'i'); }
      else if (a[i] === '-type') type = a[++i];
      else if (a[i] === '-perm') perm = a[++i];
      else if (a[i] === '-user') user = a[++i];
      else if (a[i] === '-exec') { exec = []; i++; while (i < a.length && a[i] !== ';') exec.push(a[i++]); }
    }
    const fs = cur(st).fs, o = [], e = [];
    starts.forEach((sp) => {
      const root = resolve(st, sp);
      if (!fs[root]) { e.push("find: '" + sp + "': No such file or directory"); return; }
      const walk = (p, shown) => {
        const n = fs[p]; if (!n) return;
        let ok = true;
        if (name && !name.test(p.split('/').pop())) ok = false;
        if (type && ((type === 'f') !== (n.t === 'f'))) ok = false;
        if (user && n.o !== user) ok = false;
        if (perm) { const b = bits(n.m); if (perm[0] === '-') ok = ok && (b & parseInt(perm.slice(1), 8)) === parseInt(perm.slice(1), 8); else ok = ok && b === parseInt(perm, 8); }
        if (ok) o.push(shown);
        if (n.t === 'd') {
          if (st.user !== 'root' && !(pbits(n, st) & 4)) { e.push("find: '" + shown + "': Permission denied"); return; }
          children(st, p).forEach((c) => walk((p === '/' ? '' : p) + '/' + c, (shown === '/' ? '' : shown) + '/' + c));
        }
      };
      walk(root, sp === '.' ? '.' : sp.replace(/\/+$/, '') || '/');
    });
    if (exec) {
      const out = [];
      o.slice(0, LIMITS.loop).forEach((m) => { const r = runLine(st, exec.map((x) => (x === '{}' ? m : x)).map(quoteTok).join(' ')); if (r.out) out.push(r.out); });
      return { o: out.join('\n'), e: e.join('\n') };
    }
    return { o: o.join('\n'), e: e.join('\n') };
  },
  chmod(a, s, st) {
    if (a.length < 2) return { e: 'chmod: missing operand' };
    const mode = a[0]; let any = false; const errs = [];
    a.slice(1).forEach((f) => {
      const p = resolve(st, f), n = cur(st).fs[p];
      if (!n) { errs.push("chmod: cannot access '" + f + "': No such file or directory"); return; }
      if (st.user !== 'root' && n.o !== st.user) { errs.push("chmod: changing permissions of '" + f + "': Operation not permitted"); return; }
      if (/^[0-7]{3,4}$/.test(mode)) { n.m = parseInt(mode, 10); any = true; return; }
      const m = /^([ugoa]*)([+-=])([rwx]+)$/.exec(mode);
      if (!m) { errs.push("chmod: invalid mode: '" + mode + "'"); return; }
      const who = m[1] || 'a', v = (m[3].indexOf('r') >= 0 ? 4 : 0) + (m[3].indexOf('w') >= 0 ? 2 : 0) + (m[3].indexOf('x') >= 0 ? 1 : 0);
      let b = bits(n.m);
      [['u', 6], ['g', 3], ['o', 0]].forEach((x) => {
        if (who.indexOf('a') >= 0 || who.indexOf(x[0]) >= 0) { const cur2 = (b >> x[1]) & 7, nv = m[2] === '+' ? cur2 | v : m[2] === '-' ? cur2 & ~v : v; b = (b & ~(7 << x[1])) | (nv << x[1]); }
      });
      n.m = parseInt(b.toString(8), 10); any = true;
    });
    return { o: '', e: errs.join('\n'), found: any };
  },
  touch(a, s, st) { return writeCmd(a, st, (p) => { const fs = cur(st).fs; if (!fs[p]) fs[p] = { t: 'f', m: 644, o: st.user, c: '' }; }); },
  mkdir(a, s, st) { return writeCmd(a, st, (p) => { const fs = cur(st).fs; if (!fs[p]) fs[p] = { t: 'd', m: 755, o: st.user }; }); },
  exit(a, s, st) {
    if (!st.stack.length) return { e: 'exit: this is the only session (nothing to log out of)' };
    const prev = st.stack.pop(); st.host = prev.host; st.user = prev.user; st.cwd = prev.cwd;
    return { o: 'logout' };
  },
  sudo(a, s, st) {
    const cfg = cur(st).sudo;
    if (a[0] === '-l') {
      if (!cfg) return { e: 'Sorry, user ' + st.user + ' may not run sudo on ' + cur(st).name + '.' };
      return { o: cfg.list.join('\n') };
    }
    if (!a.length) return { e: 'usage: sudo [-l] command' };
    if (!cfg || cfg.allow.indexOf(a[0]) < 0) return { e: 'Sorry, user ' + st.user + ' is not allowed to execute \'' + a.join(' ') + '\' as root on ' + cur(st).name + '.' };
    const old = st.user; st.user = 'root';
    const r = runLine(st, a.map(quoteTok).join(' ')); st.user = old;
    return { o: r.out, e: '' };
  },
  sshpass(a, s, st) {
    const i = a.indexOf('-p'); if (i < 0 || a.length < i + 3 || a[i + 2] !== 'ssh') return { e: 'usage: sshpass -p PASSWORD ssh user@host' };
    st.nextPass = a[i + 1]; const r = C.ssh(a.slice(i + 3), s, st); st.nextPass = null; return r;
  },
  ssh(a, s, st) {
    let key = null, target = null;
    for (let i = 0; i < a.length; i++) { if (a[i] === '-i') key = a[++i]; else if (a[i][0] !== '-') target = a[i]; }
    if (!target) return { e: 'usage: ssh [-i keyfile] user@host' };
    const m = /^(?:([\w.-]+)@)?([\w.-]+)$/.exec(target); if (!m) return { e: 'ssh: invalid target' };
    const user = m[1] || st.user, hk = Object.keys(st.hosts).find((k) => st.hosts[k].name === m[2] || k === m[2]);
    if (!hk) return { e: 'ssh: Could not resolve hostname ' + m[2] + ': Name or service not known' };
    if (hk === st.host) return { e: 'ssh: you are already on ' + m[2] };
    const cfg = st.hosts[hk].auth[user]; let ok = false;
    if (cfg) {
      if (key) { const r = readNode(st, key, 'ssh'); if (r.e) return { e: r.e }; ok = !!cfg.key && r.c.indexOf(cfg.key) >= 0; }
      else if (st.nextPass != null) ok = !!cfg.pass && st.nextPass === cfg.pass;
    }
    if (!ok) return { e: user + '@' + m[2] + ': Permission denied (publickey,password).' };
    st.stack.push({ host: st.host, user: st.user, cwd: st.cwd });
    st.host = hk; st.user = user; st.cwd = user === 'root' ? '/root' : '/home/' + user;
    if (!st.hosts[hk].fs[st.cwd]) st.cwd = '/';
    return { o: 'Welcome to ' + st.hosts[hk].name + '. Logged in as ' + user + '. Type exit to go back.' };
  }
};
function hashCmd(alg, name, a, s, st) {
  const files = a.filter((x) => x[0] !== '-');
  if (!files.length) return { o: crypto.createHash(alg).update(String(s || '')).digest('hex') + '  -' };
  const o = [], e = [];
  files.forEach((f) => { const r = readNode(st, f, name); if (r.e) e.push(r.e); else o.push(crypto.createHash(alg).update(r.c).digest('hex') + '  ' + f); });
  return { o: o.join('\n'), e: e.join('\n') };
}
function writeCmd(a, st, fn) {
  const errs = [];
  a.forEach((f) => {
    const p = resolve(st, f), parent = p.slice(0, p.lastIndexOf('/')) || '/', pn = cur(st).fs[parent];
    if (!pn) { errs.push("cannot create '" + f + "': No such file or directory"); return; }
    if (st.user !== 'root' && !(pbits(pn, st) & 2)) { errs.push("cannot create '" + f + "': Permission denied"); return; }
    fn(p);
  });
  return { o: '', e: errs.join('\n') };
}
function quoteTok(x) { return /[\s"'\\;|<>$&]/.test(x) || x === '' ? "'" + x.replace(/'/g, "'\\''") + "'" : x; }

/* ---------- running ---------- */
function expandSubst(st, line, depth) {
  if (line.indexOf('$(') < 0) return line;
  if (depth > 2) return line;
  let out = '', i = 0;
  while (i < line.length) {
    if (line[i] === '$' && line[i + 1] === '(') {
      let d = 1, j = i + 2;
      while (j < line.length && d > 0) { if (line[j] === '(') d++; else if (line[j] === ')') d--; j++; }
      const inner = line.slice(i + 2, j - 1), r = runLine(st, inner, depth + 1);
      out += r.out.replace(/\s+$/, '').replace(/\n/g, ' ');
      i = j;
    } else out += line[i++];
  }
  return out;
}
function expandVars(st, s) {
  // expand $VAR outside single quotes only, like a real shell
  return s.split(/('[^']*')/).map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/\$\{?(\w+)\}?/g, (m, k) => (k in st.vars ? st.vars[k] : k === 'USER' ? st.user : k === 'HOME' ? (st.user === 'root' ? '/root' : '/home/' + st.user) : k === 'PWD' ? st.cwd : '')))).join('');
}
function trimOut(t) { return t.length > LIMITS.out ? t.slice(0, LIMITS.out) + '\n...(output truncated)' : t; }

function runPipeline(st, seg, depth, stdin0) {
  seg = seg.trim(); if (!seg) return { out: '' };
  let drop = false;
  if (/\s2>\s*\/dev\/null/.test(seg)) { drop = true; seg = seg.replace(/\s*2>\s*\/dev\/null/g, ''); }
  seg = seg.replace(/\s*2>&1/g, '');
  const parts = splitTop(seg, ['|']);
  if (parts.length > LIMITS.segs) return { out: '', err: 'too many pipe stages' };
  let stdin = stdin0 == null ? null : stdin0, last = { o: '' }; const errs = [];
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i].trim(), redirOut = null, append = false, redirIn = null;
    let m = /\s(>>?)\s*(\S+)\s*$/.exec(part);
    if (m && (part.slice(0, m.index).split(/["']/).length - 1) % 2 === 1) m = null;
    if (m && i === parts.length - 1) { redirOut = m[2]; append = m[1] === '>>'; part = part.slice(0, m.index); }
    m = /\s<\s*(\S+)\s*$/.exec(part);
    if (m) { redirIn = m[1]; part = part.slice(0, m.index); }
    part = expandVars(st, expandSubst(st, part, depth));
    const t = tokens(part); if (!t.length) return { out: '', err: 'syntax error near unexpected token' };
    const cmd = t.shift(); let fn = C[cmd];
    if (redirIn) { const r = readNode(st, redirIn, 'sh'); if (r.e) { errs.push(r.e); break; } stdin = r.c; }
    if (!fn) {
      const bin = cmdBin(st, cmd);
      if (bin) fn = (aa, ss) => bin(aa, ss, st, { readNode: (n) => readNode(st, n, cmd), resolve: (p) => resolve(st, p), fs: cur(st).fs });
      else { errs.push(cmd + ': command not found (try help)'); last = { o: '' }; stdin = ''; continue; }
    }
    last = fn(t, stdin, st) || { o: '' };
    if (last.e) errs.push(last.e);
    stdin = last.o == null ? '' : last.o;
    if (i < parts.length - 1 && stdin && !/\n$/.test(stdin)) stdin += '\n';
    if (last.clear) return { out: '', clear: true };
    if (redirOut) {
      const p = resolve(st, redirOut), pp = p.slice(0, p.lastIndexOf('/')) || '/', pn = cur(st).fs[pp];
      if (!pn || (st.user !== 'root' && !(pbits(pn, st) & 2))) errs.push('sh: ' + redirOut + ': Permission denied');
      else { const old = cur(st).fs[p]; cur(st).fs[p] = { t: 'f', m: old ? old.m : 644, o: old ? old.o : st.user, c: (append && old ? old.c : '') + (last.o || '') + '\n' }; }
      last = { o: '' };
    }
  }
  const out = (last.o || '') + (!drop && errs.length ? (last.o ? '\n' : '') + errs.join('\n') : '');
  return { out };
}
function cmdBin(st, cmd) {
  const h = cur(st); let p = null;
  if (cmd.indexOf('/') >= 0) p = resolve(st, cmd);
  else { const cands = ['/usr/local/bin/' + cmd, '/usr/bin/' + cmd, '/opt/bin/' + cmd]; p = cands.find((c) => h.bins[c]) || null; }
  if (!p || !h.bins[p] || !h.fs[p]) return null;
  return h.bins[p];
}

function runLine(st, line, depth) {
  depth = depth || 0;
  line = line.trim(); if (!line) return { out: '' };
  const f = /^for\s+(\w+)\s+in\s+(.+?)\s*;\s*do\s+(.+?)\s*;\s*done\s*(\|.*)?$/.exec(line);
  if (f) {
    let list = expandSubst(st, f[2], depth);
    list = list.replace(/\{(-?\d+)\.\.(-?\d+)\}/g, (m, a, b) => { const o = []; a = +a; b = +b; for (let i = a; i <= b && o.length < LIMITS.loop; i++) o.push(i); return o.join(' '); });
    const items = tokens(list).slice(0, LIMITS.loop), out = [];
    items.forEach((it) => { st.vars[f[1]] = it; const r = runLine(st, f[3], depth + 1); if (r.out !== '') out.push(r.out); });
    delete st.vars[f[1]];
    if (f[4]) { const r = runPipeline(st, f[4].replace(/^\|/, ''), depth, out.join('\n') + '\n'); return { out: trimOut(r.out || '') }; }
    return { out: trimOut(out.join('\n')) };
  }
  const stmts = splitTop(line, [';', '&&']);
  if (stmts.length > 1) { const out = []; stmts.forEach((x) => { const r = runLine(st, x, depth + 1); if (r.out !== '') out.push(r.out); }); return { out: trimOut(out.join('\n')) }; }
  const r = runPipeline(st, line, depth);
  return { out: trimOut(r.out || ''), clear: r.clear, err: r.err };
}

/* run a whole history; return the last command's output */
function simulate(chal, ctx, history) {
  const st = createSession(chal, ctx); st.vars = {};
  if (history.length > LIMITS.history) history = history.slice(0, LIMITS.history);
  let last = { out: '' };
  history.forEach((cmd) => { last = runLine(st, String(cmd).slice(0, LIMITS.cmd)); });
  return { out: last.out || '', clear: !!last.clear, prompt: promptOf(st), motd: st.motd };
}

/* ---------- deterministic randomness ---------- */
function seeded(hex) {
  let a = parseInt(hex.slice(0, 8), 16) >>> 0;
  const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = () => next();
  r.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.hex = (n) => { let o = ''; while (o.length < n) o += Math.floor(next() * 16).toString(16); return o; };
  r.shuffle = (arr) => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  return r;
}
function siteFlag(secret, n) { return 'flag{' + crypto.createHmac('sha256', secret).update('site:' + n).digest('hex').slice(0, 20) + '}'; }
function makeCtx(secret, chalId, user) {
  const h = (tag) => crypto.createHmac('sha256', secret).update(tag + ':' + chalId + ':' + user).digest('hex');
  return { flag: 'flag{' + h('flag').slice(0, 20) + '}', rnd: seeded(h('seed')), site: { 1: siteFlag(secret, 1), 2: siteFlag(secret, 2), 3: siteFlag(secret, 3), 4: siteFlag(secret, 4) } };
}

module.exports = { simulate, makeCtx, createSession, runLine, LIMITS, seeded, siteFlag };
