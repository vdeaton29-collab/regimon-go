// Regimon GO — procedural creature art. Every Regimon is drawn as an SVG from its species data.
window.RGArt = (() => {
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  const GEO = {
    round: { cx: 50, cy: 60, rx: 30, ry: 28, ey: 52, ex: 11 },
    tall: { cx: 50, cy: 58, rx: 24, ry: 32, ey: 46, ex: 9 },
    wide: { cx: 50, cy: 64, rx: 36, ry: 24, ey: 58, ex: 12 },
    worm: { cx: 58, cy: 50, rx: 19, ry: 18, ey: 48, ex: 8 },
    ghost: { cx: 50, cy: 56, rx: 28, ry: 30, ey: 50, ex: 10 },
  };
  const EMOJI_FONT = 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif';

  function svg(sp) {
    if (sp.art === 'dragon' && window.RGDragonArt) return window.RGDragonArt.draw(sp);
    const { cx, cy, rx, ry, ex } = GEO[sp.body];
    const c = sp.color, b = sp.belly, d = shade(c, -0.38), l = shade(c, 0.3);
    const X = e => (sp.extras || []).includes(e);
    const top = cy - ry;
    const ey = GEO[sp.body].ey - (X('snout') ? 4 : 0);
    const st = `stroke="${d}" stroke-width="2" stroke-linejoin="round"`;
    const pt = (a, k) => `${(cx + rx * k * Math.cos(a)).toFixed(1)},${(cy + ry * k * Math.sin(a)).toFixed(1)}`;
    let back = '', body = '', front = '';
    const glow = sp.glow || '#ffffff';
    const fierce = sp.eyes === 'fierce';
    const bf = X('gradient') ? `url(#bg${sp.id})` : c;
    const defs = `<defs>
      <radialGradient id="au${sp.id}"><stop offset="0" stop-color="${glow}" stop-opacity=".7"/><stop offset=".55" stop-color="${glow}" stop-opacity=".25"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bg${sp.id}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${shade(c, 0.35)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.45)}"/></linearGradient>
      <filter id="nf${sp.id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
    </defs>`;

    if (X('aura')) back += `<circle cx="50" cy="56" r="49" fill="url(#au${sp.id})"/>`;
    if (X('rays')) for (let i = 0; i < 9; i++) {
      const a = (-170 + i * 20) * Math.PI / 180, bx = cx, by = top + 12;
      const p = (r, da) => `${(bx + Math.cos(a + da) * r).toFixed(1)},${(by + Math.sin(a + da) * r).toFixed(1)}`;
      back += `<polygon points="${p(14, -0.12)} ${p(i % 2 ? 30 : 38, 0)} ${p(14, 0.12)}" fill="${glow}" opacity="${i % 2 ? 0.55 : 0.85}"/>`;
    }
    if (X('neon'))
      back += `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 3}" ry="${ry + 3}" fill="none" stroke="${glow}" stroke-width="5" filter="url(#nf${sp.id})"/>`;
    back += `<ellipse cx="50" cy="94" rx="27" ry="4" fill="rgba(0,0,0,.18)"/>`;

    // elite features drawn behind the body
    if (X('bladewings')) for (const s of [-1, 1]) {
      const sx = cx + s * rx * 0.55, sy = cy - ry * 0.35;
      const p = (dx, dy) => `${(sx + s * dx).toFixed(1)},${(sy + dy).toFixed(1)}`;
      back += `<polygon points="${p(0, 0)} ${p(rx * 0.5 + 24, -ry * 0.9 - 6)} ${p(rx * 0.5 + 16, -ry * 0.35)} ${p(rx * 0.5 + 26, -ry * 0.2)} ${p(rx * 0.5 + 14, ry * 0.12)} ${p(rx * 0.5 + 20, ry * 0.35)} ${p(6, ry * 0.45)}" fill="${d}" stroke="${glow}" stroke-width="1.2" stroke-linejoin="round"/>`;
      back += `<polyline points="${p(4, 2)} ${p(rx * 0.5 + 18, -ry * 0.7)}" stroke="${glow}" stroke-width="1" opacity=".6" fill="none"/>`;
    }
    if (X('horns')) for (const s of [-1, 1]) {
      const h = `M${cx + s * rx * 0.35},${top + 6} Q${cx + s * rx * 1.05},${top - 4} ${cx + s * rx * 0.8},${top - 20}`;
      back += `<path d="${h}" stroke="${d}" stroke-width="7.5" fill="none" stroke-linecap="round"/><path d="${h}" stroke="#eef2f7" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    }
    if (X('crystals')) for (let i = 0; i < 5; i++) {
      const a = (-150 + i * 30) * Math.PI / 180;
      back += `<polygon points="${pt(a - 0.12, 0.9)} ${pt(a, 1.42)} ${pt(a + 0.12, 0.9)}" fill="#e0f7ff" stroke="#67e8f9" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    if (X('gills')) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const gx = cx + s * (rx * 0.75), gy = ey - 8 + k * 7;
      back += `<path d="M${gx},${gy} q${s * 10},${-6 + k * 3} ${s * 18},${-4 + k * 5}" stroke="${glow}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    }

    // ears
    for (const s of [-1, 1]) {
      switch (sp.ears) {
        case 'cat':
          back += `<polygon points="${cx + s * rx * 0.85},${top + 14} ${cx + s * rx * 0.62},${top - 10} ${cx + s * rx * 0.18},${top + 5}" fill="${c}" ${st}/>`;
          back += `<polygon points="${cx + s * rx * 0.7},${top + 10} ${cx + s * rx * 0.6},${top - 3} ${cx + s * rx * 0.36},${top + 6}" fill="#ffb3c1"/>`;
          break;
        case 'tufts':
          back += `<polygon points="${cx + s * rx * 0.78},${top + 12} ${cx + s * rx * 0.95},${top - 12} ${cx + s * rx * 0.32},${top + 4}" fill="${d}" ${st}/>`;
          break;
        case 'bunny':
          back += `<ellipse cx="${cx + s * 11}" cy="${top - 8}" rx="6.5" ry="16" transform="rotate(${s * 14} ${cx + s * 11} ${top - 8})" fill="${c}" ${st}/>`;
          back += `<ellipse cx="${cx + s * 11}" cy="${top - 7}" rx="3" ry="10" transform="rotate(${s * 14} ${cx + s * 11} ${top - 7})" fill="${d}" opacity=".5"/>`;
          break;
        case 'round':
          back += `<circle cx="${cx + s * rx * 0.62}" cy="${top + 5}" r="8" fill="${c}" ${st}/><circle cx="${cx + s * rx * 0.62}" cy="${top + 5}" r="4" fill="#ffb3c1"/>`;
          break;
        case 'floppy':
          front += `<ellipse cx="${cx + s * rx * 0.86}" cy="${top + 18}" rx="8" ry="15" transform="rotate(${s * -22} ${cx + s * rx * 0.86} ${top + 18})" fill="${d}"/>`;
          break;
      }
    }

    if (X('wings')) for (const s of [-1, 1])
      back += `<ellipse cx="${cx + s * (rx + 1)}" cy="${cy - 2}" rx="11" ry="19" transform="rotate(${s * 28} ${cx + s * (rx + 1)} ${cy - 2})" fill="${d}"/>`;
    if (X('tail'))
      back += `<path d="M${cx + rx * 0.6},${cy + ry * 0.5} Q${cx + rx + 22},${cy + ry * 0.6} ${cx + rx + 15},${cy - 8}" fill="none" stroke="${d}" stroke-width="9" stroke-linecap="round"/>`;
    if (X('bigtail'))
      back += `<ellipse cx="${cx + rx + 3}" cy="${cy - 14}" rx="13" ry="26" transform="rotate(20 ${cx + rx + 3} ${cy - 14})" fill="${d}"/><ellipse cx="${cx + rx + 3}" cy="${cy - 18}" rx="7" ry="16" transform="rotate(20 ${cx + rx + 3} ${cy - 18})" fill="${c}" opacity=".6"/>`;
    if (X('spikes')) for (let i = 0; i < 7; i++) {
      const a = (-165 + i * 25) * Math.PI / 180;
      back += `<polygon points="${pt(a - 0.17, 0.92)} ${pt(a, 1.32)} ${pt(a + 0.17, 0.92)}" fill="${d}"/>`;
    }
    if (X('crest')) for (let i = 0; i < 3; i++) {
      const a = (-120 + i * 30) * Math.PI / 180;
      back += `<polygon points="${pt(a - 0.16, 0.9)} ${pt(a, 1.25)} ${pt(a + 0.16, 0.9)}" fill="#f2c14e" stroke="${d}" stroke-width="1.5"/>`;
    }
    if (X('fin'))
      back += `<polygon points="${cx - 14},${top + 5} ${cx - 8},${top - 16} ${cx + 6},${top + 3}" fill="${d}" stroke-linejoin="round"/>`;
    if (X('shell')) {
      back += `<ellipse cx="${cx}" cy="${cy - 7}" rx="${rx + 3}" ry="${ry + 5}" fill="${d}"/>`;
      for (let i = -2; i <= 2; i++) back += `<circle cx="${cx + i * 13}" cy="${cy - ry - 1 + Math.abs(i) * 4}" r="3.2" fill="${l}" opacity=".7"/>`;
    }
    if (X('tentacles')) for (let i = 0; i < 5; i++)
      back += `<ellipse cx="${cx - rx * 0.8 + i * rx * 0.4}" cy="${cy + ry - 3}" rx="5.5" ry="11" fill="${c}" ${st}/>`;
    if (X('tailfin'))
      back += `<polygon points="${cx + rx - 6},${cy + 2} ${cx + rx + 17},${cy - 15} ${cx + rx + 12},${cy + 2} ${cx + rx + 17},${cy + 19}" fill="${d}" stroke-linejoin="round"/>`;
    if (X('claws')) for (const s of [-1, 1]) {
      const x = cx + s * (rx + 7), y = cy - 8;
      back += `<line x1="${cx + s * rx * 0.8}" y1="${cy}" x2="${x}" y2="${y + 4}" stroke="${d}" stroke-width="5" stroke-linecap="round"/>`;
      back += `<circle cx="${x}" cy="${y}" r="9" fill="${c}" ${st}/><path d="M${x},${y} L${x + s * 7},${y - 7}" stroke="${d}" stroke-width="3" stroke-linecap="round"/>`;
    }
    if (X('mane')) for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      back += `<circle cx="${(cx + Math.cos(a) * (rx + 3)).toFixed(1)}" cy="${(cy - 3 + Math.sin(a) * (ry + 2)).toFixed(1)}" r="8" fill="${i % 2 ? '#ffffff' : '#ffe98a'}" stroke="#e0b100" stroke-width="1.2"/>`;
    }
    if (X('spiral')) {
      back += `<circle cx="${cx + 8}" cy="${cy - 8}" r="${ry + 4}" fill="${l}" ${st}/>`;
      back += `<path d="M${cx + 8},${cy - 8} m-4,0 a4,4 0 1,1 8,0 a8,8 0 1,1 -16,0 a13,13 0 1,1 26,0 a19,19 0 1,1 -38,0" fill="none" stroke="${d}" stroke-width="2.2"/>`;
    }
    if (X('antenna')) for (const s of [-1, 1])
      back += `<line x1="${cx + s * 5}" y1="${top + 3}" x2="${cx + s * 12}" y2="${top - 11}" stroke="${d}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx + s * 12}" cy="${top - 12}" r="3.5" fill="${l}" ${st}/>`;

    // feet
    if (['round', 'tall', 'wide'].includes(sp.body)) for (const s of [-1, 1])
      back += `<ellipse cx="${cx + s * rx * 0.45}" cy="${cy + ry - 2}" rx="8" ry="5" fill="${d}"/>`;

    // body
    if (sp.body === 'worm') {
      for (const [x, y, r] of [[22, 80, 10], [33, 76, 11.5], [45, 69, 13]])
        body += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${st}/><circle cx="${x}" cy="${y + r * 0.35}" r="${r * 0.55}" fill="${b}"/>`;
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bf}" ${st}/>`;
    } else if (sp.body === 'ghost') {
      body += `<path d="M22,60 Q22,26 50,26 Q78,26 78,60 L78,86 Q72,80 66,86 Q60,92 54,86 Q48,80 42,86 Q36,92 30,86 Q26,82 22,86 Z" fill="${bf}" ${st} opacity=".95"/>`;
    } else {
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bf}" ${st}/>`;
      body += `<ellipse cx="${cx}" cy="${cy + ry * 0.3}" rx="${rx * 0.62}" ry="${ry * 0.55}" fill="${b}"/>`;
      body += `<ellipse cx="${cx - rx * 0.45}" cy="${cy - ry * 0.55}" rx="${rx * 0.2}" ry="${ry * 0.12}" fill="#fff" opacity=".25"/>`;
    }

    if (X('stripes')) for (const s of [-1, 1]) for (let k = 0; k < 3; k++)
      front += `<path d="M${cx + s * rx * 0.97},${cy - 6 + k * 9} L${cx + s * rx * 0.64},${cy - 3 + k * 9}" stroke="${d}" stroke-width="3" stroke-linecap="round"/>`;
    if (X('stripes'))
      front += `<path d="M${cx - 5},${top + 3} L${cx - 3},${top + 9} M${cx},${top + 1} L${cx},${top + 8} M${cx + 5},${top + 3} L${cx + 3},${top + 9}" stroke="${d}" stroke-width="2.5" stroke-linecap="round"/>`;
    if (X('wraps')) for (let k = 0; k < 4; k++)
      front += `<path d="M${cx - rx * 0.95},${cy - ry * 0.35 + k * ry * 0.33} Q${cx},${cy - ry * 0.2 + k * ry * 0.33} ${cx + rx * 0.95},${cy - ry * 0.45 + k * ry * 0.33}" stroke="${d}" stroke-width="2" fill="none" opacity=".45"/>`;
    if (X('headband'))
      front += `<rect x="${cx - rx * 0.92}" y="${top + 7}" width="${rx * 1.84}" height="6" rx="3" fill="#e63946"/><path d="M${cx + rx * 0.85},${top + 10} l8,-5 m-8,5 l9,3" stroke="#e63946" stroke-width="3" stroke-linecap="round"/>`;
    if (X('collar'))
      front += `<rect x="${cx - rx * 0.55}" y="${ey + 15}" width="${rx * 1.1}" height="6" rx="3" fill="#1b1b2f"/><rect x="${cx - 3}" y="${ey + 15.5}" width="6" height="5" fill="#fff"/>`;
    if (X('snout')) {
      front += `<ellipse cx="${cx}" cy="${ey + 13}" rx="17" ry="7.5" fill="${l}" ${st}/>`;
      front += `<circle cx="${cx - 5}" cy="${ey + 10}" r="1.4" fill="${d}"/><circle cx="${cx + 5}" cy="${ey + 10}" r="1.4" fill="${d}"/>`;
      front += `<path d="M${cx - 12},${ey + 15} L${cx + 12},${ey + 15}" stroke="${d}" stroke-width="1.5"/>`;
      if (X('teeth')) for (let i = -2; i <= 2; i++)
        front += `<polygon points="${cx + i * 5 - 2},${ey + 15} ${cx + i * 5 + 2},${ey + 15} ${cx + i * 5},${ey + 18.5}" fill="#fff"/>`;
    }

    if (X('armor')) for (let k = 0; k < 3; k++) {
      const y = cy + ry * 0.05 + k * ry * 0.24;
      front += `<path d="M${cx - rx * 0.45},${y} L${cx},${y + ry * 0.14} L${cx + rx * 0.45},${y}" stroke="${d}" stroke-width="2.6" fill="none" stroke-linejoin="round"/>`;
    }
    if (X('armor')) for (const s of [-1, 1]) front += `<circle cx="${cx + s * rx * 0.62}" cy="${cy - ry * 0.05}" r="2.2" fill="${glow}"/>`;
    if (X('bolts')) for (const s of [-1, 1])
      front += `<polygon points="${cx + s * rx * 0.72},${cy - 8} ${cx + s * rx * 0.5},${cy + 3} ${cx + s * rx * 0.66},${cy + 3} ${cx + s * rx * 0.48},${cy + 16} ${cx + s * rx * 0.86},${cy - 1} ${cx + s * rx * 0.7},${cy - 1}" fill="${glow}" stroke="${d}" stroke-width="1"/>`;
    if (X('cracks')) {
      const cr = `M${cx - rx * 0.7},${cy - 4} l8,5 l-3,7 l9,4 M${cx + rx * 0.2},${cy - ry * 0.6} l-4,8 l7,5 l-2,9 M${cx + rx * 0.75},${cy + 2} l-9,4 l2,7 M${cx - rx * 0.2},${cy + ry * 0.55} l6,-6 l7,2`;
      front += `<path d="${cr}" stroke="${glow}" stroke-width="4" fill="none" opacity=".35" stroke-linejoin="round"/><path d="${cr}" stroke="${glow}" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;
    }
    if (X('mask')) front += `<rect x="${cx - ex - 9}" y="${ey - 6}" width="${ex * 2 + 18}" height="11" rx="5.5" fill="${shade(c, -0.6)}"/>`;

    // eyes
    const er = sp.eyes === 'big' ? 8.5 : 6;
    if (fierce) for (const s of [-1, 1]) {
      const x = cx + s * ex, o = x + s * 6.5, i = x - s * 5.5;
      front += `<path d="M${i},${ey + 1} Q${x},${ey - 5.5} ${o},${ey - 2.5} Q${x + s * 1.5},${ey + 4.5} ${i},${ey + 1} Z" fill="${glow}" stroke="${shade(c, -0.6)}" stroke-width="1.4"/>`;
      front += `<ellipse cx="${x + s * 0.3}" cy="${ey}" rx="1.3" ry="3" fill="#0b0b16"/>`;
      front += `<circle cx="${x - s * 1.8}" cy="${ey - 1.8}" r="0.9" fill="#fff"/>`;
      front += `<path d="M${o + s * 1},${ey - 7.5} L${i - s * 1},${ey - 3}" stroke="${shade(c, -0.65)}" stroke-width="3" stroke-linecap="round"/>`;
    }
    if (!fierce) for (const s of [-1, 1]) {
      const x = cx + s * ex;
      if (sp.eyes === 'big') front += `<circle cx="${x}" cy="${ey}" r="${er + 3}" fill="${b}"/>`;
      front += `<circle cx="${x}" cy="${ey}" r="${er}" fill="#fff" stroke="${d}" stroke-width="1.5"/>`;
      front += `<circle cx="${x + s * 0.8}" cy="${ey + 1}" r="${er * 0.56}" fill="#1b1b2f"/>`;
      front += `<circle cx="${x - er * 0.2}" cy="${ey - er * 0.3}" r="${er * 0.22}" fill="#fff"/>`;
      front += `<ellipse cx="${cx + s * (ex + 9)}" cy="${ey + 8}" rx="4" ry="2.4" fill="#ff8fa3" opacity=".6"/>`;
      if (X('glasses')) front += `<circle cx="${x}" cy="${ey}" r="${er + 2.5}" fill="rgba(200,230,255,.25)" stroke="#1b1b2f" stroke-width="2"/>`;
    }
    if (X('glasses')) front += `<path d="M${cx - ex + er + 2},${ey - 1} Q${cx},${ey - 4} ${cx + ex - er - 2},${ey - 1}" stroke="#1b1b2f" stroke-width="2" fill="none"/>`;

    // mouth
    if (X('beak')) {
      front += `<polygon points="${cx - 4.5},${ey + 6} ${cx + 4.5},${ey + 6} ${cx},${ey + 13}" fill="#f4a13a" stroke="#b86e12" stroke-width="1"/>`;
    } else if (X('bill')) {
      front += `<ellipse cx="${cx}" cy="${ey + 11}" rx="10" ry="4.5" fill="#f4a13a" stroke="#b86e12" stroke-width="1"/><path d="M${cx - 8},${ey + 11} L${cx + 8},${ey + 11}" stroke="#b86e12" stroke-width="1"/>`;
    } else if (fierce) {
      front += `<path d="M${cx - 6},${ey + 11} Q${cx},${ey + 9} ${cx + 6},${ey + 11}" stroke="${shade(c, -0.65)}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      if (X('fangs')) for (const s of [-1, 1]) front += `<polygon points="${cx + s * 5.5},${ey + 10.3} ${cx + s * 2.5},${ey + 10} ${cx + s * 4},${ey + 15}" fill="#fff" stroke="${d}" stroke-width=".6"/>`;
    } else if (!X('snout')) {
      front += `<path d="M${cx - 5},${ey + 10} Q${cx},${ey + 15} ${cx + 5},${ey + 10}" stroke="${d}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      if (X('teeth')) front += `<polygon points="${cx - 4},${ey + 11} ${cx - 1},${ey + 11.8} ${cx - 2.6},${ey + 14.5}" fill="#fff"/><polygon points="${cx + 4},${ey + 11} ${cx + 1},${ey + 11.8} ${cx + 2.6},${ey + 14.5}" fill="#fff"/>`;
    }

    if (X('hat'))
      front += `<polygon points="${cx - 17},${top + 7} ${cx + 3},${top - 24} ${cx + 17},${top + 7}" fill="#3b1f7a" stroke="#241050" stroke-width="2" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${top + 7}" rx="21" ry="5" fill="#2a1260"/><text x="${cx + 1}" y="${top - 3}" font-size="10" text-anchor="middle" fill="#f2c14e">★</text>`;
    if (X('horn'))
      front += `<polygon points="${cx - 5},${ey + 9} ${cx + 5},${ey + 9} ${cx + 3},${ey - 9}" fill="#f5f0e1" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (X('cap'))
      front += `<rect x="${cx - 14}" y="${top - 9}" width="28" height="13" rx="4" fill="#1f3a93"/><rect x="${cx - 14}" y="${top}" width="28" height="3" fill="#f2c14e"/><ellipse cx="${cx}" cy="${top + 5}" rx="18" ry="3.5" fill="#1b1b2f"/>`;
    if (X('flame'))
      front += `<line x1="${cx}" y1="${top + 1}" x2="${cx}" y2="${top - 6}" stroke="#333" stroke-width="2"/><path d="M${cx},${top - 26} Q${cx + 11},${top - 10} ${cx},${top - 4} Q${cx - 11},${top - 10} ${cx},${top - 26}Z" fill="#ff8a1f"/><path d="M${cx},${top - 18} Q${cx + 5},${top - 9} ${cx},${top - 6} Q${cx - 5},${top - 9} ${cx},${top - 18}Z" fill="#ffe066"/>`;

    if (X('flamecrest')) for (let k = -2; k <= 2; k++) {
      const fx = cx + k * 6, h = 18 - Math.abs(k) * 4, by = top + 5 + Math.abs(k) * 2;
      front += `<path d="M${fx - 5},${by} Q${fx - 6},${by - h * 0.6} ${fx + k},${by - h} Q${fx + 6},${by - h * 0.5} ${fx + 5},${by} Z" fill="#ff7b00"/><path d="M${fx - 2.5},${by} Q${fx - 3},${by - h * 0.4} ${fx + k * 0.6},${by - h * 0.65} Q${fx + 3},${by - h * 0.3} ${fx + 2.5},${by} Z" fill="#ffe066"/>`;
    }
    if (X('halo')) front += `<ellipse cx="${cx}" cy="${top - 9}" rx="15" ry="4.5" fill="none" stroke="${glow}" stroke-width="3.2"/><ellipse cx="${cx}" cy="${top - 9}" rx="15" ry="4.5" fill="none" stroke="#fff" stroke-width="1" opacity=".8"/>`;

    // signature accessory
    if (sp.acc) {
      const [ax, ay] = sp.accPos === 'head' ? [cx, top - 3] : [cx + rx - 1, cy + ry * 0.35];
      front += `<text x="${ax}" y="${ay}" font-size="${sp.accPos === 'head' ? 19 : 20}" text-anchor="middle" dominant-baseline="central" font-family="${EMOJI_FONT}">${sp.acc}</text>`;
    }

    if (X('stars')) for (const [x, y, r] of [[13, 20, 4], [87, 24, 5], [9, 68, 3], [91, 64, 4], [50, 5, 3.5], [24, 88, 3]]) {
      front += `<path d="M${x},${y - r * 1.8} L${x + r * 0.4},${y - r * 0.4} L${x + r * 1.8},${y} L${x + r * 0.4},${y + r * 0.4} L${x},${y + r * 1.8} L${x - r * 0.4},${y + r * 0.4} L${x - r * 1.8},${y} L${x - r * 0.4},${y - r * 0.4} Z" fill="${glow}" stroke="#fff" stroke-width=".6"/>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">${defs}${back}${body}${front}</svg>`;
  }

  // Shiny variants: same design, hue-shifted colors and sparkles.
  function hue(hex, deg) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    h = (h + deg + 360) % 360;
    const C = (1 - Math.abs(2 * l - 1)) * s, X2 = C * (1 - Math.abs((h / 60) % 2 - 1)), m = l - C / 2;
    [r, g, b] = h < 60 ? [C, X2, 0] : h < 120 ? [X2, C, 0] : h < 180 ? [0, C, X2] : h < 240 ? [0, X2, C] : h < 300 ? [X2, 0, C] : [C, 0, X2];
    const to = v => Math.round((v + m) * 255);
    return '#' + ((1 << 24) | (to(r) << 16) | (to(g) << 8) | to(b)).toString(16).slice(1);
  }
  function shinyOf(sp) {
    const shift = 140 + (sp.id * 37) % 80;
    return Object.assign({}, sp, {
      id: sp.id + 's', color: hue(sp.color, shift), belly: hue(sp.belly, shift), glow: hue(sp.glow || '#fde047', shift),
      extras: [...new Set([...(sp.extras || []), 'stars'])],
    });
  }

  const cache = {};
  function entry(sp, shiny) {
    const key = sp.id + (shiny ? 's' : '');
    if (!cache[key]) {
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(shiny ? shinyOf(sp) : sp));
      const img = new Image();
      img.src = url;
      cache[key] = { url, img };
    }
    return cache[key];
  }

  return {
    svg, shade,
    url: (sp, shiny) => entry(sp, shiny).url,
    img: (sp, shiny) => entry(sp, shiny).img,
    preload: list => list.forEach(sp => entry(sp)),
  };
})();
