// Regimon GO — real geography: Manhattan (97th St to the Battery), the harbor, and Hudson County, NJ.
// Everything is stored as [lat, lon] and projected to world pixels (north up, 2.5 px per meter).
window.RGGeo = (() => {
  const LAT0 = 40.683, LAT1 = 40.800, LON0 = -74.080, LON1 = -73.930;
  const PPM = 2.5;
  const MLAT = 111000, MLON = 111320 * Math.cos(40.74 * Math.PI / 180);
  const W = Math.round((LON1 - LON0) * MLON * PPM), H = Math.round((LAT1 - LAT0) * MLAT * PPM);
  const toXY = (lat, lon) => ({ x: (lon - LON0) * MLON * PPM, y: (LAT1 - lat) * MLAT * PPM });
  const toLL = (x, y) => ({ lat: LAT1 - y / (MLAT * PPM), lon: LON0 + x / (MLON * PPM) });
  const inBounds = (lat, lon) => lat > LAT0 && lat < LAT1 && lon > LON0 && lon < LON1;
  const poly = pts => pts.map(([la, lo]) => { const p = toXY(la, lo); return [p.x, p.y]; });

  // A street grid: u runs "uptown" along the avenues, v runs across them. Units are world px.
  function makeGrid(lat, lon, deg) {
    const o = toXY(lat, lon), t = deg * Math.PI / 180;
    const g = { ox: o.x, oy: o.y, ax: Math.sin(t), ay: -Math.cos(t), bx: Math.cos(t), by: Math.sin(t), deg };
    g.toUV = (x, y) => { const dx = x - g.ox, dy = y - g.oy; return { u: dx * g.ax + dy * g.ay, v: dx * g.bx + dy * g.by }; };
    g.toXY = (u, v) => ({ x: g.ox + u * g.ax + v * g.bx, y: g.oy + u * g.ay + v * g.by });
    return g;
  }
  // Manhattan's 1811 grid, anchored at 5th Ave & 59th St and tilted 29° east of north.
  const MGRID = makeGrid(40.7644, -73.9730, 29);
  const STREET_M = 80;
  const streetU = n => (n - 59) * STREET_M * PPM;
  const streetOf = u => 59 + u / (STREET_M * PPM);
  // [name, meters east of 5th Ave, first street, last street]
  const AVENUES = [
    ['12th Ave', -1960, 14, 59], ['11th Ave', -1680, 14, 59], ['West End Ave', -1680, 59, 110], ['10th Ave', -1400, 14, 59],
    ['Amsterdam Ave', -1400, 59, 110], ['9th Ave', -1120, 14, 59], ['Columbus Ave', -1120, 59, 110], ['8th Ave', -840, 14, 59],
    ['Central Park W', -840, 59, 110], ['7th Ave', -560, 14, 59], ['6th Ave', -280, 0, 59], ['5th Ave', 0, 8, 110],
    ['Madison Ave', 125, 23, 110], ['Park Ave', 250, 14, 110], ['Lexington Ave', 375, 21, 110], ['3rd Ave', 520, 0, 110],
    ['2nd Ave', 720, 0, 110], ['1st Ave', 920, 0, 110], ['Ave A', 1060, 0, 14], ['York Ave', 1120, 59, 97], ['Ave B', 1200, 0, 14],
    ['East End Ave', 1330, 79, 90], ['Ave C', 1340, 0, 14], ['Ave D', 1480, 0, 14],
  ].map(([n, m, s0, s1]) => ({ name: n, v: m * PPM, s0, s1 }));

  const gp = (pts, grid) => pts.map(([s, m]) => { const p = grid.toXY(streetU(s), m * PPM); return [p.x, p.y]; });
  // Local rectangle / ellipse in meters, rotated with the Manhattan grid (or any angle).
  function rectPoly(lat, lon, w, h, deg = 29) {
    const g = makeGrid(lat, lon, deg), hw = w * PPM / 2, hh = h * PPM / 2;
    return [[-hh, -hw], [-hh, hw], [hh, hw], [hh, -hw]].map(([u, v]) => { const p = g.toXY(u, v); return [p.x, p.y]; });
  }
  function ellPoly(lat, lon, rx, ry, deg = 29, n = 32) {
    const g = makeGrid(lat, lon, deg), out = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const p = g.toXY(Math.sin(a) * ry * PPM, Math.cos(a) * rx * PPM); out.push([p.x, p.y]); }
    return out;
  }

  // ---------------- land ----------------
  const MANHATTAN = poly([
    [40.8060, -73.9740], [40.8000, -73.9775], [40.7950, -73.9805], [40.7880, -73.9845], [40.7810, -73.9895], [40.7740, -73.9935],
    [40.7680, -73.9965], [40.7620, -74.0005], [40.7560, -74.0050], [40.7500, -74.0085], [40.7440, -74.0098], [40.7380, -74.0105],
    [40.7320, -74.0110], [40.7260, -74.0115], [40.7200, -74.0130], [40.7150, -74.0165], [40.7100, -74.0180], [40.7050, -74.0190],
    [40.7020, -74.0175], [40.7003, -74.0150], [40.7003, -74.0120], [40.7020, -74.0095], [40.7045, -74.0060], [40.7065, -74.0025],
    [40.7090, -73.9985], [40.7105, -73.9920], [40.7105, -73.9840], [40.7110, -73.9790], [40.7150, -73.9755], [40.7200, -73.9735],
    [40.7260, -73.9720], [40.7320, -73.9728], [40.7380, -73.9740], [40.7440, -73.9715], [40.7490, -73.9680], [40.7540, -73.9640],
    [40.7590, -73.9590], [40.7640, -73.9550], [40.7700, -73.9505], [40.7750, -73.9455], [40.7800, -73.9425], [40.7850, -73.9410],
    [40.7900, -73.9375], [40.7950, -73.9340], [40.8000, -73.9310], [40.8060, -73.9280],
  ]);
  const NEW_JERSEY = poly([
    [40.8060, -73.9930], [40.8000, -73.9960], [40.7900, -73.9990], [40.7800, -74.0050], [40.7700, -74.0120], [40.7600, -74.0200],
    [40.7520, -74.0235], [40.7450, -74.0245], [40.7380, -74.0262], [40.7300, -74.0285], [40.7220, -74.0310], [40.7160, -74.0330],
    [40.7120, -74.0340], [40.7090, -74.0370], [40.7050, -74.0400], [40.7000, -74.0450], [40.6940, -74.0500], [40.6880, -74.0560],
    [40.6800, -74.0640], [40.6780, -74.0900], [40.8060, -74.0900],
  ]);
  const BROOKLYN_QUEENS = poly([
    [40.6780, -74.0140], [40.6830, -74.0120], [40.6900, -74.0030], [40.6950, -73.9990], [40.7000, -73.9960], [40.7035, -73.9900],
    [40.7040, -73.9800], [40.7060, -73.9720], [40.7130, -73.9680], [40.7200, -73.9620], [40.7300, -73.9600], [40.7370, -73.9620],
    [40.7450, -73.9590], [40.7520, -73.9525], [40.7600, -73.9440], [40.7700, -73.9370], [40.7760, -73.9300], [40.7850, -73.9215],
    [40.8060, -73.9150], [40.8060, -73.9100], [40.6780, -73.9100],
  ]);
  const ROOSEVELT = poly([
    [40.7520, -73.9615], [40.7570, -73.9570], [40.7650, -73.9505], [40.7720, -73.9448], [40.7728, -73.9438], [40.7712, -73.9436],
    [40.7640, -73.9490], [40.7555, -73.9560], [40.7515, -73.9605],
  ]);
  const GOVERNORS = ellPoly(40.6894, -74.0167, 480, 380, 40);
  const LIBERTY_ISLAND = ellPoly(40.6892, -74.0445, 150, 110, 30, 20);
  const ELLIS_ISLAND = ellPoly(40.6992, -74.0395, 190, 110, 20, 20);
  const MILL_ROCK = ellPoly(40.7806, -73.9376, 60, 90, 29, 16);
  const LANDS = [
    { name: 'Manhattan', pts: MANHATTAN }, { name: 'New Jersey', pts: NEW_JERSEY }, { name: 'Brooklyn & Queens', pts: BROOKLYN_QUEENS },
    { name: 'Roosevelt Island', pts: ROOSEVELT }, { name: 'Governors Island', pts: GOVERNORS }, { name: 'Liberty Island', pts: LIBERTY_ISLAND },
    { name: 'Ellis Island', pts: ELLIS_ISLAND }, { name: 'Mill Rock', pts: MILL_ROCK },
  ];

  // ---------------- street grids (each clipped to land and an optional region) ----------------
  const box = (la0, lo0, la1, lo1) => poly([[la0, lo0], [la0, lo1], [la1, lo1], [la1, lo0]]);
  const GRIDS = [
    { id: 'manhattan', kind: 'manhattan', grid: MGRID, clip: MANHATTAN, region: gp([[14, -4000], [14, -100], [0, -100], [0, 4000], [140, 4000], [140, -4000]], MGRID) },
    { id: 'oldcity', grid: makeGrid(40.7128, -74.0060, 10), su: 95, sv: 120, clip: MANHATTAN, region: gp([[14, -4000], [14, -100], [0, -100], [0, 4000], [-140, 4000], [-140, -4000]], MGRID) },
    { id: 'roosevelt', grid: MGRID, su: 80, sv: 110, clip: ROOSEVELT },
    { id: 'unioncity', grid: makeGrid(40.7700, -74.0300, 27), su: 75, sv: 170, clip: NEW_JERSEY, region: box(40.757, -74.09, 40.81, -73.98) },
    { id: 'hoboken', grid: makeGrid(40.7440, -74.0300, 10), su: 70, sv: 110, clip: NEW_JERSEY, region: box(40.733, -74.046, 40.757, -73.98) },
    { id: 'jcdowntown', grid: makeGrid(40.7200, -74.0430, -16), su: 90, sv: 110, clip: NEW_JERSEY, region: box(40.68, -74.052, 40.733, -73.98) },
    { id: 'jcheights', grid: makeGrid(40.7330, -74.0630, 33), su: 80, sv: 160, clip: NEW_JERSEY, region: poly([[40.757, -74.09], [40.757, -74.046], [40.733, -74.046], [40.733, -74.052], [40.68, -74.052], [40.68, -74.09]]) },
    { id: 'brooklyn', grid: makeGrid(40.6960, -73.9950, -10), su: 80, sv: 200, clip: BROOKLYN_QUEENS, region: box(40.67, -74.1, 40.735, -73.9) },
    { id: 'queens', grid: makeGrid(40.7450, -73.9480, 40), su: 90, sv: 200, clip: BROOKLYN_QUEENS, region: box(40.735, -74.1, 40.81, -73.9) },
  ];

  // ---------------- parks, lakes, lawns ----------------
  const PARKS = [
    { name: 'Central Park', pts: poly([[40.7644, -73.9730], [40.7681, -73.9819], [40.8003, -73.9582], [40.7969, -73.9493]]) },
    { name: 'Riverside Park', pts: poly([[40.8060, -73.9740], [40.8000, -73.9775], [40.7950, -73.9805], [40.7880, -73.9845], [40.7810, -73.9895], [40.7790, -73.9905], [40.7790, -73.9870], [40.7880, -73.9815], [40.7950, -73.9776], [40.8060, -73.9712]]) },
    { name: 'Carl Schurz Park', pts: poly([[40.7735, -73.9470], [40.7792, -73.9428], [40.7802, -73.9440], [40.7748, -73.9482]]) },
    { name: 'John Jay Park', pts: rectPoly(40.7697, -73.9496, 120, 90) },
    { name: 'East River Park', pts: poly([[40.7110, -73.9790], [40.7150, -73.9755], [40.7200, -73.9735], [40.7260, -73.9720], [40.7262, -73.9745], [40.7200, -73.9760], [40.7150, -73.9780], [40.7118, -73.9808]]) },
    { name: 'Battery Park', pts: poly([[40.7003, -74.0150], [40.7003, -74.0120], [40.7035, -74.0132], [40.7058, -74.0158], [40.7045, -74.0188], [40.7020, -74.0175]]) },
    { name: 'Bryant Park', pts: rectPoly(40.7536, -73.9832, 180, 110) },
    { name: 'Madison Square Park', pts: rectPoly(40.7424, -73.9881, 170, 140) },
    { name: 'Union Square', pts: rectPoly(40.7359, -73.9906, 140, 180) },
    { name: 'Washington Square Park', pts: rectPoly(40.7308, -73.9973, 280, 170, 25) },
    { name: 'Tompkins Square Park', pts: rectPoly(40.7265, -73.9818, 240, 190) },
    { name: 'City Hall Park', pts: poly([[40.7140, -74.0075], [40.7105, -74.0092], [40.7113, -74.0045], [40.7130, -74.0045]]) },
    { name: 'Stuyvesant Square', pts: rectPoly(40.7336, -73.9837, 90, 160) },
    { name: 'Gramercy Park', pts: rectPoly(40.7382, -73.9861, 60, 90) },
    { name: 'Hudson Yards Park', pts: rectPoly(40.7560, -73.9990, 70, 220) },
    { name: 'Governors Island', pts: GOVERNORS },
    { name: 'Liberty State Park', pts: poly([[40.7095, -74.0400], [40.7050, -74.0420], [40.7000, -74.0460], [40.6940, -74.0510], [40.6880, -74.0570], [40.6860, -74.0650], [40.7000, -74.0660], [40.7100, -74.0580], [40.7125, -74.0470]]) },
    { name: 'Palisades Cliffs', pts: poly([[40.7560, -74.0255], [40.7700, -74.0150], [40.7850, -74.0065], [40.8060, -73.9975], [40.8060, -74.0020], [40.7850, -74.0110], [40.7700, -74.0195], [40.7570, -74.0290]]) },
    { name: 'Pier A Park', pts: rectPoly(40.7370, -74.0262, 110, 150, 10) },
    { name: 'Elysian Park', pts: rectPoly(40.7484, -74.0265, 90, 110, 10) },
    { name: 'Hamilton Park (Weehawken)', pts: rectPoly(40.7672, -74.0200, 60, 180, 27) },
    { name: 'Hamilton Park (Jersey City)', pts: rectPoly(40.7267, -74.0440, 140, 140, -16) },
    { name: 'Van Vorst Park', pts: rectPoly(40.7185, -74.0470, 110, 110, -16) },
    { name: 'Washington Park', pts: rectPoly(40.7745, -74.0275, 120, 220, 27) },
    { name: 'Roosevelt Island Lighthouse Park', pts: ellPoly(40.7717, -73.9443, 50, 60, 29, 12) },
  ];
  const LAKES = [
    { name: 'The Reservoir', pts: ellPoly(40.7855, -73.9625, 290, 420), rim: true },
    { name: 'Turtle Pond', pts: ellPoly(40.7795, -73.9690, 110, 42) },
    { name: 'The Lake', pts: ellPoly(40.7765, -73.9712, 230, 110, 50) },
    { name: 'Conservatory Water', pts: ellPoly(40.7746, -73.9667, 60, 34) },
    { name: 'The Pond', pts: ellPoly(40.7662, -73.9742, 90, 45, 10) },
  ];
  const LAWNS = [
    { name: 'Great Lawn', pts: ellPoly(40.7812, -73.9665, 240, 170) },
    { name: 'Sheep Meadow', pts: ellPoly(40.7718, -73.9750, 200, 140) },
    { name: 'North Meadow', pts: ellPoly(40.7960, -73.9555, 220, 150) },
  ];

  // ---------------- roads, rails, bridges ----------------
  const BROADWAY = poly([[40.7045, -74.0135], [40.7128, -74.0080], [40.7190, -74.0027], [40.7254, -73.9970], [40.7310, -73.9925], [40.7359, -73.9906],
    [40.7411, -73.9897], [40.7497, -73.9877], [40.7580, -73.9855], [40.7681, -73.9819], [40.7740, -73.9822], [40.7785, -73.9819],
    [40.7887, -73.9767], [40.7939, -73.9724], [40.8060, -73.9650]]);
  const HIGH_LINE = poly([[40.7398, -74.0080], [40.7420, -74.0072], [40.7445, -74.0060], [40.7478, -74.0048], [40.7510, -74.0035], [40.7527, -74.0040], [40.7538, -74.0070]]);
  const BRIDGES = [
    { name: 'Brooklyn Bridge', pts: poly([[40.7110, -74.0015], [40.7025, -73.9930]]) },
    { name: 'Manhattan Bridge', pts: poly([[40.7155, -73.9955], [40.7040, -73.9880]]) },
    { name: 'Williamsburg Bridge', pts: poly([[40.7170, -73.9835], [40.7120, -73.9650]]) },
    { name: 'Queensboro Bridge', pts: poly([[40.7612, -73.9642], [40.7525, -73.9420]]) },
  ];
  const WATER_LABELS = [['Hudson River', 40.7620, -74.0120, 90], ['Hudson River', 40.7200, -74.0240, 90], ['East River', 40.7360, -73.9665, 60],
    ['East River', 40.7700, -73.9420, 55], ['Upper New York Bay', 40.6920, -74.0300, 0], ['Hell Gate', 40.7790, -73.9340, 60]];

  // ---------------- neighborhoods (for place names) ----------------
  const HOODS = [
    ['Upper East Side', 40.7736, -73.9566], ['Yorkville', 40.7766, -73.9487], ['Carnegie Hill', 40.7847, -73.9551], ['Lenox Hill', 40.7662, -73.9602],
    ['East Harlem', 40.7960, -73.9420], ['Upper West Side', 40.7870, -73.9754], ['Lincoln Square', 40.7740, -73.9850], ['Sutton Place', 40.7577, -73.9616],
    ['Midtown East', 40.7540, -73.9700], ['Midtown', 40.7549, -73.9840], ['Hell’s Kitchen', 40.7638, -73.9918], ['Hudson Yards', 40.7536, -74.0010],
    ['Murray Hill', 40.7479, -73.9757], ['Kips Bay', 40.7424, -73.9771], ['Chelsea', 40.7465, -74.0014], ['Flatiron', 40.7401, -73.9903],
    ['Gramercy', 40.7368, -73.9845], ['Stuyvesant Town', 40.7316, -73.9780], ['Greenwich Village', 40.7336, -73.9990], ['West Village', 40.7358, -74.0036],
    ['East Village', 40.7265, -73.9815], ['NoHo', 40.7289, -73.9925], ['SoHo', 40.7233, -74.0030], ['Nolita', 40.7230, -73.9955],
    ['Lower East Side', 40.7150, -73.9843], ['Chinatown', 40.7158, -73.9970], ['Tribeca', 40.7163, -74.0086], ['Civic Center', 40.7135, -74.0035],
    ['Financial District', 40.7075, -74.0100], ['Battery Park City', 40.7117, -74.0158], ['Two Bridges', 40.7110, -73.9930], ['Roosevelt Island', 40.7620, -73.9510],
    ['Hoboken', 40.7440, -74.0324], ['Weehawken', 40.7690, -74.0200], ['Union City', 40.7730, -74.0320], ['West New York', 40.7880, -74.0100],
    ['Downtown Jersey City', 40.7178, -74.0431], ['Journal Square', 40.7327, -74.0630], ['The Heights', 40.7480, -74.0480], ['Paulus Hook', 40.7140, -74.0340],
    ['Newport', 40.7270, -74.0360], ['Liberty State Park', 40.7040, -74.0550], ['Long Island City', 40.7447, -73.9485], ['Astoria', 40.7760, -73.9230],
    ['Greenpoint', 40.7300, -73.9540], ['Williamsburg', 40.7110, -73.9570], ['DUMBO', 40.7033, -73.9881], ['Brooklyn Heights', 40.6960, -73.9950],
    ['Governors Island', 40.6894, -74.0167], ['Liberty Island', 40.6892, -74.0445], ['Ellis Island', 40.6992, -74.0395],
  ];

  // ---------------- landmarks (every landmark is also a stop) ----------------
  // [name, lat, lon, zone | '', zone radius m, icon, footprint m (0 = none), shape, blurb]
  const L = (name, lat, lon, zone, r, icon, size, shape, blurb) => ({ name, lat, lon, zone, r, icon, size, shape, blurb });
  const LANDMARKS = [
    // --- Regis & the Upper East Side ---
    L('Regis High School', 40.7792, -73.9594, 'school', 110, '👑', 105, 'regis', 'Founded in 1914 — and every student attends tuition-free.'),
    L('St. Ignatius Loyola', 40.7788, -73.9574, 'church', 70, '⛪', 90, 'church', 'Go forth and set the world on fire.'),
    L('Loyola School', 40.7780, -73.9583, 'school', 40, '🏫', 50, 'block', 'Regis’s Jesuit neighbor on Park Avenue.'),
    L('The Met', 40.7794, -73.9632, 'museum', 160, '🏛️', 260, 'museum', 'Two million works of art, and at least one Armorillo.'),
    L('Temple of Dendur', 40.7802, -73.9651, 'museum', 50, '🏺', 0, '', 'Built around 15 B.C. Dendurtle has been here the whole time.'),
    L('Neue Galerie', 40.7813, -73.9602, 'museum', 40, '🖼️', 45, 'block', 'Home of Klimt’s “Woman in Gold.”'),
    L('The Guggenheim', 40.7830, -73.9590, 'museum', 70, '🌀', 80, 'spiral', 'Frank Lloyd Wright’s spiral. Spiralynx walks the ramp forever.'),
    L('Cooper Hewitt', 40.7844, -73.9578, 'museum', 60, '⚙️', 70, 'block', 'The design museum in Andrew Carnegie’s mansion. Gearadon was built here.'),
    L('The Jewish Museum', 40.7853, -73.9572, 'museum', 45, '🏛️', 50, 'block', 'A French Gothic mansion on Museum Mile.'),
    L('Church of the Heavenly Rest', 40.7843, -73.9576, 'church', 40, '⛪', 45, 'church', 'Seraphalcon nests in its bell tower.'),
    L('92NY', 40.7832, -73.9529, 'music', 60, '🎼', 70, 'block', 'Concerts, readings and one very loud Crescendragon.'),
    L('Islamic Cultural Center', 40.7862, -73.9496, 'church', 60, '🕌', 70, 'dome', 'Its great dome sits at 96th and Third.'),
    L('Asphalt Green', 40.7775, -73.9460, 'sports', 110, '🏊', 120, 'field', 'Pool, track and turf by the East River.'),
    L('Gracie Mansion', 40.7760, -73.9431, '', 50, '🏠', 50, 'block', 'The mayor’s house since 1942.'),
    L('Frick Collection', 40.7712, -73.9674, 'museum', 60, '🖼️', 70, 'block', 'Old masters in a Fifth Avenue mansion.'),
    L('Hunter College', 40.7685, -73.9646, 'school', 80, '🎓', 90, 'block', 'Sky bridges over Lexington Avenue.'),
    L('Temple Emanu-El', 40.7696, -73.9697, 'church', 50, '🕍', 60, 'block', 'One of the largest synagogues in the world.'),
    L('86th St Station (4 5 6)', 40.7795, -73.9556, 'subway', 70, '🚇', 0, '', 'Subwayrm is always one stop behind you.'),
    L('86th St Station (Q)', 40.7777, -73.9515, 'subway', 70, '🚇', 0, '', 'The Second Avenue Subway opened here in 2017.'),
    L('96th St Station (6)', 40.7851, -73.9510, 'subway', 70, '🚇', 0, '', 'Last local stop before the train heads uptown.'),
    L('96th St Station (Q)', 40.7847, -73.9471, 'subway', 70, '🚇', 0, '', 'The northern end of the Second Avenue line. Magmalith sleeps below.'),
    L('59th St / Lexington', 40.7627, -73.9676, 'subway', 70, '🚇', 0, '', 'The busiest transfer on the East Side.'),
    L('Corner Deli', 40.7806, -73.9540, '', 0, '🥯', 0, '', 'Bacon, egg & cheese on an everything bagel.'),
    // --- Central Park ---
    L('Belvedere Castle', 40.7794, -73.9690, '', 0, '🏰', 30, 'castle', 'Overlooks Turtle Pond. Belveturtle insists it owns the place.'),
    L('Great Lawn Ballfields', 40.7812, -73.9665, 'sports', 150, '⚾', 0, '', 'Pickup games every afternoon.'),
    L('Reservoir Track', 40.7815, -73.9610, '', 0, '🏃', 0, '', '1.58 miles around. Reservortex does it in 40 seconds.'),
    L('Engineers’ Gate', 40.7843, -73.9590, '', 0, '🏃', 0, '', 'Where Reservoir runners start their loop.'),
    L('Central Park Tennis Center', 40.7896, -73.9616, 'sports', 90, '🎾', 90, 'field', 'Thirty clay courts.'),
    L('Bethesda Terrace', 40.7740, -73.9711, '', 0, '⛲', 40, 'fountain', 'The Angel of the Waters has watched over the Lake since 1873.'),
    L('Bow Bridge', 40.7758, -73.9718, '', 0, '🌉', 0, '', 'The most photographed bridge in Central Park.'),
    L('Strawberry Fields', 40.7757, -73.9751, '', 0, '🍓', 0, '', 'A quiet garden with a famous mosaic that says “Imagine.”'),
    L('Wollman Rink', 40.7677, -73.9745, 'sports', 70, '⛸️', 70, 'rink', 'Skating under the skyline all winter. Glaciator’s favorite spot.'),
    L('Conservatory Water', 40.7746, -73.9667, '', 0, '⛵', 0, '', 'Model sailboats race here every weekend.'),
    L('American Museum of Natural History', 40.7813, -73.9740, 'museum', 170, '🦕', 200, 'museum', 'Dinosaurs, a blue whale, and at least one Palisaur skeleton.'),
    L('New-York Historical Society', 40.7794, -73.9740, 'museum', 40, '📜', 0, '', 'New York’s oldest museum.'),
    // --- West side ---
    L('Lincoln Center', 40.7725, -73.9835, 'music', 140, '🎭', 160, 'plaza', 'Opera, ballet and the philharmonic around one fountain.'),
    L('Beacon Theatre', 40.7805, -73.9812, 'music', 40, '🎸', 0, '', 'A 1929 movie palace that now hosts rock shows.'),
    L('72nd St Station (1 2 3)', 40.7785, -73.9819, 'subway', 70, '🚇', 0, '', 'The famous little station house on Broadway.'),
    L('96th St Station (1 2 3)', 40.7939, -73.9724, 'subway', 70, '🚇', 0, '', 'Express trains roar through at 96th.'),
    L('Columbus Circle', 40.7681, -73.9819, 'subway', 90, '🗽', 60, 'fountain', 'Every distance to New York City is measured from this spot.'),
    L('Intrepid Museum', 40.7645, -73.9996, 'museum', 130, '✈️', 0, '', 'An aircraft carrier parked in the Hudson.'),
    L('Hudson Yards Vessel', 40.7538, -74.0022, 'midtown', 70, '🪜', 50, 'spiral', 'A honeycomb of 154 staircases.'),
    L('The High Line', 40.7478, -74.0048, '', 0, '🌿', 0, '', 'A park built on an old elevated railway.'),
    L('Chelsea Market', 40.7424, -74.0061, '', 0, '🛍️', 60, 'block', 'An old cookie factory turned food hall.'),
    L('Chelsea Piers', 40.7465, -74.0082, 'sports', 130, '🏒', 0, '', 'Ice rinks, golf and gyms on the river.'),
    L('Whitney Museum', 40.7396, -74.0089, 'museum', 60, '🎨', 60, 'block', 'American art at the bottom of the High Line.'),
    // --- Midtown ---
    L('Times Square', 40.7580, -73.9855, 'music', 170, '🌃', 120, 'neon', 'The crossroads of the world. Neonoir hunts under the billboards.'),
    L('Times Sq–42nd St', 40.7553, -73.9870, 'subway', 70, '🚇', 0, '', 'Twelve lines meet under Times Square.'),
    L('Empire State Building', 40.7484, -73.9857, 'midtown', 90, '🏙️', 90, 'tower', '102 floors. Empyreon lights the spire in new colors every night.'),
    L('Grand Central Terminal', 40.7527, -73.9772, 'subway', 110, '🕰️', 130, 'block', 'Look up at the constellations on the ceiling — and the owl on the clock.'),
    L('Chrysler Building', 40.7516, -73.9755, 'midtown', 50, '🏙️', 50, 'tower', 'Art deco eagles guard its crown.'),
    L('Bryant Park & NYPL', 40.7536, -73.9832, '', 0, '📚', 0, '', 'The lions Patience and Fortitude guard the library.'),
    L('Rockefeller Center', 40.7587, -73.9787, 'midtown', 100, '🎄', 110, 'plaza', 'Top of the Rock, the rink, and the tree every December.'),
    L('Radio City Music Hall', 40.7600, -73.9800, 'music', 60, '🎤', 70, 'block', 'The Rockettes have kicked here since 1933.'),
    L('St. Patrick’s Cathedral', 40.7585, -73.9760, 'church', 80, '⛪', 90, 'church', 'Gothic spires on Fifth Avenue.'),
    L('MoMA', 40.7614, -73.9776, 'museum', 70, '🖼️', 80, 'block', 'Starry Night lives here.'),
    L('Carnegie Hall', 40.7651, -73.9799, 'music', 60, '🎻', 60, 'block', 'How do you get there? Practice.'),
    L('United Nations', 40.7489, -73.9680, 'midtown', 120, '🌐', 110, 'tower', '193 flags on First Avenue.'),
    L('Madison Square Garden', 40.7505, -73.9934, 'sports', 110, '🏀', 110, 'dome', 'The world’s most famous arena.'),
    L('Penn Station', 40.7506, -73.9910, 'subway', 90, '🚆', 0, '', 'The busiest train station in America.'),
    L('34th St–Herald Sq', 40.7497, -73.9877, 'subway', 70, '🚇', 0, '', 'Macy’s and the PATH to Jersey.'),
    L('Flatiron Building', 40.7411, -73.9897, 'midtown', 50, '📐', 40, 'block', 'A skyscraper shaped like a slice of cake.'),
    L('Madison Square Park', 40.7424, -73.9881, '', 0, '🍔', 0, '', 'Where the first Shake Shack was a hot dog cart.'),
    L('Xavier High School', 40.7383, -73.9937, 'school', 70, '🏫', 70, 'block', 'A Jesuit school on 16th Street — and a friendly Regis rival.'),
    L('Union Square', 40.7359, -73.9906, 'subway', 90, '🥕', 0, '', 'The Greenmarket runs four days a week.'),
    // --- Downtown ---
    L('Grace Church', 40.7322, -73.9914, 'church', 40, '⛪', 40, 'church', 'A Gothic Revival church on a bend of Broadway.'),
    L('Washington Square Arch', 40.7312, -73.9971, '', 0, '🏛️', 0, '', 'The arch at the foot of Fifth Avenue.'),
    L('NYU', 40.7290, -73.9955, 'school', 110, '🎓', 0, '', 'Purple flags all around Washington Square.'),
    L('Cooper Union', 40.7291, -73.9907, 'school', 50, '🎓', 50, 'block', 'Lincoln gave a famous speech here in 1860.'),
    L('Blue Note', 40.7309, -74.0005, 'music', 40, '🎷', 0, '', 'Jazz every night on West 3rd Street.'),
    L('Tompkins Square Park', 40.7265, -73.9818, '', 0, '🐕', 0, '', 'The Halloween dog parade is legendary.'),
    L('Bleecker St', 40.7259, -73.9946, 'subway', 60, '🚇', 0, '', 'The 6 train meets the F and M.'),
    L('SoHo Cast Iron', 40.7233, -74.0030, '', 0, '🛍️', 0, '', 'Cast-iron buildings and cobblestones.'),
    L('Chinatown', 40.7158, -73.9970, 'chinatown', 230, '🏮', 0, '', 'Dim sum, lanterns and the Lunar New Year parade.'),
    L('Canal St', 40.7190, -74.0003, 'subway', 60, '🚇', 0, '', 'Six lines under the busiest street downtown.'),
    L('Tenement Museum', 40.7188, -73.9900, 'museum', 40, '🏚️', 0, '', 'How immigrant families lived on Orchard Street.'),
    L('Stuyvesant High School', 40.7178, -74.0138, 'school', 90, '🏫', 90, 'block', 'A public school on the Hudson with a bridge over the West Side Highway.'),
    L('City Hall', 40.7128, -74.0060, '', 0, '🏛️', 50, 'block', 'New York’s City Hall has been here since 1812.'),
    L('One World Trade Center', 40.7127, -74.0134, 'finance', 90, '🏙️', 90, 'tower', 'The tallest building in the Western Hemisphere: 1,776 feet.'),
    L('The Oculus', 40.7115, -74.0110, 'subway', 70, '🕊️', 60, 'oculus', 'White steel ribs over a giant transit hall.'),
    L('St. Paul’s Chapel', 40.7113, -74.0091, 'church', 40, '⛪', 30, 'church', 'The oldest surviving church in Manhattan.'),
    L('Brooklyn Bridge', 40.7075, -73.9980, '', 0, '🌉', 0, '', 'Opened in 1883. Bridgoyle perches on the towers.'),
    L('South Street Seaport', 40.7066, -74.0033, '', 0, '⚓', 0, '', 'Tall ships and cobblestones.'),
    L('Trinity Church', 40.7081, -74.0120, 'church', 60, '⛪', 50, 'church', 'Alexander Hamilton is buried in its churchyard.'),
    L('New York Stock Exchange', 40.7069, -74.0113, 'finance', 90, '📈', 70, 'block', 'The opening bell rings at 9:30.'),
    L('Wall St', 40.7070, -74.0090, 'finance', 90, '🚇', 0, '', 'The street was named for a wall built in 1653.'),
    L('Charging Bull', 40.7056, -74.0134, 'finance', 60, '🐂', 0, '', 'Bullion was modeled on this statue. Or was it the other way around?'),
    L('Battery Park', 40.7033, -74.0170, '', 0, '🌊', 0, '', 'Where Manhattan ends and the harbor begins.'),
    L('Staten Island Ferry', 40.7013, -74.0132, 'harbor', 70, '⛴️', 0, '', 'Free rides past the Statue of Liberty.'),
    L('South Ferry', 40.7019, -74.0134, 'subway', 50, '🚇', 0, '', 'The bottom of the 1 train.'),
    L('Governors Island', 40.6894, -74.0167, 'harbor', 250, '🏝️', 0, '', 'A car-free island park with hammocks and hills.'),
    L('Statue of Liberty', 40.6892, -74.0445, 'harbor', 160, '🗽', 70, 'star', 'A gift from France in 1886. Libertitan guards her torch.'),
    L('Ellis Island', 40.6992, -74.0395, 'harbor', 160, '🧳', 90, 'block', 'Twelve million immigrants entered America here.'),
    // --- New Jersey ---
    L('Hoboken Terminal', 40.7352, -74.0283, 'subway', 90, '🚉', 80, 'block', 'Ferries, PATH and trains under a green copper clock tower.'),
    L('Pier A Park', 40.7370, -74.0262, '', 0, '🌳', 0, '', 'The best view of the Empire State Building from New Jersey.'),
    L('Carlo’s Corner Bakery', 40.7373, -74.0294, 'nj', 50, '🍰', 0, '', 'Cannolisk guards every bakery on Washington Street.'),
    L('Stevens Institute', 40.7448, -74.0256, 'school', 140, '🎓', 0, '', 'An engineering school up on Castle Point.'),
    L('Elysian Park', 40.7484, -74.0265, '', 0, '⚾', 0, '', 'Near the field where one of the first recorded baseball games was played in 1846.'),
    L('Frank Sinatra Park', 40.7430, -74.0253, 'music', 50, '🎙️', 0, '', 'Named for Hoboken’s most famous singer.'),
    L('Hamilton Park Overlook', 40.7672, -74.0200, 'nj', 90, '🎩', 0, '', 'The cliffs above the spot where Hamilton and Burr dueled in 1804.'),
    L('Weehawken Ferry', 40.7770, -74.0110, 'harbor', 60, '⛴️', 0, '', 'Ferries to Midtown across the Hudson.'),
    L('Celia Cruz Park', 40.7660, -74.0310, 'music', 70, '🎺', 0, '', 'Union City honors the Queen of Salsa on Bergenline Avenue.'),
    L('Bergenline Avenue', 40.7730, -74.0290, 'nj', 90, '🛍️', 0, '', 'The longest shopping street in New Jersey.'),
    L('Washington Park', 40.7745, -74.0275, '', 0, '🌳', 0, '', 'Union City’s big green square.'),
    L('Newport Centre', 40.7270, -74.0376, 'nj', 90, '🛍️', 90, 'block', 'A mall on the Jersey City waterfront.'),
    L('Newport PATH', 40.7270, -74.0339, 'subway', 60, '🚇', 0, '', 'One stop from Hoboken, one from Manhattan.'),
    L('Exchange Place', 40.7163, -74.0329, 'subway', 70, '🚇', 0, '', 'PATH trains dive under the Hudson here.'),
    L('Colgate Clock', 40.7158, -74.0336, 'nj', 50, '🕰️', 0, '', 'A giant clock facing Manhattan since 1924.'),
    L('Grove Street', 40.7195, -74.0431, 'subway', 70, '🚇', 0, '', 'Restaurants and a plaza in downtown Jersey City.'),
    L('Hamilton Park', 40.7267, -74.0440, '', 0, '🌳', 0, '', 'A brownstone park in Jersey City.'),
    L('Journal Square', 40.7327, -74.0630, 'subway', 90, '🚉', 0, '', 'The Loew’s Jersey movie palace opened here in 1929.'),
    L('Liberty Science Center', 40.7086, -74.0547, 'museum', 100, '🔭', 100, 'dome', 'The biggest planetarium in the Western Hemisphere.'),
    L('Liberty State Park', 40.7040, -74.0500, '', 0, '🌳', 0, '', 'Wide lawns facing the Statue of Liberty.'),
    L('Central Railroad Terminal', 40.7046, -74.0420, 'harbor', 60, '🚉', 60, 'block', 'Immigrants from Ellis Island caught their trains west here.'),
    // --- Other boroughs & islands ---
    L('Roosevelt Island Tram', 40.7575, -73.9540, '', 0, '🚡', 0, '', 'A red cable car over the East River.'),
    L('Mill Rock Island', 40.7806, -73.9376, 'river', 60, '🏝️', 0, '', 'A tiny island. Strange lights appear above it at night.'),
    L('DUMBO', 40.7033, -73.9881, '', 0, '📸', 0, '', 'The famous view of the Manhattan Bridge.'),
    L('Long Island City', 40.7447, -73.9535, '', 0, '🥤', 0, '', 'The giant Pepsi-Cola sign glows across the river.'),
  ];

  return {
    LAT0, LAT1, LON0, LON1, PPM, W, H, toXY, toLL, inBounds, poly, makeGrid, rectPoly, ellPoly,
    MGRID, AVENUES, STREET_M, streetU, streetOf, LANDS, GRIDS, PARKS, LAKES, LAWNS, BROADWAY, HIGH_LINE, BRIDGES, WATER_LABELS, HOODS, LANDMARKS,
    MANHATTAN, NEW_JERSEY,
  };
})();
