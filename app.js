/* Guildstone catalogue — plain DOM, no build step. */

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};

const TIER_LABEL = { T0: 'Base', T1: 'Tier 1', T2: 'Tier 2', T3: 'Tier 3', T4: 'Tier 4', C2: 'Pair drop', C3: 'Pair drop', C4: 'Set drop', C5: 'Apex drop' };
const GROUPS = [
  { id: 'ring', title: 'The Ring', blurb: 'Where it starts.', accent: '#ffd23f' },
  ...PROF_IDS.map((p) => ({ id: p, title: `${PROFESSIONS[p].name} suits`, blurb: `${PROFESSIONS[p].zone} · L1 → L4`, accent: PROFESSIONS[p].color })),
  { id: 'relic', title: 'Relics', blurb: 'One per profession. Cosmetic, mythic, and the only use for Tier 4 materials.', accent: '#ffd23f' },
  { id: 'crown', title: 'Guildstone Crown', blurb: 'All four Relics, fifty Shards. The last craft in the game.', accent: '#a259ff' }
];

/* ---------- Tabs ---------- */
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  for (const x of $('#tabs').children) x.classList.toggle('active', x === b);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.id === `tab-${b.dataset.tab}`);
});

/* ---------- Shared pieces ---------- */
function matChip(id, amount) {
  const m = MATERIALS[id];
  return el('button', { class: `mat ${m.kind}`, title: m.gate, onclick: () => openMaterial(id) },
    el('img', { src: m.img, alt: '' }),
    amount !== undefined ? el('span', { class: 'n' }, amount) : null,
    el('span', null, m.name)
  );
}

function wearableCard(w) {
  const accent = w.group in PROFESSIONS ? PROFESSIONS[w.group].color : w.profession ? PROFESSIONS[w.profession].color : (w.group === 'crown' ? '#a259ff' : '#ffd23f');
  const art = el('div', { class: 'art' },
    el('img', { src: w.img, alt: w.name, loading: 'lazy' }),
    w.level ? el('span', { class: 'lvl' }, `L${w.level}`) : null,
    el('span', { class: 'rarity' }, w.rarity)
  );
  const body = el('div', { class: 'body' },
    el('h3', null, w.name),
    el('div', { class: 'effect' }, w.effect),
    w.cost.length ? el('div', { class: 'label' }, 'Costs') : null,
    w.cost.length ? el('div', { class: 'cost' }, w.relics ? el('span', { class: 'mat relic' }, el('img', { src: 'img/suit.png', alt: '' }), el('span', { class: 'n' }, 4), el('span', null, 'Relics')) : null, ...w.cost.map(([m, n]) => matChip(m, n))) : null,
    el('div', { class: 'label' }, 'Requires'),
    el('ul', { class: 'req' }, ...w.requires.map((r) => el('li', null, r)))
  );
  return el('article', { class: 'card', style: `--accent:${accent}` }, art, body);
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
  const root = $('#wearables');
  root.replaceChildren();
  for (const g of GROUPS) {
    if (wearableFilter !== 'all' && wearableFilter !== g.id) continue;
    const items = WEARABLES.filter((w) => w.group === g.id);
    root.append(el('section', { class: 'group', style: `--accent:${g.accent}` },
      el('div', { class: 'group-head' }, el('h2', null, g.title), el('p', null, g.blurb)),
      el('div', { class: 'grid' }, ...items.map(wearableCard))
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
  if (m.kind === 'refined') lines.push(`Workshop · 5 ${MATERIALS[m.from].name}`);
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
  const root = $('#materials');
  root.replaceChildren();
  const sections = [];
  if (materialFilter === 'all' || materialFilter in PROFESSIONS) {
    const profs = materialFilter === 'all' ? PROF_IDS : [materialFilter];
    for (const p of profs) {
      const ids = LADDER[p].flatMap(([raw, , ref]) => [raw, ref]);
      sections.push({ title: `${PROFESSIONS[p].name} · ${PROFESSIONS[p].zone}`, blurb: 'Raw drop → Workshop refined, one row per suit tier', accent: PROFESSIONS[p].color, ids });
    }
  }
  if (materialFilter === 'all' || materialFilter === 'combo') {
    sections.push({ title: 'Combination drops', blurb: 'Only appear once you wear the right suits. They cross the two collections so nobody can tunnel one profession.', accent: '#ffd23f', ids: COMBOS.map((c) => c.id) });
  }
  for (const s of sections) {
    root.append(el('section', { class: 'group', style: `--accent:${s.accent}` },
      el('div', { class: 'group-head' }, el('h2', null, s.title), el('p', null, s.blurb)),
      el('div', { class: 'grid compact' }, ...s.ids.map((id) => materialCard(MATERIALS[id])))
    ));
  }
}

/* ---------- Detail drawer ---------- */
const detail = $('#detail');
const scrim = $('#scrim');
function closeDetail() { detail.classList.add('hidden'); scrim.classList.add('hidden'); }
scrim.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

function openMaterial(id) {
  const m = MATERIALS[id];
  const used = USED_IN[id] || [];
  const kv = [];
  kv.push(['Type', `${TIER_LABEL[m.tier]} · ${m.kind}`]);
  if (m.kind === 'refined') kv.push(['Made from', `5 × ${MATERIALS[m.from].name} at the Workshop`]);
  else if (m.kind === 'currency') kv.push(['How to get', m.gate]);
  else {
    kv.push(['Where', m.zones.map((z) => PROFESSIONS[z].zone).join(', ')]);
    kv.push(['You need', m.gate]);
  }
  if (m.rate) kv.push(['Drop rate', `1 in ${m.rate.toLocaleString()} cycles  (~${(3600 / 3 / m.rate).toFixed(m.rate > 1000 ? 2 : 1)} per hour)`]);
  else if (m.kind === 'raw') kv.push(['Drop rate', 'Every 3 s cycle, multiplied by your suit, tools and guild']);
  kv.push(['Sellable', m.sellable ? 'Yes — Depot' : 'No — craft only']);

  detail.replaceChildren(
    el('button', { class: 'close', onclick: closeDetail, 'aria-label': 'Close' }, '×'),
    el('img', { class: 'hero', src: m.img, alt: m.name }),
    el('h2', null, m.name),
    el('dl', { class: 'kv' }, ...kv.flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)])),
    used.length ? el('div', { class: 'label' }, 'Used for') : null,
    used.length ? el('div', { class: 'list' }, ...used.map((u) => {
      if (u.startsWith('refine:')) {
        const r = MATERIALS[u.slice(7)];
        return el('button', { onclick: () => openMaterial(r.id) }, el('img', { src: r.img, alt: '' }), el('span', null, r.name, el('small', null, 'Workshop refine, 5 → 1')));
      }
      const w = WEARABLES.find((x) => x.id === u);
      const amt = w.cost.find(([mm]) => mm === id)[1];
      return el('button', { onclick: () => { closeDetail(); wearableFilter = w.group; renderWearableFilters(); renderWearables(); $('#tabs button[data-tab=wearables]').click(); } },
        el('img', { src: w.img, alt: '' }), el('span', null, w.name, el('small', null, `${amt} needed`)));
    })) : null
  );
  detail.classList.remove('hidden');
  scrim.classList.remove('hidden');
}

/* ---------- Road tab ---------- */
function renderRoad() {
  const hours = Number($('#hours').value);
  const ms = milestones(hours);
  const max = ms[ms.length - 1][1];
  const list = $('#road');
  list.replaceChildren(...ms.map(([label, days]) => el('li', null,
    el('span', null, label),
    el('span', { class: 'bar' }, el('i', { style: `width:${Math.max(1.5, (days / max) * 100)}%` })),
    el('span', { class: 'days' }, days < 1 ? '< 1 day' : `${Math.round(days)} days`)
  )));
}
$('#hours').addEventListener('change', renderRoad);

/* ---------- Go ---------- */
renderWearableFilters();
renderWearables();
renderMaterialFilters();
renderMaterials();
renderRoad();
