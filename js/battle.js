// Regimon GO — real-time trainer battles (fast attacks build energy, charged attacks spend it, shields block).
window.RGBattle = (() => {
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TURN = 0.5;          // seconds per fast-move turn
  const MAX_ENERGY = 100;
  const SWITCH_COOLDOWN = 30;

  // Fast moves: [name, power, energy gained, turns]
  const FAST = {
    Normal: ['Hall Pass Jab', 5, 7, 2], Brainy: ['Pop Quiz', 4, 8, 2], Classic: ['Latin Lash', 6, 6, 2],
    Fire: ['Ember Essay', 6, 6, 2], Dark: ['Detention Slip', 3, 5, 1], Grass: ['Leaf Toss', 5, 7, 2],
    Spirit: ['Candle Flicker', 4, 8, 2], Electric: ['Bell Ring', 3, 5, 1], Ghost: ['Spook', 9, 9, 3],
    Water: ['Splash', 5, 7, 2], Steel: ['Locker Slam', 7, 6, 2], Bug: ['Paper Cut', 3, 5, 1],
    Flying: ['Wing Gust', 6, 7, 2], Ancient: ['Dust Cloud', 10, 8, 3], Royal: ['Crown Toss', 7, 6, 2],
    Athletic: ['Jab', 3, 4, 1], Dragon: ['Dragon Breath', 4, 3, 1], Ice: ['Frost Bite', 5, 7, 2],
  };
  // Charged moves: [name, power, energy cost, effect?]
  const CHARGED = {
    Normal: [['Lunch Rush', 65, 40], ['Senior Stampede', 100, 60, 'atkUp']],
    Brainy: [['Final Exam', 70, 40, 'defDown'], ['Thesis Defense', 110, 65]],
    Classic: [['Declension', 55, 35, 'defDown'], ['Veni Vidi Vici', 100, 60]],
    Fire: [['Flame Essay', 70, 40, 'burn'], ['Inferno Essay', 115, 65, 'burn']],
    Dark: [['Shadow Slip', 60, 35], ['Stare Down', 90, 55, 'defDown']],
    Grass: [['Tulip Storm', 70, 40], ['Photosynthesis Beam', 110, 65, 'drain']],
    Spirit: [['Holy Hymn', 70, 45, 'drain'], ['Benediction', 100, 60, 'atkUp']],
    Electric: [['Lightning Lecture', 75, 45, 'stun'], ['Thunder Bell', 110, 65, 'stun']],
    Ghost: [['Haunted Hallway', 70, 40], ['Poltergeist', 105, 60, 'defDown']],
    Water: [['Reservoir Wave', 70, 40], ['Hydro Cannon', 110, 65]],
    Steel: [['Iron Rail', 70, 45, 'atkUp'], ['Steel Beam', 120, 70]],
    Bug: [['Homework Swarm', 60, 35], ['Deadline Sting', 95, 55, 'burn']],
    Flying: [['Pigeon Dive', 70, 40], ['Hurricane', 105, 60]],
    Ancient: [['Pharaoh’s Curse', 80, 50, 'burn'], ['Meteor Fall', 120, 70]],
    Royal: [['Royal Decree', 85, 50, 'defDown'], ['Coronation', 115, 65, 'atkUp']],
    Athletic: [['Slam Dunk', 75, 45], ['Championship Combo', 105, 60, 'atkUp']],
    Dragon: [['Dragon Claw', 65, 35], ['Outrage', 120, 70]],
    Ice: [['Icicle Spear', 70, 40, 'stun'], ['Blizzard', 115, 65]],
  };
  const EFFECT_TEXT = { atkUp: 'Attack ▲', defDown: 'Foe Def ▼', burn: 'Burns', stun: 'Stuns', drain: 'Drains HP' };

  // attacker type -> [super effective against, not very effective against]
  const CHART = {
    Fire: [['Grass', 'Bug', 'Steel', 'Brainy', 'Ice'], ['Water', 'Fire', 'Ancient', 'Dragon']],
    Water: [['Fire', 'Ancient', 'Steel'], ['Water', 'Grass', 'Dragon']],
    Grass: [['Water', 'Ancient'], ['Fire', 'Flying', 'Bug', 'Grass', 'Dragon']],
    Electric: [['Water', 'Flying', 'Steel'], ['Grass', 'Electric', 'Ancient', 'Dragon']],
    Brainy: [['Classic', 'Athletic', 'Royal'], ['Dark', 'Brainy']],
    Classic: [['Ancient', 'Normal'], ['Brainy', 'Steel']],
    Dark: [['Spirit', 'Ghost', 'Brainy'], ['Dark', 'Athletic']],
    Spirit: [['Dark', 'Ghost'], ['Steel', 'Royal']],
    Ghost: [['Ghost', 'Brainy'], ['Dark', 'Normal']],
    Normal: [[], ['Steel', 'Ancient', 'Ghost']],
    Steel: [['Ancient', 'Classic', 'Athletic', 'Ice'], ['Fire', 'Water', 'Steel']],
    Bug: [['Grass', 'Brainy', 'Dark'], ['Fire', 'Flying', 'Steel']],
    Flying: [['Grass', 'Bug', 'Athletic'], ['Electric', 'Steel']],
    Ancient: [['Fire', 'Flying', 'Bug', 'Ice'], ['Water', 'Grass', 'Steel']],
    Royal: [['Spirit', 'Classic', 'Normal', 'Athletic', 'Dragon'], ['Royal', 'Dark']],
    Athletic: [['Normal', 'Steel', 'Dark', 'Ancient', 'Ice'], ['Flying', 'Brainy', 'Ghost']],
    Dragon: [['Dragon'], ['Steel', 'Royal']],
    Ice: [['Dragon', 'Grass', 'Flying', 'Ancient'], ['Fire', 'Water', 'Steel', 'Ice']],
  };
  function effectiveness(type, defTypes) {
    const [sup, weak] = CHART[type] || [[], []];
    return defTypes.reduce((m, t) => m * (sup.includes(t) ? 1.6 : weak.includes(t) ? 0.625 : 1), 1);
  }

  const mkFast = t => { const [name, power, energy, turns] = FAST[t]; return { name, type: t, power, energy, turns }; };
  const mkCharged = (t, i) => { const [name, power, cost, effect] = CHARGED[t][i]; return { name, type: t, power, cost, effect }; };
  function movesFor(sp) {
    if (sp.moves) {   // species with their own move set
      const [fn, ft, fp, fe, fturns] = sp.moves.fast;
      return { fast: { name: fn, type: ft, power: fp, energy: fe, turns: fturns }, charged: sp.moves.charged.map(([name, type, power, cost, effect], i) => ({ name, type, power, cost, effect, sig: i === sp.moves.charged.length - 1 })) };
    }
    const t1 = sp.types[0], t2 = sp.types[1];
    const c1 = mkCharged(t1, 0);
    let c2 = t2 ? mkCharged(t2, 1) : mkCharged(t1, 1);
    if (sp.sig) { const [name, type, power, cost, effect] = sp.sig; c2 = { name, type, power, cost, effect, sig: true }; }
    return { fast: mkFast(t1), charged: [c1, c2] };
  }

  function baseStats(sp) {
    let a = sp.id * 9301 + 49297;
    const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const w = { hp: 1 + r() * 0.6, atk: 1 + r() * 0.6, def: 1 + r() * 0.6 };
    if (sp.body === 'wide') { w.def += 0.3; w.hp += 0.2; }
    if (sp.body === 'tall') w.atk += 0.2;
    const sum = w.hp + w.atk + w.def, tot = 200 + sp.rarity * 38 + (sp.eyes === 'fierce' ? 20 : 0);
    return { hp: tot * w.hp / sum, atk: tot * w.atk / sum, def: tot * w.def / sum };
  }
  const levelFromCP = cp => clamp(Math.round(cp / 22), 3, 80);

  function makeMon(sp, level, entry) {
    const b = baseStats(sp), L = level;
    const maxHp = Math.floor(2.4 * b.hp * L / 100) + L + 20;
    const mv = movesFor(sp);
    return {
      sp, level: L, entry, maxHp, hp: maxHp,
      atk: 2 * b.atk * L / 100 + 5, def: 2 * b.def * L / 100 + 5,
      energy: 0, st: { atk: 0, def: 0 }, burn: 0, burnAcc: 0, stun: 0,
      fast: mv.fast, charged: mv.charged, shiny: !!(entry && entry.shiny),
    };
  }
  const stage = s => (s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s));
  function calcDamage(a, d, move, mult = 1) {
    const stab = a.sp.types.includes(move.type) ? 1.2 : 1;
    const eff = effectiveness(move.type, d.sp.types);
    return { dmg: Math.floor(0.5 * move.power * (a.atk * stage(a.st.atk)) / (d.def * stage(d.st.def)) * stab * eff * mult) + 1, eff };
  }

  // ======================= visual effects =======================
  const fx = { parts: [], effs: [], cv: null, ctx: null, w: 0, h: 0 };
  function fxResize() {
    const el = $('#battle'), r = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    fx.w = r.width; fx.h = r.height;
    fx.cv.width = r.width * dpr; fx.cv.height = r.height * dpr;
    fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function centerOf(sel) {
    const b = $('#battle').getBoundingClientRect(), r = $(sel).getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height * 0.55, r: r.width / 2 };
  }
  const pickc = a => a[Math.floor(Math.random() * a.length)];
  function emit(p) { fx.parts.push(Object.assign({ age: 0, life: 0.6, size: 6, grav: 0, drag: 0, rot: Math.random() * 6, vr: 0, glow: false, shape: 'circle' }, p)); }
  function eff(dur, draw, update) { fx.effs.push({ t: 0, dur, draw, update }); }
  function burst(at, o) {
    for (let i = 0; i < o.n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(o.speed * 0.3, o.speed);
      emit({ x: at.x + rnd(-8, 8), y: at.y + rnd(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v + (o.up || 0), life: rnd(o.life * 0.6, o.life),
        size: rnd(o.size[0], o.size[1]), color: pickc(o.colors), shape: o.shape || 'circle', glow: o.glow, grav: o.grav || 0, drag: o.drag ?? 2, text: o.text && pickc(o.text), vr: rnd(-6, 6) });
    }
  }
  // Fires particles from a to b over `dur` seconds; each travels for `travel` seconds.
  function stream(a, b, o) {
    let acc = 0;
    eff(o.dur, null, (k, dt) => {
      acc += o.rate * dt;
      while (acc >= 1) {
        acc--;
        const tr = o.travel * rnd(0.85, 1.15), sp = o.spread || 12;
        const tx = b.x + rnd(-sp, sp), ty = b.y + rnd(-sp, sp);
        const wob = o.wave ? rnd(-1, 1) * o.wave : 0;
        emit({ x: a.x + rnd(-6, 6), y: a.y + rnd(-6, 6), vx: (tx - a.x) / tr, vy: (ty - a.y) / tr - (o.arc || 0) + wob, grav: (o.arc || 0) * 2 / tr,
          life: tr, size: rnd(o.size[0], o.size[1]), color: pickc(o.colors), shape: o.shape || 'circle', glow: o.glow, drag: 0,
          text: o.text && pickc(o.text), vr: rnd(-8, 8), sway: o.sway || 0, phase: Math.random() * 6 });
      }
    });
  }
  function ring(at, color, maxR, dur, width = 5) {
    eff(dur, (c, k) => {
      c.globalAlpha = 1 - k; c.strokeStyle = color; c.lineWidth = width * (1 - k) + 1;
      c.beginPath(); c.arc(at.x, at.y, 10 + maxR * k, 0, 7); c.stroke(); c.globalAlpha = 1;
    });
  }
  function flash(color, dur, alpha = 0.55) {
    eff(dur, (c, k) => { c.globalAlpha = alpha * (1 - k); c.fillStyle = color; c.fillRect(0, 0, fx.w, fx.h); c.globalAlpha = 1; });
  }
  function bolt(c, a, b, jag) {
    const n = 9; c.beginPath(); c.moveTo(a.x, a.y);
    for (let i = 1; i < n; i++) {
      const k = i / n, nx = -(b.y - a.y), ny = b.x - a.x, len = Math.hypot(nx, ny) || 1;
      const off = rnd(-jag, jag);
      c.lineTo(a.x + (b.x - a.x) * k + nx / len * off, a.y + (b.y - a.y) * k + ny / len * off);
    }
    c.lineTo(b.x, b.y); c.stroke();
  }
  function beam(a, b, colors, dur, width) {
    eff(dur, (c, k) => {
      const w = width * Math.sin(Math.PI * Math.min(1, k * 1.3)) * rnd(0.85, 1.1);
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      c.strokeStyle = colors[0]; c.lineWidth = w * 1.8; c.globalAlpha = 0.35; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = colors[1]; c.lineWidth = w; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    });
  }
  function slashes(at, color, n, dur) {
    const lines = Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * 16, a: rnd(-0.3, 0.3) }));
    eff(dur, (c, k) => {
      const p = Math.min(1, k * 3);
      c.globalAlpha = 1 - Math.max(0, (k - 0.4) / 0.6); c.strokeStyle = color; c.lineWidth = 4; c.lineCap = 'round';
      for (const l of lines) {
        const x0 = at.x + l.dx - 34, y0 = at.y - 40, x1 = at.x + l.dx + 34, y1 = at.y + 40;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p); c.stroke();
      }
      c.globalAlpha = 1;
    });
  }
  function shake(big) {
    const f = $('#battle');
    f.classList.remove('shake', 'shake-big'); void f.offsetWidth;
    f.classList.add(big ? 'shake-big' : 'shake');
  }

  // Per-type attack animations. Returns seconds until impact.
  function typeFx(type, a, b, big) {
    const k = big ? 1 : 0.35, T = big ? 0.45 : 0.25;
    switch (type) {
      case 'Fire':
        stream(a, b, { dur: big ? 0.55 : 0.18, rate: big ? 110 : 60, travel: T, colors: ['#ff6b00', '#ffb703', '#ffd166', '#e63946'], size: [6, 15], glow: true, spread: 16 });
        setTimeout(() => { burst(b, { n: 40 * k, speed: 260, life: 0.7, size: [6, 16], colors: ['#ff6b00', '#ffb703', '#fff1a8'], glow: true, up: -80, grav: -150 }); if (big) { flash('#ff7b00', 0.35); ring(b, '#ffb703', 120, 0.5, 8); } }, T * 1000);
        break;
      case 'Water':
        stream(a, b, { dur: big ? 0.5 : 0.18, rate: big ? 120 : 60, travel: T, colors: ['#3b82f6', '#60a5fa', '#bfdbfe', '#ffffff'], size: [5, 12], glow: true, arc: big ? 160 : 60, spread: 20 });
        setTimeout(() => { burst(b, { n: 50 * k, speed: 280, life: 0.8, size: [3, 8], colors: ['#93c5fd', '#e0f2fe', '#3b82f6'], grav: 700, up: -220 }); if (big) ring(b, '#93c5fd', 110, 0.6, 7); }, T * 1000);
        break;
      case 'Electric':
        eff(big ? 0.55 : 0.2, (c) => {
          c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#fde047'; c.shadowColor = '#fde047'; c.shadowBlur = 16; c.lineWidth = big ? 4 : 2.5;
          for (let i = 0; i < (big ? 3 : 1); i++) bolt(c, a, { x: b.x + rnd(-15, 15), y: b.y + rnd(-15, 15) }, big ? 34 : 20);
          c.shadowBlur = 0; c.globalCompositeOperation = 'source-over';
        });
        setTimeout(() => { burst(b, { n: 30 * k, speed: 380, life: 0.4, size: [2, 4], colors: ['#fde047', '#ffffff'], shape: 'spark', glow: true }); if (big) flash('#ffffff', 0.25, 0.7); }, 60);
        return big ? 0.3 : 0.1;
      case 'Grass':
        stream(a, b, { dur: big ? 0.6 : 0.2, rate: big ? 70 : 40, travel: T * 1.2, colors: ['#22c55e', '#86efac', '#15803d', '#fda4af'], size: [7, 12], shape: 'leaf', sway: 90, spread: 30 });
        setTimeout(() => burst(b, { n: 30 * k, speed: 220, life: 0.8, size: [6, 11], colors: ['#22c55e', '#86efac', '#f472b6'], shape: 'leaf', grav: 120 }), T * 1200);
        return T * 1.2;
      case 'Ghost':
      case 'Dark': {
        const cols = type === 'Ghost' ? ['#a78bfa', '#7c3aed', '#c4b5fd'] : ['#1f2937', '#7f1d1d', '#4b5563'];
        stream(a, b, { dur: big ? 0.5 : 0.18, rate: big ? 50 : 30, travel: T * 1.2, colors: cols, size: [14, 26], shape: 'smoke', sway: 70, spread: 18 });
        setTimeout(() => {
          if (type === 'Dark') slashes(b, '#ef4444', big ? 3 : 1, 0.5);
          burst(b, { n: 20 * k, speed: 160, life: 0.9, size: [14, 28], colors: cols, shape: 'smoke' });
          if (big) flash(type === 'Ghost' ? '#2e1065' : '#000000', 0.5, 0.45);
        }, T * 1200);
        return T * 1.2;
      }
      case 'Spirit':
      case 'Royal': {
        const gold = type === 'Royal' ? ['#fbbf24', '#fde68a', '#fef3c7'] : ['#fef9c3', '#fde68a', '#ffffff'];
        eff(big ? 0.8 : 0.35, (c, t) => {
          c.globalCompositeOperation = 'lighter';
          const w = (big ? 70 : 34) * Math.sin(Math.PI * t);
          const g = c.createLinearGradient(0, 0, 0, b.y);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, gold[0]);
          c.fillStyle = g; c.globalAlpha = 0.8; c.fillRect(b.x - w / 2, 0, w, b.y + 30);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        });
        setTimeout(() => { burst(b, { n: 40 * k, speed: 240, life: 0.9, size: [3, 7], colors: gold, shape: 'star', glow: true, drag: 3 }); if (big) { ring(b, gold[0], 140, 0.7, 6); flash('#fff7d6', 0.3); } }, 200);
        return 0.25;
      }
      case 'Steel':
        slashes(b, '#e5e7eb', big ? 3 : 1, 0.45);
        setTimeout(() => burst(b, { n: 30 * k, speed: 420, life: 0.45, size: [2, 4], colors: ['#f8fafc', '#fbbf24', '#cbd5e1'], shape: 'spark', glow: true }), 90);
        if (big) setTimeout(() => ring(b, '#cbd5e1', 120, 0.5, 8), 100);
        return 0.12;
      case 'Brainy':
      case 'Classic': {
        const glyphs = type === 'Brainy' ? ['∑', 'π', '√', 'A+', '∞', '?', 'x²', 'Δ'] : ['Ω', 'Σ', 'Λ', 'IV', 'XII', 'Φ', 'ψ'];
        const cols = type === 'Brainy' ? ['#c4b5fd', '#a78bfa', '#ffffff'] : ['#fcd34d', '#fbbf24', '#fff7ed'];
        stream(a, b, { dur: big ? 0.6 : 0.2, rate: big ? 40 : 20, travel: T * 1.2, colors: cols, size: [18, 30], shape: 'text', text: glyphs, glow: true, spread: 22 });
        setTimeout(() => { burst(b, { n: 16 * k, speed: 200, life: 0.7, size: [14, 24], colors: cols, shape: 'text', text: glyphs, glow: true }); if (big) ring(b, cols[0], 120, 0.6, 6); }, T * 1200);
        return T * 1.2;
      }
      case 'Flying':
        stream(a, b, { dur: big ? 0.5 : 0.2, rate: big ? 80 : 40, travel: T, colors: ['rgba(255,255,255,.9)', '#e0f2fe'], size: [20, 40], shape: 'streak', spread: 30 });
        setTimeout(() => burst(b, { n: 18 * k, speed: 200, life: 0.9, size: [6, 10], colors: ['#f8fafc', '#cbd5e1'], shape: 'leaf', grav: 60 }), T * 1000);
        break;
      case 'Bug':
        stream(a, b, { dur: big ? 0.6 : 0.2, rate: big ? 120 : 60, travel: T * 1.3, colors: ['#365314', '#4d7c0f', '#a3e635'], size: [2, 4], sway: 120, spread: 26 });
        setTimeout(() => burst(b, { n: 30 * k, speed: 160, life: 0.6, size: [2, 4], colors: ['#365314', '#a3e635'] }), T * 1300);
        return T * 1.3;
      case 'Ancient':
        for (let i = 0; i < (big ? 9 : 3); i++) {
          const x = b.x + rnd(-60, 60);
          emit({ x, y: -20 - i * 30, vx: rnd(-20, 20), vy: 700, life: (b.y + 20 + i * 30) / 700, size: rnd(12, 24), color: pickc(['#78716c', '#a8a29e', '#57534e']), shape: 'rock', vr: rnd(-4, 4), drag: 0 });
        }
        setTimeout(() => { burst(b, { n: 30 * k, speed: 220, life: 0.9, size: [10, 22], colors: ['#d6d3d1', '#a8a29e'], shape: 'smoke' }); if (big) ring(b, '#a8a29e', 130, 0.6, 9); }, (b.y / 700) * 1000);
        return b.y / 700;
      case 'Athletic':
      case 'Normal':
        setTimeout(() => {
          ring(b, '#ffffff', big ? 130 : 60, 0.4, big ? 9 : 5);
          burst(b, { n: 20 * k, speed: 300, life: 0.35, size: [3, 5], colors: ['#ffffff', '#fdba74'], shape: 'spark', glow: true });
          if (big) { ring(b, '#fdba74', 90, 0.5, 6); flash('#ffffff', 0.2, 0.5); }
        }, 120);
        return 0.15;
      case 'Dragon':
        ring(a, '#a78bfa', big ? 110 : 50, 0.5, 6);
        beam(a, b, ['#6366f1', '#c084fc'], big ? 0.7 : 0.25, big ? 26 : 10);
        setTimeout(() => { burst(b, { n: 40 * k, speed: 300, life: 0.7, size: [4, 10], colors: ['#818cf8', '#c084fc', '#e0e7ff'], glow: true }); if (big) flash('#4c1d95', 0.35, 0.45); }, 150);
        return 0.2;
      case 'Ice':
        stream(a, b, { dur: big ? 0.45 : 0.18, rate: big ? 70 : 40, travel: T, colors: ['#e0f2fe', '#67e8f9', '#ffffff'], size: [8, 16], shape: 'shard', glow: true, spread: 18 });
        setTimeout(() => { burst(b, { n: 36 * k, speed: 280, life: 0.8, size: [5, 12], colors: ['#e0f2fe', '#a5f3fc', '#ffffff'], shape: 'shard', glow: true, grav: 200 }); if (big) { ring(b, '#a5f3fc', 130, 0.6, 7); flash('#cffafe', 0.35, 0.5); } }, T * 1000);
        break;
      default:
        setTimeout(() => ring(b, '#fff', 60, 0.4, 5), 100);
        return 0.12;
    }
    return T;
  }

  function fxFrame(dt) {
    const c = fx.ctx;
    if (!c) return;
    c.clearRect(0, 0, fx.w, fx.h);
    for (const e of fx.effs) { e.t += dt; const k = Math.min(1, e.t / e.dur); if (e.update) e.update(k, dt); if (e.draw) e.draw(c, k); }
    fx.effs = fx.effs.filter(e => e.t < e.dur);
    for (const p of fx.parts) {
      p.age += dt;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + p.grav * dt;
      p.x += p.vx * dt + (p.sway ? Math.cos(p.age * 12 + p.phase) * p.sway * dt : 0);
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const al = Math.max(0, 1 - p.age / p.life);
      c.globalAlpha = p.shape === 'smoke' ? al * 0.55 : al;
      if (p.glow) c.globalCompositeOperation = 'lighter';
      c.fillStyle = p.color; c.strokeStyle = p.color;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      const s = p.size;
      switch (p.shape) {
        case 'leaf': c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, 7); c.fill(); break;
        case 'shard': c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.35, s * 0.6); c.lineTo(-s * 0.35, s * 0.6); c.closePath(); c.fill(); break;
        case 'rock': c.beginPath(); c.moveTo(-s, -s * 0.4); c.lineTo(-s * 0.2, -s); c.lineTo(s, -s * 0.5); c.lineTo(s * 0.7, s * 0.7); c.lineTo(-s * 0.6, s * 0.8); c.closePath(); c.fill(); break;
        case 'star': c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; c.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } c.closePath(); c.fill(); break;
        case 'text': c.font = `900 ${s}px "Trebuchet MS", serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.text, 0, 0); break;
        case 'spark': { c.restore(); c.save(); c.lineWidth = s; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); break; }
        case 'streak': { c.restore(); c.save(); c.lineWidth = 3; c.lineCap = 'round'; const n = Math.hypot(p.vx, p.vy) || 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx / n * s, p.y - p.vy / n * s); c.stroke(); break; }
        case 'smoke': { const g = c.createRadialGradient(0, 0, 0, 0, 0, s); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, s, 0, 7); c.fill(); break; }
        default: c.beginPath(); c.arc(0, 0, s * al + 1, 0, 7); c.fill();
      }
      c.restore();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    fx.parts = fx.parts.filter(p => p.age < p.life);
  }

  // ======================= engine =======================
  let G = null, B = null, raf = 0, last = 0;
  function init(hooks) { G = hooks; fx.cv = $('#b-fx'); fx.ctx = fx.cv.getContext('2d'); bindUI(); addEventListener('resize', () => { if (B) fxResize(); }); }
  const typeChip = t => `<span class="type" style="background:${G.TYPES[t]}">${t}</span>`;
  const act = side => side.team[side.i];
  const who = (si, m) => (si === 1 ? `Foe’s ${m.sp.name}` : m.sp.name);

  // ---------- team select ----------
  function challenge(foe) {
    const S = G.S;
    if (!S.caught.length) { G.toast('Catch a Regimon first — you need a team to battle!'); return; }
    const list = [...S.caught].sort((a, b) => b.cp - a.cp).slice(0, 80);
    const picked = list.slice(0, 3).map(c => c.uid);
    const preview = foe.team.map(id => `<img src="${G.Art.url(G.byId[id])}" alt="${G.byId[id].name}" title="${G.byId[id].name}">`).join('');
    const render = keep => {
      G.openModal(`<div class="challenge" style="--arena:${foe.color}">
        <div class="ch-head">
          <div class="ch-badge">${foe.icon}</div>
          <div><h2>${foe.name}</h2><p class="sub">${foe.title}${foe.badge ? ' · 🏅 Badge earned' : ''}</p></div>
        </div>
        <p class="ch-quote">“${foe.quote}”</p>
        <div class="ch-team">${preview}</div>
        <p class="sub ch-rules">⚡ Hold to fast-attack and build energy · spend energy on special attacks · 🛡️ 2 shields each · 🔁 switch every 30s</p>
        <h3>Pick your team <span class="sub">(${picked.length}/3)</span></h3>
        <div class="grid pick">${list.map(c => {
          const sp = G.byId[c.sid], i = picked.indexOf(c.uid);
          return `<button class="card ${i >= 0 ? 'on' : ''}" data-uid="${c.uid}">
            ${i >= 0 ? `<span class="order">${i + 1}</span>` : ''}
            <span class="cp">Lv ${levelFromCP(c.cp)} · CP ${c.cp}</span>
            <img src="${G.Art.url(sp, c.shiny)}" alt=""><span class="nm">${c.shiny ? '✨ ' : ''}${sp.name}</span>
            <span class="mini-types">${sp.types.map(t => `<i style="background:${G.TYPES[t]}"></i>`).join('')}</span></button>`;
        }).join('')}</div>
        <div class="row sticky"><button class="primary" id="ch-go" ${picked.length ? '' : 'disabled'}>⚔️ Battle!</button></div>
      </div>`);
      if (keep) $('#modal .sheet').scrollTop = keep;
      document.querySelectorAll('#modal-body .pick .card').forEach(el => {
        el.onclick = () => {
          const k = $('#modal .sheet').scrollTop, uid = +el.dataset.uid, i = picked.indexOf(uid);
          if (i >= 0) picked.splice(i, 1); else if (picked.length < 3) picked.push(uid); else { picked.shift(); picked.push(uid); }
          render(k);
        };
      });
      $('#ch-go').onclick = () => {
        const team = picked.map(uid => S.caught.find(c => c.uid === uid)).filter(Boolean);
        G.closeModal();
        if (foe.onPick) foe.onPick(team); else start(foe, team);
      };
    };
    render(0);
  }

  function start(foe, entries) {
    if (foe.skill == null) foe.skill = clamp(0.55 + foe.smart * 0.45, 0.5, 1);   // how well the AI times its special attacks
    const myTeam = entries.map(c => makeMon(G.byId[c.sid], levelFromCP(c.cp), c));
    const avg = myTeam.reduce((s, m) => s + m.level, 0) / myTeam.length;
    // Duels pass the other player's real levels; AI trainers scale to your team.
    const foeTeam = foe.team.map((id, i) => makeMon(G.byId[id], foe.levels ? foe.levels[i] : Math.max(4, Math.round(avg * foe.levelMult + foe.levelAdd + i)),
      foe.shinies ? { shiny: !!foe.shinies[i] } : null));
    const side = (team, ai, name) => ({ team, i: 0, shields: 2, cd: 0.4, swCd: 0, ai, name, react: 0, switches: 0, fainting: false, ready: [false, false] });
    B = { foe, sides: [side(myTeam, false, 'You'), side(foeTeam, true, foe.name)], paused: true, over: false, t: 0, holding: false, tap: false, queued: null, used: new Set([myTeam[0]]), ui: {},
      net: foe.net || null, netLast: Date.now() + 15000, netT: 0, netSeq: -1, seq: 0, rHold: false, rTap: false, rq: null, asks: {}, askN: 0, lastHold: false, hbT: 0, gBusy: false };
    const el = $('#battle');
    el.style.setProperty('--arena', foe.color);
    el.classList.remove('hidden');
    $('#b-trainer').innerHTML = `<span>${foe.icon}</span> ${foe.name}`;
    fxResize();
    G.onOpen && G.onOpen();
    G.Music.play(foe.music || 'fight');
    renderSide(0); renderSide(1);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    intro();
  }
  async function intro() {
    if (B.net && B.net.role === 'guest') { msg(`Battle with ${B.foe.name} is starting…`); return; }   // the host un-pauses the guest
    msg(`${B.foe.name} wants to battle!`);
    await sleep(1100);
    msg('Hold to attack! Special attacks light up when you have enough energy.');
    B.paused = false;
  }

  // ---------- rendering ----------
  function msg(t) { $('#b-msg').textContent = t; }
  function renderSide(si) {
    const pre = si ? 'bf' : 'bm', side = B.sides[si], m = act(side);
    $(`#${pre}-name`).textContent = m.sp.name;
    $(`#${pre}-lv`).textContent = `Lv ${m.level}`;
    $(`#${pre}-types`).innerHTML = m.sp.types.map(typeChip).join('');
    const img = $(`#${pre}-img`);
    img.src = G.Art.url(m.sp, m.shiny);
    img.className = `b-mon ${si ? '' : 'mine'} ${m.sp.rarity >= 4 || m.shiny ? 'elite' : ''} enter`;
    img.style.setProperty('--glow', m.sp.glow || G.TYPES[m.sp.types[0]]);
    if (!si) {
      m.charged.forEach((mv, i) => {
        const btn = $(`#b-c${i}`);
        btn.style.setProperty('--mt', G.TYPES[mv.type]);
        btn.querySelector('b').textContent = mv.name;
        btn.querySelector('small').textContent = `${mv.type} · ${mv.cost}⚡${mv.effect ? ' · ' + EFFECT_TEXT[mv.effect] : ''}${mv.sig ? ' · ★' : ''}`;
        btn.classList.toggle('sig', !!mv.sig);
      });
      $('#b-fast small').textContent = m.fast.name;
      B.sides[0].ready = [false, false];
    }
    B.ui[si] = {};
  }
  function renderUI() {
    for (const si of [0, 1]) {
      const pre = si ? 'bf' : 'bm', side = B.sides[si], m = act(side), u = B.ui[si] || (B.ui[si] = {});
      const hp = Math.max(0, Math.ceil(m.hp));
      if (u.hp !== hp) {
        u.hp = hp;
        const pct = hp / m.maxHp * 100, bar = $(`#${pre}-hp`);
        bar.style.width = pct + '%'; bar.className = pct > 50 ? 'ok' : pct > 20 ? 'mid' : 'low';
        if (!si) $('#bm-hpnum').textContent = `${hp} / ${m.maxHp}`;
      }
      const meta = `${side.shields}|${side.team.map(t => t.hp > 0 ? 1 : 0).join('')}|${m.burn > 0}|${m.stun > 0}|${m.st.atk}|${m.st.def}`;
      if (u.meta !== meta) {
        u.meta = meta;
        $(`#${pre}-shields`).innerHTML = '<i class="sh"></i>'.repeat(side.shields) + '<i class="sh used"></i>'.repeat(2 - side.shields);
        $(`#${pre}-team`).innerHTML = side.team.map(t => `<i class="${t.hp > 0 ? 'alive' : ''}"></i>`).join('');
        $(`#${pre}-status`).textContent = (m.burn > 0 ? '🔥' : '') + (m.stun > 0 ? '⚡' : '') + (m.st.atk > 0 ? `⚔️+${m.st.atk}` : '') + (m.st.def < 0 ? `🛡️${m.st.def}` : '');
      }
    }
    const me = B.sides[0], m = act(me);
    const en = Math.floor(m.energy);
    if (B.ui.en !== en) { B.ui.en = en; $('#bm-en').style.width = en + '%'; }
    m.charged.forEach((mv, i) => {
      const btn = $(`#b-c${i}`), ready = m.energy >= mv.cost;
      btn.querySelector('.fill').style.height = Math.min(100, m.energy / mv.cost * 100) + '%';
      btn.classList.toggle('ready', ready);
      btn.disabled = !ready || B.paused;
      if (ready && !me.ready[i]) G.Music.sfx('ready');
      me.ready[i] = ready;
    });
    const sw = $('#b-switch');
    const swLabel = me.swCd > 0 ? `🔁 ${Math.ceil(me.swCd)}s` : '🔁 Switch';
    if (sw.textContent !== swLabel) sw.textContent = swLabel;
    sw.disabled = B.paused || me.swCd > 0 || me.team.filter(t => t.hp > 0).length < 2;
    $('#b-fast').disabled = B.paused;
  }
  function anim(si, cls) {
    const img = $(si ? '#bf-img' : '#bm-img');
    img.classList.remove('enter', 'lunge', 'hurt', 'faint', 'glowup');
    void img.offsetWidth;
    img.classList.add(cls);
  }
  function floatText(si, text, cls) {
    const host = $(si ? '.b-foe' : '.b-me');
    const s = document.createElement('span');
    s.className = `b-float ${cls || ''}`; s.textContent = text;
    s.style.left = (40 + Math.random() * 20) + '%';
    host.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
  function banner(text, color) {
    const el = $('#b-banner');
    el.textContent = text; el.style.setProperty('--mt', color);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  // ---------- actions ----------
  const netEv = e => { if (B && B.net && B.net.role === 'host') B.net.send({ k: 'ev', ...e }); };
  function doFast(si) {
    const side = B.sides[si], a = act(side), d = act(B.sides[1 - si]);
    const mv = a.fast;
    const { dmg, eff } = calcDamage(a, d, mv);
    d.hp = Math.max(0, d.hp - dmg);
    a.energy = Math.min(MAX_ENERGY, a.energy + mv.energy);
    side.cd = mv.turns * TURN;
    anim(si, 'lunge');
    setTimeout(() => { if (B) anim(1 - si, 'hurt'); }, 120);
    typeFx(mv.type, centerOf(si ? '#bf-img' : '#bm-img'), centerOf(si ? '#bm-img' : '#bf-img'), false);
    G.Music.attack(mv.type, false);
    floatText(1 - si, `-${dmg}`, eff > 1 ? 'super small' : 'small');
    netEv({ t: 'f', si, d: dmg, e: eff });
  }

  async function runCharged(si, mv) {
    B.paused = true;
    const side = B.sides[si], other = B.sides[1 - si], a = act(side), d = act(other);
    a.energy -= mv.cost;
    const from = centerOf(si ? '#bf-img' : '#bm-img'), to = centerOf(si ? '#bm-img' : '#bf-img');
    banner(`${who(si, a)} used ${mv.name}!`, G.TYPES[mv.type]);
    netEv({ t: 'cs', si, c: a.charged.indexOf(mv) });
    G.Music.sfx('charge');
    anim(si, 'glowup');
    ring(from, G.TYPES[mv.type], 90, 0.7, 6);
    burst(from, { n: 26, speed: 120, life: 0.7, size: [3, 6], colors: [G.TYPES[mv.type], '#ffffff'], glow: true, drag: 1 });
    let mult;
    if (si === 0) mult = await minigame(mv);
    else if (B.net) { mult = clamp(B.remoteMult || 0.7, 0.5, 1); await sleep(250); }   // the other player already did their timing meter
    else { msg(`${who(1, a)} is charging ${mv.name}!`); await sleep(750); mult = clamp(B.foe.skill * rnd(0.88, 1.06), 0.5, 1); }
    if (!B) return;
    let shielded = false;
    if (other.shields > 0) {
      shielded = si === 1 ? await shieldPrompt(mv, a) : B.net ? await askRemote('shield', { c: a.charged.indexOf(mv) }, 3800, false) : aiShield(a, d, mv, mult);
    }
    if (!B) return;
    if (shielded) {
      other.shields--;
      G.Music.sfx('shield');
      eff(0.8, (c, k) => {
        c.globalAlpha = 0.7 * (1 - k * 0.6); c.strokeStyle = '#f0abfc'; c.fillStyle = 'rgba(236,72,153,.18)'; c.lineWidth = 4;
        c.beginPath(); c.arc(to.x, to.y, to.r * (0.9 + k * 0.15), 0, 7); c.fill(); c.stroke(); c.globalAlpha = 1;
      });
      anim(si, 'lunge');
      typeFx(mv.type, from, to, false);
      d.hp = Math.max(0, d.hp - 1);
      floatText(1 - si, 'Shielded!', 'shield');
      netEv({ t: 'ch', si, c: a.charged.indexOf(mv), sh: 1 });
      msg(`${who(1 - si, d)} blocked it with a shield!`);
      await sleep(900);
    } else {
      anim(si, 'lunge');
      G.Music.attack(mv.type, true);
      const impact = typeFx(mv.type, from, to, true);
      await sleep(impact * 1000);
      if (!B) return;
      const { dmg, eff } = calcDamage(a, d, mv, mult);
      d.hp = Math.max(0, d.hp - dmg);
      netEv({ t: 'ch', si, c: a.charged.indexOf(mv), d: dmg, e: eff });
      shake(true);
      anim(1 - si, 'hurt');
      floatText(1 - si, `-${dmg}`, eff > 1 ? 'super' : '');
      const notes = [];
      if (eff > 1) notes.push('Super effective!');
      else if (eff < 1) notes.push('Not very effective…');
      switch (mv.effect) {
        case 'atkUp': if (a.st.atk < 3) { a.st.atk++; notes.push(`${a.sp.name}’s attack rose!`); } break;
        case 'defDown': if (d.st.def > -3) { d.st.def--; notes.push(`${d.sp.name}’s defense fell!`); } break;
        case 'burn': if (d.hp > 0) { d.burn = 6; notes.push(`${d.sp.name} was burned!`); } break;
        case 'stun': if (d.hp > 0) { d.stun = 2; notes.push(`${d.sp.name} is stunned!`); } break;
        case 'drain': { const h = Math.round(dmg * 0.35); a.hp = Math.min(a.maxHp, a.hp + h); floatText(si, `+${h}`, 'heal'); notes.push(`${a.sp.name} drained ${h} HP!`); break; }
      }
      if (notes.length) msg(notes.join(' '));
      await sleep(850);
    }
    if (!B) return;
    side.cd = 0.3;
    B.paused = false;
  }

  function estDamage(a, d, mv) { return calcDamage(a, d, mv).dmg; }
  function aiShield(a, d, mv, mult) {
    const dmg = estDamage(a, d, mv) * mult, smart = B.foe.smart;
    if (dmg >= d.hp) return Math.random() < 0.55 + smart * 0.45;
    if (dmg >= d.hp * 0.5) return Math.random() < smart * 0.9;
    if (mv.cost <= 45) return Math.random() < (1 - smart) * 0.5;   // smart AIs don't bite on bait moves
    return Math.random() < 0.2;
  }
  function aiTick(dt) {
    const ai = B.sides[1], m = act(ai), pl = act(B.sides[0]);
    if (m.hp <= 0 || m.stun > 0 || ai.cd > 0) return;
    if (ai.react > 0) { ai.react -= dt; return; }
    ai.react = rnd(0.02, 0.18) * (1.4 - B.foe.smart);
    const smart = B.foe.smart;
    const aff = m.charged.filter(c => m.energy >= c.cost);
    if (aff.length) {
      const cheap = [...m.charged].sort((x, y) => x.cost - y.cost)[0];
      const big = [...m.charged].sort((x, y) => y.cost - x.cost)[0];
      const lowHp = m.hp < m.maxHp * 0.3;
      const plShields = B.sides[0].shields;
      let pick = null;
      const lethal = aff.find(c => estDamage(m, pl, c) >= pl.hp);
      if (lethal && plShields === 0) pick = lethal;
      else if (plShields > 0 && Math.random() < smart) {
        if (m.energy >= big.cost && m.energy >= cheap.cost && Math.random() < 0.55) pick = cheap;          // bait a shield
        else if (m.energy >= big.cost) pick = big;
        else if (lowHp && m.energy >= cheap.cost) pick = cheap;
      } else {
        pick = aff.sort((x, y) => estDamage(m, pl, y) - estDamage(m, pl, x))[0];
        if (!lowHp && m.energy < MAX_ENERGY && Math.random() < 0.25 * smart) pick = null;      // bank energy
      }
      if (!pick && lowHp) pick = aff[0];
      if (pick) { runCharged(1, pick); return; }
    }
    // Smart trainers switch out of a bad matchup once per battle.
    if (smart >= 0.7 && ai.switches < 1 && ai.swCd <= 0 && B.t > 4) {
      const threat = Math.max(effectiveness(pl.fast.type, m.sp.types), ...pl.charged.map(c => effectiveness(c.type, m.sp.types)));
      if (threat > 1.5) {
        const alt = ai.team.map((t, i) => ({ t, i })).filter(o => o.i !== ai.i && o.t.hp > 0)
          .map(o => ({ ...o, s: Math.max(...pl.charged.map(c => effectiveness(c.type, o.t.sp.types))) })).sort((x, y) => x.s - y.s)[0];
        if (alt && alt.s < threat) { ai.switches++; ai.swCd = SWITCH_COOLDOWN; switchTo(1, alt.i, true); return; }
      }
    }
    doFast(1);
  }

  function remoteTick() {
    const rs = B.sides[1], m = act(rs);
    if (m.hp <= 0 || m.stun > 0 || rs.cd > 0) return;
    if (B.rq !== null) {
      const mv = m.charged[B.rq]; B.rq = null;
      if (mv && m.energy >= mv.cost) { runCharged(1, mv); return; }
    }
    if (B.rHold || B.rTap) { B.rTap = false; doFast(1); }
  }
  function askRemote(q, extra, ms, fallback) {
    return new Promise(res => {
      const id = ++B.askN;
      const done = v => { if (!B || !B.asks[id]) return; delete B.asks[id]; clearTimeout(tm); res(v); };
      const tm = setTimeout(() => done(fallback), ms);
      B.asks[id] = done;
      B.net.send({ k: 'ask', q, id, ...extra });
    });
  }
  function sendState() {
    const pack = s => ({ i: s.i, sh: s.shields, sw: Math.max(0, Math.round(s.swCd)), tm: s.team.map(m => [Math.round(m.hp), Math.round(m.energy), m.burn > 0 ? 1 : 0, m.stun > 0 ? 1 : 0, m.st.atk, m.st.def]) });
    B.net.send({ k: 'st', q: ++B.seq, p: B.paused ? 1 : 0, s: [pack(B.sides[0]), pack(B.sides[1])] });
  }

  // ---------- guest: mirror the host ----------
  function applyState(st) {
    if (!(st.q > B.netSeq) || !Array.isArray(st.s) || st.s.length !== 2) return;
    B.netSeq = st.q;
    st.s.forEach((hs, s) => {
      const L = 1 - s, side = B.sides[L];
      if (!hs || !Array.isArray(hs.tm)) return;
      side.shields = clamp(hs.sh | 0, 0, 2); side.swCd = hs.sw | 0;
      hs.tm.forEach((a, k) => {
        const m = side.team[k]; if (!m || !Array.isArray(a)) return;
        m.hp = clamp(+a[0] || 0, 0, m.maxHp); m.energy = clamp(+a[1] || 0, 0, MAX_ENERGY); m.burn = a[2] ? 1 : 0; m.stun = a[3] ? 1 : 0; m.st = { atk: a[4] | 0, def: a[5] | 0 };
      });
      const ni = hs.i | 0;
      if (side.team[ni] && side.i !== ni) { side.i = ni; renderSide(L); if (!L) B.used.add(act(side)); }
    });
    B.paused = !!st.p;
  }
  function guestEvent(e) {
    const L = e.si === 0 ? 1 : 0, side = B.sides[L], a = act(side), d = act(B.sides[1 - L]);
    const from = centerOf(L ? '#bf-img' : '#bm-img'), to = centerOf(L ? '#bm-img' : '#bf-img');
    if (e.t === 'f') {
      anim(L, 'lunge'); setTimeout(() => { if (B) anim(1 - L, 'hurt'); }, 120);
      typeFx(a.fast.type, from, to, false); G.Music.attack(a.fast.type, false);
      floatText(1 - L, `-${e.d | 0}`, e.e > 1 ? 'super small' : 'small');
    } else if (e.t === 'cs') {
      const mv = a.charged[e.c]; if (!mv) return;
      banner(`${who(L, a)} used ${mv.name}!`, G.TYPES[mv.type]); G.Music.sfx('charge');
      anim(L, 'glowup'); ring(from, G.TYPES[mv.type], 90, 0.7, 6);
      burst(from, { n: 26, speed: 120, life: 0.7, size: [3, 6], colors: [G.TYPES[mv.type], '#ffffff'], glow: true, drag: 1 });
      if (L === 1) msg(`${who(1, a)} is using ${mv.name}!`);
    } else if (e.t === 'ch') {
      const mv = a.charged[e.c]; if (!mv) return;
      anim(L, 'lunge');
      if (e.sh) {
        G.Music.sfx('shield'); typeFx(mv.type, from, to, false);
        floatText(1 - L, 'Shielded!', 'shield'); msg(`${who(1 - L, d)} blocked it with a shield!`);
      } else {
        G.Music.attack(mv.type, true);
        const impact = typeFx(mv.type, from, to, true);
        setTimeout(() => {
          if (!B) return;
          shake(true); anim(1 - L, 'hurt'); floatText(1 - L, `-${e.d | 0}`, e.e > 1 ? 'super' : '');
          const notes = [e.e > 1 ? 'Super effective!' : e.e < 1 ? 'Not very effective…' : '', mv.effect ? EFFECT_TEXT[mv.effect] + '!' : ''].filter(Boolean);
          if (notes.length) msg(notes.join(' '));
        }, impact * 1000);
      }
    } else if (e.t === 'ft') {
      G.Music.sfx('faint'); anim(L, 'faint'); msg(`${who(L, a)} fainted!`);
    } else if (e.t === 'sw') {
      const side2 = B.sides[L];
      if (side2.team[e.i] && side2.i !== e.i) { side2.i = e.i; renderSide(L); }
      msg(L ? `${B.foe.name} sent out ${act(side2).sp.name}!` : `Go, ${act(side2).sp.name}!`);
    }
  }
  async function answerAsk(m) {
    let v;
    if (m.q === 'shield') {
      const attacker = act(B.sides[1]), mv = attacker.charged[m.c];
      v = B.sides[0].shields > 0 && mv ? await shieldPrompt(mv, attacker) : false;
    } else if (m.q === 'pick') {
      v = await pickPrompt(true);
    }
    if (B) B.net.send({ k: 'ans', id: m.id, v });
  }
  // Every battle message from the other player comes through here.
  function netMsg(m) {
    if (!B || !B.net || B.over || m.from !== B.net.peer) return;
    B.netLast = Date.now();
    if (B.net.role === 'host') {
      if (m.k === 'h' || m.k === 'hb') B.rHold = !!(m.k === 'h' ? m.v : m.h);
      else if (m.k === 't') B.rTap = true;
      else if (m.k === 'c' && (m.i === 0 || m.i === 1)) { B.rq = m.i; B.remoteMult = clamp(+m.m || 0.5, 0.5, 1); }
      else if (m.k === 'sw') {
        const rs = B.sides[1];
        if (!B.paused && rs.swCd <= 0 && rs.team[m.i] && rs.team[m.i].hp > 0 && m.i !== rs.i) { switchTo(1, m.i, true); rs.swCd = SWITCH_COOLDOWN; }
      } else if (m.k === 'ans' && B.asks[m.id]) B.asks[m.id](m.v);
      else if (m.k === 'ff') { msg(`${B.foe.name} forfeited!`); end(true); }
    } else {
      if (m.k === 'st') applyState(m);
      else if (m.k === 'ev') guestEvent(m);
      else if (m.k === 'ask') answerAsk(m);
      else if (m.k === 'end') { applyStateEnd(); end(!m.w); }
    }
  }
  function applyStateEnd() { B.paused = true; }

  function switchTo(si, idx, announce) {
    const side = B.sides[si];
    const old = act(side);
    old.st = { atk: 0, def: 0 };
    side.i = idx; side.cd = 0.5;
    renderSide(si);
    netEv({ t: 'sw', si, i: idx });
    if (!si) B.used.add(act(side));
    if (announce) msg(si ? `${B.foe.name} switched to ${act(side).sp.name}!` : `Go, ${act(side).sp.name}!`);
  }

  async function handleFaint(si) {
    const side = B.sides[si];
    side.fainting = true; B.paused = true;
    G.Music.sfx('faint');
    anim(si, 'faint');
    msg(`${who(si, act(side))} fainted!`);
    netEv({ t: 'ft', si });
    await sleep(1000);
    if (!B) return;
    const alive = side.team.map((t, i) => ({ t, i })).filter(o => o.t.hp > 0);
    if (!alive.length) { end(si === 1); return; }
    let idx;
    if (si === 1 && B.net) {
      msg(`Waiting for ${B.foe.name} to choose…`);
      const want = await askRemote('pick', {}, 11000, alive[0].i);
      idx = alive.some(o => o.i === want) ? want : alive[0].i;
      if (!B) return;
      switchTo(1, idx);
      banner(`${B.foe.name} sent out ${act(side).sp.name}!`, B.foe.color);
      await sleep(700);
    } else if (si === 1) {
      const pl = act(B.sides[0]);
      idx = alive.map(o => ({ i: o.i, s: Math.max(...o.t.charged.map(c => effectiveness(c.type, pl.sp.types))) - Math.max(...pl.charged.map(c => effectiveness(c.type, o.t.sp.types))) }))
        .sort((x, y) => y.s - x.s)[0].i;
      switchTo(1, idx);
      banner(`${B.foe.name} sent out ${act(side).sp.name}!`, B.foe.color);
      await sleep(900);
    } else {
      idx = await pickPrompt(true);
      switchTo(0, idx, true);
      await sleep(500);
    }
    side.fainting = false;
    B.paused = false;
  }

  // ---------- overlays ----------
  function minigame(mv) {
    return new Promise(res => {
      const el = $('#b-mini');
      el.style.setProperty('--mt', G.TYPES[mv.type]);
      el.innerHTML = `<div class="mini-box"><b>${mv.name}</b><span>Tap when the marker hits the center!</span>
        <div class="mini-bar"><i class="z nice"></i><i class="z great"></i><i class="z exc"></i><i class="needle"></i></div><em id="mini-res"></em></div>`;
      el.classList.remove('hidden');
      const needle = el.querySelector('.needle');
      const speed = 2.2 + mv.power / 60;
      const t0 = performance.now();
      let done = false, pos = 0, id = 0;
      const step = () => {
        const t = (performance.now() - t0) / 1000;
        pos = Math.sin(t * speed);
        needle.style.left = (50 + pos * 48) + '%';
        if (t > 2.4) finish(true); else id = requestAnimationFrame(step);
      };
      const finish = timeout => {
        if (done) return; done = true; cancelAnimationFrame(id);
        const d = Math.abs(pos);
        const [m, label] = timeout ? [0.5, 'Too slow!'] : d < 0.12 ? [1, 'Excellent!'] : d < 0.32 ? [0.85, 'Great!'] : d < 0.58 ? [0.7, 'Nice!'] : [0.55, 'Weak…'];
        $('#mini-res').textContent = label;
        if (m === 1) G.Music.sfx('excellent');
        B.miniHandler = null;
        setTimeout(() => { el.classList.add('hidden'); res(m); }, 380);
      };
      B.miniHandler = () => finish(false);
      el.onpointerdown = e => { e.preventDefault(); finish(false); };
      id = requestAnimationFrame(step);
    });
  }
  function shieldPrompt(mv, attacker) {
    return new Promise(res => {
      const el = $('#b-prompt'), me = B.sides[0];
      el.innerHTML = `<div class="prompt-box" style="--mt:${G.TYPES[mv.type]}">
        <b>⚠️ ${attacker.sp.name} is using ${mv.name}!</b>
        <span>${mv.type} · Power ${mv.power}${mv.effect ? ' · ' + EFFECT_TEXT[mv.effect] : ''}</span>
        <div class="timer"><i></i></div>
        <div class="prompt-btns"><button class="primary" id="pr-yes">🛡️ Shield (${me.shields} left)</button><button class="ghost" id="pr-no">Take the hit</button></div></div>`;
      el.classList.remove('hidden');
      let done = false;
      const finish = v => { if (done) return; done = true; clearTimeout(tm); B.promptHandler = null; el.classList.add('hidden'); res(v); };
      const tm = setTimeout(() => finish(false), 3200);
      $('#pr-yes').onclick = () => finish(true);
      $('#pr-no').onclick = () => finish(false);
      B.promptHandler = finish;
    });
  }
  function pickPrompt(forced) {
    return new Promise(res => {
      const el = $('#b-pick'), side = B.sides[0];
      el.innerHTML = `<div class="pick-box"><b>${forced ? 'Choose your next Regimon' : 'Switch Regimon'}</b>
        ${side.team.map((m, i) => `<button class="pick-row" data-i="${i}" ${m.hp <= 0 || i === side.i ? 'disabled' : ''}>
          <img src="${G.Art.url(m.sp, m.shiny)}" alt=""><span><b>${m.sp.name}</b><small>Lv ${m.level} · ${Math.ceil(m.hp)}/${m.maxHp} HP · ⚡${Math.floor(m.energy)}${m.hp <= 0 ? ' · fainted' : ''}</small>
          <span class="mini-types">${m.sp.types.map(t => `<i style="background:${G.TYPES[t]}"></i>`).join('')}</span></span></button>`).join('')}
        ${forced ? '' : '<button class="ghost" id="pick-cancel">Cancel</button>'}</div>`;
      el.classList.remove('hidden');
      let done = false;
      const finish = v => { if (done) return; done = true; clearTimeout(tm); el.classList.add('hidden'); res(v); };
      const tm = forced ? setTimeout(() => finish(side.team.findIndex(m => m.hp > 0)), 10000) : 0;
      el.querySelectorAll('.pick-row').forEach(b => { b.onclick = () => finish(+b.dataset.i); });
      if (!forced) $('#pick-cancel').onclick = () => finish(-1);
    });
  }

  // ---------- input ----------
  function bindUI() {
    const hold = on => e => { if (!B || B.over) return; if (e) e.preventDefault(); B.holding = on; if (on) B.tap = true; };
    for (const el of [$('#b-field'), $('#b-fast')]) {
      el.addEventListener('pointerdown', hold(true));
      el.addEventListener('pointerup', hold(false));
      el.addEventListener('pointerleave', hold(false));
      el.addEventListener('pointercancel', hold(false));
    }
    [0, 1].forEach(i => { $(`#b-c${i}`).onclick = () => { if (B && !B.paused) { B.queued = i; B.tap = false; } }; });
    $('#b-switch').onclick = async () => {
      if (!B || B.paused || B.sides[0].swCd > 0) return;
      B.paused = true;
      const idx = await pickPrompt(false);
      if (B && idx >= 0 && B.net && B.net.role === 'guest') { B.net.send({ k: 'sw', i: idx }); B.paused = false; return; }
      if (B && idx >= 0) { switchTo(0, idx, true); B.sides[0].swCd = SWITCH_COOLDOWN; }
      if (B) B.paused = false;
    };
    $('#b-run').onclick = () => { if (B && !B.over) { if (B.net && B.net.role === 'guest') B.net.send({ k: 'ff' }); msg('You forfeited the battle.'); end(false, true); } };
    addEventListener('keydown', e => {
      if (!B || B.over) return;
      const k = e.key.toLowerCase();
      if (B.miniHandler && (k === ' ' || k === 'enter')) { e.preventDefault(); B.miniHandler(); return; }
      if (B.promptHandler && (k === 's' || k === 'n')) { B.promptHandler(k === 's'); return; }
      if (k === ' ' || k === 'f') { e.preventDefault(); B.holding = true; B.tap = true; }
      if (k === '1' || k === '2') $(`#b-c${+k - 1}`).click();
    });
    addEventListener('keyup', e => { if (B && (e.key === ' ' || e.key.toLowerCase() === 'f')) B.holding = false; });
  }

  // ---------- main loop ----------
  function frame(now) {
    if (!B) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fxFrame(dt);
    if (B.net && !B.over) {
      if (Date.now() - B.netLast > 15000) { msg(`${B.foe.name} disconnected.`); end(true); }
      else if (B.net.role === 'host') { B.netT -= dt; if (B.netT <= 0) { B.netT = 0.14; sendState(); } }
      else {
        // guest: send taps, holds and special moves to the host; the host sends back what happened
        B.hbT -= dt;
        if (B.holding !== B.lastHold || B.hbT <= 0) { B.lastHold = B.holding; B.hbT = 1; B.net.send({ k: 'h', v: B.holding }); }
        if (B.tap) { B.tap = false; B.net.send({ k: 't' }); }
        const mm = act(B.sides[0]);
        if (B.queued !== null && !B.gBusy) {
          const mv = mm.charged[B.queued], qi = B.queued; B.queued = null;
          if (mv && mm.energy >= mv.cost && !B.paused) { B.gBusy = true; minigame(mv).then(mult => { if (B) { B.net.send({ k: 'c', i: qi, m: mult }); B.gBusy = false; } }); }
        }
        renderUI();
        raf = requestAnimationFrame(frame);
        return;
      }
    }
    if (!B.over && !B.paused) {
      B.t += dt;
      for (const side of B.sides) {
        const m = act(side);
        side.cd -= dt; side.swCd -= dt;
        if (m.hp > 0 && m.burn > 0) {
          m.burn -= dt; m.burnAcc += m.maxHp * 0.025 * dt;
          if (m.burnAcc >= 1) { const n = Math.floor(m.burnAcc); m.burnAcc -= n; m.hp = Math.max(0, m.hp - n); }
        }
        if (m.stun > 0) m.stun -= dt;
      }
      const me = B.sides[0], mm = act(me);
      if (mm.hp > 0 && mm.stun <= 0 && me.cd <= 0) {
        if (B.queued !== null) {
          const mv = mm.charged[B.queued]; B.queued = null;
          if (mm.energy >= mv.cost) runCharged(0, mv);
        } else if (B.holding || B.tap) { B.tap = false; doFast(0); }
      }
      if (!B.paused) { if (B.net) remoteTick(); else aiTick(dt); }
      for (const si of [0, 1]) if (!B.paused && act(B.sides[si]).hp <= 0 && !B.sides[si].fainting) handleFaint(si);
    }
    if (B && !B.over) renderUI();
    raf = requestAnimationFrame(frame);
  }

  function end(win, forfeit) {
    if (!B || B.over) return;
    const b = B;
    b.over = true; b.paused = true;
    if (b.net && b.net.role === 'host') { b.net.send({ k: 'end', w: win ? 1 : 0 }); setTimeout(() => b.net.send({ k: 'end', w: win ? 1 : 0 }), 600); }
    for (const id of ['#b-prompt', '#b-mini', '#b-pick']) $(id).classList.add('hidden');
    G.Music.sfx(win ? 'victory' : 'defeat');
    const boosts = [];
    for (const m of b.used) {
      if (!m.entry || forfeit) continue;
      const gain = Math.round((win ? 12 : 4) + b.foe.tier * (win ? 4 : 1));
      m.entry.cp += gain; boosts.push(`${m.sp.name} +${gain} CP`);
    }
    const mine = b.sides[0].team, hpLeft = mine.reduce((s, m) => s + Math.max(0, m.hp), 0) / mine.reduce((s, m) => s + m.maxHp, 0);
    const rewards = b.foe.onResult ? b.foe.onResult(win, { hpLeft: forfeit ? 0 : hpLeft, time: b.t, forfeit: !!forfeit }) : [];
    msg(win ? `You defeated ${b.foe.name}!` : forfeit ? 'You left the battle.' : `You were defeated by ${b.foe.name}.`);
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
        cancelAnimationFrame(raf);
        fx.parts = []; fx.effs = [];
        B = null;
        G.onClose && G.onClose(win);
      });
      $('#b-done').onclick = () => G.closeModal();
    }, 1100);
  }

  return { init, challenge, start, netMsg, levelFromCP, movesFor, isActive: () => !!B, EFFECT_TEXT };
})();
