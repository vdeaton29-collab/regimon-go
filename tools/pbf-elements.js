// Reads an OpenStreetMap .osm.pbf extract and returns the map features inside a bounding box,
// in the same shape the Overpass API returns (ways/relations with inline geometry), plus named places.
// Three quick passes: nodes (coordinates) → relations (which member ways we need) → ways.
const fs = require('fs');
const parser = require('osm-pbf-parser');

const pass = (file, onItems) => new Promise((resolve, reject) => {
  fs.createReadStream(file).pipe(parser()).on('data', onItems).on('end', resolve).on('error', reject);
});

// Same filters as the Overpass queries in build-osm.js
const FEATURE = t => !!(t.highway || t.building || /^(park|garden|playground|pitch|dog_park|recreation_ground)$/.test(t.leisure || '') ||
  /^(grass|recreation_ground|village_green|cemetery)$/.test(t.landuse || '') || /^(water|wood|scrub)$/.test(t.natural || '') ||
  t.man_made === 'pier' || /^(light_rail|rail)$/.test(t.railway || ''));
const REL_FEATURE = t => !!(t.building || /^(park|garden)$/.test(t.leisure || '') || t.natural === 'water');
const POI = t => !!t.name && (/^(school|university|college|place_of_worship|library|theatre|arts_centre|ferry_terminal|community_centre|fire_station)$/.test(t.amenity || '') ||
  /^(museum|attraction|viewpoint|gallery)$/.test(t.tourism || '') || /^(park|stadium|sports_centre|marina)$/.test(t.leisure || '') ||
  /^(station|halt)$/.test(t.railway || '') || /^(monument|memorial|building|ship)$/.test(t.historic || '') || /^(bakery|mall|department_store)$/.test(t.shop || ''));

async function loadPbf(file, [s, w, n, e], margin = 0.01) {
  const S = s - margin, Wd = w - margin, N = n + margin, E = e + margin;
  // pass 1: coordinates of every node near the map (ids arrive sorted, so a sorted array + binary search works)
  let ids = new Float64Array(1 << 22), lats = new Float32Array(1 << 22), lons = new Float32Array(1 << 22), count = 0;
  const pois = [];
  await pass(file, items => {
    for (const it of items) {
      if (it.type !== 'node' || it.lat < S || it.lat > N || it.lon < Wd || it.lon > E) continue;
      if (count === ids.length) {
        const grow = (a, T) => { const b = new T(a.length * 2); b.set(a); return b; };
        ids = grow(ids, Float64Array); lats = grow(lats, Float32Array); lons = grow(lons, Float32Array);
      }
      ids[count] = +it.id; lats[count] = it.lat; lons[count] = it.lon; count++;
      if (it.tags && POI(it.tags) && it.lat >= s && it.lat <= n && it.lon >= w && it.lon <= e) pois.push({ name: it.tags.name, lat: it.lat, lon: it.lon, t: it.tags });
    }
  });
  const find = id => { let lo = 0, hi = count - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ids[m] === id) return m; if (ids[m] < id) lo = m + 1; else hi = m - 1; } return -1; };
  console.log('  nodes near the map:', count);

  // pass 2: relations we care about, and the ways they are made of
  const rels = [], wanted = new Set();
  await pass(file, items => {
    for (const it of items) {
      if (it.type !== 'relation' || !it.tags || !(REL_FEATURE(it.tags) || POI(it.tags))) continue;
      if (it.tags.type && it.tags.type !== 'multipolygon') continue;
      const members = it.members.filter(m => m.type === 'way');
      rels.push({ id: +it.id, tags: it.tags, members });
      for (const m of members) wanted.add(+m.id);
    }
  });

  // pass 3: ways, with their geometry filled in
  const elements = [], memberGeom = new Map();
  await pass(file, items => {
    for (const it of items) {
      if (it.type !== 'way') continue;
      const id = +it.id, t = it.tags || {};
      const isFeature = FEATURE(t), isMember = wanted.has(id), isPoi = POI(t);
      if (!isFeature && !isMember && !isPoi) continue;
      const geometry = [];
      let inside = false;
      for (const ref of it.refs) {
        const k = find(+ref);
        if (k < 0) continue;
        geometry.push({ lat: lats[k], lon: lons[k] });
        if (!inside && lats[k] >= s && lats[k] <= n && lons[k] >= w && lons[k] <= e) inside = true;
      }
      if (geometry.length < 2) continue;
      if (isMember) memberGeom.set(id, geometry);
      if (!inside) continue;
      if (isFeature) elements.push({ type: 'way', id, tags: t, geometry });
      if (isPoi) { const c = geometry.reduce((a, g) => [a[0] + g.lat, a[1] + g.lon], [0, 0]); pois.push({ name: t.name, lat: c[0] / geometry.length, lon: c[1] / geometry.length, t }); }
    }
  });
  for (const r of rels) {
    const members = r.members.map(m => ({ type: 'way', role: m.role, geometry: memberGeom.get(+m.id) })).filter(m => m.geometry);
    if (!members.length) continue;
    const all = members.flatMap(m => m.geometry);
    const c = all.reduce((a, g) => [a[0] + g.lat, a[1] + g.lon], [0, 0]), lat = c[0] / all.length, lon = c[1] / all.length;
    if (lat < s || lat > n || lon < w || lon > e) continue;
    if (REL_FEATURE(r.tags)) elements.push({ type: 'relation', id: r.id, tags: r.tags, members });
    if (POI(r.tags)) pois.push({ name: r.tags.name, lat, lon, t: r.tags });
  }
  console.log('  features:', elements.length, 'named places:', pois.length);
  return { elements, pois };
}
module.exports = { loadPbf };
