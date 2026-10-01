/* Rotation — size guide. Turns body measurements into sizes across US, UK, EU, Japan and Korea.
   Charts are standard averages; every brand cuts a little differently, so the app also learns from sizes that fit you. */
(function () {
  const ALPHA = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
  const up = (a, n = 1) => ALPHA[Math.min(ALPHA.length - 1, Math.max(0, ALPHA.indexOf(a) + n))] || a;
  const r1 = v => Math.round(v * 10) / 10;
  const toIn = (v, unit) => { v = parseFloat(v); if (!isFinite(v) || v <= 0) return null; return unit === "cm" ? v / 2.54 : v };

  // Men's tops by chest (in): upper bound for each size
  const MEN_TOP = [[34, "XS"], [37, "S"], [40, "M"], [43, "L"], [46, "XL"], [49, "XXL"], [52, "3XL"], [99, "4XL"]];
  const KR_MEN = { XXS: 85, XS: 90, S: 95, M: 100, L: 105, XL: 110, XXL: 115, "3XL": 120, "4XL": 125 };
  // Women's US misses sizes: [size, bust, waist, hips] (in)
  const WOMEN = [[0, 32, 24.5, 34.5], [2, 33, 25.5, 35.5], [4, 34, 26.5, 36.5], [6, 35, 27.5, 37.5], [8, 36, 28.5, 38.5], [10, 37.5, 30, 40],
    [12, 39, 31.5, 41.5], [14, 40.5, 33, 43], [16, 42.5, 35, 45], [18, 44.5, 37, 47], [20, 46.5, 39, 49], [22, 48.5, 41, 51]];
  const W_ALPHA = { 0: "XS", 2: "XS", 4: "S", 6: "S", 8: "M", 10: "M", 12: "L", 14: "L", 16: "XL", 18: "XL", 20: "XXL", 22: "XXL" };
  const KR_WOMEN = { XXS: 44, XS: 44, S: 55, M: 66, L: 77, XL: 88, XXL: 99, "3XL": 99, "4XL": 99 };
  const W_DENIM = { 0: 25, 2: 26, 4: 27, 6: 28, 8: 29, 10: 30, 12: 31, 14: 32, 16: 33, 18: 34, 20: 36, 22: 38 };
  // Shoes, indexed by US men's: [USM, EU, foot cm (JP)]
  const SHOE = [[3.5, 35.5, 22.5], [4, 36, 23], [4.5, 36.5, 23.5], [5, 37.5, 23.5], [5.5, 38, 24], [6, 38.5, 24], [6.5, 39, 24.5], [7, 40, 25],
    [7.5, 40.5, 25.5], [8, 41, 26], [8.5, 42, 26.5], [9, 42.5, 27], [9.5, 43, 27.5], [10, 44, 28], [10.5, 44.5, 28.5], [11, 45, 29],
    [11.5, 45.5, 29.5], [12, 46, 30], [12.5, 47, 30.5], [13, 47.5, 31], [13.5, 48, 31.5], [14, 48.5, 32], [15, 49.5, 33]];
  const near = (col, v) => SHOE.reduce((best, row) => Math.abs(row[col] - v) < Math.abs(best[col] - v) ? row : best, SHOE[0]);

  function shoeRow(sys, v) {
    v = parseFloat(String(v).replace(",", ".")); if (!isFinite(v)) return null;
    if (sys === "USM") return near(0, v);
    if (sys === "USW") return near(0, v - 1.5);
    if (sys === "UK") return near(0, v + 1);
    if (sys === "EU") return near(1, v);
    if (sys === "CM") return near(2, v > 100 ? v / 10 : v);
    return null;
  }
  const ASIA = new Set(["JP", "KR", "CN", "HK", "TW", "TH", "VN", "PH", "ID", "MY", "SG", "KH", "MN"]);

  function compute(m, heightIn) {
    if (!m) return null;
    const unit = m.unit === "cm" ? "cm" : "in";
    const chest = toIn(m.chest, unit), waist = toIn(m.waist, unit), hips = toIn(m.hips, unit), inseam = toIn(m.inseam, unit);
    const cut = m.cut === "womens" ? "womens" : "mens", fit = m.fit || "regular";
    const out = { cut, fit, tops: null, bottoms: null, shoes: null, dress: null, notes: [] };
    const bump = fit === "oversized" ? 1 : 0;

    if (cut === "mens") {
      if (chest) {
        const a = (MEN_TOP.find(([mx]) => Math.round(chest) <= mx) || MEN_TOP[MEN_TOP.length - 1])[1];
        const suit = 2 * Math.round(chest / 2), len = heightIn ? (heightIn < 68 ? "S" : heightIn > 72 ? "L" : "R") : "R";
        out.tops = { main: a, US: a, UK: a, EU: a, JP: up(a), KR: String(KR_MEN[a] || ""), suit: `${suit}${len}`, suitEU: String(suit + 10) };
        if (bump) out.tops.wear = up(a);
      }
      if (waist) {
        let W = Math.round(waist); if (W > 34 && W % 2) W += 1;
        const L = inseam ? [28, 30, 32, 34, 36].reduce((b, x) => Math.abs(x - inseam) < Math.abs(b - inseam) ? x : b, 32) : null;
        out.bottoms = { main: L ? `${W}x${L}` : `W${W}`, US: L ? `${W}x${L}` : `W${W}`, UK: L ? `${W}R`.replace("R", L <= 30 ? "S" : L >= 34 ? "L" : "R") : String(W),
          EU: String(W + 16), JP: W <= 29 ? "1 / S" : W <= 31 ? "2 / M" : W <= 33 ? "3 / L" : W <= 35 ? "4 / XL" : "5 / XXL", KR: String(W), W, L };
      }
    } else {
      const pick = (v, col) => v ? (WOMEN.find(r => v <= r[col]) || WOMEN[WOMEN.length - 1])[0] : null;
      const sb = pick(chest, 1), sw = pick(waist, 2), sh = pick(hips, 3);
      const set = (n) => { const a = W_ALPHA[n]; return { main: `${a} (US ${n})`, US: `${a} / ${n}`, UK: String(n + 4), EU: String(n + 32), IT: String(n + 36), JP: String(n + 3), KR: String(KR_WOMEN[a] || ""), n, a } };
      if (sb != null) { out.tops = set(sb); if (bump) out.tops.wear = up(out.tops.a) }
      const sBottom = Math.max(sw ?? -1, sh ?? -1);
      if (sBottom >= 0) {
        const b = set(sBottom); const L = inseam ? Math.round(inseam) : null;
        b.denim = String(W_DENIM[sBottom]); b.len = inseam ? (inseam < 29 ? "petite / short" : inseam >= 32 ? "long / tall" : "regular") : "";
        b.main = `${b.denim} jeans (US ${sBottom})`; b.L = L; out.bottoms = b;
        if (sw != null && sh != null && Math.abs(sw - sh) >= 4) out.notes.push(sh > sw ? "Your hips run bigger than your waist: fit to the hips and look for curvy cuts or have the waist taken in." : "Your waist runs bigger than your hips: look for mid or low rise and fit to the waist.");
      }
      const sd = Math.max(sb ?? -1, sw ?? -1, sh ?? -1);
      if (sd >= 0) out.dress = set(sd);
    }

    if (m.shoe && m.shoe.v) {
      const row = shoeRow(m.shoe.sys, m.shoe.v);
      if (row) {
        const [usm, eu, cm] = row, usw = usm + 1.5;
        out.shoes = { USM: String(usm), USW: String(usw), UK: String(cut === "womens" ? usw - 2 : usm - 1), EU: String(eu), JP: `${cm} cm`, KR: String(Math.round(cm * 10)), cm };
        out.shoes.main = cut === "womens" ? `US ${usw} W` : `US ${usm}`;
      }
    }
    if (fit === "oversized") out.notes.push("You like it oversized: size up one in tops and outerwear, or buy brands cut boxy in your true size.");
    if (fit === "fitted") out.notes.push("You like it fitted: stay true to size, and size down in brands known for a relaxed cut.");
    return out;
  }

  const CATKEY = { top: "tops", mid: "tops", outer: "tops", bottom: "bottoms", shoes: "shoes" };
  // Best size for a piece category, optionally for a specific brand (country + your own fit notes)
  function forPiece(card, cat, brand) {
    const k = CATKEY[cat]; if (!card || !k) return "";
    const g = card[k]; if (!g) return "";
    if (k === "shoes") return g.main;
    let s = g.wear || (k === "tops" ? g.US.split(" / ")[0] : g.main);
    if (brand && ASIA.has(brand.cc)) s = k === "tops" ? `${card.cut === "womens" ? g.JP : g.JP} (${brand.cc === "KR" ? "KR " + g.KR : "JP sizing"})` : `${g.JP} (${brand.cc} sizing)`;
    return s;
  }
  // One-line tip for a brand: your own record first, then regional sizing
  function brandTip(brand, cat, card, refs) {
    if (!brand) return "";
    const kind = CATKEY[cat];
    const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const mine = (refs || []).filter(r => norm(r.brand) === norm(brand.b) || norm(brand.b).startsWith(norm(r.brand)) && norm(r.brand).length > 3);
    const same = mine.find(r => r.kind === kind) || mine[0];
    if (same) return same.fit === "small" ? `you wore ${same.size} and it ran small: size up` : same.fit === "big" ? `you wore ${same.size} and it ran big: size down` : `you wear ${same.size}`;
    if (!card) return ASIA.has(brand.cc) && brand.t > 1 ? "runs small: size up one" : "";
    if (ASIA.has(brand.cc) && kind !== "shoes" && brand.t > 1) return `runs small: try ${forPiece(card, cat, brand)}`;
    if (kind === "shoes" && card.shoes && ["IT", "FR", "ES", "PT", "DE", "DK", "SE", "GB"].includes(brand.cc)) return `EU ${card.shoes.EU} / UK ${card.shoes.UK}`;
    if (kind === "shoes" && card.shoes && ASIA.has(brand.cc)) return `${card.shoes.JP}`;
    if (kind === "tops" && card.tops && brand.t === 3 && ["IT", "FR"].includes(brand.cc)) return card.cut === "womens" ? `IT ${card.tops.IT} / FR ${card.tops.EU}` : `jackets EU ${card.tops.suitEU}`;
    return "";
  }
  window.SIZE = { compute, forPiece, brandTip, shoeRow, ASIA };
})();
