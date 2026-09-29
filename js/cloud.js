// Regimon GO — trainer accounts: save your progress with a username and password.
// There is no game server, so the save is end-to-end encrypted in the browser and stored as a retained message
// on three public MQTT brokers (so one being slow or wiped doesn't lose it). The username and password are turned into two secrets with PBKDF2:
//   • an AES-GCM key that encrypts the save, and
//   • a random-looking storage address. Without both the username and password nobody can find or read it.
// The password itself never leaves the device.
window.RGCloud = (() => {
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt', 'wss://broker.hivemq.com:8884/mqtt'], ROOT = 'regimongo/v1/save/';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const available = () => !!(window.crypto && crypto.subtle && window.WebSocket);

  // username + password → { key, topic }
  async function derive(user, pass) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('regimongo-account-v1:' + user.trim().toLowerCase()), iterations: 200000 }, base, 512));
    return { raw: b64(bits.slice(0, 32)), topic: ROOT + hex(bits.slice(32)) };
  }
  const aesKey = raw => crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function pack(obj, raw) {
    let data = enc.encode(JSON.stringify(obj)), zip = 0;
    if (window.CompressionStream) { data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); zip = 1; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw), data));
    return JSON.stringify({ v: 1, z: zip, iv: b64(iv), d: b64(ct), t: Date.now() });
  }
  async function unpack(text, raw) {
    const m = JSON.parse(text);
    let data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, await aesKey(raw), unb64(m.d)));
    if (m.z) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return { state: JSON.parse(dec.decode(data)), savedAt: m.t };
  }

  // One short MQTT session: optionally publish a retained message, then read back whatever is stored on the topic.
  function session(broker, topic, payload, timeout = 6000) {
    return new Promise((resolve, reject) => {
      const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
      const remLen = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };
      const packet = (type, body) => { const h = new Uint8Array([type, ...remLen(body.length)]); const p = new Uint8Array(h.length + body.length); p.set(h); p.set(body, h.length); return p; };
      let ws, buf = new Uint8Array(0), done = false;
      const finish = (err, val) => {
        if (done) return; done = true; clearTimeout(timer);
        try { ws.send(new Uint8Array([0xe0, 0])); ws.close(); } catch (e) { /* ignore */ }
        err ? reject(err) : resolve(val);
      };
      // No retained message within the wait means nothing is saved there.
      const timer = setTimeout(() => finish(payload ? new Error('timeout') : null, null), timeout);
      try { ws = new WebSocket(broker, ['mqtt']); } catch (e) { finish(e); return; }
      ws.binaryType = 'arraybuffer';
      ws.onerror = () => finish(new Error('network'));
      ws.onopen = () => ws.send(packet(0x10, new Uint8Array([...str('MQTT'), 4, 0x02, 0, 30, ...str('rgs-' + Math.random().toString(36).slice(2, 12))])));
      ws.onmessage = e => {
        const chunk = new Uint8Array(e.data), merged = new Uint8Array(buf.length + chunk.length); merged.set(buf); merged.set(chunk, buf.length); buf = merged;
        for (;;) {
          if (buf.length < 2) return;
          let len = 0, mul = 1, i = 1, b;
          do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
          if (buf.length < i + len) return;
          const h = buf[0], body = buf.subarray(i, i + len);
          buf = buf.slice(i + len);
          if (h >> 4 === 2) {   // CONNACK
            if (body[1] !== 0) { finish(new Error('refused')); return; }
            if (payload) {
              const pl = enc.encode(payload), tp = str(topic), p = new Uint8Array(tp.length + pl.length); p.set(tp); p.set(pl, tp.length);
              ws.send(packet(0x31, p));   // PUBLISH, retained
            }
            ws.send(packet(0x82, new Uint8Array([0, 1, ...str(topic), 0])));   // SUBSCRIBE: the broker replies with the stored copy
          } else if (h >> 4 === 3) {
            const tl = (body[0] << 8) | body[1];
            const text = dec.decode(body.subarray(2 + tl));
            if (payload && text !== payload) return;   // an older copy; wait for ours
            finish(null, text);
          }
        }
      };
    });
  }

  // Ask every broker; once one answers, give the others a moment to catch up, then use what arrived.
  function ask(fn, timeout) {
    return new Promise(resolve => {
      const results = [];
      let left = BROKERS.length, grace = null;
      const done = () => { clearTimeout(grace); resolve(results); };
      BROKERS.forEach(br => fn(br, timeout).then(v => { if (v) { results.push(v); if (!grace) grace = setTimeout(done, 1500); } }, () => {})
        .finally(() => { if (--left === 0) done(); }));
    });
  }
  // Returns the newest save that decrypts, or null.
  async function load(acct) {
    const texts = await ask((br, t) => session(br, acct.topic, null, t), 8000);
    let best = null;
    for (const text of texts) {
      try { const r = await unpack(text, acct.raw); if (!best || r.savedAt > best.savedAt) best = r; } catch (e) { /* damaged copy */ }
    }
    return best;
  }
  async function exists(acct) { return !!(await load(acct)); }
  async function save(acct, state) {
    const payload = await pack(state, acct.raw);
    const stored = await ask((br, t) => session(br, acct.topic, payload, t).then(back => back === payload), 12000);
    if (!stored.length) throw new Error('not stored');
    return Date.now();
  }
  return { available, derive, exists, save, load };
})();
