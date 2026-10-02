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

  function dither(G, palette, { seed = 1, glitch = true, pile = false, cutout = false } = {}) {
    const W = G.cv.width, H = G.cv.height;
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
      out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = cutout && !mask[i] ? 0 : 255;
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
    if ((bySlot.top && bySlot.top[0] === "dress") || (bySlot.bottom && /skirt/.test(bySlot.bottom[0])) || (bySlot.outer && bySlot.outer[0] === "trench")) G.flags.longLow = true;
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


  /* ---------- poses: cut ROT into parts at the joints and re-pose it (paper-puppet style) ---------- */
  // Angles in degrees, clockwise on screen. 0 = the standing pose. Arms/legs: U upper, F forearm, T thigh, S shin.
  // L = the arm/leg on the viewer's left. root: where the hips go in the 280x360 pose canvas, and the whole-body tilt.
  const POSES = {
    stand:   { name: "standing", root: [140, 196, 0] },
    loom:    { name: "looming", root: [140, 186, 0], torso: 6, head: -6, LU: 12, LF: -18, RU: -14, RF: 22, LT: 6, LS: 10, RT: -4, RS: 24 },
    crossed: { name: "arms crossed", root: [140, 190, 0], torso: -3, head: -8, LU: 6, LF: -100, RU: -6, RF: 96, LT: 4, LS: 6, RT: -10, RS: 30 },
    point:   { name: "pointing", root: [140, 192, -4], torso: -6, head: 8, LU: 28, LF: -118, RU: -96, RF: -6, LT: 8, LS: 0, RT: -14, RS: 10 },
    punch:   { name: "punch", root: [150, 196, 6], torso: 10, head: 4, LU: 96, LF: 4, RU: -44, RF: 118, LT: 22, LS: -4, RT: -20, RS: 14 },
    flex:    { name: "flex", root: [140, 196, 0], torso: 0, head: 0, LU: 86, LF: 96, RU: -86, RF: -96, LT: 6, LS: 0, RT: -6, RS: 0 },
    menace:  { name: "arms up", root: [140, 200, 0], torso: 0, head: -12, LU: 128, LF: 24, RU: -128, RF: -24, LT: 10, LS: 6, RT: -10, RS: -6 },
    reach:   { name: "reaching down", root: [130, 176, 18], torso: 14, head: 14, LU: 28, LF: 18, RU: -30, RF: -70, LT: 10, LS: 30, RT: -2, RS: 40 },
    face:    { name: "hand to face", root: [142, 196, -6], torso: -10, head: 12, LU: -22, LF: -146, RU: 18, RF: 8, LT: 14, LS: -4, RT: -6, RS: 6 },
    salute:  { name: "hand up", root: [140, 198, 4], torso: 4, head: -6, LU: 12, LF: 4, RU: -164, RF: -24, LT: 4, LS: 0, RT: -12, RS: 18 },
    kick:    { name: "kick", root: [150, 200, -10], torso: -12, head: 8, LU: 62, LF: 30, RU: -40, RF: -40, LT: 4, LS: 4, RT: -84, RS: -6 },
    crouch:  { name: "crouch", root: [140, 236, 0], torso: 10, head: -14, LU: 22, LF: -40, RU: -22, RF: 40, LT: 58, LS: -92, RT: -58, RS: 92 },
    hand:    { name: "handstand", root: [140, 150, 180], torso: 0, head: 10, LU: 6, LF: 0, RU: -6, RF: 0, LT: 34, LS: -20, RT: -30, RS: 50 },
    guard:   { name: "fists up", root: [140, 196, 0], torso: 4, head: -4, LU: 34, LF: -150, RU: -34, RF: 150, LT: 14, LS: -4, RT: -14, RS: 4 },
    barrage: { name: "barrage", root: [140, 196, 0], torso: 0, head: -10, LU: 92, LF: 6, RU: -92, RF: -6, LT: 16, LS: 0, RT: -16, RS: 0,
               echo: [{ side: "L", U: 66, F: 14 }, { side: "L", U: 118, F: -10 }, { side: "L", U: 80, F: -20 }, { side: "R", U: -66, F: -14 }, { side: "R", U: -118, F: 10 }, { side: "R", U: -80, F: 20 }] },
    wings:   { name: "many arms", root: [140, 200, 0], torso: 0, head: -14, LU: 140, LF: 18, RU: -140, RF: -18, LT: 6, LS: 4, RT: -6, RS: -4,
               echo: [{ side: "L", U: 112, F: 26 }, { side: "L", U: 84, F: 30 }, { side: "R", U: -112, F: -26 }, { side: "R", U: -84, F: -30 }] },
    lotus:   { name: "floating, legs crossed", root: [140, 176, 0], torso: 0, head: -6, LU: 20, LF: -64, RU: -20, RF: 64, LT: 80, LS: -150, RT: -80, RS: 150 },
    pockets: { name: "hands in pockets", root: [140, 196, 3], torso: -4, head: 8, LU: -4, LF: -16, RU: 4, RF: 16, LT: 4, LS: 0, RT: -4, RS: 2, armsBehind: true },
    behind:  { name: "hands behind back", root: [140, 196, 0], torso: -3, head: -12, LU: 16, LF: -34, RU: -16, RF: 34, LT: 6, LS: 0, RT: -6, RS: 0, armsBehind: true },
    lean:    { name: "leaning in", root: [134, 192, 8], torso: 16, head: -20, LU: 14, LF: 24, RU: -64, RF: -70, LT: 4, LS: 12, RT: -12, RS: 22 },
    shrug:   { name: "shrug", root: [140, 196, 0], torso: 0, head: 12, LU: 50, LF: -96, RU: -50, RF: 96, LT: 6, LS: 0, RT: -6, RS: 0 },
    landing: { name: "landing", root: [118, 246, 0], torso: 22, head: -16, LU: -12, LF: 6, RU: -76, RF: -30, LT: 62, LS: -104, RT: -44, RS: 112 },
    leap:    { name: "leap", root: [140, 190, -8], torso: -6, head: -8, LU: 124, LF: 30, RU: -62, RF: -24, LT: 72, LS: -124, RT: -12, RS: 22 },
    hang:    { name: "upside down", root: [140, 170, 180], torso: 0, head: 14, LU: 18, LF: 10, RU: -18, RF: -10, LT: -6, LS: 26, RT: 6, RS: -26 },
    judge:   { name: "pointing down", root: [140, 192, 6], torso: 8, head: 16, LU: 30, LF: -118, RU: -38, RF: -4, LT: 8, LS: 0, RT: -12, RS: 8 },
    spin:    { name: "spin kick", root: [132, 200, 10], torso: 12, head: 6, LU: 70, LF: 20, RU: -110, RF: -10, LT: 6, LS: 6, RT: -96, RS: -4,
               echo: [{ side: "RL", U: -64, F: 0 }, { side: "RL", U: -40, F: 6 }] },
    tpose:   { name: "t-pose", root: [140, 196, 0], LU: 90, LF: 0, RU: -90, RF: 0 },
    dive:    { name: "diving", root: [172, 190, -62], torso: -6, head: -14, LU: 150, LF: 10, RU: 168, RF: -6, LT: 6, LS: 22, RT: 12, RS: 36 },
  };
  function posed(G, pose, body) {
    const P = typeof pose === "string" ? (POSES[pose] || POSES.stand) : pose;
    const sx = body?.sx || 1, sy = body?.sy || 1, T = (x, y) => [x * sx + 80 * (1 - sx), y * sy + 268 * (1 - sy)];
    const src = G.cv, sd = G.c.getImageData(0, 0, W, H).data;
    const grey = (x, y) => { x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y))); const i = (y * W + x) * 4; return sd[i + 3] > 110 ? sd[i] : null };
    const rigid = !!(G.flags.longLow);
    // parts: clip polygon (standing coords) and pivot; parent pivots are where children attach
    const R = {
      torso: { poly: [[54.5, 52], [105.5, 52], [105.5, 152], [54.5, 152]], piv: [80, 146] },
      head:  { poly: [[0, -20], [160, -20], [160, 61], [0, 61]], piv: [80, 60], parent: "torso" },
      LU: { poly: [[0, 56], [54.5, 56], [54.5, 106], [0, 106]], piv: [51, 68], parent: "torso" },
      LF: { poly: [[0, 106], [54.5, 106], [54.5, 162], [0, 162]], piv: [47, 106], parent: "LU" },
      RU: { poly: [[105.5, 56], [160, 56], [160, 106], [105.5, 106]], piv: [109, 68], parent: "torso" },
      RF: { poly: [[105.5, 106], [160, 106], [160, 190], [112, 190], [112, 162], [105.5, 162]], piv: [113, 106], parent: "RU" },
      LT: { poly: [[54.5, 152], [80, 152], [80, 202], [20, 202], [20, 162], [54.5, 162]], piv: [69, 150], parent: "torso" },
      LS: { poly: [[20, 202], [80, 202], [80, 290], [20, 290]], piv: [68, 202], parent: "LT" },
      RT: { poly: [[80, 152], [105.5, 152], [105.5, 162], [112, 162], [112, 190], [140, 190], [140, 202], [80, 202]], piv: [91, 150], parent: "torso" },
      RS: { poly: [[80, 202], [140, 202], [140, 290], [80, 290]], piv: [92, 202], parent: "RT" },
      LOW: { poly: [[54.5, 152], [105.5, 152], [105.5, 162], [112, 162], [112, 190], [160, 190], [160, 290], [0, 290], [0, 162], [54.5, 162]], piv: [80, 150], parent: "torso" },
    };
    const legs = rigid ? ["LOW"] : ["LT", "LS", "RT", "RS"], arms = ["LU", "LF", "RU", "RF"];
    const order = P.armsBehind ? [...arms, ...legs, "torso", "head"] : [...legs, "torso", "head", ...arms];
    const ang = { torso: (P.root?.[2] || 0) + (P.torso || 0), head: P.head || 0, LU: P.LU || 0, LF: P.LF || 0, RU: P.RU || 0, RF: P.RF || 0, LT: P.LT || 0, LS: P.LS || 0, RT: P.RT || 0, RS: P.RS || 0, LOW: ((P.LT || 0) + (P.RT || 0)) * 0.3 };
    // forward kinematics: absolute transform of each part
    const M = {}, mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const rotAbout = (deg, [px, py]) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, px - c * px + s * py, py - s * px - c * py] };
    const app = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    const [rx, ry] = P.root || [140, 196], tp = T(...R.torso.piv);
    M.torso = mul([1, 0, 0, 1, rx - tp[0], ry - tp[1]], rotAbout(ang.torso, tp));
    for (const k of ["head", "LU", "RU", "LT", "RT", "LOW", "LF", "RF", "LS", "RS"]) { const par = M[R[k].parent]; M[k] = mul(par, rotAbout(ang[k], T(...R[k].piv))) }
    const PW = 280, PH = 360, cv = document.createElement("canvas"); cv.width = PW; cv.height = PH; const c = cv.getContext("2d");
    const drawPart = (cx, k, m) => { const part = R[k], pv = T(...part.piv), g = grey(pv[0], pv[1] + (k === "head" ? 2 : 0));
      if (k !== "torso" && g != null) { const [jx, jy] = app(m, pv); cx.fillStyle = `rgb(${g},${g},${g})`; cx.beginPath(); cx.arc(jx, jy, k[1] === "U" ? 6 : k === "head" ? 6 : 7, 0, Math.PI * 2); cx.fill() }
      cx.save(); cx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); cx.beginPath(); part.poly.forEach(([x, y], i) => { const [a, b] = T(x, y); i ? cx.lineTo(a, b) : cx.moveTo(a, b) }); cx.closePath(); cx.clip(); cx.drawImage(src, 0, 0); cx.restore() };
    let echoDone = false;
    const drawEchoes = () => { if (echoDone || !P.echo?.length) return; echoDone = true;
      const e = document.createElement("canvas"); e.width = 280; e.height = 360; const ex = e.getContext("2d");
      for (const q of P.echo) { const [u, f] = q.side === "L" ? ["LU", "LF"] : q.side === "R" ? ["RU", "RF"] : q.side === "LL" ? ["LT", "LS"] : ["RT", "RS"];
        if (rigid && (u === "LT" || u === "RT")) continue;
        const mu = mul(M[R[u].parent], rotAbout(q.U, T(...R[u].piv))), mf = mul(mu, rotAbout(q.F, T(...R[f].piv))); drawPart(ex, u, mu); drawPart(ex, f, mf) }
      c.save(); c.filter = "brightness(1.55) contrast(.8)"; c.drawImage(e, 0, 0); c.restore() };
    for (const k of order) {
      if ((k === "LU" || k === "LT" || k === "LOW") && !P.armsBehind) drawEchoes(); else if (P.armsBehind && k === "LU") drawEchoes();
      const part = R[k], m = M[k], pv = T(...part.piv), g = grey(pv[0], pv[1] + (k === "head" ? 2 : 0));
      if (k !== "torso" && g != null) { const [jx, jy] = app(m, pv); c.fillStyle = `rgb(${g},${g},${g})`; c.beginPath(); c.arc(jx, jy, k[1] === "U" ? 6 : k === "head" ? 6 : 7, 0, Math.PI * 2); c.fill() }
      c.save(); c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); c.beginPath(); part.poly.forEach(([x, y], i) => { const [a, b] = T(x, y); i ? c.lineTo(a, b) : c.moveTo(a, b) }); c.closePath(); c.clip(); c.drawImage(src, 0, 0); c.restore();
    }
    // accent pixels (eyes, zips) move with their part
    const inPoly = (poly, x, y) => { let o = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = T(...poly[i]), [xj, yj] = T(...poly[j]); if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o } return o };
    const glints = []; for (const [x, y] of G.glints) { const k = [...order].reverse().find(k => inPoly(R[k].poly, x, y)); if (k) { const [a, b] = app(M[k], [x, y]); glints.push([Math.round(a), Math.round(b)]) } }
    return { cv, c, glints, flags: G.flags };
  }
  function render(canvas, outfit, { scale = 2, seed = 1, glitch = true, body = null, cutout = false, pose = null } = {}) {
    let G = ctx(body); drawOutfit(G, outfit.layers);
    if (pose) G = posed(G, pose, body);
    const img = dither(G, PALETTES[outfit.style] || PALETTES.streetwear, { seed, glitch, pile: G.flags.pile, cutout: cutout || !!pose });
    const w = G.cv.width, h = G.cv.height;
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h; tmp.getContext("2d").putImageData(img, 0, 0);
    canvas.width = w * scale; canvas.height = h * scale; const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; c.clearRect(0, 0, w * scale, h * scale); c.drawImage(tmp, 0, 0, w * scale, h * scale);
    return canvas;
  }

  /* Chibi ROT: a flat SVG for the UI (avatar, chat, quiz). Big round void head, glowing eyes, the day's clothes as simple shapes.
     colors: optional {slot: css color} from the real pieces; otherwise each layer's grey tone is used. */
  const CH_DEF = { top: "#e9e9e6", mid: "#3a3d44", outer: "#8f8a80", bottom: "#56657e", shoes: "#efefec", hat: "#2a2c31", hair: "#1d1e22", bag: "#2a2c31", neck: "#c8c3b8", socks: "#e9e9e6", belt: "#3b2a20", face: "#0b0b0d", wrist: "#c9a24a" };
  function chibi(outfit, { colors = {}, accent = null, skin = "var(--chibi-skin,#17191e)", view = "0 0 120 140" } = {}) {
    const L = {}; for (const [k, v] of outfit.layers || []) L[SLOT[k]] = { k, v };
    const pal = PALETTES[outfit.style] || PALETTES.streetwear, acc = accent || `rgb(${pal[2].join(",")})`;
    const col = (s) => colors[s] || (L[s] && L[s].v != null ? `rgb(${L[s].v},${L[s].v},${L[s].v})` : CH_DEF[s]);
    const has = (s) => !!L[s], k = (s) => L[s]?.k;
    const o = []; const P = (d, f, x = "") => o.push(`<path d="${d}" style="fill:${f}"${x}/>`);
    const R = (x, y, w, h, r, f, x2 = "") => o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" style="fill:${f}"${x2}/>`);
    const C = (x, y, r, f, x2 = "") => o.push(`<circle cx="${x}" cy="${y}" r="${r}" style="fill:${f}"${x2}/>`);
    const line = (d, c, w = 1.4) => o.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
    const shade = "rgba(0,0,0,.14)", hi = "rgba(255,255,255,.22)";
    const outerK = k("outer"), midK = k("mid"), topK = k("top") || "tee", botK = k("bottom") || "straightjeans", shoeK = k("shoes") || "whitesneakers";
    const dress = topK === "dress";
    const long = outerK === "trench";
    // what covers the torso, and the sleeves
    const torsoC = outerK && outerK !== "vest" ? col("outer") : midK ? col("mid") : col("top");
    const sleeveC = outerK && outerK !== "vest" ? col("outer") : midK ? col("mid") : col("top");
    const shortSleeve = !outerK && !midK && /tee|babytee|graphictee|polo|dress/.test(topK) || (outerK === "vest" && !midK && /tee|polo/.test(topK));
    o.push(`<ellipse cx="60" cy="133" rx="27" ry="4" fill="currentColor" opacity=".12"/>`);
    // long hair and hood sit behind everything
    if (k("hair") === "longhair" && !has("hat")) P("M33 44 Q31 86 42 92 L78 92 Q89 86 87 44 Z", col("hair"));
    if (midK === "hoodie" && !has("hat")) C(60, 45, 31.5, col("mid"));
    // legs
    const shorts = botK === "jorts", skirt = /skirt/.test(botK);
    const legW = /baggy|cargo|sweat|workpants/.test(botK) ? 13 : botK === "leggings" ? 10 : 12;
    const lx = 59 - legW, rx = 61;
    if (dress || skirt || shorts) { R(48, 96, 8, 30, 4, skin); R(64, 96, 8, 30, 4, skin) }
    else if (botK === "bootcut") { P(`M${lx} 92 H58 V126 H${lx - 3} Z`, col("bottom")); P(`M62 92 H${rx + legW} L${rx + legW + 3} 126 H62 Z`, col("bottom")) }
    else { R(lx, 90, legW, 36, 3, col("bottom")); R(rx, 90, legW, 36, 3, col("bottom")) }
    if (!dress && !skirt && !shorts) line("M60 94 V124", shade, 1);
    if (shorts) { R(45, 90, 14, 16, 3, col("bottom")); R(61, 90, 14, 16, 3, col("bottom")) }
    if (skirt) P(botK === "midiskirt" ? "M44 90 H76 L82 118 H38 Z" : "M44 90 H76 L80 106 H40 Z", col("bottom"));
    if (has("socks") && (shorts || skirt || dress)) { R(47, 114, 10, 6, 2, col("socks")); R(63, 114, 10, 6, 2, col("socks")) }
    // shoes
    const sc = col("shoes");
    if (/boot/.test(shoeK)) { const t = shoeK === "kneeboots" ? 100 : 112; R(46, t, 13, 132 - t - 4, 3, sc); R(61, t, 13, 132 - t - 4, 3, sc); R(43, 124, 16, 7, 3.5, sc); R(61, 124, 16, 7, 3.5, sc); if (shoeK === "westernboots") { line(`M49 ${t + 5} L53 ${t + 9} L57 ${t + 5}`, hi); line(`M63 ${t + 5} L67 ${t + 9} L71 ${t + 5}`, hi) } }
    else if (/heels|balletflats|loafers|dressshoes/.test(shoeK)) { R(44, 124, 15, 6, 3, sc); R(61, 124, 15, 6, 3, sc); if (shoeK === "heels") { R(56, 126, 3, 5, 1, sc); R(61, 126, 3, 5, 1, sc) } }
    else { R(42, 121, 17, 10, 5, sc); R(61, 121, 17, 10, 5, sc); o.push(`<path d="M42 128 H59 M61 128 H78" stroke="${shade}" stroke-width="2"/>`) }
    // body
    if (dress) P("M44 70 H76 L84 112 Q60 117 36 112 Z", col("top"));
    if (long) P("M40 72 H80 L84 112 H36 Z", col("outer"));
    // arms (behind the torso edge)
    const arm = (side) => { const s = side < 0 ? 1 : -1, x = side < 0 ? 33 : 78;
      if (shortSleeve) { R(x, 72, 9, 22, 4.5, skin); R(x - .5, 71, 10, 10, 4, torsoC === col("top") ? col("top") : sleeveC) }
      else R(x, 72, 9, 22, 4.5, sleeveC);
      C(x + 4.5, 95, 4.3, skin); if (s && has("wrist") && side > 0) R(x, 88, 9, 3, 1, col("wrist")) };
    arm(-1); arm(1);
    R(40, 68, 40, 28, 10, dress ? col("top") : torsoC);
    // inner layer showing through an open jacket / cardigan
    const open = (outerK && outerK !== "vest" && outerK !== "puffer" && outerK !== "shell") || midK === "cardigan";
    if (open) { const inner = outerK ? (midK && midK !== "cardigan" ? col("mid") : col("top")) : col("top"); P("M54 68 H66 L64 96 H56 Z", inner); if (k("top") === "graphictee" && !(outerK && midK)) R(57, 78, 6, 6, 1.5, acc) }
    if (outerK === "vest") { P("M40 72 Q40 68 46 68 H54 L56 96 H40 Z", col("outer")); P("M80 72 Q80 68 74 68 H66 L64 96 H80 Z", col("outer")) }
    if (outerK === "puffer" || outerK === "vest") { line("M42 79 H78", shade, 1.2); line("M42 88 H78", shade, 1.2) }
    if (outerK === "shell") { line("M60 70 V95", shade, 1.2) }
    if (outerK === "blazer") { line("M54 68 L58 80 M66 68 L62 80", shade, 1.4) }
    if (outerK === "workjacket" || outerK === "leather" || outerK === "suede" || outerK === "trench") { P("M47 67 L55 67 L58 74 Z", shade); P("M73 67 L65 67 L62 74 Z", shade) }
    if (long) { R(40, 91, 40, 3, 1, shade) }
    if (!outerK && midK === "hoodie") { R(49, 84, 22, 9, 4, shade); line("M56 70 V77 M64 70 V77", "rgba(255,255,255,.55)", 1.2) }
    if (!outerK && (midK === "quarterzip" || midK === "fleece")) { line(midK === "fleece" ? "M60 70 V95" : "M60 70 V80", shade, 1.3); C(60, midK === "fleece" ? 76 : 80, 1.3, acc) }
    if (!outerK && !midK && topK === "graphictee") R(54, 76, 12, 10, 2, acc);
    if (!outerK && !midK && /oxford|flannel|pearlsnap|polo|henley/.test(topK)) { line("M60 70 V94", shade, 1); if (topK === "flannel") { line("M41 80 H79 M41 88 H79", shade, 1.6); line("M50 69 V95 M70 69 V95", shade, 1.6) } }
    if (has("belt") && !long && !dress) R(41, 92, 38, 3.5, 1, col("belt")), R(58, 91.5, 4, 4.5, 1, "#c9a24a");
    if (midK === "turtleneck") R(48, 64, 24, 8, 4, col("mid"));
    // bag
    if (k("bag") === "crossbody") { line("M45 69 L76 92", col("bag"), 2.2); R(72, 88, 12, 10, 3, col("bag")) }
    if (k("bag") === "tote") { line("M30 82 Q35 74 40 82", col("bag"), 1.6); R(28, 82, 14, 17, 2, col("bag")) }
    // neck
    if (k("neck") === "scarf") { R(44, 64, 32, 8, 4, col("neck")); R(64, 68, 7, 18, 3, col("neck")) }
    if (k("neck") === "jewelry") { line("M50 70 Q60 80 70 70", "#c9a24a", 1.2); C(60, 77, 1.8, "#c9a24a") }
    // head
    o.push(`<circle class="ch-head" cx="60" cy="44" r="27" style="fill:${skin};stroke:var(--chibi-gap,transparent);stroke-width:2.5"/>`);
    o.push(`<ellipse cx="51" cy="33" rx="9" ry="5" fill="${hi}" opacity=".5" transform="rotate(-24 51 33)"/>`);
    if (k("neck") === "headphones") { line("M38 66 Q60 78 82 66", "#2a2c31", 3); R(34, 60, 8, 10, 3, "#2a2c31"); R(78, 60, 8, 10, 3, "#2a2c31") }
    // eyes
    if (k("face") === "sunglasses") { R(40, 40, 40, 11, 5, "#09090b"); line("M44 43 H50", acc, 1.6) }
    else o.push(`<g class="ch-eyes" fill="${acc}"><rect x="46" y="42" width="7" height="10" rx="3.5"/><rect x="67" y="42" width="7" height="10" rx="3.5"/></g>`);
    // hair and hats
    const hc = col("hat"), hr = col("hair");
    if (k("hair") === "slick" && !has("hat")) P("M34 40 Q36 15 62 16 Q84 17 87 38 Q76 26 58 27 Q44 28 34 40 Z", hr);
    if (k("hair") === "longhair" && !has("hat")) P("M33 46 Q32 16 60 16 Q88 16 87 46 Q80 30 66 26 Q52 34 33 46 Z", hr);
    if (k("hat") === "cap") { P("M33 38 Q34 13 60 13 Q86 13 87 38 Z", hc); P("M70 36 Q90 33 98 39 Q86 42 70 40 Z", hc); line("M60 13 V37", shade, 1) }
    if (k("hat") === "beanie") { P("M33 36 Q33 10 60 10 Q87 10 87 36 Z", hc); R(31, 30, 58, 10, 5, hc); line("M33 35 H87", shade, 1.2); C(60, 9, 3.4, hc) }
    if (k("hat") === "cowboyhat") { P("M22 30 Q60 44 98 30 Q94 39 60 41 Q26 39 22 30 Z", hc); P("M41 31 Q40 8 52 9 Q60 13 68 9 Q80 8 79 31 Z", hc); R(41, 25, 38, 4, 1, shade) }
    if (midK === "hoodie" && !has("hat")) P("M33 47 Q31 60 40 68 L44 66 Q36 58 36 47 Z M87 47 Q89 60 80 68 L76 66 Q84 58 84 47 Z", col("mid"));
    return `<svg class="chibi" viewBox="${view}" role="img" aria-label="ROT" xmlns="http://www.w3.org/2000/svg">${o.join("")}</svg>`;
  }

  window.ROT = { W, H, POSES, PALETTES, KITS, EXTRAS, LAYER, SLOT, toneOf, matchPiece, outfitFor, outfitFromItems, variant, render, chibi, kit: (style) => ({ style, layers: KITS[style] || KITS.streetwear }) };
})();
