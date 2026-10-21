/* Antrom Storm: the WAR tab explained, plus the Hero window and the Valor board.
   Rules mirror dcl-firebase-backend/api/afkAdminConfig.js defaults and AntromAFK-Wearable/docs/SHADOW_RAID.md.
   Live numbers come from the leaderboard payload guilds.js already fetches (event 'guildstone:data'). */
const Storm = (() => {
  'use strict';

  const ART = 'img/raid/';
  // Server defaults. The dashboard can retune them live; the text here is the design, not a contract.
  const RULES = { tickMs: 3000, ticks: 80, gatherMs: 120000, walkMs: 7500, koWalkMs: 20000, sideMax: 4, raidsPerDay: 5, captureTicks: 2, valorPerTick: 1, valorPerKo: 5, valorWinMult: 1.5 };
  const POINTS = [
    { id: 'watchtower', name: 'Watchtower', pips: 1, armour: 0, attack: 15, x: 34, y: 21 },
    { id: 'sawmill', name: 'Sawmill', pips: 1, armour: 15, attack: 0, x: 68, y: 19 },
    { id: 'citadel', name: 'Citadel', pips: 2, armour: 0, attack: 0, x: 51, y: 44 },
    { id: 'quarry', name: 'Quarry', pips: 1, armour: 15, attack: 0, x: 30, y: 74 },
    { id: 'shrine', name: 'Bone Shrine', pips: 1, armour: 0, attack: 15, x: 70, y: 71 }
  ];
  const HERO_IDS = ['assassin', 'knight', 'warlock'];
  const HEROES = {
    assassin: { name: 'Assassin', beats: 'warlock', color: '#a259ff', blurb: 'The fighter you already level in the Skeleton Yard. Quick and lethal, cut down by the Knight’s shield.' },
    knight: { name: 'Knight', beats: 'assassin', color: '#ffd23f', blurb: 'Heavy plate, sword and shield. Shrugs off the Assassin’s blades, but the Warlock burns through steel.' },
    warlock: { name: 'Warlock', beats: 'knight', color: '#ff63e1', blurb: 'Robes and a staff full of bad ideas. Melts the Knight; too slow to catch the Assassin.' }
  };
  const CURVE = { maxLevel: 30, base: 200, growth: 1.18, perLevel: { hp: 25, atk: 3, speed: 0.02, recovery: 0.03 } };
  const STATS = [
    ['hp', 'HP', '+25 a level', 'More health in a raid'],
    ['atk', 'Attack', '+3 a level', 'More damage every clash'],
    ['speed', 'Speed', '+2% a level', 'Reach buildings sooner'],
    ['recovery', 'Recovery', '+3% a level', 'Back from a knock-out sooner']
  ];
  const beatenBy = (id) => HERO_IDS.find((h) => HEROES[h].beats === id);
  const stepCost = (level) => Math.round(CURVE.base * Math.pow(CURVE.growth, level - 1));
  const roadCost = () => { let t = 0; for (let l = 1; l < CURVE.maxLevel; l++) t += stepCost(l); return t; };
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
  const secs = (ms) => { const s = ms / 1000; return `${Number.isInteger(s) ? s : s.toFixed(1)} s`; };
  const mins = (ms) => { const m = ms / 60000; return `${Number.isInteger(m) ? m : m.toFixed(1)} min`; };

  /** Idle frame from a hero's sprite sheet (864×720, 6×5 cells of 144 px; row 0 is idle). */
  function sprite(id, enemy = false, size = 144) {
    const s = size / 144;
    const sheet = `${ART}${id}_${enemy ? 'enemy_' : ''}${id === 'assassin' ? 'v2' : 'v1'}.png`;
    return el('span', { class: 'sprite', style: `width:${size}px;height:${size}px;background-image:url(${sheet});background-size:${864 * s}px ${720 * s}px;`, 'aria-hidden': 'true' });
  }
  /** Small "Knight 7" chip for boards. Level 1 is the default, so it reads as plain text. */
  function heroChip(id, level) {
    const h = HEROES[id] || HEROES.assassin;
    return el('span', { class: 'hchip', style: `--c:${h.color}` }, sprite(id, false, 28), `${h.name}${level > 1 ? ` ${level}` : ''}`);
  }

  function renderField() {
    const field = $('#field');
    field.replaceChildren(
      el('img', { src: `${ART}battlefield_v1.jpg`, alt: 'The Antrom Storm battlefield: five buildings between two camps' }),
      el('span', { class: 'camp dusk', style: 'left:8%;top:52%' }, 'Team Dusk'),
      el('span', { class: 'camp dawn', style: 'left:92%;top:52%' }, 'Team Dawn'),
      ...POINTS.map((p) => el('span', { class: `pt${p.pips > 1 ? ' big' : ''}`, style: `left:${p.x}%;top:${p.y}%` },
        el('b', null, p.name), el('small', null, `+${p.pips}${p.armour ? ` · ${p.armour}% armour` : p.attack ? ` · ${p.attack}% attack` : ''}`)))
    );
    const maxTick = POINTS.reduce((a, p) => a + p.pips, 0);
    $('#field-rules').replaceChildren(
      el('dl', null,
        el('dt', null, 'A tick'), el('dd', null, `Every ${secs(RULES.tickMs)}: arrivals land, buildings with both sides inside trade damage, flags pay out. ${RULES.ticks} ticks to a Storm, ${mins(RULES.tickMs * RULES.ticks)} in all.`),
        el('dt', null, 'Taking a flag'), el('dd', null, `Stand there with no enemy for ${RULES.captureTicks} ticks and it flips. A defender walking in resets you. Both sides inside: nobody is paid.`),
        el('dt', null, 'Holding one'), el('dd', null, `A flag pays its pips every tick whether anyone is home or not, so a pair can own three or four buildings. Up to ${maxTick} a tick, ${maxTick * RULES.ticks} for a perfect Storm.`),
        el('dt', null, 'Building bonus'), el('dd', null, 'The side whose flag is on the building fights better inside it: Sawmill and Quarry cut the damage you take by 15%, Watchtower and Bone Shrine raise the damage you deal by 15%. Attackers get nothing. The Citadel has no bonus; it is worth double instead.'),
        el('dt', null, 'Knocked out'), el('dd', null, `HP at 0 and you are carried back to camp over ${secs(RULES.koWalkMs)}, revive at full and walk straight back to your last building. Walking home instead heals you 25% of max HP a tick, empty to full in four ticks, so retreating to heal is cheaper than dying.`),
        el('dt', null, 'Walking'), el('dd', null, `Camp to Citadel is ${secs(RULES.walkMs)}; near corners about 3 s, far ones 12–15 s. You can't be hit on the road and you score nothing there.`)
      )
    );
  }

  function renderSteps() {
    const steps = [
      ['Ring the bell', `Any guild member opens the WAR tab and taps <strong>ENTER THE STORM</strong>. If none is gathering that opens one; everyone in the lobby hears the bell and has ${mins(RULES.gatherMs)} to join. One Storm at a time, server-wide.`],
      ['Teams are drawn', `At the bell the list is shuffled into <strong>Team Dusk</strong> and <strong>Team Dawn</strong>, up to ${RULES.sideMax} a side. Alone? You fight a Wraith copy of yourself. Odd count? One Wraith pads the short side.`],
      ['Click a building', 'The building is the button. Walk, arrive, hold. Click another to move, or BACK TO CAMP to heal. Your fighter is you: HP and ATK come from your Assassin level, dagger, suit pieces, VIP tier and hero.'],
      ['Most flags wins', `When the ${RULES.ticks} ticks run out the higher score takes it. Everyone earns Valor: ${RULES.valorPerTick} a tick in the Storm, ×${RULES.valorWinMult} on the winning side, +${RULES.valorPerKo} a knockout. Ranked Storms also pay into the bank: the winning side 400 wood, 400 rock, 200 meat and 200 bone each, the other side half.`],
      ['Fight all day', `Your first ${RULES.raidsPerDay} Storms each day are ranked and pay Valor. After that you can keep fighting for the record (wins, Storms, knockouts) but the Valor is spent.`]
    ];
    $('#storm-steps').replaceChildren(...steps.map(([h, p], i) => {
      const a = el('article', { class: 'rule' }, el('span', { class: 'step' }, i + 1), el('h3', null, h));
      const body = el('p'); body.innerHTML = p; a.append(body);
      return a;
    }));
    const war = [
      ['Sign up by Tuesday', 'The guild leader taps SIGN UP on the Guild Battle card any time from the previous Wednesday night until Tuesday 11:59 PM ET. WITHDRAW until then.'],
      ['Get paired', 'Once sign-ups close, guilds are paired in sign-up order. The card shows your matchup for the week; an odd guild out sits that one with a bye.'],
      ['Field four', 'Wednesday 9–11 PM ET, members tap JOIN like any Storm. The moment both guilds have four, the start pulls in to one minute. A side that can\u2019t field four by 11 PM forfeits and nothing is paid.'],
      ['Take the payout', 'Everyone who fights banks 1,500 wood, 1,500 rock, 750 meat and 750 bone; the top guild’s fighters bank 3,000 wood, 3,000 rock, 1,500 meat and 1,500 bone on top. Bring friends: a tile with five fighters captures in a fraction of the time one takes. Guild points are Valor ×3 and the match goes on the guild\u2019s record. No Wraiths, no daily cap, always ranked.']
    ];
    $('#war-steps').replaceChildren(...war.map(([h, p], i) => el('article', { class: 'rule' }, el('span', { class: 'step' }, i + 1), el('h3', null, h), el('p', null, p))));
  }

  function renderHeroes() {
    $('#hero-grid').replaceChildren(...HERO_IDS.map((id) => {
      const h = HEROES[id];
      return el('article', { class: 'hcard', style: `--c:${h.color}` },
        el('div', { class: 'hstage', style: `background-image:url(${ART}hero_stage_${id}_v1.jpg)` }, sprite(id, false, 180)),
        el('div', { class: 'hbody' },
          el('h3', null, h.name),
          el('p', null, h.blurb),
          el('div', { class: 'hvs' },
            el('span', { class: 'hpill win' }, `+20% damage to ${HEROES[h.beats].name}`),
            el('span', { class: 'hpill lose' }, `${HEROES[beatenBy(id)].name} does +20% to you`)
          )
        )
      );
    }));
    const last = stepCost(CURVE.maxLevel - 1);
    $('#hero-formula').replaceChildren(
      el('div', { class: 'fcol' },
        el('h4', null, 'Levelling'),
        el('p', null, `Each hero has its own level, 1 to ${CURVE.maxLevel}, on the same curve. A step costs the same amount of each of wood, rock, meat and bone, paid from the Depot first and then your bag: `, el('strong', null, `${fmt(stepCost(1))} each`), ` for the first, `, el('strong', null, `${fmt(last)} each`), ` for the last, about `, el('strong', null, `${fmt(roadCost())} of each`), ` over the whole road.`),
        el('ul', { class: 'hstats' }, ...STATS.map(([k, label, per, why]) => el('li', null, el('b', null, label), el('span', null, per), el('small', null, why))))
      ),
      el('div', { class: 'fcol' },
        el('h4', null, 'Your fighter'),
        el('pre', null, 'HP  = (100 + 10·level + 50·suit pieces + 25·(hero − 1)) × VIP\nATK = (10 + 0.5·level + 15·dagger + 3·(hero − 1)) × VIP\nVIP = 1 + 0.04 × tier  (Bronze 0 … Mythic 5)\n\n+20% damage against the hero yours beats.\nStats freeze when you join; nothing is lost in a Storm.'),
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', null, 'Example'), el('th', null, 'HP'), el('th', null, 'ATK'))),
          el('tbody', null,
            ...[['Lv 1, nothing', 110, 11], ['Lv 37, Dagger 3', 470, 74], ['Lv 52, Dagger 4, Gold VIP', 670, 104], ['Lv 78, Dagger 5, full set', 1080, 124], ['Lv 99, Dagger 5, full set, Mythic', 1548, 161], ['…and a level 30 hero adds', '+725', '+87']]
              .map(([a, b, c]) => el('tr', null, el('td', null, a), el('td', null, b), el('td', null, c)))
          )
        )
      )
    );
  }

  function renderLive(data) {
    const players = data?.players || [];
    const fought = players.filter((p) => (p.raid?.raids || 0) > 0);
    const tiles = [
      ['Fighters', fought.length, 'players who have fought a Storm'],
      ['Storms fought', fmt(fought.reduce((a, p) => a + (p.raid.raids || 0), 0)), 'joins across every player'],
      ['Valor earned', fmt(fought.reduce((a, p) => a + (p.raid.valor || 0), 0)), 'lifetime, all fighters'],
      ['Knockouts', fmt(fought.reduce((a, p) => a + (p.raid.kos || 0), 0)), 'fighters dropped to 0 HP'],
      ['Heroes levelled', players.filter((p) => (p.heroLevel || 1) > 1).length, `of ${players.length} players past level 1`]
    ];
    $('#storm-stats').replaceChildren(...tiles.map(([l, v, s]) => el('div', { class: 'stat' }, el('span', { class: 'v' }, v), el('span', { class: 'l' }, l), el('span', { class: 's' }, s))));

    const root = $('#storm-top');
    const top = fought.filter((p) => (p.raid.valor || 0) > 0).sort((a, b) => (b.raid.valor - a.raid.valor) || (b.raid.wins - a.raid.wins) || (b.raid.kos - a.raid.kos)).slice(0, 10);
    if (!top.length) {
      return root.replaceChildren(el('p', { class: 'muted' }, 'No Valor earned yet. The first Storm to finish puts its fighters here.'));
    }
    root.replaceChildren(
      el('ol', { class: 'valor' }, ...top.map((p, i) => {
        const g = Guilds.guildById(p.guild);
        return el('li', null,
          el('span', { class: `rank${i < 3 ? ` m${i + 1}` : ''}` }, i + 1),
          el('span', { class: 'nm' }, el('strong', null, Guilds.nameOf(p)), g ? el('button', { class: 'gtag', style: `--h:${Guilds.tagHue(g.tag)}`, title: g.name, onclick: () => Guilds.openGuild(g.tag) }, g.tag) : null),
          heroChip(p.hero, p.heroLevel),
          el('span', { class: 'rec' }, `${p.raid.raids} Storms · ${p.raid.wins}W · ${p.raid.kos} KO`),
          el('strong', { class: 'val' }, `${fmt(p.raid.valor)} Valor`)
        );
      })),
      el('p', { class: 'muted small' }, el('a', { href: '#board/raid' }, 'Full Valor leaderboard →'))
    );
  }

  function init() {
    renderField();
    renderSteps();
    renderHeroes();
    renderLive(Guilds.getData());
    document.addEventListener('guildstone:data', (e) => renderLive(e.detail));
  }

  return { init, heroChip, HEROES };
})();
