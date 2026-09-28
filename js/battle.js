// Regimon GO — turn-based trainer battles against AI opponents.
window.RGBattle = (() => {
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // [name, power, accuracy] for attacks; [name, effect] for status moves.
  const MOVES = {
    Normal: [['Hall Pass Slam', 50, 1], ['Lunch Rush', 80, 0.9], ['Pep Talk', 'atkUp']],
    Brainy: [['Pop Quiz', 50, 1], ['Final Exam', 90, 0.85], ['Study Break', 'heal']],
    Classic: [['Latin Lash', 50, 1], ['Veni Vidi Vici', 85, 0.9], ['Declension', 'atkDown']],
    Fire: [['Ember Essay', 50, 1], ['Set the World on Fire', 95, 0.85], ['Warm Up', 'atkUp']],
    Dark: [['Detention', 50, 1], ['Shadow Slip', 80, 0.95], ['Stare Down', 'atkDown']],
    Grass: [['Leaf Toss', 50, 1], ['Tulip Storm', 85, 0.9], ['Photosynthesize', 'heal']],
    Spirit: [['Candle Flicker', 50, 1], ['Holy Hymn', 80, 0.95], ['Blessing', 'heal']],
    Electric: [['Bell Ring', 50, 1], ['Lightning Lecture', 90, 0.85], ['Charge Up', 'atkUp']],
    Ghost: [['Spook', 50, 1], ['Haunted Hallway', 80, 0.95], ['Vanish', 'defUp']],
    Water: [['Splash Quiz', 50, 1], ['Reservoir Wave', 85, 0.9], ['Hydrate', 'heal']],
    Steel: [['Locker Slam', 55, 1], ['Iron Rail', 80, 0.95], ['Armor Up', 'defUp']],
    Bug: [['Paper Cut', 45, 1], ['Homework Swarm', 75, 0.95], ['Procrastinate', 'atkDown']],
    Flying: [['Wing Flap', 50, 1], ['Pigeon Dive', 80, 0.9], ['Tailwind', 'atkUp']],
    Ancient: [['Dust Cloud', 50, 1], ['Pharaoh’s Curse', 90, 0.85], ['Fossilize', 'defUp']],
    Royal: [['Crown Toss', 60, 1], ['Royal Decree', 100, 0.85], ['Kingly Presence', 'atkDown']],
    Athletic: [['Jab', 50, 1], ['Slam Dunk', 85, 0.9], ['Hustle', 'atkUp']],
  };
  const EFFECT_LABEL = { heal: 'Heal', atkUp: 'Atk ▲', defUp: 'Def ▲', atkDown: 'Foe Atk ▼' };
  const COVERAGE = ['Dark', 'Flying', 'Steel', 'Bug', 'Electric', 'Athletic'];

  // attacker type -> [super-effective against, not very effective against]
  const CHART = {
    Fire: [['Grass', 'Bug', 'Steel', 'Brainy'], ['Water', 'Fire', 'Ancient']],
    Water: [['Fire', 'Ancient', 'Steel'], ['Water', 'Grass']],
    Grass: [['Water', 'Ancient'], ['Fire', 'Flying', 'Bug', 'Grass']],
    Electric: [['Water', 'Flying', 'Steel'], ['Grass', 'Electric', 'Ancient']],
    Brainy: [['Classic', 'Athletic', 'Royal'], ['Dark', 'Brainy']],
    Classic: [['Ancient', 'Normal'], ['Brainy', 'Steel']],
    Dark: [['Spirit', 'Ghost', 'Brainy'], ['Dark', 'Athletic']],
    Spirit: [['Dark', 'Ghost'], ['Steel', 'Royal']],
    Ghost: [['Ghost', 'Brainy'], ['Dark', 'Normal']],
    Normal: [[], ['Steel', 'Ancient', 'Ghost']],
    Steel: [['Ancient', 'Classic', 'Athletic'], ['Fire', 'Water', 'Steel']],
    Bug: [['Grass', 'Brainy', 'Dark'], ['Fire', 'Flying', 'Steel']],
    Flying: [['Grass', 'Bug', 'Athletic'], ['Electric', 'Steel']],
    Ancient: [['Fire', 'Flying', 'Bug'], ['Water', 'Grass', 'Steel']],
    Royal: [['Spirit', 'Classic', 'Normal', 'Athletic'], ['Royal', 'Dark']],
    Athletic: [['Normal', 'Steel', 'Dark', 'Ancient'], ['Flying', 'Brainy', 'Ghost']],
  };
  function effectiveness(type, defTypes) {
    const [sup, weak] = CHART[type] || [[], []];
    return defTypes.reduce((m, t) => m * (sup.includes(t) ? 2 : weak.includes(t) ? 0.5 : 1), 1);
  }

  const mkMove = (type, i) => {
    const [name, a, b] = MOVES[type][i];
    return typeof a === 'string' ? { name, type, power: 0, acc: 1, effect: a } : { name, type, power: a, acc: b };
  };
  function movesFor(sp) {
    const t1 = sp.types[0], t2 = sp.types[1];
    const third = t2 ? mkMove(t2, 1) : mkMove(t1 === 'Normal' ? COVERAGE[sp.id % COVERAGE.length] : 'Normal', t1 === 'Normal' ? 0 : 1);
    return [mkMove(t1, 0), mkMove(t1, 1), third, mkMove(t1, 2)];
  }

  function baseStats(sp) {
    let a = sp.id * 9301 + 49297;
    const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const w = { hp: 1 + r() * 0.6, atk: 1 + r() * 0.6, def: 1 + r() * 0.6, spd: 1 + r() * 0.6 };
    if (sp.body === 'wide') { w.def += 0.3; w.hp += 0.2; w.spd -= 0.2; }
    if (sp.body === 'tall') w.spd += 0.3;
    if (sp.body === 'ghost') w.spd += 0.2;
    const sum = w.hp + w.atk + w.def + w.spd, tot = 250 + sp.rarity * 45;
    return { hp: Math.round(tot * w.hp / sum), atk: Math.round(tot * w.atk / sum), def: Math.round(tot * w.def / sum), spd: Math.round(tot * w.spd / sum) };
  }
  const levelFromCP = cp => clamp(Math.round(cp / 22), 3, 70);

  function makeMon(sp, level, entry) {
    const b = baseStats(sp), L = level;
    const maxHp = Math.floor(2 * b.hp * L / 100) + L + 10;
    return {
      sp, level: L, entry, maxHp, hp: maxHp,
      atk: Math.floor(2 * b.atk * L / 100) + 5, def: Math.floor(2 * b.def * L / 100) + 5, spd: Math.floor(2 * b.spd * L / 100) + 5,
      moves: movesFor(sp), st: { atk: 0, def: 0 }, heals: 0,
    };
  }
  const stageMult = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

  // ---------------- engine ----------------
  let G = null;  // game hooks: { S, byId, Art, Music, TYPES, openModal, closeModal, toast }
  let B = null;  // current battle

  function init(hooks) { G = hooks; bindUI(); }

  function typeChip(t) { return `<span class="type" style="background:${G.TYPES[t]}">${t}</span>`; }

  // Step 1: choose up to three Regimon, then fight.
  function challenge(foe) {
    const S = G.S;
    if (!S.caught.length) { G.toast('Catch a Regimon first — you need a team to battle!'); return; }
    const list = [...S.caught].sort((a, b) => b.cp - a.cp).slice(0, 60);
    let picked = list.slice(0, 3).map(c => c.uid);
    const preview = foe.team.map(id => `<img src="${G.Art.url(G.byId[id])}" alt="${G.byId[id].name}" title="${G.byId[id].name}">`).join('');
    const render = () => {
      G.openModal(`<div class="challenge" style="--arena:${foe.color}">
        <div class="ch-head">
          <div class="ch-badge">${foe.icon}</div>
          <div><h2>${foe.name}</h2><p class="sub">${foe.title}${foe.badge ? ' · 🏅 Badge earned' : ''}</p></div>
        </div>
        <p class="ch-quote">“${foe.quote}”</p>
        <div class="ch-team">${preview}</div>
        <h3>Pick your team <span class="sub">(${picked.length}/3)</span></h3>
        <div class="grid pick">${list.map(c => {
          const sp = G.byId[c.sid], i = picked.indexOf(c.uid);
          return `<button class="card ${i >= 0 ? 'on' : ''}" data-uid="${c.uid}">
            ${i >= 0 ? `<span class="order">${i + 1}</span>` : ''}
            <span class="cp">Lv ${levelFromCP(c.cp)} · CP ${c.cp}</span>
            <img src="${G.Art.url(sp)}" alt=""><span class="nm">${sp.name}</span></button>`;
        }).join('')}</div>
        <div class="row sticky"><button class="primary" id="ch-go" ${picked.length ? '' : 'disabled'}>⚔️ Battle!</button></div>
      </div>`);
      document.querySelectorAll('#modal-body .pick .card').forEach(el => {
        el.onclick = () => {
          const keep = $('#modal .sheet').scrollTop;
          const uid = +el.dataset.uid, i = picked.indexOf(uid);
          if (i >= 0) picked.splice(i, 1); else if (picked.length < 3) picked.push(uid); else { picked.shift(); picked.push(uid); }
          render(); $('#modal .sheet').scrollTop = keep;
        };
      });
      $('#ch-go').onclick = () => {
        const team = picked.map(uid => S.caught.find(c => c.uid === uid)).filter(Boolean);
        G.closeModal();
        start(foe, team);
      };
    };
    render();
  }

  function start(foe, entries) {
    const myTeam = entries.map(c => makeMon(G.byId[c.sid], levelFromCP(c.cp), c));
    const avg = myTeam.reduce((s, m) => s + m.level, 0) / myTeam.length;
    const foeLevel = i => Math.max(4, Math.round(avg * foe.levelMult) + foe.levelAdd + i);
    const foeTeam = foe.team.map((id, i) => makeMon(G.byId[id], foeLevel(i), null));
    B = { foe, myTeam, foeTeam, me: myTeam[0], them: foeTeam[0], resolve: null, used: new Set([myTeam[0]]) };
    const el = $('#battle');
    el.style.setProperty('--arena', foe.color);
    el.classList.remove('hidden');
    $('#b-trainer').innerHTML = `<span>${foe.icon}</span> ${foe.name}`;
    G.onOpen && G.onOpen();
    G.Music.play('fight');
    renderAll();
    loop().catch(err => { console.error(err); end(false); });
  }

  // ---------------- rendering ----------------
  function renderSide(mon, pre, team) {
    $(`#${pre}-name`).textContent = mon.sp.name;
    $(`#${pre}-lv`).textContent = `Lv ${mon.level}`;
    $(`#${pre}-types`).innerHTML = mon.sp.types.map(typeChip).join('');
    const img = $(`#${pre}-img`);
    img.src = G.Art.url(mon.sp);
    img.className = `b-mon ${pre === 'bm' ? 'mine' : ''} enter`;
    renderDots(pre, team);
    renderHP(pre, mon);
  }
  function renderDots(pre, team) {
    $(`#${pre}-team`).innerHTML = team.map(m => `<i class="${m.hp > 0 ? 'alive' : ''}"></i>`).join('');
  }
  function renderHP(pre, mon) {
    const pct = mon.hp / mon.maxHp * 100, bar = $(`#${pre}-hp`);
    bar.style.width = pct + '%';
    bar.className = pct > 50 ? 'ok' : pct > 20 ? 'mid' : 'low';
    if (pre === 'bm') $('#bm-hpnum').textContent = `${mon.hp} / ${mon.maxHp}`;
  }
  function renderAll() { renderSide(B.them, 'bf', B.foeTeam); renderSide(B.me, 'bm', B.myTeam); }

  function say(text, ms = 950) { $('#b-msg').textContent = text; return sleep(ms); }

  function renderMoves(active) {
    const box = $('#b-moves');
    box.innerHTML = B.me.moves.map((m, i) => {
      const eff = m.power ? effectiveness(m.type, B.them.sp.types) : 1;
      const hint = !m.power ? EFFECT_LABEL[m.effect] : eff > 1 ? 'Super effective' : eff < 1 ? 'Not very effective' : `Power ${m.power}`;
      return `<button class="move" data-i="${i}" style="--mt:${G.TYPES[m.type]}" ${active ? '' : 'disabled'}>
        <b>${m.name}</b><small><span class="dot"></span>${m.type} · ${hint}</small></button>`;
    }).join('');
    box.querySelectorAll('.move').forEach(b => { b.onclick = () => choose({ kind: 'move', i: +b.dataset.i }); });
    $('#b-switch').disabled = !active || B.myTeam.filter(m => m.hp > 0).length < 2;
    $('#b-run').disabled = !active;
  }
  function renderSwitch(forced) {
    const box = $('#b-moves');
    box.innerHTML = B.myTeam.map((m, i) => `<button class="move sw" data-i="${i}" ${m.hp <= 0 || m === B.me ? 'disabled' : ''}>
        <img src="${G.Art.url(m.sp)}" alt=""><span><b>${m.sp.name}</b><small>Lv ${m.level} · ${m.hp}/${m.maxHp} HP${m.hp <= 0 ? ' · fainted' : ''}</small></span></button>`).join('') +
      (forced ? '' : `<button class="move back" id="sw-back"><b>← Back</b></button>`);
    box.querySelectorAll('.sw').forEach(b => { b.onclick = () => choose({ kind: 'switch', i: +b.dataset.i }); });
    if (!forced) $('#sw-back').onclick = () => renderMoves(true);
    $('#b-switch').disabled = true;
    $('#b-run').disabled = forced;
  }
  function choose(c) {
    if (!B || !B.resolve) return;
    const r = B.resolve; B.resolve = null;
    renderMoves(false);
    r(c);
  }
  const waitChoice = () => new Promise(res => { B.resolve = res; renderMoves(true); $('#b-msg').textContent = `What will ${B.me.sp.name} do?`; });
  const waitSwitch = () => new Promise(res => { B.resolve = res; renderSwitch(true); $('#b-msg').textContent = 'Choose your next Regimon.'; });

  function bindUI() {
    $('#b-switch').onclick = () => { if (B && B.resolve) renderSwitch(false); };
    $('#b-run').onclick = () => choose({ kind: 'run' });
    addEventListener('keydown', e => {
      if (!B || !B.resolve || !/^[1-4]$/.test(e.key)) return;
      const btn = document.querySelector(`#b-moves .move[data-i="${+e.key - 1}"]:not(:disabled)`);
      if (btn) btn.click();
    });
  }

  function anim(pre, cls, ms) {
    const img = $(`#${pre}-img`);
    img.classList.remove('enter', 'lunge', 'hurt', 'faint', 'glow');
    void img.offsetWidth;
    img.classList.add(cls);
    return sleep(ms);
  }
  function floatText(pre, text, cls) {
    const host = $(pre === 'bm' ? '.b-me' : '.b-foe');
    const s = document.createElement('span');
    s.className = `b-float ${cls || ''}`; s.textContent = text;
    host.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }

  // ---------------- turn logic ----------------
  const label = (mon, isFoe) => (isFoe ? `The foe’s ${mon.sp.name}` : mon.sp.name);

  function aiPick(a, d, smart) {
    const scored = a.moves.map(m => {
      let s;
      if (m.effect === 'heal') s = a.hp / a.maxHp < 0.4 && a.heals < 2 ? 160 : -1;
      else if (m.effect === 'atkUp') s = a.st.atk < 2 ? 38 : -1;
      else if (m.effect === 'defUp') s = a.st.def < 2 ? 34 : -1;
      else if (m.effect === 'atkDown') s = d.st.atk > -2 ? 34 : -1;
      else s = m.power * m.acc * effectiveness(m.type, d.sp.types) * (a.sp.types.includes(m.type) ? 1.25 : 1);
      return { m, s: s * (0.8 + Math.random() * 0.4) };
    }).sort((x, y) => y.s - x.s);
    if (Math.random() > smart) return a.moves[Math.floor(Math.random() * a.moves.length)];
    return scored[0].m;
  }

  async function useMove(a, d, m, isFoe) {
    const ap = isFoe ? 'bf' : 'bm', dp = isFoe ? 'bm' : 'bf';
    await say(`${label(a, isFoe)} used ${m.name}!`, 600);
    await anim(ap, 'lunge', 320);

    if (m.effect === 'heal') {
      if (a.heals >= 2) { await say('But it’s too tired to heal again!'); return; }
      a.heals++;
      const amt = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * 0.4));
      a.hp += amt; renderHP(ap, a);
      G.Music.sfx('heal'); anim(ap, 'glow', 600); floatText(ap, `+${amt}`, 'heal');
      await say(`${label(a, isFoe)} recovered ${amt} HP!`);
      return;
    }
    if (m.effect === 'atkUp' || m.effect === 'defUp') {
      const k = m.effect === 'atkUp' ? 'atk' : 'def';
      if (a.st[k] >= 3) { await say(`${label(a, isFoe)}’s ${k === 'atk' ? 'attack' : 'defense'} won’t go any higher!`); return; }
      a.st[k]++; G.Music.sfx('buff'); anim(ap, 'glow', 600);
      await say(`${label(a, isFoe)}’s ${k === 'atk' ? 'attack' : 'defense'} rose!`);
      return;
    }
    if (m.effect === 'atkDown') {
      if (d.st.atk <= -3) { await say(`${label(d, !isFoe)}’s attack won’t go any lower!`); return; }
      d.st.atk--; G.Music.sfx('debuff'); anim(dp, 'hurt', 450);
      await say(`${label(d, !isFoe)}’s attack fell!`);
      return;
    }

    if (Math.random() > m.acc) { G.Music.sfx('miss'); floatText(dp, 'Miss', 'miss'); await say(`${label(a, isFoe)}’s attack missed!`); return; }
    const eff = effectiveness(m.type, d.sp.types);
    const crit = Math.random() < 0.0625;
    const stab = a.sp.types.includes(m.type) ? 1.25 : 1;
    const atk = a.atk * stageMult(a.st.atk), def = d.def * stageMult(d.st.def);
    const base = ((2 * a.level / 5 + 2) * m.power * atk / def) / 50 + 2;
    const dmg = Math.max(1, Math.round(base * stab * eff * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15)));
    d.hp = Math.max(0, d.hp - dmg);
    G.Music.sfx(eff > 1 ? 'superhit' : eff < 1 ? 'weakhit' : 'hit');
    anim(dp, 'hurt', 450); floatText(dp, `-${dmg}`, eff > 1 ? 'super' : '');
    renderHP(dp, d);
    await sleep(500);
    if (crit) await say('A critical hit!', 750);
    if (eff > 1) await say('It’s super effective!', 850);
    else if (eff < 1) await say('It’s not very effective…', 850);
  }

  async function loop() {
    const f = B.foe;
    await say(`${f.name} wants to battle!`, 1100);
    await say(`${f.name} sent out ${B.them.sp.name}!`, 900);
    await say(`Go, ${B.me.sp.name}!`, 800);
    for (;;) {
      const c = await waitChoice();
      if (c.kind === 'run') { await say('You forfeited the battle.', 1000); return end(false, true); }
      const foeMove = aiPick(B.them, B.me, f.smart);
      if (c.kind === 'switch') {
        await say(`Come back, ${B.me.sp.name}!`, 650);
        B.me.st = { atk: 0, def: 0 };
        B.me = B.myTeam[c.i]; B.used.add(B.me);
        renderSide(B.me, 'bm', B.myTeam);
        await say(`Go, ${B.me.sp.name}!`, 700);
        await useMove(B.them, B.me, foeMove, true);
      } else {
        const mine = B.me.moves[c.i];
        const sMe = B.me.spd, sThem = B.them.spd;
        const meFirst = sMe > sThem || (sMe === sThem && Math.random() < 0.5);
        const turns = meFirst ? [[B.me, B.them, mine, false], [B.them, B.me, foeMove, true]] : [[B.them, B.me, foeMove, true], [B.me, B.them, mine, false]];
        for (const [a, d, m, isFoe] of turns) {
          await useMove(a, d, m, isFoe);
          if (d.hp <= 0) break;
        }
      }
      if (B.them.hp <= 0) {
        G.Music.sfx('faint');
        await anim('bf', 'faint', 600);
        await say(`The foe’s ${B.them.sp.name} fainted!`, 900);
        renderDots('bf', B.foeTeam);
        const next = B.foeTeam.find(m => m.hp > 0);
        if (!next) return end(true);
        B.them = next;
        renderSide(B.them, 'bf', B.foeTeam);
        await say(`${f.name} sent out ${next.sp.name}!`, 900);
      }
      if (B.me.hp <= 0) {
        G.Music.sfx('faint');
        await anim('bm', 'faint', 600);
        await say(`${B.me.sp.name} fainted!`, 900);
        renderDots('bm', B.myTeam);
        if (!B.myTeam.some(m => m.hp > 0)) return end(false);
        const c2 = await waitSwitch();
        B.me = B.myTeam[c2.i]; B.used.add(B.me);
        renderSide(B.me, 'bm', B.myTeam);
        await say(`Go, ${B.me.sp.name}!`, 700);
      }
    }
  }

  function end(win, forfeit) {
    const b = B;
    G.Music.sfx(win ? 'victory' : 'defeat');
    // Every Regimon that fought gets a little stronger — more if you won.
    const boosts = [];
    for (const m of b.used) {
      if (!m.entry) continue;
      const gain = forfeit ? 0 : Math.round((win ? 10 : 4) + b.foe.tier * (win ? 4 : 1));
      if (gain) { m.entry.cp += gain; boosts.push(`${m.sp.name} +${gain} CP`); }
    }
    const rewards = b.foe.onResult ? b.foe.onResult(win) : [];
    $('#b-msg').textContent = win ? `You defeated ${b.foe.name}!` : forfeit ? 'You left the battle.' : `You were defeated by ${b.foe.name}.`;
    setTimeout(() => {
      G.openModal(`<div class="result">
        <div class="bigemoji">${win ? '🏆' : '💤'}</div>
        <h2>${win ? 'Victory!' : forfeit ? 'Battle over' : 'Defeated…'}</h2>
        <p class="sub">${win ? `You beat ${b.foe.name}.` : forfeit ? 'No rewards this time.' : `${b.foe.name}: “${b.foe.winQuote || 'Good battle! Train up and come back.'}”`}</p>
        ${rewards.length ? `<div class="xpgain">${rewards.join('<br>')}</div>` : ''}
        ${boosts.length ? `<p class="sub">💪 Your team got stronger: ${boosts.join(', ')}</p>` : ''}
        <button class="primary" id="b-done">Continue</button>
      </div>`, () => {
        $('#battle').classList.add('hidden');
        B = null;
        G.onClose && G.onClose(win);
      });
      $('#b-done').onclick = () => G.closeModal();
    }, 900);
  }

  return { init, challenge, levelFromCP, isActive: () => !!B };
})();
