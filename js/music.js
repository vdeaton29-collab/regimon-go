// Regimon GO — chiptune music and sound effects, synthesized with Web Audio (no audio files).
window.RGMusic = (() => {
  const PREF_KEY = 'regimon-muted';
  let muted = false;
  try { muted = localStorage.getItem(PREF_KEY) === '1'; } catch (e) { /* ignore */ }

  let ac = null, master, musicBus, sfxBus, leadBus, noiseBuf;
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
    // Central Park — gentle F major.
    park: compile({
      bpm: 100, lead: 'triangle', leadVol: 0.13,
      melody: `F5 . A5 . C6 . . .   A5 . G5 . F5 . . .   G5 . A5 . Bb5 . A5 G5   A5 . . . . . _ _
               F5 . A5 . C6 . D6 .  C6 . A5 . F5 . . .   G5 . F5 . E5 . G5 .    F5 . . . . . _ _`,
      bass: ['F2', 'D2', 'Bb2', 'F2', 'F2', 'D2', 'C3', 'F2'],
      bassPat: [0, null, 7, null, 12, null, 7, null],
      kick: [0], snare: [], hat: [2, 6],
    }),
    // Midtown at night — jazzy D minor.
    city: compile({
      bpm: 118, lead: 'square', leadVol: 0.07,
      melody: `D5 . F5 A5 _ C6 . A5   G5 . F5 . D5 . . .   E5 . G5 Bb5 _ D6 . Bb5   A5 . . . . . _ _
               D5 . F5 A5 _ C6 . D6   E6 . D6 . C6 . A5 .   G5 . E5 . C5 . D5 .     D5 . . . . . _ _`,
      bass: ['D2', 'G2', 'C3', 'F2', 'D2', 'A2', 'C3', 'D2'],
      bassPat: [0, null, 3, null, 7, null, 10, null],
      kick: [0, 4], snare: [2, 6], hat: [1, 3, 5, 7],
    }),
    // Across the Hudson — bright G major.
    jersey: compile({
      bpm: 138, lead: 'square', leadVol: 0.08,
      melody: `G5 . B5 . D6 . B5 .   C6 . A5 . F#5 . D5 .   G5 . B5 . D6 . G6 .    F#6 . D6 . A5 . . .
               E6 . C6 . A5 . C6 .   D6 . B5 . G5 . B5 .    A5 . F#5 . D5 . F#5 .  G5 . . . _ _ _ _`,
      bass: ['G2', 'D2', 'G2', 'D2', 'C3', 'G2', 'D2', 'G2'],
      bassPat: [0, null, 7, 12, 0, null, 7, 12],
      kick: [0, 4], snare: [2, 6], hat: [1, 3, 5, 7],
    }),
    // The harbor — a sea shanty in A minor.
    harbor: compile({
      bpm: 112, lead: 'triangle', leadVol: 0.14,
      melody: `A4 . . C5 E5 . . A5   G5 . E5 . C5 . . .   D5 . . F5 A5 . . D6   C6 . B5 . A5 . . .
               E5 . . G5 B5 . . E6   D6 . B5 . G5 . . .   A5 . G5 . E5 . C5 .   A4 . . . _ _ _ _`,
      bass: ['A2', 'C3', 'D3', 'A2', 'E2', 'G2', 'A2', 'A2'],
      bassPat: [0, null, null, 7, null, null, 12, null],
      kick: [0, 3, 6], snare: [], hat: [2, 5],
    }),
    // Top arena leaders and high-rank league battles — intense E minor.
    boss: compile({
      bpm: 176, lead: 'sawtooth', leadVol: 0.06,
      melody: `E5 E5 G5 E5 B5 . A5 G5   F#5 . E5 . D5 . F#5 .   E5 E5 G5 E5 C6 . B5 A5   B5 . . . F#5 . . .
               E6 . D6 . B5 . G5 .      A5 . G5 . F#5 . D5 .    E5 . G5 . B5 . E6 .      D#6 . . . B5 . . .`,
      bass: ['E2', 'D2', 'C2', 'B1', 'E2', 'D2', 'C2', 'B1'],
      bassPat: [0, 0, 12, 0, 0, 12, 0, 12],
      kick: [0, 2, 4, 6], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7],
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
      arp: [0, 3, 7, 12, 7, 3], fill: true,
    }),
    // Gym battles — heroic C minor in the same style as the trainer-battle theme.
    gym: compile({
      bpm: 170, lead: 'square', leadVol: 0.08, arp: [0, 3, 7, 10, 12, 7], fill: true, harm: -5,
      melody: `C5 . Eb5 . G5 . C6 .   Bb5 . Ab5 . G5 . Eb5 F5   G5 . . F5 Eb5 . D5 .   D5 . F5 . G5 . . .
               C5 . Eb5 . G5 . C6 .   D6 . C6 . Bb5 . Ab5 .     G5 . F5 . Eb5 . D5 .   C5 . . . G4 . C5 .
               Eb5 . D5 . C5 . Bb4 .  C5 . . . G4 . . .         Ab4 . Bb4 . C5 . Eb5 .  D5 . . . G5 . . .
               C6 . Bb5 . Ab5 . G5 .  F5 . Eb5 . D5 . C5 .      D5 . Eb5 . F5 . D5 .    C5 . . . _ _ _ _`,
      bass: ['C2', 'Ab2', 'Bb2', 'G2', 'C2', 'Bb2', 'F2', 'C2', 'Ab2', 'C2', 'Ab2', 'G2', 'Ab2', 'F2', 'G2', 'C2'],
      bassPat: [0, 12, 0, 12, 0, 12, 7, 12],
      kick: [0, 2, 4, 6], snare: [2, 6], hat: [1, 3, 5, 7],
    }),
    // Online duels against real trainers — E minor, fast and heroic.
    duel: compile({
      bpm: 174, lead: 'sawtooth', leadVol: 0.055, arp: [0, 7, 12, 15, 12, 7], arpVol: 0.02, fill: true,
      melody: `E5 . G5 . B5 . E6 .   D6 . B5 . G5 . A5 B5    C6 . . B5 A5 . G5 .    F#5 . A5 . B5 . . .
               E5 . G5 . B5 . E6 .   F#6 . E6 . D6 . B5 .    C6 . B5 . A5 . F#5 .   E5 . . . B4 . E5 .
               G5 . F#5 . E5 . D5 .  E5 . . . B4 . . .       C5 . D5 . E5 . G5 .    F#5 . . . B5 . . .
               E6 . D6 . C6 . B5 .   A5 . G5 . F#5 . E5 .    F#5 . G5 . A5 . F#5 .  E5 . . . _ _ _ _`,
      bass: ['E2', 'G2', 'A2', 'B2', 'E2', 'D3', 'A2', 'E2', 'E2', 'B2', 'A2', 'B2', 'C3', 'D3', 'B2', 'E2'],
      bassPat: [0, 12, 0, 12, 0, 12, 7, 12],
      kick: [0, 2, 3, 4, 6], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7],
    }),
    // Riding the subway and exploring the stations — driving G minor.
    subway: compile({
      bpm: 160, lead: 'square', leadVol: 0.075, arp: [0, 3, 7, 12], fill: true,
      melody: `G4 . Bb4 D5 _ G5 . F5   D5 . Bb4 . C5 D5 . .   Eb5 . D5 C5 _ Bb4 . A4   D5 . . . _ _ _ _
               G4 . Bb4 D5 _ G5 . A5   Bb5 . A5 . G5 . F5 .   Eb5 . F5 G5 _ D5 . C5    G4 . . . _ _ _ _`,
      bass: ['G2', 'G2', 'Eb2', 'D2', 'G2', 'Bb2', 'C3', 'D2'],
      bassPat: [0, null, 12, 0, null, 12, 7, null],
      kick: [0, 3, 4], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7],
    }),
    // Legendary and Mythic encounters — dramatic B minor.
    legend: compile({
      bpm: 148, lead: 'sawtooth', leadVol: 0.06, arp: [0, 7, 12, 15, 19, 15], arpVol: 0.025, fill: true, harm: -12,
      melody: `B4 . . . F#5 . . .   D5 . E5 . F#5 . . .   G5 . . . F#5 . E5 .   F#5 . . . . . _ _
               B4 . . . F#5 . . .   B5 . A5 . F#5 . . .   G5 . A5 . B5 . D6 .   C#6 . . . . . _ _`,
      bass: ['B1', 'G2', 'E2', 'F#2', 'B1', 'G2', 'E2', 'F#2'],
      bassPat: [0, 0, 12, 0, 0, 12, 0, 12],
      kick: [0, 2, 4, 6], snare: [4], hat: [0, 2, 4, 6],
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
    // the lead melody gets a short echo, which makes the chiptune sound much bigger
    leadBus = ac.createGain(); leadBus.connect(musicBus);
    const echo = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), damp = ac.createBiquadFilter();
    echo.delayTime.value = 0.19; fb.gain.value = 0.3; wet.gain.value = 0.32; damp.type = 'lowpass'; damp.frequency.value = 2600;
    leadBus.connect(echo); echo.connect(damp); damp.connect(fb); fb.connect(echo); damp.connect(wet); wet.connect(musicBus);
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
      tone(mtof(ev.midi), time, ev.len * dur * 0.92, t.lead, t.leadVol, leadBus);
      tone(mtof(ev.midi - 12), time, ev.len * dur * 0.92, 'triangle', t.leadVol * 0.7, musicBus);
      if (t.harm) tone(mtof(ev.midi + t.harm), time, ev.len * dur * 0.9, 'square', t.leadVol * 0.35, musicBus);
    }
    const bar = Math.floor(i / 8) % t.roots.length, b = i % 8, off = t.bassPat[b];
    // 16th-note arpeggio over the bar's chord
    if (t.arp) for (let k = 0; k < 2; k++) {
      const n = t.roots[bar] + 24 + t.arp[(b * 2 + k) % t.arp.length];
      tone(mtof(n), time + k * dur / 2, dur * 0.42, 'square', t.arpVol || 0.022, musicBus);
    }
    // drum fill on the last bar of each loop
    if (t.fill && i >= t.len - 4) { noise(time, 0.1, 0.14, musicBus, 'bandpass', 1400 + (i - t.len + 4) * 300); noise(time + dur / 2, 0.08, 0.1, musicBus, 'bandpass', 1600 + (i - t.len + 4) * 300); tone(200 - (i - t.len + 4) * 30, time, 0.14, 'sine', 0.2, musicBus, 70); return; }
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
    if (!ac || ac.state !== 'running' || muted || !SFX[name]) return;
    SFX[name](ac.currentTime + 0.01);
  }

  // Attack sounds per type. `big` = special (charged) attack: longer and louder.
  const TYPE_SFX = {
    Fire: (t, k) => { noise(t, 0.5 * k, 0.35, sfxBus, 'lowpass', 600, 2400); noise(t + 0.1, 0.4 * k, 0.2, sfxBus, 'bandpass', 3000, 900); if (k > 1) tone(90, t, 0.7, 'sawtooth', 0.1, sfxBus, 40); },
    Water: (t, k) => { noise(t, 0.45 * k, 0.3, sfxBus, 'bandpass', 2500, 300); for (let i = 0; i < 3 * k; i++) tone(500 + Math.random() * 700, t + i * 0.06, 0.08, 'sine', 0.08, sfxBus, 1400); },
    Electric: (t, k) => { for (let i = 0; i < 6 * k; i++) tone(200 + Math.random() * 1600, t + i * 0.035, 0.04, 'square', 0.08, sfxBus); noise(t, 0.12 * k, 0.25, sfxBus, 'highpass', 4000); },
    Grass: (t, k) => { for (let i = 0; i < 4 * k; i++) noise(t + i * 0.06, 0.07, 0.18, sfxBus, 'highpass', 2500 + Math.random() * 3000); },
    Ghost: (t, k) => { tone(700, t, 0.5 * k, 'sine', 0.12, sfxBus, 180); tone(710, t, 0.5 * k, 'triangle', 0.08, sfxBus, 200); },
    Dark: (t, k) => { tone(110, t, 0.45 * k, 'sawtooth', 0.14, sfxBus, 45); noise(t, 0.3 * k, 0.15, sfxBus, 'lowpass', 500); },
    Spirit: (t, k) => ['C6', 'E6', 'G6', 'C7'].slice(0, 2 + k).forEach((n, i) => tone(mtof(midi(n)), t + i * 0.07, 0.4, 'sine', 0.1, sfxBus)),
    Royal: (t, k) => { ['C5', 'G5', 'C6', 'E6'].slice(0, 2 + k).forEach((n, i) => tone(mtof(midi(n)), t + i * 0.08, 0.3, 'square', 0.07, sfxBus)); if (k > 1) noise(t + 0.3, 0.3, 0.2, sfxBus, 'lowpass', 1500); },
    Steel: (t, k) => { tone(1320, t, 0.3 * k, 'square', 0.07, sfxBus); tone(1870, t, 0.25 * k, 'triangle', 0.08, sfxBus); noise(t, 0.08, 0.25, sfxBus, 'highpass', 5000); },
    Brainy: (t, k) => [880, 1175, 1480, 1760].slice(0, 2 + k).forEach((f, i) => tone(f, t + i * 0.05, 0.06, 'square', 0.06, sfxBus)),
    Classic: (t, k) => [660, 880, 990].slice(0, 1 + k).forEach((f, i) => tone(f, t + i * 0.08, 0.12, 'triangle', 0.1, sfxBus)),
    Flying: (t, k) => noise(t, 0.4 * k, 0.28, sfxBus, 'bandpass', 400, 3000),
    Bug: (t, k) => { tone(130, t, 0.35 * k, 'sawtooth', 0.07, sfxBus, 160); tone(135, t, 0.35 * k, 'sawtooth', 0.07, sfxBus, 150); },
    Ancient: (t, k) => { noise(t, 0.5 * k, 0.35, sfxBus, 'lowpass', 300, 80); tone(70, t, 0.4 * k, 'sine', 0.2, sfxBus, 35); },
    Athletic: (t, k) => { tone(160, t, 0.12, 'sine', 0.35, sfxBus, 50); noise(t, 0.1, 0.3, sfxBus, 'lowpass', 2000); if (k > 1) tone(140, t + 0.15, 0.15, 'sine', 0.35, sfxBus, 40); },
    Normal: (t, k) => { tone(150, t, 0.12, 'sine', 0.3, sfxBus, 60); noise(t, 0.1, 0.2, sfxBus, 'lowpass', 1500); },
    Dragon: (t, k) => { tone(220, t, 0.6 * k, 'sawtooth', 0.12, sfxBus, 55); noise(t, 0.6 * k, 0.25, sfxBus, 'lowpass', 900, 150); if (k > 1) tone(330, t, 0.9, 'square', 0.05, sfxBus, 70); },
    Ice: (t, k) => { for (let i = 0; i < 4 * k; i++) tone(1800 + Math.random() * 1500, t + i * 0.05, 0.12, 'sine', 0.07, sfxBus); noise(t, 0.3 * k, 0.12, sfxBus, 'highpass', 6000); },
  };
  function attack(type, big) {
    if (!ac || ac.state !== 'running' || muted) return;
    (TYPE_SFX[type] || TYPE_SFX.Normal)(ac.currentTime + 0.01, big ? 2 : 1);
  }
  SFX.charge = t => { tone(200, t, 0.7, 'sawtooth', 0.06, sfxBus, 1200); noise(t, 0.7, 0.1, sfxBus, 'bandpass', 300, 4000); };
  SFX.shield = t => { ['E5', 'B5', 'E6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.04, 0.35, 'triangle', 0.1, sfxBus)); noise(t, 0.3, 0.15, sfxBus, 'highpass', 2000); };
  SFX.ready = t => { tone(1175, t, 0.08, 'square', 0.06, sfxBus); tone(1568, t + 0.08, 0.12, 'square', 0.06, sfxBus); };
  SFX.excellent = t => ['G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.05, 0.12, 'square', 0.07, sfxBus));
  SFX.rankup = t => { duck(2); ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(mtof(midi(n)), t + i * 0.09, 0.2, 'square', 0.09, sfxBus)); };

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(PREF_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (ac) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05);
  }

  const TRACK_NAMES = { map: 'Upper East Side', park: 'Central Park', city: 'Midtown Nights', jersey: 'Across the Hudson', harbor: 'Harbor Shanty', battle: 'Wild Encounter', fight: 'Trainer Battle', gym: 'Gym Showdown', duel: 'Online Duel', subway: 'Express Line', legend: 'Legendary Encounter', boss: 'Champion Battle' };
  return { play, unlock, sfx, attack, setMuted, isMuted: () => muted, TRACK_NAMES, current: () => wanted, lengths: () => Object.fromEntries(Object.entries(TRACKS).map(([k, t]) => [k, [t.len, t.len / 8, t.roots.length]])) };
})();
