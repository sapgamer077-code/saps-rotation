/* ROT — Rotation's dithered stylist.
   ROT is drawn from layers: a mannequin body, one drawing per wardrobe piece, and a few style extras (hats, hair, headphones).
   Each person's ROT wears the style their closet says they are, then swaps in pieces trending in their pins.
   Everything is drawn as grey tones on a 160×280 grid, then 1-bit ordered-dithered into the style's two-tone palette.
   Needs catalog.js (STYLES, PIECES) loaded first. Public API on window.ROT. */
(function () {
  "use strict";
  const W = 160, H = 280;

  /* ---------- palettes: [ink, paper, accent] per quiz style ---------- */
  const PALETTES = {
    grisch: [[27, 35, 64], [232, 226, 212], [184, 146, 58]],
    streetwear: [[14, 17, 22], [201, 204, 209], [255, 90, 31]],
    cozy: [[44, 58, 40], [228, 221, 204], [214, 120, 80]],
    workwear: [[46, 32, 20], [214, 200, 170], [196, 124, 36]],
    minimal: [[22, 22, 22], [236, 236, 232], [222, 44, 44]],
    gorpcore: [[18, 52, 46], [196, 214, 204], [255, 122, 0]],
    western: [[58, 31, 18], [227, 201, 160], [180, 71, 31]],
    athleisure: [[16, 30, 90], [214, 222, 236], [0, 196, 120]],
    y2k: [[70, 20, 80], [230, 214, 236], [0, 186, 255]],
    feminine: [[90, 26, 48], [240, 220, 224], [232, 64, 112]],
    tailored: [[48, 36, 28], [222, 214, 202], [176, 142, 88]],
  };

  /* ---------- colour words → grey tone (0 black … 255 white) ---------- */
  const TONES = [[/black|onyx|jet/, 28], [/charcoal|faded black|graphite/, 55], [/navy|indigo|raw|rinse|dark wash|midnight/, 60],
    [/burgundy|oxblood|maroon|chocolate|espresso|dark brown/, 55], [/wheat|tan\b|camel|khaki|sand|beige|stone/, 175], [/brown|walnut|cognac/, 80], [/forest|olive|green|sage/, 95],
    [/red|rust|orange/, 105], [/purple|plum|lilac/, 120], [/blue|denim|mid.?wash/, 130], [/grey|gray|heather|silver/, 150],
    [/tan|camel|wheat|khaki|sand|beige|stone/, 175], [/light.?wash|bleach|pale|sky|powder/, 190], [/pink|blush/, 200],
    [/cream|ecru|off.?white|oat|bone|ivory/, 215], [/white/, 236]];
  function toneOf(text, fallback) { const t = String(text || "").toLowerCase(); for (const [re, v] of TONES) if (re.test(t)) return v; return fallback }

  /* ---------- drawing context ---------- */
  // body: {sx, sy} widens/narrows and shortens/lengthens ROT around its feet
  function ctx(body) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"); c.lineJoin = "round"; c.lineCap = "round";
    const sx = body?.sx || 1, sy = body?.sy || 1, ox = 80 * (1 - sx), oy = 268 * (1 - sy);
    c.setTransform(sx, 0, 0, sy, ox, oy);
    const glints = [];
    const g = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
    const api = {
      cv, c, glints, flags: {},
      poly(pts, v) { c.fillStyle = g(v); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill() },
      ell(x0, y0, x1, y1, v) { c.fillStyle = g(v); c.beginPath(); c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2); c.fill() },
      rect(x0, y0, x1, y1, v) { c.fillStyle = g(v); c.fillRect(x0, y0, x1 - x0, y1 - y0) },
      line(pts, v, w = 1) { c.strokeStyle = g(v); c.lineWidth = w; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke() },
      glint(x, y) { glints.push([Math.round(x * sx + ox), Math.round(y * sy + oy)]) },
    };
    return api;
  }
  const clampT = (v) => Math.max(8, Math.min(245, v));
  const d = (v, k) => clampT(v - k), l = (v, k) => clampT(v + k);

  /* ---------- body ---------- */
  function mannequin(G) {
    G.poly([[74, 52], [86, 52], [87, 64], [73, 64]], 120);
    G.ell(67, 22, 93, 54, 150);
    G.ell(69, 32, 91, 54, 70);                                   // shadowed face
    G.poly([[56, 66], [104, 66], [100, 142], [60, 142]], 165);
    G.poly([[56, 66], [48, 70], [44, 144], [50, 146], [56, 90]], 150);
    G.poly([[104, 66], [112, 70], [116, 144], [110, 146], [104, 90]], 150);
    G.ell(42, 146, 52, 158, 160); G.ell(108, 146, 118, 158, 160);
    G.poly([[60, 140], [79, 140], [76, 258], [66, 258]], 155);
    G.poly([[81, 140], [100, 140], [94, 258], [84, 258]], 150);
    G.ell(60, 254, 78, 264, 140); G.ell(82, 254, 100, 264, 140);
  }
  // Sleeves reused by most tops: long (to the wrist) or short (to mid upper arm)
  function sleeves(G, v, { long = true, wide = 0, len = 146 } = {}) {
    if (long) {
      G.poly([[55, 64], [46 - wide, 70], [42 - wide, len], [51, len + 2], [55, 92]], d(v, 10));
      G.poly([[105, 64], [114 + wide, 70], [118 + wide, len], [109, len + 2], [105, 92]], d(v, 10));
    } else {
      G.poly([[55, 64], [42 - wide, 72], [44 - wide, 96], [54, 94]], d(v, 8));
      G.poly([[105, 64], [118 + wide, 72], [116 + wide, 96], [106, 94]], d(v, 8));
    }
  }

  /* ---------- wardrobe layers ---------- */
  const LAYER = {
    /* bottoms */
    straightjeans(G, v = 190) { G.poly([[58, 140], [79, 140], [76, 252], [63, 252]], v); G.poly([[81, 140], [102, 140], [97, 252], [84, 252]], d(v, 12)); G.line([[64, 150], [66, 240]], d(v, 30)); G.line([[96, 150], [94, 240]], d(v, 35)) },
    rawdenim(G, v = 58) { LAYER.straightjeans(G, v); G.line([[70, 146], [70, 250]], l(v, 70)); G.line([[90, 146], [90, 250]], l(v, 70)); G.rect(62, 244, 77, 252, l(v, 40)); G.rect(83, 244, 98, 252, l(v, 40)) },
    chinos(G, v = 205) { G.poly([[58, 140], [79, 140], [76, 252], [63, 252]], v); G.poly([[81, 140], [102, 140], [97, 252], [84, 252]], d(v, 12)); G.line([[69, 146], [69, 250]], d(v, 45)); G.line([[91, 146], [91, 250]], d(v, 50)) },
    baggyjeans(G, v = 165) {
      G.poly([[54, 140], [79, 140], [78, 256], [50, 258]], v); G.poly([[81, 140], [106, 140], [110, 258], [82, 256]], d(v, 12));
      for (const y of [220, 232, 243, 251]) { G.line([[51, y], [78, y + 2]], d(v, 60)); G.line([[82, y + 2], [109, y]], d(v, 70)) }
      G.line([[67, 150], [65, 210]], d(v, 40)); G.line([[94, 150], [96, 210]], d(v, 40));
    },
    jorts(G, v = 175) { G.poly([[54, 140], [79, 140], [78, 204], [52, 206]], v); G.poly([[81, 140], [106, 140], [108, 206], [82, 204]], d(v, 12)); G.line([[53, 200], [78, 199]], d(v, 60), 2); G.line([[82, 199], [107, 200]], d(v, 60), 2) },
    bootcut(G, v = 110) { G.poly([[58, 140], [79, 140], [75, 214], [78, 256], [58, 256], [64, 214]], v); G.poly([[81, 140], [102, 140], [96, 214], [102, 256], [82, 256], [85, 214]], d(v, 12)); G.line([[66, 150], [68, 210]], l(v, 40)); G.line([[94, 150], [92, 210]], l(v, 35)) },
    workpants(G, v = 150) { G.poly([[55, 140], [79, 140], [78, 256], [54, 256]], v); G.poly([[81, 140], [105, 140], [106, 256], [82, 256]], d(v, 12)); G.rect(57, 186, 77, 212, d(v, 28)); G.rect(83, 186, 103, 212, d(v, 34)); G.line([[98, 150], [100, 180]], d(v, 50)) },
    cargos(G, v = 115) {
      G.poly([[54, 140], [79, 140], [76, 244], [60, 252]], v); G.poly([[81, 140], [106, 140], [100, 252], [84, 244]], d(v, 12));
      G.rect(50, 172, 60, 196, d(v, 25)); G.rect(100, 172, 110, 196, d(v, 30)); G.rect(60, 246, 77, 254, d(v, 30)); G.rect(83, 246, 100, 254, d(v, 34));
    },
    sweats(G, v = 150) { G.poly([[56, 140], [79, 140], [76, 246], [62, 246]], v); G.poly([[81, 140], [104, 140], [98, 246], [84, 246]], d(v, 12)); G.rect(62, 244, 77, 254, d(v, 30)); G.rect(83, 244, 98, 254, d(v, 34)); G.line([[70, 170], [69, 230]], d(v, 30)) },
    leggings(G, v = 30) { G.poly([[60, 140], [79, 140], [76, 250], [66, 250]], v); G.poly([[81, 140], [100, 140], [94, 250], [84, 250]], l(v, 8)) },
    miniskirt(G, v = 120) { G.poly([[58, 138], [102, 138], [110, 184], [50, 184]], v); G.line([[80, 140], [80, 184]], d(v, 40)); G.line([[50, 182], [110, 182]], d(v, 45), 2) },
    midiskirt(G, v = 170) { G.poly([[58, 138], [102, 138], [112, 228], [48, 228]], v); for (const x of [64, 76, 88, 98]) G.line([[x, 150], [x + (x - 80) * 0.25, 226]], d(v, 30)) },
    /* one-piece */
    dress(G, v = 200) {
      G.poly([[60, 64], [100, 64], [98, 118], [110, 224], [50, 224], [62, 118]], v);
      G.line([[64, 64], [66, 56]], d(v, 60)); G.line([[96, 64], [94, 56]], d(v, 60));
      for (const x of [66, 80, 94]) G.line([[x, 130], [x + (x - 80) * 0.3, 222]], d(v, 28));
      G.line([[62, 118], [98, 118]], d(v, 40));
    },
    /* tops */
    tee(G, v = 235) { G.poly([[52, 64], [108, 64], [110, 146], [50, 146]], v); sleeves(G, v, { long: false, wide: 2 }); G.ell(72, 60, 88, 68, d(v, 60)) },
    graphictee(G, v = 230) { LAYER.tee(G, v); G.rect(64, 84, 96, 114, d(v, 150)); for (let y = 88; y < 112; y += 4) G.line([[66, y], [94, y + 2]], d(v, 40)); G.glint(78, 98) },
    babytee(G, v = 230) { G.poly([[58, 64], [102, 64], [101, 118], [59, 118]], v); G.poly([[58, 64], [48, 70], [50, 86], [58, 84]], d(v, 8)); G.poly([[102, 64], [112, 70], [110, 86], [102, 84]], d(v, 8)) },
    henley(G, v = 55) { G.poly([[56, 64], [104, 64], [102, 144], [58, 144]], v); sleeves(G, v); G.line([[80, 64], [80, 92]], l(v, 60)); for (const y of [72, 80, 88]) G.rect(79, y, 81, y + 2, l(v, 150)) },
    oxford(G, v = 225) {
      G.poly([[56, 64], [104, 64], [102, 144], [58, 144]], v); sleeves(G, v);
      G.poly([[70, 58], [80, 72], [74, 76], [66, 64]], d(v, 30)); G.poly([[90, 58], [80, 72], [86, 76], [94, 64]], d(v, 30));
      G.line([[80, 72], [80, 144]], d(v, 50)); G.rect(42, 138, 51, 146, d(v, 20)); G.rect(109, 138, 118, 146, d(v, 20));
    },
    polo(G, v = 80) { G.poly([[56, 64], [104, 64], [102, 144], [58, 144]], v); sleeves(G, v, { long: false }); G.poly([[70, 58], [80, 70], [90, 58], [92, 64], [80, 74], [68, 64]], d(v, 25)); G.line([[80, 70], [80, 88]], l(v, 50)) },
    flannel(G, v = 110) {
      G.poly([[54, 64], [106, 64], [106, 148], [54, 148]], v); sleeves(G, v, { wide: 1 });
      for (let x = 56; x < 106; x += 7) G.line([[x, 66], [x, 146]], d(v, 45)); for (let y = 70; y < 146; y += 7) G.line([[55, y], [105, y]], d(v, 35));
      G.poly([[70, 58], [80, 70], [90, 58], [92, 66], [80, 74], [68, 66]], d(v, 30));
    },
    pearlsnap(G, v = 190) { G.poly([[56, 64], [104, 64], [102, 142], [58, 142]], v); sleeves(G, v); G.line([[56, 76], [70, 84], [80, 78], [90, 84], [104, 76]], d(v, 70)); G.line([[80, 64], [80, 142]], d(v, 60)); for (const y of [92, 106, 120]) G.glint(79, y) },
    blouse(G, v = 232) {
      G.poly([[58, 64], [102, 64], [100, 136], [60, 136]], v);
      G.poly([[58, 64], [42, 76], [38, 138], [52, 146], [56, 96]], d(v, 8)); G.poly([[102, 64], [118, 76], [122, 138], [108, 146], [104, 96]], d(v, 8));
      G.poly([[72, 62], [80, 80], [88, 62]], 90); G.line([[62, 136], [98, 136]], d(v, 30));
    },
    /* mid layers */
    hoodie(G, v = 40) {
      G.flags.hood = G.flags.hood ?? v;
      G.poly([[52, 64], [108, 64], [114, 150], [46, 150]], v); G.poly([[52, 64], [40, 70], [34, 152], [46, 154], [50, 96]], d(v, 8)); G.poly([[108, 64], [120, 70], [126, 152], [114, 154], [110, 96]], d(v, 8));
      G.rect(46, 144, 114, 152, d(v, 20)); G.line([[62, 118], [98, 118]], l(v, 25)); G.line([[62, 118], [58, 140]], l(v, 25)); G.line([[98, 118], [102, 140]], l(v, 25));
      G.line([[76, 66], [75, 86]], 200); G.line([[84, 66], [85, 86]], 200); G.rect(32, 148, 46, 156, d(v, 20)); G.rect(114, 148, 128, 156, d(v, 20));
    },
    knit(G, v = 200) {
      G.poly([[53, 64], [107, 64], [108, 146], [52, 146]], v); sleeves(G, v, { wide: 2 }); G.ell(71, 58, 89, 68, d(v, 40));
      for (const x of [62, 70, 90, 98]) for (let y = 72; y < 138; y += 6) G.line([[x - 2, y], [x + 2, y + 3]], d(v, 45));
      G.rect(52, 140, 108, 148, d(v, 25)); G.rect(40, 140, 50, 148, d(v, 25)); G.rect(110, 140, 120, 148, d(v, 25));
    },
    quarterzip(G, v = 70) {
      G.poly([[55, 64], [105, 64], [104, 144], [56, 144]], v); sleeves(G, v); G.poly([[70, 54], [90, 54], [92, 66], [68, 66]], d(v, 20));
      G.line([[80, 54], [80, 86]], 225); G.glint(79, 86); G.rect(56, 138, 104, 146, d(v, 25)); for (let x = 58; x < 104; x += 3) G.line([[x, 138], [x, 146]], d(v, 45));
    },
    cardigan(G, v = 214) {
      G.poly([[55, 64], [76, 64], [74, 146], [54, 146]], v); G.poly([[84, 64], [105, 64], [106, 146], [86, 146]], d(v, 6)); sleeves(G, v, { wide: 1 });
      for (const y of [84, 100, 116, 132]) G.ell(76, y, 80, y + 4, d(v, 110)); G.line([[76, 64], [74, 146]], d(v, 40)); G.line([[84, 64], [86, 146]], d(v, 40));
    },
    turtleneck(G, v = 30) { G.poly([[56, 64], [104, 64], [102, 144], [58, 144]], v); sleeves(G, v); G.rect(72, 46, 88, 64, v); for (const y of [50, 55, 60]) G.line([[73, y], [87, y]], l(v, 30)) },
    fleece(G, v = 195) {
      G.poly([[52, 64], [108, 64], [110, 148], [50, 148]], v); sleeves(G, v, { wide: 3, len: 148 }); G.poly([[70, 52], [90, 52], [92, 66], [68, 66]], d(v, 25));
      G.line([[80, 54], [80, 148]], d(v, 90), 2); G.rect(62, 82, 76, 96, d(v, 70)); G.flags.pile = true;
    },
    /* outer layers */
    vest(G, v = 50) { G.poly([[58, 62], [102, 62], [106, 146], [54, 146]], v); for (let y = 76; y < 146; y += 11) G.line([[56, y], [104, y]], l(v, 30)); G.poly([[70, 54], [90, 54], [92, 64], [68, 64]], d(v, 15)); G.line([[80, 56], [80, 146]], l(v, 70)) },
    puffer(G, v = 38) {
      G.poly([[48, 62], [112, 62], [116, 154], [44, 154]], v); G.poly([[48, 62], [34, 70], [30, 154], [46, 156], [48, 96]], d(v, 6)); G.poly([[112, 62], [126, 70], [130, 154], [114, 156], [112, 96]], d(v, 6));
      for (let y = 76; y < 154; y += 13) { G.line([[46, y], [114, y]], l(v, 40), 2); G.line([[32, y], [46, y]], l(v, 40), 2); G.line([[114, y], [128, y]], l(v, 40), 2) }
      G.poly([[66, 48], [94, 48], [98, 64], [62, 64]], d(v, 10)); G.line([[80, 50], [80, 154]], l(v, 60));
    },
    shell(G, v = 88) {
      if (!G.flags.hat) G.flags.hood = G.flags.hood ?? v;
      G.poly([[52, 62], [108, 62], [112, 164], [48, 164]], v); sleeves(G, v, { wide: 3, len: 150 }); G.line([[80, 60], [80, 164]], l(v, 80), 2);
      G.line([[56, 110], [74, 104]], l(v, 50)); G.line([[104, 110], [86, 104]], l(v, 50)); G.rect(40, 146, 50, 152, d(v, 30)); G.rect(110, 146, 120, 152, d(v, 30)); G.glint(79, 62);
    },
    leather(G, v = 35) {
      G.poly([[52, 62], [108, 62], [110, 140], [50, 140]], v); sleeves(G, v, { wide: 1 });
      G.poly([[62, 62], [80, 84], [72, 94], [58, 70]], l(v, 25)); G.poly([[98, 62], [86, 78], [96, 90], [104, 70]], l(v, 20));
      G.line([[80, 84], [92, 140]], l(v, 90)); G.rect(50, 132, 110, 140, d(v, 10)); G.glint(90, 128);
    },
    suede(G, v = 138) {
      G.poly([[50, 64], [70, 64], [72, 140], [48, 142]], v); G.poly([[90, 64], [110, 64], [112, 142], [88, 140]], v); sleeves(G, v, { wide: 4 });
      for (let x = 36; x < 48; x += 2) G.line([[x, 100], [x - 2, 112]], d(v, 45)); for (let x = 114; x < 126; x += 2) G.line([[x, 100], [x + 2, 112]], d(v, 45));
      for (let x = 50; x < 72; x += 3) G.line([[x, 140], [x, 150]], d(v, 40)); for (let x = 90; x < 112; x += 3) G.line([[x, 140], [x, 150]], d(v, 40));
    },
    workjacket(G, v = 150) {
      G.poly([[50, 64], [110, 64], [114, 142], [46, 142]], v); sleeves(G, v, { wide: 4 });
      G.poly([[66, 62], [80, 80], [94, 62], [90, 58], [80, 70], [70, 58]], d(v, 50)); G.line([[80, 80], [80, 142]], d(v, 60), 2);
      G.rect(56, 96, 70, 108, d(v, 20)); G.rect(90, 96, 104, 108, d(v, 20));
    },
    trackjacket(G, v = 45) {
      G.poly([[54, 64], [106, 64], [106, 146], [54, 146]], v); sleeves(G, v, { wide: 1 }); G.poly([[70, 54], [90, 54], [92, 66], [68, 66]], d(v, 10));
      G.line([[80, 56], [80, 146]], 220); G.line([[48, 72], [44, 144]], 230, 2); G.line([[112, 72], [116, 144]], 230, 2); G.rect(54, 140, 106, 148, d(v, 15));
    },
    blazer(G, v = 55) {
      G.poly([[50, 62], [110, 62], [110, 152], [50, 152]], v); sleeves(G, v, { wide: 2, len: 146 });
      G.poly([[64, 62], [80, 106], [74, 106], [58, 70]], d(v, 20)); G.poly([[96, 62], [80, 106], [86, 106], [102, 70]], d(v, 20));
      G.line([[80, 106], [80, 152]], d(v, 30)); G.glint(81, 118); G.rect(90, 80, 100, 84, l(v, 90));
    },
    trench(G, v = 175) {
      G.poly([[50, 62], [110, 62], [118, 226], [42, 226]], v); sleeves(G, v, { wide: 3, len: 148 });
      G.poly([[62, 62], [80, 96], [72, 98], [56, 70]], d(v, 25)); G.poly([[98, 62], [80, 96], [88, 98], [104, 70]], d(v, 25));
      G.rect(48, 128, 112, 135, d(v, 40)); G.glint(79, 130); for (const y of [104, 116, 146, 160]) { G.ell(68, y, 71, y + 3, d(v, 100)); G.ell(89, y, 92, y + 3, d(v, 100)) }
      G.line([[80, 136], [80, 226]], d(v, 30));
    },
    /* shoes */
    whitesneakers(G, v = 236) { G.ell(54, 250, 80, 264, v); G.ell(80, 250, 106, 264, d(v, 6)); G.line([[56, 262], [78, 262]], 90); G.line([[82, 262], [104, 262]], 90) },
    terrace(G, v = 228) { G.ell(50, 250, 80, 266, v); G.ell(80, 250, 110, 266, d(v, 6)); for (const x of [60, 64, 68]) G.line([[x, 254], [x + 3, 262]], 40); for (const x of [90, 94, 98]) G.line([[x, 254], [x + 3, 262]], 40); G.line([[52, 264], [78, 264]], 70, 2); G.line([[82, 264], [108, 264]], 70, 2) },
    skateshoes(G, v = 40) { G.ell(46, 246, 80, 268, v); G.ell(80, 246, 114, 268, l(v, 6)); G.rect(48, 262, 79, 268, 236); G.rect(81, 262, 112, 268, 236); G.line([[56, 254], [72, 258]], 220, 2); G.line([[88, 258], [104, 254]], 220, 2) },
    runners(G, v = 222) { G.ell(50, 248, 80, 266, v); G.ell(80, 248, 110, 266, d(v, 6)); G.rect(52, 260, 79, 268, 60); G.rect(81, 260, 108, 268, 60); G.line([[56, 256], [66, 252], [74, 256]], 60, 2); G.line([[86, 256], [96, 252], [104, 256]], 60, 2) },
    trailshoes(G, v = 120) { G.ell(48, 246, 80, 266, v); G.ell(80, 246, 112, 266, d(v, 8)); G.rect(50, 262, 79, 268, 25); G.rect(81, 262, 110, 268, 25); for (const x of [52, 60, 68, 76, 84, 92, 100, 108]) G.rect(x, 267, x + 3, 270, 25); G.line([[58, 252], [74, 256]], 230) },
    workboots(G, v = 150) { G.ell(48, 244, 80, 268, v); G.ell(80, 244, 112, 268, d(v, 5)); G.rect(62, 234, 78, 250, v); G.rect(82, 234, 98, 250, d(v, 5)); G.line([[50, 264], [78, 264]], 45, 2); G.line([[82, 264], [110, 264]], 45, 2); G.line([[64, 240], [76, 240]], 60) },
    westernboots(G, v = 45) {
      G.poly([[60, 232], [76, 232], [78, 256], [88, 262], [86, 266], [58, 266]], v); G.poly([[84, 232], [100, 232], [102, 266], [74, 266], [72, 262], [82, 256]], d(v, 3));
      G.line([[64, 240], [72, 246]], l(v, 60)); G.line([[96, 240], [88, 246]], l(v, 60));
    },
    kneeboots(G, v = 30) { G.poly([[61, 188], [78, 188], [77, 256], [84, 262], [60, 266]], v); G.poly([[82, 188], [99, 188], [100, 266], [76, 262], [83, 256]], l(v, 5)) },
    loafers(G, v = 40) { G.ell(58, 250, 78, 262, v); G.ell(82, 250, 102, 262, v); G.line([[62, 252], [74, 252]], l(v, 80)); G.line([[86, 252], [98, 252]], l(v, 80)) },
    dressshoes(G, v = 30) { G.ell(56, 250, 80, 263, v); G.ell(80, 250, 104, 263, v); G.line([[60, 253], [66, 253]], 210); G.line([[88, 253], [94, 253]], 210); G.rect(56, 261, 80, 264, 12); G.rect(80, 261, 104, 264, 12) },
    balletflats(G, v = 30) { G.ell(60, 254, 78, 262, v); G.ell(82, 254, 100, 262, v); G.line([[64, 255], [74, 255]], l(v, 100)); G.line([[86, 255], [96, 255]], l(v, 100)) },
    heels(G, v = 30) { G.poly([[62, 250], [78, 256], [80, 262], [64, 262]], v); G.poly([[98, 250], [82, 256], [80, 262], [96, 262]], v); G.line([[63, 262], [62, 270]], v, 2); G.line([[97, 262], [98, 270]], v, 2) },
    slippers(G, v = 130) { G.ell(52, 248, 80, 266, v); G.ell(80, 248, 108, 266, d(v, 6)); G.line([[56, 256], [76, 256]], d(v, 50)); G.line([[84, 256], [104, 256]], d(v, 50)); G.rect(54, 262, 78, 266, d(v, 60)); G.rect(82, 262, 106, 266, d(v, 60)) },
    /* accessories */
    belt(G) { G.rect(56, 136, 104, 142, 30); G.rect(74, 134, 86, 144, 215); G.glint(79, 138) },
    watch(G) { G.rect(41, 138, 51, 142, 25); G.glint(45, 139) },
    socks(G) { G.rect(62, 242, 77, 252, 238); G.rect(83, 242, 98, 252, 232) },
    tote(G, v = 60) { G.line([[112, 150], [118, 128], [124, 150]], d(v, 20), 2); G.rect(106, 148, 134, 186, v); G.line([[108, 160], [132, 160]], l(v, 30)) },
    crossbody(G, v = 35) { G.line([[58, 66], [100, 128]], v, 3); G.rect(92, 120, 112, 136, v); G.glint(101, 127) },
    jewelry(G) { G.line([[70, 64], [74, 78], [80, 82], [86, 78], [90, 64]], 225, 1.5); G.glint(79, 81) },
    sunglasses(G) { G.flags.shades = true },
    cap(G, v = 38) { G.flags.hat = "cap"; G.flags.capTone = v },
    beanie(G, v = 45) { G.flags.hat = "beanie"; G.flags.hatTone = v },
    /* style extras (not in the wardrobe list) */
    cowboyhat(G, v = 55) { G.flags.hat = "cowboy"; G.flags.hatTone = v },
    headphones(G) { G.flags.headphones = true },
    scarf(G, v = 110) { G.poly([[64, 56], [96, 56], [100, 70], [60, 70]], v); G.poly([[84, 66], [96, 66], [94, 104], [84, 104]], d(v, 10)); for (let x = 85; x < 95; x += 2) G.line([[x, 104], [x, 110]], d(v, 20)) },
    longhair(G, v = 40) { G.flags.hair = "long"; G.flags.hairTone = v },
    slick(G, v = 35) { G.flags.hair = "slick"; G.flags.hairTone = v },
  };

  /* Head stage: hair, hood, hats and eyes, drawn last */
  function headStage(G) {
    const f = G.flags; let eyes = [[74, 41], [84, 41]];
    if (f.hair === "long") { G.ell(64, 18, 96, 40, f.hairTone); G.poly([[64, 30], [70, 30], [69, 96], [58, 98]], f.hairTone); G.poly([[90, 30], [96, 30], [102, 98], [91, 96]], f.hairTone) }
    if (f.hair === "slick") { G.ell(66, 19, 94, 31, f.hairTone); G.rect(66, 26, 69, 38, f.hairTone); G.rect(91, 26, 94, 38, f.hairTone) }
    if (f.hood != null && !f.hat) {
      const v = f.hood; G.poly([[80, 12], [98, 18], [104, 40], [102, 66], [58, 66], [56, 40], [62, 18]], d(v, 10)); G.ell(68, 26, 92, 58, 16);
    }
    if (f.hat === "cap") { G.ell(66, 18, 94, 36, f.capTone); G.poly([[66, 32], [100, 30], [104, 36], [66, 38]], d(f.capTone, 10)); G.ell(69, 36, 91, 54, 40) }
    if (f.hat === "beanie") { G.poly([[66, 32], [68, 18], [80, 12], [92, 18], [94, 32]], f.hatTone); G.rect(65, 28, 95, 36, d(f.hatTone, 15)) }
    if (f.hat === "cowboy") { G.ell(68, 30, 92, 52, 45); G.poly([[68, 8], [92, 8], [96, 28], [64, 28]], f.hatTone); G.line([[64, 24], [96, 24]], 150, 2); G.ell(44, 24, 116, 36, d(f.hatTone, 10)) }
    if (f.headphones) { G.line([[66, 62], [72, 70], [88, 70], [94, 62]], 30, 3); G.ell(62, 58, 70, 68, 30); G.ell(90, 58, 98, 68, 30) }
    if (f.shades) { G.rect(68, 37, 92, 44, 12); eyes = [[71, 38], [85, 38]] }
    for (const e of eyes) G.glint(e[0], e[1]);
  }

  /* ---------- shading + dithering ---------- */
  const B8 = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()) }

  function dither(G, palette, { seed = 1, glitch = true, pile = false } = {}) {
    const src = G.c.getImageData(0, 0, W, H).data, out = new Uint8ClampedArray(W * H * 4);
    const mask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mask[i] = src[i * 4 + 3] > 110 ? 1 : 0;
    const R = rng(seed), [ink, paper, acc] = palette;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let a;
      if (mask[i]) {
        a = src[i * 4] / 255;
        a *= Math.min(1.2, Math.max(0.55, 1.05 - 0.35 * (x - 40) / W - 0.12 * (y / H)));
        const edge = !(mask[i - 1] && mask[i + 1] && mask[i - W] && mask[i + W]);
        if (edge) a = 0; else a += gauss(R) * (pile ? 0.07 : 0.03);
        a = Math.max(0, Math.min(1, (a - 0.5) * 1.3 + 0.48));
      } else {
        a = 1 - 0.14 * (y / H) ** 2 - 0.55 * Math.exp(-(((x - 80) / 46) ** 2 + ((y - 266) / 7) ** 2));
      }
      const c = a > B8[y & 7][x & 7] / 64 ? paper : ink;
      out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    }
    for (const [x, y] of G.glints) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = ((y + dy) * W + (x + dx)) * 4; if (i >= 0 && i < out.length) { out[i] = acc[0]; out[i + 1] = acc[1]; out[i + 2] = acc[2] }
    }
    if (glitch) {
      for (let k = 0; k < 3; k++) {
        const y0 = 20 + Math.floor(R() * (H - 50)), h = 2 + Math.floor(R() * 3), s = [-4, -3, 3, 5][Math.floor(R() * 4)];
        for (let y = y0; y < y0 + h; y++) { const row = out.slice(y * W * 4, (y + 1) * W * 4); for (let x = 0; x < W; x++) { const sx = ((x - s) % W + W) % W; for (let c = 0; c < 4; c++) out[(y * W + x) * 4 + c] = row[sx * 4 + c] } }
      }
    }
    return new ImageData(out, W, H);
  }

  /* ---------- outfits ---------- */
  // catalog.js declares PIECES with const, so it is a global binding but not a window property
  const allPieces = () => (typeof PIECES !== "undefined" ? PIECES : window.PIECES || []);
  // Which slot each layer fills, and the order layers are drawn
  const SLOT = {};
  const ORDER = ["bottom", "socks", "shoes", "top", "belt", "mid", "outer", "neck", "wrist", "bag", "hair", "hat", "face"];
  for (const k of ["straightjeans", "rawdenim", "chinos", "baggyjeans", "jorts", "bootcut", "workpants", "cargos", "sweats", "leggings", "miniskirt", "midiskirt"]) SLOT[k] = "bottom";
  for (const k of ["tee", "graphictee", "babytee", "henley", "oxford", "polo", "flannel", "pearlsnap", "blouse", "dress"]) SLOT[k] = "top";
  for (const k of ["hoodie", "knit", "quarterzip", "cardigan", "turtleneck", "fleece"]) SLOT[k] = "mid";
  for (const k of ["vest", "puffer", "shell", "leather", "suede", "workjacket", "trackjacket", "blazer", "trench"]) SLOT[k] = "outer";
  for (const k of ["whitesneakers", "terrace", "skateshoes", "runners", "trailshoes", "workboots", "westernboots", "kneeboots", "loafers", "dressshoes", "balletflats", "heels", "slippers"]) SLOT[k] = "shoes";
  Object.assign(SLOT, { belt: "belt", watch: "wrist", socks: "socks", tote: "bag", crossbody: "bag", jewelry: "neck", scarf: "neck", headphones: "neck", sunglasses: "face", cap: "hat", beanie: "hat", cowboyhat: "hat", longhair: "hair", slick: "hair" });

  // Default look per quiz style: [layer key, tone]
  const KITS = {
    grisch: [["quarterzip", 62], ["chinos", 212], ["loafers", 45], ["watch"], ["slick", 35], ["sunglasses"]],
    streetwear: [["tee", 236], ["hoodie", 36], ["baggyjeans", 170], ["terrace", 232], ["crossbody", 30]],
    cozy: [["tee", 220], ["fleece", 205], ["sweats", 140], ["slippers", 120], ["beanie", 90], ["socks"]],
    workwear: [["henley", 120], ["workjacket", 160], ["rawdenim", 55], ["workboots", 150], ["beanie", 50]],
    minimal: [["turtleneck", 28], ["trench", 180], ["chinos", 60], ["whitesneakers", 238], ["tote", 50]],
    gorpcore: [["fleece", 170], ["shell", 70], ["cargos", 110], ["trailshoes", 130], ["crossbody", 30]],
    western: [["pearlsnap", 196], ["suede", 138], ["bootcut", 105], ["westernboots", 45], ["belt"], ["cowboyhat", 55]],
    athleisure: [["tee", 236], ["trackjacket", 40], ["sweats", 45], ["runners", 225], ["cap", 35], ["headphones"]],
    y2k: [["graphictee", 230], ["baggyjeans", 185], ["skateshoes", 38], ["jewelry"], ["beanie", 35]],
    feminine: [["dress", 205], ["cardigan", 222], ["balletflats", 30], ["jewelry"], ["longhair", 38]],
    tailored: [["oxford", 232], ["blazer", 52], ["chinos", 70], ["dressshoes", 28], ["belt"], ["watch"]],
  };
  // Extra layers a style can pull from beyond the wardrobe list
  const EXTRAS = { western: ["cowboyhat", "suede"], athleisure: ["headphones"], y2k: ["headphones"], feminine: ["longhair"], grisch: ["slick", "sunglasses"], minimal: ["scarf"], cozy: ["scarf"], tailored: ["slick"] };

  function drawOutfit(G, layers) {
    mannequin(G);
    const bySlot = {}; for (const [k, v] of layers) { const s = SLOT[k]; if (s && LAYER[k]) bySlot[s] = [k, v] }
    if (bySlot.top && bySlot.top[0] === "dress") delete bySlot.bottom;
    // hair and hats set flags; drawn in the head stage
    for (const s of ORDER) {
      const e = bySlot[s]; if (!e) continue; const [k, v] = e;
      // a layer drawn over the torso hides the accent pixels (zips, snaps, buckles) of what's under it
      if (s === "mid" || s === "outer") { const bottom = k === "trench" ? 228 : 158; for (let i = G.glints.length - 1; i >= 0; i--) { const [x, y] = G.glints[i]; if (x >= 46 && x <= 114 && y >= 54 && y <= bottom) G.glints.splice(i, 1) } }
      if (v == null) LAYER[k](G); else LAYER[k](G, v);
    }
    headStage(G);
  }

  /* Build ROT's outfit for a person.
     items: closet pieces {cat,name,color,notes,vibes}; pins: {pieceKey: weight}; focus: [pieceKey]; style: quiz style key. */
  function outfitFor({ style, items = [], pins = {}, focus = [], pieces = allPieces() }) {
    const kit = KITS[style] || KITS.streetwear, layers = new Map(), ownedTone = {};
    for (const [k, v] of kit) layers.set(SLOT[k], { k, v, score: 0.5 });
    const inStyle = new Set(pieces.filter(p => p.s.includes(style)).map(p => p.key));
    // 1. what's in the closet (items tagged with this style win)
    for (const it of items) {
      const key = matchPiece(it, pieces); if (!key) continue; const p = { key };
      const slot = SLOT[p.key], score = 1 + ((it.vibes || []).includes(style) ? 2 : 0) + (inStyle.has(p.key) ? 1 : 0);
      const v = toneOf(it.color + " " + it.name, undefined); if (ownedTone[p.key] == null) ownedTone[p.key] = v;
      const cur = layers.get(slot); if (!cur || score > cur.score) layers.set(slot, { k: p.key, v, score, owned: true });
    }
    // 2. what they're becoming: trending pins and their want-more-of list override
    for (const [k, w] of Object.entries(pins)) {
      if (!LAYER[k]) continue; const slot = SLOT[k], score = 2.5 + w * 0.8 + (focus.includes(k) ? 3 : 0);
      const cur = layers.get(slot); if (w >= 2 && (!cur || score > cur.score)) layers.set(slot, { k, v: ownedTone[k], score, pinned: true, owned: ownedTone[k] != null });
    }
    for (const k of [...focus].sort((a, b) => (pins[b] || 0) - (pins[a] || 0))) { if (!LAYER[k]) continue; const slot = SLOT[k], cur = layers.get(slot); if (!cur || !cur.focus) layers.set(slot, { k, v: ownedTone[k], score: 9, pinned: true, focus: true, owned: ownedTone[k] != null }) }
    const top = layers.get("top");
    if (top && top.k !== "dress" && layers.get("bottom")?.k == null) layers.set("bottom", { k: "straightjeans", v: undefined, score: 0 });
    return { style, layers: [...layers.values()].map(x => [x.k, x.v]), detail: [...layers.values()] };
  }

  /* Dress ROT in exactly these closet pieces (for showing a fit) */
  function outfitFromItems(items, style, pieces = allPieces()) {
    const layers = [];
    for (const it of items) { const k = matchPiece(it, pieces); if (k) layers.push([k, toneOf(it.color + " " + it.name, undefined)]) }
    return { style, layers };
  }
  /* Closet piece → the drawing ROT wears. Falls back to a sensible drawing for its category when no piece matches. */
  function matchPiece(it, pieces = allPieces()) {
    const text = `${it.name || ""} ${it.notes || ""} ${it.color || ""}`.toLowerCase();
    const p = pieces.find(p => p.cat === it.cat && p.re.test(text)); if (p && LAYER[p.key]) return p.key;
    const jeans = /jean|denim|levi|wrangler/.test(text), roomy = /relaxed|baggy|wide|loose|oversized/.test(text + " " + (it.sil || ""));
    return ({ top: /shirt|button/.test(text) ? "oxford" : "tee", mid: /hood/.test(text) ? "hoodie" : /zip|fleece/.test(text) ? "fleece" : "knit",
      outer: /coat|parka/.test(text) ? "trench" : "workjacket", bottom: jeans ? (roomy ? "baggyjeans" : "straightjeans") : /short/.test(text) ? "jorts" : "chinos",
      shoes: /boot/.test(text) ? "workboots" : /loafer|dress/.test(text) ? "loafers" : "whitesneakers" })[it.cat] || null;
  }
  /* A random but on-style outfit, for previews and variety */
  function variant(style, seed, pieces = allPieces()) {
    const R = rng(seed * 7919 + 17), pick = (a) => a[Math.floor(R() * a.length)];
    const pool = {}; for (const p of pieces) if (p.s.includes(style) && LAYER[p.key]) (pool[SLOT[p.key]] ||= []).push(p.key);
    for (const k of EXTRAS[style] || []) (pool[SLOT[k]] ||= []).push(k);
    const kit = Object.fromEntries((KITS[style] || []).map(([k, v]) => [SLOT[k], [k, v]]));
    const layers = [], tones = [28, 45, 60, 90, 120, 150, 175, 200, 225, 236];
    for (const s of ["top", "bottom", "shoes"]) { const k = pool[s]?.length ? pick(pool[s]) : kit[s]?.[0]; if (k) layers.push([k, R() < 0.35 ? kit[s]?.[1] : pick(tones)]) }
    for (const s of ["mid", "outer", "belt", "neck", "wrist", "bag", "hat", "face", "hair", "socks"]) {
      const opts = [...(pool[s] || [])]; if (kit[s] && !opts.includes(kit[s][0])) opts.push(kit[s][0]);
      const signature = (EXTRAS[style] || []).some(k => SLOT[k] === s);
      if (opts.length && R() < (signature ? 0.7 : s === "outer" || s === "mid" ? 0.6 : 0.4)) { const k = signature && R() < 0.6 ? (EXTRAS[style].find(x => SLOT[x] === s)) : pick(opts); layers.push([k, pick(tones)]) }
    }
    return { style, layers };
  }

  function render(canvas, outfit, { scale = 2, seed = 1, glitch = true, body = null } = {}) {
    const G = ctx(body); drawOutfit(G, outfit.layers);
    const img = dither(G, PALETTES[outfit.style] || PALETTES.streetwear, { seed, glitch, pile: G.flags.pile });
    const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; tmp.getContext("2d").putImageData(img, 0, 0);
    canvas.width = W * scale; canvas.height = H * scale; const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; c.drawImage(tmp, 0, 0, W * scale, H * scale);
    return canvas;
  }

  window.ROT = { W, H, PALETTES, KITS, EXTRAS, LAYER, SLOT, toneOf, matchPiece, outfitFor, outfitFromItems, variant, render, kit: (style) => ({ style, layers: KITS[style] || KITS.streetwear }) };
})();
