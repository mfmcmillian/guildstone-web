/* Guild standings and player leaderboards.
   One request to GET /antrom-afk/leaderboard brings every AntromAFK profile and guild in compact form; ranking
   happens here, so a new board is a few lines in BOARDS and never a backend deploy. Guild pages pull the full
   guild record (roster, tech, donors, activity) from GET /antrom-afk/guild/:tag on demand.
   Loaded before app.js; it only touches the DOM once app.js calls Guilds.init(). */

const Guilds = (() => {
  // Dev hook: localStorage.setItem('guildstone.api', 'http://localhost:4123') to point at a local backend.
  const API = localStorage.getItem('guildstone.api') || 'https://dcl-firebase-backend.vercel.app';
  const REFRESH_MS = 60 * 1000;
  const RANKS_KEY = 'guildstone.ranks.v1';
  const MAX_ROWS = 100;
  const TOOL_NAMES = { lumberjack: 'Axe', miner: 'Pickaxe', butcher: 'Cleaver', assassin: 'Dagger' };
  // Guild tech, in the order the game shows it (names mirror the wearable client).
  const TECH = {
    woodBoost: ['Lumberjack', '+10% wood per level'], stoneBoost: ['Stonemason', '+10% rock per level'], meatBoost: ['Hunter', '+4% meat per level'],
    xpBoost: ['Field Tactics', '+2% profession XP per level'], craftDiscount: ['Workshop', '10% faster crafts per level'], lootLuck: ['Fortune', '+2% bone and +10 bag per level'],
    prospector: ['Prospector', '+2% chance a rare drop doubles per level'], merchant: ['Merchant', '+3% coins on sales per level'], architect: ['Architects', 'HQ donations count +5% more per level'],
    quartermaster: ['Quartermaster', 'Berry boosts last +10% longer per level'], forager: ['Forager', '+5% double-berry chance per level']
  };
  const ROLES = ['leader', 'royal guard', 'knight', 'squire', 'member'];
  const ROLE_LABEL = { leader: 'Leader', 'royal guard': 'Royal Guard', knight: 'Knight', squire: 'Squire', member: 'Member' };

  const state = { data: null, error: null, board: 'overall', query: '', visible: false, timer: null, baseline: null, guildCache: {}, openTag: null };

  /* ---------- Small helpers ---------- */
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const nameOf = (p) => (p && p.name) || (p ? short(p.address) : '');
  const idx = (prof) => (state.data ? state.data.skills.indexOf(prof) : PROF_IDS.indexOf(prof));
  function ago(ts) {
    if (!ts) return 'never';
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 48 * 3600) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
  const activeThisWeek = (p) => Date.now() - p.active < 7 * 86400e3;
  // A stable colour per guild tag so the same tag always looks the same across the page.
  function tagHue(tag) {
    let h = 0;
    for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }
  const guildById = (id) => (state.data ? state.data.guilds.find((g) => g.id === id) : null) || null;
  function tagChip(g, big = false) {
    if (!g) return null;
    return el('span', { class: `gtag${big ? ' big' : ''}`, style: `--h:${tagHue(g.tag)}`, title: g.name }, g.tag);
  }
  function profDot(prof, text) {
    return el('span', { class: 'pdot', style: `--c:${PROFESSIONS[prof].color}`, title: PROFESSIONS[prof].name }, el('img', { src: PROFESSIONS[prof].icon, alt: '' }), text);
  }
  function suitBadge(prof, tier) {
    return tier > 0 ? el('span', { class: 'sbadge', style: `--c:${PROFESSIONS[prof].color}` }, `L${tier}`) : el('span', { class: 'sbadge none' }, '—');
  }
  function bar(pct, color) {
    return el('span', { class: 'bar' }, el('span', { class: 'fill', style: `width:${Math.max(0, Math.min(100, pct))}%;${color ? `background:${color}` : ''}` }));
  }
  function medal(rank) {
    return el('span', { class: `rank${rank <= 3 ? ` m${rank}` : ''}` }, rank);
  }
  function roleOf(guild, address) {
    if (guild.leaderId === address) return 'leader';
    if ((guild.royalGuardIds || []).includes(address)) return 'royal guard';
    if ((guild.knightIds || []).includes(address)) return 'knight';
    if ((guild.squireIds || []).includes(address)) return 'squire';
    return 'member';
  }
  // Progress toward the next HQ level, averaged over the three resources it costs.
  function hqPct(g) {
    if (!g.hqCost) return 100;
    const parts = ['coins', 'wood', 'rock'].map((k) => Math.min(1, (g.hqProgress?.[k] || 0) / Math.max(1, g.hqCost[k])));
    return (sum(parts) / 3) * 100;
  }

  /* ---------- Boards ---------- */
  // score: higher wins, compared left to right. cols: extra columns after the player column.
  const BOARDS = [
    {
      id: 'overall', label: 'Overall', color: '#a259ff', hint: 'Total profession level across all four roads. Ties go to lifetime XP.',
      score: (p) => [sum(p.level), sum(p.xp)],
      cols: [
        { h: 'Total level', v: (p) => el('strong', null, sum(p.level)) },
        { h: 'Professions', v: (p) => el('span', { class: 'dots' }, ...PROF_IDS.map((pr) => profDot(pr, p.level[idx(pr)]))) },
        { h: 'Suits', v: (p) => el('span', { class: 'dots' }, ...PROF_IDS.map((pr) => suitBadge(pr, p.suit[idx(pr)]))) },
        { h: 'Lifetime XP', v: (p) => fmt(sum(p.xp)), cls: 'num' }
      ]
    },
    ...PROF_IDS.map((prof) => ({
      id: prof, label: PROFESSIONS[prof].name, icon: PROFESSIONS[prof].icon, color: PROFESSIONS[prof].color,
      hint: `Highest ${PROFESSIONS[prof].name} level in the ${PROFESSIONS[prof].zone}. Ties go to lifetime XP in that profession.`,
      score: (p) => [p.level[idx(prof)], p.xp[idx(prof)]],
      cols: [
        { h: 'Level', v: (p) => el('strong', null, `Lv ${p.level[idx(prof)]}`) },
        { h: 'Lifetime XP', v: (p) => fmt(p.xp[idx(prof)]), cls: 'num' },
        { h: 'Suit', v: (p) => suitBadge(prof, p.suit[idx(prof)]) },
        { h: TOOL_NAMES[prof], v: (p) => (p.tool[idx(prof)] ? `Tier ${p.tool[idx(prof)]}` : '—') }
      ]
    })),
    {
      id: 'suits', label: 'Suits', icon: 'img/suit.png', color: '#ffd23f', hint: 'Suit tiers currently worn, added up across professions. Crafted suits that are minted but not worn count second.',
      score: (p) => [sum(p.suit), p.crafted, sum(p.level)], filter: (p) => sum(p.suit) > 0 || p.crafted > 0,
      cols: [
        { h: 'Suit tiers', v: (p) => el('strong', null, sum(p.suit)) },
        { h: 'Worn', v: (p) => el('span', { class: 'dots' }, ...PROF_IDS.map((pr) => suitBadge(pr, p.suit[idx(pr)]))) },
        { h: 'Crafted', v: (p) => p.crafted || '—', cls: 'num' }
      ]
    },
    {
      id: 'coins', label: 'Coins', icon: 'img/coin.png', color: '#ffd23f', hint: 'Coins in the Bank right now. Spend them and you drop; this board rewards hoarders.',
      score: (p) => [p.coins], filter: (p) => p.coins > 0,
      cols: [{ h: 'Coins', v: (p) => el('strong', null, fmt(p.coins)), cls: 'num' }]
    },
    {
      id: 'donors', label: 'Guild donors', color: '#6bc74a', hint: 'Lifetime guild contribution points from HQ and tech donations, across every guild the player has donated to.',
      score: (p) => [p.donated, sum(p.level)], filter: (p) => p.donated > 0,
      cols: [{ h: 'Points', v: (p) => el('strong', null, fmt(p.donated)), cls: 'num' }]
    }
  ];
  const boardById = (id) => BOARDS.find((b) => b.id === id) || BOARDS[0];
  const cmpScore = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
    return 0;
  };
  function ranked(board) {
    const list = state.data.players.filter(board.filter || (() => true)).map((p) => ({ p, s: board.score(p) }));
    list.sort((a, b) => cmpScore(a.s, b.s) || nameOf(a.p).localeCompare(nameOf(b.p)));
    return list.map((x, i) => ({ ...x, rank: i + 1 }));
  }
  function guildStandings() {
    return state.data.guilds.filter((g) => !g.legacy).sort((a, b) => b.hqLevel - a.hqLevel || b.techTotal - a.techTotal || b.points - a.points || b.memberCount - a.memberCount);
  }

  /* ---------- Rank memory ("since your last visit") ---------- */
  function loadBaseline() {
    try { state.baseline = JSON.parse(localStorage.getItem(RANKS_KEY)); } catch { state.baseline = null; }
  }
  function saveRanks() {
    const boards = {};
    for (const b of BOARDS) boards[b.id] = Object.fromEntries(ranked(b).map((r) => [r.p.address, r.rank]));
    boards.guilds = Object.fromEntries(guildStandings().map((g, i) => [g.id, i + 1]));
    try { localStorage.setItem(RANKS_KEY, JSON.stringify({ at: Date.now(), boards })); } catch { /* private mode */ }
  }
  function delta(boardId, key, rank) {
    const prev = state.baseline?.boards?.[boardId];
    if (!prev) return null;
    if (!(key in prev)) return el('span', { class: 'delta new', title: 'New since your last visit' }, 'new');
    const d = prev[key] - rank;
    if (!d) return null;
    return el('span', { class: `delta ${d > 0 ? 'up' : 'down'}`, title: `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} since your last visit` }, `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`);
  }

  /* ---------- Data ---------- */
  async function load() {
    const status = $('#lb-status');
    if (!state.data) { status.classList.remove('hidden'); status.replaceChildren(el('span', { class: 'spin' }), 'Loading the standings…'); }
    try {
      const res = await fetch(`${API}/antrom-afk/leaderboard`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      state.data = await res.json();
      state.error = null;
      status.classList.add('hidden');
      render();
      saveRanks();
    } catch (e) {
      state.error = e.message;
      if (!state.data) {
        status.classList.remove('hidden');
        status.replaceChildren('Could not reach the game server. ', el('button', { class: 'chip', onclick: load }, 'Try again'));
      }
      renderMeta();
    }
  }
  function schedule() {
    clearInterval(state.timer);
    state.timer = state.visible ? setInterval(load, REFRESH_MS) : null;
  }

  /* ---------- Rendering ---------- */
  function render() {
    renderMeta();
    renderStats();
    renderGuilds();
    renderBoardFilters();
    renderBoard();
  }
  function renderMeta() {
    const box = $('#lb-meta');
    if (!state.data) return box.replaceChildren();
    box.replaceChildren(
      el('span', null, state.error ? `Last update failed (${state.error}). Showing ${ago(state.data.updatedAt)}.` : `Updated ${ago(state.data.updatedAt)}`),
      el('button', { class: 'chip', onclick: load }, 'Refresh')
    );
  }
  function renderStats() {
    const d = state.data;
    const guilds = d.guilds.filter((g) => !g.legacy);
    const tiles = [
      ['Players', d.players.length, 'with a Guildstone profile'],
      ['Active this week', d.players.filter(activeThisWeek).length, 'gathered in the last 7 days'],
      ['Guilds', guilds.length, `${sum(guilds.map((g) => g.memberCount))} members between them`],
      ['Suits worn', sum(d.players.map((p) => sum(p.suit))), 'suit tiers equipped right now'],
      ['Guild donations', fmt(sum(guilds.map((g) => g.points))), 'lifetime contribution points']
    ];
    $('#lb-stats').replaceChildren(...tiles.map(([label, value, sub]) => el('div', { class: 'stat' }, el('span', { class: 'v' }, value), el('span', { class: 'l' }, label), el('span', { class: 's' }, sub))));
  }
  function renderGuilds() {
    const root = $('#guild-list');
    const standings = guildStandings();
    if (!standings.length) return root.replaceChildren(el('p', { class: 'muted' }, 'No guilds founded yet. Be the first.'));
    root.replaceChildren(
      el('div', { class: 'grow head' }, el('span'), el('span', null, 'Guild'), el('span', null, 'HQ'), el('span', null, 'Members'), el('span', null, 'Tech'), el('span', null, 'Donations'), el('span', null, 'Top donor')),
      ...standings.map((g, i) => {
        const rank = i + 1;
        const members = state.data.players.filter((p) => p.guild === g.id);
        return el('button', { class: `grow${g.tag === state.openTag ? ' open' : ''}`, style: `--h:${tagHue(g.tag)}`, onclick: () => openGuild(g.tag) },
          el('span', { class: 'rk' }, medal(rank), delta('guilds', g.id, rank)),
          el('span', { class: 'who' }, tagChip(g), el('span', { class: 'nm' }, el('strong', null, g.name), g.motto ? el('em', null, g.motto) : null)),
          el('span', { class: 'hq' }, el('strong', null, `Lv ${g.hqLevel}`), bar(hqPct(g)), el('small', null, g.hqCost ? `${Math.round(hqPct(g))}% to ${g.hqLevel + 1}` : 'Maxed')),
          el('span', { class: 'num', 'data-l': 'Members' }, `${g.memberCount}/${g.maxMembers}`, el('small', null, `${members.filter(activeThisWeek).length} active this week`)),
          el('span', { class: 'num', 'data-l': 'Tech' }, g.techTotal, el('small', null, 'levels')),
          el('span', { class: 'num', 'data-l': 'Donations' }, fmt(g.points), el('small', null, `${g.donors} donor${g.donors === 1 ? '' : 's'}`)),
          el('span', { class: 'donor', 'data-l': 'Top donor' }, g.topDonor ? [el('strong', null, g.topDonor.name || short(g.topDonor.address)), el('small', null, `${fmt(g.topDonor.points)} pts`)] : el('small', null, 'Nobody yet'))
        );
      })
    );
    const legacy = state.data.guilds.filter((g) => g.legacy);
    $('#guild-unclaimed').replaceChildren(...(legacy.length ? [
      el('p', { class: 'unclaimed-head' }, 'Founded in Knights of Antrom, not yet in Antrom AFK. Any member can bring their guild over from the ring.'),
      el('div', { class: 'unclaimed' }, ...legacy.map((g) => el('span', { class: 'uc', style: `--h:${tagHue(g.tag)}` }, tagChip(g), el('span', null, g.name), el('small', null, `${g.memberCount} members · HQ ${g.hqLevel}`))))
    ] : []));
  }
  function renderBoardFilters() {
    const box = $('#board-filters');
    box.replaceChildren(...BOARDS.map((b) => el('button', { class: `chip${state.board === b.id ? ' active' : ''}`, style: `--chip:${b.color}`, onclick: () => showBoard(b.id) },
      b.icon ? el('img', { src: b.icon, alt: '' }) : null, b.label)));
    $('#board-hint').textContent = boardById(state.board).hint;
  }
  function renderBoard() {
    const root = $('#board-list');
    if (!state.data) return;
    const board = boardById(state.board);
    const q = state.query.trim().toLowerCase();
    const all = ranked(board);
    const rows = q ? all.filter(({ p }) => nameOf(p).toLowerCase().includes(q) || p.address.includes(q) || (guildById(p.guild)?.tag || '').toLowerCase() === q) : all.slice(0, MAX_ROWS);
    if (!all.length) return root.replaceChildren(el('p', { class: 'muted' }, 'Nobody on this board yet.'));
    if (!rows.length) return root.replaceChildren(el('p', { class: 'muted' }, `No player matches “${state.query.trim()}”.`));
    const table = el('table', { class: 'board', style: `--accent:${board.color}` },
      el('thead', null, el('tr', null, el('th', { class: 'rk' }, '#'), el('th', null, 'Player'), ...board.cols.map((c) => el('th', { class: c.cls || null }, c.h)), el('th', { class: 'act' }, 'Active'))),
      el('tbody', null, ...rows.map(({ p, rank }) => {
        const g = guildById(p.guild);
        return el('tr', { class: q ? 'hit' : null },
          el('td', { class: 'rk' }, medal(rank), delta(board.id, p.address, rank)),
          el('td', { class: 'who' }, el('span', { class: 'nm' }, el('strong', null, nameOf(p)), g ? el('button', { class: 'gtag', style: `--h:${tagHue(g.tag)}`, title: g.name, onclick: (e) => { e.stopPropagation(); openGuild(g.tag); } }, g.tag) : null), el('small', { title: p.address }, short(p.address))),
          ...board.cols.map((c) => el('td', { class: c.cls || null }, c.v(p))),
          el('td', { class: 'act' }, ago(p.active))
        );
      }))
    );
    root.replaceChildren(table);
    if (all.length > MAX_ROWS && !q) root.append(el('p', { class: 'muted small' }, `Top ${MAX_ROWS} of ${all.length}. Search to find anyone else.`));
  }

  /* ---------- Guild page (drawer) ---------- */
  async function fetchGuild(tag) {
    const key = tag.toUpperCase();
    const hit = state.guildCache[key];
    if (hit && Date.now() - hit.at < REFRESH_MS) return hit.guild;
    const res = await fetch(`${API}/antrom-afk/guild/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'That guild has not been founded in Antrom AFK yet.' : `Server responded ${res.status}`);
    const guild = await res.json();
    state.guildCache[key] = { at: Date.now(), guild };
    return guild;
  }
  async function openGuild(tag) {
    tag = String(tag || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    if (!tag) return;
    state.openTag = tag;
    if (location.hash !== `#guilds/${tag}`) history.replaceState(null, '', `#guilds/${tag}`);
    detail.replaceChildren(el('button', { class: 'close', onclick: closeDetail, 'aria-label': 'Close' }, '×'), el('div', { class: 'lb-status' }, el('span', { class: 'spin' }), `Opening ${tag}…`));
    detail.classList.remove('hidden');
    scrim.classList.remove('hidden');
    try {
      const guild = await fetchGuild(tag);
      if (state.openTag !== tag) return;
      renderGuildPage(guild);
    } catch (e) {
      detail.replaceChildren(el('button', { class: 'close', onclick: closeDetail, 'aria-label': 'Close' }, '×'), el('h2', null, tag), el('p', { class: 'muted' }, e.message));
    }
  }
  function renderGuildPage(guild) {
    const names = guild.memberNames || {};
    const players = Object.fromEntries((state.data?.players || []).map((p) => [p.address, p]));
    const memberName = (id) => names[id] || players[id]?.name || short(id);
    const standing = state.data ? guildStandings().findIndex((g) => g.id === guild.id) + 1 : 0;
    const summary = guildById(guild.id);

    const roster = (guild.memberIds || []).map((id) => ({ id: id.toLowerCase(), role: roleOf(guild, id.toLowerCase()), p: players[id.toLowerCase()] || null }))
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || sum(b.p?.level || [0]) - sum(a.p?.level || [0]) || memberName(a.id).localeCompare(memberName(b.id)));
    const donors = Object.entries(guild.contributions || {}).filter(([, c]) => c.points > 0).sort((a, b) => b[1].points - a[1].points);
    const events = [...(guild.events || [])].reverse().slice(0, 10);
    const bonuses = guild.bonuses || {};
    const bonusChips = [
      ['wood', bonuses.woodPct], ['rock', bonuses.rockPct], ['meat', bonuses.meatPct], ['bone', bonuses.bonePct], ['XP', bonuses.xpPct], ['craft speed', bonuses.craftPct], ['sale coins', bonuses.sellPct], ['boost time', bonuses.boostDurationPct]
    ].filter(([, v]) => v > 0).map(([k, v]) => el('span', { class: 'bonus' }, `+${Math.round(v * 100)}% ${k}`));
    if (bonuses.bagBonus > 0) bonusChips.push(el('span', { class: 'bonus' }, `+${bonuses.bagBonus} bag`));
    if (bonuses.rareDoublePct > 0.05) bonusChips.push(el('span', { class: 'bonus' }, `${Math.round(bonuses.rareDoublePct * 100)}% rare double`));

    const hqRows = guild.hqCost ? ['coins', 'wood', 'rock'].map((k) => el('div', { class: 'hqrow' }, el('span', null, k), bar(100 * (guild.hqProgress?.[k] || 0) / Math.max(1, guild.hqCost[k])), el('small', null, `${fmt(guild.hqProgress?.[k])} / ${fmt(guild.hqCost[k])}`))) : [el('p', { class: 'muted' }, 'HQ is at the maximum level.')];

    detail.replaceChildren(...[
      el('button', { class: 'close', onclick: closeDetail, 'aria-label': 'Close' }, '×'),
      el('div', { class: 'ghead', style: `--h:${tagHue(guild.tag)}` },
        tagChip(guild, true),
        el('div', null, el('h2', null, guild.name), el('div', { class: 'tier-line' }, standing ? `#${standing} in the standings · HQ ${guild.hqLevel} · ${guild.memberCount}/${guild.maxMembers} members` : `HQ ${guild.hqLevel} · ${guild.memberCount}/${guild.maxMembers} members`))
      ),
      guild.motto ? el('p', { class: 'motto' }, `“${guild.motto}”`) : null,
      guild.description ? el('p', { class: 'desc' }, guild.description) : null,
      el('dl', { class: 'kv' },
        el('dt', null, 'Leader'), el('dd', null, memberName(guild.leaderId)),
        guild.motd ? el('dt', null, 'Message of the day') : null, guild.motd ? el('dd', null, guild.motd) : null,
        summary?.createdAt ? el('dt', null, 'Founded') : null, summary?.createdAt ? el('dd', null, new Date(summary.createdAt).toLocaleDateString()) : null
      ),
      el('div', { class: 'label' }, `HQ level ${guild.hqLevel}${guild.hqCost ? ` · progress to ${guild.hqLevel + 1}` : ''}`),
      el('div', { class: 'hqbox' }, ...hqRows),
      bonusChips.length ? el('div', { class: 'label' }, 'Every member gets') : null,
      bonusChips.length ? el('div', { class: 'bonuses' }, ...bonusChips) : null,
      el('div', { class: 'label' }, 'Guild tech'),
      el('div', { class: 'tech' }, ...Object.keys(TECH).map((key) => {
        const node = guild.techTree?.[key];
        if (!node) return null;
        const locked = node.locked || (node.unlockHq && guild.hqLevel < node.unlockHq);
        return el('div', { class: `tnode${locked ? ' locked' : ''}`, title: TECH[key][1] },
          el('span', { class: 'tn' }, TECH[key][0]), el('span', { class: 'tl' }, locked ? `HQ ${node.unlockHq}` : `${node.level}/${node.maxLevel}`), bar(locked ? 0 : (100 * node.level) / Math.max(1, node.maxLevel)));
      })),
      el('div', { class: 'label' }, `Roster · ${roster.length}`),
      el('div', { class: 'roster' }, ...roster.map((m) => el('div', { class: `mrow r-${m.role.replace(' ', '-')}` },
        el('span', { class: 'role' }, ROLE_LABEL[m.role]),
        el('span', { class: 'mname' }, el('strong', null, memberName(m.id)), m.p ? el('small', null, `active ${ago(m.p.active)}`) : el('small', null, 'no Guildstone profile yet')),
        m.p ? el('span', { class: 'dots' }, ...PROF_IDS.map((pr) => profDot(pr, m.p.level[idx(pr)]))) : el('span'),
        m.p ? el('span', { class: 'tot' }, sum(m.p.level)) : el('span')
      ))),
      donors.length ? el('div', { class: 'label' }, 'Top donors') : null,
      donors.length ? el('div', { class: 'donors' }, ...donors.slice(0, 8).map(([id, c], i) => el('div', { class: 'drow' },
        medal(i + 1), el('span', { class: 'mname' }, el('strong', null, memberName(id)), el('small', null, [c.coins && `${fmt(c.coins)} coins`, c.wood && `${fmt(c.wood)} wood`, c.rock && `${fmt(c.rock)} rock`, c.techCoins && `${fmt(c.techCoins)} to tech`].filter(Boolean).join(' · ') || 'HQ donations')),
        el('span', { class: 'tot' }, `${fmt(c.points)} pts`)
      ))) : null,
      events.length ? el('div', { class: 'label' }, 'Recent activity') : null,
      events.length ? el('div', { class: 'feed' }, ...events.map((ev) => el('div', { class: 'ev' }, el('span', null, el('strong', null, memberName(ev.by)), ` ${ev.text.replace(/\b[a-z]+[A-Z][A-Za-z]*\b/g, (k) => (TECH[k] ? TECH[k][0] : k))}`), el('small', null, ago(ev.at))))) : null,
      el('a', { class: 'buy', href: `#board/overall`, onclick: (e) => { e.preventDefault(); closeDetail(); showBoard('overall', true); $('#board-search').value = guild.tag; state.query = guild.tag; renderBoard(); } }, `Show ${guild.tag} players on the leaderboard`)
    ].filter(Boolean));
  }

  /* ---------- Public API ---------- */
  function showBoard(id, scroll = false) {
    state.board = boardById(id).id;
    renderBoardFilters();
    renderBoard();
    if (scroll) requestAnimationFrame(() => $('#player-board').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function setVisible(visible) {
    state.visible = visible;
    if (visible && state.data && Date.now() - state.data.updatedAt > REFRESH_MS) load();
    schedule();
  }
  function onDetailClosed() {
    if (state.openTag) {
      state.openTag = null;
      if (location.hash.startsWith('#guilds/')) history.replaceState(null, '', '#guilds');
      if (state.data) renderGuilds();
    }
  }
  function init() {
    loadBaseline();
    $('#board-search').addEventListener('input', (e) => { state.query = e.target.value; renderBoard(); });
    load();
  }

  return { init, setVisible, showBoard, openGuild, onDetailClosed };
})();
