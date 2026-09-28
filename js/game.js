// Regimon GO — map, spawns, stops, catching, Regidex.
(() => {
  'use strict';
  const { W, H, AVES, STREETS, STREET_END, RIVER_X, TYPES, RARITY, BALLS, ZONES, ZONE_HINTS, STOPS, ARENAS, TRAINER_NAMES, SPECIES } = window.RG;
  const Art = window.RGArt, Music = window.RGMusic, Battle = window.RGBattle;
  const $ = s => document.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hyp = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const RANGE = 190, SPEED = 220, METERS_PER_PX = 0.4, STOP_COOLDOWN = 120000;
  const BALL_ORDER = ['regi', 'honors', 'magna'];
  const byId = Object.fromEntries(SPECIES.map(s => [s.id, s]));
  Art.preload(SPECIES);

  // ---------------- save ----------------
  const SAVE_KEY = 'regimon-go-v1';
  function freshState() {
    return {
      xp: 0, level: 1, items: { regi: 30, honors: 5, magna: 1, bagel: 5 },
      dex: {}, caught: [], cooldowns: {}, badges: {}, px: 1375, py: 822, intro: false, nextUid: 1,
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = Object.assign(freshState(), JSON.parse(raw));
        s.items = Object.assign(freshState().items, s.items);
        return s;
      }
    } catch (e) { /* storage unavailable */ }
    return freshState();
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  let S = load();
  const dexEntry = id => (S.dex[id] = S.dex[id] || { seen: 0, caught: 0 });
  const xpNeed = lvl => 600 + lvl * 400;

  // ---------------- world ----------------
  const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const REGIS = [1150, 844, 1600, 1300], CHURCH = [1680, 344, 2100, 800];
  const GUGG = [660, 2644, 1100, 3050], ASPHALT = [4100, 2644, 4440, 3300];
  const SUBWAYS = [[2185, 1640], [3185, 1700]];

  function zoneAt(x, y) {
    if (x >= RIVER_X) return 'river';
    if ((x >= 380 && x <= 600 && y >= 60 && y <= 740) || inRect(x, y, GUGG)) return 'museum';
    if (inEll(x, y, 300, 1250, 238, 290) || inEll(x, y, 190, 668, 120, 48)) return 'water';
    if (inRect(x, y, ASPHALT) || inEll(x, y, 300, 2700, 200, 170)) return 'sports';
    if (x < 600 || (x >= STREET_END && y >= 844)) return 'park';
    if (inRect(x, y, REGIS)) return 'school';
    if (inRect(x, y, CHURCH)) return 'church';
    if (SUBWAYS.some(([sx, sy]) => hyp(x, y, sx, sy) < 220)) return 'subway';
    return 'street';
  }
  function zoneLabel(z, x, y) {
    switch (z) {
      case 'water': return y < 900 ? 'Turtle Pond' : 'The Reservoir';
      case 'museum': return y > 2500 ? 'The Guggenheim' : 'The Met';
      case 'park': return x > 4000 ? 'Carl Schurz Park' : 'Central Park';
      case 'sports': return x > 4000 ? 'Asphalt Green' : 'Central Park Ballfields';
      case 'subway': return x > 2600 ? '86th St · Q train' : '86th St · 4 5 6';
      case 'street': return x > 2630 ? 'Yorkville' : 'Upper East Side';
      default: return ZONES[z];
    }
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // Rows of blocks between cross streets, and columns between avenues.
  const YS = [[0, STREETS[0][0]]];
  for (let i = 0; i < STREETS.length; i++) YS.push([STREETS[i][1], i + 1 < STREETS.length ? STREETS[i + 1][0] : H]);
  const XS = [];
  for (let i = 0; i + 1 < AVES.length; i++) XS.push([AVES[i][1], AVES[i + 1][0]]);
  const streetEnd = y0 => (y0 < 844 ? RIVER_X : STREET_END);

  // Draws the entire static map. Called once per tile (with a translate) and once for the overview map,
  // so it must be deterministic: same seed, same drawing order every time.
  function drawWorld(g) {
    const R = mulberry32(1914);
    const ell = (x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
    const label = (txt, x, y, size, color, bg) => {
      g.font = `700 ${size}px "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (bg) { const w = g.measureText(txt).width + size; g.fillStyle = bg; rr(g, x - w / 2, y - size * 0.8, w, size * 1.6, size * 0.8); g.fill(); }
      g.fillStyle = color; g.fillText(txt, x, y);
    };
    const tree = (x, y, r) => {
      ell(x + 3, y + 4, r, r * 0.8, 'rgba(0,0,0,.15)');
      ell(x, y, r, r, R() < 0.5 ? '#3f8f3a' : '#4d9e44');
      ell(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.45, 'rgba(255,255,255,.12)');
    };
    const awning = (x, y, n, a, b) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(x + i * 11, y, 11, 14); } };

    g.fillStyle = '#cfc8b8'; g.fillRect(0, 0, W, H);

    // ---- Central Park ----
    g.fillStyle = '#78bb5e'; g.fillRect(0, 0, 600, H);
    for (let i = 0; i < 4600; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,70,0,.07)';
      g.fillRect(R() * 600, R() * H, 4, 4);
    }
    ell(250, 450, 175, 125, '#93d077');
    g.strokeStyle = '#e8dcbc'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.ellipse(250, 450, 200, 148, 0, 0, Math.PI * 2); g.stroke();
    const path = pts => {
      g.beginPath(); g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 4) g.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
      g.stroke();
    };
    path([70, 0, 20, 150, 60, 300, 90, 600, 40, 760, 10, 900, 60, 1000]);
    path([600, 760, 450, 790, 300, 770, 150, 750, 60, 1000]);
    path([600, 1560, 420, 1560, 300, 1580, 150, 1600, 0, 1700]);
    path([450, 300, 400, 250, 420, 200]);
    path([60, 1000, 20, 1300, 40, 1600, 60, 1900, 30, 2200, 10, 2500, 60, 2800, 100, 3100, 60, 3300]);
    path([600, 2060, 450, 2080, 300, 2100, 150, 2150, 30, 2200]);
    path([600, 3070, 500, 3000, 420, 2900, 360, 2860, 300, 2870]);
    // Reservoir + running track
    ell(300, 1250, 238, 290, '#d8c7a0');
    ell(300, 1250, 222, 274, '#4f9fd8');
    ell(300, 1250, 200, 250, '#5aaae0');
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = 120 + R() * 360, y = 1010 + R() * 480;
      if (inEll(x, y, 300, 1250, 200, 245)) { g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x, y - 5, x + 10, y); g.stroke(); }
    }
    label('Jacqueline Kennedy Onassis Reservoir', 300, 1250, 14, 'rgba(255,255,255,.85)');
    label('Great Lawn', 250, 450, 16, 'rgba(40,90,30,.7)');
    // Turtle Pond + Belvedere Castle
    ell(190, 668, 128, 54, '#6aa653');
    ell(190, 668, 120, 48, '#4f9fd8');
    ell(170, 660, 70, 22, 'rgba(255,255,255,.12)');
    for (const [x, y] of [[90, 690], [110, 640], [280, 700], [250, 630]]) ell(x, y, 7, 5, '#3d8a3a');
    label('Turtle Pond', 190, 700, 12, 'rgba(255,255,255,.85)');
    g.fillStyle = '#8b8d93'; g.fillRect(312, 590, 46, 34);
    g.fillStyle = '#a4a7ae'; g.fillRect(316, 594, 38, 26);
    g.fillStyle = '#7a7c82'; g.fillRect(340, 572, 18, 24);
    for (let x = 312; x < 358; x += 9) g.fillRect(x, 586, 5, 5);
    g.fillStyle = '#c62828'; g.fillRect(348, 560, 2, 12); g.fillRect(350, 560, 7, 5);
    // Ballfields
    ell(300, 2700, 205, 172, '#8fce74');
    for (const [bx, by] of [[210, 2620], [390, 2620], [300, 2790]]) {
      g.fillStyle = '#d9b27c';
      g.beginPath(); g.moveTo(bx, by - 42); g.lineTo(bx + 42, by); g.lineTo(bx, by + 42); g.lineTo(bx - 42, by); g.closePath(); g.fill();
      ell(bx, by, 22, 22, '#8fce74');
      g.fillStyle = '#fff'; for (const [dx, dy] of [[0, -42], [42, 0], [0, 42], [-42, 0]]) g.fillRect(bx + dx - 3, by + dy - 3, 6, 6);
    }
    label('Ballfields', 300, 2870, 14, 'rgba(40,90,30,.75)');
    for (let i = 0; i < 850; i++) {
      const x = 10 + R() * 575, y = R() * H;
      if (inEll(x, y, 300, 1250, 252, 305) || inEll(x, y, 190, 668, 140, 64) || inEll(x, y, 250, 450, 215, 162)) continue;
      if (inEll(x, y, 300, 2700, 222, 190)) continue;
      if (x > 300 && x < 370 && y > 550 && y < 640) continue;
      if (x > 360 && y > 45 && y < 755) continue;
      tree(x, y, 9 + R() * 9);
    }

    // ---- The Met ----
    g.fillStyle = '#b9ad92'; g.fillRect(385, 65, 210, 670);
    g.fillStyle = '#ece3cc'; g.fillRect(392, 72, 196, 656);
    g.fillStyle = '#e3d8bd';
    for (let y = 240; y < 720; y += 60) for (let x = 402; x < 580; x += 60) g.fillRect(x, y, 48, 48);
    g.fillStyle = '#bfe3f0'; g.fillRect(392, 72, 196, 150);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
    for (let x = 392; x < 588; x += 14) { g.beginPath(); g.moveTo(x, 72); g.lineTo(x, 222); g.stroke(); }
    g.fillStyle = '#d9c08a'; g.fillRect(455, 118, 70, 46);
    g.fillStyle = '#b89a5c'; g.fillRect(455, 118, 70, 8);
    g.fillStyle = '#7ec0dc'; g.fillRect(430, 176, 120, 20);
    g.fillStyle = '#fff';
    for (let y = 335; y < 510; y += 20) g.fillRect(572, y, 12, 12);
    g.fillStyle = '#e7e2d6'; g.fillRect(595, 330, 5, 190);
    label('THE MET', 490, 330, 28, '#6b5b3a');
    label('Temple of Dendur', 490, 100, 13, '#2f5566', 'rgba(255,255,255,.7)');

    // ---- city blocks ----
    const BROWN = ['#b07a62', '#9c6b58', '#c4ab8c', '#a8927a', '#8f7d6d', '#c98f6f', '#b9a58a', '#a3765f', '#b5b0a6', '#9aa0a8'];
    const special = (x0, y0) => (x0 === 1150 && y0 === 844) || (x0 === 1680 && y0 === 344) || (x0 === 1680 && y0 === 0) ||
      (x0 === 660 && y0 === 2644) || (x0 === 4100 && y0 >= 2644);
    const cols = [...XS, [STREET_END, RIVER_X]];
    for (const [x0, x1] of cols) for (const [y0, y1] of YS) {
      if (x0 === STREET_END && y0 >= 844) continue; // Carl Schurz Park
      g.fillStyle = '#d7d0c1'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = '#bdb5a4'; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
      if (special(x0, y0)) continue;
      const ix0 = x0 + 14, ix1 = x1 - 14, iy0 = y0 + 14, iy1 = y1 - 14, mid = (iy0 + iy1) / 2;
      for (const [ra, rb] of [[iy0, mid], [mid, iy1]]) {
        let x = ix0;
        while (x < ix1 - 10) {
          const w = Math.min(ix1 - x, 50 + R() * 80);
          g.fillStyle = BROWN[Math.floor(R() * BROWN.length)]; g.fillRect(x, ra, w - 2, rb - ra - 2);
          g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x + 5, ra + 5, w - 12, rb - ra - 12);
          g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + w / 2 - 6, ra + (rb - ra) / 2 - 6, 12, 12);
          x += w;
        }
      }
      for (let x = x0 + 30; x < x1 - 20; x += 74) { tree(x, y0 + 8, 7); if (y1 < H) tree(x + 20, y1 - 8, 7); }
    }

    // ---- Regis High School ----
    g.fillStyle = '#a79d86'; g.fillRect(1164, 858, 422, 428);
    g.fillStyle = '#e6dfcd'; g.fillRect(1170, 864, 410, 416);
    g.fillStyle = '#d6cdb6'; g.fillRect(1190, 1110, 370, 150);
    g.fillStyle = 'rgba(60,80,120,.3)';
    for (let x = 1188; x < 1566; x += 26) for (let y = 928; y < 1086; y += 22) g.fillRect(x, y, 13, 8);
    g.fillStyle = '#f7f3e8'; g.fillRect(1170, 864, 410, 42);
    g.fillStyle = '#c9bfa8';
    for (let x = 1190; x < 1570; x += 28) g.fillRect(x, 868, 10, 34);
    g.fillStyle = '#14204a'; g.fillRect(1170, 906, 410, 4);
    label('👑 REGIS HIGH SCHOOL', 1375, 985, 27, '#14204a', 'rgba(255,253,247,.85)');
    label('A.M.D.G.  •  est. 1914', 1375, 1026, 14, '#6b5b3a');
    label('Library', 1235, 1100, 12, '#6b5b3a');
    label('Cafeteria', 1515, 1190, 12, '#6b5b3a');
    label('Gym', 1260, 1265, 12, '#6b5b3a');

    // ---- Church of St. Ignatius Loyola ----
    g.fillStyle = '#e2dccd'; g.fillRect(1694, 358, 392, 428);
    g.fillStyle = '#a2d58a'; g.fillRect(1700, 364, 380, 60); g.fillRect(1700, 720, 380, 60);
    g.fillStyle = '#9d937f'; g.fillRect(1716, 480, 330, 170);
    g.fillStyle = '#b8ad97'; g.fillRect(1722, 486, 318, 158);
    g.fillStyle = '#9d937f'; g.fillRect(1900, 420, 90, 290);
    g.fillStyle = '#b8ad97'; g.fillRect(1906, 426, 78, 278);
    ell(1945, 565, 44, 44, '#7d8ea3'); ell(1945, 565, 30, 30, '#98a9bd');
    g.fillStyle = '#8a806d'; g.fillRect(1700, 450, 44, 44); g.fillRect(1700, 632, 44, 44);
    g.fillStyle = '#f2c14e'; g.fillRect(1941, 540, 8, 50); g.fillRect(1929, 552, 32, 8);
    label('St. Ignatius Loyola', 1830, 780, 15, '#3b2f5c');

    // ---- Loyola School ----
    g.fillStyle = '#9c8b78'; g.fillRect(1694, 14, 392, 272);
    g.fillStyle = '#c9b89f'; g.fillRect(1700, 20, 380, 260);
    g.fillStyle = 'rgba(60,80,120,.28)';
    for (let x = 1716; x < 2070; x += 24) for (let y = 40; y < 250; y += 24) g.fillRect(x, y, 12, 8);
    label('Loyola School', 1890, 210, 15, '#3b2f5c', 'rgba(255,253,247,.8)');

    // ---- Neue Galerie ----
    g.fillStyle = '#e8e2d4'; g.fillRect(674, 1714, 150, 120);
    g.fillStyle = '#d4ccba'; for (let x = 684; x < 816; x += 22) g.fillRect(x, 1724, 12, 100);
    label('Neue Galerie', 750, 1850, 12, '#6b5b3a', 'rgba(255,253,247,.8)');

    // ---- The Guggenheim ----
    g.fillStyle = '#e9e6dd'; g.fillRect(674, 2658, 412, 378);
    for (let r = 150; r > 20; r -= 26) ell(860, 2840, r, r * 0.92, r % 52 === 20 ? '#f7f5ef' : '#e2ded2');
    g.strokeStyle = '#c9c3b3'; g.lineWidth = 3;
    g.beginPath();
    for (let a = 0; a < Math.PI * 8; a += 0.1) { const r = 18 + a * 5.2; g.lineTo(860 + Math.cos(a) * r, 2840 + Math.sin(a) * r * 0.92); }
    g.stroke();
    g.fillStyle = '#d8d2c2'; g.fillRect(1000, 2680, 70, 330);
    label('GUGGENHEIM', 880, 3010, 18, '#5b5346', 'rgba(255,253,247,.85)');

    // ---- Asphalt Green ----
    g.fillStyle = '#2f8f4e'; g.fillRect(4114, 2658, 312, 378);
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3;
    g.strokeRect(4134, 2678, 272, 338);
    g.beginPath(); g.moveTo(4134, 2847); g.lineTo(4406, 2847); g.stroke();
    g.beginPath(); g.arc(4270, 2847, 40, 0, 7); g.stroke();
    g.fillStyle = '#c96f4a'; g.fillRect(4114, 3108, 312, 178);
    g.fillStyle = '#5ab2e8'; g.fillRect(4140, 3130, 260, 130);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
    for (let y = 3150; y < 3260; y += 20) { g.beginPath(); g.moveTo(4145, y); g.lineTo(4395, y); g.stroke(); }
    label('ASPHALT GREEN', 4270, 2700, 15, '#fff', 'rgba(20,60,30,.6)');

    // ---- Carl Schurz Park + Gracie Mansion ----
    g.fillStyle = '#78bb5e'; g.fillRect(STREET_END, 844, RIVER_X - STREET_END, H - 844);
    for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,70,0,.07)'; g.fillRect(STREET_END + R() * 310, 844 + R() * (H - 844), 4, 4); }
    g.fillStyle = '#e2d6b4'; g.fillRect(4740, 844, 60, H - 844);
    g.fillStyle = '#6b6f78'; g.fillRect(4796, 844, 4, H - 844);
    g.strokeStyle = '#e8dcbc'; g.lineWidth = 10;
    path([4500, 1000, 4600, 1300, 4560, 1600, 4520, 1900, 4600, 2200, 4680, 2500, 4620, 2640]);
    g.fillStyle = '#c9b88f'; g.fillRect(4555, 1100, 90, 90); g.fillStyle = '#b7a67c'; g.fillRect(4560, 1105, 80, 80);
    label('Dog Run', 4600, 1205, 11, '#5b5346');
    g.fillStyle = '#e8d38a'; g.fillRect(4575, 2640, 130, 100);
    g.fillStyle = '#f7f3e8'; g.fillRect(4575, 2640, 130, 10); g.fillRect(4575, 2730, 130, 10);
    g.fillStyle = '#2b4a2f'; for (let x = 4585; x < 4700; x += 16) g.fillRect(x, 2665, 8, 12);
    label('Gracie Mansion', 4640, 2765, 12, '#5b5346', 'rgba(255,253,247,.8)');
    for (let i = 0; i < 170; i++) {
      const x = STREET_END + 12 + R() * 240, y = 860 + R() * (H - 870);
      if (x > 4550 && x < 4720 && y > 2620 && y < 2860) continue;
      if (x > 4540 && x < 4660 && y > 1090 && y < 1220) continue;
      tree(x, y, 9 + R() * 8);
    }
    label('Carl Schurz Park', 4620, 900, 15, 'rgba(30,70,25,.75)');

    // ---- East River ----
    const rg = g.createLinearGradient(RIVER_X, 0, W, 0);
    rg.addColorStop(0, '#3f8fcf'); rg.addColorStop(1, '#2a6fa8');
    g.fillStyle = rg; g.fillRect(RIVER_X, 0, W - RIVER_X, H);
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2;
    for (let i = 0; i < 120; i++) {
      const x = RIVER_X + 10 + R() * (W - RIVER_X - 20), y = R() * H;
      g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x, y - 5, x + 12, y); g.stroke();
    }
    g.fillStyle = '#8d5a3b'; g.fillRect(4870, 1880, 46, 22); g.fillStyle = '#e8e2d4'; g.fillRect(4880, 1872, 18, 10);
    g.fillStyle = '#c62828'; g.fillRect(4903, 1866, 6, 12);
    g.save(); g.translate(4900, 1400); g.rotate(-Math.PI / 2);
    label('EAST RIVER', 0, 0, 22, 'rgba(255,255,255,.6)');
    g.restore();
    g.save(); g.translate(4900, 3050); g.rotate(-Math.PI / 2);
    label('HELL GATE', 0, 0, 16, 'rgba(255,255,255,.55)');
    g.restore();

    // ---- roads ----
    g.fillStyle = '#50535e';
    for (const [a, b] of AVES) g.fillRect(a, 0, b - a, H);
    for (const [a, b] of STREETS) g.fillRect(600, a, streetEnd(a) - 600, b - a);
    g.setLineDash([18, 16]); g.lineWidth = 2;
    for (const [a, b] of AVES) {
      if (a === 1600) continue;
      g.strokeStyle = '#e8c547'; g.beginPath(); g.moveTo((a + b) / 2, 0); g.lineTo((a + b) / 2, H); g.stroke();
    }
    for (const [a, b] of STREETS) {
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(660, (a + b) / 2); g.lineTo(streetEnd(a), (a + b) / 2); g.stroke();
    }
    g.setLineDash([]);
    const TUL = ['#e63946', '#f4a261', '#f7d046', '#e76f9d'];
    for (const [y0, y1] of YS) {
      g.fillStyle = '#6fae55'; g.fillRect(1630, y0 + 4, 20, y1 - y0 - 8);
      for (let y = y0 + 9; y < y1 - 6; y += 8) {
        g.fillStyle = TUL[Math.floor(R() * 4)]; g.beginPath(); g.arc(1634 + R() * 12, y, 2.6, 0, 7); g.fill();
      }
    }
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (const [va, vb] of AVES) for (const [ha, hb] of STREETS) {
      if (va >= streetEnd(ha)) continue;
      for (let x = va + 4; x < vb - 4; x += 9) { g.fillRect(x, ha - 13, 5, 10); g.fillRect(x, hb + 3, 5, 10); }
      for (let y = ha + 4; y < hb - 4; y += 9) { if (va !== 600) g.fillRect(va - 13, y, 10, 5); if (vb < streetEnd(ha)) g.fillRect(vb + 3, y, 10, 5); }
    }
    g.font = '700 13px "Trebuchet MS", sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [a, b, n] of AVES) for (const [y0, y1] of YS) {
      g.save(); g.translate(a === 1600 ? 1615 : (a + b) / 2 - 12, (y0 + y1) / 2); g.rotate(-Math.PI / 2); g.fillText(n.toUpperCase(), 0, 0); g.restore();
    }
    for (const [a, b, n] of STREETS) for (const [x0, x1] of XS) g.fillText(n.toUpperCase(), (x0 + x1) / 2, (a + b) / 2 - 11);

    // ---- subway entrances and storefronts ----
    const subway = (x, y, txt) => {
      g.fillStyle = '#2e5e34'; g.fillRect(x - 22, y - 27, 44, 36);
      g.strokeStyle = '#cfd8cf'; g.lineWidth = 2;
      for (let yy = y - 21; yy < y + 7; yy += 6) { g.beginPath(); g.moveTo(x - 17, yy); g.lineTo(x + 17, yy); g.stroke(); }
      ell(x - 25, y - 29, 6, 6, '#7ee081'); ell(x + 25, y - 29, 6, 6, '#7ee081');
      label(txt, x, y - 49, 13, '#fff', '#1b5e20');
    };
    subway(2185, 1615, '86 St  4 5 6');
    subway(3185, 1745, '86 St  Q');
    awning(2168, 972, 8, '#fff', '#c62828'); label('DELI', 2215, 1025, 13, '#fff', '#c62828');
    awning(1030, 544, 6, '#f5efe0', '#2e7d4f'); label('CAFÉ', 1063, 590, 12, '#fff', '#2e7d4f');
    awning(3355, 2200, 8, '#fff', '#1d4ed8'); label('BAKERY', 3400, 2250, 12, '#fff', '#1d4ed8');
    awning(3670, 972, 5, '#fff', '#b91c1c'); label('DINER', 3698, 1025, 12, '#fff', '#b91c1c');
    for (const x of [2190, 2290, 2410, 2520]) awning(x, 1706, 5, '#fff', ['#7c3aed', '#db2777', '#0f766e', '#ea580c'][(x / 10) % 4 | 0]);
  }

  // The map is drawn lazily in 1024px tiles so phones never hold one giant canvas.
  const TILE = 1024, tiles = new Map();
  function getTile(tx, ty) {
    const key = tx + ',' + ty;
    let cv = tiles.get(key);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = TILE; cv.height = TILE;
      const g = cv.getContext('2d');
      g.translate(-tx * TILE, -ty * TILE);
      drawWorld(g);
      tiles.set(key, cv);
    }
    return cv;
  }
  const OV = 0.1;
  let overview = null;
  function getOverview() {
    if (!overview) {
      overview = document.createElement('canvas');
      overview.width = Math.ceil(W * OV); overview.height = Math.ceil(H * OV);
      const g = overview.getContext('2d'); g.scale(OV, OV); drawWorld(g);
    }
    return overview;
  }

  // ---------------- canvas / sizing ----------------
  const mapCv = $('#map'), ctx = mapCv.getContext('2d');
  const cc = $('#catch-canvas'), cctx = cc.getContext('2d');
  let dpr = 1, zoom = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    mapCv.width = innerWidth * dpr; mapCv.height = innerHeight * dpr;
    cc.width = innerWidth * dpr; cc.height = innerHeight * dpr;
    zoom = clamp(Math.min(innerWidth, innerHeight) / 620, 0.72, 1.5);
    if (C) { C.L = catchLayout(); C.bg = buildCatchBG(C.spawn.zone, C.L); }
  }
  addEventListener('resize', resize);

  // ---------------- game state ----------------
  const P = { x: S.px, y: S.py, dir: -Math.PI / 2, face: 1, moving: false, walkT: 0, puffT: 0 };
  let mode = 'map', modalOpen = false;
  let spawns = [], floaters = [], puffs = [], target = null, holding = false;
  let zone = null, zoneName = '', spawnTimer = 0, nearbyTimer = 0, saveTimer = 0;
  let npcs = [], npcTimer = 3;
  let C = null;
  const keys = {};

  function pickSpecies(z) {
    let total = 0;
    const w = SPECIES.map(sp => {
      let v = RARITY[sp.rarity].w;
      const home = sp.habitat.includes(z) || sp.habitat.includes('any');
      if (!home) v = sp.rarity >= 4 ? 0 : v * 0.06;
      total += v;
      return v;
    });
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return SPECIES[i]; }
    return SPECIES[0];
  }
  const rollCP = sp => Math.round((80 + sp.rarity * 110 + Math.random() * 180) * (0.7 + S.level * 0.06));

  function addSpawn(minR = 170, maxR = 640) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(minR, maxR);
      const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
      if (x < 30 || y < 30 || x > W - 30 || y > H - 30) continue;
      if (spawns.some(s => hyp(s.x, s.y, x, y) < 60)) continue;
      const z = zoneAt(x, y), sp = pickSpecies(z);
      spawns.push({ sp, x, y, zone: z, phase: Math.random() * 6, born: performance.now(), expires: Date.now() + rnd(70, 150) * 1000, cp: rollCP(sp) });
      return;
    }
  }

  // ---------------- HUD ----------------
  function updateHUD() {
    $('#lvl').textContent = `Lv ${S.level}`;
    $('#xpfill').style.width = `${(S.xp / xpNeed(S.level)) * 100}%`;
    $('#ball-chip').innerHTML = BALL_ORDER.filter(k => S.items[k] > 0 || k === 'regi')
      .map(k => `<span title="${BALLS[k].name}"><i class="ball-ico ${k}"></i>${S.items[k]}</span>`).join('');
  }
  let toastTimer;
  function toast(msg, ms = 2200) {
    const el = $('#toast'); el.innerHTML = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  let bannerTimer;
  function banner(big, small) {
    const el = $('#banner'); el.innerHTML = `${big}<small>${small || ''}</small>`; el.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function addXP(n) {
    S.xp += n;
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level); S.level++;
      const gift = { regi: 10, honors: S.level >= 3 ? 3 : 1, magna: S.level >= 6 ? 2 : 0, bagel: 3 };
      for (const k in gift) S.items[k] += gift[k];
      setTimeout(() => Music.sfx('levelup'), 300);
      setTimeout(() => banner(`LEVEL ${S.level}!`, `+${gift.regi} Regi Balls · +${gift.honors} Honors Balls${gift.magna ? ` · +${gift.magna} Magna Cum Balls` : ''} · +${gift.bagel} Bagels`), 300);
    }
    updateHUD();
  }
  function renderNearby() {
    const list = spawns.map(s => ({ s, d: hyp(s.x, s.y, P.x, P.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    $('#nearby-list').innerHTML = list.map(({ s, d }) => {
      const e = dexEntry(s.sp.id), cls = e.caught ? '' : e.seen ? 'seen' : 'sil';
      return `<div class="nb"><img class="${cls}" src="${Art.url(s.sp)}" alt="">${Math.round(d * METERS_PER_PX)}m</div>`;
    }).join('') || '<div class="nb" style="padding:6px">…</div>';
  }

  // ---------------- map input ----------------
  function screenToWorld(sx, sy) {
    return { x: P.x + (sx - innerWidth / 2) / zoom, y: P.y + (sy - innerHeight / 2) / zoom };
  }
  mapCv.addEventListener('pointerdown', e => {
    if (mode !== 'map' || modalOpen) return;
    const w = screenToWorld(e.clientX, e.clientY);
    let best = null, bd = 42;
    for (const s of spawns) { const d = hyp(w.x, w.y, s.x, s.y - 24); if (d < bd) { bd = d; best = s; } }
    if (best) {
      if (hyp(P.x, P.y, best.x, best.y) <= RANGE) openCatch(best);
      else toast('Too far away — walk closer! 🚶');
      return;
    }
    for (const n of npcs) {
      if (hyp(w.x, w.y, n.x, n.y - 25) < 30) {
        if (hyp(P.x, P.y, n.x, n.y) <= RANGE) challengeNPC(n);
        else toast(`🎒 <b>${n.name}</b> wants to battle!<br>Walk closer to challenge them.`);
        return;
      }
    }
    for (const a of ARENAS) {
      if (hyp(w.x, w.y, a.x, a.y - 40) < 40) {
        if (hyp(P.x, P.y, a.x, a.y) <= RANGE) challengeArena(a);
        else toast(`⚔️ <b>${a.name}</b><br>Leader: ${a.leader}. Walk closer to battle.`);
        return;
      }
    }
    for (const st of STOPS) {
      if (hyp(w.x, w.y, st.x, st.y - 38) < 34) { tapStop(st); return; }
    }
    target = w; holding = true;
    try { mapCv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  mapCv.addEventListener('pointermove', e => { if (holding) target = screenToWorld(e.clientX, e.clientY); });
  const release = () => { holding = false; };
  mapCv.addEventListener('pointerup', release);
  mapCv.addEventListener('pointercancel', release);
  addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') { if (modalOpen) closeModal(); else if (C && C.state === 'idle') closeCatch(false); }
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function tapStop(st) {
    const d = hyp(P.x, P.y, st.x, st.y);
    if (d > RANGE) { toast(`${st.icon} <b>${st.name}</b><br>Walk closer to spin it.`); return; }
    const cd = (S.cooldowns[st.id] || 0) - Date.now();
    if (cd > 0) { toast(`${st.icon} <b>${st.name}</b> is recharging (${Math.ceil(cd / 1000)}s)`); return; }
    const n = 3 + Math.floor(Math.random() * 3), got = {};
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const k = r < 0.14 ? 'bagel' : r < 0.14 + (S.level >= 5 ? 0.08 : 0.03) ? 'magna' : r < 0.42 ? 'honors' : 'regi';
      got[k] = (got[k] || 0) + 1;
    }
    const names = { regi: 'Regi Ball', honors: 'Honors Ball', magna: 'Magna Cum Ball', bagel: 'Bagel' };
    let i = 0;
    for (const k in got) {
      S.items[k] += got[k];
      floaters.push({ text: `+${got[k]} ${names[k]}${got[k] > 1 ? 's' : ''}`, x: st.x, y: st.y - 60 - i * 22, t: 0 });
      i++;
    }
    S.cooldowns[st.id] = Date.now() + STOP_COOLDOWN;
    Music.sfx('spin');
    addXP(50);
    toast(`${st.icon} <b>${st.name}</b><br>${st.blurb}`, 3400);
    save();
  }

  // ---------------- map update + draw ----------------
  function update(dt) {
    let mx = 0, my = 0;
    if (keys.arrowleft || keys.a) mx -= 1;
    if (keys.arrowright || keys.d) mx += 1;
    if (keys.arrowup || keys.w) my -= 1;
    if (keys.arrowdown || keys.s) my += 1;
    let step = SPEED * dt;
    if (mx || my) target = null;
    else if (target) {
      const dx = target.x - P.x, dy = target.y - P.y, d = Math.hypot(dx, dy);
      if (d < 3) { if (!holding) target = null; } else { mx = dx; my = dy; step = Math.min(step, d); }
    }
    const m = Math.hypot(mx, my);
    if (m > 0) {
      P.x = clamp(P.x + (mx / m) * step, 20, W - 20);
      P.y = clamp(P.y + (my / m) * step, 20, H - 20);
      P.dir = Math.atan2(my, mx); P.moving = true; P.walkT += dt;
      if (Math.abs(mx / m) > 0.2) P.face = mx > 0 ? 1 : -1;
      P.puffT -= dt;
      if (P.puffT <= 0) { P.puffT = 0.12; puffs.push({ x: P.x - (mx / m) * 8 + rnd(-3, 3), y: P.y + rnd(-1, 2), t: 0 }); }
    } else { P.moving = false; P.walkT = 0; }
    for (const p of puffs) p.t += dt;
    puffs = puffs.filter(p => p.t < 0.5);

    const z = zoneAt(P.x, P.y);
    if (z !== zone) {
      const first = zone === null;
      zone = z;
      zoneName = zoneLabel(z, P.x, P.y);
      if (!first) toast(`📍 <b>${zoneName}</b><br>${ZONE_HINTS[z]}`);
    }
    // the label can change inside one zone (e.g. Upper East Side → Yorkville)
    const label = zoneLabel(z, P.x, P.y);
    if (label !== zoneName || $('#zone-chip').dataset.l !== label) { zoneName = label; $('#zone-chip').textContent = `📍 ${label}`; $('#zone-chip').dataset.l = label; }
    updateNPCs(dt);

    const now = Date.now();
    spawns = spawns.filter(s => s.expires > now && hyp(s.x, s.y, P.x, P.y) < 1100);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = rnd(1.2, 2.8); if (spawns.length < 11) addSpawn(); }
    for (const f of floaters) f.t += dt;
    floaters = floaters.filter(f => f.t < 1.8);
    nearbyTimer -= dt;
    if (nearbyTimer <= 0) { nearbyTimer = 0.5; renderNearby(); }
    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 3; S.px = P.x; S.py = P.y; save(); }
  }

  function drawStop(st, t) {
    const cd = (S.cooldowns[st.id] || 0) > Date.now();
    const inR = hyp(P.x, P.y, st.x, st.y) <= RANGE;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(st.x, st.y, 13, 5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5d6a80'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.x, st.y - 26); ctx.stroke();
    const cy = st.y - 40 + Math.sin(t / 400 + st.x) * 2;
    if (inR && !cd) {
      const p = (t / 1000) % 1;
      ctx.strokeStyle = `rgba(47,157,244,${0.6 * (1 - p)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(st.x, cy, 16 + p * 16, 0, 7); ctx.stroke();
    }
    ctx.save(); ctx.translate(st.x, cy);
    ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(t / 600 + st.y)), 1);
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(14, 0); ctx.lineTo(0, 17); ctx.lineTo(-14, 0); ctx.closePath();
    ctx.fillStyle = cd ? '#b36bd9' : '#2f9df4'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
    ctx.font = '13px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st.icon, st.x, cy + 1);
  }

  function drawSpawn(s, t) {
    const img = Art.img(s.sp);
    const appear = clamp((t - s.born) / 400, 0.01, 1);
    const left = s.expires - Date.now();
    const size = 74 * appear, bob = Math.sin(t / 300 + s.phase) * 3;
    ctx.globalAlpha = left < 5000 ? 0.4 + 0.6 * Math.abs(Math.sin(t / 150)) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 17 * appear, 6 * appear, 0, 0, 7); ctx.fill();
    if (s.sp.rarity >= 4) {
      const gr = ctx.createRadialGradient(s.x, s.y - 26, 4, s.x, s.y - 26, 44);
      gr.addColorStop(0, s.sp.rarity === 5 ? 'rgba(242,193,78,.75)' : 'rgba(160,180,255,.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y - 26, 44, 0, 7); ctx.fill();
    }
    if (img.complete && size > 1) ctx.drawImage(img, s.x - size / 2, s.y - size + 6 + bob, size, size);
    ctx.globalAlpha = 1;
  }

  // Two-segment limb in the player's local (facing-right) space. Angles are from straight down; positive swings forward.
  function limb(x, y, a1, l1, a2, l2, w, col) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const fx = kx + Math.sin(a2) * l2, fy = ky + Math.cos(a2) * l2;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    return [fx, fy];
  }

  const PLAYER_LOOK = { blazer: '#1f3a93', arm: '#2447ad', armBack: '#152b6e', pack: '#8c1d2f', hair: '#3a2a1f', skin: '#f0c8a0', tie: '#f2c14e' };

  // Draws a running/idle person. `o` needs x, y, face, moving, walkT.
  function drawPerson(o, look, t) {
    const { x, y } = o, run = o.moving;
    const ph = o.walkT * 13;                 // run-cycle phase
    const s = Math.sin(ph);
    const bob = run ? -Math.abs(Math.cos(ph)) * 3.5 : Math.sin(t / 450 + x) * 0.8;
    const lean = run ? 0.17 : 0;

    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(x, y, run ? 12 + Math.abs(Math.cos(ph)) * 3 : 14, 5.5, 0, 0, 7); ctx.fill();

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(o.face, 1);
    const hipY = -15;
    // leg angles: thigh swings with the cycle; the knee folds when the leg is behind
    const leg = k => {
      const th = run ? k * 0.85 : 0.08 * Math.sign(k);
      const bend = run ? 0.15 + Math.max(0, -k) * 1.5 : 0;
      return [th, th - bend];
    };
    const [a1, a2] = leg(s), [b1, b2] = leg(-s);
    const arm = k => (run ? [-k * 1.0, -k * 1.0 + 1.5] : [0.08 * k, 0.2 * k]);
    const [ua, fa] = arm(s), [ub, fb] = arm(-s);

    ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
    limb(-1, -28, ub, 6.5, fb, 6, 4.5, look.armBack);
    ctx.restore();

    const bf = limb(-1, hipY, b1, 8, b2, 8, 5, '#23232d');
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(bf[0] + 1.5, bf[1], 3.8, 2.2, 0, 0, 7); ctx.fill();
    const ff = limb(1, hipY, a1, 8, a2, 8, 5, '#2e2e3a');
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(ff[0] + 1.5, ff[1], 3.8, 2.2, 0, 0, 7); ctx.fill();

    ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
    ctx.fillStyle = look.pack; rr(ctx, -12, -31, 6, 14, 2.5); ctx.fill();
    ctx.fillStyle = look.blazer; rr(ctx, -8, -33, 16, 20, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(1, -33); ctx.lineTo(8, -33); ctx.lineTo(4, -25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = look.tie; ctx.fillRect(3.5, -31, 2.5, 9);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(1.5, -41, 8.5, 0, 7); ctx.fill();
    ctx.fillStyle = look.hair;
    ctx.beginPath(); ctx.arc(1.5, -42.5, 8.7, Math.PI * 0.95, Math.PI * 1.9); ctx.fill();
    ctx.beginPath(); ctx.arc(-3, -41, 5, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    ctx.fillStyle = '#1b1b2f'; ctx.fillRect(5.5, -42.5, 2, 2.6);
    ctx.fillStyle = '#c47a62'; ctx.fillRect(5, -37.5, 3, 1.2);
    limb(1, -28, ua, 6.5, fa, 6, 4.5, look.arm);
    ctx.fillStyle = look.skin;
    const hx = 1 + Math.sin(ua) * 6.5 + Math.sin(fa) * 6, hy = -28 + Math.cos(ua) * 6.5 + Math.cos(fa) * 6;
    ctx.beginPath(); ctx.arc(hx, hy, 2.3, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawPlayer(t) {
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.dir);
    ctx.fillStyle = 'rgba(31,58,147,.5)';
    ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(17, -7); ctx.lineTo(17, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawPerson(P, PLAYER_LOOK, t);
  }

  // ---------------- wandering student trainers ----------------
  const NPC_BLAZERS = [['#8c1d2f', '#a32439', '#6e1624'], ['#2e7d4f', '#379460', '#22603c'], ['#5b21b6', '#6d28d9', '#4c1d95'],
    ['#b45309', '#c2610f', '#8f4207'], ['#0f766e', '#12897f', '#0b5c56'], ['#374151', '#4b5563', '#1f2937']];
  const NPC_HAIR = ['#1b1b1b', '#6b3e26', '#c9a66b', '#3a2a1f', '#8a4b2a'];
  const NPC_SKIN = ['#f0c8a0', '#d7a27a', '#a86b45', '#7a4a2a', '#f5d5b8'];
  const NPC_QUOTES = ['Our eyes met — that means we battle!', 'I just caught these this morning. Let’s go!', 'Bet you can’t beat my team.',
    'Loser buys the bagels.', 'I’ve been training all through lunch.', 'My Regimon aced their midterms.'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const walkable = (x, y) => x > 30 && y > 30 && x < RIVER_X - 20 && y < H - 30 && zoneAt(x, y) !== 'water';

  function spawnNPC() {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, r = rnd(320, 750);
      const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
      if (!walkable(x, y)) continue;
      const z = zoneAt(x, y), size = 1 + Math.floor(Math.random() * 3), team = [];
      while (team.length < size) { const sp = pickSpecies(z); if (sp.rarity < 5) team.push(sp.id); }
      const [blazer, arm, armBack] = pick(NPC_BLAZERS);
      const used = new Set(npcs.map(n => n.name));
      npcs.push({
        name: pick(TRAINER_NAMES.filter(n => !used.has(n))), x, y, face: 1, moving: false, walkT: 0, tx: x, ty: y, wait: rnd(0.5, 3),
        team, look: { blazer, arm, armBack, pack: pick(['#1f3a93', '#f2c14e', '#111827', '#dc2626']), hair: pick(NPC_HAIR), skin: pick(NPC_SKIN), tie: '#f2c14e' },
      });
      return;
    }
  }
  function updateNPCs(dt) {
    npcs = npcs.filter(n => hyp(n.x, n.y, P.x, P.y) < 1400);
    npcTimer -= dt;
    if (npcTimer <= 0) { npcTimer = rnd(8, 15); if (npcs.length < 3) spawnNPC(); }
    for (const n of npcs) {
      if (n.wait > 0) { n.wait -= dt; n.moving = false; n.walkT = 0; continue; }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        n.wait = rnd(1, 4);
        for (let k = 0; k < 6; k++) {
          const tx = n.x + rnd(-170, 170), ty = n.y + rnd(-170, 170);
          if (walkable(tx, ty)) { n.tx = tx; n.ty = ty; break; }
        }
        continue;
      }
      const step = Math.min(d, 70 * dt);
      n.x += dx / d * step; n.y += dy / d * step;
      n.moving = true; n.walkT += dt * 0.7;
      if (Math.abs(dx) > 1) n.face = dx > 0 ? 1 : -1;
    }
  }
  function drawNPC(n, t) {
    drawPerson(n, n.look, t);
    if (hyp(n.x, n.y, P.x, P.y) <= RANGE) {
      const by = n.y - 66 + Math.sin(t / 200) * 2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#14204a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, by, 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dc2626'; ctx.font = '900 15px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', n.x, by + 1);
      ctx.font = '700 11px "Trebuchet MS", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(n.name, n.x, n.y + 14);
      ctx.fillStyle = '#14204a'; ctx.fillText(n.name, n.x, n.y + 14);
    }
  }

  // ---------------- arenas ----------------
  function drawArena(a, t) {
    const won = !!S.badges[a.id], inR = hyp(P.x, P.y, a.x, a.y) <= RANGE;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(a.x, a.y, 30, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e7e2d6'; ctx.beginPath(); ctx.ellipse(a.x, a.y - 3, 26, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9aa1ad'; ctx.fillRect(a.x - 9, a.y - 52, 18, 50);
    ctx.fillStyle = '#c3c8d1'; ctx.fillRect(a.x - 9, a.y - 52, 6, 50);
    const top = a.y - 60 + Math.sin(t / 500 + a.x) * 2;
    if (inR) {
      const p = (t / 900) % 1;
      ctx.strokeStyle = `rgba(242,193,78,${0.7 * (1 - p)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(a.x, top, 26 + p * 20, (26 + p * 20) * 0.45, 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = a.color; ctx.beginPath(); ctx.ellipse(a.x, top, 26, 11, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(won ? '🏆' : '⚔️', a.x, top - 16);
    if (inR) {
      ctx.font = '700 12px "Trebuchet MS", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(a.name, a.x, a.y + 16);
      ctx.fillStyle = '#14204a'; ctx.fillText(a.name, a.x, a.y + 16);
    }
  }

  // ---------------- battles ----------------
  function challengeArena(a) {
    const first = !S.badges[a.id];
    Battle.challenge({
      name: a.leader, title: `${a.title} · ${a.name}`, quote: a.quote, team: a.team, color: a.color, icon: first ? '⚔️' : '🏆',
      badge: !first, tier: a.tier, levelMult: 0.8 + a.tier * 0.05, levelAdd: a.tier, smart: 0.6 + a.tier * 0.06,
      winQuote: 'Train harder and come back. The arena will be here.',
      onResult: win => {
        const out = [];
        if (win) {
          const xp = first ? 600 + a.tier * 150 : 150 + a.tier * 40;
          const items = first ? { regi: 10, honors: 3 + a.tier, magna: a.tier >= 3 ? 2 : 1 } : { regi: 5, honors: 1 };
          for (const k in items) S.items[k] += items[k];
          if (first) { S.badges[a.id] = true; out.push(`🏅 ${a.name} badge!`); }
          out.push(`+${xp} XP`, Object.entries(items).map(([k, n]) => `+${n} ${BALLS[k].name}${n > 1 ? 's' : ''}`).join(' · '));
          addXP(xp);
        } else { addXP(50); out.push('+50 XP for trying'); }
        save();
        return out;
      },
    });
  }
  function challengeNPC(n) {
    Battle.challenge({
      name: n.name, title: 'Wandering trainer', quote: pick(NPC_QUOTES), team: n.team, color: n.look.blazer, icon: '🎒',
      tier: 1, levelMult: 0.85, levelAdd: -1, smart: 0.5,
      onResult: win => {
        npcs = npcs.filter(x => x !== n);
        if (win) { S.items.regi += 3; S.items.bagel += 1; addXP(200); save(); return ['+200 XP', '+3 Regi Balls · +1 Bagel']; }
        addXP(40); save();
        return ['+40 XP'];
      },
    });
  }
  Battle.init({
    get S() { return S; }, byId, Art, Music, TYPES,
    openModal: (h, cb) => openModal(h, cb), closeModal: () => closeModal(), toast: (m, ms) => toast(m, ms),
    onOpen: () => { mode = 'battle'; target = null; holding = false; },
    onClose: () => { mode = 'map'; Music.play('map'); updateHUD(); renderNearby(); save(); },
  });

  function drawPuffs() {
    for (const p of puffs) {
      const k = p.t / 0.5;
      ctx.fillStyle = `rgba(235,230,215,${0.55 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y - k * 6, 3 + k * 5, 0, 7); ctx.fill();
    }
  }

  function drawMap(t) {
    const cw = innerWidth, ch = innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#6aa653'; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2); ctx.scale(zoom, zoom); ctx.translate(-P.x, -P.y);
    const hw = cw / 2 / zoom, hh = ch / 2 / zoom;
    const tx0 = Math.max(0, Math.floor((P.x - hw) / TILE)), tx1 = Math.min(Math.ceil(W / TILE) - 1, Math.floor((P.x + hw) / TILE));
    const ty0 = Math.max(0, Math.floor((P.y - hh) / TILE)), ty1 = Math.min(Math.ceil(H / TILE) - 1, Math.floor((P.y + hh) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) ctx.drawImage(getTile(tx, ty), tx * TILE, ty * TILE);

    // range circle
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(P.x, P.y, RANGE, 0, 7); ctx.fill();
    ctx.setLineDash([10, 10]); ctx.lineDashOffset = -t / 60;
    ctx.strokeStyle = 'rgba(20,32,74,.35)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.setLineDash([]);

    if (target && !holding) {
      const p = (t / 700) % 1;
      ctx.strokeStyle = `rgba(242,193,78,${1 - p})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(target.x, target.y, 6 + p * 14, (6 + p * 14) * 0.5, 0, 0, 7); ctx.stroke();
    }

    drawPuffs();
    // depth-sorted drawables
    const items = [];
    for (const st of STOPS) items.push([st.y, () => drawStop(st, t)]);
    for (const s of spawns) items.push([s.y, () => drawSpawn(s, t)]);
    for (const a of ARENAS) if (Math.abs(a.x - P.x) < hw + 80 && Math.abs(a.y - P.y) < hh + 120) items.push([a.y, () => drawArena(a, t)]);
    for (const n of npcs) items.push([n.y, () => drawNPC(n, t)]);
    items.push([P.y, () => drawPlayer(t)]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of items) fn();

    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.8);
      ctx.font = '800 15px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#14204a';
      ctx.strokeText(f.text, f.x, f.y - f.t * 30);
      ctx.fillStyle = '#f2c14e'; ctx.fillText(f.text, f.x, f.y - f.t * 30);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------- catch encounter ----------------
  function catchLayout() {
    const w = innerWidth, h = innerHeight;
    const s = Math.min(w * 0.62, h * 0.36);
    return { w, h, s, R: s * 0.42, cx: w / 2, cy: h * 0.42, gy: h * 0.42 + s * 0.36, bx: w / 2, by: h - 150, br: clamp(w * 0.075, 24, 34) };
  }

  function buildCatchBG(z, L) {
    const cv = document.createElement('canvas');
    cv.width = L.w * dpr; cv.height = L.h * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const { w, h } = L, hz = h * 0.5;
    const grad = (y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
    const circ = (x, y, r, f) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = f; c.fill(); };
    switch (z) {
      case 'park':
        c.fillStyle = grad(0, hz, '#7fc8f8', '#dff3ff'); c.fillRect(0, 0, w, hz);
        for (let i = 0; i < 9; i++) { const x = (i + 0.3) * w / 8; circ(x, hz - 20, 48 + (i % 3) * 10, i % 2 ? '#4d9e44' : '#3f8f3a'); }
        c.fillStyle = grad(hz, h, '#8ccf6f', '#5a9e46'); c.fillRect(0, hz, w, h - hz);
        break;
      case 'sports':
        c.fillStyle = grad(0, hz, '#7fc8f8', '#dff3ff'); c.fillRect(0, 0, w, hz);
        for (let row = 0; row < 5; row++) {
          c.fillStyle = row % 2 ? '#9aa3b0' : '#b3bbc6'; c.fillRect(0, hz - 110 + row * 22, w, 22);
          for (let x = (row % 2) * 14; x < w; x += 28) { c.fillStyle = ['#ea580c', '#1f3a93', '#f2c14e', '#dc2626'][(x / 28 + row) % 4 | 0]; circ(x, hz - 100 + row * 22, 6, c.fillStyle); }
        }
        c.fillStyle = grad(hz, h, '#3fa35f', '#2a7f45'); c.fillRect(0, hz, w, h - hz);
        c.fillStyle = 'rgba(255,255,255,.08)'; for (let y = hz; y < h; y += 60) c.fillRect(0, y, w, 30);
        c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(0, hz + 30); c.lineTo(w, hz + 30); c.stroke();
        c.beginPath(); c.ellipse(w / 2, hz + (h - hz) * 0.45, w * 0.22, (h - hz) * 0.18, 0, 0, 7); c.stroke();
        break;
      case 'river':
      case 'water':
        c.fillStyle = grad(0, hz * 0.8, '#7fc8f8', '#e4f5ff'); c.fillRect(0, 0, w, hz * 0.8);
        c.fillStyle = '#5d8f4c'; c.fillRect(0, hz * 0.62, w, hz * 0.18);
        for (let x = -40; x < w; x += 70) { c.fillStyle = '#b8a58a'; c.fillRect(x, hz * 0.44, 50, hz * 0.2); }
        for (let i = 0; i < 10; i++) circ((i + 0.2) * w / 9, hz * 0.64, 26, i % 2 ? '#4d9e44' : '#3f8f3a');
        c.fillStyle = grad(hz * 0.8, h, '#5aaee6', '#1f6fb0'); c.fillRect(0, hz * 0.8, w, h - hz * 0.8);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
        for (let i = 0; i < 40; i++) {
          const x = (i * 97) % w, y = hz * 0.85 + ((i * 53) % Math.round(h - hz * 0.85)), r = 10 + (i % 4) * 6;
          c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x, y - 5, x + r, y); c.stroke();
        }
        for (let x = 6; x < w; x += 58) {
          c.strokeStyle = '#3d7a33'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(x, h); c.quadraticCurveTo(x + 4, h - 60, x + 10, h - 95); c.stroke();
          c.fillStyle = '#6b4a2b'; c.fillRect(x + 7, h - 108, 6, 18);
        }
        break;
      case 'school':
        c.fillStyle = grad(0, hz, '#f3ead3', '#e6dbbf'); c.fillRect(0, 0, w, hz);
        for (let x = -10; x < w; x += 46) {
          c.fillStyle = '#2c4a9a'; c.fillRect(x, hz - h * 0.3, 42, h * 0.3);
          c.fillStyle = '#244085'; for (let k = 0; k < 4; k++) c.fillRect(x + 8, hz - h * 0.3 + 14 + k * 5, 26, 2);
          c.fillStyle = '#c9ccd8'; c.fillRect(x + 32, hz - h * 0.17, 4, 12);
        }
        c.fillStyle = '#14204a'; c.fillRect(0, hz - h * 0.3 - 16, w, 10);
        c.fillStyle = grad(hz, h, '#c9a06d', '#9c7446'); c.fillRect(0, hz, w, h - hz);
        c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 2;
        for (let y = hz + 20; y < h; y += 34) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        break;
      case 'church': {
        c.fillStyle = grad(0, hz, '#2d1f4d', '#4a3470'); c.fillRect(0, 0, w, hz);
        const ww = Math.min(w * 0.36, 200), wx = w / 2 - ww / 2, wy = hz * 0.12, wh = hz * 0.72;
        c.save(); c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx, wy + ww / 2); c.arc(w / 2, wy + ww / 2, ww / 2, Math.PI, 0); c.lineTo(wx + ww, wy + wh); c.closePath(); c.clip();
        const cols = ['#e63946', '#2a9df4', '#f2c14e', '#3ddc84', '#9b5de5'];
        for (let x = wx; x < wx + ww; x += ww / 5) for (let y = wy; y < wy + wh; y += ww / 5) { c.fillStyle = cols[Math.floor(Math.random() * 5)]; c.fillRect(x, y, ww / 5, ww / 5); }
        c.strokeStyle = '#1b1030'; c.lineWidth = 3;
        for (let x = wx; x <= wx + ww; x += ww / 5) { c.beginPath(); c.moveTo(x, wy); c.lineTo(x, wy + wh); c.stroke(); }
        for (let y = wy; y <= wy + wh; y += ww / 5) { c.beginPath(); c.moveTo(wx, y); c.lineTo(wx + ww, y); c.stroke(); }
        c.restore();
        c.fillStyle = grad(hz, h, '#6b4f3a', '#3e2c20'); c.fillRect(0, hz, w, h - hz);
        c.fillStyle = 'rgba(160,30,40,.55)'; c.fillRect(w / 2 - w * 0.12, hz, w * 0.24, h - hz);
        break;
      }
      case 'subway':
        c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, hz);
        c.strokeStyle = '#d6d6cf'; c.lineWidth = 1;
        for (let x = 0; x < w; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, hz); c.stroke(); }
        for (let y = 0; y < hz; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        c.fillStyle = '#1b5e20'; c.fillRect(0, hz * 0.3, w, 38);
        c.fillStyle = '#fff'; c.font = '800 22px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('86 STREET', w / 2, hz * 0.3 + 19);
        c.fillStyle = grad(hz, h, '#9aa0aa', '#6b717c'); c.fillRect(0, hz, w, h - hz);
        c.fillStyle = '#f7d046'; c.fillRect(0, hz + 6, w, 12);
        break;
      case 'museum':
        c.fillStyle = grad(0, hz, '#fbf8f1', '#ece5d4'); c.fillRect(0, 0, w, hz);
        for (let x = 20; x < w; x += 110) {
          c.fillStyle = '#e2d9c3'; c.fillRect(x, hz * 0.1, 34, hz * 0.9);
          c.fillStyle = 'rgba(0,0,0,.06)'; for (let k = 6; k < 34; k += 9) c.fillRect(x + k, hz * 0.1, 3, hz * 0.9);
          c.fillStyle = '#d6cbb0'; c.fillRect(x - 6, hz * 0.08, 46, 12);
        }
        for (let y = hz; y < h; y += 40) for (let x = 0; x < w; x += 40) {
          c.fillStyle = ((x + y) / 40) % 2 ? '#ddd3bc' : '#efe8d8'; c.fillRect(x, y, 40, 40);
        }
        break;
      default:
        c.fillStyle = grad(0, hz, '#8cc9f5', '#e0f2ff'); c.fillRect(0, 0, w, hz);
        for (let x = -20, i = 0; x < w; x += 90, i++) {
          const bh = hz * (0.45 + ((i * 37) % 30) / 100);
          c.fillStyle = ['#a8745d', '#8f5f4b', '#b98c6e', '#9c7a66'][i % 4]; c.fillRect(x, hz - bh, 86, bh);
          c.fillStyle = 'rgba(255,240,200,.55)';
          for (let wy = hz - bh + 14; wy < hz - 30; wy += 30) for (let wx = x + 12; wx < x + 76; wx += 24) c.fillRect(wx, wy, 12, 16);
        }
        c.fillStyle = grad(hz, h, '#c9c4b8', '#9d988c'); c.fillRect(0, hz, w, h - hz);
        c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = 2;
        for (let x = 0; x < w; x += 70) { c.beginPath(); c.moveTo(x, hz); c.lineTo(x - 60, h); c.stroke(); }
    }
    // spotlight on the ground
    const gr = c.createRadialGradient(L.cx, L.gy, 4, L.cx, L.gy, L.s * 0.7);
    gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.beginPath(); c.ellipse(L.cx, L.gy, L.s * 0.7, L.s * 0.18, 0, 0, 7); c.fill();
    return cv;
  }

  function catchChance(sp, ballType, bagel, throwMult) {
    const m = BALLS[ballType].mult * (bagel ? 1.5 : 1) * throwMult;
    return 1 - Math.pow(1 - RARITY[sp.rarity].base, m);
  }
  const ringColor = ch => (ch > 0.5 ? '#3ddc68' : ch > 0.3 ? '#f7d046' : ch > 0.15 ? '#f4933c' : '#ef4444');
  const firstBall = pref => (S.items[pref] > 0 ? pref : BALL_ORDER.find(k => S.items[k] > 0) || pref);

  function openCatch(spawn) {
    mode = 'catch'; target = null; holding = false;
    const e = dexEntry(spawn.sp.id); e.seen++;
    Music.play('battle'); Music.sfx('encounter');
    const L = catchLayout();
    C = {
      spawn, sp: spawn.sp, cp: spawn.cp, L, bg: buildCatchBG(spawn.zone, L),
      state: 'idle', st: 0, t: 0, ballType: firstBall(C ? C.ballType : 'regi'),
      bagel: false, ball: null, drag: null, samples: [], particles: [], throws: 0,
    };
    $('#catch').classList.remove('hidden');
    $('#catch-name').textContent = C.sp.name;
    $('#catch-cp').textContent = `CP ${C.cp}`;
    $('#catch-types').innerHTML = C.sp.types.map(t => `<span class="type" style="background:${TYPES[t]}">${t}</span>`).join('') +
      (C.sp.rarity >= 4 ? `<span class="rar r${C.sp.rarity}">${RARITY[C.sp.rarity].name}</span>` : '');
    $('#catch-hint').classList.remove('hidden');
    updateCatchUI();
    save();
  }
  function closeCatch(removeSpawn) {
    if (!C) return;
    if (removeSpawn) spawns = spawns.filter(s => s !== C.spawn);
    C = null; mode = 'map';
    Music.play('map');
    $('#catch').classList.add('hidden');
    closeModal();
    updateHUD(); renderNearby(); save();
  }
  function updateCatchUI() {
    if (!C) return;
    C.ballType = firstBall(C.ballType);
    const n = S.items[C.ballType];
    $('#btn-ball').innerHTML = `<i class="ball-ico ${C.ballType}"></i><b>${n}</b>`;
    $('#btn-ball').title = BALLS[C.ballType].name;
    $('#bagel-count').textContent = S.items.bagel;
    $('#btn-bagel').disabled = !S.items.bagel || C.bagel;
  }
  function catchMsg(text) {
    const el = $('#catch-msg');
    el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function creaturePos(t) {
    const L = C.L, amp = (C.sp.rarity - 1) * L.w * 0.035;
    return { x: L.cx + Math.sin(t * 1.3) * amp, y: L.cy - Math.abs(Math.sin(t * 2.6)) * 7 };
  }
  const ringR = () => C.L.R * (1 - 0.82 * ((C.t % 1.8) / 1.8));

  function setState(s) {
    C.state = s; C.st = 0;
    const b = C.ball;
    if (s === 'caught') {
      finalizeCatch();
      Music.sfx('catch');
      burst(b.ax, C.L.gy, ['★', '✦'], '#f2c14e', 16);
      catchMsg('Gotcha!');
    } else if (s === 'break') {
      burst(b.ax, C.L.gy, null, '#ffffff', 18);
      catchMsg('Oh no! It broke free!');
      Music.sfx('break');
    } else if (s === 'fled') {
      catchMsg(`${C.sp.name} ran away!`);
      Music.sfx('fled');
    } else if (s === 'wobble') {
      if (C.wobbles > 0) Music.sfx('wobble');
    } else if (s === 'idle') {
      updateCatchUI();
      if (!BALL_ORDER.some(k => S.items[k] > 0)) catchMsg('Out of balls! Spin a Stop.');
    }
  }
  function burst(x, y, chars, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(120, 320);
      C.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rnd(0.7, 1.2), age: 0, ch: chars ? chars[i % chars.length] : null, color });
    }
  }

  // throw input
  cc.addEventListener('pointerdown', e => {
    if (!C || C.state !== 'idle' || modalOpen) return;
    if (!(S.items[C.ballType] > 0)) return;
    if (hyp(e.clientX, e.clientY, C.L.bx, C.L.by) > 80) return;
    C.state = 'drag'; C.drag = { x: e.clientX, y: e.clientY };
    C.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    try { cc.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cc.addEventListener('pointermove', e => {
    if (!C || C.state !== 'drag') return;
    C.drag = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    C.samples.push({ x: e.clientX, y: e.clientY, t: now });
    C.samples = C.samples.filter(s => now - s.t < 150);
  });
  const endDrag = () => {
    if (!C || C.state !== 'drag') return;
    const now = performance.now();
    const pts = C.samples.filter(s => now - s.t < 120);
    if (pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1], dt = Math.max(1, b.t - a.t);
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
      if (vy < -0.3) { throwBall(b.x, b.y, vx, vy); return; }
    }
    C.state = 'idle';
  };
  cc.addEventListener('pointerup', endDrag);
  cc.addEventListener('pointercancel', endDrag);

  function throwBall(x0, y0, vx, vy) {
    const L = C.L;
    S.items[C.ballType]--;
    C.throws++;
    Music.sfx('throw');
    $('#catch-hint').classList.add('hidden');
    const power = -vy, slope = vx / vy;
    const ball = { x0, y0, type: C.ballType, t: 0, hit: power >= 0.7, dur: clamp(0.85 - power * 0.1, 0.45, 0.75), mvx: vx * 300 };
    if (ball.hit) {
      ball.ty = L.cy;
    } else {
      ball.ty = y0 - (y0 - L.cy) * clamp(power / 0.7, 0.2, 0.85);
    }
    ball.tx = x0 + slope * (ball.ty - y0);
    C.ball = ball;
    C.state = 'fly'; C.st = 0;
    updateCatchUI();
  }

  function landBall() {
    const b = C.ball, L = C.L, p = creaturePos(C.t);
    const dx = Math.abs(b.tx - p.x);
    if (!b.hit || dx > L.R * 0.85) {
      catchMsg(b.hit ? 'Missed!' : 'Too short!');
      setState('miss');
      return;
    }
    const rr = ringR();
    let bonus = null, mult = 1;
    if (dx < rr) {
      const ratio = rr / L.R;
      if (ratio < 0.4) { bonus = 'Excellent!'; mult = 1.85; }
      else if (ratio < 0.7) { bonus = 'Great!'; mult = 1.5; }
      else { bonus = 'Nice!'; mult = 1.15; }
    }
    const chance = catchChance(C.sp, b.type, C.bagel, mult);
    C.bagel = false;
    C.bonus = bonus;
    C.success = Math.random() < chance;
    C.wobbles = C.success ? 3 : Math.floor(Math.random() * 3);
    C.wobblesDone = 0;
    C.flee = !C.success && Math.random() < RARITY[C.sp.rarity].flee;
    b.ax = p.x; b.ay = p.y - L.R * 0.2;
    if (bonus) catchMsg(bonus);
    Music.sfx('pop');
    setState('absorb');
  }

  function finalizeCatch() {
    const sp = C.sp, d = dexEntry(sp.id), isNew = !d.caught;
    d.caught++;
    S.caught.push({ uid: S.nextUid++, sid: sp.id, cp: C.cp, t: Date.now(), ball: C.ball.type });
    const xp = 100 + 50 * (sp.rarity - 1) + (isNew ? 500 : 0) + ({ 'Nice!': 10, 'Great!': 50, 'Excellent!': 100 }[C.bonus] || 0);
    C.reward = { xp, isNew };
    addXP(xp);
    save();
  }

  function showCatchResult() {
    const sp = C.sp, r = C.reward;
    openModal(`<div class="result">
      ${r.isNew ? '<span class="newbadge">NEW REGIDEX ENTRY!</span>' : ''}
      <img src="${Art.url(sp)}" alt="">
      <h2>${sp.name} was caught!</h2>
      <p class="sub">CP ${C.cp} · ${RARITY[sp.rarity].name}${C.bonus ? ` · ${C.bonus.replace('!', '')} throw` : ''}</p>
      <div class="xpgain">+${r.xp} XP</div>
      <button class="primary" id="res-ok">OK</button>
    </div>`, () => closeCatch(true));
    $('#res-ok').onclick = () => closeModal();
  }

  function catchFrame(dt) {
    C.t += dt; C.st += dt;
    const L = C.L;
    switch (C.state) {
      case 'fly':
        C.ball.t += dt / C.ball.dur;
        if (C.ball.t >= 1) { C.ball.t = 1; landBall(); }
        break;
      case 'miss': if (C.st > 0.9) setState('idle'); break;
      case 'absorb': if (C.st > 0.45) setState('drop'); break;
      case 'drop': if (C.st > 0.35) { setState('wobble'); C.wobblesDone = 0; } break;
      case 'wobble':
        if (C.wobblesDone >= C.wobbles) { setState(C.success ? 'caught' : 'break'); break; }
        if (C.st > 0.9) { C.wobblesDone++; C.st = 0; if (C.wobblesDone < C.wobbles) Music.sfx('wobble'); }
        break;
      case 'break': if (C.st > 1.0) setState(C.flee ? 'fled' : 'idle'); break;
      case 'caught': if (C.st > 1.3 && !C.resultShown) { C.resultShown = true; showCatchResult(); } break;
      case 'fled': if (C.st > 1.4) { closeCatch(true); return; } break;
    }
    for (const p of C.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
    C.particles = C.particles.filter(p => p.age < p.life);
    drawCatch(L);
  }

  function drawBall(c, x, y, r, type, rot = 0) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); c.arc(0, 0, r, Math.PI, 0); c.closePath(); c.fillStyle = BALLS[type].color; c.fill();
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI); c.closePath(); c.fillStyle = '#fafafa'; c.fill();
    c.strokeStyle = 'rgba(242,193,78,.95)'; c.lineWidth = r * 0.12;
    c.beginPath(); c.arc(0, 0, r * 0.7, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
    c.fillStyle = '#1b1b2f'; c.fillRect(-r, -r * 0.09, 2 * r, r * 0.18);
    c.beginPath(); c.arc(0, 0, r * 0.3, 0, 7); c.fill();
    c.beginPath(); c.arc(0, 0, r * 0.18, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.lineWidth = Math.max(1.5, r * 0.07); c.strokeStyle = '#1b1b2f'; c.stroke();
    c.beginPath(); c.arc(-r * 0.38, -r * 0.48, r * 0.17, 0, 7); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    c.restore();
  }

  function drawCatch(L) {
    const c = cctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.drawImage(C.bg, 0, 0, L.w, L.h);
    const p = creaturePos(C.t), st = C.state, b = C.ball;

    // creature
    let sc = 1, alpha = 1, yOff = 0;
    if (st === 'absorb') sc = Math.max(0, 1 - C.st / 0.4);
    else if (st === 'drop' || st === 'wobble' || st === 'caught') sc = 0;
    else if (st === 'break') sc = Math.min(1, C.st / 0.3);
    else if (st === 'fled') { alpha = Math.max(0, 1 - C.st / 0.8); yOff = -C.st * 140; }
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.beginPath(); c.ellipse(p.x, L.gy, L.s * 0.3 * Math.max(sc, 0.3), L.s * 0.07, 0, 0, 7); c.fill();
    if (sc > 0) {
      const s = L.s * sc, img = Art.img(C.sp);
      c.save(); c.globalAlpha = alpha;
      if (img.complete) c.drawImage(img, p.x - s / 2, p.y - s * 0.6 + yOff, s, s);
      c.restore();
    }
    if (st === 'absorb') {
      c.fillStyle = `rgba(255,255,255,${0.8 * (1 - C.st / 0.45)})`;
      c.beginPath(); c.arc(b.ax, b.ay, L.R * (1.2 - C.st), 0, 7); c.fill();
    }

    // target ring
    if (st === 'idle' || st === 'drag' || st === 'fly') {
      const ch = catchChance(C.sp, C.ballType, C.bagel, 1);
      c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)';
      c.beginPath(); c.arc(p.x, p.y, L.R, 0, 7); c.stroke();
      c.lineWidth = 6; c.strokeStyle = ringColor(ch);
      c.beginPath(); c.arc(p.x, p.y, ringR(), 0, 7); c.stroke();
    }
    if (C.bagel && sc > 0) {
      c.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🥯', p.x + L.R * 0.9, p.y - L.R * 0.9);
    }

    // ball
    const small = L.br * 0.55;
    switch (st) {
      case 'idle':
        if (S.items[C.ballType] > 0) drawBall(c, L.bx, L.by + Math.sin(C.t * 3) * 4, L.br, C.ballType);
        break;
      case 'drag': drawBall(c, C.drag.x, C.drag.y, L.br, C.ballType); break;
      case 'fly': {
        const t = b.t, x = b.x0 + (b.tx - b.x0) * t, y = b.y0 + (b.ty - b.y0) * t - Math.sin(Math.PI * t) * L.h * 0.12;
        drawBall(c, x, y, L.br * (1 - 0.45 * t), b.type, t * 12);
        break;
      }
      case 'miss': {
        const k = C.st;
        drawBall(c, b.tx + b.mvx * k * 0.3, b.ty + 900 * k * k, small, b.type, k * 14);
        break;
      }
      case 'absorb': drawBall(c, b.ax, b.ay, small, b.type); break;
      case 'drop': {
        const k = Math.min(1, C.st / 0.35);
        drawBall(c, b.ax, b.ay + (L.gy - small - b.ay) * k * k, small, b.type);
        break;
      }
      case 'wobble': {
        const k = C.st / 0.9;
        const rot = k > 0.25 && k < 0.75 ? Math.sin((k - 0.25) * Math.PI * 4) * 0.45 : 0;
        drawBall(c, b.ax, L.gy - small, small, b.type, rot);
        for (let i = 0; i < C.wobblesDone; i++) {
          c.fillStyle = '#f2c14e';
          c.beginPath(); c.arc(b.ax - 14 + i * 14, L.gy - small * 2 - 16, 4, 0, 7); c.fill();
        }
        break;
      }
      case 'caught': drawBall(c, b.ax, L.gy - small, small, b.type); break;
    }

    for (const q of C.particles) {
      c.globalAlpha = Math.max(0, 1 - q.age / q.life);
      if (q.ch) {
        c.font = '800 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = q.color; c.fillText(q.ch, q.x, q.y);
      } else {
        c.fillStyle = q.color; c.beginPath(); c.arc(q.x, q.y, 4, 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  $('#btn-run').onclick = () => { if (C && (C.state === 'idle' || C.state === 'drag')) closeCatch(false); };
  $('#btn-ball').onclick = () => {
    if (!C) return;
    const avail = BALL_ORDER.filter(k => S.items[k] > 0);
    if (!avail.length) return;
    C.ballType = avail[(avail.indexOf(C.ballType) + 1) % avail.length];
    updateCatchUI();
  };
  $('#btn-bagel').onclick = () => {
    if (!C || C.bagel || !(S.items.bagel > 0) || C.state !== 'idle') return;
    S.items.bagel--; C.bagel = true;
    catchMsg('Bagel given! 🥯');
    updateCatchUI();
  };

  // ---------------- modals ----------------
  let onModalClose = null;
  function openModal(html, onClose) {
    $('#modal-body').innerHTML = html;
    $('#modal').classList.remove('hidden');
    $('#modal .sheet').scrollTop = 0;
    modalOpen = true; holding = false; onModalClose = onClose || null;
  }
  function closeModal() {
    if (!modalOpen) return;
    $('#modal').classList.add('hidden');
    modalOpen = false;
    const cb = onModalClose; onModalClose = null;
    if (cb) cb();
  }
  $('#modal .close').onclick = closeModal;
  $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });

  const typeTags = sp => sp.types.map(t => `<span class="type" style="background:${TYPES[t]}">${t}</span>`).join('');

  function showDex() {
    const caught = SPECIES.filter(s => dexEntry(s.id).caught).length;
    const seen = SPECIES.filter(s => dexEntry(s.id).seen).length;
    let h = `<h2>📖 Regidex</h2><p class="sub">Caught <b>${caught}</b> / ${SPECIES.length} · Seen <b>${seen}</b></p>
      <div class="progress"><div style="width:${(caught / SPECIES.length) * 100}%"></div></div><div class="grid">`;
    for (const s of SPECIES) {
      const d = dexEntry(s.id), known = d.seen || d.caught;
      h += `<button class="card ${d.caught ? 'caught' : ''}" data-sid="${s.id}" ${known ? '' : 'disabled'}>
        <span class="num">#${String(s.id).padStart(3, '0')}</span>
        ${d.caught ? `<span class="cnt">×${d.caught}</span>` : ''}
        <img src="${Art.url(s)}" class="${d.caught ? '' : known ? 'seen' : 'sil'}" alt="">
        <span class="nm">${known ? s.name : '???'}</span></button>`;
    }
    openModal(h + '</div>');
    document.querySelectorAll('#modal-body .card[data-sid]').forEach(el => {
      el.onclick = () => showSpecies(+el.dataset.sid, showDex);
    });
  }

  function showSpecies(id, back) {
    const s = byId[id], d = dexEntry(id);
    const mine = S.caught.filter(c => c.sid === id);
    const best = mine.reduce((m, c) => Math.max(m, c.cp), 0);
    openModal(`<div class="detail">
      <img src="${Art.url(s)}" class="${d.caught ? '' : 'seen'}" alt="">
      <p class="sub">#${String(s.id).padStart(3, '0')}</p>
      <h2>${s.name}</h2>
      <div class="tags">${typeTags(s)}<span class="rar r${s.rarity}">${RARITY[s.rarity].name}</span></div>
      <p class="desc">${d.caught ? s.desc : 'Catch one to learn more about this Regimon.'}</p>
      <div class="stats">
        <div><b>${d.caught}</b><span>Caught</span></div>
        <div><b>${best || '—'}</b><span>Best CP</span></div>
        <div><b>${d.seen}</b><span>Seen</span></div>
      </div>
      <p class="sub">📍 Found near: ${s.habitat.map(z => ZONES[z]).join(', ')}</p>
      <div class="row"><button class="ghost" id="sp-back">← Back</button></div>
    </div>`);
    $('#sp-back').onclick = back;
  }

  function showBox(sort = 'recent') {
    const list = [...S.caught];
    if (sort === 'recent') list.sort((a, b) => b.t - a.t);
    else if (sort === 'cp') list.sort((a, b) => b.cp - a.cp);
    else list.sort((a, b) => a.sid - b.sid || b.cp - a.cp);
    const shown = list.slice(0, 400);
    let h = `<h2>🗃️ My Regimon</h2><p class="sub">${S.caught.length} caught</p>
      <div class="sortbar">${[['recent', 'Recent'], ['cp', 'CP'], ['num', 'Number']].map(([k, n]) => `<button data-sort="${k}" class="${k === sort ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (!shown.length) h += `<p class="sub" style="text-align:center;padding:30px 0">Nothing yet! Walk around 84th Street and tap a Regimon to catch it.</p>`;
    else h += `<div class="grid">${shown.map(c => {
      const s = byId[c.sid];
      return `<button class="card caught" data-sid="${c.sid}"><span class="cp">CP ${c.cp}</span><img src="${Art.url(s)}" alt=""><span class="nm">${s.name}</span></button>`;
    }).join('')}</div>`;
    openModal(h);
    document.querySelectorAll('#modal-body [data-sort]').forEach(el => { el.onclick = () => showBox(el.dataset.sort); });
    document.querySelectorAll('#modal-body .card[data-sid]').forEach(el => {
      el.onclick = () => showSpecies(+el.dataset.sid, () => showBox(sort));
    });
  }

  function showBag() {
    const caughtSpecies = SPECIES.filter(s => dexEntry(s.id).caught).length;
    const item = (ico, name, n, sub) => `<div class="item">${ico}<div class="grow">${name}<small>${sub}</small></div><b>×${n}</b></div>`;
    openModal(`<h2>👑 Trainer</h2>
      <p class="sub">Level ${S.level} · ${S.xp} / ${xpNeed(S.level)} XP to next level</p>
      <div class="progress"><div style="width:${(S.xp / xpNeed(S.level)) * 100}%"></div></div>
      <div class="stats">
        <div><b>${S.caught.length}</b><span>Caught</span></div>
        <div><b>${caughtSpecies}/${SPECIES.length}</b><span>Regidex</span></div>
        <div><b>${S.level}</b><span>Level</span></div>
      </div>
      <h2 style="font-size:18px">🎒 Bag</h2>
      <div class="items">
        ${item('<i class="ball-ico regi"></i>', 'Regi Ball', S.items.regi, 'Standard issue for every first-year.')}
        ${item('<i class="ball-ico honors"></i>', 'Honors Ball', S.items.honors, '1.5× catch rate.')}
        ${item('<i class="ball-ico magna"></i>', 'Magna Cum Ball', S.items.magna, '2× catch rate. For the tough ones.')}
        ${item('<span class="emo">🥯</span>', 'Bagel', S.items.bagel, 'Feed before throwing — next catch is 1.5× easier.')}
      </div>
      <h2 style="font-size:18px">🏅 Arena badges <span class="sub">${ARENAS.filter(a => S.badges[a.id]).length}/${ARENAS.length}</span></h2>
      <div class="badges">${ARENAS.map(a => `<div class="badge ${S.badges[a.id] ? 'won' : ''}" style="--arena:${a.color}">
        <span class="medal">${S.badges[a.id] ? '🏆' : '⚔️'}</span><b>${a.name.replace(' Arena', '')}</b><small>${a.leader}</small></div>`).join('')}</div>
      <div class="row">
        <button class="ghost" id="bag-help">❓ How to play</button>
        <button class="ghost danger" id="bag-reset">Reset progress</button>
      </div>`);
    $('#bag-help').onclick = () => showHelp(false);
    const rb = $('#bag-reset');
    rb.onclick = () => {
      if (rb.dataset.armed) {
        S = freshState(); S.intro = true; P.x = S.px; P.y = S.py; spawns = []; npcs = [];
        save(); updateHUD(); closeModal(); toast('Progress reset. Welcome back, first-year!');
        seedSpawns();
      } else { rb.dataset.armed = '1'; rb.textContent = 'Tap again to confirm'; }
    };
  }

  function showHelp(first) {
    openModal(`<div class="intro">
      <div class="logo">👑</div>
      <h1>Regimon <span>GO</span></h1>
      <p>Welcome to 84th Street, first-year! Wild <b>Regimon</b> are loose from Central Park to the East River. Catch them, train them, and beat every arena leader — <i>ad majorem Dei gloriam</i>.</p>
      <ul class="how">
        <li>🚶 <b>Walk</b> — tap or hold anywhere on the map (or use WASD / arrow keys).</li>
        <li>👆 <b>Encounter</b> — tap a Regimon inside your dotted circle.</li>
        <li>⚾ <b>Throw</b> — swipe the ball up at it. Land it inside the shrinking colored ring for a Nice / Great / Excellent bonus.</li>
        <li>🔷 <b>Stops</b> — tap the spinning blue diamonds near you for Regi Balls and Bagels.</li>
        <li>🗺️ <b>Explore</b> — every area has its own Regimon: Water types in the Reservoir, River types in the East River, Athletic types at Asphalt Green, and legends at Regis, the church, and Gracie Mansion. Tap the map button to see the whole neighborhood and walk anywhere.</li>
        <li>⚔️ <b>Battle</b> — tap an arena tower or a student with a <b>!</b> to battle with up to 3 Regimon. Each has 4 moves; pick moves the foe is weak to for super-effective damage. Win badges from all 6 arena leaders.</li>
        <li>🔊 <b>Music</b> — tap the speaker button to turn the music on or off.</li>
      </ul>
      <button class="primary" id="help-go">${first ? "Let's go!" : 'Got it'}</button>
      <p class="fine">A fan-made game. Not affiliated with Regis High School, Nintendo, Niantic or The Pokémon Company.</p>
    </div>`, () => { if (first) { S.intro = true; save(); } });
    $('#help-go').onclick = closeModal;
  }

  $('#btn-dex').onclick = showDex;
  $('#btn-box').onclick = () => showBox();
  $('#btn-bag').onclick = showBag;

  // ---------------- main loop ----------------
  function seedSpawns() {
    for (let i = 0; i < 3; i++) addSpawn(70, RANGE - 20);
    for (let i = 0; i < 5; i++) addSpawn();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 'map') {
      if (!modalOpen) update(dt);
      drawMap(now);
    } else if (C) {
      catchFrame(dt);
    }
    requestAnimationFrame(frame);
  }

  // ---------------- overview map ----------------
  const PLACES = [
    ['Central Park', 300, 1900], ['Regis', 1375, 1070], ['The Met', 490, 400], ['Guggenheim', 880, 2840], ['Yorkville', 3400, 2400],
    ['St. Ignatius', 1890, 570], ['Carl Schurz Park', 4640, 2000], ['East River', 4740, 420], ['Asphalt Green', 4270, 2960],
  ];
  function showOverview() {
    if (mode !== 'map') return;
    openModal(`<h2>🗺️ Upper East Side</h2>
      <p class="sub">Tap anywhere to walk there. ⚔️ arenas · 🏆 badges won · 🔷 stops</p>
      <div class="ov-wrap"><canvas id="ov-canvas"></canvas></div>`);
    const cv = $('#ov-canvas'), wrap = cv.parentElement;
    const cssW = wrap.clientWidth, s = cssW / W, cssH = H * s;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    g.drawImage(getOverview(), 0, 0, cssW, cssH);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const st of STOPS) { g.fillStyle = (S.cooldowns[st.id] || 0) > Date.now() ? '#b36bd9' : '#2f9df4'; g.beginPath(); g.arc(st.x * s, st.y * s, 3, 0, 7); g.fill(); }
    g.font = '700 11px "Trebuchet MS", sans-serif';
    for (const [n, x, y] of PLACES) {
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(n, x * s, y * s);
      g.fillStyle = '#14204a'; g.fillText(n, x * s, y * s);
    }
    g.font = '15px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    for (const a of ARENAS) g.fillText(S.badges[a.id] ? '🏆' : '⚔️', a.x * s, a.y * s - 6);
    g.fillStyle = '#f2c14e'; g.strokeStyle = '#14204a'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(P.x * s, P.y * s, 6, 0, 7); g.fill(); g.stroke();
    cv.onclick = e => {
      const r = cv.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / s, 20, W - 20), y = clamp((e.clientY - r.top) / s, 20, H - 20);
      target = { x, y }; holding = false;
      closeModal();
      toast(`🚶 Walking to ${zoneLabel(zoneAt(x, y), x, y)}…`);
    };
  }
  $('#btn-map').onclick = showOverview;

  // Draw the remaining map tiles in the background so walking never stutters.
  function prebuildTiles() {
    const todo = [];
    for (let ty = 0; ty < Math.ceil(H / TILE); ty++) for (let tx = 0; tx < Math.ceil(W / TILE); tx++) if (!tiles.has(tx + ',' + ty)) todo.push([tx, ty]);
    todo.sort((a, b) => hyp(a[0] * TILE, a[1] * TILE, P.x, P.y) - hyp(b[0] * TILE, b[1] * TILE, P.x, P.y));
    if (!todo.length) { getOverview(); return; }
    getTile(...todo[0]);
    setTimeout(prebuildTiles, 60);
  }
  setTimeout(prebuildTiles, 800);

  // Browsers only allow audio after a user gesture, so start the music on the first tap or key press.
  addEventListener('pointerdown', Music.unlock, true);
  addEventListener('keydown', Music.unlock, true);
  const soundBtn = $('#btn-sound');
  const paintSound = () => {
    soundBtn.textContent = Music.isMuted() ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-label', Music.isMuted() ? 'Turn music on' : 'Turn music off');
  };
  soundBtn.onclick = () => { Music.setMuted(!Music.isMuted()); paintSound(); };
  paintSound();

  resize();
  updateHUD();
  seedSpawns();
  renderNearby();
  if (!S.intro) showHelp(true);
  requestAnimationFrame(frame);
})();
