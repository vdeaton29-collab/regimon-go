// Regimon GO — game data: world layout, stops, species.
window.RG = (() => {
  const W = 2400, H = 1800;

  const TYPES = {
    Brainy: '#8b5cf6', Classic: '#b45309', Fire: '#ef4444', Dark: '#475569',
    Normal: '#8b8f99', Grass: '#16a34a', Spirit: '#ca8a04', Electric: '#d4a106',
    Ghost: '#818cf8', Water: '#3b82f6', Steel: '#64748b', Bug: '#65a30d',
    Flying: '#0ea5e9', Ancient: '#a16207', Royal: '#1e3a8a',
  };

  // w = spawn weight, base = base catch rate, flee = flee chance after a failed catch
  const RARITY = {
    1: { name: 'Very Common', w: 30, base: 0.5, flee: 0.06 },
    2: { name: 'Common', w: 16, base: 0.4, flee: 0.08 },
    3: { name: 'Uncommon', w: 7, base: 0.26, flee: 0.12 },
    4: { name: 'Rare', w: 2, base: 0.13, flee: 0.18 },
    5: { name: 'Legendary', w: 0.45, base: 0.06, flee: 0.25 },
  };

  const BALLS = {
    regi: { name: 'Regi Ball', color: '#1f3a93', mult: 1 },
    honors: { name: 'Honors Ball', color: '#8c1d2f', mult: 1.5 },
    magna: { name: 'Magna Cum Ball', color: '#d4a017', mult: 2 },
  };

  const ZONES = {
    park: 'Central Park', museum: 'The Met', school: 'Regis High School',
    church: 'St. Ignatius Loyola', subway: '86th St Station', street: 'Upper East Side',
    water: 'The Reservoir & Turtle Pond', any: 'Everywhere',
  };

  const ZONE_HINTS = {
    water: 'Water-type Regimon swim here 💧',
    park: 'Grass-type Regimon hide in the trees 🌳',
    school: 'Brainy Regimon roam the halls 📚',
    church: 'Spirit-type Regimon gather here ✨',
    museum: 'Ancient Regimon lurk in the galleries 🏺',
    subway: 'Steel and Dark Regimon ride the rails 🚇',
    street: 'City Regimon roam the avenues 🚕',
  };

  const STOPS = [
    { id: 'front', name: 'Regis Front Steps', x: 1375, y: 905, icon: '🏛️', blurb: 'Founded in 1914 — and every student attends tuition-free.' },
    { id: 'library', name: 'Regis Library', x: 1235, y: 1070, icon: '📚', blurb: 'Quiet please. The Owlgebras are studying.' },
    { id: 'cafe', name: 'Regis Cafeteria', x: 1515, y: 1160, icon: '🍕', blurb: 'Cafeterriers love Pizza Friday.' },
    { id: 'gym', name: 'Regis Gym', x: 1260, y: 1235, icon: '🏀', blurb: 'Home court. Go Raiders!' },
    { id: 'chapel', name: 'St. Ignatius Loyola', x: 1890, y: 690, icon: '⛪', blurb: 'Go forth and set the world on fire.' },
    { id: 'met', name: 'The Met Steps', x: 575, y: 420, icon: '🖼️', blurb: 'Two million works of art, and at least one Armorillo.' },
    { id: 'dendur', name: 'Temple of Dendur', x: 490, y: 150, icon: '🏺', blurb: 'Built around 15 B.C. Dendurtle has been here the whole time.' },
    { id: 'castle', name: 'Belvedere Castle', x: 335, y: 612, icon: '🏰', blurb: 'Overlooks Turtle Pond. Belveturtle insists it owns the place.' },
    { id: 'lawn', name: 'Great Lawn', x: 250, y: 450, icon: '🌳', blurb: 'Perfect for a free period. Watch out for Squirrelios.' },
    { id: 'reservoir', name: 'Reservoir Track', x: 300, y: 972, icon: '🏃', blurb: '1.58 miles around. Reservortex does it in 40 seconds.' },
    { id: 'tulips', name: 'Park Ave Tulips', x: 1640, y: 1080, icon: '🌷', blurb: 'The median blooms every spring. So do the Parkavenewts.' },
    { id: 'subway', name: '86th St Subway', x: 2185, y: 1615, icon: '🚇', blurb: '4, 5, 6 trains. Subwayrm is always one stop behind you.' },
    { id: 'deli', name: 'Corner Deli', x: 2215, y: 1000, icon: '🥯', blurb: 'Bacon, egg & cheese on an everything bagel.' },
    { id: 'madison', name: 'Madison Ave Café', x: 1075, y: 560, icon: '☕', blurb: 'Where upperclassmen pretend to like black coffee.' },
  ];

  // body: round | tall | wide | worm | ghost
  // ears: cat | tufts | bunny | round | floppy | none
  // extras: wings beak tail bigtail spikes crest fin shell tentacles antenna stripes snout collar hat flame teeth
  const SPECIES = [
    { id: 1, name: 'Homeworm', types: ['Bug'], rarity: 1, habitat: ['any'], body: 'worm', color: '#7bc96f', belly: '#c9f0b8', extras: ['antenna'], acc: '📄', accPos: 'hand',
      desc: 'Multiplies overnight. Nobody knows why there is always more of it on Sunday night.' },
    { id: 2, name: 'Pigeonomics', types: ['Flying'], rarity: 1, habitat: ['street', 'park', 'subway'], body: 'round', color: '#8a93a6', belly: '#cdd2de', extras: ['wings', 'beak'], acc: '📈', accPos: 'hand',
      desc: 'Tracks the bagel-crumb market on Park Avenue with frightening accuracy.' },
    { id: 3, name: 'Owlgebra', types: ['Brainy'], rarity: 2, habitat: ['school'], body: 'round', color: '#8b5e3c', belly: '#ecd8b8', ears: 'tufts', extras: ['wings', 'beak'], eyes: 'big', acc: '📐', accPos: 'hand',
      desc: 'Solves for x before you finish reading the problem. Hoots the quadratic formula at dawn.' },
    { id: 4, name: 'Latinmander', types: ['Classic', 'Fire'], rarity: 2, habitat: ['school'], body: 'tall', color: '#e2573b', belly: '#ffc59e', extras: ['tail'], acc: '📜', accPos: 'hand',
      desc: 'Speaks only Latin. Refuses to respond until you decline your nouns properly.' },
    { id: 5, name: 'Lockerbat', types: ['Dark'], rarity: 2, habitat: ['school', 'subway'], body: 'round', color: '#5a5f7a', belly: '#a3a8c2', ears: 'cat', extras: ['wings'], acc: '🔒', accPos: 'hand',
      desc: 'Hangs upside down in the lockers. Knows every combination in the building.' },
    { id: 6, name: 'Cafeterrier', types: ['Normal'], rarity: 2, habitat: ['school', 'street'], body: 'round', color: '#c98b4a', belly: '#f5dcb8', ears: 'floppy', extras: ['tail'], acc: '🍕', accPos: 'hand',
      desc: 'Follows anyone carrying a lunch tray. Its bark is worse than the mystery meat.' },
    { id: 7, name: 'Bagelhog', types: ['Normal'], rarity: 2, habitat: ['street'], body: 'wide', color: '#a0703f', belly: '#f0d6ae', ears: 'round', extras: ['spikes'], acc: '🥯', accPos: 'hand',
      desc: 'Rolls down Lexington Avenue every morning. An everything bagel is its natural armor.' },
    { id: 8, name: 'Parkavenewt', types: ['Grass'], rarity: 2, habitat: ['street', 'park'], body: 'tall', color: '#4caf6a', belly: '#bdf0c5', extras: ['tail'], acc: '🌷', accPos: 'head',
      desc: 'Blooms with the Park Avenue tulips each spring. Hibernates under the median all winter.' },
    { id: 9, name: 'Squirrelio', types: ['Normal', 'Grass'], rarity: 1, habitat: ['park'], body: 'round', color: '#b5763f', belly: '#f3d9b5', ears: 'cat', extras: ['bigtail'], acc: '🌰', accPos: 'hand',
      desc: 'Has buried 40,000 acorns in Central Park and remembers exactly none of them.' },
    { id: 10, name: 'Jesuitoad', types: ['Spirit'], rarity: 2, habitat: ['church', 'school'], body: 'wide', color: '#5e9c4f', belly: '#d5ecb0', extras: ['collar'], acc: '📖', accPos: 'hand',
      desc: 'Calm and contemplative. Practices the daily Examen on its favorite lily pad.' },
    { id: 11, name: 'Chimechu', types: ['Electric'], rarity: 3, habitat: ['school', 'church'], body: 'round', color: '#f4c430', belly: '#fff1b0', ears: 'bunny', acc: '🔔', accPos: 'head',
      desc: 'Rings exactly four minutes before class starts. Zaps anyone still in the hallway.' },
    { id: 12, name: 'Candlewick', types: ['Fire', 'Spirit'], rarity: 3, habitat: ['church'], body: 'tall', color: '#efe6cc', belly: '#fffaf0', extras: ['flame'], acc: '✨', accPos: 'hand',
      desc: 'Keeps vigil in St. Ignatius Loyola. Its flame has never once gone out.' },
    { id: 13, name: 'Quizard', types: ['Brainy'], rarity: 3, habitat: ['school'], body: 'tall', color: '#7b4fc9', belly: '#d2c0f5', extras: ['hat'], acc: '❓', accPos: 'hand',
      desc: 'Casts pop quizzes without warning. Pencils down!' },
    { id: 14, name: 'Hallghast', types: ['Ghost'], rarity: 3, habitat: ['school', 'museum'], body: 'ghost', color: '#e3e7ff', belly: '#ffffff', acc: '🎫', accPos: 'hand',
      desc: 'Drifts through the halls during class. Always has a pass — nobody has ever read it.' },
    { id: 15, name: 'Chalkodile', types: ['Water', 'Brainy'], rarity: 3, habitat: ['school'], body: 'wide', color: '#3aa39a', belly: '#b9ece5', extras: ['snout', 'tail', 'teeth'], acc: '✏️', accPos: 'hand',
      desc: 'Writes proofs across every blackboard. Its bite leaves a red-ink correction.' },
    { id: 16, name: 'Proctorpine', types: ['Steel'], rarity: 3, habitat: ['school'], body: 'round', color: '#6d7a8c', belly: '#d6dde6', extras: ['spikes'], acc: '📋', accPos: 'hand',
      desc: 'Watches exams in total silence. Its quills point at anyone glancing at a neighbor.' },
    { id: 17, name: 'Subwayrm', types: ['Steel'], rarity: 3, habitat: ['subway', 'street'], body: 'worm', color: '#9aa5b1', belly: '#dfe5ec', extras: ['antenna'], acc: '🚇', accPos: 'head',
      desc: 'Rides the 4/5/6 under Lexington. Only appears when you are already late for homeroom.' },
    { id: 18, name: 'Reservortex', types: ['Water'], rarity: 3, habitat: ['water', 'park'], body: 'round', color: '#3b82f6', belly: '#bfdbfe', extras: ['fin'], acc: '💧', accPos: 'hand',
      desc: 'Laps the Central Park Reservoir two hundred times a day and never gets tired.' },
    { id: 19, name: 'Armorillo', types: ['Steel'], rarity: 3, habitat: ['museum'], body: 'wide', color: '#8d8f99', belly: '#d9dbe3', ears: 'round', extras: ['shell'], acc: '🛡️', accPos: 'hand',
      desc: 'Escaped from the Arms and Armor wing at the Met. Clanks when it walks.' },
    { id: 20, name: 'Detentiopus', types: ['Dark', 'Water'], rarity: 3, habitat: ['school'], body: 'round', color: '#9d3b6b', belly: '#f2b6d2', extras: ['tentacles'], acc: '📝', accPos: 'hand',
      desc: 'Hands out detention slips with all eight arms at once.' },
    { id: 21, name: 'Dendurtle', types: ['Ancient', 'Water'], rarity: 4, habitat: ['museum', 'park'], body: 'wide', color: '#c9a86b', belly: '#f1e2bf', extras: ['shell'], acc: '🏺', accPos: 'hand',
      desc: 'Has rested beside the Temple of Dendur for two thousand years. Very slow. Very wise.' },
    { id: 22, name: 'Scholarshark', types: ['Water', 'Brainy'], rarity: 4, habitat: ['school'], body: 'tall', color: '#4a6fa5', belly: '#dbe6f5', extras: ['fin', 'teeth'], acc: '🎓', accPos: 'hand',
      desc: 'Every student swims for free. Tuition: $0. Knowledge: priceless.' },
    { id: 23, name: 'AMDGator', types: ['Spirit', 'Water'], rarity: 4, habitat: ['church', 'school'], body: 'wide', color: '#2f7d4a', belly: '#bfe3c8', extras: ['snout', 'tail', 'teeth'], acc: '✝️', accPos: 'hand',
      desc: 'Does everything Ad Majorem Dei Gloriam — even its homework.' },
    { id: 24, name: 'Ignatiger', types: ['Fire', 'Spirit'], rarity: 5, habitat: ['church', 'school'], body: 'round', color: '#f08a24', belly: '#ffe1bd', ears: 'cat', extras: ['stripes', 'tail'], acc: '🔥', accPos: 'head',
      desc: 'LEGENDARY. "Go set the world on fire." Its roar echoes all the way down 84th Street.' },
    { id: 25, name: 'Regisaurus', types: ['Royal'], rarity: 5, habitat: ['school'], body: 'tall', color: '#2c3e8f', belly: '#c9d3ff', extras: ['crest', 'tail', 'teeth'], acc: '👑', accPos: 'head',
      desc: 'LEGENDARY. "Regis" means "of the King" — and the King of 84th Street never lets you forget it.' },

    // ---- The Reservoir & Turtle Pond (water) ----
    { id: 26, name: 'Tadpolemic', types: ['Water'], rarity: 1, habitat: ['water'], body: 'round', color: '#5b8def', belly: '#cfe0ff', extras: ['tailfin'], acc: '💬', accPos: 'hand',
      desc: 'Argues with every other tadpole in the Reservoir. Captain of the debate team.' },
    { id: 27, name: 'Quackademic', types: ['Water', 'Flying'], rarity: 1, habitat: ['water', 'park'], body: 'round', color: '#f3f1e7', belly: '#ffffff', extras: ['wings', 'bill', 'glasses'], acc: '📚', accPos: 'hand',
      desc: 'Wears its reading glasses even while swimming. Quacks in perfect iambic pentameter.' },
    { id: 28, name: 'Joggerfish', types: ['Water'], rarity: 2, habitat: ['water'], body: 'tall', color: '#ff7a59', belly: '#ffd3c4', extras: ['tailfin', 'headband'], acc: '⏱️', accPos: 'hand',
      desc: 'Runs laps around the Reservoir at 6 a.m. sharp. Has never once been late to first period.' },
    { id: 29, name: 'Belveturtle', types: ['Water', 'Ancient'], rarity: 3, habitat: ['water'], body: 'wide', color: '#6a9a5b', belly: '#dcebc8', extras: ['shell'], acc: '🏰', accPos: 'hand',
      desc: 'Guards Turtle Pond from the shadow of Belvedere Castle. Claims the castle belongs to it.' },
    { id: 30, name: 'Swanctus', types: ['Water', 'Spirit'], rarity: 3, habitat: ['water'], body: 'tall', color: '#f4f4fb', belly: '#ffffff', extras: ['wings', 'beak'], acc: '🎶', accPos: 'head',
      desc: 'Glides across the water humming Gregorian chant. Its song calms even a Detentiopus.' },
    { id: 31, name: 'Koinē', types: ['Water', 'Classic'], rarity: 3, habitat: ['water'], body: 'wide', color: '#ff9f1c', belly: '#fff1d6', extras: ['tailfin', 'fin'], acc: 'Ω', accPos: 'hand',
      desc: 'A koi that speaks only Koine Greek. Translates the New Testament for fun.' },
    { id: 32, name: 'Aquinautilus', types: ['Water', 'Brainy'], rarity: 4, habitat: ['water'], body: 'round', color: '#e07a5f', belly: '#fbe3d6', extras: ['spiral', 'tentacles'], acc: '📘', accPos: 'hand',
      desc: 'Its shell spirals like the Summa Theologica — five proofs deep and still going.' },

    // ---- Central Park (grass) ----
    { id: 33, name: 'Frisbeaver', types: ['Normal', 'Grass'], rarity: 2, habitat: ['park'], body: 'round', color: '#8a5a3b', belly: '#d9b48f', ears: 'round', extras: ['tail', 'teeth'], acc: '🥏', accPos: 'hand',
      desc: 'Never misses a catch on the Great Lawn. Chews through one frisbee a day.' },
    { id: 34, name: 'Dandelyon', types: ['Grass'], rarity: 2, habitat: ['park'], body: 'round', color: '#f2b705', belly: '#fff3c4', extras: ['mane', 'tail'], acc: '🌼', accPos: 'hand',
      desc: 'Its mane blows away in the spring breeze and grows back by Monday.' },
    { id: 35, name: 'Oakolyte', types: ['Grass', 'Spirit'], rarity: 3, habitat: ['park', 'church'], body: 'tall', color: '#6b8e4e', belly: '#d8e7c0', ears: 'tufts', acc: '🌳', accPos: 'head',
      desc: 'An acorn that served Mass so faithfully it grew into a mighty oak.' },

    // ---- the streets ----
    { id: 36, name: 'Taxicrab', types: ['Normal', 'Steel'], rarity: 2, habitat: ['street'], body: 'wide', color: '#f4c20d', belly: '#fff2b3', extras: ['claws', 'antenna'], acc: '🚕', accPos: 'hand',
      desc: 'Scuttles sideways across Park Avenue. Its off-duty light is always on when you need it.' },
    { id: 37, name: 'Hotdachs', types: ['Normal', 'Fire'], rarity: 2, habitat: ['street'], body: 'wide', color: '#b5562d', belly: '#f3c89b', ears: 'floppy', extras: ['tail'], acc: '🌭', accPos: 'hand',
      desc: 'Follows the hot dog cart up Fifth Avenue. Extra mustard, always.' },
    { id: 38, name: 'Doormanatee', types: ['Water', 'Normal'], rarity: 3, habitat: ['street'], body: 'wide', color: '#8e9aaf', belly: '#dfe4ee', extras: ['cap', 'snout'], acc: '🗝️', accPos: 'hand',
      desc: 'Holds doors on Park Avenue with a polite nod. Knows every resident by name.' },

    // ---- the subway ----
    { id: 39, name: 'MetroCardinal', types: ['Flying', 'Steel'], rarity: 2, habitat: ['subway', 'street'], body: 'round', color: '#d62828', belly: '#ffc2c2', ears: 'tufts', extras: ['wings', 'beak'], acc: '💳', accPos: 'hand',
      desc: 'Swipes through the turnstile on the first try. Every single time.' },
    { id: 40, name: 'Pizzarat', types: ['Dark', 'Normal'], rarity: 2, habitat: ['subway'], body: 'round', color: '#8d8d99', belly: '#e1dfe8', ears: 'round', extras: ['tail'], acc: '🍕', accPos: 'hand',
      desc: 'Dragged a whole slice down the stairs at 86th Street. A true New York legend.' },

    // ---- the church ----
    { id: 41, name: 'Pewsqueak', types: ['Spirit', 'Normal'], rarity: 1, habitat: ['church'], body: 'round', color: '#b8a99a', belly: '#efe7df', ears: 'round', extras: ['tail'], acc: '📿', accPos: 'hand',
      desc: 'Lives under the back pew. Always the first to arrive for Mass.' },
    { id: 42, name: 'Organgutan', types: ['Spirit', 'Electric'], rarity: 3, habitat: ['church'], body: 'round', color: '#d9772b', belly: '#f6c79a', ears: 'round', acc: '🎹', accPos: 'hand',
      desc: 'Plays the great pipe organ at St. Ignatius so loudly it rattles the stained glass.' },

    // ---- the Met ----
    { id: 43, name: 'Monetkey', types: ['Brainy', 'Normal'], rarity: 2, habitat: ['museum'], body: 'round', color: '#a8784f', belly: '#f0d5b5', ears: 'round', extras: ['tail'], acc: '🎨', accPos: 'hand',
      desc: 'Paints water lilies all day long and signs every canvas with a banana.' },
    { id: 44, name: 'Mummichog', types: ['Ghost', 'Ancient'], rarity: 3, habitat: ['museum'], body: 'wide', color: '#e8e0c8', belly: '#f7f2e2', extras: ['tailfin', 'wraps'], acc: '⚱️', accPos: 'hand',
      desc: 'A little fish that slipped into the Egyptian wing 3,000 years ago and never left.' },

    // ---- Regis ----
    { id: 45, name: 'Bunsenbunny', types: ['Fire', 'Brainy'], rarity: 2, habitat: ['school'], body: 'round', color: '#f7b2bd', belly: '#fff0f3', ears: 'bunny', extras: ['glasses'], acc: '🧪', accPos: 'hand',
      desc: 'Runs chemistry labs out of a hollowed-out beaker. Safety goggles on at all times.' },
    { id: 46, name: 'Theologecko', types: ['Spirit', 'Brainy'], rarity: 2, habitat: ['school', 'church'], body: 'tall', color: '#58b09c', belly: '#d1f2e8', extras: ['tail'], acc: '🕊️', accPos: 'hand',
      desc: 'Can recite the Nicene Creed backwards. Sticks to the ceiling during Theology class.' },
  ];

  return { W, H, TYPES, RARITY, BALLS, ZONES, ZONE_HINTS, STOPS, SPECIES };
})();
