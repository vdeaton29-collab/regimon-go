// Regimon GO — arcade minigames found around the map. Each returns a score; the game turns it into Rare Candy.
// per: score points per Rare Candy. color: the arcade's screen color on the map.
window.RGMini = (() => {
  const $ = s => document.querySelector(s);
  const GAMES = {
    whack: { name: 'Pop-Up Regimon', icon: '🔨', color: '#f97316', per: 2.5, how: 'Tap the Regimon as they pop out of the holes! Golden ones are worth 3.' },
    memory: { name: 'Regidex Memory', icon: '🃏', color: '#22c55e', per: 2, how: 'Flip two cards at a time and find all 8 pairs before time runs out.' },
    toss: { name: 'Bullseye Toss', icon: '🎯', color: '#38bdf8', per: 1.8, how: 'Press THROW when the Regimon is inside the gold target. 8 throws!' },
    quick: { name: 'Quick Draw', icon: '⚡', color: '#facc15', per: 4, how: 'Wait for the Regimon to appear, then tap as fast as you can. Tapping early is a foul! 5 rounds.' },
    typesort: { name: 'Type Sort', icon: '🔤', color: '#a78bfa', per: 1.5, how: 'Tap one of the Regimon’s types. As many as you can in 25 seconds.' },
    namequiz: { name: 'Who’s That Regimon?', icon: '❔', color: '#60a5fa', per: 1.1, how: 'Name the Regimon from its shadow. 8 rounds.' },
    oddone: { name: 'Odd One Out', icon: '🔍', color: '#f472b6', per: 1.3, how: 'One Regimon in the grid is different. Find it fast! 25 seconds.' },
    count: { name: 'Count ’Em', icon: '🔢', color: '#34d399', per: 0.8, how: 'Regimon flash on screen. Count the one we ask about! 6 rounds.' },
    simon: { name: 'Regi Says', icon: '🎵', color: '#fb7185', per: 0.6, how: 'Watch the pads light up, then repeat the pattern. It gets longer each round.' },
    balloon: { name: 'Balloon Pop', icon: '🎈', color: '#f87171', per: 2.5, how: 'Pop the Regimon balloons as they float up. Don’t pop the 💣 bombs! 25 seconds.' },
    catcher: { name: 'Candy Catcher', icon: '🧺', color: '#fbbf24', per: 2.5, how: 'Drag the basket to catch falling candy. Rocks cost 2 points! 25 seconds.' },
    rhythm: { name: 'Rhythm Regimon', icon: '🥁', color: '#c084fc', per: 2, how: 'Tap a lane when its note reaches the gold line. 25 seconds.' },
    math: { name: 'Math Blitz', icon: '➗', color: '#2dd4bf', per: 1.2, how: 'Regis-level mental math! Solve as many as you can in 25 seconds.' },
    hilo: { name: 'Higher or Lower', icon: '📈', color: '#4ade80', per: 0.8, how: 'Will the next Regimon have higher or lower CP? Keep your streak going!' },
    shiny: { name: 'Spot the Shiny', icon: '✨', color: '#fde047', per: 1.3, how: 'One Regimon in the grid is shiny. Tap it! 25 seconds.' },
    mash: { name: 'Tap Frenzy', icon: '👆', color: '#fb923c', per: 6, how: 'Tap the button as many times as you can in 10 seconds!' },
    clock: { name: 'Stop the Clock', icon: '⏱️', color: '#93c5fd', per: 3.5, how: 'Stop the timer at exactly 3.00 seconds. The numbers vanish after 1 second! 5 tries.' },
    flappy: { name: 'Flappy Pigeon', icon: '🐦', color: '#7dd3fc', per: 0.7, how: 'Tap to flap between the skyscrapers. How far can you fly?' },
    dodge: { name: 'Taxi Dodge', icon: '🚕', color: '#fcd34d', per: 2, how: 'Drag left and right to dodge the falling taxis. Survive 30 seconds!' },
    scramble: { name: 'Name Scramble', icon: '🔀', color: '#e879f9', per: 0.9, how: 'Unscramble the Regimon’s name. As many as you can in 30 seconds.' },
    stroop: { name: 'Color Clash', icon: '🎨', color: '#f43f5e', per: 1.5, how: 'Does the ink color match the word? Answer fast for 20 seconds.' },
    trivia: { name: 'NYC & Regis Trivia', icon: '🗽', color: '#60a5fa', per: 1.1, how: 'Eight questions about New York and Regis. 2 points each.' },
    stack: { name: 'Tower Stack', icon: '🏙️', color: '#94a3b8', per: 0.8, how: 'Tap to drop each floor on the tower. Overhangs get cut off. Build it tall!' },
  };
  let root = null, timers = [], rafs = [], H = null, score = 0, over = false;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const loop = fn => { let last = performance.now(); const step = now => { if (over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt, now); rafs.push(requestAnimationFrame(step)); }; rafs.push(requestAnimationFrame(step)); };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = n => Math.floor(Math.random() * n);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function shell(kind, body) {
    const g = GAMES[kind];
    root = document.createElement('div');
    root.id = 'mg';
    root.innerHTML = `<div class="mg-top"><b>${g.icon} ${g.name}</b><span id="mg-score"></span><span id="mg-time"></span><button id="mg-quit" aria-label="Quit">✕</button></div>
      <div class="mg-body">${body}</div><div class="mg-how">${g.how}</div>`;
    document.body.appendChild(root);
    $('#mg-quit').onclick = () => finish(0, true);
    setScore(0);
  }
  function clock(seconds, onEnd) {
    const end = performance.now() + seconds * 1000;
    const tick = () => {
      if (over) return;
      const left = Math.max(0, (end - performance.now()) / 1000);
      const el = $('#mg-time'); if (el) el.textContent = '⏱ ' + left.toFixed(1);
      if (left <= 0) onEnd(); else rafs.push(requestAnimationFrame(tick));
    };
    rafs.push(requestAnimationFrame(tick));
    return () => Math.max(0, (end - performance.now()) / 1000);
  }
  function setScore(s) { score = Math.max(0, Math.round(s)); const el = $('#mg-score'); if (el) el.textContent = '⭐ ' + score; }
  function finish(extra, quit) {
    if (over) return;
    over = true;
    rafs.forEach(cancelAnimationFrame); timers.forEach(clearTimeout); rafs = []; timers = [];
    if (root) root.remove(); root = null;
    H.done(quit ? null : score + (extra || 0));
  }
  const img = (sp, shiny, cls = '') => `<img class="${cls}" src="${H.art(sp, shiny)}" alt="" draggable="false">`;
  const distinct = (n, pred = () => true) => { const out = []; let tries = 0; while (out.length < n && tries++ < 500) { const sp = H.randomSpecies(); if (!out.includes(sp) && pred(sp)) out.push(sp); } return out; };
  const flash = (ok) => { if (!root) return; root.classList.remove('ok', 'bad'); void root.offsetWidth; root.classList.add(ok ? 'ok' : 'bad'); H.sfx(ok ? 'buff' : 'miss'); };
  // A question with buttons. ask(html, options, correctIndex, onAnswer(ok))
  function quiz(el, html, options, correct, onAnswer) {
    el.innerHTML = `<div class="mg-q">${html}</div><div class="mg-opts">${options.map((o, i) => `<button class="mg-opt" data-i="${i}">${o}</button>`).join('')}</div>`;
    el.querySelectorAll('.mg-opt').forEach(b => {
      b.onclick = () => {
        if (el.dataset.lock) return;
        el.dataset.lock = '1';
        const ok = +b.dataset.i === correct;
        b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) el.querySelector(`.mg-opt[data-i="${correct}"]`).classList.add('right');
        flash(ok);
        later(() => { delete el.dataset.lock; onAnswer(ok); }, ok ? 280 : 650);
      };
    });
  }
  // A canvas that fills the play area.
  function canvasGame(kind) {
    shell(kind, '<canvas class="mg-cv"></canvas>');
    const cv = root.querySelector('.mg-cv'), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.min(root.clientWidth - 24, 460), h = Math.min(root.clientHeight - 170, 620);
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const pics = {};
    const pic = (sp, shiny) => { const k = sp.id + (shiny ? 's' : ''); if (!pics[k]) { pics[k] = new Image(); pics[k].src = H.art(sp, shiny); } return pics[k]; };
    const draw = (im, x, y, s) => { if (im.complete && im.naturalWidth) g.drawImage(im, x - s / 2, y - s / 2, s, s); };
    return { cv, g, w, h, pic, draw };
  }

  // ---------- the original three ----------
  function whack() {
    shell('whack', `<div class="mg-holes">${Array.from({ length: 9 }, (_, i) => `<button class="mg-hole" data-i="${i}"><img alt=""></button>`).join('')}</div>`);
    const holes = [...root.querySelectorAll('.mg-hole')];
    const pop = () => {
      if (over) return;
      const free = holes.filter(h => !h.classList.contains('up'));
      if (free.length) {
        const h = free[ri(free.length)], gold = Math.random() < 0.12;
        h.querySelector('img').src = H.art(H.randomSpecies(), gold);
        h.dataset.gold = gold ? '1' : '';
        h.classList.add('up'); h.classList.toggle('gold', gold);
        later(() => h.classList.remove('up', 'gold'), Math.max(420, 1000 - score * 18));
      }
      later(pop, Math.max(260, 650 - score * 12));
    };
    holes.forEach(h => {
      h.onpointerdown = () => {
        if (!h.classList.contains('up')) return;
        h.classList.remove('up'); h.classList.add('bonk');
        later(() => h.classList.remove('bonk', 'gold'), 250);
        setScore(score + (h.dataset.gold ? 3 : 1)); H.sfx(h.dataset.gold ? 'excellent' : 'hit');
      };
    });
    clock(25, () => finish());
    later(pop, 500);
  }
  function memory() {
    const picks = distinct(8), cards = shuffle([...picks, ...picks]);
    shell('memory', `<div class="mg-cards">${cards.map((sp, i) => `<button class="mg-card" data-i="${i}"><span class="back">❓</span>${img(sp)}</button>`).join('')}</div>`);
    const els = [...root.querySelectorAll('.mg-card')];
    let open = [], pairs = 0, lock = false;
    const left = clock(40, () => finish());
    els.forEach((el, i) => {
      el.onclick = () => {
        if (lock || el.classList.contains('flip')) return;
        el.classList.add('flip'); open.push(i); H.sfx('pop');
        if (open.length < 2) return;
        const [a, b] = open; open = [];
        if (cards[a] === cards[b]) {
          pairs++; setScore(pairs * 2); H.sfx('buff');
          els[a].classList.add('done'); els[b].classList.add('done');
          if (pairs === 8) later(() => finish(Math.round(left() / 3)), 400);
        } else {
          lock = true;
          later(() => { els[a].classList.remove('flip'); els[b].classList.remove('flip'); lock = false; }, 650);
        }
      };
    });
  }
  function toss() {
    shell('toss', `<div class="mg-lane"><div class="mg-target"></div><img class="mg-runner" alt=""></div><div class="mg-result" id="mg-res"></div>
      <button class="mg-throw" id="mg-throw">🎯 THROW</button><div class="mg-left" id="mg-left"></div>`);
    const runner = root.querySelector('.mg-runner');
    let throws = 8, t0 = performance.now(), speed = 1.4, paused = false, pos = 0;
    const newRunner = () => { runner.src = H.art(H.randomSpecies()); };
    newRunner();
    $('#mg-left').textContent = `${throws} throws left`;
    loop((dt, now) => {
      if (!paused) { const t = (now - t0) / 1000; pos = Math.sin(t * speed * 2.1) * 0.5 + Math.sin(t * speed * 3.3) * 0.12; }
      runner.style.left = `calc(${50 + pos * 80}% - 32px)`;
    });
    $('#mg-throw').onclick = () => {
      if (paused || over) return;
      paused = true;
      const d = Math.abs(pos * 80) / 100;
      const pts = d < 0.05 ? 3 : d < 0.12 ? 2 : d < 0.2 ? 1 : 0;
      $('#mg-res').textContent = ['Miss…', 'Nice!', 'Great!', 'Excellent!'][pts]; $('#mg-res').className = 'mg-result r' + pts;
      H.sfx(pts === 3 ? 'excellent' : pts ? 'hit' : 'miss');
      setScore(score + pts);
      throws--; $('#mg-left').textContent = `${throws} throw${throws === 1 ? '' : 's'} left`;
      later(() => {
        $('#mg-res').textContent = '';
        if (!throws) { finish(); return; }
        speed += 0.18; t0 = performance.now() - Math.random() * 2000; newRunner(); paused = false;
      }, 800);
    };
  }

  // ---------- 20 new games ----------
  function quick() {
    shell('quick', '<button class="mg-pad big" id="mg-pad"><span id="mg-msg">Get ready…</span></button><div class="mg-left" id="mg-left"></div>');
    const pad = $('#mg-pad'), msg = $('#mg-msg');
    let round = 0, armed = false, goAt = 0, waiting = false;
    const next = () => {
      if (round >= 5) { finish(); return; }
      round++; $('#mg-left').textContent = `Round ${round} of 5`;
      armed = false; waiting = true; pad.className = 'mg-pad big'; msg.textContent = 'Wait for it…';
      later(() => { if (over) return; armed = true; goAt = performance.now(); pad.className = 'mg-pad big go'; msg.innerHTML = img(H.randomSpecies()) + '<b>TAP!</b>'; H.sfx('ready'); }, rnd(1000, 3200));
    };
    pad.onpointerdown = () => {
      if (!waiting) return;
      if (!armed) { waiting = false; timers.forEach(clearTimeout); msg.textContent = 'Too early! Foul.'; pad.className = 'mg-pad big bad'; H.sfx('miss'); later(next, 900); return; }
      const ms = performance.now() - goAt; waiting = false;
      const pts = Math.max(0, Math.round((650 - ms) / 40));
      setScore(score + pts); msg.textContent = `${Math.round(ms)} ms  +${pts}`; pad.className = 'mg-pad big ok'; H.sfx(pts > 8 ? 'excellent' : 'hit');
      later(next, 900);
    };
    later(next, 600);
  }
  function typesort() {
    shell('typesort', '<div id="mg-area" class="mg-quiz"></div>');
    const area = $('#mg-area'), all = Object.keys(H.types);
    const ask = () => {
      if (over) return;
      const sp = H.randomSpecies(), right = sp.types[ri(sp.types.length)];
      const wrong = shuffle(all.filter(t => !sp.types.includes(t))).slice(0, 3), opts = shuffle([right, ...wrong]);
      quiz(area, img(sp, false, 'mg-big') + `<b>${esc(sp.name)}</b>`, opts.map(t => `<span class="mg-type" style="background:${H.types[t]}">${t}</span>`), opts.indexOf(right), ok => { if (ok) setScore(score + 1); ask(); });
    };
    clock(25, () => finish());
    ask();
  }
  function namequiz() {
    shell('namequiz', '<div id="mg-area" class="mg-quiz"></div><div class="mg-left" id="mg-left"></div>');
    const area = $('#mg-area');
    let round = 0;
    const ask = () => {
      if (round >= 8) { finish(); return; }
      round++; $('#mg-left').textContent = `Question ${round} of 8`;
      const opts = distinct(4), right = ri(4);
      quiz(area, img(opts[right], false, 'mg-big mg-sil'), opts.map(s => esc(s.name)), right, ok => { if (ok) setScore(score + 2); ask(); });
    };
    ask();
  }
  function oddone() {
    shell('oddone', '<div id="mg-grid" class="mg-grid"></div>');
    const grid = $('#mg-grid');
    let level = 0;
    const deal = () => {
      if (over) return;
      const n = Math.min(6, 3 + Math.floor(level / 3)), [a, b] = distinct(2, sp => true), odd = ri(n * n);
      grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      grid.innerHTML = Array.from({ length: n * n }, (_, i) => `<button class="mg-cell" data-odd="${i === odd ? 1 : ''}">${img(i === odd ? b : a)}</button>`).join('');
      grid.querySelectorAll('.mg-cell').forEach(c => { c.onclick = () => { const ok = !!c.dataset.odd; flash(ok); if (ok) { setScore(score + 1); level++; } deal(); }; });
    };
    clock(25, () => finish());
    deal();
  }
  function count() {
    shell('count', '<div id="mg-area" class="mg-quiz"></div><div class="mg-left" id="mg-left"></div>');
    const area = $('#mg-area');
    let round = 0;
    const show = () => {
      if (round >= 6) { finish(); return; }
      round++; $('#mg-left').textContent = `Round ${round} of 6`;
      const kinds = distinct(3), target = kinds[0], total = 7 + ri(8), n = 1 + ri(Math.min(7, total - 2));
      const list = shuffle([...Array(n).fill(target), ...Array.from({ length: total - n }, () => kinds[1 + ri(2)])]);
      area.innerHTML = `<div class="mg-scatter">${list.map(sp => `<img src="${H.art(sp)}" style="left:${rnd(2, 82)}%;top:${rnd(2, 80)}%" alt="">`).join('')}</div>`;
      later(() => {
        const opts = shuffle([...new Set([n, n + 1, Math.max(0, n - 1), n + 2])]).slice(0, 4);
        if (!opts.includes(n)) opts[0] = n;
        quiz(area, `How many ${img(target, false, 'mg-mini')} <b>${esc(target.name)}</b>?`, opts.map(String), opts.indexOf(n), ok => { if (ok) setScore(score + 2); show(); });
      }, Math.max(1400, 2400 - round * 150));
    };
    show();
  }
  function simon() {
    const pads = distinct(4);
    shell('simon', `<div class="mg-simon">${pads.map((sp, i) => `<button class="mg-sp s${i}" data-i="${i}">${img(sp)}</button>`).join('')}</div><div class="mg-left" id="mg-left">Watch…</div>`);
    const els = [...root.querySelectorAll('.mg-sp')], seq = [];
    let pos = 0, input = false;
    const light = i => { els[i].classList.add('lit'); H.sfx(['pop', 'spin', 'buff', 'ready'][i]); later(() => els[i].classList.remove('lit'), 350); };
    const play = () => {
      input = false; $('#mg-left').textContent = 'Watch…';
      seq.push(ri(4));
      seq.forEach((p, k) => later(() => light(p), 600 + k * Math.max(320, 560 - seq.length * 20)));
      later(() => { input = true; pos = 0; $('#mg-left').textContent = 'Your turn!'; }, 600 + seq.length * Math.max(320, 560 - seq.length * 20));
    };
    els.forEach((el, i) => {
      el.onclick = () => {
        if (!input) return;
        light(i);
        if (i !== seq[pos]) { input = false; flash(false); $('#mg-left').textContent = 'Oops!'; later(() => finish(), 800); return; }
        pos++;
        if (pos === seq.length) { setScore(seq.length); input = false; later(play, 700); }
      };
    });
    play();
  }
  function balloon() {
    const { cv, g, w, h, pic, draw } = canvasGame('balloon');
    const bs = [];
    let spawnT = 0;
    const cols = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#f472b6'];
    loop(dt => {
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = rnd(0.35, 0.7); const bomb = Math.random() < 0.18; bs.push({ x: rnd(30, w - 30), y: h + 40, r: rnd(24, 32), v: rnd(70, 130) + score * 2, bomb, sp: bomb ? null : H.randomSpecies(), col: cols[ri(cols.length)], sway: rnd(0, 6) }); }
      g.fillStyle = '#bfe3ff'; g.fillRect(0, 0, w, h);
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i]; b.y -= b.v * dt; b.sway += dt * 2;
        const x = b.x + Math.sin(b.sway) * 8;
        if (b.pop) { b.pop -= dt; g.globalAlpha = Math.max(0, b.pop * 4); }
        g.strokeStyle = '#475569'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, b.y + b.r); g.lineTo(x, b.y + b.r + 26); g.stroke();
        g.fillStyle = b.bomb ? '#1f2937' : b.col; g.beginPath(); g.ellipse(x, b.y, b.r, b.r * 1.15, 0, 0, 7); g.fill();
        if (b.bomb) { g.font = '26px "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💣', x, b.y); } else draw(pic(b.sp), x, b.y, b.r * 1.5);
        g.globalAlpha = 1;
        b.x2 = x;
        if (b.y < -60 || (b.pop != null && b.pop <= 0)) bs.splice(i, 1);
      }
    });
    cv.onpointerdown = e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (const b of bs) if (b.pop == null && Math.hypot(x - b.x2, y - b.y) < b.r * 1.2) { b.pop = 0.25; setScore(score + (b.bomb ? -3 : 1)); H.sfx(b.bomb ? 'superhit' : 'pop'); break; }
    };
    clock(25, () => finish());
  }
  function catcher() {
    const { cv, g, w, h } = canvasGame('catcher');
    let bx = w / 2, spawnT = 0;
    const items = [];
    loop(dt => {
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = rnd(0.3, 0.6); const rock = Math.random() < 0.25; items.push({ x: rnd(20, w - 20), y: -20, v: rnd(160, 260) + score * 4, rock, e: rock ? '🪨' : ['🍬', '🍭', '🥯', '🍫'][ri(4)] }); }
      g.fillStyle = '#fef3c7'; g.fillRect(0, 0, w, h);
      g.font = '28px "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.y += it.v * dt; g.fillText(it.e, it.x, it.y);
        if (it.y > h - 50 && it.y < h - 20 && Math.abs(it.x - bx) < 44) { setScore(score + (it.rock ? -2 : 1)); H.sfx(it.rock ? 'superhit' : 'pop'); items.splice(i, 1); continue; }
        if (it.y > h + 30) items.splice(i, 1);
      }
      g.font = '54px "Segoe UI Emoji", sans-serif'; g.fillText('🧺', bx, h - 34);
    });
    const move = e => { const r = cv.getBoundingClientRect(); bx = Math.max(30, Math.min(w - 30, e.clientX - r.left)); };
    cv.onpointerdown = move; cv.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') move(e); };
    clock(25, () => finish());
  }
  function rhythm() {
    const { cv, g, w, h } = canvasGame('rhythm');
    root.querySelector('.mg-body').insertAdjacentHTML('beforeend', '<div class="mg-lanes"><button data-l="0">🥁</button><button data-l="1">🎹</button><button data-l="2">🎺</button></div>');
    const notes = [], lineY = h - 60, lw = w / 3, cols = ['#f472b6', '#60a5fa', '#fbbf24'];
    let spawnT = 0.5, t = 0, bpm = 120;
    loop(dt => {
      t += dt; spawnT -= dt;
      if (spawnT <= 0) { spawnT = 60 / bpm * (Math.random() < 0.3 ? 0.5 : 1); bpm = Math.min(190, bpm + 1.2); notes.push({ l: ri(3), y: -20 }); }
      g.fillStyle = '#1e1b4b'; g.fillRect(0, 0, w, h);
      for (let l = 0; l < 3; l++) { g.fillStyle = l % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'; g.fillRect(l * lw, 0, lw, h); }
      g.fillStyle = '#facc15'; g.fillRect(0, lineY - 3, w, 6);
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i]; n.y += 260 * dt;
        g.fillStyle = cols[n.l]; g.beginPath(); g.arc(n.l * lw + lw / 2, n.y, 18, 0, 7); g.fill();
        if (n.y > h + 20) notes.splice(i, 1);
      }
    });
    const hit = l => {
      let best = -1, bd = 60;
      notes.forEach((n, i) => { const d = Math.abs(n.y - lineY); if (n.l === l && d < bd) { bd = d; best = i; } });
      if (best >= 0) { notes.splice(best, 1); setScore(score + (bd < 20 ? 2 : 1)); H.sfx(bd < 20 ? 'excellent' : 'hit'); } else H.sfx('miss');
    };
    root.querySelectorAll('.mg-lanes button').forEach(b => { b.onpointerdown = () => hit(+b.dataset.l); });
    cv.onpointerdown = e => { const r = cv.getBoundingClientRect(); hit(Math.min(2, Math.floor((e.clientX - r.left) / lw))); };
    clock(25, () => finish());
  }
  function math() {
    shell('math', '<div id="mg-area" class="mg-quiz"></div>');
    const area = $('#mg-area');
    const ask = () => {
      if (over) return;
      const lvl = Math.min(3, Math.floor(score / 4)), op = ri(lvl >= 2 ? 4 : 3);
      let a = 2 + ri(8 + lvl * 6), b = 2 + ri(8 + lvl * 4), q, ans;
      if (op === 0) { q = `${a} + ${b}`; ans = a + b; } else if (op === 1) { if (b > a) [a, b] = [b, a]; q = `${a} − ${b}`; ans = a - b; }
      else if (op === 2) { a = 2 + ri(9 + lvl); b = 2 + ri(9); q = `${a} × ${b}`; ans = a * b; } else { b = 2 + ri(9); ans = 2 + ri(11); a = ans * b; q = `${a} ÷ ${b}`; }
      const opts = shuffle([...new Set([ans, ans + 1 + ri(3), Math.max(0, ans - 1 - ri(3)), ans + (ri(2) ? 10 : -10)].filter(v => v >= 0))]).slice(0, 4);
      if (!opts.includes(ans)) opts[0] = ans;
      quiz(area, `<div class="mg-eq">${q} = ?</div>`, opts.map(String), opts.indexOf(ans), ok => { if (ok) setScore(score + 1); ask(); });
    };
    clock(25, () => finish());
    ask();
  }
  function hilo() {
    shell('hilo', '<div id="mg-area" class="mg-quiz"></div>');
    const area = $('#mg-area');
    let cur = { sp: H.randomSpecies(), cp: 100 + ri(2400) };
    const ask = () => {
      if (score >= 15) { finish(); return; }
      let nxt; do nxt = { sp: H.randomSpecies(), cp: 100 + ri(2400) }; while (Math.abs(nxt.cp - cur.cp) < 30);
      area.innerHTML = `<div class="mg-q">${img(cur.sp, false, 'mg-big')}<b>${esc(cur.sp.name)}</b><div class="mg-cp">CP ${cur.cp}</div><p>Is the next Regimon’s CP higher or lower?</p></div>
        <div class="mg-opts two"><button class="mg-opt" data-v="1">⬆️ Higher</button><button class="mg-opt" data-v="0">⬇️ Lower</button></div>`;
      area.querySelectorAll('.mg-opt').forEach(b => {
        b.onclick = () => {
          const ok = (+b.dataset.v === 1) === (nxt.cp > cur.cp);
          flash(ok);
          area.querySelector('.mg-q').innerHTML = `${img(nxt.sp, false, 'mg-big')}<b>${esc(nxt.sp.name)}</b><div class="mg-cp">CP ${nxt.cp}</div><p>${ok ? 'Correct!' : 'Nope — streak over!'}</p>`;
          area.querySelector('.mg-opts').innerHTML = '';
          if (ok) setScore(score + 1);
          cur = nxt;
          later(() => (ok ? ask() : finish()), 900);
        };
      });
    };
    ask();
  }
  function shiny() {
    shell('shiny', '<div id="mg-grid" class="mg-grid"></div>');
    const grid = $('#mg-grid');
    let level = 0;
    const deal = () => {
      if (over) return;
      const n = Math.min(6, 3 + Math.floor(level / 2)), sp = H.randomSpecies(), odd = ri(n * n);
      grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      grid.innerHTML = Array.from({ length: n * n }, (_, i) => `<button class="mg-cell" data-odd="${i === odd ? 1 : ''}">${img(sp, i === odd)}</button>`).join('');
      grid.querySelectorAll('.mg-cell').forEach(c => { c.onclick = () => { const ok = !!c.dataset.odd; flash(ok); if (ok) { setScore(score + 1); level++; } deal(); }; });
    };
    clock(25, () => finish());
    deal();
  }
  function mash() {
    const sp = H.randomSpecies();
    shell('mash', `<button class="mg-pad big mash" id="mg-pad">${img(sp)}<b>TAP!</b></button>`);
    const pad = $('#mg-pad');
    let started = false;
    pad.onpointerdown = () => {
      if (!started) { started = true; clock(10, () => finish()); }
      setScore(score + 1); pad.classList.remove('bump'); void pad.offsetWidth; pad.classList.add('bump');
      if (score % 10 === 0) H.sfx('pop');
    };
    $('#mg-time').textContent = '⏱ 10.0';
  }
  function clockGame() {
    shell('clock', '<div class="mg-bigclock" id="mg-clock">0.00</div><button class="mg-throw" id="mg-go">▶ START</button><div class="mg-left" id="mg-left"></div>');
    const face = $('#mg-clock'), btn = $('#mg-go');
    let tries = 0, running = false, t0 = 0;
    $('#mg-left').textContent = 'Try 1 of 5';
    loop(() => {
      if (!running) return;
      const t = (performance.now() - t0) / 1000;
      face.textContent = t < 1 ? t.toFixed(2) : '?.??';
    });
    btn.onclick = () => {
      if (!running) { running = true; t0 = performance.now(); btn.textContent = '⏹ STOP'; face.className = 'mg-bigclock'; return; }
      running = false;
      const t = (performance.now() - t0) / 1000, diff = Math.abs(t - 3), pts = Math.max(0, 10 - Math.round(diff * 20));
      face.textContent = t.toFixed(2); face.className = 'mg-bigclock ' + (pts >= 8 ? 'good' : pts ? 'ok' : 'bad');
      H.sfx(pts >= 8 ? 'excellent' : pts ? 'hit' : 'miss');
      setScore(score + pts); tries++;
      if (tries >= 5) { btn.disabled = true; later(() => finish(), 1000); return; }
      $('#mg-left').textContent = `+${pts} · Try ${tries + 1} of 5`; btn.textContent = '▶ START';
    };
  }
  function flappy() {
    const { cv, g, w, h, pic, draw } = canvasGame('flappy');
    const bird = { y: h / 2, v: 0 }, pipes = [], sp = distinct(1, s => (s.extras || []).some(e => /wings/.test(e)))[0] || H.randomSpecies();
    let t = 0, started = false, dead = false;
    loop(dt => {
      g.fillStyle = '#9fd3ff'; g.fillRect(0, 0, w, h);
      if (started && !dead) {
        t += dt; bird.v += 900 * dt; bird.y += bird.v * dt;
        if (!pipes.length || pipes[pipes.length - 1].x < w - 190) pipes.push({ x: w + 40, gap: rnd(90, h - 160), passed: false });
      }
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i], gh = Math.max(120, 170 - score * 3);
        if (started && !dead) p.x -= (150 + score * 4) * dt;
        g.fillStyle = '#475569'; g.fillRect(p.x, 0, 56, p.gap); g.fillRect(p.x, p.gap + gh, 56, h);
        g.fillStyle = '#fde68a'; for (let wy = 10; wy < p.gap - 10; wy += 22) g.fillRect(p.x + 10, wy, 10, 10), g.fillRect(p.x + 34, wy, 10, 10);
        for (let wy = p.gap + gh + 12; wy < h; wy += 22) g.fillRect(p.x + 10, wy, 10, 10), g.fillRect(p.x + 34, wy, 10, 10);
        if (!dead && p.x < 80 && p.x + 56 > 40 && (bird.y - 16 < p.gap || bird.y + 16 > p.gap + gh)) dead = true;
        if (!p.passed && p.x + 56 < 40) { p.passed = true; setScore(score + 1); H.sfx('pop'); }
        if (p.x < -70) pipes.splice(i, 1);
      }
      if (!dead && (bird.y > h - 10 || bird.y < -40)) dead = true;
      draw(pic(sp), 60, bird.y, 44);
      if (!started) { g.fillStyle = '#1e1b4b'; g.font = '800 20px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText('Tap to fly!', w / 2, h / 2 - 60); }
      if (dead === true) { dead = 'done'; H.sfx('miss'); later(() => finish(), 700); }
    });
    cv.onpointerdown = () => { if (dead) return; started = true; bird.v = -330; H.sfx('throw'); };
  }
  function dodge() {
    const { cv, g, w, h, pic, draw } = canvasGame('dodge');
    const sp = H.randomSpecies(), cars = [];
    let px = w / 2, t = 0, spawnT = 0, dead = false;
    loop(dt => {
      if (!dead) { t += dt; setScore(t); }
      spawnT -= dt;
      if (spawnT <= 0 && !dead) { spawnT = Math.max(0.22, 0.75 - t * 0.02); cars.push({ x: rnd(24, w - 24), y: -40, v: rnd(220, 320) + t * 8 }); }
      g.fillStyle = '#4b5563'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5f5f4'; for (let x = w / 4; x < w; x += w / 4) for (let y = (t * 300) % 40 - 40; y < h; y += 40) g.fillRect(x - 2, y, 4, 20);
      g.font = '40px "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = cars.length - 1; i >= 0; i--) {
        const c = cars[i]; if (!dead) c.y += c.v * dt;
        g.fillText('🚕', c.x, c.y);
        if (!dead && Math.abs(c.x - px) < 34 && Math.abs(c.y - (h - 50)) < 34) { dead = true; H.sfx('superhit'); later(() => finish(), 800); }
        if (c.y > h + 40) cars.splice(i, 1);
      }
      draw(pic(sp), px, h - 50, 52);
      if (t >= 30 && !dead) { dead = true; H.sfx('victory'); later(() => finish(5), 600); }
    });
    const move = e => { const r = cv.getBoundingClientRect(); px = Math.max(26, Math.min(w - 26, e.clientX - r.left)); };
    cv.onpointerdown = move; cv.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') move(e); };
  }
  function scramble() {
    shell('scramble', '<div id="mg-area" class="mg-quiz"></div>');
    const area = $('#mg-area');
    const ask = () => {
      if (over) return;
      const opts = distinct(4, sp => /^[A-Za-z]{5,12}$/.test(sp.name)), right = ri(4), nm = opts[right].name.toUpperCase();
      let mix; do mix = shuffle([...nm]).join(''); while (mix === nm);
      quiz(area, `<div class="mg-scr">${[...mix].map(c => `<span>${c}</span>`).join('')}</div>`, opts.map(s => esc(s.name)), right, ok => { if (ok) setScore(score + 1); ask(); });
    };
    clock(30, () => finish());
    ask();
  }
  function stroop() {
    shell('stroop', '<div id="mg-area" class="mg-quiz"></div>');
    const area = $('#mg-area'), C = { RED: '#ef4444', BLUE: '#3b82f6', GREEN: '#22c55e', YELLOW: '#eab308', PURPLE: '#a855f7' }, names = Object.keys(C);
    const ask = () => {
      if (over) return;
      const word = names[ri(5)], match = Math.random() < 0.5, ink = match ? word : names.filter(n => n !== word)[ri(4)];
      quiz(area, `<div class="mg-word" style="color:${C[ink]}">${word}</div><p>Does the ink color match the word?</p>`, ['✅ Match', '❌ No match'], match ? 0 : 1, ok => { if (ok) setScore(score + 1); ask(); });
    };
    clock(20, () => finish());
    ask();
  }
  const TRIVIA = [
    ['Regis High School is on which street?', 'East 84th Street', 'East 72nd Street', 'East 96th Street', 'East 59th Street'],
    ['Which religious order runs Regis?', 'The Jesuits', 'The Franciscans', 'The Benedictines', 'The Dominicans'],
    ['What is the largest park in Manhattan?', 'Central Park', 'Riverside Park', 'Bryant Park', 'Battery Park'],
    ['Which bridge, opened in 1883, connects Manhattan and Brooklyn?', 'Brooklyn Bridge', 'George Washington Bridge', 'Queensboro Bridge', 'Manhattan Bridge'],
    ['The Statue of Liberty was a gift from which country?', 'France', 'England', 'Italy', 'Spain'],
    ['Which river runs along Manhattan’s west side?', 'The Hudson River', 'The East River', 'The Harlem River', 'The Bronx River'],
    ['Which museum sits on Fifth Avenue at 82nd Street?', 'The Metropolitan Museum of Art', 'The Guggenheim', 'MoMA', 'The Whitney'],
    ['Hoboken is in which state?', 'New Jersey', 'New York', 'Connecticut', 'Pennsylvania'],
    ['The Empire State Building is on which avenue?', 'Fifth Avenue', 'Park Avenue', 'Madison Avenue', 'Lexington Avenue'],
    ['Times Square is where Broadway crosses which avenue?', 'Seventh Avenue', 'Fifth Avenue', 'Park Avenue', 'First Avenue'],
    ['Wall Street is in which borough?', 'Manhattan', 'Brooklyn', 'Queens', 'The Bronx'],
    ['What is the big lake near 90th Street in Central Park called?', 'The Jacqueline Kennedy Onassis Reservoir', 'The Harlem Meer', 'The Pond', 'Turtle Pond'],
    ['The Guggenheim Museum is famous for its…', 'Spiral ramp', 'Glass pyramid', 'Golden dome', 'Twin towers'],
    ['Which station has a ceiling painted with constellations?', 'Grand Central Terminal', 'Penn Station', 'The Oculus', 'Union Square'],
    ['How many boroughs does New York City have?', '5', '4', '6', '3'],
    ['Which island was the country’s busiest immigration station until 1954?', 'Ellis Island', 'Roosevelt Island', 'Governors Island', 'Liberty Island'],
    ['The High Line park was built on an old…', 'Elevated freight railway', 'Highway ramp', 'Subway tunnel', 'Aqueduct'],
    ['What color are NYC’s classic medallion taxis?', 'Yellow', 'Green', 'Black', 'White'],
    ['What is the tallest building in New York City?', 'One World Trade Center', 'Empire State Building', 'Chrysler Building', '30 Rockefeller Plaza'],
    ['PATH trains connect Manhattan with which state?', 'New Jersey', 'Connecticut', 'Pennsylvania', 'Delaware'],
  ];
  function trivia() {
    shell('trivia', '<div id="mg-area" class="mg-quiz"></div><div class="mg-left" id="mg-left"></div>');
    const area = $('#mg-area'), qs = shuffle([...TRIVIA]).slice(0, 8);
    let k = 0;
    const ask = () => {
      if (k >= qs.length) { finish(); return; }
      const [q, ...opts] = qs[k++]; $('#mg-left').textContent = `Question ${k} of 8`;
      const order = shuffle([0, 1, 2, 3]);
      quiz(area, `<p class="mg-tq">${q}</p>`, order.map(i => opts[i]), order.indexOf(0), ok => { if (ok) setScore(score + 2); ask(); });
    };
    ask();
  }
  function stack() {
    const { cv, g, w, h } = canvasGame('stack');
    const floorH = 26, blocks = [{ x: w / 2 - 70, w: 140 }];
    let cur = { x: 0, w: 140, dir: 1 }, speed = 160, cam = 0, done = false;
    const hues = [210, 190, 260, 330, 20, 45, 150];
    loop(dt => {
      if (!done) { cur.x += cur.dir * speed * dt; if (cur.x < 0) { cur.x = 0; cur.dir = 1; } if (cur.x + cur.w > w) { cur.x = w - cur.w; cur.dir = -1; } }
      const targetCam = Math.max(0, blocks.length * floorH - h * 0.55);
      cam += (targetCam - cam) * Math.min(1, dt * 5);
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#1e3a8a'); sky.addColorStop(1, '#93c5fd');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      const yOf = i => h - 20 - (i + 1) * floorH + cam;
      blocks.forEach((b, i) => {
        g.fillStyle = `hsl(${hues[i % hues.length]},60%,${45 + (i % 2) * 8}%)`; g.fillRect(b.x, yOf(i), b.w, floorH - 2);
        g.fillStyle = 'rgba(253,230,138,.8)'; for (let x = b.x + 6; x < b.x + b.w - 8; x += 14) g.fillRect(x, yOf(i) + 7, 7, 9);
      });
      if (!done) { g.fillStyle = `hsl(${hues[blocks.length % hues.length]},70%,55%)`; g.fillRect(cur.x, yOf(blocks.length), cur.w, floorH - 2); }
    });
    cv.onpointerdown = () => {
      if (done) return;
      const top = blocks[blocks.length - 1], l = Math.max(top.x, cur.x), r = Math.min(top.x + top.w, cur.x + cur.w);
      if (r - l < 6) { done = true; H.sfx('miss'); later(() => finish(), 800); return; }
      const perfect = Math.abs(cur.x - top.x) < 5;
      const nb = perfect ? { x: top.x, w: top.w } : { x: l, w: r - l };
      blocks.push(nb); setScore(blocks.length - 1); H.sfx(perfect ? 'excellent' : 'hit');
      cur = { x: Math.random() < 0.5 ? 0 : w - nb.w, w: nb.w, dir: 1 }; if (cur.x > 0) cur.dir = -1;
      speed = Math.min(420, speed + 12);
    };
  }

  const RUN = { whack, memory, toss, quick, typesort, namequiz, oddone, count, simon, balloon, catcher, rhythm, math, hilo, shiny, mash, clock: clockGame, flappy, dodge, scramble, stroop, trivia, stack };
  function play(kind, hooks) {
    H = hooks; score = 0; over = false; timers = []; rafs = [];
    RUN[kind]();
  }
  return { GAMES, play, KINDS: Object.keys(GAMES) };
})();
