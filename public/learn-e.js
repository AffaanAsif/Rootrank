/* Rootrank learning content, part 5: the Sovereign's Trial (Apex), deeper links, and command anatomy. */
(function () {
  var L = window.LEARN;
  L.paths.push({ id: 'sovereign', title: "The Sovereign's Trial", who: 'People who finished the other paths', blurb: 'Five brutal chains with no hand-holding. Every level mixes decoding, forensics, hash hunting, locked doors and pivoting, with decoys that look exactly like the real thing.', outcome: 'You can run a full operation on your own: find the trail, ignore the bait, and take the crown.', tracks: ['regicide', 'oubliette', 'ravens', 'labyrinth', 'ouroboros'] });

  L.tracks.regicide = {
    level: 'Apex', time: '8+ hours', uses: ['grep', 'base64', 'xxd', 'rev', 'tr', 'ssh', 'sshpass', 'chmod', 'sudo', 'find', 'sed'],
    hook: 'A full kill chain across several machines. Every host hides the way to the next one, and every host also hides bait.',
    start: ['Read the logs before you touch the backups. The log tells you which file is real.', 'Decode one layer at a time. Pipe each result into the next decoder.', 'On every new host, run the same routine: ls -a, notes, sudo -l, locked folders.'],
    lessons: [
      { t: 'Trust the log, not the filename', md: `A folder of ten backups looks like ten equal choices. It is not. Something wrote those files, and that something usually left a record. \`grep current /var/log/rotate.log\` takes one second and removes nine decoys.\n\nWhenever you face a pile of look-alikes, ask: **what wrote these, and where does it keep notes?**` },
      { t: 'Peeling encodings', md: `A value that looks like noise is usually a stack of simple encodings. Identify the outer one by its look, undo it, and repeat.\n\n- long text of letters, digits, \`+\` and \`/\` ending with \`=\` is base64: \`base64 -d\`\n- only 0-9 and a-f is hex: \`xxd -r -p\`\n- readable words backwards is reversed: \`rev\`\n- readable but with the wrong letters is rot13: \`tr 'A-Za-z' 'N-ZA-Mn-za-m'\`\n\nChain them: \`cat file | base64 -d | rev | xxd -r -p\`. If the result is still noise, you are not done.` },
      { t: 'The host routine', md: `Every machine gets the same five checks, in order:\n\n1. \`ls -la ~\` and read any notes\n2. \`ls -la ~/.ssh\` and read the config\n3. \`sudo -l\`\n4. look for locked folders and open them with \`chmod u+rx\`\n5. read what you unlocked\n\nA fixed routine stops you skipping the one file that matters.` }
    ]
  };
  L.tracks.oubliette = {
    level: 'Apex', time: '6+ hours', uses: ['cat', 'grep', 'find', 'md5sum', 'awk', 'base64', 'xxd', 'rev', 'tr'],
    hook: 'The warrant names a prisoner. The ledger holds a hash. Ninety cells look identical. Only one hash matches.',
    start: ['Read the warrant for the name. Beware of namesakes with the same first part.', 'Look the name up in the ledger to get its seal (a hash).', 'Hash every cell and keep only the one that matches.'],
    lessons: [
      { t: 'A hash is a fingerprint', md: `A hash function turns any file into a short fixed-length string. Change one byte and the whole string changes. That makes a hash perfect for answering "is this the exact file I am looking for?"\n\n\`md5sum FILE\` prints the hash. To check every file at once: \`find DIR -type f -exec md5sum {} \;\`. Then filter the output with \`grep HASH\`.` },
      { t: 'Exact matches only', md: `Searching a ledger for \`rupert\` also finds \`rupert-the-elder\`. Add the separator you know follows the name: \`grep rupert-3f, ledger.csv\`. Matching too loosely is the most common way to chase the wrong cell for an hour.` }
    ]
  };
  L.tracks.ravens = {
    level: 'Apex', time: '6+ hours', uses: ['grep', 'awk', 'sort', 'uniq', 'head', 'cat', 'base64', 'xxd', 'tr'],
    hook: 'Three suspects fail often. One of them then succeeds. Behaviour, not volume, gives the attacker away.',
    start: ['Count failed logins per address first.', 'Now list addresses that were accepted. Compare the two lists.', 'Follow the attacker into the web log to find which file they uploaded.'],
    lessons: [
      { t: 'Behaviour beats volume', md: `The loudest address in a log is rarely the one that got in. A real intruder shows a **sequence**: many failures, then a success. So you need two lists and an intersection:\n\n\`grep Failed auth.log | awk '{print $9}' | sort | uniq -c | sort -n -r\`\n\`grep Accepted auth.log | awk '{print $9}' | sort | uniq\`\n\nThe address in both lists is the suspect. Addresses that only failed were guessing and giving up. Addresses that only succeeded are your own users.` },
      { t: 'Pivoting between logs', md: `One log gives you a fact (an address). Another log gives you what that address did. \`grep ADDRESS web.log\` shows its requests. Look for POST requests to a drop path: that is where stolen data was uploaded.` }
    ]
  };
  L.tracks.labyrinth = {
    level: 'Apex', time: '6+ hours', uses: ['ls', 'chmod', 'cat', 'find', 'sudo'],
    hook: 'Doors inside doors, each one locked. At the end, a decree names a file only root can read, and one setuid helper can be talked into fetching it.',
    start: ['Run ls -la at every step and read the permission string.', 'chmod u+rx opens a folder you own, one door at a time, from the outside in.', 'Then list setuid files and find the one that trusts a path too much.'],
    lessons: [
      { t: 'Reading a permission string', md: `\`drwx------\` means a directory (\`d\`), where the owner can read, write and enter (\`rwx\`) and nobody else can do anything. A folder with no \`x\` cannot be entered, even by its owner, until you give it back: \`chmod u+rx FOLDER\`. Open them from the outermost inwards, because you cannot reach a locked folder inside another locked one.` },
      { t: 'Path traversal', md: `A helper that only reads from \`/var/seals\` usually checks that the path **starts with** \`/var/seals\`. It forgets that \`/var/seals/../../root/x\` starts with it too, and then walks back up the tree. That is path traversal. The check looks at the text, not at where the path really goes.` }
    ]
  };
  L.tracks.ouroboros = {
    level: 'Apex', time: '6+ hours', uses: ['cat', 'tail', 'base64', 'xxd', 'rev', 'tr'],
    hook: 'A chain of files, each naming the next behind an encoding. False links look identical to true ones.',
    start: ['Open the start file and read the first line.', 'Only TRUE LINK files lead anywhere. Ignore FALSE LINK.', 'Decode the pointer on the last line and open the file it names.'],
    lessons: [
      { t: 'Take notes as you go', md: `A chain of thirty links is easy if you keep a list of paths you have already visited. Write each decoded path down. If a result stops making sense, you can step back one link instead of starting over.` },
      { t: 'tail and pipes', md: `\`tail -n 1 FILE\` prints the last line. Piping it into a decoder gives you the next path in one command: \`cat FILE | tail -n 1 | base64 -d\`.` }
    ]
  };

  /* Deeper reading for the learn-first panel. Each is a real, free resource. */
  var J = ['Linux Journey', 'https://linuxjourney.com/'], BOOK = ['The Linux Command Line (free book)', 'https://linuxcommand.org/tlcl.php'], BANDIT = ['OverTheWire Bandit (practice)', 'https://overthewire.org/wargames/bandit/'], CHEF = ['CyberChef (decode anything)', 'https://gchq.github.io/CyberChef/'], EXPL = ['explainshell: paste any command', 'https://explainshell.com/'], GTFO = ['GTFOBins', 'https://gtfobins.github.io/'], ATT = ['MITRE ATT&CK', 'https://attack.mitre.org/'], RGX = ['regex101 (test patterns live)', 'https://regex101.com/'];
  function man(c) { return ['man ' + c + ' (the manual)', 'https://man7.org/linux/man-pages/man1/' + c + '.1.html']; }
  L.links = {
    nav: [J, man('ls'), BANDIT, BOOK], hidden: [man('ls'), J, BOOK], finder: [man('find'), EXPL, BOOK], perms: [man('chmod'), J, EXPL], slice: [man('cut'), man('sed'), EXPL], counter: [man('sort'), man('uniq'), EXPL],
    grepper: [man('grep'), RGX, EXPL], regex: [RGX, man('grep'), BOOK], ranker: [man('sort'), man('uniq'), man('awk')], columns: [man('awk'), man('cut'), EXPL], sedlab: [man('sed'), EXPL, BOOK],
    b64: [CHEF, man('base64'), ['Base64 on Wikipedia', 'https://en.wikipedia.org/wiki/Base64']], rot: [CHEF, ['Caesar cipher on Wikipedia', 'https://en.wikipedia.org/wiki/Caesar_cipher']], subst: [CHEF, ['Substitution cipher on Wikipedia', 'https://en.wikipedia.org/wiki/Substitution_cipher']], layers: [CHEF, man('xxd'), man('base64')],
    hashmatch: [man('md5sum'), ['Cryptographic hash functions', 'https://en.wikipedia.org/wiki/Cryptographic_hash_function'], CHEF], wordlist: [['Password cracking explained', 'https://en.wikipedia.org/wiki/Password_cracking'], man('md5sum'), CHEF],
    weblog: [man('grep'), man('awk'), ATT], authlog: [man('grep'), ['sshd on Linux: auth logs', 'https://man7.org/linux/man-pages/man8/sshd.8.html'], ATT], timeline: [man('sort'), ATT, J], agents: [['User-Agent on MDN', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent'], man('grep'), ATT], dnslog: [['DNS exfiltration (MITRE)', 'https://attack.mitre.org/techniques/T1048/'], man('awk'), ATT], malware: [man('strings'), man('file'), ATT], incident: [['NIST incident handling guide', 'https://csrc.nist.gov/pubs/sp/800/61/r2/final'], ATT, J],
    cronchain: [['crontab.guru (read a schedule)', 'https://crontab.guru/'], man('crontab'), J], secrets: [man('grep'), ['Git secrets hunting (OWASP)', 'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password'], EXPL], passwd: [['passwd(5) file format', 'https://man7.org/linux/man-pages/man5/passwd.5.html'], man('awk'), J], sshcfg: [['ssh_config(5)', 'https://man7.org/linux/man-pages/man5/ssh_config.5.html'], man('ssh'), J], services: [man('grep'), ['Ports and protocols', 'https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers'], J],
    sudoer: [man('sudo'), GTFO, J], suid: [GTFO, man('find'), J], audit: [man('chmod'), GTFO, J], hops: [man('ssh'), ['SSH tunnels explained', 'https://www.ssh.com/academy/ssh/tunneling'], ATT], drops: [man('ssh'), ATT, J], gauntlet: [GTFO, ATT, BANDIT],
    regicide: [man('ssh'), GTFO, CHEF], oubliette: [man('md5sum'), CHEF, EXPL], ravens: [man('awk'), ATT, EXPL], labyrinth: [man('chmod'), ['Path traversal (OWASP)', 'https://owasp.org/www-community/attacks/Path_Traversal'], GTFO], ouroboros: [CHEF, man('tail'), EXPL]
  };

  /* Command anatomy for the field guide: flags and arguments, then a worked example. */
  L.anat = {
    ls: { parts: [['ls', 'command'], ['-l', 'long view'], ['-a', 'hidden too'], ['notes', 'folder']], tip: '.stash only appears with -a. Attackers hide things the same way.', out: '.  ..  README.txt  .stash  notes' },
    pwd: { parts: [['pwd', 'command']], tip: 'No arguments. Run it any time you feel lost.', out: '/home/guest' },
    cd: { parts: [['cd', 'command'], ['notes', 'where to go']], tip: 'cd .. goes up one level. cd with nothing goes home.', out: '(no output, but your prompt changes)' },
    cat: { parts: [['cat', 'command'], ['README.txt', 'file to print']], tip: 'cat with several files prints them one after another.', out: 'The flag is at the end of the path.' },
    find: { parts: [['find', 'command'], ['/srv', 'start here'], ['-name', 'match name'], ['"*.txt"', 'pattern']], tip: 'Add -exec cat {} \; to read every file it finds.', out: '/srv/vault/notes.txt' },
    grep: { parts: [['grep', 'command'], ['-i', 'ignore case'], ['error', 'pattern'], ['app.log', 'file']], tip: '-c counts matches, -v inverts, -r searches folders.', out: 'ERROR disk full' },
    sort: { parts: [['sort', 'command'], ['-n', 'numeric'], ['-r', 'reverse']], tip: 'Sort before uniq. uniq only collapses neighbours.', out: '42\n17\n9' },
    uniq: { parts: [['uniq', 'command'], ['-c', 'count']], tip: 'Always sort first: sort | uniq -c', out: '  3 alice\n  1 bob' },
    cut: { parts: [['cut', 'command'], ['-d:', 'separator'], ['-f1', 'field 1']], tip: 'cut -d, -f2 reads the second column of a CSV.', out: 'root\nguest' },
    awk: { parts: [['awk', 'command'], ['-F:', 'separator'], ["'{print $1}'", 'action']], tip: '$1 is the first field, $NF is the last.', out: 'root\nguest' },
    sed: { parts: [['sed', 'command'], ["'s/old/new/g'", 'replace'], ['file', 'input']], tip: "sed -n '2p' prints only line 2.", out: 'the new text' },
    tr: { parts: [['tr', 'command'], ["'a-z'", 'from'], ["'A-Z'", 'to']], tip: "tr 'A-Za-z' 'N-ZA-Mn-za-m' decodes rot13.", out: 'HELLO' },
    rev: { parts: [['rev', 'command']], tip: 'Reverses each line. Text that reads backwards is a clue.', out: 'olleh' },
    base64: { parts: [['base64', 'command'], ['-d', 'decode']], tip: 'Ends with = or == often. It is encoding, not encryption.', out: 'hello world' },
    xxd: { parts: [['xxd', 'command'], ['-r', 'reverse'], ['-p', 'plain hex']], tip: 'xxd -r -p turns a hex string back into text.', out: 'hello' },
    chmod: { parts: [['chmod', 'command'], ['u+rx', 'owner gets read, enter'], ['folder', 'target']], tip: 'Numbers work too: chmod 700 folder.', out: '(no output when it works)' },
    sudo: { parts: [['sudo', 'command'], ['-l', 'list my rights']], tip: 'Even a plain reader allowed by sudo can read root files.', out: '(root) NOPASSWD: /usr/bin/find' },
    ssh: { parts: [['ssh', 'command'], ['-i key', 'use this key'], ['ops@app01', 'user at host']], tip: 'sshpass -p PASSWORD ssh user@host logs in with a password.', out: 'ops@app01:~$' },
    head: { parts: [['head', 'command'], ['-n 5', 'first 5 lines']], tip: 'tail is the same, from the end.', out: '(first five lines)' },
    tail: { parts: [['tail', 'command'], ['-n 1', 'last line']], tip: 'tail -n 1 is perfect for the pointer line in a file.', out: '(the last line)' },
    wc: { parts: [['wc', 'command'], ['-l', 'count lines']], tip: 'grep ... | wc -l counts matching lines.', out: '42' },
    md5sum: { parts: [['md5sum', 'command'], ['file', 'what to hash']], tip: 'Two files with the same hash have identical contents.', out: '9e107d9d372bb6826bd81d3542a419d6  file' }
  };
})();
