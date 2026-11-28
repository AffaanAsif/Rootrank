# Rootrank

A ranked hacking ladder. Players learn security skills in a safe browser terminal, solve challenges from **Guest** to **Ghost**, and climb a global leaderboard.

Everything runs in a **simulation**. The server never executes real shell commands; the "terminal" is a JavaScript model of a small Linux system with its own fake filesystem.

## What makes it different

- **Per-player instances.** Flags and data are generated from a secret plus the player's username, so copying someone else's answer fails.
- **Stateless sandbox.** Each terminal command replays the player's session on the server, so no flag or solution data ever reaches the browser.
- **Ranks, tiers and first blood.** 1,212 levels in 52 tracks, six difficulty tiers, seven ranks, a leaderboard, hint penalties and first-blood bonuses.
- **Learning built in.** Every challenge has notes that teach the idea behind it.

## Run it locally

```bash
node dev.js          # http://localhost:3000, in-memory data, no setup
node tests/run.js    # plays every level through the real API
```

## Deploy on Vercel

1. Push this folder to a GitHub repository and import it in Vercel.
2. In Vercel, open **Storage**, add an **Upstash Redis** database and connect it to the project. This sets `REDIS_URL` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`) automatically; any of these work.
3. Add an environment variable `ARENA_SECRET` with a long random value (for example the output of `openssl rand -hex 32`). **Never commit it.** Changing it resets every player's flags.
4. Deploy. The site is served from `public/` and the API from `api/arena.js`.

Without the Redis variables and `ARENA_SECRET`, the API refuses to run in production on purpose.

## Add levels

Levels come from **tracks** (families) in `lib/gen/*.js`. One track generates many levels with rising difficulty:

```js
{ id: 'nav', title: 'Navigator', cat: 'Linux', levels: 30, tier: (lv) => 1, type: 'flag' /* or 'answer' */,
  blurb, brief: (lv) => '...',
  build: (ctx, lv) => ({ motd, hosts: { main: { name, files } }, answer? }),   // ctx.flag, ctx.rnd are per player
  solve: (built, lv) => ['cmd', 'cmd'] }                                      // used by the tests
```

Add notes and hints for the track in `lib/gen/notes.js`. `node tests/levels.js` solves every level for two players through the shell; `node tests/run.js` does it through the real API.

## Layout

```
api/arena.js        accounts, scoring, leaderboard, terminal endpoint
lib/shell.js        the pretend shell (filesystem, pipes, loops, sudo, ssh)
lib/catalog.js      tracks, levels, tiers, ranks
lib/gen/*.js        the level generators, plus notes.js
lib/db.js           Upstash Redis or in-memory storage
public/             the website (black and white, self-hosted fonts)
tests/              levels.js (shell) and run.js (full API)
```

## Scoring

Points by tier: 10, 20, 40, 80, 150, 300 (tiers 1 to 6). Minus 15% per hint used (never below 40%), plus 10% for first blood. Ranks: Guest 0, User 150, Operator 800, Sudoer 3,000, Admin 9,000, Root 20,000, Ghost 40,000. Wrong answers on a level are limited to 6 per 15 minutes.

## Signal

The `signal` track holds four flags in the site itself (response header, console, hidden element, terminal command). They are the same for every player.

## Safety notes

- Passwords are hashed with PBKDF2 and sessions are signed tokens. Rate limits protect login, submissions and the terminal.
- The shell has size limits, a regex complexity guard and no access to the real system.
- Do not publish real exploits or other platforms' solutions here.

## Blueprint redesign, Legends, Google sign-in

- Theme: blueprint (Space Grotesk + Space Mono, self-hosted in `public/fonts`).
- **Hall of Legends**: 11 rebuilt historic attacks (Morris worm, Kaminsky DNS, Shellshock, Heartbleed, Dirty COW, Mirai, EternalBlue, WannaCry, Sunburst, Log4Shell, XZ backdoor). Stories and videos are public; open to everyone by default (set `LEGENDS_MIN` to gate them by points). Disabled when `ARENA_DEV=1`.
- **Google sign-in**: create an OAuth Web client in Google Cloud, add your site URL under *Authorized JavaScript origins*, then set `GOOGLE_CLIENT_ID` in Vercel. Without it the button shows a "not switched on yet" message.
- **Community links**: fill `public/config.js` (`discord`, `github`, `contact`). Empty means "coming soon".
- **Videos**: `public/videos.js`. Every card credits the creator and opens on YouTube; nothing is re-hosted. Add yours via a pull request.
- There are a few hidden easter eggs. Find them yourself.

## Competitive layer
- **Daily challenge**: one level per UTC day (deterministic pick, never a Legend), +20% points, shown on the Compete page.
- **Live feed**: the latest solves across the site, with first-blood markers (stored in `feed:<day>` keys that expire after 3 days).
- **Streaks and badges**: consecutive-day solves, plus badges (first blood, streaks, daily, century, legend slayer, finisher) on every profile.
- **Career path trace**: each path page draws a route that fills as you finish courses, with a "you are here" marker.


## Sign-in setup (one-time, in Vercel env vars)

- **Google**: create an OAuth client (Web), add your site URL as an authorized origin, set `GOOGLE_CLIENT_ID`.
- **GitHub**: create an OAuth App, set its callback URL to `https://YOUR-DOMAIN/`, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- Buttons are already in the sign-in window; they switch on as soon as the variables exist.
- Legends are open to everyone by default. Set `LEGENDS_MIN` to a point value to gate them again.
