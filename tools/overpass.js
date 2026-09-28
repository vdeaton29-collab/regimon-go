// Small helper for querying the OpenStreetMap Overpass API (used by build-osm.js).
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'RegimonGO-mapbuilder/1.0 (fan game map build)', Accept: 'application/json' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  throw lastErr;
}
module.exports = { overpass };
