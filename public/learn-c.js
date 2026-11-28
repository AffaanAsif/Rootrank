/* Learning content, part 3: recon, privilege escalation, pivoting, signal. */
Object.assign(window.LEARN.tracks, {
  cronchain: {
    level: 'Intermediate', time: '1.5 hours', uses: ['cat', 'ls', 'grep', 'base64'],
    hook: 'Cron runs jobs on a timer. Attackers love it, because a hidden job survives reboots. Defenders love it too: one file often points to the next, and the next, until the whole story is on the table.',
    start: ['Start at the crontab the README names.', 'Each job points at a script. cat the script.', 'The script points at the next file. Keep following until you find the flag.'],
    lessons: [
      { t: 'Reading a crontab', md: `\`\`\`
*/5 * * * * root /opt/jobs/backup.sh
\`\`\`

Five time fields (minute, hour, day, month, weekday), then the user, then the command. Everything after that is the trail.` },
      { t: 'Follow the chain', md: `Do not guess. Read each file in order, and write down the next path before you move:

\`\`\`
$ cat /etc/cron.d/maint      # points to /opt/jobs/a.sh
$ cat /opt/jobs/a.sh         # points to /var/lib/x/b.conf
$ cat /var/lib/x/b.conf      # holds the flag, maybe encoded
\`\`\`

If the last file looks like random letters, try base64 -d.` }
    ]
  },
  secrets: {
    level: 'Beginner', time: '1 hour', uses: ['grep', 'ls', 'cat', 'find'],
    hook: 'Developers paste passwords and API keys into code, then forget about them. Real breaches start this way every week. You will learn to find them in seconds.',
    start: ['Use grep -r to search every file under a folder.', 'Search for words like password, secret, key, token.', 'Read the matching line and submit the value.'],
    lessons: [
      { t: 'Where secrets hide', md: `Usual suspects: \`.env\` files, config files, old scripts, notes left in a home folder, and shell history.

\`\`\`
$ ls -a /home/dev
.  ..  .env  notes.txt  app.py
\`\`\`

The dot-files are hidden by default: use \`ls -a\`.` },
      { t: 'Search, do not browse', md: `\`\`\`
$ grep -r "API_KEY" /home/dev
/home/dev/.env:API_KEY=ak_live_93hd...
$ grep -ri password /srv/app
\`\`\`

\`-r\` means recursive, \`-i\` ignores upper and lower case. Look at the file names in the results: the real one is usually the odd one out.` }
    ]
  },
  passwd: {
    level: 'Beginner', time: '45 min', uses: ['cat', 'cut', 'grep', 'awk'],
    hook: '/etc/passwd lists every account on a Linux machine. It is public on purpose, and it tells an attacker who is worth targeting.',
    start: ['cat /etc/passwd to see the lines.', 'Each line has 7 fields separated by colons.', 'Pick the field the question asks for with cut -d: -fN.'],
    lessons: [
      { t: 'Seven fields', md: `\`\`\`
alice:x:1001:1001:Alice:/home/alice:/bin/bash
\`\`\`

1 name, 2 password marker, 3 user id, 4 group id, 5 description, 6 home folder, 7 shell.

Accounts with \`/usr/sbin/nologin\` cannot log in. Accounts with id 0 are root.` },
      { t: 'Useful one-liners', md: `\`\`\`
$ cut -d: -f1 /etc/passwd                    # all names
$ grep '/bin/bash' /etc/passwd | cut -d: -f1  # who can log in
$ awk -F: '$3==0' /etc/passwd                 # accounts with root power
\`\`\`` }
    ]
  },
  sshcfg: {
    level: 'Beginner', time: '45 min', uses: ['cat', 'grep', 'ls', 'ssh'],
    hook: 'Open someone\'s SSH config and you get a map of every machine they connect to. Admins keep their whole network there.',
    start: ['cat ~/.ssh/config.', 'Each Host block has HostName, User and sometimes Port.', 'Answer the question from the right block.'],
    lessons: [
      { t: 'Reading the config', md: `\`\`\`
Host build
  HostName 10.0.4.12
  User deploy
  Port 2222
\`\`\`

Typing \`ssh build\` uses all of those settings. The block name is a nickname.` },
      { t: 'Finding one detail', md: `\`\`\`
$ grep -A3 'Host build' ~/.ssh/config
\`\`\`

\`-A3\` prints three lines after the match, so you get the whole block.` }
    ]
  },
  services: {
    level: 'Beginner', time: '1 hour', uses: ['cat', 'grep', 'ls', 'cut'],
    hook: 'A server is a building with many doors, called ports. Each door has a service behind it. Recon means finding out which doors are open and what lives behind them.',
    start: ['Read the services listing the README points you to.', 'Each line pairs a port with a service name.', 'Filter with grep and answer.'],
    lessons: [
      { t: 'Ports you should know', md: `| Port | Service |
|---|---|
| 22 | SSH remote login |
| 80 | HTTP web |
| 443 | HTTPS web |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6379 | Redis |

An unexpected open port is the first thing a pentester notes.` },
      { t: 'Reading the list', md: `\`\`\`
$ cat /srv/scan.txt
22/tcp   open  ssh
80/tcp   open  http
6379/tcp open  redis
$ grep open /srv/scan.txt | wc -l
\`\`\`` }
    ]
  },
  sudoer: {
    level: 'Intermediate', time: '1.5 hours', uses: ['sudo', 'ls', 'cat', 'id'],
    hook: 'Root can do anything. sudo lets normal users borrow that power for specific commands. When the list is too generous, a plain user becomes root without a password.',
    start: ['Run sudo -l to list what you may run.', 'Look for entries with NOPASSWD.', 'Run the allowed command with sudo to read the protected file.'],
    lessons: [
      { t: 'sudo -l', md: `\`\`\`
$ sudo -l
User guest may run the following commands:
    (root) NOPASSWD: /bin/cat
\`\`\`

You may run \`cat\` as root with no password. That means you can read any file:

\`\`\`
$ sudo cat /root/flag.txt
\`\`\`` },
      { t: 'Least privilege', md: `Good admins give the smallest permission needed. A shell, an editor or a file reader with sudo is nearly the same as handing over root. Defenders audit this list; attackers read it first.` }
    ]
  },
  suid: {
    level: 'Intermediate', time: '1.5 hours', uses: ['find', 'ls', 'id'],
    hook: 'Some programs run with their owner\'s power instead of yours. If the owner is root and the program is careless, it is a door.',
    start: ['find / -perm -4000 lists SUID files.', 'Spot the one that does not belong.', 'Run it by its full path (it is not in your PATH).'],
    lessons: [
      { t: 'The s bit', md: `\`\`\`
$ ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root ...
\`\`\`

The **s** in place of x means: run as the file owner. \`passwd\` needs it to edit the password file, so it is meant to be there.` },
      { t: 'Hunting', md: `\`\`\`
$ find / -perm -4000 2>/dev/null
/usr/bin/passwd
/usr/bin/sudo
/opt/tools/backup-helper
\`\`\`

Standard tools are expected. A custom one in /opt is the lead. Run it with its full path:

\`\`\`
$ /opt/tools/backup-helper
\`\`\`` }
    ]
  },
  audit: {
    level: 'Intermediate', time: '1.5 hours', uses: ['find', 'ls', 'cat', 'grep', 'sort'],
    hook: 'An audit asks: what is on this machine that should not be? You walk the system like an inspector, checking permissions, owners and odd corners.',
    start: ['Read the README question carefully.', 'Use find with a filter (-perm, -user, -name) to narrow the list.', 'Open the file the search turns up.'],
    lessons: [
      { t: 'Find with filters', md: `\`\`\`
$ find / -perm -002 -type f 2>/dev/null    # world-writable files
$ find /home -name "*.bak"                  # backups
$ find / -user root -perm -4000             # root SUID
\`\`\`

\`2>/dev/null\` hides permission errors so the list stays clean.` },
      { t: 'What to flag', md: `World-writable files in system folders, backups with passwords inside, files owned by the wrong user, keys left in home folders. Report the one that gives someone more power than intended.` }
    ]
  },
  hops: {
    level: 'Advanced', time: '2 hours', uses: ['ssh', 'cat', 'ls', 'sshpass'],
    hook: 'Real networks are layered. You rarely reach the prize directly: you enter one machine, find a way to the next, and so on. This is called pivoting, and it is how red teams work.',
    start: ['Log in to the first host and look around: home folder, notes, config.', 'Find the next host name and its password.', 'ssh to the next one. Repeat until the last host has the flag.'],
    lessons: [
      { t: 'The pivot idea', md: `Each machine holds a clue to the next: a note, a saved password, an SSH config. Treat every host the same way: **look around first**, then move.

\`\`\`
$ ls -a ~
$ cat ~/.ssh/config
$ cat notes.txt
\`\`\`` },
      { t: 'Moving on', md: `\`\`\`
$ ssh user@next-host
\`\`\`

When a password is needed in one line, use \`sshpass -p 'pw' ssh user@host cmd\`. Keep a note of each host and password so you can go back.` }
    ]
  },
  drops: {
    level: 'Advanced', time: '2 hours', uses: ['ssh', 'cat', 'ls', 'grep', 'base64'],
    hook: 'Attackers leave files behind, dead drops, for later. You are the one finding them: across several machines, something small is hidden in an odd place.',
    start: ['Check each host for unusual folders (/tmp, /var/tmp, hidden dirs).', 'Open every file you find: pieces may be encoded.', 'Combine the pieces as the README describes.'],
    lessons: [
      { t: 'Odd places', md: `Look in /tmp, /var/tmp, /dev/shm, hidden dot-folders in home, and anything modified recently. Use \`ls -la\` to see hidden items and sizes.` },
      { t: 'Putting pieces together', md: `\`\`\`
$ cat part1 part2 part3 | base64 -d
\`\`\`

The order of the parts matters. File names or numbers usually tell you the order.` }
    ]
  },
  gauntlet: {
    level: 'Advanced', time: '3 hours', uses: ['ssh', 'sudo', 'find', 'grep', 'base64'],
    hook: 'The final exam. Several machines, several defences, and every skill from the other paths mixed together. Take it slowly and keep notes.',
    start: ['Map first: what hosts, what users, what clues.', 'On each host, run the same routine: ls -a, sudo -l, find SUID, grep secrets.', 'Move forward only when you have a new credential or path.'],
    lessons: [
      { t: 'A routine for every host', md: `1. \`ls -la ~\` and read notes
2. \`sudo -l\`
3. \`find / -perm -4000 2>/dev/null\`
4. \`grep -ri pass /home /srv /opt 2>/dev/null\`
5. read the SSH config for new hosts

A routine beats improvising. It also makes your write-up easy.` },
      { t: 'Stay calm', md: `Dead ends are normal. If stuck, return to the last place where you found something and re-read it. The answer is nearly always one file you did not open.` }
    ]
  },
  signal: {
    level: 'Intermediate', time: '1 hour', uses: ['curl', 'base64', 'rootrank'],
    hook: 'These levels hide in the real website, not in a sandbox. You will use your browser like a hacker does: headers, console, element inspector.',
    start: ['Open your browser developer tools (F12 or right click, Inspect).', 'Read the level brief: it says where to look.', 'Decode what you find and submit it.'],
    lessons: [
      { t: 'Four places to look', md: `- **Network tab**: response headers of any request.
- **Console**: messages left by developers.
- **Elements**: parts of the page that are hidden from view but present in the HTML.
- **Terminal command**: some secrets are one command away.` },
      { t: 'Decoding', md: `Most clues are base64. In the console you can decode with \`atob("...")\`, in the terminal with \`echo ... | base64 -d\`.` }
    ]
  }
});
