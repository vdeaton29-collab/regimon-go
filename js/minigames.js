// Regimon GO — arcade minigames found around the map. Each returns a score; the game turns it into Rare Candy.
window.RGMini = (() => {
  const $ = s => document.querySelector(s);
  const GAMES = {
    whack: { name: 'Pop-Up Regimon', icon: '🔨', how: 'Tap the Regimon as they pop out of the holes! Golden ones are worth 3.' },
    memory: { name: 'Regidex Memory', icon: '🃏', how: 'Flip two cards at a time and find all 8 pairs before time runs out.' },
    toss: { name: 'Bullseye Toss', icon: '🎯', how: 'Press THROW when the Regimon is inside the gold target. 8 throws!' },
  };
  let root = null, timers = [], raf = 0, H = null;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function shell(kind, body) {
    const g = GAMES[kind];
    root = document.createElement('div');
    root.id = 'mg';
    root.innerHTML = `<div class="mg-top"><b>${g.icon} ${g.name}</b><span id="mg-score">0</span><span id="mg-time"></span><button id="mg-quit" aria-label="Quit">✕</button></div>
      <div class="mg-body">${body}</div><div class="mg-how">${g.how}</div>`;
    document.body.appendChild(root);
    $('#mg-quit').onclick = () => finish(0, true);
  }
  function clock(seconds, onEnd) {
    const end = performance.now() + seconds * 1000;
    const tick = () => {
      const left = Math.max(0, (end - performance.now()) / 1000);
      const el = $('#mg-time'); if (el) el.textContent = '⏱ ' + left.toFixed(1);
      if (left <= 0) onEnd(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => Math.max(0, (end - performance.now()) / 1000);
  }
  let score = 0, over = false;
  const setScore = s => { score = s; const el = $('#mg-score'); if (el) el.textContent = '⭐ ' + s; };
  function finish(extra, quit) {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = [];
    if (root) root.remove(); root = null;
    H.done(quit ? null : score + (extra || 0));
  }

  // 1. Whack-a-mole with Regimon
  function whack() {
    shell('whack', `<div class="mg-holes">${Array.from({ length: 9 }, (_, i) => `<button class="mg-hole" data-i="${i}"><img alt=""></button>`).join('')}</div>`);
    const holes = [...root.querySelectorAll('.mg-hole')];
    const pop = () => {
      if (over) return;
      const free = holes.filter(h => !h.classList.contains('up'));
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)], gold = Math.random() < 0.12, sp = H.randomSpecies();
        h.querySelector('img').src = H.art(sp, gold);
        h.dataset.gold = gold ? '1' : '';
        h.classList.add('up'); h.classList.toggle('gold', gold);
        const stay = Math.max(420, 1000 - score * 18);
        later(() => h.classList.remove('up', 'gold'), stay);
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

  // 2. Memory match
  function memory() {
    const picks = [];
    while (picks.length < 8) { const sp = H.randomSpecies(); if (!picks.includes(sp)) picks.push(sp); }
    const cards = shuffle([...picks, ...picks]);
    shell('memory', `<div class="mg-cards">${cards.map((sp, i) => `<button class="mg-card" data-i="${i}"><span class="back">❓</span><img src="${H.art(sp)}" alt=""></button>`).join('')}</div>`);
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

  // 3. Timing toss
  function toss() {
    shell('toss', `<div class="mg-lane"><div class="mg-target"></div><img class="mg-runner" alt=""></div><div class="mg-result" id="mg-res"></div>
      <button class="mg-throw" id="mg-throw">🎯 THROW</button><div class="mg-left" id="mg-left"></div>`);
    const runner = root.querySelector('.mg-runner'), lane = root.querySelector('.mg-lane');
    let throws = 8, t0 = performance.now(), speed = 1.4, paused = false;
    const newRunner = () => { runner.src = H.art(H.randomSpecies()); };
    newRunner();
    $('#mg-left').textContent = `${throws} throws left`;
    let pos = 0;
    const move = now => {
      if (!paused) { const t = (now - t0) / 1000; pos = Math.sin(t * speed * 2.1) * 0.5 + Math.sin(t * speed * 3.3) * 0.12; }
      runner.style.left = `calc(${50 + pos * 80}% - 32px)`;
      raf = requestAnimationFrame(move);
    };
    raf = requestAnimationFrame(move);
    $('#mg-throw').onclick = () => {
      if (paused || over) return;
      paused = true;
      const d = Math.abs(pos * 80) / 100;   // distance from the middle, as a fraction of the lane
      const pts = d < 0.05 ? 3 : d < 0.12 ? 2 : d < 0.2 ? 1 : 0;
      const label = ['Miss…', 'Nice!', 'Great!', 'Excellent!'][pts];
      $('#mg-res').textContent = label; $('#mg-res').className = 'mg-result r' + pts;
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

  function play(kind, hooks) {
    H = hooks; score = 0; over = false; timers = [];
    ({ whack, memory, toss })[kind]();
    setScore(0);
  }
  return { GAMES, play, KINDS: Object.keys(GAMES) };
})();
