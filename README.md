# Guildstone — Antrom AFK catalogue

Static companion site for the Antrom Guildstone Ring (Decentraland smart wearable): every suit you can
earn, the materials and recipes behind it, and how the idle loop works.

Live at https://guildstone.dev

## Layout

- `index.html` — page shell and tabs (Wearables, Materials, How it works)
- `data.js` — the catalogue: suits, materials, refine recipes, rare drops, guild tech (mirrors the server economy)
- `app.js` — renders the catalogue and handles filters
- `styles.css`, `img/` — theme and icons

No build step. Open `index.html` in a browser to run it locally.

## Deploy

Hosted on Vercel as a static site; pushes to `main` deploy automatically.
