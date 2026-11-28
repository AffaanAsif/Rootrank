(function () {
  'use strict';
  var main = document.getElementById('app'), app = main, meEl = document.getElementById('me'), topEl = document.getElementById('top');
  var TOK = 'rr:token', USR = 'rr:user';
  var L = window.LEARN || { cmds: {}, paths: [], tracks: {} };
  var state = { me: null, tracks: null, meta: null, total: 0, players: 0, mineTotal: 0, cfg: {} };
  var RC = window.RR_CONFIG || {}, VID = window.VIDEOS || {};
  var termInsert = null, demoTimer = null;
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* a note for people who read consoles */
  try {
    console.log('%c rootrank ', 'background:#0d2b4a;color:#e8f2ff;font:600 14px monospace;padding:4px 10px;border:1px solid #9fc6f0', '\nyou read consoles. good. there is a beacon on this site, and it answers to the right token.\ndecode this, then fetch it:\n' + btoa('/api/arena?op=beacon&t=neon'));
  } catch (e) {}

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function token() { try { return localStorage.getItem(TOK); } catch (e) { return null; } }
  function uname() { try { return localStorage.getItem(USR) || ''; } catch (e) { return ''; } }
  function setAuth(t, u) { try { if (t) { localStorage.setItem(TOK, t); localStorage.setItem(USR, u); } else { localStorage.removeItem(TOK); localStorage.removeItem(USR); } } catch (e) {} }
  function api(op, data, query) {
    var post = !!data, qs = '?op=' + encodeURIComponent(op) + (query || '');
    var headers = { 'Content-Type': 'application/json' }, t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    return fetch('/api/arena' + qs, { method: post ? 'POST' : 'GET', headers: headers, body: post ? JSON.stringify(Object.assign({ op: op }, data)) : undefined })
      .then(function (r) { return r.json().then(function (j) { j._status = r.status; if (r.status === 401 && t && op !== 'login') { setAuth(null); state.me = null; state.tracks = null; renderMe(); } return j; }, function () { return { error: 'Server error (HTTP ' + r.status + '). Is the API deployed?', _status: r.status }; }); })
      .catch(function () { return { error: 'Could not reach the server.', _status: 0 }; });
  }
  function toast(msg, bad) {
    var b = document.getElementById('toasts'), t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; b.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }
  var TIER_NAMES = ['', 'Guest', 'User', 'Operator', 'Sudoer', 'Admin', 'Root'];
  function ago(ms) { var s = Math.max(1, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function first(s) { var m = /^.*?[.!?](\s|$)/.exec(s || ''); return m ? m[0].trim() : (s || ''); }
  function cd(id) { return L.tracks[id] || {}; }
  function trk(id) { return (state.tracks || []).filter(function (t) { return t.id === id; })[0]; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  var ARROW = '<svg class="arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';

  function loadTracks(force) {
    if (state.tracks && !force) return Promise.resolve({});
    return api('tracks').then(function (j) {
      if (j.tracks) {
        state.tracks = j.tracks; state.meta = { ranks: j.ranks, tiers: j.tiers }; state.total = j.total; state.players = j.players; state.mineTotal = j.mineTotal || 0; state.cfg = j.cfg || {};
        var el = document.getElementById('sig'); if (el && j._s) el.setAttribute('data-s', j._s);
      }
      return j;
    });
  }
  function fail(j) { app.innerHTML = '<div class="page"><div class="empty">' + esc((j && j.error) || 'Could not load. Try again in a moment.') + '</div></div>'; }

  /* ---------- header ---------- */
  function renderMe() {
    if (!token()) { meEl.innerHTML = '<a class="chip go" href="#" id="signin">Sign in</a>'; return; }
    var u = uname() || 'me';
    meEl.innerHTML = '<a class="chip me" href="#/u/' + esc(u) + '"><span class="av">' + esc(u.charAt(0).toUpperCase()) + '</span><span>' + esc(u) + '</span>' + (state.me ? '<em>' + num(state.me.points) + '</em>' : '') + '</a>';
  }
  function refreshMe() {
    if (!token()) { state.me = null; renderMe(); return Promise.resolve(); }
    return api('me').then(function (j) { state.me = j.user ? j : null; renderMe(); });
  }
  var progEl = document.getElementById('prog');
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    progEl.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
  }, { passive: true });

  /* ---------- auth modal ---------- */
  var modal = document.getElementById('modal'), mode = 'login', afterAuth = null;
  function openAuth(m, cb) { mode = m || 'login'; afterAuth = cb || null; paintAuth(); modal.hidden = false; (state.tracks ? Promise.resolve() : loadTracks()).then(initGoogle); setTimeout(function () { document.getElementById('au').focus(); }, 30); }
  function paintAuth() {
    document.getElementById('mtitle').textContent = mode === 'login' ? 'Sign in' : 'Create your account';
    document.getElementById('asubmit').textContent = mode === 'login' ? 'Sign in' : 'Sign up';
    document.getElementById('ap').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    document.getElementById('aswitch').innerHTML = mode === 'login' ? 'New here? <a id="sw">Create an account</a>' : 'Already have one? <a id="sw">Sign in</a>';
    document.getElementById('aerr').textContent = '';
  }
  modal.addEventListener('click', function (e) { if (e.target === modal || e.target.id === 'aclose') modal.hidden = true; if (e.target.id === 'sw') { mode = mode === 'login' ? 'signup' : 'login'; paintAuth(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.hidden = true; });
  function finishAuth(j) {
    if (j.token) {
      setAuth(j.token, j.user); modal.hidden = true; document.getElementById('ap').value = '';
      state.tracks = null; toast('Welcome, ' + j.user);
      refreshMe().then(function () { if (afterAuth) afterAuth(); else route(); });
    } else document.getElementById('aerr').textContent = j.error || 'Something went wrong';
  }
  var gReady = false;
  function initGoogle() {
    var id = state.cfg && state.cfg.google, wrap = document.getElementById('gwrap');
    wrap.hidden = false;
    if (!id) { document.getElementById('gbtn').innerHTML = '<button type="button" class="sbtn" id="gfake"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.5 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.4 0-11.7-4-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>'; document.getElementById('gfake').onclick = function () { toast('Google sign-in is not switched on yet', true); }; return; }
    function paint() {
      if (!gReady) { window.google.accounts.id.initialize({ client_id: id, callback: function (r) { api('google', { credential: r.credential }).then(finishAuth); } }); gReady = true; }
      var b = document.getElementById('gbtn'); b.innerHTML = '';
      window.google.accounts.id.renderButton(b, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 330 });
    }
    if (window.google && window.google.accounts) return paint();
    var sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = paint; sc.onerror = function () { wrap.hidden = true; }; document.head.appendChild(sc);
  }
  document.getElementById('ghbtn').addEventListener('click', function () {
    var id = state.cfg && state.cfg.github; if (!id) { toast('GitHub sign-in is not switched on yet', true); return; }
    var st = Math.random().toString(36).slice(2) + Date.now().toString(36); try { sessionStorage.setItem('rr:gh', st); } catch (e) {}
    location.href = 'https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(id) + '&scope=' + encodeURIComponent('read:user') + '&state=' + st + '&redirect_uri=' + encodeURIComponent(location.origin + '/');
  });
  (function () {
    var q = new URLSearchParams(location.search), code = q.get('code'), st = q.get('state'), want = null; try { want = sessionStorage.getItem('rr:gh'); } catch (e) {}
    if (!code || !st || !want || st !== want) return;
    try { sessionStorage.removeItem('rr:gh'); } catch (e) {}
    history.replaceState(null, '', location.pathname + (location.hash || '#/'));
    api('github', { code: code }).then(finishAuth);
  })();
  document.getElementById('authform').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('asubmit'); btn.disabled = true;
    api(mode, { user: document.getElementById('au').value.trim(), pass: document.getElementById('ap').value }).then(function (j) {
      btn.disabled = false; finishAuth(j);
    });
  });
  document.addEventListener('click', function (e) {
    var t = e.target, a = t.closest ? t.closest('[data-auth],#signin,#signout,.cm') : null;
    if (!a) return;
    if (a.id === 'signin') { e.preventDefault(); openAuth('login'); }
    else if (a.getAttribute('data-auth')) { e.preventDefault(); openAuth(a.getAttribute('data-auth')); }
    else if (a.id === 'signout') { e.preventDefault(); setAuth(null); state.me = null; state.tracks = null; renderMe(); toast('Signed out'); location.hash = '#/'; route(); }
    else if (a.classList.contains('cm')) {
      var cmd = (a.getAttribute('data-c') || '').replace(/\s+#\s.*$/, '');
      if (termInsert) { termInsert(cmd); }
      else { try { navigator.clipboard.writeText(cmd); toast('Copied. Paste it in a terminal.'); } catch (x) {} }
    }
  });

  /* ---------- reveal and counters ---------- */
  var io = null;
  function reveal() {
    var els = app.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window) || RM) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
  }
  function countUp() {
    app.querySelectorAll('.cnt').forEach(function (el) {
      var n = +el.getAttribute('data-n') || 0;
      if (RM || n < 2) { el.textContent = num(n); return; }
      var t0 = null; (function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 900), e = 1 - Math.pow(1 - p, 3); el.textContent = num(Math.round(n * e)); if (p < 1) requestAnimationFrame(step); })(performance.now());
    });
  }
  function done() { reveal(); countUp(); }

  /* ---------- shared pieces ---------- */
  function courseCard(t, i) {
    var d = cd(t.id), n = (d.lessons || []).length;
    return '<a class="card rv" style="--d:' + ((i % 3) * .07) + 's" href="#/course/' + esc(t.id) + '"><div class="cardtop"><span class="pill">' + esc(d.level || 'Course') + '</span><span class="pill">' + esc(d.time || '') + '</span></div>' +
      '<h3>' + esc(t.title) + '</h3><p>' + esc(first(d.hook || t.blurb)) + '</p>' +
      '<div class="foot2"><span>' + t.levels + ' levels</span><span class="prog" style="flex:1;max-width:90px"><i style="width:' + pct(t.mine, t.levels) + '%"></i></span><span>' + t.mine + '/' + t.levels + '</span></div></a>';
  }
  function pathCard(p, i) {
    var ts = p.tracks.map(trk).filter(Boolean), lv = 0, mine = 0;
    ts.forEach(function (t) { lv += t.levels; mine += t.mine; });
    return '<a class="card rv" style="--d:' + ((i % 3) * .07) + 's" href="#/path/' + esc(p.id) + '"><span class="pill" style="align-self:flex-start">' + esc(p.who) + '</span><h3>' + esc(p.title) + '</h3><p>' + esc(p.blurb) + '</p>' +
      '<div class="foot2"><span>' + p.tracks.length + ' courses</span><span class="prog" style="flex:1;max-width:90px"><i style="width:' + pct(mine, lv) + '%"></i></span><span class="row" style="gap:6px">Open ' + ARROW + '</span></div></a>';
  }
  function left(t) { var m = Math.max(0, Math.floor((t - Date.now()) / 60000)); return 'resets in ' + Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
  function stairHTML(points) {
    var ranks = state.meta ? state.meta.ranks : [], here = -1;
    if (points != null) ranks.forEach(function (r, i) { if (points >= r.min) here = i; });
    return '<div class="stair">' + ranks.map(function (r, i) {
      return '<div class="step' + (i === here ? ' here' : i < here ? ' reached' : '') + '" style="height:' + (44 + i * 17) + '%"><b>' + esc(r.name) + '</b><small>' + num(r.min) + '</small></div>';
    }).join('') + '</div>';
  }
  function playerList(b) {
    return '<div class="list">' + b.map(function (x) { return '<a class="item" href="#/u/' + esc(x.user) + '"><span class="pos">' + pad2(x.pos) + '</span><span class="nm">' + esc(x.user) + '</span><span class="rk">' + esc(x.rank) + '</span><span class="pt">' + num(x.points) + '</span></a>'; }).join('') + '</div>';
  }
  function kitHTML(uses) {
    var us = (uses || []).filter(function (u) { return u; });
    if (!us.length) return '';
    return '<div class="chips" id="chips">' + us.map(function (u) { return '<button type="button" class="cc" data-k="' + esc(u) + '">' + esc(u) + '</button>'; }).join('') + '</div><div id="kit" class="kit" hidden></div>';
  }
  function wireKit(root) {
    var chips = root.querySelector('#chips'), kit = root.querySelector('#kit'); if (!chips) return;
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.cc'); if (!b) return;
      var k = b.getAttribute('data-k'), c = L.cmds[k], was = b.classList.contains('on');
      chips.querySelectorAll('.cc').forEach(function (x) { x.classList.remove('on'); });
      if (was) { kit.hidden = true; return; }
      b.classList.add('on'); kit.hidden = false;
      kit.innerHTML = c ? '<b style="color:var(--fg)">' + esc(k) + '</b> ' + esc(c[0]) + '<span class="cm" data-c="' + esc(c[1]) + '" style="display:block;margin-top:10px;font-family:var(--mono);font-size:13.5px;color:var(--fg);cursor:pointer"><i style="font-style:normal;color:var(--dim)">$</i> ' + esc(c[1]) + '</span>' : 'Type <span class="mono" style="color:var(--fg)">man ' + esc(k) + '</span> in the terminal to read its manual.';
    });
  }

  function videosHTML(id, title) {
    var vs = VID[id] || []; if (!vs.length) return '';
    return '<section class="sec rv"><h2>' + (title || 'Watch first') + '</h2><p class="lead">Free videos by independent creators. They open on the creator\'s own channel, so views and credit go to them.</p><div class="vlist" style="margin-top:20px">' +
      vs.map(function (v) { return '<a class="vcard" href="' + esc(v.url) + '" target="_blank" rel="noopener noreferrer"><span class="vth"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + esc(v.id) + '/mqdefault.jpg"><i></i></span><span class="vi"><b>' + esc(v.title) + '</b><small>Video by ' + esc(v.by) + ' &middot; YouTube</small><p>All rights belong to the creator. Subscribe to support their work.</p></span></a>'; }).join('') + '</div></section>';
  }
  function legendLock(pts) {
    var min = state.cfg && state.cfg.legendsMin; if (!min || pts >= min) return '';
    return '<div class="lock"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke-width="1.6" aria-hidden="true"><rect x="4" y="10" width="16" height="11"/><path d="M8 10V7a4 4 0 018 0v3"/></svg><div><b>Reserved for Admin rank</b><p>Legends open at ' + num(min) + ' points. You have ' + num(pts) + '. You can read every story and watch every video now.</p><div class="meter"><i style="width:' + pct(pts, min) + '%"></i></div></div></div>';
  }
  var LEG = { morris: ['1988', 'I'], kaminsky: ['2008', 'II'], shellshock: ['2014', 'III'], heartbleed: ['2014', 'IV'], dirtycow: ['2016', 'V'], mirai: ['2016', 'VI'], eternalblue: ['2017', 'VII'], wannacry: ['2017', 'VIII'], sunburst: ['2020', 'IX'], log4shell: ['2021', 'X'], xzdoor: ['2024', 'XI'] };
  var LEGN = { morris: 'Morris Worm', kaminsky: 'Kaminsky DNS', shellshock: 'Shellshock', heartbleed: 'Heartbleed', dirtycow: 'Dirty COW', mirai: 'Mirai', eternalblue: 'EternalBlue', wannacry: 'WannaCry', sunburst: 'Sunburst', log4shell: 'Log4Shell', xzdoor: 'XZ backdoor' };
  function legRows(link) {
    return '<div class="legs">' + Object.keys(LEG).map(function (k) {
      var t = trk(k), d = cd(k);
      return '<a class="legrow rv" href="#/course/' + k + '"><span class="y">' + LEG[k][0] + '</span><b>' + esc(LEGN[k]) + '</b><span class="dd">' + esc(first(d.hook)) + '</span><span class="t">Legend ' + LEG[k][1] + (t && t.mine ? ' &middot; ' + t.mine + '/' + t.levels : '') + '</span></a>';
    }).join('') + '</div>';
  }

  /* ---------- home ---------- */
  var DEMO = [['ls -a', '.  ..  README.txt  .stash', 'List everything, hidden files too.'], ['cat README.txt', 'The flag is not in plain sight. Look around.', 'Print a whole file.'], ['ls .stash', 'cache.dat', 'List what is inside a folder.'], ['cat .stash/cache.dat', 'flag{found_it}', 'Print a whole file.']];
  function runDemo(body) {
    if (demoTimer) clearTimeout(demoTimer);
    var lines = body.querySelector('#dl'), i = 0;
    if (RM) { lines.innerHTML = DEMO.map(function (d) { return '<div class="c"><b>guest@arena:~$</b> ' + esc(d[0]) + '</div><div class="o">' + esc(d[1]) + '</div><div class="x">' + esc(d[2]) + '</div>'; }).join(''); return; }
    function next() {
      if (!document.body.contains(body)) return;
      if (i >= DEMO.length) { demoTimer = setTimeout(function () { lines.innerHTML = ''; i = 0; next(); }, 3200); return; }
      var cmd = DEMO[i][0], out = DEMO[i][1], row = document.createElement('div'), k = 0; row.className = 'c'; row.innerHTML = '<b>guest@arena:~$</b> <span></span><i class="cur"></i>'; lines.appendChild(row);
      var sp = row.querySelector('span');
      (function type() {
        if (!document.body.contains(body)) return;
        if (k < cmd.length) { sp.textContent += cmd[k++]; demoTimer = setTimeout(type, 45 + Math.random() * 50); }
        else { row.querySelector('.cur').remove(); demoTimer = setTimeout(function () { var o = document.createElement('div'); o.className = 'o'; o.textContent = out; lines.appendChild(o); var xx = document.createElement('div'); xx.className = 'x'; xx.textContent = DEMO[i][2]; lines.appendChild(xx); i++; demoTimer = setTimeout(next, 650); }, 280); }
      })();
    }
    next();
  }
  function wordmark() {
    var el = document.getElementById('wm'); if (!el) return;
    var txt = 'rootrank';
    if (RM) { el.textContent = txt; return; }
    el.innerHTML = txt.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('') + '<span class="caret"></span>';
    var sp = el.querySelectorAll('span:not(.caret)'), i = 0;
    (function nx() { if (!document.body.contains(el)) return; if (i < sp.length) { sp[i++].classList.add('on'); setTimeout(nx, 90); } })();
  }
  var LC = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  var LCH = ['#e63946', '#2a9d8f', '#e08a2e', '#457b9d', '#d6336c', '#6b7488', '#7b2cbf'];
  function metroLines() {
    var inPath = {}, lines = [];
    L.paths.forEach(function (p, i) { lines.push({ id: p.id, name: p.title.replace(/^The /, ''), ids: p.tracks, ci: i % 5 }); p.tracks.forEach(function (t) { inPath[t] = 1; }); });
    var rest = (state.tracks || []).map(function (t) { return t.id; }).filter(function (id) { return !inPath[id] && !LEG[id]; });
    for (var k = 0, n = 1; k < rest.length; k += 8, n++) lines.push({ id: 'more' + n, name: n === 1 ? 'More courses' : 'More courses ' + n, ids: rest.slice(k, k + 8), ci: 5 });
    lines.push({ id: 'legends', name: 'Legends', ids: Object.keys(LEG), ci: 6, dot: true, lg: true });
    return lines.filter(function (l) { return l.ids.some(trk); });
  }
  function metroHTML(lines) {
    var W = 1200, RH = 124, H = lines.length * RH + 30, X0 = 200, X1 = 1130, shared = {}, count = {};
    lines.forEach(function (l) { l.ids.forEach(function (id) { count[id] = (count[id] || 0) + 1; }); });
    Object.keys(count).forEach(function (id) { if (count[id] > 1) shared[id] = 1; });
    var here = null, svg = '', st = '', nm = '';
    lines.forEach(function (l, r) {
      var ids = l.ids.filter(trk), n = ids.length, y0 = 66 + r * RH, dy = 22, col = LCH[l.ci], mid = Math.max(0, Math.floor(n / 2) - 1);
      var step = n > 1 ? (X1 - X0) / (n - 1) : 0, xs = ids.map(function (_, i) { return X0 + i * step; });
      var bx = n > 1 ? (xs[mid] + xs[mid + 1]) / 2 : X0, h = Math.abs(dy);
      function yAt(x) { return x <= bx - h / 2 ? y0 : x >= bx + h / 2 ? y0 + dy : y0 + dy * ((x - (bx - h / 2)) / h); }
      var d = 'M' + (X0 - 40) + ' ' + y0 + 'H' + (bx - h / 2) + 'L' + (bx + h / 2) + ' ' + (y0 + dy) + 'H' + (X1 + 20);
      svg += '<path class="ln' + (l.dot ? ' dot' : '') + '" data-l="' + l.id + '" d="' + d + '" stroke="' + col + '"/>';
      nm += '<span class="lname" data-l="' + l.id + '" style="left:' + (8 / W * 100) + '%;top:' + (y0 / H * 100) + '%;background:' + col + '">' + esc(l.name) + '</span>';
      ids.forEach(function (id, i) {
        var t = trk(id), x = xs[i], y = yAt(x), dn = t.mine >= t.levels && t.levels > 0, isLeg = !!l.lg;
        var isHere = false; if (!here && !dn && !isLeg) { here = { x: x, y: y }; isHere = true; }
        st += '<a class="stn ' + (isHere || i % 2 ? 'dn' : 'up') + (dn ? ' done' : '') + (shared[id] ? ' hub' : '') + (isLeg && state.cfg.legendsMin && (!state.me || state.me.points < state.cfg.legendsMin) ? ' lk' : '') + '" data-l="' + l.id + '" href="#/course/' + esc(id) + '" style="left:' + (x / W * 100).toFixed(3) + '%;top:' + (y / H * 100).toFixed(3) + '%" aria-label="' + esc(t.title) + '"><span class="pt"></span><span class="nm">' + esc(isLeg ? LEGN[id] : t.title) + '</span><span class="tip"><b>' + esc(isLeg ? LEGN[id] : t.title) + '</b>' + esc(first(cd(id).hook || t.blurb)) + '<i><u style="width:' + pct(t.mine, t.levels) + '%"></u></i></span></a>';
      });
    });
    var pin = here ? '<span class="here" style="left:' + (here.x / W * 100).toFixed(3) + '%;top:' + (here.y / H * 100).toFixed(3) + '%">' + (token() ? 'You are<br>here' : 'Start<br>here') + '</span>' : '';
    var legend = '<div class="legend" id="lgd">' + lines.map(function (l) { return '<button type="button" class="lg2" data-l="' + l.id + '" style="--lc:' + LCH[l.ci] + '"><i></i>' + esc(l.name) + '</button>'; }).join('') + '</div>';
    var vl = '<div class="vlines">' + lines.map(function (l, i) {
      var ids = l.ids.filter(trk), dn = ids.filter(function (id) { return trk(id).mine >= trk(id).levels; }).length;
      return '<details class="vl" style="--lc:' + LCH[l.ci] + '"' + (i === 0 ? ' open' : '') + '><summary><i></i>' + esc(l.name) + '<small>' + (l.lg ? ids.length + ' stops' : dn + '/' + ids.length) + '</small></summary><div class="vs">' + ids.map(function (id) { var t = trk(id); return '<a class="vst' + (t.mine >= t.levels && t.levels ? ' done' : '') + '" href="#/course/' + esc(id) + '"><i></i>' + esc(l.lg ? LEGN[id] : t.title) + '<small>' + t.mine + '/' + t.levels + '</small></a>'; }).join('') + '</div></details>';
    }).join('') + '</div>';
    return '<div class="mapcard rv"><div class="maphead"><div><span class="kick" style="margin:0">The map</span><h2 style="margin:6px 0 0">Pick a line. Ride it to the end.</h2></div>' + legend + '</div>' +
      '<div class="mapwrap" id="mapwrap"><svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + svg + '</svg>' + nm + st + pin + '</div>' + vl + '</div>';
  }
  function wireMap() {
    var wrap = document.getElementById('mapwrap'), lg = document.getElementById('lgd'); if (!wrap || !lg) return;
    lg.addEventListener('click', function (e) {
      var b = e.target.closest('.lg2'); if (!b) return; var was = b.classList.contains('on'), id = b.getAttribute('data-l');
      lg.querySelectorAll('.lg2').forEach(function (x) { x.classList.remove('on'); });
      wrap.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); });
      wrap.classList.toggle('f', !was);
      if (!was) { b.classList.add('on'); wrap.querySelectorAll('[data-l="' + id + '"]').forEach(function (x) { x.classList.add('on'); }); }
    });
  }
  function viewHome() {
    var my = app; Promise.all([loadTracks(), token() ? refreshMe() : Promise.resolve(), api('daily'), api('feed')]).then(function (r) { if (app !== my) return;
      if (!state.tracks) return fail(r[0]);
      var signed = !!token(), dly = r[2] && r[2].id ? r[2] : null, feed = (r[3] && r[3].feed) || [];
      var me = state.me, started = state.tracks.filter(function (t) { return t.mine > 0 && t.mine < t.levels; }).sort(function (a, b) { return b.mine - a.mine; })[0];
      var ranks = state.meta ? state.meta.ranks : [];
      var ladder = '<div class="lad">' + ranks.map(function (x, i) { return '<div class="st' + (me && me.rank === x.name ? ' me' : '') + (i === ranks.length - 1 ? ' top' : '') + '" style="--h:' + (62 + i * 40) + 'px"><b>' + esc(x.name) + '</b><small>' + (x.min ? num(x.min) + ' pts' : 'start') + '</small></div>'; }).join('') + '</div>';
      app.innerHTML = '<div class="page home"><section class="bhero"><span class="kick">Ranked hacking ladder</span><h1 class="wm" id="wm" data-t="ROOTRANK" aria-label="Rootrank">ROOTRANK</h1>' +
        '<p class="tag">Climb from Guest to Ghost. Real commands in a real browser terminal, every one explained before you use it, and every level a puzzle you solve yourself.</p>' +
        '<div class="row cen"><a class="btn" href="#/learn">Start learning ' + ARROW + '</a><a class="btn ghost" href="#/legends">Enter the Hall of Legends</a></div>' +
        '<div class="bstats"><div><b class="cnt" data-n="' + state.total + '">0</b><small>levels</small></div><div><b class="cnt" data-n="' + state.tracks.length + '">0</b><small>courses</small></div><div><b class="cnt" data-n="' + ranks.length + '">0</b><small>ranks</small></div><div><b class="cnt" data-n="' + state.players + '">0</b><small>players</small></div></div>' +
        '<div class="term" id="demo"><div class="tb"><span>guest@arena: zsh</span><span>sandbox</span></div><div class="tbody"><div id="dl"></div></div></div></section>' +
        '<section class="sec cen"><span class="kick">The ladder</span><h2>Seven ranks. One crown.</h2><p class="lead">Every solve earns points. Points move you up the ladder, from Guest at the bottom to Ghost at the very top.</p>' + ladder + '</section>' +
        '<section class="sec"><div class="cen"><span class="kick">Pick a path</span><h2>Where do you want to go?</h2><p class="lead">Each path is an ordered route of courses with a clear goal at the end.</p></div><div class="grid g3" style="margin-top:28px">' + L.paths.map(pathCard).join('') + '</div></section>' +
        '<section class="sec"><div class="cen"><span class="kick">Today</span><h2>Your next move</h2></div><div class="today" style="margin-top:28px">' +
        '<div class="card rv"><span class="kick" style="margin:0">' + (signed ? 'Your stop' : 'Get started') + '</span>' + (signed ? '<h3 style="font-size:24px">' + (started ? esc(started.title) : 'Pick your first course') + '</h3><p>' + (started ? started.mine + ' of ' + started.levels + ' levels done. Pick up where you left off.' : 'Choose any course to begin.') + '</p><div class="foot2"><a class="btn sm" href="#/' + (started ? 'course/' + esc(started.id) : 'learn') + '">Continue ' + ARROW + '</a>' + (me ? '<span>' + esc(me.rank) + ' &middot; ' + num(me.points) + ' pts</span>' : '') + '</div>' : '<h3 style="font-size:24px">Save your progress</h3><p>Sign in with Google, GitHub or a username to keep your rank, streak and solves.</p><div class="foot2"><a class="btn sm" href="#" data-auth="signup">Sign in</a></div>') + '</div>' +
        '<div class="card rv" style="--d:.07s"><span class="kick" style="margin:0">Daily challenge</span>' + (dly ? '<h3 style="font-size:22px">' + esc(dly.title) + '</h3><p>+' + Math.round(dly.bonus * 100) + '% bonus &middot; ' + dly.solvedToday + ' solved today</p><div class="foot2">' + (dly.solved ? '<span class="pill solid">Solved today</span>' : '<a class="btn sm" href="#/c/' + esc(dly.id) + '">Play ' + ARROW + '</a>') + '<span>' + left(dly.endsAt) + '</span></div>' : '<p>No daily challenge right now.</p>') + '</div>' +
        '<div class="card rv" style="--d:.14s"><span class="kick" style="margin:0">Live feed</span><div class="feed">' + (feed.length ? feed.slice(0, 4).map(function (x) { return '<div class="fr"><a href="#/u/' + esc(x.user) + '"><b>' + esc(x.user) + '</b></a><a class="ft" href="#/c/' + esc(x.id) + '">' + esc(x.title) + '</a><span class="dim">' + ago(x.at) + '</span></div>'; }).join('') : '<p>No solves yet today. Be the first.</p>') + '</div></div></div></section>' +
        '<section class="sec"><div class="cen"><span class="kick">Hall of Legends</span><h2>The attacks that changed the internet</h2><p class="lead">Eleven rebuilt incidents, from the Morris worm to the XZ backdoor. Open to everyone, so if you already know your way around, start here.</p></div><div style="margin-top:28px">' + legRows() + '</div></section>' +
        '<section class="sec"><div class="cen"><span class="kick">Learn it, then do it</span><h2>How a level works</h2></div><div class="grid g3" style="margin-top:28px">' +
        [['1', 'Learn the commands', 'Each level lists the commands it needs, with a plain explanation, a worked example and a video.'], ['2', 'Solve it in the terminal', 'A sandboxed machine, unique to you. Nothing real is touched.'], ['3', 'Submit the flag', 'Points, ranks and a global board. Hints are there, at a small cost.']].map(function (s, i) { return '<div class="card rv" style="--d:' + i * .08 + 's"><span class="pill" style="align-self:flex-start">Step ' + s[0] + '</span><h3>' + s[1] + '</h3><p>' + s[2] + '</p></div>'; }).join('') + '</div></section>' +
        '<section class="sec cen endcta"><h2>Ready to climb?</h2><p class="lead">Free to play. Your first level takes two minutes.</p><div class="row cen"><a class="btn" href="#/learn">Start learning ' + ARROW + '</a>' + (signed ? '' : '<a class="btn ghost" href="#" data-auth="signup">Create account</a>') + '</div></section></div>';
      done(); runDemo(document.getElementById('demo'));
      var w = document.getElementById('wm'); if (w && !RM) { w.classList.add('glitch'); (function loop() { setTimeout(function () { if (document.getElementById('wm') !== w) return; w.classList.remove('glitch'); void w.offsetWidth; w.classList.add('glitch'); loop(); }, 4200 + Math.random() * 2500); })(); }
    });
  }

  /* ---------- learn ---------- */
  function viewLearn() {
    var my = app; loadTracks().then(function (j) { if (app !== my) return;
      if (!state.tracks) return fail(j);
      var groups = ['Beginner', 'Intermediate', 'Advanced'];
      app.innerHTML = '<div class="page"><span class="kick">Learn</span><h1>Learn hacking, step by step.</h1><p class="lead" style="margin-top:18px">Pick a career path for a guided route, or jump into any course. Every course starts with a lesson and ends with real practice.</p>' +
        '<section class="sec" style="margin-top:56px"><h2>Career paths</h2><p class="lead">An ordered route with a clear goal at the end.</p><div class="grid g3">' + L.paths.map(pathCard).join('') + '</div></section>' +
        groups.map(function (g) {
          var ts = state.tracks.filter(function (t) { return (cd(t.id).level || 'Intermediate') === g; });
          return ts.length ? '<section class="sec"><h2>' + g + ' courses</h2><p class="lead">' + ({ Beginner: 'No experience needed. Start here.', Intermediate: 'You know the basics and want to apply them.', Advanced: 'Multi-step problems that combine everything.' })[g] + '</p><div class="grid g3">' + ts.map(courseCard).join('') + '</div></section>' : '';
        }).join('') + '</div>';
      done();
    });
  }

  function viewPath(id) {
    var my = app; loadTracks().then(function (j) { if (app !== my) return;
      var p = L.paths.filter(function (x) { return x.id === id; })[0];
      if (!state.tracks || !p) return fail(p ? j : { error: 'Path not found.' });
      var ts = p.tracks.map(trk).filter(Boolean), lv = 0, mine = 0;
      ts.forEach(function (t) { lv += t.levels; mine += t.mine; });
      app.innerHTML = '<div class="page"><div class="crumb"><a href="#/learn">Learn</a><i>/</i><span>Career path</span></div><span class="kick">' + esc(p.who) + '</span><h1>' + esc(p.title) + '</h1><p class="lead" style="margin-top:18px">' + esc(p.blurb) + '</p>' +
        '<div class="grid g2" style="margin-top:36px"><div class="card"><span class="kick" style="margin:0">Outcome</span><p style="color:var(--fg);font-size:17px">' + esc(p.outcome) + '</p></div><div class="card"><span class="kick" style="margin:0">Your progress</span><div class="big">' + pct(mine, lv) + '%<small>' + mine + ' of ' + lv + ' levels</small></div><span class="prog"><i style="width:' + pct(mine, lv) + '%"></i></span></div></div>' +
        '<section class="sec" style="margin-top:56px"><h2>The route</h2><p class="lead">Follow the courses in order.</p><div class="path" style="margin-top:28px;--lc:' + LCH[Math.max(0, L.paths.indexOf(p)) % 5] + '">' +
        ts.map(function (t, i) { var d = cd(t.id), dn = t.mine >= t.levels, nowI = ts.findIndex(function (x) { return x.mine < x.levels; }), isNow = i === nowI; return '<div class="pstep rv' + (dn ? ' done' : '') + (isNow ? ' now' : '') + '" style="--f:' + (t.levels ? t.mine / t.levels : 0).toFixed(3) + '"><span class="num">' + (dn ? '&#10003;' : i + 1) + '</span><a class="card" href="#/course/' + esc(t.id) + '"><div class="cardtop"><span class="pill">' + esc(d.level || '') + '</span><span class="pill">' + esc(d.time || '') + '</span>' + (isNow ? '<span class="pill solid">You are here</span>' : '') + '</div><h3>' + esc(t.title) + '</h3><p>' + esc(first(d.hook || t.blurb)) + '</p><div class="foot2"><span>' + (d.lessons || []).length + ' lessons, ' + t.levels + ' levels</span><span>' + t.mine + '/' + t.levels + '</span></div></a></div>'; }).join('') + '</div></section></div>';
      done();
    });
  }

  /* ---------- course ---------- */
  function viewCourse(id, practice) {
    var my = app; Promise.all([loadTracks(), api('track', null, '&id=' + encodeURIComponent(id))]).then(function (r) { if (app !== my) return;
      var j = r[1]; if (j.error) return fail(j);
      var t = j.track, d = cd(id), ls = d.lessons || [], solved = j.levels.filter(function (l) { return l.solved; }).length;
      var nextL = j.levels.filter(function (l) { return !l.solved; })[0];
      var tiles = j.levels.map(function (l) { return '<a class="tile' + (l.solved ? ' done' : '') + '" data-t="' + l.tier + '" href="#/c/' + esc(l.id) + '" title="Level ' + l.level + ', ' + esc(TIER_NAMES[l.tier]) + ', ' + l.points + ' pts, ' + l.solves + ' solves">' + l.level + '</a>'; }).join('');
      app.innerHTML = '<div class="page"><div class="crumb"><a href="#/learn">Learn</a><i>/</i><span>' + esc(t.cat) + '</span></div>' +
        (t.cat === 'Legends' ? legendLock(state.me ? state.me.points : 0) : '') + '<div class="art" style="max-width:none"><span class="kick">' + esc(d.level || 'Course') + (d.time ? ' &middot; ' + esc(d.time) : '') + '</span><h1>' + esc(t.title) + '</h1>' +
        '<p class="lead" style="margin-top:18px">' + esc(d.hook || t.blurb) + '</p>' +
        '<div class="row" style="margin-top:28px">' + (ls.length ? '<a class="btn" href="#/lesson/' + esc(id) + '/1">Start lesson 1 ' + ARROW + '</a>' : '') + '<a class="btn ghost" href="#/course/' + esc(id) + '/practice">Go to practice</a></div></div>' +
        (d.start ? '<section class="sec rv"><h2>Your first mission, in plain English</h2><p class="lead">Stuck on level 1? Follow these steps.</p><ol class="steps" style="margin-top:8px">' + d.start.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></section>' : '') +
        videosHTML(id) + (ls.length ? '<section class="sec rv"><h2>Lessons</h2><p class="lead">Read these before the levels. Each takes a few minutes.</p><div class="lessons">' + ls.map(function (l, i) { return '<a class="lrow" href="#/lesson/' + esc(id) + '/' + (i + 1) + '"><span class="n">' + pad2(i + 1) + '</span><div><b>' + esc(l.t) + '</b></div><span class="btn ghost sm">Read</span></a>'; }).join('') + '</div></section>' : '') +
        (d.uses && d.uses.length ? '<section class="sec rv"><h2>Toolkit</h2><p class="lead">Commands this course uses. Tap one to see what it does.</p>' + kitHTML(d.uses) + '</section>' : '') +
        '<section class="sec rv" id="levels"><div class="thead"><div><h2>Practice levels</h2><p class="lead">' + (solved ? solved + ' of ' + t.levels + ' solved.' : t.levels + ' levels, easiest first.') + '</p></div>' + (nextL ? '<a class="btn" href="#/c/' + esc(nextL.id) + '">' + (solved ? 'Continue at level ' + nextL.level : 'Start level 1') + ' ' + ARROW + '</a>' : '') + '</div>' +
        '<div class="map" style="margin-top:20px">' + tiles + '</div><div class="key"><span>Filled = solved</span><span>Brighter border = harder</span><span>' + num(t.points) + ' pts in this course</span>' + (token() ? '' : '<a href="#" data-auth="signup" style="text-decoration:underline">Sign in to save progress</a>') + '</div></section>' +
        (j.notes ? '<section class="sec rv"><details class="hints"><summary>Field notes</summary><div class="md" style="padding-bottom:12px">' + window.renderMD(j.notes) + '</div></details></section>' : '') + '</div>';
      wireKit(app); done();
      if (practice) setTimeout(function () { var e = document.getElementById('levels'); if (e) e.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }, 60);
    });
  }

  function viewLesson(id, n) {
    var my = app; loadTracks().then(function (j) { if (app !== my) return;
      var d = cd(id), ls = d.lessons || [], l = ls[n - 1], t = trk(id);
      if (!l || !t) return fail({ error: 'Lesson not found.' });
      var prev = n > 1 ? '<a class="btn ghost" href="#/lesson/' + esc(id) + '/' + (n - 1) + '">&larr; Previous</a>' : '<a class="btn ghost" href="#/course/' + esc(id) + '">&larr; Course</a>';
      var nxt = n < ls.length ? '<a class="btn" href="#/lesson/' + esc(id) + '/' + (n + 1) + '">Next lesson ' + ARROW + '</a>' : '<a class="btn" href="#/course/' + esc(id) + '/practice">Start practice ' + ARROW + '</a>';
      var vv = (VID[id] || [])[0], lk = ((L.links || {})[id] || []).slice(0, 4);
      var toc = '<aside class="ltoc"><span class="kick">In this course</span>' + ls.map(function (x, i) { return '<a class="' + (i + 1 === n ? 'on' : '') + '" href="#/lesson/' + esc(id) + '/' + (i + 1) + '"><i>' + (i + 1) + '</i>' + esc(x.t) + '</a>'; }).join('') + '<a class="pr" href="#/course/' + esc(id) + '/practice">Practice levels ' + ARROW + '</a></aside>';
      var rail = '<aside class="lrail"><div class="card"><span class="kick">Practice</span><p style="margin:6px 0 14px;font-size:14.5px">Use this straight away. ' + t.levels + ' levels in this course, from easy to hard.</p><a class="btn sm" href="#/c/' + esc(id) + '-1">Try level 1 ' + ARROW + '</a></div>' +
        (vv ? '<div class="card"><span class="kick">Watch</span><a class="vth" href="' + esc(vv.url) + '" target="_blank" rel="noopener noreferrer" style="background-image:url(https://i.ytimg.com/vi/' + esc(vv.id) + '/mqdefault.jpg);margin:8px 0"><span class="pb"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#0a2340"/></svg></span></a><b style="font-size:14.5px;line-height:1.3;display:block">' + esc(vv.title) + '</b><span class="dim" style="font-size:13px">' + esc(vv.by) + '</span></div>' : '') +
        (lk.length ? '<div class="card"><span class="kick">Go deeper</span><ul class="gd">' + lk.map(function (x) { return '<li><a href="' + esc(x[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(x[0]) + ' <em>&#8599;</em></a></li>'; }).join('') + '</ul></div>' : '') + '</aside>';
      app.innerHTML = '<div class="page wide"><div class="crumb"><a href="#/learn">Learn</a><i>/</i><a href="#/course/' + esc(id) + '">' + esc(t.title) + '</a><i>/</i><span>Lesson ' + n + ' of ' + ls.length + '</span></div><div class="lgrid">' + toc + '<div class="art">' +
        '<span class="kick">' + esc(t.title) + '</span><h1>' + esc(l.t) + '</h1>' + (n === 1 && d.hook ? '<p class="hook">' + esc(d.hook) + '</p>' : '<div style="height:18px"></div>') +
        '<div class="md">' + window.renderMD(l.md) + '</div>' +
        (n === ls.length ? '<div class="note"><b style="color:var(--fg)">Ready?</b> Now put it to work. The levels use exactly what you just learned.</div>' + (d.uses && d.uses.length ? '<h3 style="margin:36px 0 12px">Toolkit for this course</h3>' + kitHTML(d.uses) : '') : '') +
        '<div class="lnav">' + prev + nxt + '</div></div>' + rail + '</div></div>';
      wireKit(app); done();
    });
  }

  /* ---------- compete ---------- */
  function viewCompete() {
    var my = app; Promise.all([loadTracks(), api('board'), token() ? refreshMe() : Promise.resolve(), api('daily'), api('feed')]).then(function (r) { if (app !== my) return;
      if (!state.tracks) return fail(r[0]);
      var dly = r[3] && r[3].id ? r[3] : null, feed = (r[4] && r[4].feed) || [];
      var signed = !!token(), pts = state.me ? state.me.points : (signed ? 0 : null), board = (r[1].board || []).slice(0, 10);
      var ranks = state.meta.ranks, nextR = null; ranks.forEach(function (x) { if (!nextR && pts != null && x.min > pts) nextR = x; });
      var started = state.tracks.filter(function (t) { return t.mine > 0 && t.mine < t.levels; }).sort(function (a, b) { return b.mine - a.mine; })[0];
      var pick = started || trk('nav') || state.tracks[0];
      app.innerHTML = '<div class="page"><span class="kick">Compete</span><h1>The ranked arena.</h1><p class="lead" style="margin-top:18px">Solve levels, earn points, climb from Guest to Ghost. Using hints costs points. Being first earns a bonus.</p>' +
        '<div class="cgrid2" style="margin-top:40px"><div class="card"><div class="cardtop"><span class="kick" style="margin:0">Your rank</span>' + (state.me && state.me.pos ? '<span class="pill">#' + state.me.pos + '</span>' : '') + '</div>' +
        (signed && state.me && state.me.streak ? '<span class="pill hot" style="align-self:flex-start;margin-bottom:6px">' + state.me.streak + '-day streak</span>' : '') + (signed ? '<div class="big">' + esc(state.me ? state.me.rank : 'Guest') + '<small>' + num(pts) + ' pts' + (nextR ? ', ' + num(nextR.min - pts) + ' to ' + esc(nextR.name) : '') + '</small></div>' : '<div class="big">Unranked</div><p>Create an account to earn points and appear on the board.</p><div><a class="btn sm" href="#" data-auth="signup">Create account</a></div>') + stairHTML(pts) + '</div>' +
        '<div class="card" id="rec"><span class="kick" style="margin:0">Recommended next</span><h3 style="font-size:22px">' + esc(pick.title) + '</h3><p>' + esc(first(cd(pick.id).hook || pick.blurb)) + '</p><div class="foot2" style="margin-top:auto"><a class="btn" id="recgo" href="#/course/' + esc(pick.id) + '">Open course ' + ARROW + '</a></div></div></div>' +
        '<div class="cgrid2 rv" style="margin-top:16px">' + (dly ? '<div class="card"><div class="cardtop"><span class="kick" style="margin:0">Daily challenge</span><span class="pill hot">' + left(dly.endsAt) + '</span></div><h3 style="font-size:22px">' + esc(dly.title) + '</h3><p>Tier ' + dly.tier + ' &middot; +' + Math.round(dly.bonus * 100) + '% bonus &middot; ' + dly.solvedToday + ' solved today</p><div class="foot2" style="margin-top:auto">' + (dly.solved ? '<span class="pill solid">Solved today</span>' : '<a class="btn" href="#/c/' + esc(dly.id) + '">Play for ' + dly.reward + ' pts ' + ARROW + '</a>') + '</div></div>' : '') +
        '<div class="card"><span class="kick" style="margin:0">Live feed</span><div class="feed">' + (feed.length ? feed.slice(0, 6).map(function (x) { return '<div class="fr"><a href="#/u/' + esc(x.user) + '"><b>' + esc(x.user) + '</b></a><a class="ft" href="#/c/' + esc(x.id) + '">' + esc(x.title) + '</a>' + (x.first ? '<span class="pill hot">first blood</span>' : '') + '<span class="dim">' + ago(x.at) + '</span></div>'; }).join('') : '<p>No solves yet today. Be the first.</p>') + '</div></div></div>' +
        '<section class="sec"><h2>Tracks</h2><p class="lead">Every track is a ladder. Filter by difficulty.</p><div class="filters" id="filters"><button class="fl on" data-f="all">All</button><button class="fl" data-f="easy">Easy</button><button class="fl" data-f="med">Medium</button><button class="fl" data-f="hard">Hard</button></div><div class="tlist" id="tl"></div></section>' +
        '<section class="sec"><div class="thead"><h2>Top players</h2><a class="btn ghost sm" href="#/board">Full board</a></div>' + (board.length ? playerList(board) : '<div class="empty">Nobody has scored yet. The first solve earns a bonus.</div>') + '</section></div>';
      function paint(f) {
        var ts = state.tracks.filter(function (t) { return f === 'all' || (f === 'easy' && t.minTier <= 2) || (f === 'med' && t.minTier <= 4 && t.maxTier >= 3) || (f === 'hard' && t.maxTier >= 5); });
        document.getElementById('tl').innerHTML = ts.map(function (t) { return '<a class="trow" href="#/course/' + esc(t.id) + '"><span><b>' + esc(t.title) + '</b><small>' + esc(t.cat) + ', tiers ' + t.minTier + (t.maxTier > t.minTier ? ' to ' + t.maxTier : '') + '</small></span><span class="bl">' + esc(t.blurb) + '</span><span class="prog"><i style="width:' + pct(t.mine, t.levels) + '%"></i></span><span class="ct">' + t.mine + '/' + t.levels + '</span></a>'; }).join('') || '<div class="empty">Nothing here.</div>';
      }
      paint('all');
      document.getElementById('filters').addEventListener('click', function (e) { var b = e.target.closest('.fl'); if (!b) return; document.querySelectorAll('.fl').forEach(function (x) { x.classList.toggle('on', x === b); }); paint(b.getAttribute('data-f')); });
      api('track', null, '&id=' + encodeURIComponent(pick.id)).then(function (j) {
        var n = j.levels && j.levels.filter(function (l) { return !l.solved; })[0], b = document.getElementById('recgo');
        if (n && b) { b.setAttribute('href', '#/c/' + n.id); b.innerHTML = 'Play level ' + n.level + ' ' + ARROW; }
      });
      done();
    });
  }

  /* ---------- challenge ---------- */
  function viewChallenge(id) {
    var my = app; Promise.all([api('challenge', null, '&id=' + encodeURIComponent(id)), loadTracks()]).then(function (r) { if (app !== my) return;
      var c = r[0]; if (c.error) return fail(c);
      var d = cd(c.track), t = trk(c.track), ls = d.lessons || [];
      var fb = c.firstBlood ? ' &middot; first blood <a href="#/u/' + esc(c.firstBlood) + '" style="text-decoration:underline">' + esc(c.firstBlood) + '</a>' : '';
      var nav = (c.prev ? '<a href="#/c/' + c.prev + '">&larr; Previous</a>' : '<span class="off">&larr; Previous</span>') + '<a href="#/course/' + esc(c.track) + '/practice">All levels</a>' + (c.next ? '<a href="#/c/' + c.next + '">Next &rarr;</a>' : '<span class="off">Next &rarr;</span>');
      var site = c.type === 'site';
      var steps = (c.level <= 3 && d.start) ? '<details class="hints" style="margin-top:12px"><summary>Walk me through it</summary><ol class="steps" style="padding:6px 0 16px">' + d.start.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></details>' : '';
      var uses = (d.uses || []).filter(Boolean), pi = -1;
      L.paths.forEach(function (p, i) { if (pi < 0 && p.tracks.indexOf(c.track) >= 0) pi = i; });
      var lc = LCH[pi < 0 ? 5 : pi % 5], v0 = VID[c.track] && VID[c.track][0];
      var route = '<aside class="card rt" style="--lc:' + lc + '"><span class="rl">Your route</span><h3>Level ' + c.level + '</h3>' +
        [['Read the lesson', ls.length ? 'Lesson 1' : 'Optional', 'done'], ['Learn the commands', uses.length + ' command' + (uses.length === 1 ? '' : 's'), 'done'], ['Solve in the terminal', c.solved ? 'Done' : 'You are here', c.solved ? 'done' : 'now'], ['Submit the flag', c.reward + ' pts', c.solved ? 'done' : 'next']].map(function (x) { return '<div class="stnv ' + x[2] + '"><i></i><div><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></div></div>'; }).join('') +
        '<div class="nx">' + (c.next ? 'Next stop <a href="#/c/' + c.next + '">Level ' + (c.level + 1) + ' &rarr;</a>' : '<span>Last stop on this line</span>') + (c.prev ? '<a href="#/c/' + c.prev + '">&larr; Previous</a>' : '') + '<a href="#/course/' + esc(c.track) + '/practice">All levels</a></div></aside>';
      var cheat = '<aside class="card cheat"><div class="ch"><b style="font:800 17px var(--sans)">Cheat sheet</b><span class="pill">' + uses.length + '</span></div><div id="cs">' + (uses.length ? uses.map(function (u) { var x = L.cmds[u]; return '<button type="button" class="cc2" data-k="' + esc(u) + '"><b>' + esc(u) + '</b><span>' + esc(x ? x[0] : 'Type man ' + u + ' in the terminal.') + '</span>' + (x ? '<code>$ ' + esc(x[1]) + '</code>' : '') + '</button>'; }).join('') : '<p class="muted" style="font-size:14px">No new commands here. Use what you learned so far.</p>') + '</div>' +
        '<p class="sm2"><a href="#" id="csk">Skip, I know these</a></p>' + (v0 ? '<p class="sm2">New to this? <a href="' + esc(v0.url) + '" target="_blank" rel="noopener noreferrer">Watch a beginner video</a> by ' + esc(v0.by) + '.</p>' : '') + (ls.length ? '<p class="sm2"><a href="#/lesson/' + esc(c.track) + '/1">Read the lesson</a></p>' : '') + '</aside>';
      var mid = '<div class="midc"><div class="card lhead"><div class="row" style="gap:8px"><span class="pill">Tier ' + c.tier + ' &middot; ' + esc(TIER_NAMES[c.tier]) + '</span><span class="pill ' + (c.solved ? 'solid' : 'hot') + '">' + (c.solved ? 'Solved' : c.reward + ' pts') + '</span></div><h1>' + esc(c.title) + '</h1><div class="dim mono" style="font-size:12.5px">' + c.solves + ' solve' + (c.solves === 1 ? '' : 's') + fb + '</div></div>' +
        '<div class="card mis"><span class="kick">Mission</span><div>' + (c.locked ? 'The mission brief unlocks with Legends access.' : esc(c.brief)) + '<div class="note">' + (site ? 'This flag lives in the website itself, not in the machine. The terminal is here if you need it.' : c.type === 'flag' ? 'Find the flag on your machine and submit it. Start with cat README.txt.' : 'Work the answer out from the data on your machine. Start with cat README.txt.') + '</div>' + steps + '</div></div>' +
        (c.locked ? '<div class="card lock2"><b style="font:800 20px var(--sans)">Locked until Admin rank</b><p class="muted">Legends open at ' + num(c.legendsMin || 0) + ' points' + (token() ? '. Keep climbing.' : '. Sign in to track your progress.') + '</p>' + (token() ? '' : '<p><a class="btn sm" href="#" data-auth="signup">Create account</a></p>') + '</div>' :
        '<div class="chrow">' + (uses.length ? '<p class="hintline" style="margin:0 0 10px">Commands for this level. Tap one.</p>' + kitHTML(uses) : '') + '</div><div id="termbox"></div><form class="sub" id="subform" autocomplete="off"><input class="field" id="ans" placeholder="' + (c.type === 'flag' || c.type === 'site' ? 'flag{...}' : 'Your answer') + '" aria-label="Answer" spellcheck="false" autocapitalize="off"><button class="btn" type="submit">Submit</button></form><div class="res" id="res" aria-live="polite"></div>' +
        '<details class="hints"><summary>Hints (' + c.hints.length + ')</summary><div id="hbody"></div></details>' + (c.notes ? '<details class="hints"><summary>Field notes</summary><div class="md" style="padding-bottom:10px">' + window.renderMD(c.notes) + '</div></details>' : '')) + '</div>';
      var vids = (VID[c.track] || []).slice(0, 2), lnk = ((L.links || {})[c.track] || []).slice(0, 4);
      var learn = '<section class="learn1"><div class="l1h"><span class="kick">Learn it first</span><span class="dim mono" style="font-size:12px">Two minutes here saves twenty in the terminal</span></div><div class="l1g">' +
        '<div class="l1c vid">' + (v0 ? '<a class="vth" href="' + esc(v0.url) + '" target="_blank" rel="noopener noreferrer" style="background-image:url(https://i.ytimg.com/vi/' + esc(v0.id) + '/mqdefault.jpg)"><span class="pb"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#0a2340"/></svg></span></a><b>' + esc(v0.title) + '</b><span>' + esc(v0.by) + ' &middot; opens YouTube</span>' : '<b>Video</b><span>No video for this course yet.</span>') + '</div>' +
        '<div class="l1c"><span class="kick">Lesson</span><b>' + esc(ls[0] ? ls[0].t : 'Start with the commands') + '</b><span>' + (ls.length ? ls.length + ' short lesson' + (ls.length === 1 ? '' : 's') + ' with examples, a common mistake and a quiz.' : 'Use the Field Guide on the right.') + '</span>' + (ls.length ? '<a class="btn sm" href="#/lesson/' + esc(c.track) + '/1">Read the lesson</a>' : '') + '</div>' +
        '<div class="l1c"><span class="kick">Go deeper</span><ul class="gd">' + (lnk.length ? lnk.map(function (x) { return '<li><a href="' + esc(x[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(x[0]) + ' <em>&#8599;</em></a></li>'; }).join('') : '<li class="dim">Links appear as this course grows.</li>') + '</ul></div></div></section>';
      function guideHTML(k) {
        var x = L.cmds[k], a = (L.anat || {})[k], man = 'https://man7.org/linux/man-pages/man1/' + encodeURIComponent(k) + '.1.html';
        var h = '<div class="gh"><b class="mono">' + esc(k) + '</b><span class="kick">Field guide</span></div><p class="gd1">' + esc(x ? x[0] : 'Run man ' + k + ' in the terminal for the manual.') + '</p>';
        if (a) h += '<small class="gl">Anatomy</small><div class="anat">' + a.parts.map(function (q) { return '<span class="ap"><code>' + esc(q[0]) + '</code><small>' + esc(q[1]) + '</small></span>'; }).join('') + '</div>';
        if (x) h += '<small class="gl">Worked example</small><code class="we">$ ' + esc(x[1]) + '</code>' + (a && a.out ? '<pre class="wo">' + esc(a.out) + '</pre>' : '');
        if (a && a.tip) h += '<p class="gtip">' + esc(a.tip) + '</p>';
        h += '<div class="gb">' + (x ? '<button type="button" class="btn sm" data-run="' + esc(x[1].replace(/\s+#\s.*$/, '')) + '">Run it here</button>' : '') + (v0 ? '<a class="gl2" href="' + esc(v0.url) + '" target="_blank" rel="noopener noreferrer">Watch &#8599;</a>' : '') + '<a class="gl2" href="' + man + '" target="_blank" rel="noopener noreferrer">man ' + esc(k) + ' &#8599;</a></div>';
        return h;
      }
      var guide = '<aside class="card gdc"><div class="gtabs" id="gtabs">' + uses.map(function (u, i) { return '<button type="button" class="gtab' + (i ? '' : ' on') + '" data-k="' + esc(u) + '">' + esc(u) + '</button>'; }).join('') + '</div><div id="gbody">' + (uses.length ? guideHTML(uses[0]) : '<p class="muted" style="font-size:14px">No new commands here. Use what you learned so far.</p>') + '</div></aside>';
      var strip = '<div class="rstrip" style="--lc:' + lc + '">' + [['Learn', 'done'], ['Commands', 'done'], ['Solve', c.solved ? 'done' : 'now'], ['Flag', c.solved ? 'done' : 'next']].map(function (x, i) { return '<span class="' + x[1] + '"><i>' + (i + 1) + '</i>' + x[0] + '</span>'; }).join('') + '<em>' + (c.prev ? '<a href="#/c/' + c.prev + '">&larr; Prev</a>' : '') + '<a href="#/course/' + esc(c.track) + '/practice">All levels</a>' + (c.next ? '<a href="#/c/' + c.next + '">Next &rarr;</a>' : '') + '</em></div>';
      var head = mid.slice(0, mid.indexOf('<div class="card mis">')), rest = mid.slice(mid.indexOf('<div class="card mis">'), -6);
      app.innerHTML = '<div class="page wide"><div class="crumb"><a href="#/learn">Learn</a><i>/</i><a href="#/course/' + esc(c.track) + '">' + esc(t ? t.title : c.cat) + '</a><i>/</i><span>Level ' + c.level + ' of ' + c.levels + '</span></div>' + head.replace('<div class="midc">', '') + strip + learn + '<div class="play"><div class="midc">' + rest + '</div>' + guide + '</div></div>';
      var gb = document.getElementById('gbody');
      document.getElementById('gtabs').addEventListener('click', function (e) { var b = e.target.closest('.gtab'); if (!b) return; this.querySelectorAll('.gtab').forEach(function (z) { z.classList.remove('on'); }); b.classList.add('on'); gb.innerHTML = guideHTML(b.getAttribute('data-k')); });
      gb.addEventListener('click', function (e) { var b = e.target.closest('[data-run]'); if (b && termInsert) { termInsert(b.getAttribute('data-run')); document.getElementById('termbox').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
      wireKit(app);
      if (c.locked) { done(); return; }
      function renderHints() {
        var h = '<p class="hintline" style="margin:0 0 6px">Each hint lowers this level\'s points by 15 percent, never below 40 percent.</p>';
        c.hints.forEach(function (x) { h += x.locked ? '<div class="hint locked"><span>Hint ' + (x.i + 1) + '</span><button class="btn ghost sm" data-hint="' + x.i + '">Reveal</button></div>' : '<div class="hint md">' + window.renderMD(x.text) + '</div>'; });
        document.getElementById('hbody').innerHTML = h;
      }
      renderHints();
      document.getElementById('hbody').addEventListener('click', function (e) {
        var n = e.target.getAttribute('data-hint'); if (n == null) return;
        if (!token()) { openAuth('signup'); return; }
        api('hint', { id: c.id, n: +n }).then(function (j) { if (j.text) { c.hints[+n] = { i: +n, text: j.text }; c.reward = j.reward; renderHints(); } else toast(j.error || 'Could not reveal', true); });
      });
      document.getElementById('subform').addEventListener('submit', function (e) {
        e.preventDefault();
        var v = document.getElementById('ans').value.trim(), res = document.getElementById('res'); if (!v) return;
        if (!token()) { openAuth('signup', function () { viewChallenge(id); }); return; }
        api('submit', { id: c.id, answer: v }).then(function (j) {
          if (j.ok && j.already) { res.className = 'res ok'; res.textContent = 'Already solved.'; }
          else if (j.ok) {
            res.className = 'res ok'; res.innerHTML = 'Correct. +' + j.points + ' pts' + (j.firstBlood ? ' (first blood)' : '') + ' &middot; ' + esc(j.rank) + (j.daily ? ' &middot; daily bonus' : '') + (j.streak > 1 ? ' &middot; ' + j.streak + '-day streak' : '') + (j.pos ? ' &middot; #' + j.pos : '') + (c.next ? ' &middot; <a href="#/c/' + c.next + '">Next level</a>' : '');
            toast('+' + j.points + ' points'); burst(); state.tracks = null; refreshMe();
          } else if (j.ok === false) { res.className = 'res no'; res.textContent = 'Not it yet. Keep digging.'; }
          else { res.className = 'res no'; res.textContent = j.error || 'Something went wrong'; }
        });
      });
      mountTerminal(c); done();
    });
  }

  /* ---------- terminal ---------- */
  var CMDS = ['awk', 'base64', 'caesar', 'cat', 'cd', 'clear', 'curl', 'cut', 'echo', 'file', 'find', 'grep', 'head', 'help', 'history', 'id', 'ls', 'man', 'md5sum', 'mkdir', 'pwd', 'reset', 'rev', 'rootrank', 'sed', 'seq', 'sort', 'ssh', 'sshpass', 'strings', 'sudo', 'tail', 'touch', 'tr', 'uniq', 'wc', 'whoami', 'xxd'];
  function egg(c) {
    var m = {
      'sudo make me a sandwich': ['o', 'Okay.'],
      'make me a sandwich': ['e', 'make: *** No rule to make target "sandwich". Stop.'],
      'xyzzy': ['m', 'Nothing happens.'],
      'hack the planet': ['o', 'HACK THE PLANET!'],
      'exit': ['m', 'There is no escape. Try the Reset button.'],
      'rm -rf /': ['e', 'rm: it is dangerous to operate recursively on "/"\nrm: use --no-preserve-root to override this failsafe\n(You tried it. Everyone does.)'],
      'neofetch': ['o', '  ┌─┐┌─┐  guest@arena\n  ├┬┘├┬┘  OS: Rootrank 1.0 (pretend)\n  ┴└─┴└─  Shell: not bash, not zsh, mostly honest\n          Uptime: as long as this tab\n          Memory: 1100 levels']
    };
    if (c === 'sudo su' || c === 'sudo -i') return ['e', 'guest is not in the sudoers file. This incident will be reported.\n(To nobody. This is a sandbox.)'];
    if (c === 'matrix') return ['m', 'Wake up, guest...', function () { rain(); }];
    return m[c] || null;
  }
  function mountTerminal(c) {
    var box = document.getElementById('termbox'); termInsert = null;
    var bar = '<div class="mbar"><span class="dots"><i></i><i></i><i></i></span><span class="mtitle" id="mt">guest@arena: zsh</span>';
    if (!token()) {
      box.innerHTML = '<div class="mac">' + bar + '</div><div class="mbody" style="cursor:default"><div class="c"><b>guest@arena:~$</b> cat README.txt</div><div class="o">Sign in to open your own machine for this level.</div><div class="x">Print a whole file.</div><div class="lockterm" style="margin-top:16px"><span>Lessons and briefs are free to read. The terminal needs an account so your machine is yours alone.</span><a class="btn" href="#" data-auth="signup">Sign in to start</a></div></div></div>';
      return;
    }
    var EXK = 'rr:explain', FSK = 'rr:fs', exm = 'every', fs = 15;
    try { exm = localStorage.getItem(EXK) || 'every'; fs = +localStorage.getItem(FSK) || 15; } catch (e) {}
    document.documentElement.style.setProperty('--tfs', fs + 'px');
    var tools = '<div class="mtools"><div class="seg" id="exseg" role="group" aria-label="Explain commands"><button type="button" data-m="every">Explain every</button><button type="button" data-m="new">New only</button><button type="button" data-m="off">Off</button></div><button type="button" class="tbtn" id="fsm" aria-label="Smaller text">A-</button><button type="button" class="tbtn" id="fsp" aria-label="Larger text">A+</button><button type="button" class="tbtn mreset" id="treset">Reset</button><button type="button" class="tbtn" id="tfull" aria-label="Full screen">Full</button></div>';
    var key = 'rr:t:' + c.id + ':' + uname(), hist = [], recall = [], lines = [], hpos = 0, prompt = 'guest@arena:~$', busy = false, queue = [], draft = '';
    try { var sv = JSON.parse(sessionStorage.getItem(key)); if (sv) { hist = sv.h || []; lines = sv.l || []; prompt = sv.p || prompt; recall = sv.r || hist.slice(); } } catch (e) {}
    box.innerHTML = '<div class="mac">' + bar + tools + '</div><div class="mbody" id="mbody" aria-live="polite"><div id="tout"></div><form class="mline" id="tform" autocomplete="off"><span class="mp" id="tp"></span><input id="tin" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" aria-label="Terminal input"></form></div></div><div class="hintline">Tab completes commands. Up and down recall history. Ctrl+L clears. Click a command in a lesson to send it here.</div>';
    var mb = document.getElementById('mbody'), out = document.getElementById('tout'), inp = document.getElementById('tin'), tp = document.getElementById('tp'), mt = document.getElementById('mt');
    function setPrompt(p) { prompt = p; tp.textContent = p; var m = /^([^:]+):/.exec(p); mt.textContent = (m ? m[1] : 'guest@arena') + ': zsh'; }
    function save() { try { sessionStorage.setItem(key, JSON.stringify({ h: hist, l: lines.slice(-300), p: prompt, r: recall.slice(-100) })); } catch (e) {} }
    function bottom() { mb.scrollTop = mb.scrollHeight; }
    function mk(cls, text) { var d = document.createElement('div'); d.className = cls; if (cls === 'c') { var b = document.createElement('b'); b.textContent = text[0]; d.appendChild(b); d.appendChild(document.createTextNode(' ' + text[1])); } else d.textContent = text; return d; }
    function add(cls, text) { lines.push([cls, text]); out.appendChild(mk(cls, text)); bottom(); }
    function paintAll() { out.textContent = ''; lines.forEach(function (l) { out.appendChild(mk(l[0], l[1])); }); setPrompt(prompt); bottom(); }
    function clearScreen() { lines = []; out.textContent = ''; save(); }
    function kind(s) { return /^[\w.-]+: .*(not found|No such file|Permission denied|invalid|cannot|unknown|not permitted|Usage)/i.test(s) && s.indexOf('\n') < 0 ? 'e' : 'o'; }
    function start() {
      hist = []; recall = []; lines = []; queue = []; out.textContent = ''; busy = true;
      var p = document.createElement('div'); p.className = 'pend'; p.textContent = 'Starting your machine...'; out.appendChild(p);
      api('exec', { id: c.id, history: [] }).then(function (j) {
        busy = false; p.remove();
        if (j.error) { add('e', j.error); return; }
        setPrompt(j.prompt); if (j.motd) add('m', j.motd); add('m', 'Type help for commands. Start with: cat README.txt'); save(); pump();
      });
    }
    var seen = {};
    function baseCmd(line) { var w = line.trim().split(/\s+/); if (w[0] === 'sudo' && w[1]) w.shift(); return w[0] || ''; }
    hist.forEach(function (h) { seen[baseCmd(h)] = 1; });
    function explain(line) {
      var b = baseCmd(line), x = L.cmds[b], first = !seen[b]; seen[b] = 1;
      if (!x || exm === 'off' || (exm === 'new' && !first)) return;
      add('x', b + ': ' + first_s(x[0]));
    }
    function first_s(t) { return first(t); }
    function stuck(line, o) {
      var b = baseCmd(line), m;
      if (/No such file or directory/.test(o)) add('x', 'Stuck? That name is not here. Run ls to see the exact names. Capital letters matter, and so does a trailing s.');
      else if (/command not found/.test(o)) add('x', 'Stuck? Check the spelling, or type help to see every command available here.');
      else if (/Permission denied/.test(o)) add('x', 'Stuck? Run ls -l and read the permission letters. chmod u+rx NAME opens a locked folder you own.');
      else if (/Is a directory/.test(o)) add('x', 'Stuck? That is a folder. Use cd to go inside, or ls to list it.');
      else if (/Not a directory/.test(o)) add('x', 'Stuck? That is a file. Use cat to read it.');
      else if (/usage|missing operand/i.test(o) && L.cmds[b]) add('x', 'Stuck? Example: ' + L.cmds[b][1]);
    }
    function pump() {
      if (busy || !queue.length) return;
      var line = queue.shift(), tl = line.trim();
      if (!tl) { pump(); return; }
      if (tl === 'clear') { clearScreen(); pump(); return; }
      if (tl === 'reset') { start(); return; }
      var eg = egg(tl); if (eg) { add(eg[0], eg[1]); if (eg[2]) eg[2](); save(); pump(); return; }
      if (hist.length >= 55) { add('e', 'This session is long. Type reset for a fresh start. Your points are kept.'); pump(); return; }
      busy = true; var pend = document.createElement('div'); pend.className = 'pend'; pend.textContent = '...'; out.appendChild(pend); bottom();
      var next = hist.concat([line]);
      api('exec', { id: c.id, history: next }).then(function (j) {
        busy = false; pend.remove();
        if (j.error) add('e', j.error);
        else {
          hist = next; if (j.clear) clearScreen();
          if (j.out) { var kd = kind(j.out); add(kd, j.out); if (kd === 'o') explain(line); else if (kd === 'e') stuck(line, j.out); }
          setPrompt(j.prompt);
        }
        save(); pump();
      });
    }
    function submitLine(line) {
      add('c', [prompt, line]); recall.push(line); hpos = recall.length; draft = '';
      if (line.trim() === 'clear' && !busy && !queue.length) { clearScreen(); return; }
      queue.push(line); pump();
    }
    var seg = document.getElementById('exseg');
    function paintSeg() { seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === exm); }); }
    paintSeg();
    seg.addEventListener('click', function (e) { var m = e.target.getAttribute('data-m'); if (!m) return; exm = m; try { localStorage.setItem(EXK, m); } catch (x) {} paintSeg(); inp.focus(); });
    function setFs(n) { fs = Math.max(12, Math.min(22, n)); document.documentElement.style.setProperty('--tfs', fs + 'px'); try { localStorage.setItem(FSK, fs); } catch (x) {} }
    document.getElementById('tfull').addEventListener('click', function () { var m = document.querySelector('.mac'); m.classList.toggle('full'); this.textContent = m.classList.contains('full') ? 'Exit' : 'Full'; inp.focus(); });
    document.getElementById('fsm').addEventListener('click', function () { setFs(fs - 1); });
    document.getElementById('fsp').addEventListener('click', function () { setFs(fs + 1); });
    mb.addEventListener('click', function (e) { if (!window.getSelection().toString() && e.target.tagName !== 'INPUT') inp.focus(); });
    if (lines.length) paintAll(); else start();
    setPrompt(prompt);
    termInsert = function (txt) { inp.value = txt; inp.focus(); mb.scrollTop = mb.scrollHeight; toast('Command ready. Press Enter.'); };
    document.getElementById('treset').addEventListener('click', function () { start(); inp.focus(); });
    document.getElementById('tform').addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value; inp.value = ''; submitLine(v); });
    inp.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); clearScreen(); return; }
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); add('c', [prompt, inp.value + '^C']); inp.value = ''; queue = []; return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (hpos === recall.length) draft = inp.value; if (hpos > 0) { hpos--; inp.value = recall[hpos]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hpos < recall.length - 1) { hpos++; inp.value = recall[hpos]; } else { hpos = recall.length; inp.value = draft; } }
      else if (e.key === 'Tab') {
        e.preventDefault(); var v = inp.value;
        if (!v || /\s/.test(v)) return;
        var m = CMDS.filter(function (x) { return x.indexOf(v) === 0; });
        if (m.length === 1) inp.value = m[0] + ' ';
        else if (m.length > 1) { var p = m[0]; m.forEach(function (x) { while (x.indexOf(p) !== 0) p = p.slice(0, -1); }); inp.value = p; add('m', m.join('  ')); }
      }
    });
    mb.addEventListener('click', function () { if (!String(window.getSelection())) inp.focus(); });
    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) inp.focus({ preventScroll: true });
  }

  /* ---------- board and profile ---------- */
  function viewBoard() {
    var my = app; api('board').then(function (j) { if (app !== my) return;
      var b = j.board || [];
      app.innerHTML = '<div class="page"><span class="kick">Board</span><h1>Leaderboard</h1><p class="lead" style="margin:18px 0 36px">Top 100. Ties go to whoever got there first.</p>' + (b.length ? playerList(b) : '<div class="empty">Nobody has scored yet. Be the first.</div>') + '</div>';
      done();
    });
  }

  function viewUser(name) {
    var my = app; Promise.all([api('user', null, '&u=' + encodeURIComponent(name)), loadTracks()]).then(function (r) { if (app !== my) return;
      var u = r[0]; if (u.error) return fail(u);
      var mine = token() && uname() === u.user;
      app.innerHTML = '<div class="page"><div class="crumb"><a href="#/board">Board</a></div><div class="thead"><h1>' + esc(u.user) + '</h1><span class="pill">' + esc(u.rank) + (u.pos ? ' &middot; #' + u.pos : '') + '</span></div>' +
        '<div class="stats" style="margin-top:32px"><div><b>' + num(u.points) + '</b><small>points</small></div><div><b>' + u.count + '</b><small>levels solved</small></div><div><b>' + u.tracks.length + '</b><small>courses started</small></div><div><b style="font-size:20px;line-height:2">' + ago(u.joined) + '</b><small>joined</small></div></div>' +
        '<section class="sec" style="margin-top:56px"><h2>Ladder</h2>' + stairHTML(u.points) + '</section>' +
        '<section class="sec rv"><div class="thead"><h2>Badges</h2><span class="pill">' + (u.streak ? u.streak + '-day streak' : 'No streak') + (u.best ? ' &middot; best ' + u.best : '') + '</span></div>' + ((u.badges || []).length ? '<div class="badges">' + u.badges.map(function (b) { return '<div class="badge"><b>' + esc(b.name) + '</b><span>' + esc(b.desc) + '</span></div>'; }).join('') + '</div>' : '<div class="empty">No badges yet. Solve a level to start.</div>') + '</section>' +
        '<div class="split sec"><div><h2>Courses</h2><div style="margin-top:12px">' + (u.tracks.length ? u.tracks.map(function (t) { return '<div class="pbar"><span>' + esc(t.title) + '</span><span class="prog"><i style="width:' + pct(t.done, t.levels) + '%"></i></span><span class="ct">' + t.done + '/' + t.levels + '</span></div>'; }).join('') : '<div class="empty">Nothing yet.</div>') + '</div></div>' +
        '<div><h2>Recent</h2><div style="margin-top:12px">' + (u.recent.length ? '<div class="list">' + u.recent.map(function (s) { return '<a class="item" href="#/c/' + esc(s.id) + '" style="grid-template-columns:30px minmax(0,1fr) 70px"><span class="pos">T' + s.tier + '</span><span class="nm">' + esc(s.title) + '<br><small class="dim">' + ago(s.at) + '</small></span><span class="pt">+' + s.points + '</span></a>'; }).join('') + '</div>' : '<div class="empty">No solves yet.</div>') + '</div>' + (mine ? '<p style="margin-top:20px"><a id="signout" href="#" class="muted" style="text-decoration:underline">Sign out</a></p>' : '') + '</div></div></div>';
      done();
    });
  }

  /* ---------- legends and community ---------- */
  function viewLegends() {
    var my = app; Promise.all([loadTracks(), api('wall'), token() ? refreshMe() : Promise.resolve()]).then(function (r) { if (app !== my) return;
      if (!state.tracks) return fail(r[0]);
      var pts = state.me ? state.me.points : 0;
      app.innerHTML = '<div class="page"><span class="kick">Hall of Legends</span><h1>The hardest problems in hacking history.</h1><p class="lead" style="margin-top:18px">Eleven real incidents rebuilt as playable puzzles. Each has a story, a video from the people who explain it best, and three stages. Open to everyone.</p>' +
        '<div style="margin-top:36px">' + legendLock(pts) + '</div>' + legRows() +
        '<section class="sec"><h2>Wall of fame</h2><p class="lead">The first people to clear each legend\'s final stage.</p><div class="wall" style="margin-top:20px">' +
        ((r[1].legends || []).map(function (l) { return '<div class="card rv"><span class="pill" style="align-self:flex-start">' + esc(LEGN[l.id] || l.title) + '</span>' + (l.solvers.length ? l.solvers.map(function (x, i) { return '<a class="who" href="#/u/' + esc(x.user) + '"><span>' + pad2(i + 1) + ' ' + esc(x.user) + '</span><span class="dim">' + ago(x.at) + '</span></a>'; }).join('') : '<p>Unclaimed. Be the first.</p>') + '</div>'; }).join('')) + '</div></section></div>';
      done();
    });
  }
  function viewCommunity() {
    function link(u, label, text, a) { return u ? '<a class="card rv" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer"><span class="pill" style="align-self:flex-start">' + label + '</span><h3>' + a + '</h3><p>' + text + '</p></a>' : '<div class="card rv"><span class="pill" style="align-self:flex-start">Soon</span><h3>' + a + '</h3><p>' + text + ' Opening soon.</p></div>'; }
    var my = app; loadTracks().then(function () { if (app !== my) return;
      app.innerHTML = '<div class="page"><span class="kick">Community</span><h1>Hackers learn faster together.</h1><p class="lead" style="margin-top:18px">Rootrank is built in the open. Share a writeup, suggest a level, or point us at a great video.</p>' +
        '<div class="grid g3" style="margin-top:36px">' + link(RC.discord, 'Chat', 'Ask for help, share writeups, find a study partner.', 'Discord') + link(RC.github, 'Code', 'Report bugs, send a pull request, propose a new level.', 'GitHub') + link(RC.contact ? 'mailto:' + RC.contact : '', 'Mail', 'Creators: tell us about your video and we will credit and link it.', 'Contact') + '</div>' +
        '<section class="sec"><h2>Credit where it is due</h2><div class="md" style="max-width:720px"><p>Every video on this site is made by someone else and stays on their channel. We link to it, show their name, and never re-host it. If you make learning content about hacking, we want to send people your way.</p><p>Want your video on a course? Send us the link and the topic it covers.</p></div></section></div>';
      done();
    });
  }

  /* ---------- easter eggs ---------- */
  var rainOn = false;
  function rain() {
    var c = document.getElementById('rain'); if (!c) return;
    if (rainOn) { rainOn = false; document.body.classList.remove('root'); c.hidden = true; toast('exit'); return; }
    rainOn = true; document.body.classList.add('root'); c.hidden = false; c.width = innerWidth; c.height = innerHeight;
    var x = c.getContext('2d'), cols = Math.floor(c.width / 16), ys = []; for (var i = 0; i < cols; i++) ys.push(Math.random() * c.height / 16);
    toast('uid=0(root) gid=0(root) groups=0(root)');
    (function f() { if (!rainOn) return; x.fillStyle = 'rgba(2,10,6,.12)'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#4ade80'; x.font = '15px Space Mono, monospace';
      ys.forEach(function (y, i) { x.fillText(String.fromCharCode(0x30a0 + Math.random() * 90), i * 16, y * 16); ys[i] = y * 16 > c.height && Math.random() > .975 ? 0 : y + 1; }); requestAnimationFrame(f); })();
  }
  (function eggs() {
    var K = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], ki = 0, typed = '', clicks = 0, ct = 0;
    document.addEventListener('keydown', function (e) {
      ki = e.key === K[ki] || e.key.toLowerCase() === K[ki] ? ki + 1 : (e.key === K[0] ? 1 : 0);
      if (ki === K.length) { ki = 0; rain(); }
      if (e.key.length === 1 && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) { typed = (typed + e.key.toLowerCase()).slice(-8); if (typed.slice(-7) === 'hunter2') { toast('*******'); typed = ''; } }
    });
    document.getElementById('logo').addEventListener('click', function () {
      clearTimeout(ct); clicks++; ct = setTimeout(function () { clicks = 0; }, 1200);
      if (clicks >= 7) { clicks = 0; var w = document.getElementById('wm'); if (w) { w.classList.remove('glitch'); void w.offsetWidth; w.classList.add('glitch'); } toast('you found the loose wire'); }
    });
    var t0 = document.title;
    document.addEventListener('visibilitychange', function () { document.title = document.hidden ? '> still here_' : t0; });
  })();

  /* ---------- a short flash on solve ---------- */
  function burst() {
    if (RM) return;
    var c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
    var x = c.getContext('2d'), ps = [];
    for (var i = 0; i < 70; i++) ps.push({ x: c.width / 2, y: c.height * .55, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 3, s: 4 + Math.random() * 6 });
    var t0 = Date.now();
    (function f() { x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#e8f2ff'; ps.forEach(function (p) { p.vy += .42; p.x += p.vx; p.y += p.vy; x.fillRect(p.x, p.y, p.s, p.s); }); if (Date.now() - t0 < 1500) requestAnimationFrame(f); else c.remove(); })();
  }

  /* ---------- router ---------- */
  var SKEL = '<div class="page" aria-busy="true"><div class="sk" style="width:120px;height:14px"></div><div class="sk" style="width:min(520px,80%);height:54px;margin-top:20px"></div><div class="sk" style="width:min(640px,100%);height:16px;margin-top:22px"></div><div class="sk" style="width:min(480px,70%);height:16px;margin-top:10px"></div><div class="grid g3" style="margin-top:48px"><div class="sk" style="height:170px"></div><div class="sk" style="height:170px"></div><div class="sk" style="height:170px"></div></div></div>';
  function notFound(r) {
    app.innerHTML = '<div class="page center"><span class="kick">404</span><h1>Nothing at this path.</h1><p class="lead" style="margin-top:18px">bash: ' + esc(r || '?') + ': command not found</p><div class="row c" style="margin-top:32px"><a class="btn" href="#/">Back home</a><a class="btn ghost" href="#/learn">Browse courses</a></div></div>';
  }
  function route() {
    var h = location.hash.replace(/^#\/?/, ''), p = h.split('/');
    var nav = { t: 'learn', course: 'learn', lesson: 'learn', path: 'learn', learn: 'learn', tracks: 'compete', compete: 'compete', c: 'compete', board: 'board', u: 'board', legends: 'legends', community: 'community' }[p[0]] || '';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === nav); });
    termInsert = null; if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
    window.scrollTo({ top: 0, behavior: 'instant' }); 
    var stage = document.createElement('div'); stage.className = 'stage view'; main.textContent = ''; main.appendChild(stage); app = stage;
    app.innerHTML = SKEL;
    var k = p[0];
    if (!k) viewHome();
    else if (k === 'learn') viewLearn();
    else if (k === 'path' && p[1]) viewPath(p[1]);
    else if ((k === 'course' || k === 't') && p[1]) viewCourse(p[1], p[2] === 'practice');
    else if (k === 'lesson' && p[1]) viewLesson(p[1], Math.max(1, parseInt(p[2], 10) || 1));
    else if (k === 'compete' || k === 'tracks') viewCompete();
    else if (k === 'c' && p[1]) viewChallenge(p[1]);
    else if (k === 'board') viewBoard();
    else if (k === 'legends') viewLegends();
    else if (k === 'community') viewCommunity();
    else if (k === 'u' && p[1]) viewUser(decodeURIComponent(p[1]));
    else notFound(h);
  }
  window.addEventListener('hashchange', route);
  /* ---------- command palette ---------- */
  (function () {
    var pal = document.getElementById('pal'), pin = document.getElementById('pin'), list = document.getElementById('pall'), items = [], sel = 0;
    function all() {
      var o = [['Home', '#/', 'Page', ''], ['Learn', '#/learn', 'Page', ''], ['Compete', '#/compete', 'Page', ''], ['Legends', '#/legends', 'Page', ''], ['Community', '#/community', 'Page', ''], ['Board', '#/board', 'Page', '']];
      L.paths.forEach(function (p, i) { o.push([p.title, '#/path/' + p.id, 'Career path', LCH[i % 5]]); });
      (state.tracks || []).forEach(function (t) { o.push([LEGN[t.id] || t.title, '#/course/' + t.id, LEG[t.id] ? 'Legend' : 'Course', LEG[t.id] ? LCH[6] : '']); });
      Object.keys(L.cmds).forEach(function (k) { o.push([k, '', 'Command: ' + L.cmds[k][0], '']); });
      return o;
    }
    function paint() {
      var q = pin.value.trim().toLowerCase();
      items = all().filter(function (x) { return !q || x[0].toLowerCase().indexOf(q) >= 0 || x[2].toLowerCase().indexOf(q) >= 0; }).slice(0, 40); sel = 0;
      list.innerHTML = items.length ? items.map(function (x, i) { return '<div class="pali' + (i ? '' : ' on') + '" data-i="' + i + '" style="' + (x[3] ? '--lc:' + x[3] : '') + '"><i></i>' + esc(x[0]) + '<small>' + esc(x[2]).slice(0, 38) + '</small></div>'; }).join('') : '<div class="empty" style="margin:8px">Nothing matches.</div>';
    }
    function mark() { list.querySelectorAll('.pali').forEach(function (e, i) { e.classList.toggle('on', i === sel); if (i === sel) e.scrollIntoView({ block: 'nearest' }); }); }
    function open() { pal.hidden = false; pin.value = ''; (state.tracks ? Promise.resolve() : loadTracks()).then(paint); paint(); setTimeout(function () { pin.focus(); }, 20); }
    function close() { pal.hidden = true; }
    function go(i) { var x = items[i]; if (!x) return; close(); if (x[1]) location.hash = x[1]; else toast(x[0] + ': ' + x[2].replace('Command: ', '')); }
    document.getElementById('srch').addEventListener('click', open);
    document.addEventListener('keydown', function (e) {
      var tg = e.target && e.target.tagName, typing = tg === 'INPUT' || tg === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); pal.hidden ? open() : close(); return; }
      if (e.key === '/' && !typing && pal.hidden) { e.preventDefault(); open(); return; }
      if (pal.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    });
    pin.addEventListener('input', paint);
    pal.addEventListener('click', function (e) { if (e.target === pal) close(); var it = e.target.closest('.pali'); if (it) go(+it.getAttribute('data-i')); });
  })();

  renderMe(); refreshMe(); route(); setTimeout(function () { loadTracks(); }, 400);
})();
