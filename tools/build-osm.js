// Builds js/osm.js from OpenStreetMap data (© OpenStreetMap contributors, ODbL).
//   node tools/build-osm.js
// - Coastline for the whole map, turned into land polygons (so every shore and pier is real).
// - Streets, buildings, parks, water, piers and rail for the detailed focus areas.
// - Named places in the focus areas, which become stops in the game.
const fs = require('fs');
const path = require('path');
const { overpass } = require('./overpass.js');
const { loadPbf } = require('./pbf-elements.js');
const PBF_FILE = path.join(__dirname, 'cache', 'NewYork.osm.pbf');   // from https://download.bbbike.org/osm/bbbike/NewYork/

// Must match js/geo.js
const LAT0 = 40.683, LAT1 = 40.800, LON0 = -74.080, LON1 = -73.930, PPM = 2.5;
const MLAT = 111000, MLON = 111320 * Math.cos(40.74 * Math.PI / 180);
const X = lon => (lon - LON0) * MLON * PPM, Y = lat => (LAT1 - lat) * MLAT * PPM;

const FOCUS = [
  { id: 'tribeca', name: 'Tribeca', s: 40.7115, w: -74.0170, n: 40.7270, e: -74.0000 },
  { id: 'hoboken', name: 'Hoboken', s: 40.7340, w: -74.0450, n: 40.7600, e: -74.0200 },
  { id: 'jerseycity', name: 'Jersey City', s: 40.6950, w: -74.0800, n: 40.7460, e: -74.0280 },
];
const CACHE = path.join(__dirname, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

async function cached(name, query) {
  const f = path.join(CACHE, name + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log('fetching', name, '…');
  const data = await overpass(query);
  fs.writeFileSync(f, JSON.stringify(data));
  return data;
}

// ---------- geometry helpers (lon/lat space) ----------
const key = p => p[0].toFixed(7) + ',' + p[1].toFixed(7);
// Join ways that share endpoints into longer chains (keeps each way's direction).
function stitch(ways) {
  const chains = ways.map(w => w.slice());
  let merged = true;
  while (merged) {
    merged = false;
    const byStart = new Map();
    chains.forEach((c, i) => { if (c && key(c[0]) !== key(c[c.length - 1])) byStart.set(key(c[0]), i); });
    for (let i = 0; i < chains.length; i++) {
      const c = chains[i];
      if (!c || key(c[0]) === key(c[c.length - 1])) continue;
      const j = byStart.get(key(c[c.length - 1]));
      if (j !== undefined && j !== i && chains[j]) {
        chains[i] = c.concat(chains[j].slice(1));
        chains[j] = null;
        merged = true;
        byStart.clear();
        break;
      }
    }
  }
  return chains.filter(Boolean);
}
// Stitch ignoring direction (for multipolygon outer rings).
function stitchUndirected(ways) {
  const pool = ways.map(w => w.slice());
  const out = [];
  while (pool.length) {
    let ring = pool.shift();
    let grew = true;
    while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], end = key(ring[ring.length - 1]);
        if (key(w[0]) === end) { ring = ring.concat(w.slice(1)); }
        else if (key(w[w.length - 1]) === end) { ring = ring.concat(w.slice(0, -1).reverse()); }
        else continue;
        pool.splice(i, 1); grew = true; break;
      }
    }
    out.push(ring);
  }
  return out;
}

// Clip a polyline to the map rectangle. Returns pieces; each piece records where it enters/exits the edge.
function clipPolyline(pts) {
  const inside = p => p[0] >= LON0 && p[0] <= LON1 && p[1] >= LAT0 && p[1] <= LAT1;
  const pieces = [];
  let cur = inside(pts[0]) ? [pts[0]] : null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    // Liang–Barsky
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
    const ok = clip(-dx, a[0] - LON0) && clip(dx, LON1 - a[0]) && clip(-dy, a[1] - LAT0) && clip(dy, LAT1 - a[1]);
    if (!ok) { if (cur) { pieces.push(cur); cur = null; } continue; }
    const pa = [a[0] + dx * t0, a[1] + dy * t0], pb = [a[0] + dx * t1, a[1] + dy * t1];
    if (!cur) cur = [pa];
    cur.push(pb);
    if (t1 < 1) { pieces.push(cur); cur = null; }
  }
  if (cur) pieces.push(cur);
  return pieces.filter(p => p.length > 1);
}
// Position along the rectangle edge, counter-clockwise from the bottom-left corner (y up = lat).
const Wd = LON1 - LON0, Hd = LAT1 - LAT0, PER = 2 * (Wd + Hd);
function perim(p) {
  const e = 1e-9;
  if (Math.abs(p[1] - LAT0) < e) return p[0] - LON0;
  if (Math.abs(p[0] - LON1) < e) return Wd + (p[1] - LAT0);
  if (Math.abs(p[1] - LAT1) < e) return Wd + Hd + (LON1 - p[0]);
  return 2 * Wd + Hd + (LAT1 - p[1]);
}
const CORNERS = [[Wd, [LON1, LAT0]], [Wd + Hd, [LON1, LAT1]], [2 * Wd + Hd, [LON0, LAT1]], [PER, [LON0, LAT0]]];

// Coastline (land on the left) → land polygons inside the map rectangle.
function coastToLand(ways) {
  const chains = stitch(ways);
  const rings = [], segs = [];
  for (const c of chains) {
    const closed = key(c[0]) === key(c[c.length - 1]);
    const allIn = c.every(p => p[0] >= LON0 && p[0] <= LON1 && p[1] >= LAT0 && p[1] <= LAT1);
    if (closed && allIn) { rings.push(c); continue; }
    for (const piece of clipPolyline(c)) {
      const s = piece[0], t = piece[piece.length - 1];
      const onEdge = p => Math.abs(p[0] - LON0) < 1e-9 || Math.abs(p[0] - LON1) < 1e-9 || Math.abs(p[1] - LAT0) < 1e-9 || Math.abs(p[1] - LAT1) < 1e-9;
      if (!onEdge(s) || !onEdge(t)) { console.warn('  coastline piece does not touch the edge; skipped', piece.length); continue; }
      segs.push({ pts: piece, tin: perim(s), tout: perim(t), used: false });
    }
  }
  for (const start of segs) {
    if (start.used) continue;
    let poly = [], seg = start, guard = 0;
    while (guard++ < 1000) {
      seg.used = true;
      poly = poly.concat(seg.pts);
      // walk counter-clockwise from the exit to the next entry
      let best = null, bestD = Infinity;
      for (const s of segs) {
        if (s.used && s !== start) continue;
        const d = ((s.tin - seg.tout) % PER + PER) % PER;
        if (d < bestD) { bestD = d; best = s; }
      }
      // add the map corners passed on the way, in order
      const passed = CORNERS.map(([t, c]) => [((t - seg.tout) % PER + PER) % PER, c]).filter(([d]) => d > 0 && d < bestD).sort((a, b) => a[0] - b[0]);
      for (const [, c] of passed) poly.push(c);
      if (best === start) break;
      seg = best;
    }
    rings.push(poly);
  }
  return rings;
}

// Douglas–Peucker simplification in world px. Closed rings are split at their farthest
// point first (a ring's identical first/last points would otherwise collapse it).
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
  if (fx === lx && fy === ly) {
    const ring = pts.slice(0, -1);
    if (ring.length < 3) return ring;
    let far = 1, fd = -1;
    for (let i = 1; i < ring.length; i++) { const d = Math.hypot(ring[i][0] - fx, ring[i][1] - fy); if (d > fd) { fd = d; far = i; } }
    const a = simplifyOpen(ring.slice(0, far + 1), tol), b = simplifyOpen(ring.slice(far).concat([ring[0]]), tol);
    return a.concat(b.slice(1, -1));
  }
  return simplifyOpen(pts, tol);
}
function simplifyOpen(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const toWorld = ll => ll.map(([lon, lat]) => [X(lon), Y(lat)]);
const flat = (pts, tol) => { const s = simplify(pts, tol); const out = []; for (const [x, y] of s) out.push(Math.round(x), Math.round(y)); return out; };
const area = pts => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return Math.abs(a / 2); };
const geomOf = el => (el.geometry || []).filter(Boolean).map(g => [g.lon, g.lat]);

// Outer rings of a way or multipolygon relation.
function polygonsOf(el) {
  if (el.type === 'way') { const g = geomOf(el); return g.length > 3 ? [g] : []; }
  if (el.type === 'relation') {
    const outers = (el.members || []).filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => m.geometry.filter(Boolean).map(g => [g.lon, g.lat]));
    return stitchUndirected(outers).filter(r => r.length > 3);
  }
  return [];
}

const ROAD_CLASS = {
  motorway: 0, trunk: 0, motorway_link: 1, trunk_link: 1, primary: 1, primary_link: 2, secondary: 2, secondary_link: 3, tertiary: 3, tertiary_link: 3,
  residential: 4, unclassified: 4, living_street: 4, road: 4, service: 5, pedestrian: 6, footway: 7, path: 7, cycleway: 7, steps: 7,
};

async function main() {
  // ---- coastline → land ----
  const coast = await cached('coastline', '[out:json][timeout:180];way["natural"="coastline"](40.60,-74.20,40.90,-73.85);out geom;');
  const coastWays = coast.elements.filter(e => e.type === 'way').map(geomOf).filter(g => g.length > 1);
  const landLL = coastToLand(coastWays);
  const land = landLL.map(toWorld).filter(p => area(p) > 400).map(p => flat(p, 2));
  console.log('land polygons', land.length, 'points', land.reduce((s, p) => s + p.length / 2, 0));
  const inRing = (x, y, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const hasLand = (s, w, n, e) => landLL.some(ring => ring.some(([lo, la]) => lo >= w && lo <= e && la >= s && la <= n) ||
    [[w, s], [e, s], [w, n], [e, n], [(w + e) / 2, (s + n) / 2]].some(([lo, la]) => inRing(lo, la, ring)));

  // ---- the whole map, fetched in a 6×6 grid of regions and split into 12×12 chunks ----
  const W = X(LON1), H = Y(LAT0), COLS = 12, ROWS = 12, CW = W / COLS, CH = H / ROWS;
  const chunks = new Map();
  const chunkOf = b => {
    const i = Math.min(COLS - 1, Math.max(0, Math.floor((b[0] + b[2]) / 2 / CW))), j = Math.min(ROWS - 1, Math.max(0, Math.floor((b[1] + b[3]) / 2 / CH)));
    const k = i + '_' + j;
    if (!chunks.has(k)) chunks.set(k, { i, j, names: [], nameIdx: new Map(), roads: [], buildings: [], parks: [], water: [], piers: [], rails: [] });
    return chunks.get(k);
  };
  const nameIn = (c, n) => { if (!n) return -1; if (!c.nameIdx.has(n)) { c.nameIdx.set(n, c.names.length); c.names.push(n); } return c.nameIdx.get(n); };
  const fbox = f => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < f.length; i += 2) { x0 = Math.min(x0, f[i]); x1 = Math.max(x1, f[i]); y0 = Math.min(y0, f[i + 1]); y1 = Math.max(y1, f[i + 1]); } return [x0, y0, x1, y1]; };
  const seen = new Set();
  const namedParks = [], pois = [];
  // With a local extract, everything comes from one "region"; otherwise query Overpass in a 12×12 grid.
  const PBF = fs.existsSync(PBF_FILE) ? await loadPbf(PBF_FILE, [LAT0, LON0, LAT1, LON1]) : null;
  if (PBF) console.log('using local extract', PBF_FILE);
  const RX = PBF ? 1 : 12, RY = PBF ? 1 : 12, dLat = (LAT1 - LAT0) / 12, dLon = (LON1 - LON0) / 12;
  const counts = { roads: 0, buildings: 0, parks: 0 };
  for (let ry = 0; ry < RY; ry++) for (let rx = 0; rx < RX; rx++) {
    const s = LAT0 + ry * dLat, w = LON0 + rx * dLon, n = s + dLat, e = w + dLon;
    if (PBF) { /* single pass over the local extract */ }
    const b = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`;
    if (!PBF && !hasLand(s, w, n, e)) { console.log(`region ${rx},${ry}: all water, skipped`); continue; }
    const fresh = !PBF && !fs.existsSync(path.join(CACHE, `region-${rx}-${ry}.json`));
    if (fresh) await new Promise(r => setTimeout(r, 4000));
    const data = PBF ? { elements: PBF.elements } : await cached(`region-${rx}-${ry}`, `[out:json][timeout:180];(
      way["highway"](${b});
      way["building"](${b}); relation["building"](${b});
      way["leisure"~"^(park|garden|playground|pitch|dog_park|recreation_ground)$"](${b}); relation["leisure"~"^(park|garden)$"](${b});
      way["landuse"~"^(grass|recreation_ground|village_green|cemetery)$"](${b});
      way["natural"~"^(water|wood|scrub)$"](${b}); relation["natural"="water"](${b});
      way["man_made"="pier"](${b});
      way["railway"~"^(light_rail|rail)$"](${b});
    );out geom;`);
    for (const el of data.elements) {
      const id = el.type + el.id;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = el.tags || {};
      const put = (kind, p, make) => { if (p.length < 4) return; const c = chunkOf(fbox(p)); c[kind].push(make(c)); };
      if (t.highway) {
        if (t.tunnel === 'yes' || t.tunnel === 'building_passage' || (+t.layer || 0) < 0 || t.highway === 'construction' || t.highway === 'proposed') continue;
        const cls = ROAD_CLASS[t.highway];
        if (cls === undefined) continue;
        if (t.area === 'yes' || t.footway === 'sidewalk' || t.footway === 'crossing' || t.highway === 'steps' || t.service === 'parking_aisle' || t.service === 'driveway') continue;
        const g = geomOf(el); if (g.length < 2) continue;
        const p = flat(toWorld(g), 1.2);
        put('roads', p, c => [cls, nameIn(c, t.name), p]); counts.roads++;
      } else if (t.building) {
        for (const ring of polygonsOf(el)) { const p = flat(toWorld(ring), 1); put('buildings', p, () => [Math.min(60, +t['building:levels'] || (t.building === 'house' ? 2 : 4)), p]); counts.buildings++; }
      } else if (t.leisure || t.landuse || t.natural === 'wood' || t.natural === 'scrub') {
        const kind = t.leisure === 'pitch' ? 'pitch' : t.leisure === 'playground' ? 'play' : t.landuse === 'cemetery' ? 'cemetery' : 'park';
        for (const ring of polygonsOf(el)) {
          const wpts = toWorld(ring), a = area(wpts);
          if (a < 200) continue;
          const p = flat(wpts, 1.5);
          put('parks', p, c => [kind, nameIn(c, t.name), p]); counts.parks++;
          if (kind === 'park' && t.name && a > 2500 * PPM * PPM) namedParks.push([t.name, flat(wpts, 6)]);
        }
      } else if (t.natural === 'water') {
        for (const ring of polygonsOf(el)) { const p = flat(toWorld(ring), 1.5); put('water', p, () => p); }
      } else if (t.man_made === 'pier') {
        const g = geomOf(el), closed = g.length > 3 && key(g[0]) === key(g[g.length - 1]);
        const p = flat(toWorld(g), 1); put('piers', p, () => [closed ? 1 : 0, p]);
      } else if (t.railway) {
        if (t.tunnel === 'yes' || (+t.layer || 0) < 0) continue;
        const p = flat(toWorld(geomOf(el)), 1.2); put('rails', p, () => p);
      }
    }
    console.log(`region ${rx},${ry} done: roads ${counts.roads}, buildings ${counts.buildings}`);
  }
  // ---- named places for the whole map, in one query ----
  const allB = `${LAT0},${LON0},${LAT1},${LON1}`;
  const poiData = PBF ? { elements: [] } : await cached('pois-all', `[out:json][timeout:180];(
    nwr["amenity"~"^(school|university|college|place_of_worship|library|theatre|arts_centre|ferry_terminal|community_centre|fire_station)$"]["name"](${allB});
    nwr["tourism"~"^(museum|attraction|viewpoint|gallery)$"]["name"](${allB});
    nwr["leisure"~"^(park|stadium|sports_centre|marina)$"]["name"](${allB});
    nwr["railway"~"^(station|halt)$"]["name"](${allB});
    nwr["historic"~"^(monument|memorial|building|ship)$"]["name"](${allB});
    nwr["shop"~"^(bakery|mall|department_store)$"]["name"](${allB});
  );out center tags;`);
  for (const el of poiData.elements) {
    const t = el.tags || {}, lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (!t.name || lat == null) continue;
    const area = Math.floor((lon - LON0) / dLon) + '-' + Math.floor((lat - LAT0) / dLat);
    pois.push({ area, name: t.name, lat: +lat.toFixed(6), lon: +lon.toFixed(6), t });
  }
  if (PBF) for (const p of PBF.pois) {
    const area = Math.floor((p.lon - LON0) / dLon) + '-' + Math.floor((p.lat - LAT0) / dLat);
    pois.push({ area, name: p.name, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), t: p.t });
  }

  // ---- write chunk files ----
  const dir = path.join(__dirname, '..', 'js', 'osm');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const list = [];
  let total = 0;
  for (const c of chunks.values()) {
    const json = JSON.stringify({ names: c.names, roads: c.roads, buildings: c.buildings, parks: c.parks, water: c.water, piers: c.piers, rails: c.rails });
    fs.writeFileSync(path.join(dir, `c_${c.i}_${c.j}.json`), json);
    list.push([c.i, c.j, json.length]);
    total += json.length;
  }
  const out = { attribution: '© OpenStreetMap contributors (ODbL)', land, cols: COLS, rows: ROWS, cw: CW, ch: CH, chunks: list, namedParks, pois: pickPois(pois) };
  const js = '// Generated by tools/build-osm.js from OpenStreetMap data. © OpenStreetMap contributors, ODbL 1.0.\nwindow.RGOSM = ' + JSON.stringify(out) + ';\n';
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'osm.js'), js);
  console.log('chunks', list.length, 'chunk data', (total / 1024 / 1024).toFixed(1), 'MB; osm.js', (js.length / 1024).toFixed(0), 'KB; pois', out.pois.length, 'named parks', namedParks.length);
}

// Turn named places into game stops: zone, icon, and a short description.
function pickPois(list) {
  const kind = t => {
    if (t.railway || t.amenity === 'ferry_terminal') return ['subway', t.amenity === 'ferry_terminal' ? '⛴️' : '🚉', 'Trains and ferries connect here.'];
    if (['school', 'university', 'college'].includes(t.amenity)) return ['school', '🏫', 'A school — Brainy Regimon hang around after class.'];
    if (t.amenity === 'place_of_worship') return ['church', t.religion === 'jewish' ? '🕍' : t.religion === 'muslim' ? '🕌' : '⛪', 'A house of worship — Spirit-type Regimon gather here.'];
    if (t.amenity === 'library') return ['school', '📚', 'A public library. Quiet, please.'];
    if (t.amenity === 'theatre' || t.amenity === 'arts_centre') return ['music', '🎭', 'Shows and concerts all year.'];
    if (t.tourism === 'museum' || t.tourism === 'gallery') return ['museum', '🖼️', 'A museum — Ancient Regimon lurk in the galleries.'];
    if (t.leisure === 'stadium' || t.leisure === 'sports_centre') return ['sports', '🏟️', 'Athletic Regimon train here.'];
    if (t.leisure === 'marina') return ['harbor', '⛵', 'Boats bob in the marina.'];
    if (t.leisure === 'park') return ['', '🌳', 'A neighborhood park.'];
    if (t.shop === 'bakery') return ['', '🥐', 'Fresh bread every morning.'];
    if (t.shop) return ['', '🛍️', 'Shopping stop.'];
    if (t.tourism === 'viewpoint') return ['', '📸', 'A great view of the skyline.'];
    if (t.amenity === 'fire_station') return ['', '🚒', 'A firehouse. Hydrantula hangs around here.'];
    if (t.amenity === 'community_centre') return ['', '🏠', 'A community center.'];
    return ['', '📍', 'A local landmark.'];
  };
  const byName = new Map();
  for (const p of list) if (!byName.has(p.name)) byName.set(p.name, p);
  const out = [];
  const perArea = {};
  // favor more interesting kinds first
  const rank = p => (p.t.railway || p.t.amenity === 'ferry_terminal' ? 0 : p.t.tourism ? 1 : p.t.leisure === 'park' ? 2 : p.t.amenity === 'place_of_worship' ? 3 : 4);
  for (const p of [...byName.values()].sort((a, b) => rank(a) - rank(b))) {
    perArea[p.area] = (perArea[p.area] || 0) + 1;
    if (perArea[p.area] > 14) continue;
    // keep stops at least ~60 m apart
    if (out.some(o => Math.abs(o.lat - p.lat) < 0.00055 && Math.abs(o.lon - p.lon) < 0.0007)) continue;
    const [zone, icon, blurb] = kind(p.t);
    out.push({ name: p.name, lat: p.lat, lon: p.lon, zone, icon, blurb });
  }
  return out;
}

main().catch(e => { console.error(e); process.exit(1); });
