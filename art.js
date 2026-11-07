// Hand-painted look without image files: every shape is a wobbly blob drawn as SVG,
// with a darker rim, a pale wash on top and a soft kawaii face.
(function (root) {
  const TAU = Math.PI * 2;

  function rand(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SHAPES = {
    circle: () => 1,
    flower: (a) => 0.76 + 0.24 * Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), 0.6),
    star: (a) => 0.82 + 0.18 * Math.cos(5 * (a + Math.PI / 2)),
    cloud: (a) => 0.86 + 0.14 * Math.pow(Math.abs(Math.cos(3.5 * a)), 0.6),
    clover: (a) => 0.74 + 0.26 * Math.pow(Math.abs(Math.cos(2 * a)), 0.6),
    scallop: (a) => 0.97 + 0.03 * Math.abs(Math.cos(6 * a)),
  };

  function blob(cx, cy, r, seed, shape = 'circle', wob = 0.035, n = 60) {
    const R = rand(seed);
    const p = [R() * TAU, R() * TAU, R() * TAU];
    const f = SHAPES[shape];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const w = 1 + wob * (Math.sin(a * 2 + p[0]) * 0.5 + Math.sin(a * 3 + p[1]) * 0.35 + Math.sin(a * 5 + p[2]) * 0.25);
      pts.push([cx + Math.cos(a) * r * f(a) * w, cy + Math.sin(a) * r * f(a) * w]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ` +
        `${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ` +
        `${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }

  // Rim + wash: the fill sits slightly off-center so the rim is thick on one side, thin on the other.
  function wash(cx, cy, r, pal, seed, shape = 'circle') {
    const R = rand(seed + 7);
    const ox = (R() - 0.5) * r * 0.07, oy = (R() - 0.5) * r * 0.07;
    return `<path d="${blob(cx, cy, r, seed, shape)}" fill="${pal.edge}"/>` +
      `<path d="${blob(cx + ox, cy + oy, r * 0.89, seed + 1, shape)}" fill="${pal.fill}"/>` +
      `<path d="${blob(cx - ox, cy - oy, r * 0.62, seed + 2, shape, 0.09)}" fill="${pal.light}" opacity=".6"/>`;
  }

  const INK = '#3d2b30';

  // Each color has its own expression, so colors can also be told apart without seeing them.
  function face(kind, cx, cy, s, ink = INK) {
    const e = 0.32 * s, y = cy - 0.04 * s;
    const eye = (x) => `<ellipse cx="${x}" cy="${y}" rx="${0.105 * s}" ry="${0.135 * s}" fill="${ink}"/>` +
      `<circle cx="${x + 0.03 * s}" cy="${y - 0.05 * s}" r="${0.035 * s}" fill="#fff"/>`;
    const arc = (x, up) => `<path d="M${x - 0.13 * s} ${y + (up ? 0.05 : -0.03) * s}Q${x} ${y + (up ? -0.16 : 0.14) * s} ${x + 0.13 * s} ${y + (up ? 0.05 : -0.03) * s}" fill="none" stroke="${ink}" stroke-width="${0.075 * s}" stroke-linecap="round"/>`;
    const blush = `<ellipse cx="${cx - e - 0.2 * s}" cy="${cy + 0.17 * s}" rx="${0.15 * s}" ry="${0.1 * s}" fill="#ff8fa8" opacity=".55"/>` +
      `<ellipse cx="${cx + e + 0.2 * s}" cy="${cy + 0.17 * s}" rx="${0.15 * s}" ry="${0.1 * s}" fill="#ff8fa8" opacity=".55"/>`;
    const my = cy + 0.2 * s;
    const smile = `<path d="M${cx - 0.09 * s} ${my}Q${cx} ${my + 0.13 * s} ${cx + 0.09 * s} ${my}" fill="none" stroke="${ink}" stroke-width="${0.06 * s}" stroke-linecap="round"/>`;
    switch (kind) {
      case 'joy':
        return blush + arc(cx - e, true) + arc(cx + e, true) +
          `<path d="M${cx - 0.12 * s} ${my - 0.02 * s}Q${cx} ${my + 0.26 * s} ${cx + 0.12 * s} ${my - 0.02 * s}Z" fill="#e8627f" stroke="${ink}" stroke-width="${0.05 * s}" stroke-linejoin="round"/>`;
      case 'wink':
        return blush + eye(cx - e) + arc(cx + e, true) + smile;
      case 'ooh':
        return blush + eye(cx - e) + eye(cx + e) + `<ellipse cx="${cx}" cy="${my + 0.05 * s}" rx="${0.07 * s}" ry="${0.09 * s}" fill="${ink}"/>`;
      case 'tongue':
        return blush + eye(cx - e) + eye(cx + e) + smile +
          `<path d="M${cx - 0.05 * s} ${my + 0.06 * s}q${0.05 * s} ${0.2 * s} ${0.1 * s} 0z" fill="#ef7f97"/>`;
      case 'sleep':
        return arc(cx - e, false) + arc(cx + e, false) +
          `<ellipse cx="${cx}" cy="${my + 0.03 * s}" rx="${0.05 * s}" ry="${0.04 * s}" fill="${ink}"/>`;
      default:
        return blush + eye(cx - e) + eye(cx + e) + smile;
    }
  }

  const svg = (w, body, cls = '') => `<svg class="${cls}" viewBox="0 0 ${w} ${w}" aria-hidden="true">${body}</svg>`;

  function sparkle(x, y, s, fill = '#f6c544', rot = 0) {
    return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0-10C2-3 3-2 10 0 3 2 2 3 0 10-2 3-3 2-10 0-3-2-2-3 0-10Z" fill="${fill}"/>`;
  }

  function chipFront(c, seed) {
    const dots = [[22, 34], [78, 30], [80, 68], [24, 70]].map(([x, y], i) =>
      `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2.5" fill="${c.edge}" opacity=".75" transform="rotate(${i * 40} ${x} ${y})"/>`).join('');
    return svg(100, wash(50, 50, 47, c, seed) + dots + face(c.face, 50, 50, 34));
  }

  const WOOD = { edge: '#e6bd8c', fill: '#f8e4c4', light: '#fdf1dc' };

  function chipBack(seed) {
    return svg(100, wash(50, 50, 47, WOOD, seed) +
      `<path d="${blob(50, 50, 22, seed + 3, 'flower', 0.05)}" fill="#efcfa2"/>` +
      `<path d="${blob(50, 50, 7.5, seed + 4)}" fill="#fdf1dc"/>`);
  }

  function board(slots) {
    const dimples = slots.map((s, i) =>
      `<path d="${blob(s.x * 10, s.y * 10, 72, 300 + i)}" fill="#fdd9e4"/>`).join('');
    return svg(1000,
      `<path d="${blob(500, 500, 498, 11, 'scallop', 0.008, 144)}" fill="#f79ab8"/>` +
      `<path d="${blob(503, 497, 470, 12, 'scallop', 0.01, 144)}" fill="#fff0f5"/>` +
      `<path d="${blob(498, 503, 318, 13, 'circle', 0.02)}" fill="#ffe6ee"/>` +
      dimples +
      `<path d="${blob(500, 500, 132, 14)}" fill="#f6c95f"/>` +
      `<path d="${blob(503, 497, 117, 15)}" fill="#fff0c2"/>`);
  }

  function buddy(p, seed = 1) {
    return svg(100, wash(50, 50, 48, p, seed, p.shape) +
      `<path d="${blob(50, 50, 27, seed + 5, "circle", 0.06)}" fill="#fff7dc"/>` +
      face(p.face, 50, 50, 27));
  }

  function hero() {
    const pal = { edge: '#f58fb0', fill: '#ffc4d6', light: '#ffe0ea' };
    const dots = [[100, 34], [86, 37], [160, 72], [152, 58], [152, 136], [140, 147], [58, 147], [46, 134], [40, 72], [48, 58]]
      .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="4" fill="#f58fb0" transform="rotate(${i * 36} ${x} ${y})"/>`).join('');
    const leaf = (x, y, rot) => `<ellipse cx="${x}" cy="${y}" rx="17" ry="9.5" fill="#bcdcc0" transform="rotate(${rot} ${x} ${y})"/>`;
    return svg(200,
      `<path d="M101 150C97 168 104 178 100 196" fill="none" stroke="#93bd9c" stroke-width="10" stroke-linecap="round"/>` +
      leaf(79, 180, 18) + leaf(122, 180, -18) +
      wash(100, 90, 84, pal, 21, 'flower') + dots +
      `<path d="${blob(100, 92, 37, 31, 'circle', 0.07)}" fill="#f8cd63"/>` +
      `<path d="${blob(101, 92, 31, 32, 'circle', 0.05)}" fill="#fff4d6"/>` +
      face('smile', 100, 90, 34) +
      sparkle(24, 166, 0.9, '#f6c544', 15) + sparkle(172, 170, 0.75, '#f6c544', -10) + sparkle(44, 186, 0.55, '#f6c544', 30));
  }

  const api = { blob, wash, face, svg, sparkle, chipFront, chipBack, board, buddy, hero, WOOD, INK };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Art = api;
})(this);
