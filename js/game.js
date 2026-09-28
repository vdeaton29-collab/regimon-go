// Regimon GO — map, GPS, spawns, stops, catching, Regidex.
(() => {
  'use strict';
  const { TYPES, RARITY, SHINY_ODDS, BALLS, ZONES, ZONE_HINTS, ARENAS, TRAINER_NAMES, SPECIES } = window.RG;
  const GEO = window.RGGeo;
  const { W, H, PPM } = GEO;
  const Art = window.RGArt, Music = window.RGMusic, Battle = window.RGBattle, Online = window.RGOnline;
  const $ = s => document.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hyp = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const RANGE = 190, SPEED = 220, TRAVEL_SPEED = 1500, METERS_PER_PX = 1 / PPM, STOP_COOLDOWN = 120000;
  const BALL_ORDER = ['regi', 'honors', 'magna'];
  const byId = Object.fromEntries(SPECIES.map(s => [s.id, s]));
  Art.preload(SPECIES);

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const START = GEO.toXY(40.7789, -73.9596);   // the front steps of Regis on 84th Street
  const STOPS = GEO.LANDMARKS.map(l => ({ id: slug(l.name), name: l.name, icon: l.icon, blurb: l.blurb, ...GEO.toXY(l.lat, l.lon) }));
  for (const a of ARENAS) Object.assign(a, GEO.toXY(a.lat, a.lon));

  // ---------------- save ----------------
  const SAVE_KEY = 'regimon-go-v1', SAVE_VERSION = 2;
  function freshState() {
    return {
      version: SAVE_VERSION, xp: 0, level: 1, items: { regi: 30, honors: 5, magna: 1, bagel: 5 },
      dex: {}, caught: [], cooldowns: {}, badges: {}, px: START.x, py: START.y, intro: false, nextUid: 1,
      rating: 1000, leagueW: 0, leagueL: 0, leagueBest: 1000, mode: 'explore', walked: 0, shinies: 0,
      name: '', pid: Math.random().toString(36).slice(2, 12), online: false, music: 'auto', experimental: false,
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = Object.assign(freshState(), JSON.parse(raw));
        s.items = Object.assign(freshState().items, s.items);
        // Version 1 saves used the old 83rd–96th St map: keep everything but the position.
        if (!s.pid) s.pid = Math.random().toString(36).slice(2, 12);
        if (s.version !== SAVE_VERSION) { s.version = SAVE_VERSION; s.px = START.x; s.py = START.y; s.cooldowns = {}; }
        if (!(s.px > 0 && s.px < W && s.py > 0 && s.py < H)) { s.px = START.x; s.py = START.y; }
        return s;
      }
    } catch (e) { /* storage unavailable */ }
    return freshState();
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  let S = load();
  const dexEntry = id => (S.dex[id] = S.dex[id] || { seen: 0, caught: 0, shiny: 0 });
  const xpNeed = lvl => 600 + lvl * 400;

  // ---------------- geometry ----------------
  const boxOf = pts => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
  function pip(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inB = (x, y, b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  for (const list of [GEO.LANDS, GEO.PARKS, GEO.LAKES, GEO.LAWNS, GEO.GRIDS]) for (const o of list) o.box = boxOf(o.pts || o.clip);
  // A grid only needs drawing where its land and its district overlap.
  for (const G of GEO.GRIDS) if (G.region) {
    const r = boxOf(G.region);
    G.box = [Math.max(G.box[0], r[0]), Math.max(G.box[1], r[1]), Math.min(G.box[2], r[2]), Math.min(G.box[3], r[3])];
  }
  const ZONE_MARKS = GEO.LANDMARKS.filter(l => l.zone && l.r).map(l => ({ ...l, ...GEO.toXY(l.lat, l.lon), rp: l.r * PPM }));
  const HOODS = GEO.HOODS.map(([name, lat, lon]) => ({ name, ...GEO.toXY(lat, lon) }));
  const HARBOR_Y = GEO.toXY(40.7005, GEO.LON0).y;
  const HUDSON_X = lat => GEO.toXY(lat, -74.0000 - (40.80 - lat) * 0.16).x;   // rough mid-line between the rivers

  function landAt(x, y) {
    for (const l of GEO.LANDS) if (inB(x, y, l.box) && pip(x, y, l.pts)) return l.name;
    return null;
  }
  // Returns { zone, name } for a world point.
  function placeAt(x, y) {
    for (const m of ZONE_MARKS) if (Math.abs(x - m.x) < m.rp && Math.abs(y - m.y) < m.rp && hyp(x, y, m.x, m.y) < m.rp) return { zone: m.zone, name: m.name };
    for (const k of GEO.LAKES) if (inB(x, y, k.box) && pip(x, y, k.pts)) return { zone: 'water', name: k.name };
    const land = landAt(x, y);
    if (!land) {
      if (y > HARBOR_Y) return { zone: 'harbor', name: 'Upper New York Bay' };
      const { lat } = GEO.toLL(x, y);
      return { zone: 'river', name: x < HUDSON_X(lat) ? 'Hudson River' : 'East River' };
    }
    if (land === 'Liberty Island' || land === 'Ellis Island' || land === 'Governors Island') return { zone: 'harbor', name: land };
    if (land === 'Mill Rock') return { zone: 'river', name: 'Mill Rock Island' };
    for (const p of GEO.PARKS) if (inB(x, y, p.box) && pip(x, y, p.pts)) return { zone: 'park', name: p.name };
    let hood = null, best = 1700 * PPM;
    for (const h of HOODS) { const d = hyp(x, y, h.x, h.y); if (d < best) { best = d; hood = h.name; } }
    if (land === 'New Jersey') return { zone: 'nj', name: hood || 'New Jersey' };
    if (land === 'Manhattan') {
      const { lat, lon } = GEO.toLL(x, y);
      if (lat < 40.7125 && lon > -74.0165) return { zone: 'finance', name: hood || 'Financial District' };
      const uv = GEO.MGRID.toUV(x, y), s = GEO.streetOf(uv.u), v = uv.v / PPM;
      if (s >= 33 && s <= 59 && v > -620 && v < 560) return { zone: 'midtown', name: hood || 'Midtown' };
    }
    return { zone: 'street', name: hood || land };
  }
  const zoneAt = (x, y) => placeAt(x, y).zone;
  // Safe mode keeps players in the most polished areas: Manhattan, the harbor islands, Hoboken and downtown Jersey City.
  // Water is always allowed so you can cross between them. Experimental mode opens everything.
  function isSafe(x, y) {
    if (S.experimental) return true;
    const land = landAt(x, y);
    if (!land) return true;
    if (land === 'Brooklyn & Queens' || land === 'Island') return false;
    if (land === 'New Jersey') { const { lat, lon } = GEO.toLL(x, y); return lat > 40.700 && lat < 40.760 && lon > -74.056; }
    return true;
  }
  let safeToastAt = 0;
  function safeBlocked() {
    if (Date.now() - safeToastAt < 4000) return;
    safeToastAt = Date.now();
    toast('🚧 That area is still under construction. Turn on <b>🧪 Experimental mode</b> in the 👑 menu to explore it.', 3500);
  }
  const isLand = (x, y) => !!landAt(x, y) && !GEO.LAKES.some(k => inB(x, y, k.box) && pip(x, y, k.pts));

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // Position-based hash, so every tile draws the same details no matter which tile is built first.
  function hash(a, b, c = 0) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1440662683);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---------------- map rendering ----------------
  const BROWN = ['#b07a62', '#9c6b58', '#c4ab8c', '#a8927a', '#8f7d6d', '#c98f6f', '#b9a58a', '#a3765f', '#b5b0a6', '#9aa0a8', '#8d9aa6', '#c2b49a'];
  const FOOT = {};   // cached landmark footprints
  function pathPoly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  function pathLine(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); }
  function quad(g, grid, u0, v0, u1, v1) {
    const a = grid.toXY(u0, v0), b = grid.toXY(u0, v1), c = grid.toXY(u1, v1), d = grid.toXY(u1, v0);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
  }
  // One city block: sidewalk, then a row of buildings on each side.
  function drawBlock(g, grid, u0, v0, u1, v1, seed) {
    g.fillStyle = '#d4cdbd'; quad(g, grid, u0, v0, u1, v1); g.fill();
    const m = 4 * PPM, mid = (u0 + u1) / 2, len = v1 - v0;
    if (len < 12 * PPM || u1 - u0 < 12 * PPM) return;
    const k = Math.max(1, Math.round(len / ((22 + hash(seed, 3) * 14) * PPM)));
    for (let row = 0; row < 2; row++) {
      const ua = row ? mid + 1 : u0 + m, ub = row ? u1 - m : mid - 1;
      for (let i = 0; i < k; i++) {
        const va = v0 + m + (len - 2 * m) * i / k, vb = v0 + m + (len - 2 * m) * (i + 1) / k - 2;
        const h = hash(seed, row * 97 + i, 11);
        g.fillStyle = BROWN[Math.floor(h * BROWN.length)]; quad(g, grid, ua, va, ub, vb); g.fill();
        if (h > 0.55) { g.fillStyle = 'rgba(255,255,255,.1)'; quad(g, grid, ua + 3 * PPM, va + 3 * PPM, ub - 3 * PPM, vb - 3 * PPM); g.fill(); }
        if (h < 0.18) { g.fillStyle = 'rgba(0,0,0,.14)'; const cu = (ua + ub) / 2, cv = (va + vb) / 2; quad(g, grid, cu - 5, cv - 5, cu + 5, cv + 5); g.fill(); }
      }
    }
  }
  function uvRange(grid, view, pad) {
    const cs = [[view[0], view[1]], [view[2], view[1]], [view[0], view[3]], [view[2], view[3]]].map(([x, y]) => grid.toUV(x, y));
    return [Math.min(...cs.map(c => c.u)) - pad, Math.max(...cs.map(c => c.u)) + pad, Math.min(...cs.map(c => c.v)) - pad, Math.max(...cs.map(c => c.v)) + pad];
  }
  function drawGrid(g, G, view) {
    g.save();
    pathPoly(g, G.clip); g.clip();
    if (G.region) { pathPoly(g, G.region); g.clip(); }
    const grid = G.grid, [u0, u1, v0, v1] = uvRange(grid, view, 120 * PPM);
    const labels = [];
    if (G.kind === 'manhattan') {
      const hs = 9 * PPM, ha = 14 * PPM;
      for (let s = Math.floor(GEO.streetOf(u0)); s <= Math.ceil(GEO.streetOf(u1)); s++) {
        const us = GEO.streetU(s), ue = GEO.streetU(s + 1);
        const aves = GEO.AVENUES.filter(a => a.s0 <= s && s + 1 <= a.s1).map(a => a.v).sort((a, b) => a - b);
        if (!aves.length) continue;
        const edges = [aves[0] - 600 * PPM, ...aves, aves[aves.length - 1] + 700 * PPM];
        for (let i = 0; i + 1 < edges.length; i++) {
          const va = edges[i], vb = edges[i + 1];
          if (vb < v0 || va > v1) continue;
          drawBlock(g, grid, us + hs, va + ha, ue - hs, vb - ha, s * 131 + i);
          if (s >= 1 && i % 2 === 0 && vb - va > 110 * PPM && i > 0 && i < edges.length - 2) {
            const name = `${(va + vb) / 2 > 0 ? 'E' : 'W'} ${s} St`;
            labels.push([name, grid.toXY(us, (va + vb) / 2), grid.deg]);
          }
        }
        if (s % 5 === 2) for (const a of GEO.AVENUES) if (a.s0 <= s && s + 1 <= a.s1 && a.v > v0 && a.v < v1) labels.push([a.name, grid.toXY((us + ue) / 2, a.v), grid.deg - 90]);
      }
      // Broadway cuts across the grid
      g.strokeStyle = '#555964'; g.lineWidth = 26 * PPM; g.lineJoin = 'round'; pathLine(g, GEO.BROADWAY); g.stroke();
      g.strokeStyle = 'rgba(232,197,71,.7)'; g.lineWidth = 2; g.setLineDash([36, 30]); pathLine(g, GEO.BROADWAY); g.stroke(); g.setLineDash([]);
    } else {
      const su = G.su * PPM, sv = G.sv * PPM, hs = 8 * PPM, ha = 10 * PPM;
      for (let i = Math.floor(u0 / su); i <= Math.ceil(u1 / su); i++) for (let j = Math.floor(v0 / sv); j <= Math.ceil(v1 / sv); j++) {
        drawBlock(g, grid, i * su + hs, j * sv + ha, (i + 1) * su - hs, (j + 1) * sv - ha, hash(i, j, G.id.length) * 1e6);
      }
    }
    g.restore();
    return labels;
  }

  function drawFootprint(g, l, x, y) {
    const s = l.size * PPM, t = 29 * Math.PI / 180;
    g.save(); g.translate(x, y); g.rotate(t);
    switch (l.shape) {
      case 'regis':
        g.fillStyle = '#a79d86'; g.fillRect(-s / 2 - 6, -s * 0.35 - 6, s + 12, s * 0.7 + 12);
        g.fillStyle = '#e6dfcd'; g.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
        g.fillStyle = '#f7f3e8'; g.fillRect(-s / 2, s * 0.35 - 28, s, 28);
        g.fillStyle = '#c9bfa8'; for (let x2 = -s / 2 + 14; x2 < s / 2 - 10; x2 += 24) g.fillRect(x2, s * 0.35 - 26, 8, 24);
        g.fillStyle = 'rgba(60,80,120,.3)'; for (let x2 = -s / 2 + 12; x2 < s / 2 - 12; x2 += 22) for (let y2 = -s * 0.35 + 14; y2 < s * 0.35 - 40; y2 += 20) g.fillRect(x2, y2, 11, 7);
        break;
      case 'church':
        g.fillStyle = '#9d937f'; g.fillRect(-s / 2, -s * 0.18, s, s * 0.36); g.fillRect(-s * 0.14, -s / 2, s * 0.28, s);
        g.fillStyle = '#b8ad97'; g.fillRect(-s / 2 + 4, -s * 0.18 + 4, s - 8, s * 0.36 - 8); g.fillRect(-s * 0.14 + 4, -s / 2 + 4, s * 0.28 - 8, s - 8);
        g.fillStyle = '#f2c14e'; g.fillRect(-3, -14, 6, 28); g.fillRect(-10, -6, 20, 6);
        break;
      case 'museum':
        g.fillStyle = '#b9ad92'; g.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
        g.fillStyle = '#ece3cc'; g.fillRect(-s / 2 + 6, -s * 0.3 + 6, s - 12, s * 0.6 - 12);
        g.fillStyle = '#e0d5b8'; for (let x2 = -s / 2 + 16; x2 < s / 2 - 30; x2 += 50) for (let y2 = -s * 0.3 + 16; y2 < s * 0.3 - 30; y2 += 50) g.fillRect(x2, y2, 38, 38);
        break;
      case 'spiral':
        for (let r = s / 2; r > 8; r -= 14) { g.fillStyle = (r / 14) % 2 < 1 ? '#f7f5ef' : '#e2ded2'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); }
        break;
      case 'dome':
        g.fillStyle = '#b8ad97'; g.fillRect(-s / 2, -s / 2, s, s);
        g.fillStyle = '#2a9d8f'; g.beginPath(); g.arc(0, 0, s * 0.38, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(-s * 0.1, -s * 0.1, s * 0.14, 0, 7); g.fill();
        break;
      case 'tower':
        for (let k = 0; k < 4; k++) { const w = s * (1 - k * 0.2); g.fillStyle = ['#46536a', '#56647d', '#6a7892', '#8391aa'][k]; g.fillRect(-w / 2, -w / 2, w, w); }
        g.fillStyle = '#e6f0ff'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
        break;
      case 'neon': {
        g.fillStyle = '#3a3a48'; g.fillRect(-s / 2, -s / 2, s, s);
        const cols = ['#ff4fd8', '#22d3ee', '#fde047', '#f97316', '#a3e635', '#f43f5e'];
        for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(-s / 2 + (i % 4) * s / 4 + 6, -s / 2 + Math.floor(i / 4) * s / 3 + 6, s / 4 - 14, 16); }
        break;
      }
      case 'field':
        g.fillStyle = '#2f8f4e'; g.fillRect(-s / 2, -s / 2, s, s);
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 4; g.strokeRect(-s / 2 + 10, -s / 2 + 10, s - 20, s - 20);
        g.beginPath(); g.moveTo(-s / 2 + 10, 0); g.lineTo(s / 2 - 10, 0); g.stroke();
        break;
      case 'plaza':
        g.fillStyle = '#e8e2d4'; g.fillRect(-s / 2, -s / 2, s, s);
        g.fillStyle = '#5aaae0'; g.beginPath(); g.arc(0, 0, s * 0.15, 0, 7); g.fill();
        break;
      case 'fountain':
        g.fillStyle = '#e8e2d4'; g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill();
        g.fillStyle = '#5aaae0'; g.beginPath(); g.arc(0, 0, s * 0.3, 0, 7); g.fill();
        break;
      case 'castle':
        g.fillStyle = '#8b8d93'; g.fillRect(-s / 2, -s / 2, s, s * 0.8); g.fillStyle = '#7a7c82'; g.fillRect(s * 0.1, -s / 2 - 10, s * 0.35, s * 0.5);
        break;
      case 'rink':
        g.fillStyle = '#dbeafe'; rr(g, -s / 2, -s * 0.3, s, s * 0.6, 20); g.fill(); g.strokeStyle = '#93c5fd'; g.lineWidth = 3; g.stroke();
        break;
      case 'star': {
        g.fillStyle = '#9ca3af'; g.beginPath();
        for (let i = 0; i < 22; i++) { const r = i % 2 ? s * 0.32 : s / 2, a = i / 22 * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill();
        g.fillStyle = '#5fb3a1'; g.beginPath(); g.arc(0, 0, s * 0.16, 0, 7); g.fill();
        break;
      }
      case 'oculus':
        g.fillStyle = '#f8fafc'; g.beginPath(); g.ellipse(0, 0, s / 2, s * 0.3, 0, 0, 7); g.fill();
        g.strokeStyle = '#cbd5e1'; g.lineWidth = 3; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 11, -s * 0.28); g.lineTo(i * s / 9, s * 0.28); g.stroke(); }
        break;
      default:
        g.fillStyle = '#a79d86'; g.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
        g.fillStyle = '#ddd3bd'; g.fillRect(-s / 2 + 4, -s * 0.35 + 4, s - 8, s * 0.7 - 8);
    }
    g.restore();
  }

  function label(g, txt, x, y, size, color, rot = 0, stroke = 'rgba(255,255,255,.85)') {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot * Math.PI / 180);
    g.font = `700 ${size}px "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = size / 5; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(txt, 0, 0); }
    g.fillStyle = color; g.fillText(txt, 0, 0);
    g.restore();
  }

  // ---------------- OpenStreetMap detail, streamed in chunks as you move ----------------
  const DET = GEO.DETAIL;
  const CHUNK_KNOWN = new Set(DET ? DET.chunks.map(([i, j]) => i + '_' + j) : []);
  const chunks = new Map();   // 'i_j' -> { data, index, rect } | { loading } | { failed }
  let chunkLoads = 0;
  const DET_CELL = 512;
  const chunkRect = (i, j) => [i * DET.cw, j * DET.ch, (i + 1) * DET.cw, (j + 1) * DET.ch];
  function loadedAt(x, y) {
    if (!DET) return false;
    const c = chunks.get(Math.floor(x / DET.cw) + '_' + Math.floor(y / DET.ch));
    return !!(c && c.data);
  }
  function flatBox(f) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < f.length; i += 2) { if (f[i] < x0) x0 = f[i]; if (f[i] > x1) x1 = f[i]; if (f[i + 1] < y0) y0 = f[i + 1]; if (f[i + 1] > y1) y1 = f[i + 1]; } return [x0, y0, x1, y1]; }
  // Bucket a chunk's features by 512px cells so a tile only looks at what's near it.
  function buildIndex(d) {
    const idx = new Map();
    const add = (kind, i, f, pad = 0) => {
      const b = flatBox(f);
      for (let cx = Math.floor((b[0] - pad) / DET_CELL); cx <= Math.floor((b[2] + pad) / DET_CELL); cx++) for (let cy = Math.floor((b[1] - pad) / DET_CELL); cy <= Math.floor((b[3] + pad) / DET_CELL); cy++) {
        const k = cx + ',' + cy; let cell = idx.get(k); if (!cell) idx.set(k, cell = []); cell.push(kind, i);
      }
    };
    d.parks.forEach((p, i) => add(0, i, p[2]));
    d.water.forEach((w, i) => add(1, i, w));
    d.piers.forEach((p, i) => add(2, i, p[1], 10));
    d.roads.forEach((r, i) => add(3, i, r[2], 30));
    d.rails.forEach((r, i) => add(4, i, r, 10));
    d.buildings.forEach((b, i) => add(5, i, b[1], 40));
    (d.treeRows || []).forEach((r, i) => add(6, i, r, 30));
    (d.fountains || []).forEach((f, i) => add(7, i, f, 10));
    const pts = (list, kind) => { for (let i = 0; i + 1 < (list || []).length; i += 2) add(kind, i, [list[i], list[i + 1]], 30); };
    pts(d.trees, 8); pts(d.statues, 9);
    return idx;
  }
  // Throw away cached map tiles that were drawn before a chunk arrived.
  function invalidate(r) {
    for (const k of [...tiles.keys()]) {
      const [tx, ty] = k.split(',').map(Number);
      if (tx * TILE < r[2] + 250 && (tx + 1) * TILE > r[0] - 250 && ty * TILE < r[3] + 250 && (ty + 1) * TILE > r[1] - 250) tiles.delete(k);
    }
  }
  function ensureChunks(x0, y0, x1, y1) {
    if (!DET) return;
    const now = Date.now();
    for (let i = Math.max(0, Math.floor(x0 / DET.cw)); i <= Math.min(DET.cols - 1, Math.floor(x1 / DET.cw)); i++) {
      for (let j = Math.max(0, Math.floor(y0 / DET.ch)); j <= Math.min(DET.rows - 1, Math.floor(y1 / DET.ch)); j++) {
        const k = i + '_' + j;
        if (!CHUNK_KNOWN.has(k) || chunkLoads >= 3) continue;
        const c = chunks.get(k);
        if (c && (c.data || c.loading || (c.failed && now - c.failed < 30000))) continue;
        chunks.set(k, { loading: true });
        chunkLoads++;
        fetch(`js/osm/c_${i}_${j}.json`)
          .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
          .then(d => { const rect = chunkRect(i, j); chunks.set(k, { data: d, index: buildIndex(d), rect, used: now }); invalidate(rect); })
          .catch(() => chunks.set(k, { failed: Date.now() }))
          .finally(() => { chunkLoads--; });
      }
    }
    // keep memory in check: drop the chunks farthest from the player
    const loaded = [...chunks.entries()].filter(([, c]) => c.data);
    if (loaded.length > 20) {
      loaded.sort((a, b) => hyp((b[1].rect[0] + b[1].rect[2]) / 2, (b[1].rect[1] + b[1].rect[3]) / 2, P.x, P.y) - hyp((a[1].rect[0] + a[1].rect[2]) / 2, (a[1].rect[1] + a[1].rect[3]) / 2, P.x, P.y));
      for (const [k] of loaded.slice(0, loaded.length - 20)) chunks.delete(k);
    }
  }
  function nearChunks(view, pad) {
    const out = [];
    for (const c of chunks.values()) if (c.data && c.rect[0] < view[2] + pad && c.rect[2] > view[0] - pad && c.rect[1] < view[3] + pad && c.rect[3] > view[1] - pad) out.push(c);
    return out;
  }
  function flatPath(g, f, close) { g.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) g.lineTo(f[i], f[i + 1]); if (close) g.closePath(); }
  function flatPip(x, y, f) {
    let c = false;
    for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
      const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const ROAD_W = [44, 36, 31, 27, 22, 12, 15, 7, 8, 9];
  const COVER = {
    park: '#86c56c', cemetery: '#a3c28c', grass: '#9bd67c', scrub: '#88b865', wetland: '#8fc3a0', beach: '#efe0ad', dog: '#b9cf88',
    wood: '#4e9244', garden: '#8fd06f', play: '#ead8a4', track: '#c9603f', pool: '#5ec4f0', rink: '#e3f2fd',
    pitch: '#5fae5a', 'pitch:baseball': '#5fae5a', 'pitch:field': '#5aa855', 'pitch:tennis': '#3f8f5a', 'pitch:basketball': '#3c6db3', 'pitch:court': '#b87a45',
  };
  // Main direction of a shape (for lining up field markings).
  function axisOf(p) {
    let cx = 0, cy = 0; const n = p.length / 2;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cy += p[i + 1]; }
    cx /= n; cy /= n;
    let xx = 0, yy = 0, xy = 0;
    for (let i = 0; i < p.length; i += 2) { const dx = p[i] - cx, dy = p[i + 1] - cy; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
    const ang = 0.5 * Math.atan2(2 * xy, xx - yy), ca = Math.cos(ang), sa = Math.sin(ang);
    let l = 0, w = 0;
    for (let i = 0; i < p.length; i += 2) { const dx = p[i] - cx, dy = p[i + 1] - cy; l = Math.max(l, Math.abs(dx * ca + dy * sa)); w = Math.max(w, Math.abs(-dx * sa + dy * ca)); }
    return { cx, cy, ang, l, w };
  }
  function treeAt(g, x, y, r, dark) {
    g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.arc(x + r * 0.3, y + r * 0.35, r, 0, 7); g.fill();
    g.fillStyle = dark ? '#357a33' : (r > 14 ? '#3f8f3a' : '#4d9e44'); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.13)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); g.fill();
  }
  function drawCover(g, k, p, view) {
    g.beginPath(); flatPath(g, p, true);
    g.fillStyle = COVER[k] || '#86c56c'; g.fill();
    const b = flatBox(p);
    const within = (c, seed, keep, fn) => {   // hashed points inside the shape and near the view
      for (let x = Math.floor(Math.max(b[0], view[0] - 40) / c); x <= Math.min(b[2], view[2] + 40) / c; x++) for (let y = Math.floor(Math.max(b[1], view[1] - 40) / c); y <= Math.min(b[3], view[3] + 40) / c; y++) {
        const h = hash(x, y, seed); if (h > keep) continue;
        const px = x * c + hash(x, y, seed + 1) * c, py = y * c + hash(x, y, seed + 2) * c;
        if (flatPip(px, py, p)) fn(px, py, h);
      }
    };
    g.save(); g.beginPath(); flatPath(g, p, true); g.clip();
    switch (k) {
      case 'park': within(70, 31, 0.28, (x, y, h) => treeAt(g, x, y, 11 + h * 20)); break;
      case 'wood': within(30, 51, 0.9, (x, y, h) => treeAt(g, x, y, 13 + h * 8, h < 0.4)); break;
      case 'scrub': within(34, 61, 0.5, (x, y, h) => { g.fillStyle = '#6e9f52'; g.beginPath(); g.arc(x, y, 5 + h * 6, 0, 7); g.fill(); }); break;
      case 'grass': within(40, 71, 0.35, (x, y) => { g.strokeStyle = 'rgba(60,120,40,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 3, y + 3); g.lineTo(x, y - 3); g.lineTo(x + 3, y + 3); g.stroke(); }); break;
      case 'garden': {
        const FL = ['#f472b6', '#facc15', '#c084fc', '#ffffff', '#fb7185', '#f97316'];
        within(16, 81, 0.75, (x, y, h) => { g.fillStyle = FL[Math.floor(h * 8) % FL.length]; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); });
        break;
      }
      case 'wetland': within(30, 91, 0.6, (x, y) => { g.strokeStyle = 'rgba(59,130,246,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.stroke(); }); break;
      case 'cemetery': within(22, 95, 0.6, (x, y) => { g.fillStyle = '#9ca3af'; g.fillRect(x - 2, y - 3, 4, 6); }); break;
      case 'beach': within(24, 97, 0.4, (x, y) => { g.fillStyle = 'rgba(180,150,90,.4)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }); break;
      case 'play': {
        const TOY = ['#ef4444', '#3b82f6', '#facc15', '#22c55e'];
        within(28, 101, 0.45, (x, y, h) => { g.fillStyle = TOY[Math.floor(h * 9) % 4]; g.fillRect(x - 5, y - 5, 10, 10); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 5, y + 4, 10, 2); });
        break;
      }
      case 'track': {
        const a = axisOf(p);
        g.fillStyle = '#5fae5a'; g.beginPath(); g.ellipse(a.cx, a.cy, a.l * 0.72, a.w * 0.55, a.ang, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
        for (const s of [0.8, 0.9]) { g.beginPath(); g.ellipse(a.cx, a.cy, a.l * s, a.w * (s - 0.2), a.ang, 0, 7); g.stroke(); }
        break;
      }
      case 'pool': g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; { const a = axisOf(p); for (let s = -0.6; s <= 0.61; s += 0.3) { g.beginPath(); g.moveTo(a.cx - Math.cos(a.ang) * a.l + -Math.sin(a.ang) * a.w * s, a.cy - Math.sin(a.ang) * a.l + Math.cos(a.ang) * a.w * s); g.lineTo(a.cx + Math.cos(a.ang) * a.l + -Math.sin(a.ang) * a.w * s, a.cy + Math.sin(a.ang) * a.l + Math.cos(a.ang) * a.w * s); g.stroke(); } } break;
      case 'pitch:baseball': {
        const a = axisOf(p), s = Math.min(a.l, a.w) * 0.55;
        g.save(); g.translate(a.cx, a.cy); g.rotate(a.ang + Math.PI / 4);
        g.fillStyle = '#d9b27c'; g.fillRect(-s / 2, -s / 2, s, s);
        g.fillStyle = '#5fae5a'; g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
        g.fillStyle = '#fff'; for (const [bx, by] of [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]]) g.fillRect(bx - 2.5, by - 2.5, 5, 5);
        g.fillStyle = '#d9b27c'; g.beginPath(); g.arc(0, 0, s * 0.1, 0, 7); g.fill();
        g.restore();
        break;
      }
      case 'pitch:field': case 'pitch:tennis': case 'pitch:basketball': case 'pitch:court': case 'pitch': {
        const a = axisOf(p);
        g.save(); g.translate(a.cx, a.cy); g.rotate(a.ang);
        if (k === 'pitch:field') { g.fillStyle = 'rgba(255,255,255,.07)'; for (let x = -a.l; x < a.l; x += 28) g.fillRect(x, -a.w, 14, a.w * 2); }
        if (k === 'pitch:basketball') { g.fillStyle = '#f97316'; g.fillRect(-a.l * 0.85, -a.w * 0.25, a.l * 0.25, a.w * 0.5); g.fillRect(a.l * 0.6, -a.w * 0.25, a.l * 0.25, a.w * 0.5); }
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
        g.strokeRect(-a.l * 0.88, -a.w * 0.8, a.l * 1.76, a.w * 1.6);
        g.beginPath(); g.moveTo(0, -a.w * 0.8); g.lineTo(0, a.w * 0.8); g.stroke();
        if (k !== 'pitch:tennis') { g.beginPath(); g.arc(0, 0, Math.min(a.w * 0.35, 18), 0, 7); g.stroke(); }
        g.restore();
        break;
      }
    }
    g.restore();
    if (k === 'rink' || k === 'pool') { g.beginPath(); flatPath(g, p, true); g.strokeStyle = k === 'rink' ? '#90caf9' : '#ffffff'; g.lineWidth = 3; g.stroke(); }
    if (k === 'park' || k === 'wood') { g.beginPath(); flatPath(g, p, true); g.strokeStyle = 'rgba(40,90,30,.35)'; g.lineWidth = 3; g.stroke(); }
  }
  const BLD = ['#c9b8a3', '#b8a38c', '#d6c7b0', '#a9a39a', '#bcb3a6', '#c4a58c', '#b3a18e', '#b9aa94', '#c7b299', '#a89886'];
  const BLD_TALL = ['#9aa5b3', '#8d98a8', '#a3adba', '#7f8b9c'];
  function drawDetail(g, view) {
    const inView = nearChunks(view, 0);
    if (!inView.length) return;
    // collect features from every loaded chunk near this view (features can spill over chunk edges)
    const kinds = [[], [], [], [], [], [], [], [], [], []];
    for (const c of nearChunks(view, 400)) {
      const seen = kinds.map(() => new Set());
      for (let cx = Math.floor(view[0] / DET_CELL); cx <= Math.floor(view[2] / DET_CELL); cx++) for (let cy = Math.floor(view[1] / DET_CELL); cy <= Math.floor(view[3] / DET_CELL); cy++) {
        const cell = c.index.get(cx + ',' + cy);
        if (cell) for (let k = 0; k < cell.length; k += 2) if (!seen[cell[k]].has(cell[k + 1])) { seen[cell[k]].add(cell[k + 1]); kinds[cell[k]].push([c.data, cell[k + 1]]); }
      }
    }
    // big features are stored in every chunk they cross, so drop the copies
    const geomOf = [(d, i) => d.parks[i][2], (d, i) => d.water[i], (d, i) => d.piers[i][1], (d, i) => d.roads[i][2], (d, i) => d.rails[i], (d, i) => d.buildings[i][1], (d, i) => d.treeRows[i], (d, i) => d.fountains[i]];
    for (let k = 0; k < geomOf.length; k++) {
      const once = new Set();
      kinds[k] = kinds[k].filter(([d, i]) => { const p = geomOf[k](d, i), key = p[0] + ',' + p[1] + ',' + p[2] + ',' + p.length; if (once.has(key)) return false; once.add(key); return true; });
    }
    const [parks, water, piers, roads, rails, blds, treeRows, fountains, trees, statues] = kinds;
    g.save();
    g.beginPath(); for (const c of inView) g.rect(c.rect[0], c.rect[1], c.rect[2] - c.rect[0], c.rect[3] - c.rect[1]); g.clip();
    // real land becomes sidewalk-colored ground, covering the simplified map underneath
    g.beginPath(); for (const L of GEO.LANDS) { g.moveTo(L.pts[0][0], L.pts[0][1]); for (let i = 1; i < L.pts.length; i++) g.lineTo(L.pts[i][0], L.pts[i][1]); g.closePath(); }
    g.fillStyle = '#d6cfbf'; g.fill();
    // parks first, then everything that sits on top of them (so a lawn inside a park stays visible)
    const layer = k => (k === 'park' || k === 'cemetery' ? 0 : k === 'grass' || k === 'scrub' || k === 'wetland' || k === 'beach' || k === 'dog' ? 1 : k === 'wood' ? 2 : k === 'garden' ? 3 : 4);
    const cover = parks.map(([d, i]) => d.parks[i]).sort((a, b) => layer(a[0]) - layer(b[0]));
    for (const [k, , p] of cover) drawCover(g, k, p, view);
    for (const [d, i] of water) { g.beginPath(); flatPath(g, d.water[i], true); g.fillStyle = '#4f9fd8'; g.fill(); }
    for (const [d, i] of piers) {
      const [closed, p] = d.piers[i];
      g.beginPath(); flatPath(g, p, !!closed);
      if (closed) { g.fillStyle = '#c2b8a3'; g.fill(); } else { g.strokeStyle = '#c2b8a3'; g.lineWidth = 12; g.lineCap = 'round'; g.stroke(); }
    }
    // streets: light edge, then asphalt, widest roads on top
    g.lineCap = 'round'; g.lineJoin = 'round';
    const byClass = [[], [], [], [], [], [], [], [], [], []];
    for (const [d, i] of roads) byClass[d.roads[i][0]].push(d.roads[i][2]);
    for (let c = 5; c >= 0; c--) { g.strokeStyle = '#b3aa98'; g.lineWidth = ROAD_W[c] + 5; g.beginPath(); for (const p of byClass[c]) flatPath(g, p); g.stroke(); }
    for (let c = 5; c >= 0; c--) { g.strokeStyle = c <= 1 ? '#4c4f59' : '#575a65'; g.lineWidth = ROAD_W[c]; g.beginPath(); for (const p of byClass[c]) flatPath(g, p); g.stroke(); }
    g.strokeStyle = 'rgba(232,197,71,.75)'; g.lineWidth = 2; g.setLineDash([22, 18]);
    g.beginPath(); for (let c = 0; c <= 2; c++) for (const p of byClass[c]) flatPath(g, p); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#e6decb'; g.lineWidth = ROAD_W[6]; g.beginPath(); for (const p of byClass[6]) flatPath(g, p); g.stroke();
    for (const [cls, edge, fill] of [[9, '#b8a071', '#dcc79a'], [7, '#cdbd94', '#efe3c4'], [8, '#c08e7a', '#e9b5a3']]) {
      g.strokeStyle = edge; g.lineWidth = ROAD_W[cls] + 3; g.beginPath(); for (const p of byClass[cls]) flatPath(g, p); g.stroke();
      g.strokeStyle = fill; g.lineWidth = ROAD_W[cls]; g.beginPath(); for (const p of byClass[cls]) flatPath(g, p); g.stroke();
    }
    for (const [d, i] of rails) {
      const p = d.rails[i];
      g.strokeStyle = '#8a8f99'; g.lineWidth = 9; g.beginPath(); flatPath(g, p); g.stroke();
      g.strokeStyle = '#5b6070'; g.lineWidth = 12; g.setLineDash([3, 9]); g.beginPath(); flatPath(g, p); g.stroke(); g.setLineDash([]);
    }
    // buildings with a soft shadow; taller ones are glassier
    for (const [d, i] of blds) {
      const [h, p] = d.buildings[i];
      const sh = Math.min(h, 30) * 0.7 + 2;
      g.beginPath(); flatPath(g, p, true);
      g.save(); g.translate(sh, sh); g.fillStyle = 'rgba(0,0,0,.13)'; g.fill(); g.restore();
      const k = hash(p[0], p[1], 41);
      g.fillStyle = h >= 12 ? BLD_TALL[Math.floor(k * BLD_TALL.length)] : BLD[Math.floor(k * BLD.length)];
      g.fill();
      g.strokeStyle = 'rgba(60,50,40,.28)'; g.lineWidth = 1.2; g.stroke();
    }
    for (const [d, i] of treeRows) {
      const p = d.treeRows[i];
      for (let k = 0; k + 3 < p.length; k += 2) {
        const len = Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]), n = Math.max(1, Math.floor(len / 22));
        for (let s = 0; s <= n; s++) treeAt(g, p[k] + (p[k + 2] - p[k]) * s / n, p[k + 1] + (p[k + 3] - p[k + 1]) * s / n, 10 + hash(k, s, 7) * 4);
      }
    }
    for (const [d, i] of trees) treeAt(g, d.trees[i], d.trees[i + 1], 12 + hash(d.trees[i], d.trees[i + 1], 3) * 8);
    for (const [d, i] of fountains) {
      const b = flatBox(d.fountains[i]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, r = Math.max(8, (b[2] - b[0]) / 2);
      g.fillStyle = '#d8d2c2'; g.beginPath(); g.arc(cx, cy, r + 4, 0, 7); g.fill();
      g.fillStyle = '#4fa3e0'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let a = 0; a < 6; a++) { g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, 1.8, 0, 7); g.fill(); }
      g.beginPath(); g.arc(cx, cy, r * 0.18 + 1.5, 0, 7); g.fill();
    }
    for (const [d, i] of statues) {
      const x = d.statues[i], y = d.statues[i + 1];
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x - 5, y - 3, 12, 10);
      g.fillStyle = '#9ca3af'; g.fillRect(x - 6, y - 6, 12, 10);
      g.fillStyle = '#6b7c73'; g.beginPath(); g.arc(x, y - 4, 4, 0, 7); g.fill();
    }
    // names of lawns, gardens, fields and smaller parks
    const named = new Set();
    for (const [d, i] of parks) {
      const [k, n, p] = d.parks[i];
      if (n < 0 || named.has(d.names[n])) continue;
      const b = flatBox(p), w = b[2] - b[0], h = b[3] - b[1];
      if (w * h < 9000 || w * h > 4e6) continue;
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      if (cx < view[0] + 60 || cx > view[2] - 60 || cy < view[1] + 12 || cy > view[3] - 12 || !flatPip(cx, cy, p)) continue;
      label(g, d.names[n], cx, cy, 17, k === 'pool' ? '#0c4a6e' : '#1f4d1a', 0, 'rgba(255,255,255,.75)');
      named.add(d.names[n]);
    }
    // street names along the longest straight piece of each street
    const done = new Set();
    for (const [d, i] of roads) {
      const [c, n, p] = d.roads[i];
      if (n < 0 || c > 4) continue;
      const name = d.names[n];
      if (done.has(name)) continue;
      let best = 0, bi = -1;
      for (let k = 0; k + 3 < p.length; k += 2) { const dd = Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); if (dd > best) { best = dd; bi = k; } }
      if (best < name.length * 11 + 30) continue;
      const mx = (p[bi] + p[bi + 2]) / 2, my = (p[bi + 1] + p[bi + 3]) / 2;
      if (mx < view[0] + 40 || mx > view[2] - 40 || my < view[1] + 12 || my > view[3] - 12) continue;
      let ang = Math.atan2(p[bi + 3] - p[bi + 1], p[bi + 2] - p[bi]);
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      label(g, name, mx, my, c <= 1 ? 19 : 17, 'rgba(255,255,255,.92)', ang * 180 / Math.PI, 'rgba(40,42,52,.45)');
      done.add(name);
    }
    g.restore();
  }
  // Downloads every map chunk so the service worker caches the whole map for offline play.
  async function downloadMap(onProgress) {
    const list = DET ? DET.chunks : [];
    let done = 0;
    for (const [i, j] of list) {
      try { await (await fetch(`js/osm/c_${i}_${j}.json`)).arrayBuffer(); } catch (e) { /* keep going */ }
      onProgress(++done, list.length);
    }
  }

  const GRIDDED = new Set(['Manhattan', 'New Jersey', 'Brooklyn & Queens', 'Roosevelt Island']);
  // Draws everything static inside `view` ([x0, y0, x1, y1] in world px). `ov` = overview (no small details).
  function drawWorld(g, view, ov) {
    const [vx0, vy0, vx1, vy1] = view;
    const vis = (b, m = 0) => !(b[2] < vx0 - m || b[0] > vx1 + m || b[3] < vy0 - m || b[1] > vy1 + m);
    g.fillStyle = '#3f8fd0'; g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    if (!ov) {
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 3;
      const c = 150;
      for (let i = Math.floor(vx0 / c); i <= vx1 / c; i++) for (let j = Math.floor(vy0 / c); j <= vy1 / c; j++) {
        const h = hash(i, j, 5); if (h > 0.45) continue;
        const x = i * c + h * 200, y = j * c + hash(j, i, 6) * c;
        g.beginPath(); g.moveTo(x - 22, y); g.quadraticCurveTo(x, y - 9, x + 22, y); g.stroke();
      }
    }
    for (const L of GEO.LANDS) if (vis(L.box)) {
      pathPoly(g, L.pts);
      const gridded = GRIDDED.has(L.name);
      g.fillStyle = ov ? '#d6cfbf' : gridded ? '#555964' : '#cfc8b8'; g.fill();
      g.strokeStyle = ov ? '#bfb6a2' : '#c9b98f'; g.lineWidth = ov ? 40 : 10; g.stroke();
    }
    const labels = [];
    if (!ov) for (const G of GEO.GRIDS) if (vis(G.box)) labels.push(...drawGrid(g, G, view));
    // waterfront promenades
    if (!ov) for (const [pts, col, w] of [[GEO.MANHATTAN, '#8fc978', 55], [GEO.NEW_JERSEY, '#d9ccab', 40]]) {
      g.save(); pathPoly(g, pts); g.clip(); g.strokeStyle = col; g.lineWidth = w; pathPoly(g, pts); g.stroke(); g.restore();
    }
    // parks with trees
    for (const P of GEO.PARKS) if (!P.noDraw && vis(P.box, 40)) {
      pathPoly(g, P.pts); g.fillStyle = P.name === 'Palisades Cliffs' ? '#6f9b56' : '#78bb5e'; g.fill();
      if (ov) continue;
      g.strokeStyle = '#5f9e4a'; g.lineWidth = 4; g.stroke();
      const c = 64, bx0 = Math.max(vx0 - 30, P.box[0]), bx1 = Math.min(vx1 + 30, P.box[2]), by0 = Math.max(vy0 - 30, P.box[1]), by1 = Math.min(vy1 + 30, P.box[3]);
      for (let i = Math.floor(bx0 / c); i <= bx1 / c; i++) for (let j = Math.floor(by0 / c); j <= by1 / c; j++) {
        const h = hash(i, j, 21); if (h > 0.62) continue;
        const x = i * c + hash(i, j, 22) * c, y = j * c + hash(i, j, 23) * c;
        if (!pip(x, y, P.pts)) continue;
        const r = 12 + h * 16;
        g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(x + 4, y + 5, r, r * 0.8, 0, 0, 7); g.fill();
        g.fillStyle = h < 0.3 ? '#3f8f3a' : '#4d9e44'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); g.fill();
      }
    }
    for (const L of GEO.LAWNS) if (vis(L.box)) { pathPoly(g, L.pts); g.fillStyle = '#95d27a'; g.fill(); }
    for (const K of GEO.LAKES) if (vis(K.box, 40)) {
      if (K.rim) { pathPoly(g, K.pts); g.strokeStyle = '#d8c7a0'; g.lineWidth = ov ? 60 : 36; g.stroke(); }
      pathPoly(g, K.pts); g.fillStyle = '#4f9fd8'; g.fill();
    }
    // High Line and bridges
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#6fae55'; g.lineWidth = ov ? 60 : 24; pathLine(g, GEO.HIGH_LINE); g.stroke();
    for (const b of GEO.BRIDGES) {
      g.strokeStyle = '#e5e7eb'; g.lineWidth = ov ? 90 : 70; pathLine(g, b.pts); g.stroke();
      g.strokeStyle = '#6b7280'; g.lineWidth = ov ? 60 : 56; pathLine(g, b.pts); g.stroke();
      if (!ov) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.setLineDash([30, 26]); pathLine(g, b.pts); g.stroke(); g.setLineDash([]); }
    }
    g.lineCap = 'butt';
    if (ov) return;
    if (DET) drawDetail(g, view);
    for (const [txt, p, rot] of labels) if (!loadedAt(p.x, p.y) && p.x > vx0 - 200 && p.x < vx1 + 200 && p.y > vy0 - 200 && p.y < vy1 + 200) label(g, txt.toUpperCase(), p.x, p.y, 22, 'rgba(255,255,255,.8)', rot, null);
    for (const l of GEO.LANDMARKS) if (l.size) {
      const p = FOOT[l.name] || (FOOT[l.name] = GEO.toXY(l.lat, l.lon));
      const s = l.size * PPM;
      if (p.x + s < vx0 || p.x - s > vx1 || p.y + s < vy0 || p.y - s > vy1) continue;
      if (loadedAt(p.x, p.y) && l.shape !== 'star') continue;   // real buildings are drawn there
      drawFootprint(g, l, p.x, p.y);
    }
    for (const l of GEO.LANDMARKS) if (l.size) {
      const p = FOOT[l.name], s = l.size * PPM;
      if (p.x + s < vx0 - 300 || p.x - s > vx1 + 300 || p.y + s < vy0 - 100 || p.y - s > vy1 + 100) continue;
      label(g, l.shape === 'regis' ? '👑 REGIS HIGH SCHOOL' : l.name, p.x, p.y + s * 0.5 + 26, l.shape === 'regis' ? 40 : 26, '#1b1b2f');
    }
    const parkNamed = new Set();
    for (const P of GEO.PARKS) {
      if (parkNamed.has(P.name)) continue; parkNamed.add(P.name);
      const cx = (P.box[0] + P.box[2]) / 2, cy = (P.box[1] + P.box[3]) / 2;
      if (cx > vx0 - 600 && cx < vx1 + 600 && cy > vy0 - 100 && cy < vy1 + 100 && P.box[2] - P.box[0] > 250) label(g, P.name, cx, cy, 30, 'rgba(30,70,25,.8)', 0, 'rgba(255,255,255,.5)');
    }
    for (const K of GEO.LAKES) {
      const cx = (K.box[0] + K.box[2]) / 2, cy = (K.box[1] + K.box[3]) / 2;
      if (cx > vx0 - 400 && cx < vx1 + 400 && cy > vy0 - 60 && cy < vy1 + 60) label(g, K.name, cx, cy, 22, 'rgba(255,255,255,.9)', 0, null);
    }
    for (const b of GEO.BRIDGES) {
      const [a, c] = [b.pts[0], b.pts[b.pts.length - 1]], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
      if (mx > vx0 - 400 && mx < vx1 + 400 && my > vy0 - 60 && my < vy1 + 60) label(g, b.name, mx, my - 50, 24, '#fff', Math.atan2(c[1] - a[1], c[0] - a[0]) * 180 / Math.PI, 'rgba(0,0,0,.35)');
    }
    for (const [txt, lat, lon, rot] of GEO.WATER_LABELS) {
      const p = GEO.toXY(lat, lon);
      if (p.x > vx0 - 600 && p.x < vx1 + 600 && p.y > vy0 - 600 && p.y < vy1 + 600) label(g, txt.toUpperCase(), p.x, p.y, 64, 'rgba(255,255,255,.5)', -rot + (rot ? 0 : 0), null);
    }
    for (const h of HOODS) if (h.x > vx0 - 500 && h.x < vx1 + 500 && h.y > vy0 - 80 && h.y < vy1 + 80) label(g, h.name.toUpperCase(), h.x, h.y, 44, 'rgba(20,32,74,.45)', 0, 'rgba(255,255,255,.35)');
  }

  // The map is drawn lazily in tiles, with a small LRU cache so phones never hold too many canvases.
  const TILE = 768, MAX_TILES = 48, tiles = new Map();
  function getTile(tx, ty) {
    const key = tx + ',' + ty;
    let cv = tiles.get(key);
    if (cv) { tiles.delete(key); tiles.set(key, cv); return cv; }
    cv = document.createElement('canvas'); cv.width = TILE; cv.height = TILE;
    const g = cv.getContext('2d');
    g.translate(-tx * TILE, -ty * TILE);
    drawWorld(g, [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE], false);
    tiles.set(key, cv);
    if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
    return cv;
  }
  const OV = 0.02;
  let overview = null;
  function getOverview() {
    if (!overview) {
      overview = document.createElement('canvas');
      overview.width = Math.ceil(W * OV); overview.height = Math.ceil(H * OV);
      const g = overview.getContext('2d'); g.scale(OV, OV); drawWorld(g, [0, 0, W, H], true);
    }
    return overview;
  }

  // ---------------- canvas / sizing ----------------
  const mapCv = $('#map'), ctx = mapCv.getContext('2d');
  const cc = $('#catch-canvas'), cctx = cc.getContext('2d');
  let dpr = 1, zoom = 1, baseZoom = 1, userZoom = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    mapCv.width = innerWidth * dpr; mapCv.height = innerHeight * dpr;
    cc.width = innerWidth * dpr; cc.height = innerHeight * dpr;
    baseZoom = clamp(Math.min(innerWidth, innerHeight) / 620, 0.72, 1.5);
    setZoom(userZoom);
    if (C) { C.L = catchLayout(); C.bg = buildCatchBG(C.spawn.zone, C.L); }
  }
  function setZoom(z) { userZoom = clamp(z, 0.45 / baseZoom, 1.6); zoom = baseZoom * userZoom; }
  addEventListener('resize', resize);

  // ---------------- game state ----------------
  const P = { x: S.px, y: S.py, dir: -Math.PI / 2, face: 1, moving: false, walkT: 0, puffT: 0, travel: false };
  let mode = 'map', modalOpen = false;
  let spawns = [], floaters = [], puffs = [], target = null, holding = false;
  let zone = null, zoneName = '', spawnTimer = 0, nearbyTimer = 0, saveTimer = 0;
  let npcs = [], npcTimer = 3, placeTimer = 0;
  let C = null;
  const keys = {};
  // Live GPS state: fix = latest real position (world px), acc = accuracy in px.
  const GPS = { watch: null, fix: null, acc: 0, lastLat: null, lastLon: null, warnedOut: false };

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
      if (spawns.some(s => hyp(s.x, s.y, x, y) < 60) || !isSafe(x, y)) continue;
      const z = zoneAt(x, y), sp = pickSpecies(z), shiny = Math.random() < SHINY_ODDS;
      spawns.push({ sp, x, y, zone: z, shiny, phase: Math.random() * 6, born: performance.now(), expires: Date.now() + rnd(70, 150) * 1000 * (sp.rarity >= 5 ? 1.6 : 1), cp: rollCP(sp) });
      if (sp.rarity >= 5) {
        Music.sfx('ready');
        toast(`${sp.rarity >= 7 ? '🌌' : sp.rarity >= 6 ? '🔮' : '✨'} A <b>${RARITY[sp.rarity].name}</b> Regimon appeared nearby!<br>Look for the beam of light.`, 3600);
      } else if (shiny) toast('✨ Something shiny appeared nearby…', 2600);
      return;
    }
  }

  // ---------------- HUD ----------------
  function updateHUD() {
    $('#lvl').textContent = `${S.name || 'Trainer'} · Lv ${S.level}`;
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
      return `<div class="nb"><img class="${cls}" src="${Art.url(s.sp, s.shiny && e.caught)}" alt="">${Math.round(d * METERS_PER_PX)}m</div>`;
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
    for (const p of onlinePeers) {
      if (p.rx != null && hyp(w.x, w.y, p.rx, p.ry - 25) < 32) { Online.wave(p.id); Music.sfx('ready'); toast(`👋 You waved at <b>${esc(p.name)}</b>!`); return; }
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
        if (!isSafe(a.x, a.y)) { safeBlocked(); return; }
        if (hyp(P.x, P.y, a.x, a.y) <= RANGE) challengeArena(a);
        else toast(`⚔️ <b>${a.name}</b><br>Leader: ${a.leader}. Walk closer to battle.`);
        return;
      }
    }
    for (const st of STOPS) {
      if (hyp(w.x, w.y, st.x, st.y - 38) < 34) { tapStop(st); return; }
    }
    if (S.mode === 'live') {
      if (!GPS.fix) toast('🛰️ Waiting for your GPS location…');
      return;
    }
    target = w; holding = true; P.travel = false;
    try { mapCv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  mapCv.addEventListener('pointermove', e => {
    if (pinch.has(e.pointerId)) pinchMove(e);
    else if (holding) target = screenToWorld(e.clientX, e.clientY);
  });
  const release = e => { holding = false; if (e) pinch.delete(e.pointerId); if (pinch.size < 2) pinchStart = null; };
  mapCv.addEventListener('pointerup', release);
  mapCv.addEventListener('pointercancel', release);

  // Pinch and mouse-wheel zoom.
  const pinch = new Map();
  let pinchStart = null;
  mapCv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      pinchStart = { d: hyp(a.x, a.y, b.x, b.y), z: userZoom };
      holding = false; target = null;
    }
  }, true);
  function pinchMove(e) {
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2 && pinchStart) {
      const [a, b] = [...pinch.values()];
      setZoom(pinchStart.z * hyp(a.x, a.y, b.x, b.y) / pinchStart.d);
    }
  }
  mapCv.addEventListener('wheel', e => { e.preventDefault(); setZoom(userZoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
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
    let step = (P.travel ? TRAVEL_SPEED : SPEED) * dt;
    if (S.mode === 'live') {
      // Glide toward the latest GPS fix so the avatar never teleports.
      if (GPS.fix) {
        const dx = GPS.fix.x - P.x, dy = GPS.fix.y - P.y, d = Math.hypot(dx, dy);
        if (d > 600) { P.x = GPS.fix.x; P.y = GPS.fix.y; }
        else if (d > 2) { mx = dx; my = dy; step = Math.min(d, Math.max(SPEED * 0.6, d * 2.5) * dt); }
      }
    } else {
      if (keys.arrowleft || keys.a) mx -= 1;
      if (keys.arrowright || keys.d) mx += 1;
      if (keys.arrowup || keys.w) my -= 1;
      if (keys.arrowdown || keys.s) my += 1;
      if (mx || my) { target = null; P.travel = false; step = SPEED * dt; }
      else if (target) {
        const dx = target.x - P.x, dy = target.y - P.y, d = Math.hypot(dx, dy);
        if (d < 3) { if (!holding) { target = null; P.travel = false; } } else { mx = dx; my = dy; step = Math.min(step, d); }
      }
    }
    const m = Math.hypot(mx, my);
    if (m > 0) {
      const ox = P.x, oy = P.y;
      P.x = clamp(P.x + (mx / m) * step, 20, W - 20);
      P.y = clamp(P.y + (my / m) * step, 20, H - 20);
      if (S.mode !== 'live' && !isSafe(P.x, P.y)) { P.x = ox; P.y = oy; target = null; P.travel = false; holding = false; safeBlocked(); }
      if (!P.travel) S.walked += hyp(ox, oy, P.x, P.y) * METERS_PER_PX;
      P.dir = Math.atan2(my, mx); P.moving = true; P.walkT += dt * (P.travel ? 1.8 : 1);
      if (Math.abs(mx / m) > 0.2) P.face = mx > 0 ? 1 : -1;
      P.puffT -= dt;
      if (P.puffT <= 0) { P.puffT = 0.12; puffs.push({ x: P.x - (mx / m) * 8 + rnd(-3, 3), y: P.y + rnd(-1, 2), t: 0 }); }
    } else { P.moving = false; P.walkT = 0; }
    for (const p of puffs) p.t += dt;
    puffs = puffs.filter(p => p.t < 0.5);

    placeTimer -= dt;
    if (placeTimer <= 0) {
      placeTimer = 0.25;
      const place = placeAt(P.x, P.y), z = place.zone;
      if (z !== zone) {
        const first = zone === null;
        zone = z;
        if (!first && !P.travel) toast(`📍 <b>${place.name}</b><br>${ZONE_HINTS[z]}`);
      }
      // the place name can change inside one zone (e.g. Upper East Side → Yorkville)
      if (S.music === 'auto' && mode === 'map') Music.play(areaTrack(z));
      if (place.name !== zoneName) { zoneName = place.name; $('#zone-chip').textContent = `${S.mode === 'live' ? '🛰️' : '📍'} ${place.name}`; }
    }
    updateNPCs(dt);
    updatePeers(dt);

    const now = Date.now();
    spawns = spawns.filter(s => s.expires > now && hyp(s.x, s.y, P.x, P.y) < 1100);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = P.travel ? 0.6 : rnd(1.2, 2.8); if (spawns.length < 11) addSpawn(); }
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
    if (inR) {
      ctx.font = '700 12px "Trebuchet MS", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(st.name, st.x, st.y + 14);
      ctx.fillStyle = '#14204a'; ctx.fillText(st.name, st.x, st.y + 14);
    }
  }

  function drawSpawn(s, t) {
    const img = Art.img(s.sp, s.shiny);
    const appear = clamp((t - s.born) / 400, 0.01, 1);
    const left = s.expires - Date.now();
    const size = 74 * appear, bob = Math.sin(t / 300 + s.phase) * 3;
    ctx.globalAlpha = left < 5000 ? 0.4 + 0.6 * Math.abs(Math.sin(t / 150)) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 17 * appear, 6 * appear, 0, 0, 7); ctx.fill();
    const r = s.sp.rarity;
    if (r >= 5) {
      // a beam of light so rare Regimon can be spotted from far away
      const col = r >= 7 ? '167,139,250' : r >= 6 ? '244,114,182' : '242,193,78';
      const bw = 26 + Math.sin(t / 250) * 6;
      const gb = ctx.createLinearGradient(0, s.y - 900, 0, s.y);
      gb.addColorStop(0, `rgba(${col},0)`); gb.addColorStop(1, `rgba(${col},.55)`);
      ctx.fillStyle = gb; ctx.fillRect(s.x - bw / 2, s.y - 900, bw, 900);
    }
    if (r >= 4 || s.shiny) {
      const gr = ctx.createRadialGradient(s.x, s.y - 26, 4, s.x, s.y - 26, 48);
      gr.addColorStop(0, r >= 7 ? 'rgba(167,139,250,.85)' : r >= 6 ? 'rgba(244,114,182,.8)' : r === 5 ? 'rgba(242,193,78,.75)' : s.shiny ? 'rgba(255,255,255,.8)' : 'rgba(160,180,255,.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y - 26, 48, 0, 7); ctx.fill();
    }
    if (img.complete && size > 1) ctx.drawImage(img, s.x - size / 2, s.y - size + 6 + bob, size, size);
    if (s.shiny) {
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde047';
      ctx.fillText('✦', s.x + 24 + Math.sin(t / 200) * 3, s.y - size + 8);
    }
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

  // ---------------- online trainers ----------------
  let onlinePeers = [];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lookFor = id => {
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const [blazer, arm, armBack] = NPC_BLAZERS[Math.abs(h) % NPC_BLAZERS.length];
    return { blazer, arm, armBack, pack: '#f2c14e', hair: NPC_HAIR[Math.abs(h >> 3) % NPC_HAIR.length], skin: NPC_SKIN[Math.abs(h >> 6) % NPC_SKIN.length], tie: '#f2c14e' };
  };
  function nameTag(x, y, text, own) {
    ctx.font = '800 12px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = own ? 'rgba(242,193,78,.95)' : 'rgba(20,32,74,.85)'; rr(ctx, x - w / 2, y - 9, w, 18, 9); ctx.fill();
    ctx.fillStyle = own ? '#14204a' : '#fff'; ctx.fillText(text, x, y + 1);
  }
  function updatePeers(dt) {
    onlinePeers = Online.isOn() ? Online.list() : [];
    for (const p of onlinePeers) {
      if (p.x == null) continue;
      const d = hyp(p.rx, p.ry, p.x, p.y);
      if (d > 1500) { p.rx = p.x; p.ry = p.y; }
      else if (d > 2) { const k = Math.min(1, dt * 3); p.rx += (p.x - p.rx) * k; p.ry += (p.y - p.ry) * k; p.walkT += dt; p.moving = true; }
      else p.moving = false;
    }
  }
  function drawPeer(p, t) {
    drawPerson({ x: p.rx, y: p.ry, face: p.face, moving: p.moving, walkT: p.walkT }, lookFor(p.id), t);
    nameTag(p.rx, p.ry - 62, `🌐 ${p.name} · Lv ${p.lvl}`);
  }

  function drawPlayer(t) {
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.dir);
    ctx.fillStyle = 'rgba(31,58,147,.5)';
    ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(17, -7); ctx.lineTo(17, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawPerson(P, PLAYER_LOOK, t);
    if (S.name) nameTag(P.x, P.y - 62, S.name, true);
  }

  // ---------------- wandering student trainers ----------------
  const NPC_BLAZERS = [['#8c1d2f', '#a32439', '#6e1624'], ['#2e7d4f', '#379460', '#22603c'], ['#5b21b6', '#6d28d9', '#4c1d95'],
    ['#b45309', '#c2610f', '#8f4207'], ['#0f766e', '#12897f', '#0b5c56'], ['#374151', '#4b5563', '#1f2937']];
  const NPC_HAIR = ['#1b1b1b', '#6b3e26', '#c9a66b', '#3a2a1f', '#8a4b2a'];
  const NPC_SKIN = ['#f0c8a0', '#d7a27a', '#a86b45', '#7a4a2a', '#f5d5b8'];
  const NPC_QUOTES = ['Our eyes met — that means we battle!', 'I just caught these this morning. Let’s go!', 'Bet you can’t beat my team.',
    'Loser buys the bagels.', 'I’ve been training all through lunch.', 'My Regimon aced their midterms.'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const walkable = (x, y) => x > 30 && y > 30 && x < W - 30 && y < H - 30 && isLand(x, y) && isSafe(x, y);

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
      badge: !first, tier: a.tier, music: a.tier >= 10 ? 'boss' : 'fight', levelMult: 1, levelAdd: a.tier, smart: clamp(0.62 + a.tier * 0.045, 0, 1),
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
      tier: 1, levelMult: 1, levelAdd: 0, smart: 0.55,
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
    onClose: () => { mode = 'map'; Music.play(areaTrack(zone)); updateHUD(); renderNearby(); save(); },
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
    ctx.fillStyle = '#3f8fd0'; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2); ctx.scale(zoom, zoom); ctx.translate(-P.x, -P.y);
    const hw = cw / 2 / zoom, hh = ch / 2 / zoom;
    const tx0 = Math.max(0, Math.floor((P.x - hw) / TILE)), tx1 = Math.min(Math.ceil(W / TILE) - 1, Math.floor((P.x + hw) / TILE));
    const ty0 = Math.max(0, Math.floor((P.y - hh) / TILE)), ty1 = Math.min(Math.ceil(H / TILE) - 1, Math.floor((P.y + hh) / TILE));
    ensureChunks(P.x - hw - 1500, P.y - hh - 1500, P.x + hw + 1500, P.y + hh + 1500);
    // Build at most two new tiles per frame; show the low-res overview underneath until they're ready.
    let budget = 2;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const key = tx + ',' + ty;
      if (tiles.has(key) || budget-- > 0) ctx.drawImage(getTile(tx, ty), tx * TILE, ty * TILE);
      else ctx.drawImage(getOverview(), tx * TILE * OV, ty * TILE * OV, TILE * OV, TILE * OV, tx * TILE, ty * TILE, TILE, TILE);
    }

    // live GPS accuracy
    if (S.mode === 'live' && GPS.fix) {
      ctx.fillStyle = 'rgba(59,130,246,.14)'; ctx.strokeStyle = 'rgba(59,130,246,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(GPS.fix.x, GPS.fix.y, Math.max(12, GPS.acc), 0, 7); ctx.fill(); ctx.stroke();
    }

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
    for (const p of onlinePeers) if (p.rx != null && Math.abs(p.rx - P.x) < hw + 100 && Math.abs(p.ry - P.y) < hh + 100) items.push([p.ry, () => drawPeer(p, t)]);
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
      case 'midtown': {
        c.fillStyle = grad(0, hz, '#0b1024', '#312e81'); c.fillRect(0, 0, w, hz);
        for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect((i * 173) % w, (i * 97) % (hz * 0.5), 2, 2); }
        for (let x = -30, i = 0; x < w; x += 70 + (i % 3) * 20, i++) {
          const bh = hz * (0.45 + ((i * 53) % 50) / 100), bw = 60 + (i % 3) * 20;
          c.fillStyle = ['#1e293b', '#273449', '#172033'][i % 3]; c.fillRect(x, hz - bh, bw, bh);
          if (i % 4 === 1) { c.fillRect(x + bw / 2 - 3, hz - bh - 40, 6, 40); }
          for (let wy = hz - bh + 10; wy < hz - 10; wy += 16) for (let wx = x + 8; wx < x + bw - 8; wx += 14) if (((wx * 7 + wy * 3) | 0) % 5) { c.fillStyle = ((wx + wy) | 0) % 7 ? 'rgba(253,230,138,.8)' : 'rgba(125,211,252,.8)'; c.fillRect(wx, wy, 6, 8); }
        }
        const neon = ['#ff4fd8', '#22d3ee', '#fde047', '#f97316'];
        for (let i = 0; i < 5; i++) { c.fillStyle = neon[i % 4]; c.globalAlpha = 0.85; c.fillRect(i * w / 5 + 10, hz - 70 - (i % 2) * 40, w / 5 - 30, 22); }
        c.globalAlpha = 1;
        c.fillStyle = grad(hz, h, '#3a3d48', '#1f2128'); c.fillRect(0, hz, w, h - hz);
        c.fillStyle = 'rgba(255,255,255,.7)'; for (let x = 0; x < w; x += 60) c.fillRect(x, hz + (h - hz) * 0.5, 30, 6);
        break;
      }
      case 'finance':
        c.fillStyle = grad(0, hz, '#cbd5e1', '#f1f5f9'); c.fillRect(0, 0, w, hz);
        c.fillStyle = '#e7e2d6'; c.fillRect(0, hz * 0.18, w, hz * 0.82);
        c.fillStyle = '#d6cfbf'; c.fillRect(0, hz * 0.18, w, 26);
        for (let x = 20; x < w; x += 70) { c.fillStyle = '#f8f5ee'; c.fillRect(x, hz * 0.18 + 30, 30, hz * 0.82 - 30); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(x + 22, hz * 0.18 + 30, 8, hz * 0.82 - 30); }
        c.fillStyle = '#1d4ed8'; c.fillRect(w * 0.1, hz * 0.2, w * 0.8, 18); c.fillStyle = '#fff'; c.fillRect(w * 0.1, hz * 0.2 + 6, w * 0.8, 6);
        for (let y = hz; y < h; y += 22) for (let x = (y / 22 % 2) * 14; x < w; x += 28) { c.fillStyle = ((x + y) / 14) % 3 < 1 ? '#8b8680' : '#9a958e'; c.fillRect(x, y, 26, 20); }
        break;
      case 'harbor':
        c.fillStyle = grad(0, hz * 0.8, '#7fc8f8', '#e4f5ff'); c.fillRect(0, 0, w, hz * 0.8);
        c.fillStyle = '#5fb3a1';
        c.fillRect(w * 0.72, hz * 0.3, 16, hz * 0.5); c.beginPath(); c.arc(w * 0.72 + 8, hz * 0.3, 12, 0, 7); c.fill();
        c.fillRect(w * 0.72 + 12, hz * 0.18, 5, hz * 0.14); c.fillStyle = '#fde047'; c.beginPath(); c.arc(w * 0.72 + 14, hz * 0.17, 7, 0, 7); c.fill();
        c.fillStyle = '#8b8d93'; c.fillRect(w * 0.66, hz * 0.76, w * 0.14, hz * 0.04);
        c.fillStyle = grad(hz * 0.8, h, '#4f97d0', '#1e5f94'); c.fillRect(0, hz * 0.8, w, h - hz * 0.8);
        c.fillStyle = '#f97316'; c.fillRect(w * 0.15, hz * 0.74, 90, 16); c.fillStyle = '#fff'; c.fillRect(w * 0.15 + 20, hz * 0.7, 50, 8);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
        for (let i = 0; i < 40; i++) { const x = (i * 97) % w, y = hz * 0.85 + ((i * 53) % Math.round(h - hz * 0.85)); c.beginPath(); c.moveTo(x - 14, y); c.quadraticCurveTo(x, y - 5, x + 14, y); c.stroke(); }
        break;
      case 'nj':
        c.fillStyle = grad(0, hz * 0.7, '#fb923c', '#fde68a'); c.fillRect(0, 0, w, hz * 0.7);
        for (let x = 0, i = 0; x < w; x += 26 + (i % 4) * 8, i++) {
          const bh = hz * (0.12 + ((i * 37) % 40) / 100) * (i % 9 === 4 ? 1.8 : 1);
          c.fillStyle = '#3b3f5c'; c.fillRect(x, hz * 0.7 - bh, 24 + (i % 4) * 8, bh);
          if (i % 9 === 4) c.fillRect(x + 10, hz * 0.7 - bh - 30, 4, 30);
        }
        c.fillStyle = grad(hz * 0.7, hz, '#3b82f6', '#60a5fa'); c.fillRect(0, hz * 0.7, w, hz * 0.3);
        c.fillStyle = '#6b7280'; c.fillRect(0, hz - 8, w, 8);
        for (let x = 0; x < w; x += 40) c.fillRect(x, hz - 30, 4, 22);
        c.fillStyle = grad(hz, h, '#c9b38f', '#9c8566'); c.fillRect(0, hz, w, h - hz);
        c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; for (let y = hz + 20; y < h; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        break;
      case 'chinatown': {
        c.fillStyle = grad(0, hz, '#7f1d1d', '#b91c1c'); c.fillRect(0, 0, w, hz);
        for (let x = -20, i = 0; x < w; x += 110, i++) { c.fillStyle = i % 2 ? '#991b1b' : '#7f1d1d'; c.fillRect(x, hz * 0.3, 100, hz * 0.7); }
        c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.5;
        for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(0, hz * (0.15 + r * 0.1)); c.quadraticCurveTo(w / 2, hz * (0.25 + r * 0.1), w, hz * (0.15 + r * 0.1)); c.stroke(); }
        for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {
          const x = (i + 0.5) * w / 8, y = hz * (0.15 + r * 0.1) + Math.sin((i + 0.5) / 8 * Math.PI) * hz * 0.1 + 12;
          c.fillStyle = '#ef4444'; c.beginPath(); c.ellipse(x, y, 12, 15, 0, 0, 7); c.fill();
          c.fillStyle = '#fbbf24'; c.fillRect(x - 6, y - 16, 12, 3); c.fillRect(x - 6, y + 13, 12, 3);
        }
        c.fillStyle = grad(hz, h, '#57534e', '#3f3a36'); c.fillRect(0, hz, w, h - hz);
        break;
      }
      case 'music': {
        c.fillStyle = grad(0, hz, '#2e1065', '#5b21b6'); c.fillRect(0, 0, w, hz);
        for (let i = 0; i < 7; i++) {
          const x = (i + 0.5) * w / 7;
          const g2 = c.createLinearGradient(x, 0, x + (i - 3) * 30, hz);
          g2.addColorStop(0, 'rgba(253,230,138,.55)'); g2.addColorStop(1, 'rgba(253,230,138,0)');
          c.fillStyle = g2; c.beginPath(); c.moveTo(x - 8, 0); c.lineTo(x + 8, 0); c.lineTo(x + (i - 3) * 30 + 70, hz); c.lineTo(x + (i - 3) * 30 - 70, hz); c.closePath(); c.fill();
        }
        c.fillStyle = '#7f1d1d'; c.fillRect(0, 0, w * 0.08, hz); c.fillRect(w * 0.92, 0, w * 0.08, hz);
        c.fillStyle = grad(hz, h, '#7c4a24', '#4a2a12'); c.fillRect(0, hz, w, h - hz);
        c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2; for (let x = 0; x < w; x += 46) { c.beginPath(); c.moveTo(x, hz); c.lineTo(x, h); c.stroke(); }
        break;
      }
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
    $('#catch-name').textContent = (spawn.shiny ? '✨ ' : '') + C.sp.name;
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
    Music.play(areaTrack(zone));
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
    const shiny = !!C.spawn.shiny;
    if (shiny) { d.shiny = (d.shiny || 0) + 1; S.shinies++; }
    S.caught.push({ uid: S.nextUid++, sid: sp.id, cp: C.cp, t: Date.now(), ball: C.ball.type, shiny });
    const xp = 100 + 60 * (sp.rarity - 1) + (sp.rarity >= 6 ? 1500 : 0) + (shiny ? 500 : 0) + (isNew ? 500 : 0) + ({ 'Nice!': 10, 'Great!': 50, 'Excellent!': 100 }[C.bonus] || 0);
    C.reward = { xp, isNew };
    addXP(xp);
    save();
  }

  function showCatchResult() {
    const sp = C.sp, r = C.reward;
    openModal(`<div class="result">
      ${r.isNew ? '<span class="newbadge">NEW REGIDEX ENTRY!</span>' : ''}
      <img src="${Art.url(sp, C.spawn.shiny)}" alt="">
      <h2>${C.spawn.shiny ? '✨ Shiny ' : ''}${sp.name} was caught!</h2>
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
      const s = L.s * sc, img = Art.img(C.sp, C.spawn.shiny);
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
        ${d.caught ? `<span class="cnt">×${d.caught}${d.shiny ? ' ✨' : ''}</span>` : ''}
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
        <div><b>${d.shiny ? d.shiny + ' ✨' : d.seen}</b><span>${d.shiny ? 'Shiny' : 'Seen'}</span></div>
      </div>
      <p class="sub">📍 Found near: ${s.habitat.map(z => ZONES[z]).join(', ')}</p>
      ${d.caught ? movesHTML(s) : ''}
      <div class="row"><button class="ghost" id="sp-back">← Back</button></div>
    </div>`);
    $('#sp-back').onclick = back;
  }
  function movesHTML(s) {
    const mv = Battle.movesFor(s);
    const row = (m, kind, meta) => `<div class="mv" style="--mt:${TYPES[m.type]}"><span class="dot"></span><b>${m.name}${m.sig ? ' ★' : ''}</b><small>${kind} · ${m.type} · ${meta}</small></div>`;
    return `<div class="moves"><h3>Battle moves</h3>
      ${row(mv.fast, 'Fast', `Power ${mv.fast.power} · +${mv.fast.energy}⚡`)}
      ${mv.charged.map(c => row(c, c.sig ? 'Signature' : 'Special', `Power ${c.power} · ${c.cost}⚡${c.effect ? ' · ' + Battle.EFFECT_TEXT[c.effect] : ''}`)).join('')}
    </div>`;
  }

  // ---------------- Battle League (ranked) ----------------
  const RANKS = [[0, 'Freshman', '🟤'], [1100, 'Sophomore', '⚪'], [1250, 'Junior', '🟢'], [1400, 'Senior', '🔵'],
    [1600, 'Varsity', '🟣'], [1800, 'Captain', '🟠'], [2000, 'Valedictorian', '👑']];
  const rankOf = r => RANKS.filter(k => r >= k[0]).pop();
  function showLeague() {
    if (mode !== 'map') return;
    const r = S.rating, rk = rankOf(r), next = RANKS.find(k => k[0] > r);
    const pct = next ? (r - rk[0]) / (next[0] - rk[0]) * 100 : 100;
    openModal(`<div class="league">
      <div class="lg-rank">${rk[2]}</div>
      <h2>${rk[1]}</h2>
      <p class="sub">Battle League rating <b>${r}</b>${next ? ` · ${next[0] - r} points to ${next[1]}` : ' · top rank!'}</p>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="stats">
        <div><b>${S.leagueW}</b><span>Wins</span></div>
        <div><b>${S.leagueL}</b><span>Losses</span></div>
        <div><b>${S.leagueBest}</b><span>Best rating</span></div>
      </div>
      <p class="sub">Ranked battles against AI trainers near your rating. Winning earns rating points; losing costs them. Opponents get stronger and smarter as you climb.</p>
      <div class="ranks">${RANKS.map(k => `<span class="${r >= k[0] ? 'got' : ''}">${k[2]} ${k[1]} <small>${k[0]}</small></span>`).join('')}</div>
      <div class="row"><button class="primary" id="lg-go">⚔️ Find a ranked battle</button></div>
    </div>`);
    $('#lg-go').onclick = () => { closeModal(); leagueBattle(); };
  }
  function leagueBattle() {
    const opp = Math.max(800, Math.round(S.rating + rnd(-60, 90)));
    const f = clamp((opp - 1000) / 1000, -0.2, 1.2);
    const pool = SPECIES.filter(s => s.rarity < 5 || opp >= 1600);
    const team = [];
    while (team.length < 3) {
      const w = pool.map(s => (s.rarity >= 3 ? 1 + f * 2 : 1.5 - f * 0.5));
      let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
      while ((x -= w[i]) > 0) i++;
      if (!team.includes(pool[i].id)) team.push(pool[i].id);
    }
    const name = pick(TRAINER_NAMES);
    Battle.challenge({
      name: `${name}`, title: `Ranked opponent · ${rankOf(opp)[1]} · ${opp}`, quote: pick(NPC_QUOTES), team, color: '#b91c1c', icon: rankOf(opp)[2],
      tier: 3 + Math.round(f * 4), music: opp >= 1400 ? 'boss' : 'fight', levelMult: 1 + f * 0.12, levelAdd: Math.round(f * 5), smart: clamp(0.5 + f * 0.45, 0.45, 0.98),
      onResult: win => {
        const exp = 1 / (1 + Math.pow(10, (opp - S.rating) / 400));
        const delta = Math.round(32 * ((win ? 1 : 0) - exp)) || (win ? 1 : -1);
        const before = rankOf(S.rating)[1];
        S.rating = Math.max(0, S.rating + delta);
        S.leagueBest = Math.max(S.leagueBest, S.rating);
        if (win) S.leagueW++; else S.leagueL++;
        const out = [`${delta >= 0 ? '+' : ''}${delta} rating → ${S.rating}`];
        const after = rankOf(S.rating);
        if (after[1] !== before && delta > 0) { out.push(`${after[2]} Promoted to ${after[1]}!`); setTimeout(() => { Music.sfx('rankup'); banner(`${after[1].toUpperCase()}!`, 'New Battle League rank'); }, 1500); }
        if (win) { addXP(250); S.items.regi += 4; S.items.honors += 1; out.push('+250 XP · +4 Regi Balls · +1 Honors Ball'); }
        else { addXP(50); out.push('+50 XP'); }
        save();
        return out;
      },
    });
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
      return `<button class="card caught" data-sid="${c.sid}"><span class="cp">CP ${c.cp}</span><img src="${Art.url(s, c.shiny)}" alt="">${c.shiny ? '<span class="shiny-tag">✨</span>' : ''}<span class="nm">${s.name}</span></button>`;
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
    const km = (S.walked / 1000).toFixed(S.walked < 10000 ? 2 : 1);
    openModal(`<h2>👑 Trainer</h2>
      <p class="sub">Level ${S.level} · ${S.xp} / ${xpNeed(S.level)} XP to next level</p>
      <div class="progress"><div style="width:${(S.xp / xpNeed(S.level)) * 100}%"></div></div>
      <div class="stats">
        <div><b>${S.caught.length}</b><span>Caught</span></div>
        <div><b>${caughtSpecies}/${SPECIES.length}</b><span>Regidex</span></div>
        <div><b>${S.shinies}</b><span>Shinies ✨</span></div>
      </div>
      <h2 style="font-size:18px">🪪 Trainer name</h2>
      <div class="name-row"><input id="name-input" maxlength="16" placeholder="Pick a trainer name" value="${esc(S.name)}" autocomplete="off"><button class="ghost" id="name-save">Save</button></div>
      <h2 style="font-size:18px">🌐 Online</h2>
      <div class="modes">
        <button class="mode ${S.online ? '' : 'on'}" id="online-off"><b>🔒 Solo</b><small>Play on your own.</small></button>
        <button class="mode ${S.online ? 'on' : ''}" id="online-on"><b>🌐 Online</b><small>See other trainers live and wave at them.</small></button>
      </div>
      <p class="sub fine-note">Online shares your trainer name, level and neighborhood with other players through a public server. Your map position is shared only in Explore mode — in Live GPS mode your real location is never sent.</p>
      <h2 style="font-size:18px">🎵 Music</h2>
      <select id="music-select">${[['auto', 'Auto (changes by neighborhood)'], ...Object.entries(Music.TRACK_NAMES)].map(([k, n]) => `<option value="${k}" ${S.music === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <div class="row"><button class="ghost" id="map-dl">📥 Save the whole map for offline play</button></div>
      <h2 style="font-size:18px">🗺️ Map areas</h2>
      <div class="modes">
        <button class="mode ${S.experimental ? '' : 'on'}" id="area-safe"><b>✅ Safe</b><small>The best, most detailed areas: Manhattan, the harbor, Hoboken and downtown Jersey City.</small></button>
        <button class="mode ${S.experimental ? 'on' : ''}" id="area-exp"><b>🧪 Experimental</b><small>The whole map, including Brooklyn, Queens and Union City. Some areas aren't finished yet.</small></button>
      </div>
      <h2 style="font-size:18px">🧭 Play mode</h2>
      <div class="modes">
        <button class="mode ${S.mode === 'explore' ? 'on' : ''}" id="mode-explore"><b>🎮 Explore</b><small>Tap the map to walk anywhere. Works offline.</small></button>
        <button class="mode ${S.mode === 'live' ? 'on' : ''}" id="mode-live"><b>🛰️ Live GPS</b><small>Walk in real life. Needs location access.</small></button>
      </div>
      <p class="sub">🚶 ${km} km walked ${S.mode === 'live' && GPS.fix ? `· GPS ±${Math.round(GPS.acc * METERS_PER_PX)} m` : ''}</p>
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
    $('#name-save').onclick = () => { setName($('#name-input').value); showBag(); };
    $('#online-on').onclick = () => { setOnline(true); showBag(); };
    $('#online-off').onclick = () => { setOnline(false); showBag(); };
    $('#music-select').onchange = e => { S.music = e.target.value; save(); Music.play(S.music === 'auto' ? areaTrack(zone) : S.music); };
    $('#map-dl').onclick = async e => {
      const btn = e.currentTarget;
      if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) { toast('Offline saving works on the installed web version (vdeaton29-collab.github.io).'); return; }
      btn.disabled = true;
      await downloadMap((n, total) => { btn.textContent = `📥 Saving map… ${Math.round(n / total * 100)}%`; });
      btn.textContent = '✅ Whole map saved for offline play';
    };
    $('#area-safe').onclick = () => setExperimental(false);
    $('#area-exp').onclick = () => setExperimental(true);
    $('#mode-explore').onclick = () => { setMode('explore'); closeModal(); };
    $('#mode-live').onclick = () => { setMode('live'); closeModal(); };
    $('#bag-help').onclick = () => showHelp(false);
    const rb = $('#bag-reset');
    rb.onclick = () => {
      if (rb.dataset.armed) {
        stopGPS();
        S = freshState(); S.intro = true; P.x = S.px; P.y = S.py; spawns = []; npcs = [];
        save(); updateHUD(); paintMode(); closeModal(); toast('Progress reset. Welcome back, first-year!');
        seedSpawns();
      } else { rb.dataset.armed = '1'; rb.textContent = 'Tap again to confirm'; }
    };
  }

  function showHelp(first) {
    openModal(`<div class="intro">
      <div class="logo">👑</div>
      <h1>Regimon <span>GO</span></h1>
      <p>Welcome to 84th Street, first-year! Wild <b>Regimon</b> are loose all over Manhattan — from 97th Street down to the Battery — and across the Hudson in Hoboken, Jersey City and Union City. Catch them, train them, and beat every arena leader — <i>ad majorem Dei gloriam</i>.</p>
      ${first ? `<div class="modes">
        <button class="mode on" id="first-explore"><b>🎮 Explore</b><small>Tap the map to walk anywhere. Works offline.</small></button>
        <button class="mode" id="first-live"><b>🛰️ Live GPS</b><small>Walk around NYC for real. Needs location access.</small></button>
      </div>` : ''}
      ${first ? `<div class="name-row first"><input id="first-name" maxlength="16" placeholder="Your trainer name" autocomplete="off"></div>` : ''}
      <ul class="how">
        <li>🚶 <b>Walk</b> — in Explore mode, tap or hold the map (or use WASD / arrow keys). In Live mode, just walk. Pinch or scroll to zoom.</li>
        <li>👆 <b>Encounter</b> — tap a Regimon inside your dotted circle, then swipe the ball up at it. Land it in the shrinking ring for a bonus.</li>
        <li>🔷 <b>Stops</b> — tap the spinning diamonds at landmarks for Regi Balls and Bagels.</li>
        <li>🗺️ <b>Explore NYC</b> — every neighborhood has its own Regimon: Skyscraper types in Midtown, Wall Street types downtown, Harbor types by the Statue of Liberty, Jersey types across the Hudson. Open the map to fast-travel anywhere.</li>
        <li>✅ <b>Safe & 🧪 Experimental</b> — you start in the best areas (Manhattan, the harbor, Hoboken, downtown Jersey City). Turn on Experimental mode in the 👑 menu to explore the whole map while it's still being finished.</li>
        <li>🌟 <b>Rarities</b> — Common, Uncommon, Rare, Legendary, <b>Mythic</b> and <b>Celestial</b>. The rarest appear under a beam of light. About 1 in 64 is a ✨ shiny.</li>
        <li>⚔️ <b>Battle</b> — hold to fast-attack and build ⚡ energy, fire special attacks, time the meter, and use your 2 🛡️ shields. Beat all 15 arena leaders, from the Great Lawn to Liberty Island.</li>
        <li>🏆 <b>Battle League</b> — ranked battles to climb from Freshman to Valedictorian.</li>
      </ul>
      <button class="primary" id="help-go">${first ? "Let's go!" : 'Got it'}</button>
      <p class="fine">A fan-made game. Not affiliated with Regis High School, Nintendo, Niantic or The Pokémon Company. Map data © OpenStreetMap contributors. Stay aware of your surroundings when playing in Live mode.</p>
    </div>`, () => { if (first) { S.intro = true; save(); } });
    let pickMode = 'explore';
    if (first) {
      $('#first-explore').onclick = () => { pickMode = 'explore'; $('#first-explore').classList.add('on'); $('#first-live').classList.remove('on'); };
      $('#first-live').onclick = () => { pickMode = 'live'; $('#first-live').classList.add('on'); $('#first-explore').classList.remove('on'); };
    }
    $('#help-go').onclick = () => { if (first) setName($('#first-name').value); closeModal(); if (first && pickMode === 'live') setMode('live'); };
  }

  $('#btn-dex').onclick = showDex;
  $('#btn-box').onclick = () => showBox();
  $('#btn-bag').onclick = showBag;
  $('#btn-league').onclick = showLeague;

  // ---------------- live GPS mode ----------------
  function setExperimental(on) {
    S.experimental = on; save();
    if (!on && !isSafe(P.x, P.y)) { P.x = START.x; P.y = START.y; target = null; P.travel = false; spawns = []; npcs = []; seedSpawns(); }
    closeModal(); paintMode();
    toast(on ? '🧪 <b>Experimental mode</b> is on. The whole map is open — some areas are still being finished.' : '✅ <b>Safe mode</b> is on. You can explore the best areas of the map.', 3500);
  }
  function paintMode() {
    const chip = $('#mode-chip');
    chip.textContent = (S.mode === 'live' ? (GPS.fix ? '🛰️ Live' : '🛰️ Locating…') : '🎮 Explore') + (S.experimental ? ' · 🧪' : '');
    chip.classList.toggle('live', S.mode === 'live');
    zoneName = '';
  }
  function setMode(m) {
    if (m === 'live') {
      if (!('geolocation' in navigator)) { toast('This browser can’t share your location. Staying in Explore mode.'); m = 'explore'; }
    }
    S.mode = m; save();
    target = null; P.travel = false;
    if (m === 'live') startGPS(); else stopGPS();
    paintMode();
    toast(m === 'live' ? '🛰️ <b>Live GPS mode</b><br>Walk around for real to find Regimon.' : '🎮 <b>Explore mode</b><br>Tap the map to walk anywhere.');
  }
  function startGPS() {
    stopGPS();
    try {
      GPS.watch = navigator.geolocation.watchPosition(onFix, onGPSError, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
    } catch (e) { onGPSError({ code: 0, message: String(e) }); }
  }
  function stopGPS() {
    if (GPS.watch !== null) { try { navigator.geolocation.clearWatch(GPS.watch); } catch (e) { /* ignore */ } }
    GPS.watch = null; GPS.fix = null;
  }
  function onFix(pos) {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    if (!GEO.inBounds(lat, lon)) {
      GPS.fix = null;
      if (!GPS.warnedOut) {
        GPS.warnedOut = true;
        toast('📍 You’re outside the Regimon GO map (Manhattan below 97th St, Hoboken, Jersey City and Union City). Switch to Explore mode to play from anywhere.', 6000);
      }
      paintMode();
      return;
    }
    GPS.warnedOut = false;
    const fixXY = GEO.toXY(lat, lon);
    if (!isSafe(fixXY.x, fixXY.y)) { safeBlocked(); return; }
    const first = !GPS.fix;
    GPS.fix = GEO.toXY(lat, lon);
    GPS.acc = (accuracy || 20) * PPM;
    if (first) { P.x = GPS.fix.x; P.y = GPS.fix.y; spawns = []; seedSpawns(); toast('🛰️ Found you! Regimon are appearing nearby.'); }
    paintMode();
  }
  function onGPSError(err) {
    const denied = err && err.code === 1;
    toast(denied ? '🛰️ Location access was blocked. Allow it in your browser settings, or play in Explore mode.' : '🛰️ Couldn’t get your location yet. Make sure location services are on — still trying…', 5000);
    if (denied) { S.mode = 'explore'; save(); stopGPS(); paintMode(); }
  }

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
    ['Regis', 40.7792, -73.9594], ['Central Park', 40.7750, -73.9690], ['Upper West Side', 40.7870, -73.9754], ['Upper East Side', 40.7700, -73.9580],
    ['Midtown', 40.7549, -73.9840], ['Chelsea', 40.7465, -74.0014], ['Greenwich Village', 40.7336, -73.9990], ['East Village', 40.7265, -73.9815],
    ['SoHo', 40.7233, -74.0030], ['Chinatown', 40.7158, -73.9970], ['Financial District', 40.7075, -74.0100], ['Statue of Liberty', 40.6892, -74.0445],
    ['Hoboken', 40.7440, -74.0324], ['Jersey City', 40.7178, -74.0431], ['Union City', 40.7730, -74.0320], ['Weehawken', 40.7690, -74.0200],
    ['Journal Square', 40.7327, -74.0630], ['Brooklyn', 40.6960, -73.9900], ['Queens', 40.7550, -73.9380], ['Governors Island', 40.6894, -74.0167],
  ].map(([n, lat, lon]) => [n, GEO.toXY(lat, lon)]);
  function showOverview() {
    if (mode !== 'map') return;
    const live = S.mode === 'live';
    openModal(`<h2>🗺️ Regimon GO map</h2>
      <p class="sub">${live ? 'You’re in Live GPS mode — walk for real to move. ' : 'Tap anywhere to travel there. '}${S.experimental ? '🧪 Experimental: whole map open' : 'Shaded areas unlock in 🧪 Experimental mode'} · ⚔️ arenas · 🏆 badges won · 🔷 stops · 🟡 you · Map data © OpenStreetMap contributors</p>
      <div class="ov-wrap"><canvas id="ov-canvas"></canvas></div>`);
    const cv = $('#ov-canvas'), wrap = cv.parentElement;
    const cssW = Math.min(wrap.clientWidth, innerHeight * 0.66 * W / H), s = cssW / W, cssH = H * s;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    g.drawImage(getOverview(), 0, 0, cssW, cssH);
    if (!S.experimental) {
      const c = 8;
      g.fillStyle = 'rgba(40,40,55,.45)';
      for (let yy = 0; yy < cssH; yy += c) for (let xx = 0; xx < cssW; xx += c) if (!isSafe((xx + c / 2) / s, (yy + c / 2) / s)) g.fillRect(xx, yy, c, c);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const st of STOPS) { g.fillStyle = (S.cooldowns[st.id] || 0) > Date.now() ? '#b36bd9' : '#2f9df4'; g.beginPath(); g.arc(st.x * s, st.y * s, 2, 0, 7); g.fill(); }
    g.font = '700 10px "Trebuchet MS", sans-serif';
    for (const [n, p] of PLACES) {
      const half = g.measureText(n).width / 2 + 3, lx = clamp(p.x * s, half, cssW - half);
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(n, lx, p.y * s);
      g.fillStyle = '#14204a'; g.fillText(n, lx, p.y * s);
    }
    g.font = '12px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    for (const a of ARENAS) g.fillText(S.badges[a.id] ? '🏆' : '⚔️', a.x * s, a.y * s - 5);
    g.fillStyle = '#f2c14e'; g.strokeStyle = '#14204a'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(P.x * s, P.y * s, 5, 0, 7); g.fill(); g.stroke();
    cv.onclick = e => {
      if (S.mode === 'live') { toast('🛰️ In Live GPS mode you move by walking. Switch to Explore mode in the 👑 menu to fast-travel.'); return; }
      const r = cv.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / s, 20, W - 20), y = clamp((e.clientY - r.top) / s, 20, H - 20);
      if (!isSafe(x, y)) { safeBlocked(); return; }
      target = { x, y }; holding = false;
      P.travel = hyp(x, y, P.x, P.y) > 900;
      closeModal();
      toast(`${P.travel ? '🚕 Heading to' : '🚶 Walking to'} ${placeAt(x, y).name}…`);
    };
  }
  $('#btn-map').onclick = showOverview;

  // Pre-draw the tiles around the player so walking never stutters.
  function prebuildTiles() {
    if (mode === 'map') {
      const cx = Math.floor(P.x / TILE), cy = Math.floor(P.y / TILE);
      let built = 0;
      for (let r = 0; r <= 2 && !built; r++) for (let dy = -r; dy <= r && !built; dy++) for (let dx = -r; dx <= r && !built; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= Math.ceil(W / TILE) || ty >= Math.ceil(H / TILE) || tiles.has(tx + ',' + ty)) continue;
        getTile(tx, ty); built++;
      }
    }
    setTimeout(prebuildTiles, 120);
  }
  setTimeout(() => { getOverview(); prebuildTiles(); }, 600);

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
  $('#mode-chip').onclick = showBag;

  // ---------------- names, online, music ----------------
  function areaTrack(z) {
    if (S.music !== 'auto') return S.music;
    return z === 'park' || z === 'water' ? 'park' : z === 'midtown' || z === 'music' || z === 'finance' || z === 'chinatown' ? 'city'
      : z === 'nj' ? 'jersey' : z === 'harbor' || z === 'river' ? 'harbor' : 'map';
  }
  function setName(raw) {
    const n = Online.cleanName(raw);
    if (!raw || !String(raw).trim()) return;
    S.name = n; save(); updateHUD();
    toast(`🪪 You're now <b>${esc(n)}</b>`);
  }
  function paintOnline(status) {
    const chip = $('#online-chip');
    if (!S.online) { chip.textContent = '🔒 Solo'; chip.classList.remove('on'); return; }
    const n = Online.list().length;
    chip.textContent = status === 'online' || Online.isConnected() ? `🌐 ${n} online` : '🌐 Connecting…';
    chip.classList.add('on');
  }
  function setOnline(on) {
    if (on && !S.name) { toast('🪪 Pick a trainer name first (👑 menu).'); return; }
    S.online = on; save();
    if (on) {
      Online.start({
        id: S.pid, world: { W, H },
        getState: () => ({ n: S.name, l: S.level, h: zoneName, live: S.mode === 'live', f: P.face, mv: P.moving,
          ...(S.mode === 'live' ? {} : { x: Math.round(P.x), y: Math.round(P.y) }) }),
        onStatus: paintOnline,
        onWave: from => { Music.sfx('ready'); toast(`👋 <b>${esc(from)}</b> waved at you!`, 3000); },
      });
    } else Online.stop();
    paintOnline();
  }
  function showOnline() {
    if (!S.online) { showBag(); return; }
    const list = Online.list().sort((a, b) => a.name.localeCompare(b.name));
    openModal(`<h2>🌐 Trainers online</h2>
      <p class="sub">${Online.isConnected() ? `${list.length} other trainer${list.length === 1 ? '' : 's'} playing right now` : 'Connecting…'}</p>
      <div class="peers">${list.map(p => `<div class="peer"><span class="peer-av" style="background:${lookFor(p.id).blazer}">${esc(p.name[0] || '?')}</span>
        <span class="grow"><b>${esc(p.name)}</b><small>Lv ${p.lvl} · ${esc(p.hood || 'Somewhere in NYC')}${p.live ? ' · 🛰️ Live' : ''}</small></span>
        <button class="ghost" data-wave="${esc(p.id)}">👋 Wave</button></div>`).join('') || '<p class="sub" style="text-align:center;padding:20px 0">Nobody else is online right now. Invite a friend!</p>'}</div>
      <div class="row"><button class="ghost danger" id="go-solo">Go solo</button></div>`);
    document.querySelectorAll('[data-wave]').forEach(el => { el.onclick = () => { Online.wave(el.dataset.wave); el.textContent = '✓ Waved'; el.disabled = true; }; });
    $('#go-solo').onclick = () => { setOnline(false); closeModal(); };
  }
  $('#online-chip').onclick = showOnline;
  setInterval(() => { if (S.online) paintOnline(); }, 3000);

  // Offline support: cache the game files so it keeps working without internet (on the GitHub Pages site).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* not available here */ }); });
  }

  if (!isSafe(P.x, P.y)) { P.x = START.x; P.y = START.y; }
  resize();
  updateHUD();
  paintMode();
  if (S.mode === 'live') startGPS();
  if (S.online && S.name) setOnline(true); else paintOnline();
  Music.play(areaTrack(zone));
  seedSpawns();
  renderNearby();
  if (!S.intro) showHelp(true);
  requestAnimationFrame(frame);
})();
