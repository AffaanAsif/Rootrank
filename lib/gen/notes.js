'use strict';
const N = (notes, hints) => ({ notes: notes.trim(), hints });
module.exports = {
  nav: N(`
## Moving around
- \`pwd\` shows where you are. \`ls\` lists the folder. \`ls -l\` shows owners and permission bits. \`ls -a\` also shows hidden names.
- \`cd DIR\` goes into a folder, \`cd ..\` goes up one level.
- \`cat FILE\` prints a file.

## Searching instead of walking
\`find PATH -name NAME\` walks the whole tree for you. Add \`-exec cat {} \;\` to read whatever it finds.`,
  ['Read README.txt first. It tells you where to look.', 'Use ls after every cd. Folders full of decoys are normal.', 'When the tree is too deep, let find do the walking: find /srv/vault -name flag.txt']),
  hidden: N(`
## Dot files
A name that starts with a dot is hidden from plain \`ls\`. Use \`ls -a\` to show everything. Folders can be hidden too, and the hidden folder can hold more hidden folders.

\`find /home/guest -name ".*"\` lists every hidden name below your home.`,
  ['ls shows nothing special. Try ls -a.', 'The flag is inside a chain of hidden folders. Follow them one by one.', 'find /home/guest -name .secret -exec cat {} \;']),
  finder: N(`
## find tests
- \`-name 'pat*'\` match by name (quote the pattern).
- \`-type f\` regular files, \`-type d\` folders.
- \`-user NAME\` owner. \`-perm 644\` exact mode, \`-perm -002\` has at least these bits.
- Combine tests: all of them must match.

When there are dozens of look-alikes, add one test at a time and watch the result list shrink.`,
  ['The README lists every condition. Turn each one into a find test.', 'Quote wildcard names: -name "drift-*.key"', 'End with -exec cat {} \; to read the match.']),
  perms: N(`
## Permission bits
Each file has owner, group and other bits: r (read, 4), w (write, 2), x (execute, 1).
- \`755\` = rwxr-xr-x. \`600\` = rw-------.
- Folders need **x** to be entered and **r** to be listed.
- \`chmod 755 DIR\`, \`chmod u+r FILE\` change them, if you own the thing.

To reach a locked file you must open every locked folder on the way.`,
  ['ls -l shows who owns what. You own everything in lab.', 'Start at the top folder. A folder you cannot enter hides everything below.', 'chmod 755 each folder in order, then chmod u+r on the note.']),
  slice: N(`
## Picking lines
- \`head -n 5 FILE\` first 5 lines, \`tail -n 5 FILE\` last 5.
- \`sed -n 120p FILE\` prints line 120. \`sed -n 3,6p FILE\` prints lines 3 to 6.
- Pipes combine them: \`head -n 120 FILE | tail -n 1\` is line 120.`,
  ['Read the README: it tells you which line, counted from which end.', 'sed -n NUMp FILE prints one exact line.', 'Counting from the end? tail -n N FILE | head -n 1']),
  counter: N(`
## Counting
- \`grep -c WORD FILE\` counts matching lines. \`-v\` inverts the match.
- \`wc -l\` counts lines of its input.
- \`sort -u\` removes duplicates, so \`sort -u | wc -l\` counts distinct values.
- \`find ... | wc -l\` counts files.`,
  ['Decide what you are counting: lines, files, or different values.', 'For different values: cut out the column, sort -u, wc -l.', 'Do not count by eye. The numbers are big on purpose.']),
  grepper: N(`
## grep options
- \`-r\` search every file under a folder. \`-i\` ignore case. \`-v\` invert. \`-w\` whole words only.
- Chain greps with pipes: keep one pattern, drop another.
- \`-n\` adds line numbers, \`-o\` prints only the match.`,
  ['grep -r PATTERN /var/log/svc searches all files.', 'If nothing matches, the case may differ. Try -i.', 'Too many matches? Pipe into a second grep, with -v to drop a pattern.']),
  regex: N(`
## Regular expressions
- \`.\` any char, \`[0-9]\` a digit, \`[a-f0-9]\` hex, \`{8}\` exactly eight, \`+\` one or more, \`?\` optional.
- \`\\b\` marks a word edge, so a match cannot be a piece of something longer.
- \`grep -Eo 'PATTERN' FILE\` prints only what matched.

Fakes usually fail on length or on edge characters. Describe the real shape exactly.`,
  ['Fake values are the wrong length or have bad characters. Be exact.', 'Anchor the pattern with \\b so longer strings do not match.', 'Test your pattern: it should print exactly one value.']),
  ranker: N(`
## The classic pipeline
\`cut -d' ' -f3 FILE | sort | uniq -c | sort -nr | head\`
1. cut picks one column.
2. sort groups equal values together.
3. uniq -c counts each group.
4. sort -nr puts the biggest count first.`,
  ['Which column holds the thing you rank? Count the fields.', 'uniq only merges neighbours, so sort before it.', 'For the 2nd or 3rd place, head -n K | tail -n 1']),
  columns: N(`
## Tables in text
- \`cut -d, -f2 FILE\` picks column 2 of a comma file.
- \`sort -t, -k4 -nr FILE\` sorts on column 4, numerically, biggest first.
- \`awk -F, '$1==105 {print $4}' FILE\` filters rows. \`awk -F, '{s+=$4} END {print s}'\` sums a column.`,
  ['Columns are: id,name,dept,salary,city.', 'grep picks the rows, cut picks the column.', 'Sums need awk. Highest needs sort -nr.']),
  sedlab: N(`
## sed substitution
\`sed 's/old/new/g'\` replaces every old with new. Leave new empty to delete. Pipe several seds to remove several kinds of junk.`,
  ['The README lists each junk token.', 'sed "s/#//g" removes every #.', 'cat msg.txt | sed ... | sed ... chains removals.']),
  b64: N(`
## Base64
Base64 turns bytes into letters, digits, + and /, often ending in = or ==. It is **not** encryption. Anyone can decode it:
\`echo STRING | base64 -d\` or \`base64 -d FILE\`.

Loops let you decode many lines: \`for l in $(cat FILE); do echo $l | base64 -d; done\``,
  ['Trailing = signs are the base64 giveaway.', 'base64 -d FILE decodes a file.', 'Many lines? Loop over them, decode each, grep for flag.']),
  layers: N(`
## Peeling layers
Real data is often wrapped several times. Identify each layer by how it looks:
- ends with = and uses A-Za-z0-9+/ : base64
- only 0-9 and a-f, even length : hex (\`xxd -r -p\`)
- reads backwards : \`rev\`
- letters shifted : rot13 (\`tr\`)

Pipe the decoders in reverse order of the encoding.`,
  ['Look at the output of each step, it tells you what the next layer is.', 'Layers come off in reverse order.', 'cat secret.enc | base64 -d | rev | ... one decoder at a time.']),
  rot: N(`
## Caesar shift
Each letter moves a fixed number of places. Undo it by shifting the other way: shifting by k then by 26-k gives the original.
\`caesar N\` shifts forward by N. The \`tr\` command can do it with two alphabets.`,
  ['If the text was shifted forward by k, shift forward by 26-k.', 'cat msg.txt | caesar N', 'Unknown shift? The word "the" gives it away.']),
  subst: N(`
## Substitution ciphers
Every letter is replaced by another one following a fixed key. \`tr KEY abcdefghijklmnopqrstuvwxyz\` maps the key letters back to the normal alphabet.`,
  ['key.txt is the cipher alphabet: first letter stands for a, second for b.', 'Key written backwards? Run it through rev first.', 'cat msg.txt | tr KEY abcdefghijklmnopqrstuvwxyz']),
  hashmatch: N(`
## Hashes as fingerprints
\`md5sum FILE\` prints a fixed-length fingerprint of a file. Same bytes, same hash. You can find a file from its hash alone by hashing every candidate and comparing.`,
  ['Hash every file in a loop.', 'for f in $(ls /srv/blobs); do md5sum /srv/blobs/$f; done', 'Pipe the loop into grep with the target hash.']),
  wordlist: N(`
## Weak passwords
An unsalted hash of a common password can be reversed by hashing a list of likely words and comparing. This is why password hashes need salts and slow algorithms.`,
  ['Make a loop that prints each word next to its hash.', 'echo "$w $(echo $w | md5sum)"', 'grep the target hash to see which word made it.']),
  weblog: N(`
## Reading access logs
Each line is one request. Slice it with cut -d' ' -f, count with grep -c, rank with sort | uniq -c | sort -nr, add numbers with awk. Quote patterns that include spaces so you match whole fields.`,
  ['Pick the field you need, count the fields from 1.', 'Lookalikes exist: add spaces to your pattern to match whole fields.', 'To total bytes: grep the IP, then awk \'{s+=$7} END {print s}\'']),
  authlog: N(`
## auth.log
sshd writes one line per attempt: Failed password for USER from IP, or Accepted password for USER from IP. Brute force looks like many Failed lines from one IP, then one Accepted. sudo lines show who ran what as root.`,
  ['Filter by word first: grep Failed, grep Accepted, grep sudo.', 'grep -o "from [0-9.]*" isolates the address.', 'Use sort | uniq -c | sort -nr to rank, head -n 1 for the winner.']),
  timeline: N(`
## Merging time
ISO timestamps (2026-11-26T10:00:00Z) sort correctly as plain text. Merge several logs with cat, then sort. head and tail give the first and last event.`,
  ['cat all four logs together first.', 'grep ERROR, then sort.', 'head -n 1 is the earliest, tail -n 1 the latest.']),
  agents: N(`
## User agents
The user agent names the client. Browsers look alike, but scanners and scripts announce themselves: sqlmap, Nikto, curl, python-requests. Bots usually contain the word bot.`,
  ['cut -d" " -f2 isolates the user agent.', 'For counts of distinct values: sort -u | wc -l.', 'Search for the odd one with grep -E "a|b".']),
  dnslog: N(`
## DNS exfiltration
Attackers hide data inside DNS names: chunk.chunk.evil.com. The resolver log records every query, so the data sits in plain sight.
1. grep the attacker's domain.
2. cut out the query name, sort by the sequence label.
3. join the chunks with tr -d "\\n".
4. decode (hex with xxd -r -p, then maybe base64).`,
  ['Only queries to the domain from the README matter.', 'sort -t. -k1 -n orders by the first label.', 'Join with tr -d "\\n" before decoding.']),
  malware: N(`
## Reading a sample safely
Never run it. Read it. Droppers hide their server in base64, hex, reversed text or pieces joined at run time. Decode what you find and join the pieces by hand.`,
  ['A string with only A-Za-z0-9+/= is likely base64.', 'Pieces named p1, p2, p3 are joined in order.', 'tr -d "\\n" joins lines into one.']),
  incident: N(`
## Following a trail
An incident is a chain of small facts. Each answer becomes the input to the next question: attacker IP, then what they touched, then where it was stored. Write each result down before the next step.`,
  ['Follow the numbered steps in the README, one at a time.', 'Quote results into the next command.', 'Do not skip a step. Decoys are everywhere.']),
  cronchain: N(`
## Cron and sourcing
Files in /etc/cron.d name the script a job runs. A script can \`source\` or include another file, and config files often hold secrets in plain text. Read each link of the chain in order.`,
  ['Start with cat /etc/cron.d/*, one file at a time.', 'Look for the word source or a path to another file.', 'The last file in the chain is a plain config with a password.']),
  secrets: N(`
## Hunting secrets
\`grep -r PATTERN DIR\` searches a whole project. Useful patterns: secret, password, token, key, TODO. Also look for forgotten copies (.bak, .old) and encoded values.`,
  ['grep -r secret /srv/app', 'find /srv/app -name "*.bak" finds forgotten copies.', 'An odd value in a yaml file may be base64.']),
  passwd: N(`
## /etc/passwd and /etc/shadow
passwd fields: name:pw:uid:gid:comment:home:shell. uid 0 means root powers. shadow holds hashes: an empty second field means no password at all.
\`awk -F: '$3==0 {print $1}' FILE\` finds uid 0 accounts.`,
  ['cut -d: -f picks a field.', 'Two uid-0 accounts is a classic backdoor.', 'In shadow, an empty field looks like name::.']),
  sshcfg: N(`
## ssh config
~/.ssh/config maps aliases to real hosts. Each block is Host, HostName, User, Port, IdentityFile. \`grep -A 4 'Host name' FILE\` prints the block after a match.`,
  ['grep -A 4 shows the lines after a match.', 'Match the whole alias line so similar names do not collide.', 'known_hosts is plain text and can hold comments.']),
  services: N(`
## Who listens where
Each line gives address:port and the process. 127.0.0.1 is local only; 0.0.0.0 is every interface. Unexpected high ports and unknown process names are red flags.`,
  ['grep ":PORT " finds one port.', 'grep -c 0.0.0.0: counts public listeners.', 'grep -E ":[0-9]{5} " finds five-digit ports.']),
  sudoer: N(`
## sudo rights
\`sudo -l\` lists what you may run as root. Even a plain reader (cat, head, sed, grep, awk) runs as root, so it can read root files. find can run commands on every match: \`-exec cat {} \;\`.`,
  ['Always start with sudo -l.', 'Run the allowed command, with sudo in front, on the root file.', 'Unknown file name? sudo find /root -name NAME -exec cat {} \;']),
  suid: N(`
## Setuid programs
A setuid program runs with its owner's rights, often root. Find them: \`find / -perm -4000 2>/dev/null\`. Standard ones (passwd, mount, su) are normal; a custom one is a lead. Read its usage, and look for weak path checks: a check on the start of the text can be beaten with ../ or ./ segments.`,
  ['Run the custom program with no arguments to see its usage.', 'A check like "must start with /var/log/" is beaten by /var/log/../../root/...', 'Output as hex? xxd -r -p turns it back.']),
  audit: N(`
## Auditing permissions
find is the auditor: \`-perm -002\` world-writable, \`-perm -4000\` setuid, \`-user NAME\` owner, \`-perm 600\` exact. Add 2>/dev/null to hide permission errors and \`| wc -l\` to count.`,
  ['Pick the one find test the question describes.', 'Remember -perm MODE is exact, -perm -MODE means at least.', 'Count results with wc -l.']),
  hops: N(`
## Pivoting
Pivoting means using one machine to reach the next. ssh -i KEY user@host uses a key file; sshpass -p PASS ssh user@host uses a password. After you log in you are on the other machine: pwd and ls again. exit comes back.`,
  ['Read todo.txt on every machine for the next hop.', 'Keys named id_old are decoys. Use the one that matches the host.', 'Passwords may be stored base64 encoded.']),
  drops: N(`
## Bulk decoding
Loop over many files: \`for f in $(ls DIR); do decoder DIR/$f; done | grep WORD\`. Pick the decoder from the README (base64 -d, xxd -r -p, or decoding then rev).`,
  ['Decode every file in one loop.', 'Decoys mention passphrase too. Ours is for vault01.', 'The vault file is locked. chmod u+r on file, u+x on folder.']),
  gauntlet: N(`
## Full chains
Real intrusions chain small steps: find a credential, log in somewhere new, escalate there. Write down what each step gives you. Re-read the README on every machine.`,
  ['Look at /var/backups and /var/log first.', 'After ssh, run sudo -l and find / -perm -4000.', 'Locked files may only need chmod, if you own them.']),
  morris: N(`
## What happened in 1988
The Morris worm guessed weak passwords and followed machines that trusted each other. You will do both, on purpose, in a sandbox.

## The method
Hash every word in the list and compare with the stored hash. Once you are in, read the files that machines leave for each other (\`.netrc\`, \`.rhosts\`).`,
  ['Read /srv/shadow.copy. Only one account matters: the one the README names.', 'Hash each word the same way the file was made: echo WORD | md5sum, in a for loop.', 'On each new machine, run ls -a and cat .netrc to learn the next hop.']),
  kaminsky: N(`
## What happened in 2008
Dan Kaminsky showed that a resolver could be tricked into trusting a forged DNS answer if the attacker guessed the 16-bit transaction id in time. Many fake answers race the real one.

## The method
\`sort | uniq -u\` over two files prints only the lines that are not in both. That is how you diff two lists in a pipe.`,
  ['cat both files together, then sort. Lines that appear twice are identical, so uniq -u keeps the odd ones.', 'The attacker keeps sending guesses. Only one is ACCEPT. grep -r ACCEPT /var/log.', 'Logs can be rotated into several files. grep -r searches a whole folder.']),
  heartbleed: N(`
## What happened in 2014
A missing length check in OpenSSL let anyone ask a server to echo back up to 64 KB of its own memory. That memory held private keys and passwords.

## The method
The dump is hex text. \`tr -d '\\n'\` joins the lines and \`xxd -r -p\` turns hex back into bytes. Then it is just text you can search.`,
  ['Join the hex lines first, then convert, then grep.', 'There are two keys. The one without a suffix is real.', 'Encoded values: cut -d= -f2 gives the value, then base64 -d, then rev if needed.']),
  dirtycow: N(`
## What happened in 2016
A race condition in the Linux kernel's copy-on-write let a normal user write to read-only files. The attack ran two threads in a loop until the timing lined up once.

## The method
It is a log-reading puzzle. \`grep -c\` counts matching lines, and every line is one attempt.`,
  ['Search for the result that is not RO.', 'Several threads: the line you find names the thread.', 'Count with grep -c "write=lost".']),
  eternalblue: N(`
## What happened in 2017
EternalBlue exploited a flaw in the old SMBv1 file-sharing protocol. WannaCry and NotPetya spread through it across the world within hours.

## The method
Scan, find the unpatched SMBv1 host, collect credentials, hop, repeat. Sound familiar? It is the pivoting routine, at worm speed.`,
  ['grep smb=v1 then grep patch=none. Exactly one host fits.', 'Backups often contain credentials: cat creds.b64 | base64 -d.', 'On each new machine read its scan, then repeat.']),
  log4shell: N(`
## What happened in 2021
Log4j logged a user-controlled string and, if it looked like \${jndi:...}, went and fetched code from the address inside. One header could take over a server.

## The method
Attackers hid the word jndi inside \${lower:j}-style tricks to dodge filters. You search for pieces that cannot be hidden, like the :// part.`,
  ['grep jndi finds the plain ones.', 'grep -o prints only the match. Try grep -o "dap://[a-z0-9.-]*".', 'The same base64 string appears several times. sort -u keeps one.']),
  xzdoor: N(`
## What happened in 2024
A maintainer account patiently earned trust, then hid a backdoor in the release tarball: a build script that decoded a "test file" into code. It was caught by accident, by a developer who noticed ssh logins were slightly slow.

## The method
Never run the thing. Read the pipeline, then apply the same pipeline yourself to the file and read the result.`,
  ['grep -r "tr " /srv/xz shows the suspicious build line.', 'Copy the pipeline from the script but only decode: do not eval it.', 'The order matters: rev, then tr, then base64 -d, as the script says.']),
  shellshock: N(`
## What happened in 2014
Bash allowed a function definition to be passed through an environment variable, and it kept executing whatever followed the definition. Web servers copy headers like the user agent into environment variables, so one header could run commands.

## The method
The attack has a signature that is easy to search for: a string starting with () { :;};. Find it, then follow the evidence: which request got an error, and what the command carried.`,
  ['Search the log for the signature with grep. Quote it so the shell leaves it alone.', 'The status code is the field just before the size. A 500 means the server choked.', 'The payload is base64 after the word echo. grep -o with a character class pulls it out.']),
  mirai: N(`
## What happened in 2016
Mirai scanned for devices with open telnet and tried a short list of factory logins. Cameras and routers that still had them joined a botnet that knocked major sites offline.

## The method
Authentication logs tell the story: many failures from one address, then one success, then a command. Count, correlate by address, decode.`,
  ['grep Accepted shows the one that got in. Note its address.', 'grep Failed with that address, then wc -l to count the lines.', 'The command line has echo then a long base64 string. cut and base64 -d finish the job.']),
  wannacry: N(`
## What happened in 2017
WannaCry spread by SMB and, before doing anything, asked DNS for one long meaningless domain. If it resolved, the worm stopped. A researcher registered the domain, and the spread slowed.

## The method
In a DNS log the kill switch stands out: the same strange name failing for many different hosts. Sort and count.`,
  ['grep NXDOMAIN keeps only failed lookups. cut -d" " -f5 gives the name.', 'sort, then uniq -c, then sort -rn puts the most common name on top.', 'For the count of hosts, cut the source field and use sort -u then wc -l. Only count failed lookups.']),
  sunburst: N(`
## What happened in 2020
A signed software update carried a backdoor. It waited, then phoned home by looking up names under an attacker domain. Data hid inside the long hexadecimal labels.

## The method
Normal names are short and readable. The beacons are long runs of hex. Pick them out with a pattern, then decode the hex back into text.`,
  ['grep -E "[0-9a-f]{24}" matches long hex labels. The domain is after the first dot.', 'Count lines per host: cut the host field, sort, uniq -c, sort -rn.', 'Take the first label, join the lines with tr -d "\\n", then xxd -r -p turns hex back into text.']),
  signal: N(`
## Signal
These flags are not on a machine. They are in the website: headers, console, page source and the terminal. Look at the site the way you would look at a target.`,
  ['Open your browser developer tools.', 'Network tab for headers, console for messages, elements for hidden nodes.', 'Anything encoded is probably base64.']),
  regicide: N(`
## The Regicide Protocol
A multi-host kill chain. Each machine hides the route to the next and also hides bait.
Read logs first, decode one layer at a time, and run the same routine on every host: ls -la, notes, sudo -l, locked folders.`,
  ['A rotation log tells you which backup is the real one.', 'Decode layer by layer: base64, hex, reversed text.', 'On each host check ~/.ssh and sudo -l before anything else.']),
  oubliette: N(`
## The Deep Oubliette
The warrant names a prisoner, the ledger gives its seal (a hash), and only one cell hashes to that seal.
Match the name exactly. Namesakes are decoys.`,
  ['Match the whole name including the separator that follows it.', 'find DIR -type f -exec md5sum {} \\; | grep SEAL', 'Decode the cell contents with the layers the warrant lists.']),
  ravens: N(`
## Parliament of Ravens
Find the attacker in the logs. The address that fails many times and then succeeds is the intruder.
Then follow it into the web log to find the file it uploaded.`,
  ['Make two lists: addresses with Failed, addresses with Accepted.', 'The address in both lists is the suspect.', 'grep that address in the web log and look at POST requests.']),
  labyrinth: N(`
## Labyrinth of Seals
Nested locked folders, then a setuid helper that trusts a path too much.
Open doors from the outside in with chmod u+rx, then abuse the helper with a path that climbs out.`,
  ['ls -la shows which folders are locked.', 'find / -perm -4000 lists setuid files.', 'A path with ../ can escape the allowed directory.']),
  ouroboros: N(`
## Crown of Ouroboros
A chain of files where each last line, once decoded, names the next. TRUE LINK files lead on; FALSE LINK files are bait.`,
  ['tail -n 1 FILE | base64 -d gives the next path.', 'Ignore any file marked FALSE LINK.', 'Keep a list of visited paths.'])
};
