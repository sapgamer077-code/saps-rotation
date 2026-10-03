/* ROT — Rotation's style core.
   No drawing any more: this holds each style's palette and default kit, the slot every wardrobe piece fills,
   and the logic that picks what ROT (the stylist) would put together from a closet.
   Needs catalog.js (STYLES, PIECES) loaded first. Public API on window.ROT. */
(function () {
  "use strict";
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

  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }

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

  const LAYER = Object.fromEntries(Object.keys(SLOT).map(k => [k, true]));

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


  window.ROT = { PALETTES, KITS, EXTRAS, LAYER, SLOT, toneOf, matchPiece, outfitFor, outfitFromItems, variant, kit: (style) => ({ style, layers: KITS[style] || KITS.streetwear }) };
})();
