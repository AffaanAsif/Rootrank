/* Rootrank learning content, part 1: command glossary, career paths, foundation courses. */
window.LEARN = { cmds: {}, paths: [], tracks: {} };

window.LEARN.cmds = {
  ls: ['List what is inside a folder.', 'ls -a'],
  cd: ['Move into a folder. cd .. goes back up.', 'cd /srv/vault'],
  pwd: ['Print where you are right now.', 'pwd'],
  cat: ['Print a whole file.', 'cat README.txt'],
  head: ['Show the first lines of a file.', 'head -n 5 data.txt'],
  tail: ['Show the last lines of a file.', 'tail -n 5 data.txt'],
  sed: ['Print exact lines, or replace text.', "sed -n 12p data.txt"],
  grep: ['Search for text. -r searches folders, -i ignores case, -v flips the match.', 'grep -r token /var/log'],
  find: ['Search the filesystem by name, owner or permissions.', 'find / -name flag.txt'],
  wc: ['Count lines (-l), words or bytes.', 'wc -l file.txt'],
  sort: ['Sort lines. -n numeric, -r reverse, -u unique.', 'sort -u names.txt'],
  uniq: ['Collapse repeated neighbours. -c counts them.', 'sort | uniq -c'],
  cut: ['Pick columns out of each line.', "cut -d' ' -f1 access.log"],
  awk: ['Filter rows and add up columns.', "awk '{s+=$7} END {print s}' file"],
  tr: ['Swap or delete characters.', "tr 'a-z' 'A-Z'"],
  rev: ['Reverse each line of text.', 'echo abc | rev'],
  chmod: ['Change who may read, write or run a file.', 'chmod 755 folder'],
  base64: ['Decode (-d) or encode base64 text.', 'echo SGk= | base64 -d'],
  xxd: ['Turn hex back into text with -r -p.', 'echo 6869 | xxd -r -p'],
  md5sum: ['Fingerprint a file or text.', 'md5sum file'],
  caesar: ['Shift letters forward by N (a training tool).', 'caesar 13'],
  sudo: ['Run one command as root, if the rules allow it. sudo -l lists the rules.', 'sudo -l'],
  ssh: ['Log in to another machine. -i uses a key file.', 'ssh -i ~/.ssh/id_x user@host'],
  sshpass: ['Log in with a password: sshpass -p PASS ssh user@host.', 'sshpass -p secret ssh ops@db01'],
  echo: ['Print text. Great for feeding pipes.', 'echo hello'],
  man: ['Show a short manual for any command.', 'man grep'],
  help: ['List every command this terminal knows.', 'help'],
  seq: ['Print a run of numbers.', 'seq 1 5'],
  file: ['Guess what kind of file something is.', 'file mystery'],
  touch: ['Create an empty file.', 'touch notes.txt'],
  mkdir: ['Create a folder.', 'mkdir work']
};

window.LEARN.paths = [
  { id: 'foundations', title: 'Linux Foundations', who: 'Complete beginners', blurb: 'Never opened a terminal? Start here. You will move around, find things, read files and fix permissions.', outcome: 'You can navigate any Linux box, search it, and read what matters.', tracks: ['nav', 'hidden', 'finder', 'perms', 'slice', 'counter'] },
  { id: 'ethical', title: 'Ethical Hacker', who: 'Aspiring penetration testers', blurb: 'The usual first steps of a security test: search for secrets, read system files, spot weak sudo and setuid setups.', outcome: 'You can enumerate a machine and explain what is risky about it.', tracks: ['grepper', 'regex', 'b64', 'secrets', 'passwd', 'sshcfg', 'services', 'sudoer', 'suid', 'audit'] },
  { id: 'redteam', title: 'Red Team Operator', who: 'Future attackers', blurb: 'Chain small wins into a full intrusion: loot credentials, pivot across machines, then escalate.', outcome: 'You can run a multi-step attack chain from first foothold to root.', tracks: ['cronchain', 'wordlist', 'layers', 'hops', 'drops', 'gauntlet'] },
  { id: 'blueteam', title: 'SOC Analyst', who: 'Defenders and incident responders', blurb: 'Read logs like a detective. Catch brute force, odd user agents and data leaving through DNS.', outcome: 'You can turn raw logs into a clear story of what an attacker did.', tracks: ['ranker', 'weblog', 'authlog', 'agents', 'timeline', 'dnslog', 'malware', 'incident'] },
  { id: 'cipher', title: 'Code Breaker', who: 'Puzzle lovers', blurb: 'Encodings, ciphers and hashes. Peel layers, break weak passwords, and learn why some secrets are not secret.', outcome: 'You can recognise and undo the common encodings and weak ciphers.', tracks: ['b64', 'rot', 'subst', 'layers', 'hashmatch', 'wordlist'] }
];

window.LEARN.tracks = {
  nav: {
    level: 'Beginner', time: '1 hour', uses: ['pwd', 'ls', 'cd', 'cat', 'find'],
    hook: 'A Linux machine is a building. Folders are rooms, files are the things inside. You have a map in your head, but nobody gave you a floor plan, so you will learn to look around.',
    start: ['Run cat README.txt. It tells you where the flag is.', 'Use ls to look at the room you are in.', 'Use cd to walk into the next room. Repeat until you reach the flag.', 'Run cat flag.txt and paste what you see into the box.'],
    lessons: [
      { t: 'Where am I?', md: `Every command runs from a place, called your **working directory**. Three commands answer almost every question you will have at the start:

- \`pwd\` tells you where you are.
- \`ls\` lists what is in this folder.
- \`cd NAME\` walks into a folder.

\`\`\`
$ pwd
/home/guest
$ ls
README.txt  notes.txt
$ cd /srv
$ pwd
/srv
\`\`\`

A path that starts with **/** is absolute: it works from anywhere. A path without it is relative to where you stand. \`cd ..\` goes up one level.` },
      { t: 'Reading, and searching', md: `\`cat FILE\` prints a file. That is it. Folders full of folders are tiring to walk by hand, so there is a better way: **find** walks the tree for you.

\`\`\`
$ find /srv -name flag.txt
/srv/vault/ember-0/glyph-1/flag.txt
$ cat /srv/vault/ember-0/glyph-1/flag.txt
flag{...}
\`\`\`

Rule of thumb: when you know where to look, use cd and ls. When you know what you are looking for, use find.` }
    ]
  },
  hidden: {
    level: 'Beginner', time: '45 min', uses: ['ls', 'cd', 'cat', 'find'],
    hook: 'Some files do not want to be seen. Linux has a simple trick for that, and it is used by everyone from honest developers to attackers: put a dot in front of the name.',
    start: ['Run ls. Nothing interesting, right?', 'Run ls -a. The dot files appear.', 'Follow the hidden folders one by one, or use find with -name.', 'Read the file named .secret.'],
    lessons: [
      { t: 'The dot trick', md: `A name that starts with **.** is hidden from a plain \`ls\`. Nothing is encrypted, it is just not listed.

\`\`\`
$ ls
README.txt  notes.txt
$ ls -a
.  ..  .cache  .config  README.txt  notes.txt
\`\`\`

\`.\` means "this folder" and \`..\` means "the folder above". Everything else is a real hidden file or folder.` },
      { t: 'Hiding in plain sight', md: `Hidden folders can hold more hidden folders. Instead of opening each one, ask find:

\`\`\`
$ find /home/guest -name ".secret"
/home/guest/.ember2/.falcon1/.secret
\`\`\`

Attackers like dot files because admins forget about them. So do you now: always run \`ls -a\` in a new place.` }
    ]
  },
  finder: {
    level: 'Beginner', time: '1 hour', uses: ['find', 'cat'],
    hook: 'Imagine a drawer with fifty similar keys and a note saying "it is the brass one, owned by Dave, with a notch on the left". find is how you describe a thing, instead of checking each one.',
    start: ['Read the README. It lists the conditions the file meets.', 'Turn each condition into a find test: -name, -user, -perm.', 'Combine them in one command. Only one file should come back.', 'Add -exec cat {} \\; to read it.'],
    lessons: [
      { t: 'Describe it, do not hunt it', md: `\`find WHERE TESTS\` prints every file below WHERE that passes all the tests.

- \`-name "pattern*"\` by name (always quote it)
- \`-type f\` regular files only
- \`-user ops\` owned by ops
- \`-perm 644\` exactly this permission

\`\`\`
$ find /srv/data -type f -name "key-*.pem" -user ops
/srv/data/b2/key-91ae.pem
\`\`\`

Add tests one at a time and watch the list shrink. That is how you zero in.` },
      { t: 'Do something with the result', md: `\`-exec COMMAND {} \\;\` runs a command on every match. \`{}\` is the file that was found.

\`\`\`
$ find /srv/data -name "key-*.pem" -user ops -exec cat {} \\;
-----BEGIN PRETEND KEY-----
...
\`\`\`

Read it as: for each match, run \`cat <match>\`.` }
    ]
  },
  perms: {
    level: 'Beginner', time: '1 hour', uses: ['ls', 'chmod', 'cat'],
    hook: 'Linux decides who may touch what with three tiny switches per person: read, write, execute. Once you can read those switches, half of all "access denied" errors will make sense.',
    start: ['Run ls -l to see the permission string of each thing.', 'Start at the top folder: you cannot enter it until it has x.', 'chmod 755 FOLDER, then go in. Repeat for each locked folder.', 'chmod u+r on the note, then cat it.'],
    lessons: [
      { t: 'Reading the permission string', md: `\`ls -l\` shows something like \`-rw-r-----\`.

- First character: **-** file, **d** folder.
- Next three: the owner. Next three: the group. Last three: everyone else.
- **r** read (4), **w** write (2), **x** execute (1).

\`\`\`
$ ls -l
drwx------ guest guest vault
-rw------- guest guest note.txt
\`\`\`

For a **folder**, x means "may enter". Without it you cannot go inside, even if you can list it.` },
      { t: 'Changing them with chmod', md: `Add the numbers up per person: 7 = rwx, 6 = rw-, 5 = r-x, 4 = r--.

\`\`\`
$ chmod 755 vault        # owner rwx, others r-x
$ chmod u+r note.txt     # give the owner read
$ cat note.txt
\`\`\`

You can only change permissions on things you own. On a locked path, go top-down: open the outer door before the inner one.` }
    ]
  },
  slice: {
    level: 'Beginner', time: '45 min', uses: ['head', 'tail', 'sed', 'cat'],
    hook: 'A log file can have a million lines. You will never scroll through it. You will ask for exactly line 412, or the last ten, and move on.',
    start: ['Read the README. It says which line, and from which end.', 'Use sed -n NUMp FILE to print one line.', 'If counting from the end, use tail -n N FILE | head -n 1.', 'The flag looks like secret = flag{...}. Paste the flag part.'],
    lessons: [
      { t: 'Top and bottom', md: `\`head\` shows the start of a file, \`tail\` the end.

\`\`\`
$ head -n 3 data.txt
$ tail -n 2 data.txt
\`\`\`

The number after **-n** is how many lines.` },
      { t: 'Pipes: one line out of the middle', md: `A pipe \`|\` feeds the output of one command into the next. To get line 120, take the first 120 lines, then keep only the last one:

\`\`\`
$ head -n 120 data.txt | tail -n 1
\`\`\`

Or let sed do it in one go: \`sed -n 120p data.txt\`. Both are worth knowing. Pipes are the main idea of the whole terminal.` }
    ]
  },
  counter: {
    level: 'Beginner', time: '1 hour', uses: ['grep', 'wc', 'sort', 'find', 'cut'],
    hook: 'Analysts do not count with their eyes. They ask the machine "how many?" and trust it. This is the first step towards thinking like one.',
    start: ['Read the README for the question.', 'Pick the counting trick: grep -c for lines, find | wc -l for files, sort -u | wc -l for different values.', 'Run it, then submit just the number.'],
    lessons: [
      { t: 'Counting lines and files', md: `\`\`\`
$ grep -c ERROR app.log      # lines that contain ERROR
$ grep -vc INFO app.log      # lines that do NOT contain INFO
$ find /srv/inbox -name "*.csv" | wc -l   # how many files
\`\`\`

\`wc -l\` counts lines of whatever flows into it.` },
      { t: 'Counting different things', md: `"How many different IPs?" means removing duplicates first.

\`\`\`
$ cut -d' ' -f1 hits.log | sort -u | wc -l
\`\`\`

cut picks the column, sort -u keeps each value once, wc -l counts them. Memorise this shape. You will use it for the rest of your career.` }
    ]
  },
  grepper: {
    level: 'Intermediate', time: '1.5 hours', uses: ['grep', 'cat', 'ls'],
    hook: 'grep is the most used security tool nobody calls a security tool. Attackers use it to find passwords in files, defenders use it to find attackers in logs.',
    start: ['Read the README: it describes the line you are after.', 'Search every file with grep -r.', 'Too many matches? Pipe into a second grep, with -v to drop noise.', 'Copy the flag out of the matching line.'],
    lessons: [
      { t: 'Search everything', md: `\`\`\`
$ grep -r LEAK /var/log/svc
/var/log/svc/echo-4fc.log:2026-11-26T10:02:11Z LEAK token=flag{...}
\`\`\`

-r goes through every file below the folder and prints the file name before each match. Add -i if capitalisation might differ, -n for line numbers.` },
      { t: 'Narrow it down', md: `Chain greps. The first finds candidates, the second removes the noise.

\`\`\`
$ grep -r ERROR /var/log/svc | grep -v timeout
\`\`\`

\`-w\` matches whole words only, so \`key\` will not match \`keyboard\` or \`monkey\`.` }
    ]
  },
  regex: {
    level: 'Intermediate', time: '2 hours', uses: ['grep'],
    hook: 'A regular expression is a tiny language for describing the shape of text. "Four digits, a dash, two digits" is a shape. Once you can say it, the machine can find every one.',
    start: ['Read the README: which kind of value are you hunting?', 'Write the shape of a real one: how many characters, which characters.', 'grep -Eo "SHAPE" dump.txt prints only the matches.', 'Fakes are the wrong length or contain wrong characters. Tighten the shape until one value is left.'],
    lessons: [
      { t: 'The building blocks', md: `- \`[0-9]\` one digit, \`[a-f0-9]\` one hex character
- \`{8}\` exactly eight of the previous thing, \`{2,4}\` two to four
- \`+\` one or more, \`?\` optional
- \`\\b\` a word edge, so a match cannot be a piece of something longer

\`\`\`
$ echo "id 4821 and 99" | grep -Eo "\\b[0-9]{4}\\b"
4821
\`\`\`` },
      { t: 'Shape of a real value', md: `A UUID is 8-4-4-4-12 hex characters:

\`\`\`
$ grep -Eo "\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b" dump.txt
\`\`\`

Fakes in the dump are one character too short, too long, or use another separator. Because every part has an exact count and \\b guards the ends, only the real one survives.` }
    ]
  },
  ranker: {
    level: 'Intermediate', time: '1 hour', uses: ['cut', 'sort', 'uniq', 'head'],
    hook: 'Who talks most? Which page is hit hardest? Which status code is climbing? Ranking is the oldest question in data, and four small commands answer it.',
    start: ['Find out which column holds what you are ranking (ip user path status).', 'cut that column out.', 'sort, then uniq -c, then sort -nr.', 'head -n K | tail -n 1 gives place number K.'],
    lessons: [
      { t: 'The ranking pipeline', md: `\`\`\`
$ cut -d' ' -f1 traffic.log | sort | uniq -c | sort -nr | head -n 3
 412 203.0.113.9
 300 198.51.100.4
 188 192.0.2.77
\`\`\`

1. **cut** takes one column.
2. **sort** puts equal values next to each other.
3. **uniq -c** counts each group (it only merges neighbours, so sorting first is a must).
4. **sort -nr** puts the biggest count on top.` },
      { t: 'Second and third place', md: `\`head -n 2 | tail -n 1\` keeps only the 2nd line, which is the 2nd most frequent value. Change 2 for any other place.

Try the pipeline one stage at a time while you learn: run \`cut ...\`, then add \`| sort\`, then the next piece. You see what each stage does.` }
    ]
  },
  columns: {
    level: 'Intermediate', time: '1.5 hours', uses: ['cut', 'grep', 'sort', 'awk'],
    hook: 'A CSV is a spreadsheet wearing a text file costume. The terminal can sort it, filter it and add it up faster than any app you have opened.',
    start: ['Columns are id,name,dept,salary,city.', 'grep picks the rows, cut picks the column.', 'For the highest, sort numerically on column 4.', 'For totals, awk adds up a column.'],
    lessons: [
      { t: 'Rows and columns', md: `\`\`\`
$ grep sales staff.csv | cut -d, -f2,4
nina,84200
omar,61300
\`\`\`

\`-d,\` means "columns are separated by commas", \`-f2,4\` means "keep columns 2 and 4".` },
      { t: 'Sorting and adding', md: `\`\`\`
$ sort -t, -k4 -nr staff.csv | head -n 1     # highest salary
$ awk -F, '{s+=$4} END {print s}' staff.csv   # total of column 4
$ awk -F, '$1==105 {print $4}' staff.csv      # column 4 for id 105
\`\`\`

\`-t,\` is the separator for sort, \`-k4\` the column, \`-n\` numeric, \`-r\` biggest first.` }
    ]
  },
  sedlab: {
    level: 'Intermediate', time: '45 min', uses: ['sed', 'cat'],
    hook: 'Messy data is the normal state of the world. sed lets you clean text as it flows by, with find and replace that runs on a whole file at once.',
    start: ['The README lists each junk token mixed into the message.', 'sed "s/JUNK//g" deletes every copy of JUNK.', 'Chain one sed per kind of junk with pipes.'],
    lessons: [
      { t: 'Find and replace', md: `\`\`\`
$ echo "fl##ag{ab}" | sed 's/##//g'
flag{ab}
\`\`\`

\`s/old/new/g\`: **s** substitute, **g** every match on the line, not only the first. An empty new text deletes.` },
      { t: 'Several cleanups', md: `\`\`\`
$ cat msg.txt | sed 's/@@//g' | sed 's/~~//g'
\`\`\`

Each sed handles one kind of junk. Order does not matter as long as the junk tokens do not overlap.` }
    ]
  }
};
