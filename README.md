# Guildstone — Antrom AFK catalogue

Static companion site for the Antrom Guildstone Ring (Decentraland smart wearable): every suit you can
earn, the materials and recipes behind it, how the idle loop works, and live guild standings and player
leaderboards so the race can be followed outside Decentraland.

Live at https://guildstone.dev

## Layout

- `index.html` — page shell and tabs (Suits, Materials, Guilds, How to play)
- `data.js` — the catalogue: suits, materials, refine recipes, rare drops, guild tech (mirrors the server economy)
- `app.js` — renders the catalogue, filters, the detail drawer and hash routing
- `guilds.js` — the Guilds tab: guild standings, guild pages, player leaderboards, "since your last visit" rank deltas
- `styles.css`, `img/` — theme and icons

No build step. Open `index.html` in a browser to run it locally.

## Live data

The Guilds tab reads from the game backend (`dcl-firebase-backend`):

- `GET /antrom-afk/leaderboard` — every AntromAFK profile (levels, lifetime XP, suits, tools, coins, donations,
  last active) and every guild (HQ, tech, donation totals, top donor) in one compact payload, cached for a minute.
  Ranking is done in `guilds.js`, so a new board is a few lines in `BOARDS` and never a backend deploy.
- `GET /antrom-afk/guild/:tag` — full guild record for the guild page (roster, tech tree, contributions, activity).

Deep links: `#guilds`, `#guilds/ELF` (open a guild), `#board/miner` (open a player board).

To point the page at a local backend: `localStorage.setItem('guildstone.api', 'http://localhost:4123')`.

## Deploy

Hosted on Vercel as a static site; pushes to `main` deploy automatically.
