// Regimon GO — evolved forms for the original Regimon (#1–62), plus the evolution chart for every family.
(() => {
  const RG = window.RG;
  const byId = Object.fromEntries(RG.SPECIES.map(s => [s.id, s]));
  // original id: [evolved name, signature move, move type (default: first type), effect, description]
  const E = {
    1: ['Deadlinewyrm', 'All-Nighter', 'Bug', 'stun', 'Chews through a whole term paper the night before it is due.'],
    2: ['Pigeonopoly', 'Market Crash', 'Flying', 'defDown', 'Owns every bench in the park and charges rent in breadcrumbs.'],
    3: ['Owlculus', 'Integral Strike', 'Brainy', 'stun', 'Solves any equation with a single glare.'],
    4: ['Latinferno', 'Veni Vidi Vici', 'Fire', 'burn', 'Came, saw, and conquered every Latin exam.'],
    5: ['Lockervamp', 'Combination Lock', 'Dark', 'drain', 'Knows every locker combination in the building.'],
    6: ['Lunchlupine', 'Food Fight', 'Normal', 'atkUp', 'Leads the cafeteria pack at lunch period.'],
    7: ['Bagelboar', 'Schmear Stampede', 'Normal', 'defDown', 'Charges through bakeries at dawn.'],
    8: ['Parkavedrake', 'Avenue Bloom', 'Grass', 'drain', 'Every tulip on Park Avenue blooms when it passes.'],
    9: ['Squirrelord', 'Nut Barrage', 'Normal', 'atkUp', 'King of every squirrel in Central Park.'],
    10: ['Jesuititan', 'Ad Majorem', 'Spirit', 'atkUp', 'Its croak echoes through the chapel for miles.'],
    11: ['Belltolt', 'Final Bell', 'Electric', 'stun', 'When it rings, class is over — for everyone.'],
    12: ['Candlewraith', 'Eternal Flame', 'Fire', 'burn', 'A candle that has never gone out in a hundred years.'],
    13: ['Examancer', 'Pop Quiz', 'Brainy', 'stun', 'Summons surprise tests out of thin air.'],
    14: ['Hallshade', 'Hall Pass Haunt', 'Ghost', 'defDown', 'Patrols the halls and checks every hall pass.'],
    15: ['Chalkodread', 'Chalkboard Screech', 'Water', 'stun', 'Its screech makes whole classrooms cover their ears.'],
    16: ['Proctorspine', 'No Talking', 'Steel', 'stun', 'Nobody has ever cheated in a room it watched.'],
    17: ['Expresswyrm', 'Express Train', 'Steel', 'atkUp', 'Skips every local stop on the way to battle.'],
    18: ['Reservortitan', 'Reservoir Tide', 'Water', 'drain', 'The Reservoir rises when it is angry.'],
    19: ['Armadillord', 'Rolling Arsenal', 'Steel', 'defDown', 'Rolls through the Arms and Armor wing in full plate.'],
    20: ['Detentakraken', 'Saturday Detention', 'Dark', 'stun', 'Its tentacles keep you after school forever.'],
    21: ['Dendurtitan', 'Temple Quake', 'Ancient', 'defDown', 'Carries an entire Egyptian temple on its shell.'],
    22: ['Megalodean', "Dean's List Bite", 'Water', 'atkUp', 'Top of its class and top of the food chain.'],
    23: ['Glorigator', 'For the Greater Glory', 'Spirit', 'atkUp', 'Fights for the greater glory of Regis.'],
    26: ['Rhetorifrog', 'Rebuttal', 'Water', 'defDown', 'Has never lost a debate.'],
    27: ['Duckorate', 'Dissertation Dive', 'Flying', 'atkUp', 'Earned its doctorate in aerial combat.'],
    28: ['Marathuna', 'Marathon Rush', 'Water', 'atkUp', 'Swims the whole NYC Marathon route by river.'],
    29: ['Belvebastion', 'Castle Shell', 'Ancient', 'defDown', 'Belvedere Castle grew on its back.'],
    30: ['Swanctuary', 'Swan Song', 'Spirit', 'drain', 'Its song can be heard across the whole park.'],
    31: ['Koinemperor', 'Golden Scale', 'Classic', 'atkUp', 'Its scales are stamped like ancient coins.'],
    32: ['Aquinautitan', 'Summa Tidealogica', 'Water', 'drain', 'Wrote the whole encyclopedia of the sea.'],
    33: ['Ultimaver', 'Ultimate Throw', 'Normal', 'atkUp', 'Its frisbee throws cross the Great Lawn in a second.'],
    34: ['Dandelord', 'Seed Storm', 'Grass', 'drain', 'One puff and the Sheep Meadow turns yellow.'],
    35: ['Oakolossus', 'Ancient Oak', 'Grass', 'defDown', 'The oldest tree in the park is its little finger.'],
    36: ['Taxicrusher', 'Rush Hour', 'Steel', 'atkUp', 'Never turns its off-duty light on.'],
    37: ['Hotdogre', 'Mustard Blaze', 'Fire', 'burn', 'The hottest dog on any street corner.'],
    38: ['Concierganatee', 'Lobby Slam', 'Water', 'defDown', 'Nobody gets past its lobby without an appointment.'],
    39: ['MetroCardinax', 'Unlimited Ride', 'Flying', 'atkUp', 'Rides every line for free, forever.'],
    40: ['Pizzarex', 'Dollar Slice', 'Dark', 'drain', 'Drags whole pizzas down the subway stairs.'],
    41: ['Pewsentinel', 'Vespers', 'Spirit', 'drain', 'Guards the church after the last candle is out.'],
    42: ['Organgorilla', 'Toccata', 'Spirit', 'stun', 'Plays the pipe organ with all four hands.'],
    43: ['Monetkong', 'Water Lilies', 'Brainy', 'drain', 'Paints masterpieces the size of a building.'],
    44: ['Pharaohchog', 'Curse of the Pharaoh', 'Ghost', 'defDown', 'Rules the Egyptian wing after closing time.'],
    45: ['Bunsenblaze', 'Lab Explosion', 'Fire', 'burn', 'Every chemistry experiment it runs ends in fire.'],
    46: ['Theolodrake', 'Divine Proof', 'Spirit', 'atkUp', 'Argues theology with dragons, and wins.'],
    47: ['Dribblaster', 'Crossover Crash', 'Athletic', 'stun', 'Its crossover breaks ankles and backboards.'],
    48: ['Goaliegrizz', 'Brick Wall', 'Athletic', 'defDown', 'Has not let in a goal since 1998.'],
    49: ['Sprintitan', 'Photo Finish', 'Athletic', 'atkUp', 'Wins every race by a whisker.'],
    50: ['Butterflorca', 'Butterfly Stroke', 'Water', 'atkUp', 'Holds every pool record in the city.'],
    51: ['Coxswainer', 'Power Ten', 'Athletic', 'atkUp', 'Calls the strokes for the whole Harlem River.'],
    52: ['Championhino', 'Trophy Charge', 'Athletic', 'defDown', 'Its horn is a solid gold trophy.'],
    53: ['Tugolossus', 'Tow Line', 'Steel', 'stun', 'Tows ocean liners into the harbor by itself.'],
    54: ['Hellgateel', 'Hell Gate', 'Dark', 'defDown', 'Rules the most dangerous waters in the East River.'],
    55: ['Seagulliath', 'Fry Heist', 'Flying', 'drain', 'Steals the whole tray, not just the fries.'],
    56: ['Ferryteer', 'Rush Crossing', 'Water', 'atkUp', 'Captains the fastest ferry on the Hudson.'],
    58: ['Guggenlynx', 'Spiral Gallery', 'Brainy', 'stun', 'Its tail spirals like the Guggenheim ramp.'],
    59: ['Cubistopus', 'Cubist Crush', 'Brainy', 'defDown', 'Sees you from every angle at once.'],
    60: ['Pretzeleviathan', 'Twisted Knot', 'Grass', 'stun', 'Ties opponents in salty knots.'],
    61: ['Hydrantarantula', 'Fire Hose', 'Water', 'stun', 'Eight legs, eight hoses, full pressure.'],
    62: ['Bodegalion', 'Bodega Guard', 'Dark', 'atkUp', 'Protects its bodega, and its whole block.'],
  };
  // Extra features an evolved form gets, based on its types
  const TYPE_EXTRAS = { Flying: 'bladewings', Fire: 'flamecrest', Dragon: 'horns', Water: 'fin', Electric: 'bolts', Steel: 'armor', Ghost: 'halo',
    Ice: 'crystals', Grass: 'crest', Royal: 'halo', Dark: 'fangs', Bug: 'claws', Ancient: 'cracks', Spirit: 'halo', Brainy: 'stars', Athletic: 'headband', Normal: 'fangs', Classic: 'crest' };
  const GLOW = { Flying: '#bae6fd', Fire: '#fb923c', Dragon: '#a5b4fc', Water: '#22d3ee', Electric: '#fde047', Steel: '#e5e7eb', Ghost: '#c084fc', Ice: '#7dd3fc',
    Grass: '#a3e635', Royal: '#fde68a', Dark: '#f87171', Bug: '#bef264', Ancient: '#fbbf24', Spirit: '#fef08a', Brainy: '#a5b4fc', Athletic: '#fb923c', Normal: '#fcd34d', Classic: '#fcd34d' };
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  };
  let id = Math.max(...RG.SPECIES.map(s => s.id)) + 1;
  const EVOLVES = {}; // species id → evolved species id
  for (const [from, [name, move, type, effect, desc]] of Object.entries(E)) {
    const b = byId[from];
    if (!b) continue;
    const extras = [...new Set([...(b.extras || []), ...b.types.map(t => TYPE_EXTRAS[t]).filter(Boolean), 'aura', 'gradient'])];
    const sp = {
      id: id++, name, types: b.types, rarity: Math.min(5, b.rarity + 2), habitat: b.habitat, body: b.body === 'round' && b.rarity >= 2 ? 'tall' : b.body,
      color: shade(b.color, -0.12), belly: b.belly, ears: b.ears, eyes: 'fierce', glow: GLOW[type] || '#fde68a', extras, acc: b.acc, accPos: b.accPos,
      sig: [move, type, 115 + b.rarity * 5, 62, effect], family: +from, stage: 2, desc,
    };
    RG.SPECIES.push(sp);
    b.family = +from; b.stage = 1;
    EVOLVES[from] = sp.id;
  }
  // three-stage families from families.js
  for (const s of RG.SPECIES) if (s.stage && s.stage < 3 && s.family && s.family > 103) {
    const next = RG.SPECIES.find(n => n.family === s.family && n.stage === s.stage + 1);
    if (next) EVOLVES[s.id] = next.id;
  }
  // Candy cost to evolve: a family's first evolution costs 25, the second costs 100. The original Regimon need 50 to evolve.
  const evolveCost = sp => (sp.id <= 103 ? 50 : sp.stage === 1 ? 25 : 100);
  const familyOf = sp => sp.family || sp.id;
  // The Mythic quest boss (#313). It never spawns in the wild: finish every quest to face it.
  RG.ZONES.quest = 'Quest reward — finish all quests';
  RG.SPECIES.push({
    id: 313, name: 'Umbravolt', types: ['Electric', 'Dark'], rarity: 6, habitat: ['quest'], body: 'tall', color: '#171233', belly: '#3b2f7a',
    eyes: 'fierce', glow: '#facc15', ears: 'tufts', boss: true,
    extras: ['bladewings', 'horns', 'tail', 'bolts', 'fangs', 'claws', 'crest', 'neon', 'aura', 'gradient'], acc: '',
    sig: ['Blackout Surge', 'Electric', 165, 80, 'stun'],
    desc: 'MYTHIC. A storm dragon that swallowed every light in the city during the Great Blackout. Only trainers who finish every quest ever see it.',
  });
  RG.EVOLVES = EVOLVES;
  RG.evolveCost = evolveCost;
  RG.familyOf = familyOf;
})();
