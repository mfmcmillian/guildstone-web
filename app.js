/* Guildstone catalogue — plain DOM, no build step. */

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};

const TIER_LABEL = { T0: 'Base', T1: 'Tier 1', T2: 'Tier 2', T3: 'Tier 3', T4: 'Tier 4', C2: 'Pair drop', C3: 'Pair drop', C4: 'Set drop', C5: 'Apex drop' };
const GROUPS = [
  { id: 'ring', title: 'The Ring', blurb: 'The smart wearable that runs the game. Wear it to play.', accent: '#ffd23f' },
  ...PROF_IDS.map((p) => ({ id: p, title: `${PROFESSIONS[p].name} suits`, blurb: p === 'assassin'
    ? 'Not crafted. Buy the Ether Assassin pieces in the Decentraland Marketplace. Wearing them unlocks the Skeleton Yard the same way crafted suits unlock their zones.'
    : 'Four suits, crafted in order from L1 to L4. Each one you wear makes the next one possible.', accent: PROFESSIONS[p].color })),
  { id: 'relic', title: 'Relics', blurb: 'Planned. One per profession, for players who finish all four suits of that profession. Recipes are design targets and may change before release.', accent: '#ff63e1' },
  { id: 'crown', title: 'Guildstone Crown', blurb: 'Planned. For players who own all four Relics. The last thing to craft.', accent: '#ffb626' }
];

/* ---------- Tabs (hash-routed so sections can be linked) ---------- */
const TAB_IDS = ['wearables', 'materials', 'guilds', 'online', 'storm', 'how', 'ring'];
function showTab(id, push = true, scrollTop = true) {
  if (!TAB_IDS.includes(id)) id = 'wearables';
  for (const x of $('#tabs').children) x.classList.toggle('active', x.dataset.tab === id);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.id === `tab-${id}`);
  document.body.dataset.tab = id;
  if (push && location.hash !== `#${id}`) history.replaceState(null, '', id === 'wearables' ? location.pathname : `#${id}`);
  if (scrollTop) window.scrollTo({ top: 0 });
  Guilds.setVisible(id === 'guilds' || id === 'online' || id === 'storm');
  Chat.setVisible(id === 'online');
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showTab(b.dataset.tab);
});
function routeFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'suits') {
    // In-page anchor on the landing tab: switch tabs without jumping to the top, then let the anchor scroll.
    showTab('wearables', false, false);
    requestAnimationFrame(() => $('#suits').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } else if (h.startsWith('guilds/')) {
    // #guilds/ELF opens that guild's page.
    showTab('guilds', false);
    Guilds.openGuild(h.slice(7));
  } else if (h.startsWith('board/')) {
    // #board/miner jumps straight to one player leaderboard.
    showTab('guilds', false, false);
    Guilds.showBoard(h.slice(6), true);
  } else {
    showTab(h, false);
  }
}
window.addEventListener('hashchange', routeFromHash);

/* ---------- Shared pieces ---------- */
function matChip(id, amount) {
  const m = MATERIALS[id];
  return el('button', { class: `mat ${m.kind}`, title: m.gate, onclick: () => openMaterial(id) },
    el('img', { src: m.img, alt: '' }),
    amount !== undefined ? el('span', { class: 'n' }, amount.toLocaleString()) : null,
    el('span', null, m.name)
  );
}

function wearableCard(w) {
  const accent = w.group in PROFESSIONS ? PROFESSIONS[w.group].color : w.profession ? PROFESSIONS[w.profession].color : (w.group === 'crown' ? '#a259ff' : '#ffd23f');
  const art = el('div', { class: 'art' },
    el('img', { src: w.img, alt: w.name, loading: 'lazy' }),
    w.level ? el('span', { class: 'lvl' }, `L${w.level}`) : null,
    el('span', { class: `rarity r-${w.rarity.toLowerCase()}` }, w.rarity),
    w.planned ? el('span', { class: 'planned' }, 'Coming soon') : null
  );
  const body = el('div', { class: 'body' },
    el('h3', null, w.name),
    el('div', { class: 'effect' }, w.effect),
    w.cost.length ? el('div', { class: 'label' }, w.planned ? 'Planned recipe' : 'What it costs to craft') : null,
    w.cost.length ? el('div', { class: 'cost' }, w.relics ? el('span', { class: 'mat relic' }, el('img', { src: 'img/suit.png', alt: '' }), el('span', { class: 'n' }, 4), el('span', null, 'Relics')) : null, ...w.cost.map(([m, n]) => matChip(m, n))) : null,
    el('div', { class: 'label' }, w.cost.length ? 'Before you can craft it' : 'How you get it'),
    el('ul', { class: 'req' }, ...w.requires.map((r) => el('li', null, r))),
    w.buy ? el('a', { class: 'buy', href: w.buy, target: '_blank', rel: 'noopener' }, 'Open in Marketplace') : null
  );
  return el('article', { class: `card${w.planned ? ' is-planned' : ''}`, style: `--accent:${accent}` }, art, body);
}

/* ---------- Wearables tab ---------- */
let wearableFilter = 'all';
function renderWearableFilters() {
  const box = $('#wearable-filters');
  box.replaceChildren();
  const chips = [['all', 'All', null, '#a259ff'], ...GROUPS.map((g) => [g.id, g.title, g.id in PROFESSIONS ? PROFESSIONS[g.id].icon : null, g.accent])];
  for (const [id, label, icon, color] of chips) {
    box.append(el('button', { class: `chip ${wearableFilter === id ? 'active' : ''}`, style: `--chip:${color}`, onclick: () => { wearableFilter = id; renderWearableFilters(); renderWearables(); } },
      icon ? el('img', { src: icon, alt: '' }) : null, label));
  }
}
function renderWearables() {
  const root = $('#wearable-list');
  root.replaceChildren();
  for (const g of GROUPS) {
    if (wearableFilter !== 'all' && wearableFilter !== g.id) continue;
    const items = WEARABLES.filter((w) => w.group === g.id);
    root.append(el('section', { class: 'group', style: `--accent:${g.accent}` },
      el('div', { class: 'group-head' }, el('h2', null, g.title), el('p', null, g.blurb)),
      el('div', { class: `grid${items.length === 1 ? ' feature' : ''}` }, ...items.map(wearableCard))
    ));
  }
}

/* ---------- Materials tab ---------- */
let materialFilter = 'all';
const MAT_FILTERS = [['all', 'All', '#a259ff'], ...PROF_IDS.map((p) => [p, PROFESSIONS[p].name, PROFESSIONS[p].color]), ['combo', 'Combination drops', '#ffd23f']];
function renderMaterialFilters() {
  const box = $('#material-filters');
  box.replaceChildren();
  for (const [id, label, color] of MAT_FILTERS) {
    box.append(el('button', { class: `chip ${materialFilter === id ? 'active' : ''}`, style: `--chip:${color}`, onclick: () => { materialFilter = id; renderMaterialFilters(); renderMaterials(); } },
      id in PROFESSIONS ? el('img', { src: PROFESSIONS[id].icon, alt: '' }) : null, label));
  }
}
function materialCard(m) {
  const lines = [];
  if (m.kind === 'refined') lines.push(`Workshop · ${recipeText(m)}`);
  else if (m.kind === 'currency') lines.push(m.gate);
  else {
    lines.push(`Where: ${m.zones.map((z) => PROFESSIONS[z].zone).join(', ')}`);
    lines.push(m.gate);
    lines.push(m.rate ? `1 in ${m.rate.toLocaleString()} cycles` : 'Every cycle');
  }
  const meta = el('div', { class: 'meta' });
  lines.forEach((line, i) => {
    if (i) meta.append(el('br'));
    meta.append(el('span', { class: line.startsWith('Wear ') ? 'needs' : null }, line));
  });
  return el('button', { class: `mcard ${m.tier !== 'T0' ? 'locked' : ''}`, style: `--accent:${m.profession ? PROFESSIONS[m.profession].color : '#a259ff'}`, onclick: () => openMaterial(m.id) },
    el('img', { src: m.img, alt: m.name, loading: 'lazy' }),
    el('div', { class: 'body' },
      el('span', { class: 'tag' }, TIER_LABEL[m.tier]),
      el('h4', null, m.name),
      meta
    )
  );
}
function renderMaterials() {
  const root = $('#material-list');
  root.replaceChildren();
  const sections = [];
  if (materialFilter === 'all' || materialFilter in PROFESSIONS) {
    const profs = materialFilter === 'all' ? PROF_IDS : [materialFilter];
    for (const p of profs) {
      // Raw -> refined pairs, one per tier, so the ladder reads left to right.
      const pairs = LADDER[p].map(([raw, , ref]) => [raw, ref]);
      sections.push({ title: `${PROFESSIONS[p].name} · ${PROFESSIONS[p].zone}`, blurb: 'Each pair is one material you collect and the refined version the Workshop makes from it. Each pair unlocks with the next suit.', accent: PROFESSIONS[p].color, pairs });
    }
  }
  if (materialFilter === 'all' || materialFilter === 'combo') {
    sections.push({ title: 'Combination drops', blurb: 'These only drop while you wear suits from more than one profession at the same time.', accent: '#ffd23f', ids: COMBOS.map((c) => c.id) });
  }
  for (const s of sections) {
    const body = s.pairs
      ? el('div', { class: 'pairs' }, ...s.pairs.map(([raw, ref]) => el('div', { class: 'pair' },
          materialCard(MATERIALS[raw]), el('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'), materialCard(MATERIALS[ref]))))
      : el('div', { class: 'grid compact' }, ...s.ids.map((id) => materialCard(MATERIALS[id])));
    root.append(el('section', { class: 'group', style: `--accent:${s.accent}` },
      el('div', { class: 'group-head' }, el('h2', null, s.title), el('p', null, s.blurb)),
      body
    ));
  }
}

/* ---------- Detail drawer ---------- */
const detail = $('#detail');
const scrim = $('#scrim');
function closeDetail() { detail.classList.add('hidden'); scrim.classList.add('hidden'); Guilds.onDetailClosed(); }
scrim.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

function openMaterial(id) {
  const m = MATERIALS[id];
  const used = USED_IN[id] || [];
  const kv = [];
  const zones = m.zones ? m.zones.map((z) => PROFESSIONS[z].zone).join(' or ') : '';
  const perHour = m.rate ? (3600 / 3 / m.rate).toFixed(m.rate > 1000 ? 2 : 1) : null;
  if (m.kind === 'refined') {
    kv.push(['How you get it', `Take ${recipeText(m)} to the Workshop and turn them into 1 ${m.name}.`]);
  } else if (m.kind === 'currency') {
    kv.push(['How you get it', m.gate]);
  } else {
    kv.push(['Where it drops', `While working at the ${zones}.`]);
    kv.push(['What you must wear', m.gate === 'No suit needed' ? 'Nothing special. Everyone gets this from the start.' : m.gate.replace(/^Wear /, '') + '.']);
    kv.push(['How often', m.rate ? `About 1 every ${m.rate.toLocaleString()} work cycles, roughly ${perHour} an hour.` : 'Every work cycle (3 seconds). Tools, profession level, Rations and your guild multiply it.']);
  }
  kv.push(['Can you sell it?', m.sellable ? 'Yes, from your Bank for coins.' : 'No. It is only for crafting.']);
  if (m.note) kv.push(['Good to know', m.note]);

  detail.replaceChildren(...[
    el('button', { class: 'close', onclick: closeDetail, 'aria-label': 'Close' }, '×'),
    el('img', { class: 'hero', src: m.img, alt: m.name }),
    el('h2', null, m.name),
    el('div', { class: 'tier-line' }, TIER_LABEL[m.tier]),
    el('dl', { class: 'kv' }, ...kv.flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)])),
    used.length ? el('div', { class: 'label' }, 'What it is used for') : null,
    used.length ? el('div', { class: 'list' }, ...used.map((u) => {
      if (u.startsWith('refine:')) {
        const r = MATERIALS[u.slice(7)];
        return el('button', { onclick: () => openMaterial(r.id) }, el('img', { src: r.img, alt: '' }), el('span', null, r.name, el('small', null, `${recipeText(r)} make 1 ${r.name} at the Workshop`)));
      }
      const w = WEARABLES.find((x) => x.id === u);
      const amt = w.cost.find(([mm]) => mm === id)[1];
      return el('button', { onclick: () => { closeDetail(); wearableFilter = w.group; renderWearableFilters(); renderWearables(); $('#tabs button[data-tab=wearables]').click(); } },
        el('img', { src: w.img, alt: '' }), el('span', null, w.name, el('small', null, `Crafting it costs ${amt} ${m.name}`)));
    })) : null
  ].filter(Boolean));
  detail.classList.remove('hidden');
  scrim.classList.remove('hidden');
}

/* ---------- Landing: zone cards ---------- */
const ZONE_ART = { lumberjack: 'img/zone_lumber_v2.jpg', miner: 'img/zone_quarry_v2.jpg', butcher: 'img/zone_hunt_v2.jpg', assassin: 'img/zone_bones_v2.jpg' };
function renderZones() {
  const grid = $('#zone-grid');
  grid.replaceChildren(...PROF_IDS.map((p) => {
    const info = PROFESSIONS[p];
    const first = LADDER[p][0][1];
    const last = LADDER[p][4][1];
    return el('button', { class: 'zone', style: `--accent:${info.color}`, onclick: () => {
      wearableFilter = p; renderWearableFilters(); renderWearables();
      $('#suits').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } },
      el('img', { src: ZONE_ART[p], alt: info.zone, loading: 'lazy' }),
      el('div', { class: 'zone-body' },
        el('span', { class: 'zone-kicker' }, el('img', { src: info.icon, alt: '' }), info.name),
        el('h3', null, info.zone),
        el('p', null, p === 'assassin' ? `${first} to ${last}. Suits bought, not crafted.` : `${first} to ${last}. Four suits to craft.`)
      )
    );
  }));
  $('#hero-cta').addEventListener('click', () => showTab('how'));
}

/* Assassin mints are USD-pegged: API `price` is dollars in wei, shop charges that in MANA at the live rate. */
async function refreshAssassinPrices() {
  const contract = ASSASSIN_CONTRACT || ASSASSIN_COLLECTION.split(':').pop();
  let usdByItem = {};
  try {
    const res = await fetch(`https://marketplace-api.decentraland.org/v1/items?contractAddress=${contract}`);
    if (res.ok) {
      const body = await res.json();
      for (const item of body.data || []) {
        const usd = Number((Number(item.price) / 1e18).toPrecision(8));
        if (Number.isFinite(usd) && usd > 0) usdByItem[String(item.itemId)] = usd;
      }
    }
  } catch { /* keep fallbacks */ }
  let usdPerMana = 0;
  for (const [url, read] of [
    ['https://api.coingecko.com/api/v3/simple/price?ids=decentraland&vs_currencies=usd', (j) => Number(j.decentraland && j.decentraland.usd)],
    ['https://api.binance.com/api/v3/ticker/price?symbol=MANAUSDT', (j) => Number(j.price)]
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const n = read(await res.json());
      if (Number.isFinite(n) && n > 0) { usdPerMana = n; break; }
    } catch { /* try the next source */ }
  }
  let changed = false;
  for (const w of WEARABLES) {
    if (w.group !== 'assassin' || w.itemId === undefined) continue;
    const usd = usdByItem[String(w.itemId)] ?? w.usd;
    const mana = usdPerMana > 0 ? usd / usdPerMana : 0;
    const line = assassinBuyLine(usd, mana);
    if (w.requires[0] !== line) {
      w.requires[0] = line;
      w.usd = usd;
      w.mana = mana;
      changed = true;
    }
  }
  if (changed) renderWearables();
}

/* ---------- Free Ring: claim form + Matt's hero stage ---------- */
const Ring = (() => {
  const API = localStorage.getItem('guildstone.api') || 'https://dcl-firebase-backend.vercel.app';
  // Matt's picture: the Knight idling in his yard. Sheet is 6 x 5 cells of 144 px, idle on row 0 (4 frames).
  const SHEET = 'img/raid/knight_v1.png';
  const STAGE = 'img/raid/hero_stage_knight_v1.jpg';
  const IDLE_FRAMES = 4;
  const FRAME_MS = 260;

  function stage() {
    const box = $('#ring-stage');
    const hero = $('#ring-hero');
    if (!box || !hero) return;
    box.style.backgroundImage = `url(${STAGE})`;
    hero.style.backgroundImage = `url(${SHEET})`;
    setInterval(() => {
      // Only step while the tab is on screen; a hidden tab keeps its timers but nobody is watching.
      if (document.body.dataset.tab !== 'ring') return;
      const frame = Math.floor(Date.now() / FRAME_MS) % IDLE_FRAMES;
      hero.style.backgroundPosition = `${-144 * frame}px 0`;
    }, FRAME_MS / 2);
  }

  function links() {
    fetch(`${API}/antrom-afk/config`).then((r) => r.json()).then((c) => {
      const d = c && c.links && typeof c.links.discord === 'string' ? c.links.discord : '';
      const a = $('#ring-discord');
      if (a && d) { a.href = d; a.hidden = false; }
    }).catch(() => {});
  }

  function claim() {
    const form = $('#ring-form');
    const input = $('#ring-address');
    const button = $('#ring-submit');
    const status = $('#ring-status');
    const connect = $('#ring-connect');
    if (!form) return;
    const say = (text, cls = '') => { status.textContent = text; status.className = `ring-status ${cls}`.trim(); };
    // A browser wallet makes it one click: read the address instead of asking them to paste it.
    if (window.ethereum && typeof window.ethereum.request === 'function') {
      connect.hidden = false;
      connect.addEventListener('click', async () => {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) { input.value = accounts[0]; say(''); }
        } catch { say('Wallet did not connect. You can paste the address instead.', 'err'); }
      });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const address = input.value.trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(address)) return say('That does not look like a wallet address (0x followed by 40 characters).', 'err');
      button.disabled = true;
      say('Asking the Rewards server…');
      try {
        const r = await fetch(`${API}/antrom-afk/ring/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
        const b = await r.json().catch(() => ({}));
        if (!r.ok) return say(b.error || `Something went wrong (${r.status}). Try again in a minute.`, 'err');
        if (b.already) return say('This wallet already has its Ring. Look in your Backpack in Decentraland (it can take a few minutes to arrive).', 'ok');
        say('Done! Your Ring is on its way: open your Backpack in Decentraland in a minute or two, equip it, and welcome to Antrom.', 'ok');
        localStorage.setItem('guildstone.ringClaimed', address);
      } catch {
        say('Could not reach the server. Check your connection and try again.', 'err');
      } finally {
        button.disabled = false;
      }
    });
  }

  return { init() { stage(); links(); claim(); } };
})();

/* ---------- Go ---------- */
renderWearableFilters();
renderWearables();
renderMaterialFilters();
renderMaterials();
renderZones();
Guilds.init();
Chat.init();
Storm.init();
Ring.init();
routeFromHash();
refreshAssassinPrices();
