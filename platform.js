/* Rotation — platform layer for the standalone web app.
   Gives the app the same small API it had inside claude.ai (claude.use("db" | "assets" | "sample")):
   - db: documents cached on the device (IndexedDB) and synced to the user's own Supabase project
   - assets: photos cached on the device and stored in a private Supabase bucket
   - sample: optional Google Gemini calls, only when the user has saved a key */
(function () {
  "use strict";
  const CFG_KEY = "rot-config";
  const loadCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}") } catch { return {} } };
  const saveCfg = c => { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)) } catch {} };
  let cfg = loadCfg();
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- IndexedDB ---------- */
  const idb = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open("saps-rotation", 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("docs"); d.createObjectStore("blobs"); d.createObjectStore("outbox") };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (store, mode, fn) => { const d = await open(); return new Promise((res, rej) => {
      const t = d.transaction(store, mode); let out; const r = fn(t.objectStore(store));
      if (r) r.onsuccess = () => { out = r.result };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }) };
    const all = async store => { const d = await open(); return new Promise((res, rej) => {
      const out = []; const t = d.transaction(store, "readonly"); const c = t.objectStore(store).openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue() } };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    }) };
    return {
      get: (s, k) => tx(s, "readonly", o => o.get(k)),
      put: (s, v, k) => tx(s, "readwrite", o => o.put(v, k)),
      del: (s, k) => tx(s, "readwrite", o => o.delete(k)),
      clear: s => tx(s, "readwrite", o => o.clear()),
      all,
    };
  })();

  /* ---------- in-memory documents + listeners ---------- */
  const M = new Map(), L = new Set();
  const col = c => { if (!M.has(c)) M.set(c, new Map()); return M.get(c) };
  const notify = c => { for (const l of L) if (l.coll === c) l.fire() };
  const notifyAll = () => { for (const l of L) l.fire() };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 20);
  let seq = 0; const okey = () => String(Date.now()).padStart(15, "0") + ":" + (seq++);
  const clone = d => JSON.parse(JSON.stringify(d ?? null));

  async function loadLocal() {
    for (const [k, v] of await idb.all("docs")) { const i = k.indexOf("/"); col(k.slice(0, i)).set(k.slice(i + 1), v) }
  }

  /* ---------- sync state ---------- */
  let sb = null, uid = null, email = "";
  const cloudReady = () => cfg.mode === "cloud" && sb && uid;
  let syncState = { s: "local", msg: "" };
  function setSync(s, msg = "") { syncState = { s, msg }; paintPill(); renderSettings() }
  function paintPill() {
    const el = $("sync-pill"); if (!el) return;
    const t = cfg.mode !== "cloud" ? "This device only" : !navigator.onLine ? "Offline · saved on phone" :
      syncState.s === "syncing" ? "Syncing…" : syncState.s === "error" ? "Sync paused" : "Synced";
    el.textContent = t; el.dataset.state = cfg.mode !== "cloud" ? "local" : !navigator.onLine ? "offline" : syncState.s;
    el.title = syncState.msg || "";
    el.onclick = () => { if (syncState.s === "error" && syncState.msg) alertBox("Sync paused: " + syncState.msg) };
  }
  function alertBox(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; d.style.bottom = "calc(90px + env(safe-area-inset-bottom,0px))"; document.body.appendChild(d); setTimeout(() => d.remove(), 6000) }
  const queue = o => cfg.mode === "cloud" ? idb.put("outbox", o, okey()) : Promise.resolve();

  let flushing = false, flushAgain = false;
  async function flush() {
    if (!cloudReady() || !navigator.onLine) { paintPill(); return }
    if (flushing) { flushAgain = true; return }
    flushing = true; setSync("syncing");
    try {
      do {
        flushAgain = false;
        for (const [k, o] of await idb.all("outbox")) {
          try {
            if (o.op === "set") {
              const data = col(o.c).get(o.id);
              if (data !== undefined) {
                const { error } = await sb.from("docs").upsert({ user_id: uid, coll: o.c, id: o.id, data, updated_at: new Date().toISOString() });
                if (error) throw error;
              }
            } else if (o.op === "del") {
              const { error } = await sb.from("docs").delete().match({ user_id: uid, coll: o.c, id: o.id }); if (error) throw error;
            } else if (o.op === "up") {
              const b = await idb.get("blobs", o.id);
              if (b) { const { error } = await sb.storage.from("photos").upload(uid + "/" + o.id, b, { upsert: true, contentType: b.type || "image/jpeg" }); if (error) throw error }
            } else if (o.op === "rm") {
              await sb.storage.from("photos").remove([uid + "/" + o.id]);
            }
            await idb.del("outbox", k);
          } catch (e) { console.warn("sync", e); setSync("error", e.message || String(e)); return }
        }
      } while (flushAgain);
      setSync("ok");
    } finally { flushing = false }
  }

  let pulling = false;
  async function pull() {
    if (!cloudReady() || !navigator.onLine || pulling) { paintPill(); return }
    pulling = true; setSync("syncing");
    try {
      const rows = []; let from = 0;
      for (;;) {
        const { data, error } = await sb.from("docs").select("coll,id,data").range(from, from + 999);
        if (error) { setSync("error", error.message); return }
        rows.push(...data); if (data.length < 1000) break; from += 1000;
      }
      const pending = new Set((await idb.all("outbox")).filter(([, o]) => o.c).map(([, o]) => o.c + "/" + o.id));
      const seen = new Set(), changed = new Set();
      for (const r of rows) {
        const key = r.coll + "/" + r.id; seen.add(key); if (pending.has(key)) continue;
        const cur = col(r.coll).get(r.id);
        if (JSON.stringify(cur) !== JSON.stringify(r.data)) { col(r.coll).set(r.id, r.data); idb.put("docs", r.data, key); changed.add(r.coll) }
      }
      for (const [c, m] of M) for (const id of [...m.keys()]) {
        const key = c + "/" + id;
        if (!seen.has(key) && !pending.has(key)) { m.delete(id); idb.del("docs", key); changed.add(c) }
      }
      changed.forEach(notify);
      setSync("ok");
    } finally { pulling = false }
    await flush();
  }
  async function syncNow() { await flush(); await pull() }

  // First time a device with local data links to the cloud: send everything up.
  async function queueEverything() {
    for (const [c, m] of M) for (const id of m.keys()) await idb.put("outbox", { op: "set", c, id }, okey());
    for (const [id] of await idb.all("blobs")) await idb.put("outbox", { op: "up", id }, okey());
  }

  /* ---------- db shim (same calls the app used inside claude.ai) ---------- */
  async function writeDoc(c, id, data, quiet) {
    col(c).set(id, data); if (!quiet) notify(c);
    await idb.put("docs", data, c + "/" + id); await queue({ op: "set", c, id }); if (!quiet) flush();
  }
  async function deleteDoc(c, id) {
    col(c).delete(id); notify(c);
    await idb.del("docs", c + "/" + id); await queue({ op: "del", c, id }); flush();
  }
  const snapDoc = (c, id) => { const d = col(c).get(id); return { id, exists: d !== undefined, data: () => d } };
  function docRef(c, id) {
    return {
      id,
      set: data => writeDoc(c, id, clone(data)),
      update: data => writeDoc(c, id, { ...(col(c).get(id) || {}), ...clone(data) }),
      delete: () => deleteDoc(c, id),
      get: async () => snapDoc(c, id),
      onSnapshot(cb) { const l = { coll: c, fire() { try { cb(snapDoc(c, id)) } catch (e) { console.error(e) } } }; L.add(l); l.fire(); return () => L.delete(l) },
    };
  }
  function query(c, ord, lim) {
    return {
      orderBy: (f, d = "asc") => query(c, { f, d }, lim),
      limit: n => query(c, ord, n),
      doc: id => docRef(c, id || uuid()),
      onSnapshot(cb) {
        const l = { coll: c, fire() {
          let docs = [...col(c).entries()].map(([id, data]) => ({ id, data: () => data }));
          if (ord) { const s = ord.d === "desc" ? -1 : 1; docs.sort((a, b) => { const x = a.data()?.[ord.f], y = b.data()?.[ord.f]; return (x > y ? 1 : x < y ? -1 : 0) * s }) }
          if (lim) docs = docs.slice(0, lim);
          try { cb({ docs }) } catch (e) { console.error(e) }
        } };
        L.add(l); l.fire(); return () => L.delete(l);
      },
    };
  }
  const db = { collection: c => query(c), doc: p => { const i = p.lastIndexOf("/"); return docRef(p.slice(0, i), p.slice(i + 1)) } };

  /* ---------- photos ---------- */
  const urls = new Map();
  const assets = {
    async upload(blob, opts) {
      const id = uuid(); const b = blob.type ? blob : new Blob([blob], { type: opts?.type || "image/jpeg" });
      await idb.put("blobs", b, id); urls.set(id, URL.createObjectURL(b));
      await queue({ op: "up", id }); flush(); return { id, url: urls.get(id) };
    },
    async delete(id) { await idb.del("blobs", id); urls.delete(id); await queue({ op: "rm", id }); flush() },
  };
  const inflight = new Map();
  function getBlob(id) {
    if (!id) return Promise.resolve(null);
    if (inflight.has(id)) return inflight.get(id);
    const p = (async () => {
      const b = await idb.get("blobs", id); if (b) return b;
      if (cloudReady() && navigator.onLine) {
        const { data, error } = await sb.storage.from("photos").download(uid + "/" + id);
        if (!error && data) { await idb.put("blobs", data, id); return data }
      }
      return null;
    })().finally(() => inflight.delete(id));
    inflight.set(id, p); return p;
  }
  const srcFor = id => !id ? "" : (urls.get(id) || "blob-id:" + id);
  function hydrate(img) {
    const s = img.getAttribute("src") || ""; if (!s.startsWith("blob-id:")) return;
    const id = s.slice(8); img.dataset.bid = id; img.removeAttribute("src"); img.style.visibility = "hidden";
    getBlob(id).then(b => { if (img.dataset.bid !== id) return; if (!b) { img.dispatchEvent(new Event("error")); return } let u = urls.get(id); if (!u) { u = URL.createObjectURL(b); urls.set(id, u) } img.src = u; img.style.visibility = "" });
  }
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === "attributes") { if (m.target.tagName === "IMG") hydrate(m.target) }
      else for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; if (n.tagName === "IMG") hydrate(n); else n.querySelectorAll?.('img[src^="blob-id:"]').forEach(hydrate) }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });

  /* ---------- optional Gemini ---------- */
  const DEFAULT_MODEL = "gemini-3.5-flash";
  function makeSample() {
    if (!cfg.geminiKey) return null;
    const model = cfg.geminiModel || DEFAULT_MODEL;
    const b64 = async blob => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s) };
    // Busy or out of quota on one model? Wait and retry, then try other Flash models before giving up.
    const BACKUPS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
    const wait = ms => new Promise(r => setTimeout(r, ms));
    async function call(input, opts = {}) {
      const chain = [opts.model || model, ...BACKUPS.filter(m => m !== (opts.model || model))];
      let last;
      for (const m of chain) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try { return await callOnce(input, { ...opts, model: m }) }
          catch (e) { last = e;
            if (e.code === "bad_key" || e.code === "cancelled" || e.code === "network") throw e;
            if (e.code === "busy" && attempt === 0) { await wait(1500 + Math.random() * 1000); continue }
            break } // bad_model, rate_limited, busy twice, other errors: next model
        }
      }
      throw last;
    }
    async function callOnce(input, opts = {}) {
      const text = typeof input === "string" ? input : input.map(t => t.content).join("\n\n");
      const parts = [{ text }];
      for (const im of (opts.images || [])) parts.push({ inline_data: { mime_type: im.type || "image/jpeg", data: await b64(im) } });
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model || model)}:generateContent`, {
          method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
          body: JSON.stringify(Object.assign({ contents: [{ role: "user", parts }], generationConfig: opts.json && !opts.search ? { responseMimeType: "application/json" } : {} }, opts.search ? { tools: [{ google_search: {} }] } : {})),
        });
      } catch (e) { if (e.name === "AbortError") throw { code: "cancelled" }; throw { code: "network", message: String(e) } }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m = j.error?.message || r.statusText;
        throw { code: r.status === 429 ? "rate_limited" : r.status === 404 ? "bad_model" : r.status === 503 || r.status === 500 || /high demand|overloaded|unavailable/i.test(m) ? "busy" : /api key|permission|unauth/i.test(m) ? "bad_key" : "ai_error", message: m };
      }
      return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    }
    const s = async (input, opts) => ({ text: await call(input, opts), truncated: false });
    s.json = async (input, opts = {}) => { const t = await call(input, { ...opts, json: true });
      try { return JSON.parse(t.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim()) } catch {}
      const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch {} }
      throw { code: "invalid_json" } };
    s.limits = async () => ({ images: { maxCount: 12 } });
    s.model = model;
    return s;
  }

  /* ---------- backup ---------- */
  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b) });
  const dataURLToBlob = async u => (await fetch(u)).blob();
  function blobIds() {
    const ids = new Set();
    for (const [, d] of col("items")) { if (d.flat) ids.add(d.flat); if (d.body) ids.add(d.body) }
    for (const [, d] of col("inspo")) if (d.img) ids.add(d.img);
    return ids;
  }
  async function exportBackup(status) {
    const docs = {}; for (const [c, m] of M) { if (!m.size) continue; docs[c] = {}; for (const [id, d] of m) docs[c][id] = d }
    const blobs = {}; const ids = [...blobIds()]; let n = 0;
    for (const id of ids) { status?.(`Packing photos ${++n} of ${ids.length}…`); const b = await getBlob(id); if (b) blobs[id] = await blobToDataURL(b) }
    const file = new Blob([JSON.stringify({ app: "saps-rotation", version: 1, at: Date.now(), docs, blobs })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = `rotation-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return { docs: Object.values(docs).reduce((t, x) => t + Object.keys(x).length, 0), photos: Object.keys(blobs).length };
  }
  async function importBackup(file, status) {
    const j = JSON.parse(await file.text());
    if (j.app !== "saps-rotation" || !j.docs) throw new Error("That file isn't a Rotation backup.");
    const ids = Object.keys(j.blobs || {}); let n = 0;
    for (const id of ids) {
      status?.(`Adding photos ${++n} of ${ids.length}…`);
      if (await idb.get("blobs", id)) continue;
      const b = await dataURLToBlob(j.blobs[id]); await idb.put("blobs", b, id); await queue({ op: "up", id });
    }
    let d = 0;
    for (const [c, docs] of Object.entries(j.docs)) for (const [id, data] of Object.entries(docs)) { await writeDoc(c, id, data, true); d++ }
    notifyAll(); flush();
    return { docs: d, photos: ids.length };
  }

  /* ---------- setup + sign-in ---------- */
  const SQL = `-- Rotation: run once in Supabase → SQL Editor
create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);
alter table public.docs enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;
drop policy if exists "own photos read" on storage.objects;
drop policy if exists "own photos add" on storage.objects;
drop policy if exists "own photos change" on storage.objects;
drop policy if exists "own photos remove" on storage.objects;
create policy "own photos read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos add" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos change" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos remove" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);`;

  let resolveReady; const ready = new Promise(r => resolveReady = r);
  // Resolves once this device has pulled the signed-in account's data (or gave up trying), so the app knows whether this is a brand-new user.
  let resolveFirst; const firstSync = new Promise(r => resolveFirst = r);
  let started = false;
  function makeClient(url, key) { return window.supabase.createClient(url.trim().replace(/\/+$/, ""), key.trim(), { auth: { persistSession: true, autoRefreshToken: true, storageKey: "rot-auth" } }) }

  async function copyText(t, btn) {
    try { await navigator.clipboard.writeText(t); btn.textContent = "Copied" }
    catch { const pre = $("su-sql"); const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected — copy it" }
    setTimeout(() => btn.textContent = "Copy setup code", 2200);
  }

  function showSetup(step, msg = "") {
    const el = $("setup"); el.hidden = false; document.body.classList.add("locked");
    const box = $("setup-body");
    if (step === "choose") {
      box.innerHTML = `<p class="label">Welcome</p><h2>Set up Rotation</h2>
        <p class="muted">Sync keeps your closet the same on your phone and laptop, using your own free Supabase project. You can also keep everything on this device and turn sync on later.</p>
        <div class="su-actions"><button class="btn" id="su-cloud">Set up sync</button><button class="btn ghost" id="su-local">Use on this device only</button></div>`;
      $("su-cloud").onclick = () => showSetup("keys");
      $("su-local").onclick = () => { cfg.mode = "local"; saveCfg(cfg); hideSetup(); start() };
    } else if (step === "keys") {
      box.innerHTML = `<p class="label">Step 1 of 2 · Connect Supabase</p><h2>Link your sync project</h2>
        <ol class="su-steps">
          <li>In your Supabase project, open <b>SQL Editor</b>, paste the setup code below and press <b>Run</b>. It makes a private table and a private photo folder only you can read.</li>
          <li>Open <b>Project Settings → API</b> (or <b>API Keys</b>) and copy the <b>Project URL</b> and the <b>publishable</b> (anon) key into the boxes below.</li>
        </ol>
        <div class="su-code"><pre id="su-sql"></pre><button class="btn ghost small" id="su-copy">Copy setup code</button></div>
        <div class="field"><label class="label" for="su-url">Project URL</label><input type="text" id="su-url" placeholder="https://abcd1234.supabase.co" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label class="label" for="su-key">Publishable (anon) key</label><input type="text" id="su-key" placeholder="sb_publishable_… or eyJ…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <p class="status" id="su-msg" aria-live="polite">${esc(msg)}</p>
        <div class="su-actions"><button class="btn" id="su-connect">Connect</button><button class="btn ghost" id="su-back">Back</button></div>`;
      $("su-sql").textContent = SQL;
      $("su-copy").onclick = e => copyText(SQL, e.target);
      $("su-url").value = cfg.url || ""; $("su-key").value = cfg.key || "";
      $("su-back").onclick = () => cfg.mode === "local" ? hideSetup() : showSetup("choose");
      $("su-connect").onclick = async () => {
        const url = $("su-url").value.trim(), key = $("su-key").value.trim();
        if (!/^https:\/\/.+/.test(url) || key.length < 20) { $("su-msg").textContent = "Paste both values from Project Settings → API."; return }
        $("su-msg").textContent = "Checking…";
        try {
          const c = makeClient(url, key);
          const { error } = await c.from("docs").select("id").limit(1);
          if (error && /does not exist|schema cache|relation/i.test(error.message)) { $("su-msg").textContent = "Connected, but the setup code hasn't been run yet. Run it in the SQL Editor, then press Connect again."; return }
          if (error && /permission denied/i.test(error.message)) { $("su-msg").textContent = "Connected, but the table isn't open to your account yet. Run the latest setup code again, then press Connect."; return }
          if (error && !/JWT|row-level/i.test(error.message)) { $("su-msg").textContent = "Supabase said: " + error.message; return }
          sb = c; cfg.url = url; cfg.key = key; saveCfg(cfg); showSetup("auth");
        } catch (e) { $("su-msg").textContent = "Couldn't reach that project. Check the URL and your connection." }
      };
    } else if (step === "choose-local") {
      showSetup("keys");
    } else if (step === "auth") {
      const preset = !!(window.ROTATION_CONFIG && window.ROTATION_CONFIG.url);
      box.innerHTML = `<p class="label">${preset ? "Your account" : "Step 2 of 2 · Your account"}</p><h2>${preset ? "Sign in or join" : "Sign in to sync"}</h2>
        <p class="muted">${preset ? "New here? Enter your email and a password, then tap Create account. Already have one? Sign in and your closet downloads from sync. Your closet is private to your account." : "This account lives in your own Supabase project. Use the same email and password on every device."}</p>
        <div class="field"><label class="label" for="su-email">Email</label><input type="text" id="su-email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label class="label" for="su-pass">Password</label><input type="password" id="su-pass" autocomplete="current-password"></div>
        <p class="status" id="su-msg" aria-live="polite">${esc(msg)}</p>
        <div class="su-actions"><button class="btn" id="su-in">Sign in</button><button class="btn ghost" id="su-up">Create account</button></div>
        ${preset ? "" : `<p class="muted" style="font-size:.85rem">After you create your account, turn off new sign-ups in Supabase (Authentication → Sign In / Providers → "Allow new users to sign up") so nobody else can use your project.</p>`}
        ${preset ? "" : `<button class="btn ghost small" id="su-change" style="align-self:flex-start">Use a different project</button>`}`;
      $("su-email").value = email || "";
      if ($("su-change")) $("su-change").onclick = () => showSetup("keys");
      const go = async up => {
        const em = $("su-email").value.trim(), pw = $("su-pass").value;
        if (!/.+@.+\..+/.test(em) || pw.length < 6) { $("su-msg").textContent = "Enter your email and a password of at least 6 characters."; return }
        $("su-msg").textContent = up ? "Creating your account…" : "Signing in…";
        const r = up ? await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + location.pathname } }) : await sb.auth.signInWithPassword({ email: em, password: pw });
        if (r.error) { $("su-msg").textContent = r.error.message; return }
        if (!r.data.session) { $("su-msg").textContent = "Account made. Open the confirmation link we just emailed you, then come back here and tap Sign in."; return }
        await linked(r.data.session);
      };
      $("su-in").onclick = () => go(false); $("su-up").onclick = () => go(true);
      $("su-pass").onkeydown = e => { if (e.key === "Enter") go(false) };
    }
  }
  function hideSetup() { $("setup").hidden = true; document.body.classList.remove("locked") }

  // Wipe everything cached on this device (used when a different person signs in, or on sign-out).
  async function wipeLocal() {
    await idb.clear("docs"); await idb.clear("blobs"); await idb.clear("outbox");
    M.clear(); for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); notifyAll();
  }
  let linking = null;
  function linked(session) {
    if (linking) return linking;
    linking = (async () => {
      const newUid = session.user.id;
      // Someone else used this device before: never mix their closet into this account.
      if (cfg.uid && cfg.uid !== newUid) { await wipeLocal(); delete cfg.geminiKey; delete cfg.geminiModel }
      const fromLocalOnly = cfg.mode === "local";
      const hasLocal = [...M.values()].some(m => m.size);
      uid = newUid; email = session.user.email || "";
      cfg.mode = "cloud"; cfg.uid = uid; saveCfg(cfg);
      if (fromLocalOnly && hasLocal) await queueEverything();
      hideSetup(); start(); await syncNow(); resolveFirst();
    })().finally(() => { linking = null });
    return linking;
  }

  function start() {
    if (started) { renderSettings(); paintPill(); return }
    started = true; resolveReady(); renderSettings(); paintPill();
    if (cfg.mode !== "cloud") resolveFirst();
  }

  async function boot() {
    await loadLocal();
    // A home-screen app on iPhone starts with empty storage, separate from Safari.
    // If config.js carries the project's public URL and key, skip straight to sign-in.
    const preset = window.ROTATION_CONFIG || {};
    if (!cfg.mode && preset.url && preset.key) { cfg = { ...cfg, mode: "cloud", url: preset.url, key: preset.key }; saveCfg(cfg) }
    if (!cfg.mode) { showSetup("choose"); return }
    if (cfg.mode === "local") { start(); return }
    try {
      sb = makeClient(cfg.url, cfg.key);
      const { data } = await sb.auth.getSession();
      if (data.session) { uid = data.session.user.id; email = data.session.user.email || ""; start(); syncNow().finally(resolveFirst); setTimeout(resolveFirst, 10000) }
      else if (M.size && cfg.uid) { start(); showSetup("auth", "Signed out. Sign in again to keep syncing.") }
      else showSetup("auth");
      sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_OUT") { uid = null; paintPill(); renderSettings() } else if (s && !uid && ev !== "INITIAL_SESSION") linked(s) });
    } catch (e) { start(); setSync("error", String(e)) }
  }

  addEventListener("online", () => { paintPill(); syncNow() });
  addEventListener("offline", paintPill);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow() });
  setInterval(() => { if (document.visibilityState === "visible") pull() }, 120000);

  /* ---------- settings panel (You tab) ---------- */
  function renderSettings() {
    const box = $("settings"); if (!box) return;
    const cloud = cfg.mode === "cloud";
    box.innerHTML = `<h2>Settings</h2>
      <div class="set-sec"><p class="label">Sync</p>
        <p>${cloud ? (uid ? `Signed in as <b>${esc(email || "you")}</b>. Your closet syncs with your Supabase project.` : "Signed out. Sign in to keep syncing.") : "Everything is saved on this device only."}</p>
        <p class="status" id="set-sync-msg">${syncState.s === "error" ? esc("Last sync error: " + syncState.msg) : ""}</p>
        <div class="row">${cloud ? (uid ? `<button class="btn ghost small" id="set-sync">Sync now</button><button class="btn ghost small" id="set-out">Sign out</button>` : `<button class="btn small" id="set-in">Sign in</button>`) : `<button class="btn small" id="set-cloud">Turn on sync</button>`}</div></div>
      <div class="set-sec"><p class="label">Smart features (optional)</p>
        <p class="muted">Everything works without this. Add a free Google Gemini key to turn on photo tagging, inspo reading, recreate-this-inspo and AI next-buy lists. Get a key at aistudio.google.com → Get API key. On Google's free tier, what you send (including photos) can be used to improve Google's products.</p>
        <div class="row"><div class="field"><label class="label" for="set-key">Gemini API key</label><input type="password" id="set-key" autocomplete="off" placeholder="${cfg.geminiKey ? "Saved · paste to replace" : "AIza…"}"></div>
          <div class="field"><label class="label" for="set-model">Model</label><input type="text" id="set-model" value="${esc(cfg.geminiModel || DEFAULT_MODEL)}" autocapitalize="off" spellcheck="false"></div></div>
        <p class="status" id="set-ai-msg">${cfg.geminiKey ? "Smart features are on." : "Smart features are off. The built-in stylist is running."}</p>
        <div class="row"><button class="btn small" id="set-ai-save">Save key</button>${cfg.geminiKey ? `<button class="btn ghost small" id="set-ai-test">Test it</button><button class="btn ghost small" id="set-ai-rm">Remove key</button>` : ""}</div></div>
      <div class="set-sec"><p class="label">Backup</p>
        <p class="muted">Download everything (pieces, pins, photos, fits) as one file, or add a backup file to this closet. Restoring adds to what's here and never deletes.</p>
        <p class="status" id="set-bk-msg" aria-live="polite"></p>
        <div class="row"><button class="btn ghost small" id="set-export">Download backup</button><label class="btn ghost small" style="position:relative">Restore from backup<input type="file" id="set-import" accept="application/json,.json" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div></div>
      <div class="set-sec"><p class="label">Put it on your home screen</p>
        <p class="muted"><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen. <b>Android:</b> in Chrome, open the ⋮ menu and tap Install app. It then opens full screen like any other app and works offline.</p></div>`;
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn };
    on("set-sync", () => syncNow());
    on("set-out", async () => {
      const b = $("set-out"); b.disabled = true;
      if (navigator.onLine) await flush();
      const left = (await idb.all("outbox")).length;
      if (left && !b.dataset.arm) {
        b.dataset.arm = "1"; b.disabled = false; b.textContent = "Sign out anyway";
        $("set-sync-msg").textContent = `${left} change${left > 1 ? "s haven't" : " hasn't"} synced yet. Signing out now deletes ${left > 1 ? "them" : "it"} from this device.`;
        return;
      }
      try { await sb?.auth.signOut() } catch {}
      await wipeLocal(); delete cfg.uid; delete cfg.geminiKey; delete cfg.geminiModel; saveCfg(cfg); location.reload();
    });
    on("set-in", () => showSetup("auth"));
    on("set-cloud", () => { if (!window.supabase) return; showSetup("keys") });
    on("set-ai-save", () => {
      const k = $("set-key").value.trim(), m = $("set-model").value.trim() || DEFAULT_MODEL;
      if (!k && !cfg.geminiKey) { $("set-ai-msg").textContent = "Paste your key first."; return }
      if (k) cfg.geminiKey = k; cfg.geminiModel = m; saveCfg(cfg);
      $("set-ai-msg").textContent = "Saved. Reloading to switch smart features on…"; setTimeout(() => location.reload(), 700);
    });
    on("set-ai-test", async () => {
      $("set-ai-msg").textContent = "Testing…";
      try { const r = await makeSample().json('Reply with only this JSON: {"ok": true}'); $("set-ai-msg").textContent = r.ok ? "Your key works." : "The key answered, but oddly. It should still work." }
      catch (e) { $("set-ai-msg").textContent = e.code === "bad_key" ? "Google rejected that key." : e.code === "bad_model" ? "That model name isn't available. Try another from Google's model list." : e.code === "rate_limited" ? "The key works, but today's free limit is used up." : "Couldn't reach Gemini: " + (e.message || e.code) }
    });
    on("set-ai-rm", () => { delete cfg.geminiKey; saveCfg(cfg); location.reload() });
    on("set-export", async () => {
      const m = $("set-bk-msg"); m.textContent = "Packing your closet…";
      try { const r = await exportBackup(t => m.textContent = t); m.textContent = `Backup saved: ${r.docs} records and ${r.photos} photos.` } catch (e) { m.textContent = "Couldn't make the backup: " + e.message }
    });
    const imp = $("set-import");
    if (imp) imp.onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return; const m = $("set-bk-msg"); m.textContent = "Reading backup…";
      try { const r = await importBackup(f, t => m.textContent = t); m.textContent = `Restored ${r.docs} records and ${r.photos} photos.${cfg.mode === "cloud" ? " Uploading to sync in the background." : ""}` }
      catch (err) { m.textContent = err.message || "That file couldn't be read." }
    };
  }

  /* ---------- public surface ---------- */
  window.claude = { use: async name => { await ready; return name === "db" ? db : name === "assets" ? assets : name === "sample" ? makeSample() : name === "shared" ? (cloudReady() ? sb : null) : null } };
  window.RP = { srcFor, getBlob, syncNow, renderSettings, firstSync, get aiOn() { return !!cfg.geminiKey } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
