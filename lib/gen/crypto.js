'use strict';
const U = require('./util');
const { GH, pad, iso, WORDS, word, uniqWords, text, readme, noiseLine, md5, rot, LAYERS } = U;

const fam = [];
const mkflag = (c) => c.flag;

/* ---------------- b64 ---------------- */
fam.push({
  id: 'b64', title: "Seal of Sixty-Four", cat: 'Encoding', levels: 25, tier: (lv) => (lv <= 12 ? 1 : 2), type: 'flag',
  blurb: 'Base64 is not encryption. Learn to spot it and undo it.',
  brief: (lv) => (lv <= 8 ? 'The flag has been base64 encoded. Decode it with base64 -d.' : lv <= 16 ? 'The README gives you a base64 string to decode.' : 'A file holds many base64 lines. Only one of them decodes to the flag. Decode them one by one in a loop and filter.'),
  build: (c, lv) => {
    const r = c.rnd, files = {}, v = lv <= 8 ? 0 : lv <= 16 ? 1 : 2;
    if (v === 0) {
      const pre = r.pick(['token: ', 'secret = ', '']);
      files[GH + '/encoded.txt'] = U.b64(pre + c.flag) + '\n';
      Object.assign(files, readme('encoded.txt holds the flag in base64.\nLook for the = signs at the end: that is padding, a base64 giveaway.'));
    } else if (v === 1) {
      Object.assign(files, readme('Decode this:\n' + U.b64('the flag is ' + c.flag) + '\nTip: echo STRING | base64 -d'));
    } else {
      const N = 20 + lv, L = []; const at = r.int(0, N - 1);
      for (let i = 0; i < N; i++) L.push(U.b64(i === at ? 'key: ' + c.flag : noiseLine(r).slice(11)));
      files[GH + '/lines.b64'] = text(L);
      Object.assign(files, readme('lines.b64 has ' + N + ' base64 lines. One decodes to a line containing flag{.\nThe others are noise. Loop over the lines, decode, grep.'));
    }
    return { motd: 'Looks like gibberish. It is not.', hosts: { main: { name: 'arena', files } }, meta: { v, str: U.b64('the flag is ' + c.flag) } };
  },
  solve: (b) => [b.meta.v === 0 ? 'base64 -d encoded.txt' : b.meta.v === 1 ? 'echo ' + b.meta.str + ' | base64 -d' : 'for l in $(cat lines.b64); do echo $l | base64 -d; done | grep flag']
});

/* ---------------- layers ---------------- */
fam.push({
  id: 'layers', title: "The Seven Veils", cat: 'Encoding', levels: 40, tier: (lv) => (lv <= 10 ? 2 : lv <= 25 ? 3 : 4), type: 'flag',
  blurb: 'Peel several encodings in the right order: base64, hex, reverse, rot13.',
  brief: (lv) => (lv <= 20 ? 'The flag was wrapped in several layers. The README lists them in the order they were applied. Undo them in reverse order, with pipes.' : 'The flag was wrapped in several layers and nobody tells you which. Look at what each result looks like, identify the layer, peel it, repeat.'),
  build: (c, lv) => {
    const r = c.rnd, n = 2 + Math.floor((lv - 1) / 8), keys = Object.keys(LAYERS), chain = [];
    for (let i = 0; i < n; i++) { let k; do k = r.pick(keys); while (chain.length && chain[chain.length - 1] === k); chain.push(k); }
    let t = c.flag; chain.forEach((k) => { t = LAYERS[k].enc(t); });
    const note = lv <= 20 ? 'Layers applied, first to last: ' + chain.map((k) => LAYERS[k].name).join(' -> ') + '\nUndo them last to first.' : 'The message in secret.enc is wrapped in ' + n + ' layers.\nTools: base64 -d, xxd -r -p, rev, tr.';
    return { motd: 'Layers upon layers.', hosts: { main: { name: 'arena', files: Object.assign(readme(note), { [GH + '/secret.enc']: t + '\n' }) } }, meta: { chain } };
  },
  solve: (b) => ['cat secret.enc' + b.meta.chain.slice().reverse().map((k) => ' | ' + LAYERS[k].cmd).join('')]
});

/* ---------------- rot ---------------- */
const lc = 'abcdefghijklmnopqrstuvwxyz', uc = lc.toUpperCase();
fam.push({
  id: 'rot', title: "Imperial Rotation", cat: 'Encoding', levels: 30, tier: (lv) => (lv <= 15 ? 1 : 2), type: 'flag',
  blurb: 'Rotate letters back with tr. The oldest cipher there is.',
  brief: (lv) => (lv <= 10 ? 'The text was shifted forward by the number in the README. Shift it back with the caesar tool or tr.' : 'The shift amount is not given. Only the first word is known: it must be the. Work out the shift, then undo it.'),
  build: (c, lv) => {
    const r = c.rnd, k = r.int(1, 25), msg = 'the vault key is ' + c.flag + ' keep it safe';
    const enc = rot(msg, k);
    let note = lv <= 10 ? 'Every letter was moved forward by ' + k + ' places in the alphabet.' : 'The text starts with the word "the". Its encoded form is "' + rot('the', k) + '".';
    return { motd: 'Every letter moved a few steps.', hosts: { main: { name: 'arena', files: Object.assign(readme(note), { [GH + '/msg.txt']: enc + '\n' }) } }, meta: { k } };
  },
  solve: (b) => ['cat msg.txt | caesar ' + (26 - b.meta.k)]
});

/* ---------------- subst ---------------- */
fam.push({
  id: 'subst', title: "Masquerade Cipher", cat: 'Encoding', levels: 25, tier: (lv) => (lv <= 10 ? 2 : 3), type: 'flag',
  blurb: 'A scrambled alphabet and tr with two sets.',
  brief: (lv) => 'Each letter of the message was swapped for another one, following a key. key.txt holds the cipher alphabet: the first letter stands for a, the second for b, and so on. ' + (lv > 8 ? 'The key file is stored backwards. ' : '') + 'Use tr KEY abc...xyz.',
  build: (c, lv) => {
    const r = c.rnd, key = r.shuffle(lc.split('')).join(''), fl = c.flag;
    const msg = 'this is the vault ' + word(r) + ' note ' + fl + ' end of message';
    const enc = msg.replace(/[a-z]/g, (ch) => key[lc.indexOf(ch)]);
    const kf = lv > 8 ? U.revs(key) : key;
    return { motd: 'Same letters, different faces.', hosts: { main: { name: 'arena', files: Object.assign(readme('msg.txt is encrypted with a substitution cipher. The key is in key.txt.' + (lv > 8 ? '\nThe key file is written backwards.' : '')), { [GH + '/msg.txt']: enc + '\n', [GH + '/key.txt']: kf + '\n' }) } }, meta: { key } };
  },
  solve: (b, lv) => ['cat msg.txt | tr ' + b.meta.key + ' abcdefghijklmnopqrstuvwxyz']
});

/* ---------------- hashmatch ---------------- */
fam.push({
  id: 'hashmatch', title: "Signet Inquest", cat: 'Crypto', levels: 25, tier: (lv) => (lv <= 12 ? 2 : 3), type: 'answer',
  blurb: 'Identify a file by its fingerprint. md5sum in a loop.',
  brief: () => 'The README gives the MD5 hash of one file in /srv/blobs. Hash every file, compare, and submit the file name (not the path).',
  build: (c, lv) => {
    const r = c.rnd, N = 20 + lv * 3, files = {}, names = uniqWords(r, N);
    const idx = r.int(0, N - 1); let target;
    names.forEach((nm, i) => { const content = 'blob ' + r.hex(24) + '\n'; files['/srv/blobs/' + nm + '.bin'] = content; if (i === idx) target = md5(content); });
    Object.assign(files, readme('Target MD5: ' + target + '\nWhich file in /srv/blobs has this hash? Submit the file name, like name.bin'));
    return { motd: 'Many files, one fingerprint.', hosts: { main: { name: 'arena', files } }, answer: names[idx] + '.bin', meta: { target } };
  },
  solve: (b) => ['for f in $(ls /srv/blobs); do md5sum /srv/blobs/$f; done | grep ' + b.meta.target]
});

/* ---------------- wordlist ---------------- */
fam.push({
  id: 'wordlist', title: "Siege of Lexicon", cat: 'Crypto', levels: 25, tier: (lv) => (lv <= 10 ? 2 : lv <= 20 ? 3 : 4), type: 'answer',
  blurb: 'Crack a weak password by hashing a wordlist.',
  brief: () => 'An unsalted MD5 hash of a password is in the README. The password is one of the words in wordlist.txt. Hash each word (echo WORD | md5sum) and compare. Submit the password.',
  build: (c, lv) => {
    const r = c.rnd, N = 40 + lv * 9, words = uniqWords(r, N).map((w) => w.replace('-', ''));
    const pw = r.pick(words);
    return { motd: 'The password is weak. Prove it.', hosts: { main: { name: 'arena', files: Object.assign(readme('Hash: ' + md5(pw + '\n') + '\nThe password is in wordlist.txt (hash made from echo WORD | md5sum).'), { [GH + '/wordlist.txt']: text(words) }) } }, answer: pw, meta: { h: md5(pw + '\n') } };
  },
  solve: (b) => ['for w in $(cat wordlist.txt); do echo "$w $(echo $w | md5sum)"; done | grep ' + b.meta.h]
});

module.exports = fam;
