// Regimon GO — game data: world layout, stops, species.
window.RG = (() => {
  // The map runs west (Central Park) to east (the East River), and from 83rd St (top) to 90th St (bottom).
  const W = 5000, H = 3300;
  const AVES = [
    [600, 660, '5th Ave'], [1100, 1150, 'Madison Ave'], [1600, 1680, 'Park Ave'], [2100, 2150, 'Lexington Ave'],
    [2600, 2660, '3rd Ave'], [3100, 3160, '2nd Ave'], [3600, 3660, '1st Ave'], [4050, 4100, 'York Ave'], [4440, 4490, 'East End Ave'],
  ];
  const STREETS = [
    [300, 344, 'E 83rd St'], [800, 844, 'E 84th St'], [1300, 1344, 'E 85th St'], [1650, 1700, 'E 86th St'],
    [2150, 2194, 'E 87th St'], [2600, 2644, 'E 88th St'], [3050, 3094, 'E 89th St'],
  ];
  const STREET_END = 4490; // streets stop at East End Ave; Carl Schurz Park and the river lie beyond
  const RIVER_X = 4800;

  const TYPES = {
    Brainy: '#8b5cf6', Classic: '#b45309', Fire: '#ef4444', Dark: '#475569',
    Normal: '#8b8f99', Grass: '#16a34a', Spirit: '#ca8a04', Electric: '#d4a106',
    Ghost: '#818cf8', Water: '#3b82f6', Steel: '#64748b', Bug: '#65a30d',
    Flying: '#0ea5e9', Ancient: '#a16207', Royal: '#1e3a8a', Athletic: '#ea580c',
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
    water: 'The Reservoir & Turtle Pond', river: 'The East River', sports: 'Asphalt Green & the Ballfields',
    any: 'Everywhere',
  };

  const ZONE_HINTS = {
    water: 'Water-type Regimon swim here 💧',
    park: 'Grass-type Regimon hide in the trees 🌳',
    school: 'Brainy Regimon roam the halls 📚',
    church: 'Spirit-type Regimon gather here ✨',
    museum: 'Ancient Regimon lurk in the galleries 🏺',
    subway: 'Steel and Dark Regimon ride the rails 🚇',
    street: 'City Regimon roam the avenues 🚕',
    river: 'River Regimon ride the East River currents 🌊',
    sports: 'Athletic Regimon train here 🏅',
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
    { id: 'loyola', name: 'Loyola School', x: 1890, y: 160, icon: '🏫', blurb: 'Regis’s Jesuit neighbor on Park Avenue.' },
    { id: 'neue', name: 'Neue Galerie', x: 700, y: 1745, icon: '🖼️', blurb: 'Home of Klimt’s “Woman in Gold,” right on Fifth Avenue.' },
    { id: 'gugg', name: 'The Guggenheim', x: 1075, y: 2700, icon: '🌀', blurb: 'Frank Lloyd Wright’s spiral. Spiralynx has been walking the ramp for years.' },
    { id: 'engineers', name: 'Engineers’ Gate', x: 575, y: 3070, icon: '🏃', blurb: 'Where Reservoir runners start their loop at 90th and Fifth.' },
    { id: 'ballfields', name: 'Central Park Ballfields', x: 300, y: 2700, icon: '⚾', blurb: 'Pickup games every afternoon. Sprintah never gets tagged out.' },
    { id: 'shops86', name: '86th Street Shops', x: 2380, y: 1722, icon: '🛍️', blurb: 'The busiest shopping strip on the Upper East Side.' },
    { id: 'qtrain', name: '86th St Q Train', x: 3185, y: 1728, icon: '🚇', blurb: 'The Second Avenue Subway opened here in 2017.' },
    { id: 'bakery', name: 'Yorkville Bakery', x: 3400, y: 2215, icon: '🥨', blurb: 'Yorkville was once the heart of German New York. Pretzels still rule.' },
    { id: 'diner', name: 'First Avenue Diner', x: 3690, y: 1000, icon: '🍳', blurb: 'Pancakes after a Saturday tournament. Tradition.' },
    { id: 'dogrun', name: 'Carl Schurz Dog Run', x: 4600, y: 1150, icon: '🐕', blurb: 'Every dog on the East Side meets here at 8 a.m.' },
    { id: 'promenade', name: 'Carl Schurz Promenade', x: 4765, y: 1700, icon: '🌊', blurb: 'Watch the tugboats push up the East River.' },
    { id: 'hellgate', name: 'Hell Gate Overlook', x: 4765, y: 3150, icon: '⚓', blurb: 'The churning tidal strait where the Gatekeel lives.' },
  ];

  // Battle arenas. Each leader's team is species ids; their level scales with your team.
  const ARENAS = [
    { id: 'lawn', name: 'Great Lawn Arena', x: 120, y: 330, tier: 1, leader: 'Ranger Rosa', title: 'Park Ranger', team: [9, 34, 35], color: '#16a34a',
      quote: 'The Great Lawn is my turf. Literally.' },
    { id: 'regisgym', name: 'Regis Gym Arena', x: 1405, y: 1250, tier: 2, leader: 'Coach Malone', title: 'Varsity Coach', team: [47, 48, 49], color: '#1f3a93',
      quote: 'Hustle! Show me what you’ve got, first-year.' },
    { id: 'qarena', name: 'Second Ave Station Arena', x: 3310, y: 1770, tier: 3, leader: 'Conductor Kay', title: 'Train Conductor', team: [40, 17, 39], color: '#64748b',
      quote: 'Stand clear of the closing doors, please!' },
    { id: 'guggarena', name: 'Guggenheim Arena', x: 880, y: 2920, tier: 4, leader: 'Curator Vance', title: 'Museum Curator', team: [43, 58, 59], color: '#a16207',
      quote: 'Every battle is a work of art. Shall we?' },
    { id: 'asphalt', name: 'Asphalt Green Arena', x: 4270, y: 2900, tier: 5, leader: 'Captain Ruiz', title: 'Swim Team Captain', team: [50, 51, 52], color: '#ea580c',
      quote: 'Last one to the wall buys the bagels.' },
    { id: 'gracie', name: 'Gracie Mansion Arena', x: 4640, y: 2880, tier: 6, leader: 'The Mayor', title: 'Mayor of New York', team: [32, 22, 57], color: '#d4a017',
      quote: 'This city has seen a lot of trainers. Let’s see if you’re any different.' },
  ];

  const TRAINER_NAMES = [
    'Freshman Theo', 'Sophomore Aiden', 'Junior Mateo', 'Senior Liam', 'Freshman Declan', 'Sophomore Jonah',
    'Junior Kofi', 'Senior Brendan', 'Xavier Rival', 'Fordham Prep Rival', 'Debate Captain', 'Chess Club Champ',
    'Robotics Kid', 'Band Kid', 'Track Star', 'Yearbook Editor',
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

    // ---- Asphalt Green & the ballfields (athletic) ----
    { id: 47, name: 'Dribbluff', types: ['Athletic'], rarity: 1, habitat: ['sports', 'school'], body: 'round', color: '#f28c28', belly: '#ffd9b0', acc: '🏀', accPos: 'hand',
      desc: 'Bounces down the court all day long. Nobody has ever made it stop dribbling.' },
    { id: 48, name: 'Goaliebear', types: ['Athletic'], rarity: 2, habitat: ['sports'], body: 'round', color: '#6b4f3a', belly: '#d9c2a5', ears: 'round', acc: '🧤', accPos: 'hand',
      desc: 'Blocks every shot on the field. Has not let in a goal since 2019.' },
    { id: 49, name: 'Sprintah', types: ['Athletic', 'Electric'], rarity: 3, habitat: ['sports', 'park'], body: 'tall', color: '#e9b949', belly: '#fff1c9', ears: 'cat', extras: ['stripes', 'tail', 'headband'], acc: '👟', accPos: 'hand',
      desc: 'Runs the 100 in 9.5 seconds. Its sneakers are always untied.' },
    { id: 50, name: 'Poolphin', types: ['Water', 'Athletic'], rarity: 2, habitat: ['sports', 'water'], body: 'wide', color: '#4f9fd8', belly: '#d6ecfa', extras: ['fin', 'tailfin'], acc: '🥽', accPos: 'hand',
      desc: 'Swims laps in the Asphalt Green pool and anchors every relay.' },
    { id: 51, name: 'Crewcoon', types: ['Athletic', 'Normal'], rarity: 2, habitat: ['river', 'sports'], body: 'round', color: '#7a7f8c', belly: '#d9dce3', ears: 'round', extras: ['glasses', 'tail'], acc: '🚣', accPos: 'hand',
      desc: 'Rows up the East River at dawn with the crew team, then steals your granola bar.' },
    { id: 52, name: 'Victorhino', types: ['Athletic', 'Steel'], rarity: 4, habitat: ['sports'], body: 'wide', color: '#8f96a3', belly: '#dde1e8', ears: 'round', extras: ['horn'], acc: '🏆', accPos: 'hand',
      desc: 'Has won every championship trophy on the East Side and carries them all on its horn.' },

    // ---- the East River ----
    { id: 53, name: 'Tugotter', types: ['Water', 'Steel'], rarity: 2, habitat: ['river'], body: 'round', color: '#7b5a3c', belly: '#e2c9a6', ears: 'round', extras: ['tail', 'cap'], acc: '⚓', accPos: 'hand',
      desc: 'Pushes barges up the East River all day and floats on its back all night.' },
    { id: 54, name: 'Gatekeel', types: ['Water', 'Dark'], rarity: 3, habitat: ['river'], body: 'worm', color: '#2f4858', belly: '#8fb3c4', extras: ['fin'], acc: '🌊', accPos: 'head',
      desc: 'Lurks in the whirlpools of Hell Gate. Sailors have feared it for three hundred years.' },
    { id: 55, name: 'Seagullible', types: ['Flying', 'Water'], rarity: 1, habitat: ['river', 'park', 'street'], body: 'round', color: '#eef1f4', belly: '#ffffff', extras: ['wings', 'beak'], acc: '🍟', accPos: 'hand',
      desc: 'Will believe anything you tell it, as long as you are holding fries.' },
    { id: 56, name: 'Ferryt', types: ['Water', 'Normal'], rarity: 2, habitat: ['river'], body: 'tall', color: '#c9a27c', belly: '#f3e3cf', ears: 'round', extras: ['tail', 'cap'], acc: '⛴️', accPos: 'hand',
      desc: 'Captains the ferry to East 90th Street. Collects no fares, only snacks.' },
    { id: 57, name: 'Mayorca', types: ['Water', 'Royal'], rarity: 5, habitat: ['river'], body: 'wide', color: '#23233a', belly: '#f4f4f4', extras: ['fin', 'tailfin'], acc: '🎩', accPos: 'head',
      desc: 'LEGENDARY. Surfaces near Gracie Mansion once a term. Some say it has been mayor longer than anyone.' },

    // ---- the Guggenheim ----
    { id: 58, name: 'Spiralynx', types: ['Brainy', 'Ancient'], rarity: 3, habitat: ['museum'], body: 'round', color: '#e9e4d6', belly: '#ffffff', ears: 'tufts', extras: ['spiral'], acc: '🌀', accPos: 'hand',
      desc: 'Walks up the Guggenheim ramp forever. Has never reached the top, or the bottom.' },
    { id: 59, name: 'Abstractopus', types: ['Brainy', 'Dark'], rarity: 3, habitat: ['museum'], body: 'round', color: '#7c3aed', belly: '#e9d5ff', extras: ['tentacles'], acc: '🖼️', accPos: 'hand',
      desc: 'Paints eight abstract masterpieces at once. Critics are baffled.' },

    // ---- Yorkville streets ----
    { id: 60, name: 'Pretzeleon', types: ['Normal', 'Grass'], rarity: 2, habitat: ['street'], body: 'tall', color: '#6cbf6a', belly: '#dff5d8', extras: ['tail'], acc: '🥨', accPos: 'hand',
      desc: 'Blends into any Yorkville bakery window. Smells faintly of mustard.' },
    { id: 61, name: 'Hydrantula', types: ['Water', 'Bug'], rarity: 2, habitat: ['street'], body: 'round', color: '#d7263d', belly: '#ffc2c9', extras: ['tentacles'], acc: '🚒', accPos: 'hand',
      desc: 'Opens fire hydrants on hot summer days. The whole block loves it.' },
    { id: 62, name: 'Bodegato', types: ['Normal', 'Dark'], rarity: 1, habitat: ['street', 'subway'], body: 'round', color: '#e0a458', belly: '#fbe7c6', ears: 'cat', extras: ['tail'], acc: '🥫', accPos: 'hand',
      desc: 'Naps on the bread shelf of every corner bodega. The real owner of the store.' },
  ];

  return { W, H, AVES, STREETS, STREET_END, RIVER_X, TYPES, RARITY, BALLS, ZONES, ZONE_HINTS, STOPS, ARENAS, TRAINER_NAMES, SPECIES };
})();
