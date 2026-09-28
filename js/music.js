// Regimon GO — chiptune music and sound effects, synthesized with Web Audio (no audio files).
window.RGMusic = (() => {
  const PREF_KEY = 'regimon-muted';
  let muted = false;
  try { muted = localStorage.getItem(PREF_KEY) === '1'; } catch (e) { /* ignore */ }

  let ac = null, master, musicBus, sfxBus, noiseBuf;
  let track = null, wanted = 'map', step = 0, nextTime = 0, timer = null;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function midi(n) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (+m[3] + 1) + base;
  }

  // Melody is written one token per eighth note; '.' holds the previous note, '_' is a rest.
  function compile(t) {
    const toks = t.melody.trim().split(/\s+/);
    const events = [];
    toks.forEach((tok, i) => {
      if (tok === '.' || tok === '_') { if (tok === '.' && events.length && events[events.length - 1].end === i) events[events.length - 1].end++; return; }
      events.push({ step: i, midi: midi(tok), end: i + 1 });
    });
    t.len = toks.length;
    t.events = {};
    for (const e of events) t.events[e.step] = { midi: e.midi, len: e.end - e.step };
    t.roots = t.bass.map(midi);
    return t;
  }

  const TRACKS = {
    // Walking around 84th Street — bright C major.
    map: compile({
      bpm: 132, lead: 'square', leadVol: 0.085,
      melody: `E5 . G5 . C6 . B5 A5   G5 . E5 . C5 . D5 E5   F5 . A5 . D6 . C6 B5   A5 . . . G5 . _ _
               E5 . G5 . C6 . B5 A5   G5 . E5 . C5 . E5 G5   F5 . E5 . D5 . B4 D5   C5 . . . _ _ _ _
               A4 . C5 . E5 . C5 .    F5 . E5 . D5 . C5 .    G4 . B4 . D5 . G5 .    E5 . . . D5 . _ _
               A4 . C5 . E5 . A5 .    G5 . F5 . E5 . D5 .    F5 . . E5 D5 . B4 .    C5 . . . _ _ _ _`,
      bass: ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'D3', 'C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'E2', 'G2', 'C3'],
      bassPat: [0, null, 7, null, 12, null, 7, null],
      kick: [0, 4], snare: [], hat: [1, 3, 5, 7],
    }),
    // Wild encounter — driving A minor.
    battle: compile({
      bpm: 156, lead: 'square', leadVol: 0.08,
      melody: `A4 . C5 . E5 . A5 .   G5 . E5 . C5 . D5 E5   F5 . . E5 D5 . C5 .   B4 . . . E5 . . .
               A4 . C5 . E5 . A5 .   B5 . A5 . G5 . E5 .    F5 . E5 . D5 . B4 .   A4 . . . _ _ E5 _`,
      bass: ['A2', 'C3', 'F2', 'E2', 'A2', 'G2', 'D2', 'A2'],
      bassPat: [0, 0, 12, 0, 0, 12, 0, 12],
      kick: [0, 3, 4], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7],
    }),
    // Trainer battle — heroic D minor with a big finish on each loop.
    fight: compile({
      bpm: 168, lead: 'square', leadVol: 0.08,
      melody: `D5 . F5 . A5 . D6 .   C6 . A5 . F5 . G5 A5   Bb5 . . A5 G5 . F5 .   E5 . G5 . A5 . . .
               D5 . F5 . A5 . D6 .   E6 . D6 . C6 . A5 .    Bb5 . A5 . G5 . E5 .   D5 . . . A4 . D5 .
               F5 . E5 . D5 . C5 .   D5 . . . A4 . . .      Bb4 . C5 . D5 . F5 .   E5 . . . A5 . . .
               D6 . C6 . Bb5 . A5 .  G5 . F5 . E5 . D5 .    E5 . F5 . G5 . E5 .    D5 . . . _ _ _ _`,
      bass: ['D2', 'F2', 'G2', 'A2', 'D2', 'C3', 'G2', 'D2', 'D2', 'A2', 'G2', 'A2', 'Bb2', 'C3', 'A2', 'D2'],
      bassPat: [0, 12, 0, 12, 0, 12, 7, 12],
      kick: [0, 2, 4, 6], snare: [2, 6], hat: [1, 3, 5, 7],
    }),
  };

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.9; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(freq, t, len, type, vol, dest, slideTo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, len - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + len + 0.02);
  }
  function noise(t, len, vol, dest, filter, freq, freqTo) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = filter; f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + len);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }

  function playStep(t, i, time, dur) {
    const ev = t.events[i];
    if (ev) {
      tone(mtof(ev.midi), time, ev.len * dur * 0.92, t.lead, t.leadVol, musicBus);
      tone(mtof(ev.midi - 12), time, ev.len * dur * 0.92, 'triangle', t.leadVol * 0.7, musicBus);
    }
    const bar = Math.floor(i / 8) % t.roots.length, b = i % 8, off = t.bassPat[b];
    if (off !== null) tone(mtof(t.roots[bar] + off), time, dur * 0.85, 'triangle', 0.2, musicBus);
    if (t.kick.includes(b)) tone(150, time, 0.12, 'sine', 0.35, musicBus, 45);
    if (t.snare.includes(b)) noise(time, 0.12, 0.16, musicBus, 'bandpass', 1800);
    if (t.hat.includes(b)) noise(time, 0.035, 0.07, musicBus, 'highpass', 7000);
  }

  function schedule() {
    if (!track || !ac) return;
    const dur = 60 / track.bpm / 2;
    if (nextTime < ac.currentTime - 0.25) nextTime = ac.currentTime + 0.05; // tab was in the background
    while (nextTime < ac.currentTime + 0.15) {
      playStep(track, step, nextTime, dur);
      step = (step + 1) % track.len;
      nextTime += dur;
    }
  }

  function play(name) {
    wanted = name;
    if (!ac || ac.state !== 'running') return;
    if (track === TRACKS[name]) return;
    track = TRACKS[name]; step = 0;
    nextTime = ac.currentTime + 0.08;
    // brief fade so switching songs does not click
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ac.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(0.9, ac.currentTime + 0.3);
    if (!timer) timer = setInterval(schedule, 25);
  }

  // Must be called from a user gesture: browsers only allow audio after one.
  function unlock() {
    if (!ensure()) return;
    const go = () => { track = null; play(wanted); };
    if (ac.state === 'suspended') ac.resume().then(go).catch(() => {});
    else if (!track) go();
  }

  function duck(seconds) {
    if (!ac) return;
    const now = ac.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(0.15, now);
    musicBus.gain.setValueAtTime(0.15, now + seconds);
    musicBus.gain.linearRampToValueAtTime(0.9, now + seconds + 0.6);
  }

  const SFX = {
    throw: t => noise(t, 0.28, 0.25, sfxBus, 'bandpass', 700, 3200),
    pop: t => { tone(880, t, 0.1, 'square', 0.12, sfxBus, 330); tone(1320, t + 0.05, 0.12, 'triangle', 0.12, sfxBus); },
    wobble: t => { tone(240, t, 0.07, 'triangle', 0.25, sfxBus); tone(200, t + 0.12, 0.07, 'triangle', 0.2, sfxBus); },
    catch: t => {
      duck(1.4);
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.1, 0.12, 'square', 0.1, sfxBus));
      ['C5', 'E5', 'G5', 'C6'].forEach(n => tone(mtof(midi(n)), t + 0.45, 0.7, 'square', 0.05, sfxBus));
    },
    break: t => { noise(t, 0.35, 0.3, sfxBus, 'lowpass', 2500, 300); tone(300, t, 0.25, 'square', 0.08, sfxBus, 120); },
    fled: t => { duck(1); ['E5', 'C5', 'A4'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.13, 0.14, 'square', 0.08, sfxBus)); },
    spin: t => ['G5', 'B5', 'D6', 'G6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.06, 0.09, 'square', 0.07, sfxBus)),
    encounter: t => ['A4', 'C5', 'E5', 'A5'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.05, 0.08, 'square', 0.07, sfxBus)),
    hit: t => { noise(t, 0.16, 0.3, sfxBus, 'lowpass', 1800, 200); tone(180, t, 0.14, 'square', 0.08, sfxBus, 60); },
    superhit: t => { noise(t, 0.3, 0.4, sfxBus, 'lowpass', 3500, 150); tone(300, t, 0.25, 'sawtooth', 0.08, sfxBus, 50); },
    weakhit: t => noise(t, 0.08, 0.15, sfxBus, 'lowpass', 900),
    buff: t => ['C5', 'G5', 'C6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.07, 0.1, 'triangle', 0.12, sfxBus)),
    debuff: t => ['C6', 'G5', 'C5'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.07, 0.1, 'triangle', 0.12, sfxBus)),
    heal: t => ['E5', 'G5', 'B5', 'E6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.08, 0.16, 'sine', 0.15, sfxBus)),
    faint: t => tone(600, t, 0.6, 'square', 0.08, sfxBus, 80),
    miss: t => noise(t, 0.2, 0.12, sfxBus, 'highpass', 3000, 8000),
    victory: t => {
      duck(2.4);
      [['G4', 0], ['C5', 0.15], ['E5', 0.3], ['G5', 0.45], ['E5', 0.75], ['G5', 0.9]].forEach(([n, d]) => tone(mtof(midi(n)), t + d, 0.14, 'square', 0.1, sfxBus));
      ['C5', 'E5', 'G5', 'C6'].forEach(n => tone(mtof(midi(n)), t + 1.1, 1.0, 'square', 0.05, sfxBus));
    },
    defeat: t => { duck(2); ['E5', 'D5', 'C5', 'A4'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.25, 0.3, 'triangle', 0.14, sfxBus)); },
    levelup: t => {
      duck(1.8);
      ['C5', 'C5', 'C5', 'G5', 'E5', 'C6'].forEach((n, i) => tone(mtof(midi(n)), t + [0, 0.12, 0.24, 0.36, 0.6, 0.72][i], i === 5 ? 0.8 : 0.1, 'square', 0.1, sfxBus));
    },
  };
  function sfx(name) {
    if (!ac || ac.state !== 'running' || muted) return;
    SFX[name](ac.currentTime + 0.01);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(PREF_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (ac) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05);
  }

  return { play, unlock, sfx, setMuted, isMuted: () => muted };
})();
