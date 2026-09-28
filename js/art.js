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
    const { cx, cy, rx, ry, ex } = GEO[sp.body];
    const c = sp.color, b = sp.belly, d = shade(c, -0.38), l = shade(c, 0.3);
    const X = e => (sp.extras || []).includes(e);
    const top = cy - ry;
    const ey = GEO[sp.body].ey - (X('snout') ? 4 : 0);
    const st = `stroke="${d}" stroke-width="2" stroke-linejoin="round"`;
    const pt = (a, k) => `${(cx + rx * k * Math.cos(a)).toFixed(1)},${(cy + ry * k * Math.sin(a)).toFixed(1)}`;
    let back = '', body = '', front = '';

    back += `<ellipse cx="50" cy="94" rx="27" ry="4" fill="rgba(0,0,0,.18)"/>`;

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
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" ${st}/>`;
    } else if (sp.body === 'ghost') {
      body += `<path d="M22,60 Q22,26 50,26 Q78,26 78,60 L78,86 Q72,80 66,86 Q60,92 54,86 Q48,80 42,86 Q36,92 30,86 Q26,82 22,86 Z" fill="${c}" ${st} opacity=".95"/>`;
    } else {
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" ${st}/>`;
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

    // eyes
    const er = sp.eyes === 'big' ? 8.5 : 6;
    for (const s of [-1, 1]) {
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
    } else if (!X('snout')) {
      front += `<path d="M${cx - 5},${ey + 10} Q${cx},${ey + 15} ${cx + 5},${ey + 10}" stroke="${d}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      if (X('teeth')) front += `<polygon points="${cx - 4},${ey + 11} ${cx - 1},${ey + 11.8} ${cx - 2.6},${ey + 14.5}" fill="#fff"/><polygon points="${cx + 4},${ey + 11} ${cx + 1},${ey + 11.8} ${cx + 2.6},${ey + 14.5}" fill="#fff"/>`;
    }

    if (X('hat'))
      front += `<polygon points="${cx - 17},${top + 7} ${cx + 3},${top - 24} ${cx + 17},${top + 7}" fill="#3b1f7a" stroke="#241050" stroke-width="2" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${top + 7}" rx="21" ry="5" fill="#2a1260"/><text x="${cx + 1}" y="${top - 3}" font-size="10" text-anchor="middle" fill="#f2c14e">★</text>`;
    if (X('cap'))
      front += `<rect x="${cx - 14}" y="${top - 9}" width="28" height="13" rx="4" fill="#1f3a93"/><rect x="${cx - 14}" y="${top}" width="28" height="3" fill="#f2c14e"/><ellipse cx="${cx}" cy="${top + 5}" rx="18" ry="3.5" fill="#1b1b2f"/>`;
    if (X('flame'))
      front += `<line x1="${cx}" y1="${top + 1}" x2="${cx}" y2="${top - 6}" stroke="#333" stroke-width="2"/><path d="M${cx},${top - 26} Q${cx + 11},${top - 10} ${cx},${top - 4} Q${cx - 11},${top - 10} ${cx},${top - 26}Z" fill="#ff8a1f"/><path d="M${cx},${top - 18} Q${cx + 5},${top - 9} ${cx},${top - 6} Q${cx - 5},${top - 9} ${cx},${top - 18}Z" fill="#ffe066"/>`;

    // signature accessory
    const [ax, ay] = sp.accPos === 'head' ? [cx, top - 3] : [cx + rx - 1, cy + ry * 0.35];
    front += `<text x="${ax}" y="${ay}" font-size="${sp.accPos === 'head' ? 19 : 20}" text-anchor="middle" dominant-baseline="central" font-family="${EMOJI_FONT}">${sp.acc}</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">${back}${body}${front}</svg>`;
  }

  const cache = {};
  function entry(sp) {
    if (!cache[sp.id]) {
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(sp));
      const img = new Image();
      img.src = url;
      cache[sp.id] = { url, img };
    }
    return cache[sp.id];
  }

  return {
    svg, shade,
    url: sp => entry(sp).url,
    img: sp => entry(sp).img,
    preload: list => list.forEach(entry),
  };
})();
