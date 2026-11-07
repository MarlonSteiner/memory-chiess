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

  // Built from separate petals so each one can unfold on its own when the flower blooms.
  function bloom(pal) {
    const petals = [0, 1, 2, 3, 4].map((k) => `<g transform="rotate(${k * 72} 50 50)"><g class="petal" style="--p:${k * 40}ms">` +
      `<ellipse cx="50" cy="27" rx="19" ry="25" fill="${pal.edge}"/>` +
      `<ellipse cx="50" cy="28" rx="15.5" ry="21" fill="${pal.fill}"/>` +
      `<ellipse cx="50" cy="24" rx="8" ry="11" fill="${pal.light}" opacity=".7"/></g></g>`).join('');
    return svg(100, petals + `<g class="petal" style="--p:190ms"><circle cx="50" cy="50" r="13" fill="#f6c95f"/><circle cx="50" cy="50" r="8.5" fill="#fff4d6"/></g>`);
  }

  // Four heart leaves unfold from the middle. All the outlines go down first and all the fills
  // on top, so the lines inside disappear and the clover reads as one shape.
  function clover() {
    const ink = '#2c2a26', leaf = '#8ad68e', shine = '#c9f0c4', cheek = '#62c26e';
    const shape = 'M50 56C36 48 19 35 26 20 31 9 45 10 50 22 55 10 69 9 74 20 81 35 64 48 50 56Z';
    const layer = (body) => [0, 1, 2, 3].map((k) =>
      `<g transform="rotate(${45 + k * 90} 50 50)"><g class="petal" style="--p:${k * 50}ms">${body}</g></g>`).join('');
    const stem = 'M52 60C53 74 55 84 60 96';
    return svg(100,
      `<g class="petal" style="--p:0ms"><path d="${stem}" fill="none" stroke="${ink}" stroke-width="9.4" stroke-linecap="round"/>` +
      `<path d="${stem}" fill="none" stroke="${leaf}" stroke-width="4.8" stroke-linecap="round"/></g>` +
      layer(`<path d="${shape}" fill="${ink}" stroke="${ink}" stroke-width="5.6" stroke-linejoin="round"/>`) +
      layer(`<path d="${shape}" fill="${leaf}"/><path d="M35 27q3-5 7-2t7-1" fill="none" stroke="${shine}" stroke-width="3.6" stroke-linecap="round"/>`) +
      `<g class="petal" style="--p:200ms"><circle cx="50" cy="50" r="19" fill="${leaf}"/>` +
      `<ellipse cx="37.5" cy="54" rx="4.6" ry="3.4" fill="${cheek}"/><ellipse cx="62.5" cy="54" rx="4.6" ry="3.4" fill="${cheek}"/>` +
      `<circle cx="42.5" cy="48.5" r="2.5" fill="${ink}"/><circle cx="57.5" cy="48.5" r="2.5" fill="${ink}"/>` +
      `<path d="M47 53q3 3 6 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/></g>`);
  }

  // The small soft clovers that float around the big ones.
  function cloverling(seed) {
    return svg(100, `<g class="petal" style="--p:60ms">${wash(50, 50, 44, { edge: '#6cc876', fill: '#93dc96', light: '#c0efbb' }, seed, 'clover')}</g>`);
  }

  // The dice's black side: a little swirl with big shiny eyes, dropped so it lands with a squash.
  function poop() {
    const eye = (x) => `<circle cx="${x}" cy="70" r="7.3" fill="#231f20"/><circle cx="${x + 2.6}" cy="67.6" r="2.7" fill="#fff"/><circle cx="${x - 3.8}" cy="73.6" r="1.3" fill="#fff"/>`;
    return svg(100, `<g class="plop">` +
      `<path d="M69.5 3.5C80 10 82 24 73.5 31.5C84 33.5 91 40 90 48C89.5 53 86 57.5 80.5 58C90 60 97.5 66 97.5 75C97.5 88 84 96 50 96.5C16 96.5 3 87 3 74C3 65 11 58 21 58.5C17 55 16.5 49 17 46C18 38 25 33 33 33C30 27 33 23 44 19.5C56 15 64 11 69.5 3.5Z" fill="#85593f" stroke="#724d35" stroke-width="3" stroke-linejoin="round"/>` +
      eye(35) + eye(67) +
      `<circle cx="33" cy="83.5" r="3" fill="#f5c4d8"/><circle cx="69.5" cy="84" r="3" fill="#f5c4d8"/>` +
      `<path d="M43.5 81.5Q50 87 57 80.5" fill="none" stroke="#231f20" stroke-width="1.6" stroke-linecap="round"/></g>`);
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

  const api = { blob, wash, face, svg, sparkle, chipFront, chipBack, board, buddy, bloom, clover, cloverling, poop, hero, WOOD, INK };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Art = api;
})(this);
