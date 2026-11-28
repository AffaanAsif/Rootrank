/* Curated videos. Every card credits the creator and opens on their own YouTube channel; nothing is re-hosted. */
(function () {
  var V = {
    a: { id: 'hREnP0HslK8', t: 'Linux Terminal Crash Course - For Absolute Beginners', by: 'NeuralNine' },
    b: { id: 'ZtqBQ68cfJc', t: 'The 50 Most Popular Linux & Terminal Commands - Full Course for Beginners', by: 'freeCodeCamp.org' },
    c: { id: 'dp-D9HNuVcM', t: 'Linux for Programmers #10 - Grep Command & Regular Expressions', by: 'Tech With Tim' },
    d: { id: '8ZtInClXe1Q', t: 'How NOT to Store Passwords!', by: 'Computerphile' },
    e: { id: 'b4b8ktEV4Bg', t: 'Hashing Algorithms and Security', by: 'Computerphile' },
    f: { id: '6i6l-ByBXZA', t: 'Crash Course: Linux Log Analysis', by: 'Rajneesh Gupta' },
    g: { id: 'xLYbK_1ADh8', t: 'Privilege escalation explained in Linux - SUID, SGID, Sudo and GTFO Bins', by: 'NK Digital' },
    h: { id: '4nCnh6BHcUg', t: 'Common Linux Privilege Escalation: Exploiting Sudo Access', by: 'Conda' },
    i: { id: 'Wp7boqm3Xts', t: 'SSH Tunnels SIMPLIFIED!', by: 'Shawn Powers' },
    p: { id: 'ngJG6Ix5FR4', t: 'How to use chmod | Manage File Permissions in Linux', by: 'Linode' },
    cr: { id: 'v952m13p-b4', t: 'Cron Jobs For Beginners | Linux Task Scheduling', by: 'Linode' },
    en: { id: 'zV-fR7xA4Hc', t: 'Why Files Become Bigger in Emails (how binary becomes text)', by: 'Computerphile' },
    morris: { id: '2QwMv0_Rkec', t: 'The First Internet Worm (Morris Worm)', by: 'Computerphile' },
    kam: { id: '7MT1F0O3_Yw', t: 'DNS Cache Poisoning', by: 'Computerphile' },
    hb: { id: '1dOCHwf8zVQ', t: 'Heartbleed, Running the Code', by: 'Computerphile' },
    cow: { id: 'kEsshExn7aE', t: 'Explaining Dirty COW local root exploit - CVE-2016-5195', by: 'LiveOverflow' },
    eb: { id: 'L1LZpWqbJG8', t: 'Who was REALLY behind the Microsoft Backdoor [PART 2]', by: 'Daniel Boctor' },
    l4: { id: 'iI9Dz3zN4d8', t: 'Log4j Lookups in Depth // Log4Shell CVE-2021-44228 - Part 2', by: 'LiveOverflow' },
    ss: { id: 'MyldPMn95kk', t: 'Shellshock Code & the Bash Bug', by: 'Computerphile' },
    wc: { id: '88jkB1V6N9w', t: 'Wana Decrypt0r (Wanacry Ransomware)', by: 'Computerphile' },
    xz: { id: '044GiRqGebc', t: 'The XZ Backdoor Almost Compromised Every Linux System', by: 'Mental Outlaw' }
  };
  var M = {
    nav: ['a', 'b'], hidden: ['a', 'b'], finder: ['b'], perms: ['p', 'b'], slice: ['b'], counter: ['c'], b64: ['en'], layers: ['en'], cronchain: ['cr'],
    regicide: ['i', 'h', 'g'], oubliette: ['e', 'a'], ravens: ['f', 'c'], labyrinth: ['g', 'p'], ouroboros: ['en', 'a'],
    grepper: ['c'], regex: ['c'], ranker: ['c'], columns: ['c'], sedlab: ['c'],
    hashmatch: ['e'], wordlist: ['d', 'e'],
    weblog: ['f'], authlog: ['f'], timeline: ['f'], agents: ['f'], incident: ['f'],
    sudoer: ['h', 'g'], suid: ['g'], audit: ['g'], hops: ['i'], drops: ['i'], gauntlet: ['i'],
    morris: ['morris'], kaminsky: ['kam'], heartbleed: ['hb'], dirtycow: ['cow'], eternalblue: ['eb'], log4shell: ['l4'], xzdoor: ['xz'], shellshock: ['ss'], wannacry: ['wc']
  };
  window.VIDEOS = {};
  Object.keys(M).forEach(function (k) { window.VIDEOS[k] = M[k].map(function (x) { var v = V[x]; return { id: v.id, title: v.t, by: v.by, url: 'https://www.youtube.com/watch?v=' + v.id }; }); });
})();
