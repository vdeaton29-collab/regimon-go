// Small helper for querying the OpenStreetMap Overpass API (used by build-osm.js).
// Public Overpass servers get busy, so this rotates between mirrors and backs off between retries.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 10; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'RegimonGO-mapbuilder/1.0 (fan game map build)', Accept: 'application/json' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(420000),
      });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      const json = await res.json();
      if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw new Error(`${url} -> ${json.remark}`);
      return json;
    } catch (e) {
      lastErr = e;
      console.log('  retry', attempt + 1, e.message);
      await new Promise(r => setTimeout(r, /429/.test(e.message) ? 65000 : Math.min(60000, 10000 * (attempt + 1))));
    }
  }
  throw lastErr;
}
module.exports = { overpass };
