// Regimon GO — hand-drawn art for the exclusive dragon (a real dragon silhouette instead of the round creature body).
// Uses the species' color (dark scales), belly (steel armor) and glow (electricity), so the shiny recolor still works.
window.RGDragonArt = (() => {
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function draw(sp) {
    const id = String(sp.id).replace(/\W/g, '');
    const body = sp.color, steel = sp.belly, volt = sp.glow || '#facc15';
    const dark = shade(body, -0.55), mid = shade(body, 0.18), lite = shade(body, 0.4);
    const steelD = shade(steel, -0.45), steelL = shade(steel, 0.55);
    const line = `stroke="${dark}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
    const stars = (sp.extras || []).includes('stars');
    // claws: three little white hooks at a foot
    const claws = (x, y, s = 1) => [0, 1, 2].map(k => { const cx = x - k * 3.1 * s; return `<path d="M${cx},${y - 2.2 * s} Q${cx - 2.6 * s},${y - 1.6 * s} ${cx - 3.3 * s},${y + 0.6 * s} Q${cx - 1.6 * s},${y - 0.2 * s} ${cx + 0.6 * s},${y} Z" fill="#f1f5f9" stroke="${dark}" stroke-width=".5"/>`; }).join('');
    // a jagged lightning bolt from a to b
    const bolt = (x1, y1, x2, y2, seed, w = 1.1) => {
      let d = `M${x1},${y1}`, r = seed;
      for (let i = 1; i < 5; i++) {
        r = (r * 9301 + 49297) % 233280;
        const k = i / 5, off = (r / 233280 - 0.5) * 6;
        d += ` L${(x1 + (x2 - x1) * k + off).toFixed(1)},${(y1 + (y2 - y1) * k - off).toFixed(1)}`;
      }
      d += ` L${x2},${y2}`;
      return `<path d="${d}" stroke="${volt}" stroke-width="${w * 2.6}" fill="none" opacity=".35" filter="url(#gl${id})"/><path d="${d}" stroke="#fffbe6" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`;
    };
    // wing: shoulder, elbow, wrist tip, then finger tips; membrane scallops bow inward between fingers
    const wing = (pts, fill, bone) => {
      const [s, e, w, ...f] = pts;
      let d = `M${s} L${e} L${w} L${f[0]}`;
      let prev = f[0];
      for (const t of [...f.slice(1), s]) {
        const [px, py] = prev.split(',').map(Number), [tx, ty] = t.split(',').map(Number);
        const mx = (px + tx) / 2, my = (py + ty) / 2, cx = mx - (ty - py) * 0.32, cy = my + (tx - px) * 0.32;
        d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${t}`;
        prev = t;
      }
      const bones = f.slice(1).map(t => `<path d="M${w} L${t}" stroke="${bone}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`).join('');
      return `<path d="${d} Z" fill="${fill}" ${line}/>` +
        `<path d="M${s} L${e} L${w} L${f[0]}" stroke="${bone}" stroke-width="2.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` + bones +
        `<path d="M${w} l-1.5,-4.5 l3.2,3.2 z" fill="#f1f5f9" stroke="${dark}" stroke-width=".5"/>`;
    };

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
<defs>
  <radialGradient id="au${id}" cx=".55" cy=".55"><stop offset="0" stop-color="${volt}" stop-opacity=".45"/><stop offset=".6" stop-color="${mid}" stop-opacity=".18"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient>
  <linearGradient id="bd${id}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${lite}"/><stop offset=".45" stop-color="${body}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="wg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset=".6" stop-color="${shade(body, -0.25)}"/><stop offset="1" stop-color="${shade(volt, -0.55)}"/></linearGradient>
  <linearGradient id="wf${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(body, -0.2)}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="st${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${steelL}"/><stop offset=".55" stop-color="${steel}"/><stop offset="1" stop-color="${steelD}"/></linearGradient>
  <filter id="gl${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
</defs>
<circle cx="54" cy="52" r="48" fill="url(#au${id})"/>
<ellipse cx="54" cy="93" rx="33" ry="4.2" fill="rgba(0,0,0,.25)"/>

<!-- far wing (behind) -->
${wing(['60,50', '70,28', '86,18', '99,8', '99,36', '94,50', '83,56', '70,57'], `url(#wf${id})`, steelD)}
<!-- tail: sweeps right and curls up to a lightning tip -->
<path d="M66,61 Q86,62 92,71 Q98,80 93,86.5 Q88,90 85,85.5 Q89,83 87.5,78.5 Q82,72 67,74 Z" fill="url(#bd${id})" ${line}/>
<path d="M92,84 L97,79 L95,82 L99,80 L94,89 L95,85 Z" fill="${volt}" stroke="#fffbe6" stroke-width=".6"/>
${[[74, 66], [81, 68], [87, 73]].map(([x, y]) => `<path d="M${x},${y} l2,-4.5 l2,4" fill="${steel}" ${line}/>`).join('')}
<!-- far legs -->
<path d="M64,62 Q77,58 79,68 Q80,74 76,77 L80,85 Q81,89 77,89.5 L68,89.5 Q66,87 70,86 L71,79 Q63,74 64,62 Z" fill="${shade(body, -0.32)}" ${line}/>
${claws(69, 89.5, 0.85)}
<path d="M42,62 Q50,62 49,70 L46,78 Q47,85 50,89.5 L41,89.5 Q40,86 43,84 L42,76 Q38,70 42,62 Z" fill="${shade(body, -0.32)}" ${line}/>
${claws(42, 89.5, 0.85)}

<!-- body -->
<path d="M32,58 Q36,44 54,45 Q72,46 74,60 Q75,74 58,76 Q40,77 34,68 Q31,63 32,58 Z" fill="url(#bd${id})" ${line}/>
<!-- steel belly plates -->
${[0, 1, 2, 3, 4].map(i => `<path d="M${38 + i * 6.5},${70.5 - Math.abs(i - 2) * 0.8} q3.2,3.4 6.4,0" fill="url(#st${id})" ${line}/>`).join('')}
<path d="M36,66 Q52,74 70,70" stroke="${steelD}" stroke-width=".8" fill="none"/>
<!-- scales -->
${[[48, 54], [55, 52], [62, 55], [52, 60], [59, 61], [66, 61]].map(([x, y]) => `<path d="M${x},${y} q2,2 4,0" stroke="${lite}" stroke-width=".7" fill="none" opacity=".7"/>`).join('')}
<!-- armored shoulder plate with rivets -->
<path d="M40,52 Q48,45 56,50 Q56,58 48,60 Q41,59 40,52 Z" fill="url(#st${id})" ${line}/>
<circle cx="45" cy="53" r=".9" fill="${steelD}"/><circle cx="51" cy="52" r=".9" fill="${steelD}"/><circle cx="48" cy="57" r=".9" fill="${steelD}"/>

<!-- near hind leg -->
<path d="M55,60 Q70,53 73,65 Q74,72 69,76 L74,85 Q75,90 71,90.5 L60,90.5 Q58,87.5 63,87 L64,79 Q54,73 55,60 Z" fill="url(#bd${id})" ${line}/>
<path d="M58,63 Q66,58 70,64 Q67,70 60,69 Z" fill="url(#st${id})" ${line}/>
${claws(61, 90.5)}
<!-- near front leg -->
<path d="M33,60 Q43,58 43,67 L40,77 Q41,85 44,90.5 L33,90.5 Q31,88 35,86.5 L34,78 Q29,70 33,60 Z" fill="url(#bd${id})" ${line}/>
<path d="M34,63 Q40,61 41.5,66 Q39,70 35,69 Z" fill="url(#st${id})" ${line}/>
${claws(35, 90.5)}

<!-- near wing (in front of the body) -->
${wing(['50,48', '58,26', '74,10', '94,1', '96,26', '88,40', '76,46', '62,51'], `url(#wg${id})`, steel)}

<!-- dorsal spikes along the back and neck -->
${[[70, 50], [64, 47], [58, 45.5], [36, 38], [33, 31]].map(([x, y], i) => `<path d="M${x - 2.4},${y + 1} L${x + 0.6},${y - 5.5 + (i > 2 ? 0 : 0.5)} L${x + 2.6},${y + 1.2} Z" fill="url(#st${id})" ${line}/>`).join('')}
<!-- neck: arches up and left to the head -->
<path d="M44,50 Q34,44 32,34 Q31,28 28,24 L37,22 Q40,30 42,36 Q46,44 50,47 Z" fill="url(#bd${id})" ${line}/>
${[0, 1, 2, 3].map(i => `<path d="M${33 + i * 2.8},${27 + i * 5.2} q2.8,1 5,-1.2" stroke="${steel}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`).join('')}

<!-- horns: two pairs swept back, steel -->
<path d="M30,17 Q38,9 48,5 Q42,11 34,20 Z" fill="url(#st${id})" ${line}/>
<path d="M33,21 Q42,17 50,17 Q43,20 36,24 Z" fill="url(#st${id})" ${line}/>
<!-- lower jaw, slightly open -->
<path d="M30,30 L16,31 Q8,31.5 6,33 Q9,37 17,36 L31,34 Z" fill="${shade(body, -0.25)}" ${line}/>
<path d="M8,33 Q12,34.5 17,34" stroke="${shade(volt, -0.1)}" stroke-width=".8" fill="none" opacity=".8"/>
${[9, 12.5, 16].map(x => `<path d="M${x},${33.6} l1,-2 l1,2 z" fill="#f8fafc"/>`).join('')}
<!-- head -->
<path d="M36,23 Q33,14 23,15 Q16,16 11,20 L5,24 Q2,27 5,29 L16,30.5 L30,30.5 Q37,29 36,23 Z" fill="url(#bd${id})" ${line}/>
<!-- steel brow plate and snout ridge -->
<path d="M18,17.6 Q25,14 33,17.5 Q27,18 21,21 Z" fill="url(#st${id})" ${line}/>
<path d="M6,24.5 Q11,21 17,20.5" stroke="${steelL}" stroke-width=".9" fill="none"/>
<!-- upper teeth and fang -->
${[7, 10.5, 14, 17.5].map(x => `<path d="M${x},${30.3} l1,2.2 l1,-2.2 z" fill="#f8fafc"/>`).join('')}
<path d="M21,30.3 l1.3,3.4 l1.2,-3.4 z" fill="#f8fafc"/>
<!-- glowing eye -->
<path d="M19,22.5 L27,20 Q26.5,24 22,24.8 Z" fill="${volt}" stroke="${dark}" stroke-width=".7"/>
<path d="M23.2,21.3 L23.8,24" stroke="${dark}" stroke-width="1.1"/>
<path d="M18,21 L28,17.8" stroke="${dark}" stroke-width="1.3" stroke-linecap="round"/>
<!-- nostril crackling with electricity -->
<ellipse cx="6.8" cy="25.3" rx="1.1" ry=".7" fill="${dark}"/>
<!-- jaw frill spikes -->
<path d="M30,30.5 L37,33 L31,33.2 L35,36.5 L29,34.2 Z" fill="url(#st${id})" ${line}/>

<!-- electricity: arcs between the horns, down the spine, from the jaws -->
${bolt(48, 5, 50, 17, 7)}
${bolt(4, 29, -1, 36, 3, 0.9)}
${bolt(62, 43, 76, 49, 11, 0.8)}
${bolt(26, 40, 20, 50, 5, 0.8)}
<circle cx="4" cy="30" r="2.4" fill="${volt}" opacity=".5" filter="url(#gl${id})"/>
${stars ? [[12, 50], [88, 88], [80, 6], [30, 88]].map(([x, y]) => `<path d="M${x},${y - 3} L${x + 0.9},${y - 0.9} L${x + 3},${y} L${x + 0.9},${y + 0.9} L${x},${y + 3} L${x - 0.9},${y + 0.9} L${x - 3},${y} L${x - 0.9},${y - 0.9} Z" fill="#fff7c2"/>`).join('') : ''}
</svg>`;
  }
  return { draw };
})();
