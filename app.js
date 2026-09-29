/* Sap's Rotation — app */

const CATS=[["top","Tee / shirt"],["mid","Hoodie / knit"],["outer","Jacket / coat"],["bottom","Pants / shorts"],["shoes","Shoes"],["acc","Accessory"]];
const CATNAME=Object.fromEntries(CATS);
const VIBES=["grisch","streetwear","cozy"];
const VIBE_DEF="grisch = clean, preppy, polished European rich-kid look: down vests and puffers, fine knits (crewnecks, quarter-zips, knit polos), oxford shirts, light-wash or raw straight jeans, chinos or pleated trousers, white leather sneakers, loafers, boat shoes, suede or Chelsea boots, a good watch, small-logo caps; streetwear = heavyweight and graphic tees, hoodies and zip hoodies, work pants and baggy jeans, workwear jackets, track pants, statement or terrace sneakers, Timberland-style work boots, fitted caps, crossbody bags; cozy = fleece and sherpa, soft or cable knits, sweatpants and joggers, clogs, slippers and warm layers";
const S={items:[],inspo:[],fits:[],feedback:[],marks:[],gapfb:[],loaded:false,profile:null,gaps:null,body:null,filter:"all",tab:null,recreate:null,editing:null,pending:{flat:null,body:null},lastFits:[]};
let db=null,assets=null,sample=null,imgMax=0,ctl=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const src=id=>id?RP.srcFor(id):"";
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2600)}
function sampleErr(e){const c=e&&e.code;return c==="bad_key"||c==="not_granted"?"Google rejected your Gemini key. Check it in You → Settings.":c==="rate_limited"?"Today's free Gemini limit is used up. Try again tomorrow.":c==="bad_model"?"That Gemini model isn't available. Change it in You → Settings.":c==="invalid_json"?"The answer came back garbled. Try again.":c==="network"?"Couldn't reach Gemini. Check your connection.":c==="cancelled"?"Stopped.":"Gemini couldn't answer"+(e&&e.message?": "+e.message:".")}

/* ---------- tabs ---------- */
function setTab(t){const prev=S.tab;S.tab=t;for(const b of document.querySelectorAll(".tab"))b.setAttribute("aria-selected",b.dataset.tab===t);
  for(const v of ["make","closet","buys","brands","inspo","you","saved"])$("view-"+v).hidden=v!==t;
  if(t==="brands")renderBrands();if(t==="buys")maybeAutoRefresh();
  if(t==="you")openYou();else if(prev==="you")closeYou();}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));

/* ---------- closet ---------- */
$("f-cat").innerHTML=CATS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
$("f-vibes").innerHTML=VIBES.map(v=>`<label class="chip"><input type="checkbox" value="${v}" id="fv-${v}">${v}</label>`).join("");
function renderFilters(){const opts=[["all","All"],...CATS.map(([v,l])=>[v,l.split(" /")[0]]),["wash","In wash"]];
  $("c-filters").innerHTML=opts.map(([v,l])=>`<button data-f="${v}" aria-pressed="${S.filter===v}">${esc(l)}</button>`).join("");
  $("c-filters").querySelectorAll("button").forEach(b=>b.onclick=()=>{S.filter=b.dataset.f;renderCloset()});}
function tagCard(it){return `<button class="tagcard${it.wash?" wash":""}" data-id="${esc(it.id)}"><span class="hole"></span>${it.wash?'<span class="flag">In wash</span>':""}${it.body?'<span class="bodydot">On-body ✓</span>':""}
  <span class="ph">${it.flat?`<img src="${src(it.flat)}" alt="" loading="lazy">`:it.body?`<img src="${src(it.body)}" alt="" loading="lazy">`:`<span class="none">No photo yet</span>`}</span>
  <span class="meta"><span class="label">${esc(CATNAME[it.cat]||it.cat)} · ${esc(it.sil)} · ${esc(it.len)}</span><span class="name">${esc(it.name)}</span><span class="muted" style="font-size:.85rem">${esc(it.color||"")}</span></span></button>`}
function renderCloset(){renderFilters();$("n-closet").textContent=S.items.length;
  const box=$("c-body");
  if(!S.items.length){box.innerHTML=`<div class="empty"><h3>Your closet is empty</h3><p>Add each piece with a photo. The tags and "how it fits you" notes are what the fit maker reasons from, so it's worth a few seconds per item.</p>
    <p class="label">Photo tips</p><ul><li>Flat-lay on a bed or floor, or on a hanger against a plain wall. Daylight from a window, no flash.</li>
    <li>No full-length mirror? Prop your phone at waist height, use the 10-second timer, and stand 6–8 ft back.</li>
    <li>On-body shots matter most for pants, jackets, and anything cropped or oversized.</li></ul></div>`;return}
  const list=S.items.filter(i=>S.filter==="all"?true:S.filter==="wash"?i.wash:i.cat===S.filter);
  box.innerHTML=list.length?`<div class="grid">${list.map(tagCard).join("")}</div>`:`<p class="muted">Nothing here yet.</p>`;
  box.querySelectorAll(".tagcard").forEach(b=>b.onclick=()=>openSheet(S.items.find(i=>i.id===b.dataset.id)));}

async function shrink(file,max=1600){try{const bmp=await createImageBitmap(file);const s=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas");c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",.85));}catch{return file}}
async function blobFor(id){try{return await RP.getBlob(id)}catch{return null}}

function setPreview(kind,url){const im=$("p-"+kind);if(url){im.src=url;im.hidden=false}else{im.removeAttribute("src");im.hidden=true}}
function openSheet(it){S.editing=it||null;S.pending={flat:null,body:null};$("f").reset();
  $("f-title").textContent=it?"Edit piece":"Add a piece";$("f-del").hidden=!it;$("f-del").textContent="Delete piece";$("f-del").dataset.arm="";
  $("f-status").textContent="";
  if(it){$("f-name").value=it.name||"";$("f-cat").value=it.cat||"top";$("f-color").value=it.color||"";$("f-sil").value=it.sil||"regular";
    $("f-len").value=it.len||"regular";$("f-warm").value=String(it.warmth||2);$("f-fit").value=it.fitNotes||"";$("f-notes").value=it.notes||"";$("f-wash").checked=!!it.wash;
    VIBES.forEach(v=>$("fv-"+v).checked=(it.vibes||[]).includes(v));}
  setPreview("flat",it?.flat&&src(it.flat));setPreview("body",it?.body&&src(it.body));
  $("f-auto").hidden=!sample;$("sheet").hidden=false;}
$("c-add").onclick=()=>openSheet(null);
$("f-close").onclick=()=>$("sheet").hidden=true;
$("sheet").addEventListener("click",e=>{if(e.target.id==="sheet")$("sheet").hidden=true});
for(const k of ["flat","body"])$("f-"+k).onchange=async e=>{const f=e.target.files[0];if(!f)return;const b=await shrink(f);S.pending[k]=b;setPreview(k,URL.createObjectURL(b));};

$("f-auto").onclick=async()=>{
  const flat=S.pending.flat||(S.editing?.flat&&await blobFor(S.editing.flat));const body=S.pending.body||(S.editing?.body&&await blobFor(S.editing.body));
  const imgs=[flat,body].filter(Boolean);if(!imgs.length){$("f-status").textContent="Add a photo first.";return}
  $("f-status").textContent="Looking at the photos…";$("f-auto").disabled=true;
  const desc=flat&&body?`Image 1 is the item laid flat or on a hanger. Image 2 is the item worn by its owner (a man; ${bodyText()}).`:flat?"The image is the item laid flat or on a hanger.":`The image shows the item worn by its owner (a man; ${bodyText()}).`;
  try{const r=await sample.json(`You tag clothing for a personal wardrobe app. ${desc}
Reply with only a JSON object:
{"name": short descriptive name like "Washed black boxy hoodie",
 "cat": one of ${JSON.stringify(CATS.map(c=>c[0]))} (top=tee/shirt, mid=hoodie/sweater/knit, outer=jacket/coat, acc=hat/bag/jewelry/belt),
 "color": plain color description,
 "sil": one of ["slim","regular","relaxed","oversized"],
 "len": one of ["cropped","regular","long"],
 "warmth": 1, 2 or 3,
 "vibes": subset of ["grisch","streetwear","cozy"] (${VIBE_DEF}),
 "fitNotes": ${body?"one or two sentences on how it sits on his body: where hems land, drape, shoulder fit, leg shape, stacking":"\"\""}}`,{images:imgs.slice(0,imgMax||2)});
    if(r.name)$("f-name").value=r.name;if(CATNAME[r.cat])$("f-cat").value=r.cat;if(r.color)$("f-color").value=r.color;
    if(["slim","regular","relaxed","oversized"].includes(r.sil))$("f-sil").value=r.sil;if(["cropped","regular","long"].includes(r.len))$("f-len").value=r.len;
    if([1,2,3].includes(+r.warmth))$("f-warm").value=String(+r.warmth);
    if(Array.isArray(r.vibes))VIBES.forEach(v=>$("fv-"+v).checked=r.vibes.includes(v));
    if(r.fitNotes&&!$("f-fit").value)$("f-fit").value=r.fitNotes;
    $("f-status").textContent="Filled in. Fix anything that's off.";
  }catch(e){$("f-status").textContent=sampleErr(e)}finally{$("f-auto").disabled=false}};

$("f").onsubmit=async e=>{e.preventDefault();if(!db){toast("Can't save in this view.");return}
  const btn=$("f-save");btn.disabled=true;btn.textContent="Saving…";
  try{const it=S.editing||{};const data={name:$("f-name").value.trim(),cat:$("f-cat").value,color:$("f-color").value.trim(),sil:$("f-sil").value,len:$("f-len").value,
      warmth:+$("f-warm").value,vibes:VIBES.filter(v=>$("fv-"+v).checked),fitNotes:$("f-fit").value.trim(),notes:$("f-notes").value.trim(),wash:$("f-wash").checked,
      flat:it.flat||null,body:it.body||null,created:it.created||Date.now()};
    for(const k of ["flat","body"])if(S.pending[k]){if(!assets)throw{msg:"Photo uploads aren't available in this view."};const up=await assets.upload(S.pending[k],{type:"image/jpeg"});data[k]=up.id;}
    const ref=it.id?db.doc("items/"+it.id):db.collection("items").doc();await ref.set(data);
    $("sheet").hidden=true;toast(it.id?"Piece updated":"Added to closet");
  }catch(err){toast(err.msg||(err.code==="quota_or_state"?"Photo storage is full.":"Couldn't save. Try again."))}finally{btn.disabled=false;btn.textContent="Save piece"}};
$("f-del").onclick=async()=>{const b=$("f-del");if(!b.dataset.arm){b.dataset.arm="1";b.textContent="Tap again to delete";return}
  const it=S.editing;if(!it||!db)return;try{await db.doc("items/"+it.id).delete();for(const k of ["flat","body"])if(it[k]&&assets)await assets.delete(it[k]).catch(()=>{});
  $("sheet").hidden=true;toast("Deleted");}catch{toast("Couldn't delete.")}};

/* ---------- inspo ---------- */
function renderInspo(){$("n-inspo").textContent=S.inspo.length;$("i-build").hidden=!sample;
  const g=$("i-grid");
  g.innerHTML=S.inspo.length?S.inspo.map(p=>`<div class="inspo-card"><div class="ph"><img src="${src(p.img)}" alt="Inspiration image" loading="lazy"></div>
    ${(p.tags||[]).length?`<div class="pin-tags">${p.tags.map(k=>`<span class="chip">${esc(PIECE[k]?.short||k)}</span>`).join("")}</div>`:""}
    <div class="row" style="gap:6px"><button class="btn ghost small" data-tag="${esc(p.id)}">${(p.tags||[]).length?"Edit tags":"Tag pieces"}</button><button class="btn ghost small" data-re="${esc(p.id)}">Recreate</button><button class="btn ghost small" data-rm="${esc(p.id)}">Remove</button></div></div>`).join("")
    :`<div class="empty"><h3>No inspo yet</h3><p>Save fits you like from Pinterest, Instagram or TikTok as screenshots and add them here. Tap "Tag pieces" on each one so Next buys learns what you save.</p></div>`;
  g.querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>openTagSheet(S.inspo.find(p=>p.id===b.dataset.tag)));
  g.querySelectorAll("[data-re]").forEach(b=>b.onclick=()=>{S.recreate=S.inspo.find(p=>p.id===b.dataset.re);renderRecreate();setTab("make")});
  g.querySelectorAll("[data-rm]").forEach(b=>b.onclick=async()=>{if(!b.dataset.arm){b.dataset.arm=1;b.textContent="Sure?";return}
    const p=S.inspo.find(x=>x.id===b.dataset.rm);try{await db.doc("inspo/"+p.id).delete();if(assets)await assets.delete(p.img).catch(()=>{})}catch{toast("Couldn't remove.")}});
  const pr=S.profile,box=$("i-profile");
  if(!pr){box.innerHTML=tagSummary()||`<p class="muted">No profile yet. Add inspo images and tag the pieces in each one${sample?', or tap "Read my inspo"':""}.</p>`;return}
  const list=a=>(a||[]).length?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p class="muted">–</p>`;
  box.innerHTML=`<p>${esc(pr.summary)}</p><div class="profile">
    <div><span class="label">Palette</span>${list(pr.palette)}</div>
    <div><span class="label">Silhouettes you save</span>${list(pr.silhouettes)}</div>
    <div><span class="label">Recurring pieces</span>${list(pr.pieces)}</div>
    <div><span class="label">Gaps in your closet</span>${list(pr.gaps)}</div>
    ${VIBES.map(v=>pr.vibes?.[v]?`<div><span class="label">Your ${v}</span><p>${esc(pr.vibes[v])}</p></div>`:"").join("")}</div>
    <p class="label">Read ${new Date(pr.at).toLocaleDateString()} from ${pr.n} images</p>`;}
$("i-file").onchange=async e=>{const files=[...e.target.files];e.target.value="";if(!files.length)return;if(!db||!assets){toast("Uploads aren't available in this view.");return}
  $("i-status").textContent=`Adding ${files.length} image${files.length>1?"s":""}…`;
  for(const f of files){try{const up=await assets.upload(await shrink(f,1400),{type:"image/jpeg"});await db.collection("inspo").doc().set({img:up.id,created:Date.now()})}catch{toast("One image didn't upload.")}}
  $("i-status").textContent="";};
function closetText(items){return items.map(i=>`${i.id} | ${i.name} | ${CATNAME[i.cat]||i.cat} | ${i.color} | ${i.sil}, ${i.len} | warmth ${i.warmth} | vibes: ${(i.vibes||[]).join("/")||"-"}${i.fitNotes?` | fit on him: ${i.fitNotes}`:""}${i.notes?` | note: ${i.notes}`:""}`).join("\n")}
async function readInspo(){
  const pick=S.inspo.slice(0,imgMax||20);
  const pairs=(await Promise.all(pick.map(async p=>[p,await blobFor(p.img)]))).filter(x=>x[1]);const blobs=pairs.map(x=>x[1]);
  const r=await sample.json(`These ${blobs.length} images are outfit inspiration saved by a young man (${bodyText()}) who rotates between three vibes. ${VIBE_DEF}. ${TASTE} He wants reasonably priced, long-lasting pieces.
Build his style profile from what repeats across the images. Then compare against his current closet and name gaps.

His closet:
${closetText(S.items)||"(empty so far)"}

Reply with only JSON:
{"summary": 2 sentences on his taste,
 "palette": up to 6 color descriptions,
 "silhouettes": up to 5 proportion patterns (e.g. "boxy cropped top over wide straight pants"),
 "pieces": up to 6 recurring garment types,
 "vibes": {"grisch": one sentence, "streetwear": one sentence, "cozy": one sentence} (omit a vibe that doesn't show up),
 "gaps": up to 5 specific pieces the inspo relies on that his closet lacks, most useful first,
 "pinTags": one list per image, in the same order as the images, of the keys from this list that appear in that image: ${PIECES.map(p=>p.key).join(", ")}}`,{images:blobs,modelTier:"complex"});
  const {pinTags,...prof}=r;
  if(Array.isArray(pinTags))for(let i=0;i<pairs.length;i++){const p=pairs[i][0],t=(pinTags[i]||[]).filter(k=>PIECE[k]);if(t.length&&!(p.tags||[]).length){const {id,...rest}=p;db.doc("inspo/"+id).set({...rest,tags:t})}}
  const doc={...prof,n:blobs.length,at:Date.now(),sig:inspoSig()};await db.collection("profile").doc().set(doc);return doc}
$("i-build").onclick=async()=>{if(!sample){$("i-status").textContent="Add a free Gemini key in You → Settings to read pins automatically. Until then, tag the pieces on each pin.";return}
  if(S.inspo.length<3){$("i-status").textContent="Add at least 3 inspo images first.";return}
  $("i-build").disabled=true;$("i-status").textContent="Reading your inspo… this can take a minute.";
  try{await readInspo();$("i-status").textContent="Profile updated. Next buys will refresh the next time you open it."}
  catch(e){$("i-status").textContent=e.code?sampleErr(e):"Couldn't save the profile."}finally{$("i-build").disabled=false}};

/* ---------- make ---------- */
function renderRecreate(){const r=S.recreate;$("m-recreate").hidden=!r;if(r)$("m-recreate-img").src=src(r.img);$("m-go").textContent=r?"Recreate it":"Make 3 fits"}
$("m-recreate-x").onclick=()=>{S.recreate=null;renderRecreate()};
function itemFig(id){const it=S.items.find(i=>i.id===id);if(!it)return"";const im=it.flat||it.body;
  return `<figure><div class="ph">${im?`<img src="${src(im)}" alt="">`:`<span class="label" style="padding:6px;text-align:center">${esc(CATNAME[it.cat]||"")}</span>`}</div><figcaption>${esc(it.name)}</figcaption></figure>`}
function fitCard(f,i,mode){const voted=f.vote;return `<article class="fit"><div class="row" style="justify-content:space-between;align-items:baseline"><h3>${esc(f.title)}</h3>${f.vibe?`<span class="chip">${esc(f.vibe)}</span>`:""}</div>
  <div class="fitgrid">${boardHTML(f.items)}<div class="fit-detail">${piecesHTML(f.items)}
  ${f.why?`<p>${esc(f.why)}</p>`:""}${f.proportion?`<p class="muted" style="font-size:.92rem"><span class="label">Proportion</span> ${esc(f.proportion)}</p>`:""}
  ${f.missing?`<p class="muted" style="font-size:.92rem"><span class="label">Missing vs. inspo</span> ${esc(f.missing)}</p>`:""}
  <button class="btn ghost small" style="align-self:flex-start" data-mq="${mode==="new"?i:esc(f.id)}">View on mannequin</button></div></div>
  ${mode==="new"?`<div class="votes"><button class="btn ghost small ${voted===1?"voted-up":""}" data-v="1" data-i="${i}">Good fit</button><button class="btn ghost small ${voted===-1?"voted-down":""}" data-v="-1" data-i="${i}">Not it</button><button class="btn ghost small" data-save="${i}">${f.saved?"Saved":"Save"}</button></div>`
  :`<div class="votes"><button class="btn ghost small" data-unsave="${esc(f.id)}">Remove</button></div>`}</article>`}
function renderFits(){const o=$("m-out");o.innerHTML=S.lastFits.map((f,i)=>fitCard(f,i,"new")).join("");
  o.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const f=S.lastFits[+b.dataset.mq];openMannequin(f.items,f.title)});
  o.querySelectorAll("[data-v]").forEach(b=>b.onclick=async()=>{const f=S.lastFits[+b.dataset.i];f.vote=+b.dataset.v;renderFits();
    if(db)try{await db.doc("feedback/"+f.key).set({title:f.title,items:f.items,vote:f.vote,at:Date.now()})}catch{}});
  o.querySelectorAll("[data-save]").forEach(b=>b.onclick=async()=>{const f=S.lastFits[+b.dataset.save];if(f.saved||!db)return;
    try{await db.doc("fits/"+f.key).set({title:f.title,items:f.items,why:f.why||"",proportion:f.proportion||"",vibe:f.vibe||"",at:Date.now()});f.saved=true;renderFits();toast("Saved")}catch{toast("Couldn't save.")}});}
function fallbackFits(pool,temp,wx,vibe){
  const wet=wx==="Rain"||wx==="Snow";
  const okV=i=>vibe==="any"||!(i.vibes||[]).length||(i.vibes||[]).includes(vibe);
  const wide=i=>i.sil==="oversized"||i.sil==="relaxed";
  const txt=i=>((i.fitNotes||"")+" "+(i.notes||"")+" "+(i.name||"")).toLowerCase();
  const pick=c=>pool.filter(i=>i.cat===c&&okV(i));
  let bottoms=pick("bottom"),shoes=pick("shoes"),tops=pick("top"),mids=pick("mid"),outers=pick("outer");
  if(!bottoms.length)bottoms=pool.filter(i=>i.cat==="bottom");
  if(!shoes.length)shoes=pool.filter(i=>i.cat==="shoes");
  if(wet){const isDry=i=>/waterproof|rain|snow/.test(txt(i))||i.warmth>=3;let dry=shoes.filter(isDry);if(!dry.length)dry=pool.filter(i=>i.cat==="shoes"&&isDry(i));if(dry.length)shoes=dry;}
  if(!mids.length)mids=pool.filter(i=>i.cat==="mid");
  if(!outers.length)outers=pool.filter(i=>i.cat==="outer");
  const needOuter=temp<55||wet, heavy=temp<40, needMid=temp<68||!tops.length;
  if(heavy){const h=outers.filter(i=>i.warmth>=3);if(h.length)outers=h;}
  else if(temp>=50){const l=outers.filter(i=>i.warmth<=2);if(l.length)outers=l;}
  const tOpts=tops.length?tops:[null], mOpts=needMid&&mids.length?mids:[null], oOpts=needOuter&&outers.length?outers:[null];
  const BF=bodyFlags();
  const liked=S.feedback.filter(f=>f.vote===1).map(f=>f.items), nope=S.feedback.filter(f=>f.vote===-1).map(f=>f.items);
  const combos=[];
  for(const b of bottoms)for(const sh of shoes)for(const t of tOpts)for(const m of mOpts)for(const o of oOpts){
    const upper=[t,m,o].filter(Boolean);if(!upper.length)continue;
    const outerMost=o||m||t;let sc=Math.random()*1.5;const why=[],prop=[];
    const shortTop=upper.some(i=>i.len==="cropped")||(outerMost&&outerMost.sil==="oversized");
    if(wide(b)&&shortTop){sc+=3;prop.push("the short, boxy top half balances the wide leg");}
    if(wide(b)&&!shortTop){sc+=1;}
    if(!wide(b)&&outerMost&&outerMost.sil==="oversized"){sc-=1.5;}
    const loafer=/loafer/.test(txt(sh)),boot=sh.warmth>=3||/boot/.test(txt(sh));
    if(boot&&wide(b)){sc+=2;prop.push("the wide jeans stack over the chunky boots");}
    if(loafer&&b.sil==="slim"){sc+=1.5;prop.push("the slimmer leg keeps the loafers visible");}
    if(loafer&&b.sil==="oversized"){sc+=1;prop.push("wide denim pooling over loafers, like the inspo");}
    if(loafer&&(o&&o.warmth>=3)){sc-=1;}
    if(t&&m&&t.len!=="cropped"&&m.len==="cropped"){sc+=1.5;prop.push("the longer tee shows under the cropped layer");}
    if(BF){const vol=upper.filter(i=>i.sil==="oversized").length+(b.sil==="oversized"?1:0);
      if(BF.big&&vol>=3)sc-=2.5;if(BF.big&&outerMost&&outerMost.sil==="oversized"&&b.sil==="oversized")sc-=1;
      if(BF.short&&b.sil==="oversized"&&!shortTop)sc-=1.5;if(BF.short&&shortTop){sc+=.5;prop.push("the shorter top half keeps your legs looking longer");}
      if(BF.tall&&upper.length>=2)sc+=.5;if(BF.slim&&upper.length>=2){sc+=.5;prop.push("layering adds shape to a slimmer frame");}
      if(BF.longTorso&&shortTop){sc+=1;prop.push("the cropped layer evens out a longer torso");}
      if(BF.longLegs&&outerMost&&outerMost.len!=="cropped")sc+=.5;}
    const vs=[b,sh,...upper].map(i=>i.vibes||[]);
    if(vibe!=="any")sc+=vs.filter(v=>v.includes(vibe)).length*0.5;
    const cols=[b,sh,...upper].map(i=>(i.color||"").toLowerCase());
    if(cols.filter(c=>/black/.test(c)).length>=4)sc-=1;
    if(cols.some(c=>/khaki|tan|sand|wheat/.test(c))&&cols.some(c=>/light|bleach/.test(c)))sc+=0.5;
    const ids=[t,m,o,b,sh].filter(Boolean).map(i=>i.id);
    for(const L of liked){const ov=ids.filter(x=>L.includes(x)).length;if(ov>=3)sc+=1.5;}
    for(const N of nope){const ov=ids.filter(x=>N.includes(x)).length;if(ov>=3)sc-=3;}
    if(needOuter&&o)why.push(heavy?"the down jacket handles the cold":"a light jacket for "+(wet?wx.toLowerCase():temp+"°F"));
    if(wet&&boot)why.push("waterproof boots for the "+wx.toLowerCase());
    if(!needOuter&&m)why.push("a single layer is enough at "+temp+"°F");
    const vc={};vs.flat().forEach(v=>vc[v]=(vc[v]||0)+1);const top=Object.entries(vc).sort((a,b)=>b[1]-a[1])[0];
    combos.push({sc,ids,b:b.id,upperKey:(o||m||t).id,vibe:vibe!=="any"?vibe:(top?top[0]:""),why,prop});
  }
  combos.sort((a,b)=>b.sc-a.sc);
  const out=[],usedB={},usedU={};
  for(const c of combos){if(out.length>=3)break;if(usedB[c.b]&&usedU[c.upperKey])continue;if(out.some(f=>f.items.join()===c.ids.join()))continue;
    usedB[c.b]=1;usedU[c.upperKey]=1;
    const names=c.ids.map(id=>S.items.find(i=>i.id===id)?.name||"");
    out.push({title:["Today's pick","Second option","Wildcard"][out.length],vibe:c.vibe,items:c.ids,
      why:(w=>w.charAt(0).toUpperCase()+w.slice(1))(c.why.length?c.why.join("; "):"matched to today's weather and your vibe")+".",
      proportion:c.prop.length?c.prop[0].charAt(0).toUpperCase()+c.prop[0].slice(1)+".":""});}
  return out;}
$("m-stop").onclick=()=>ctl?.abort();
$("m-go").onclick=async()=>{const pool=S.items.filter(i=>!i.wash);const temp=+$("m-temp").value||60,wx=$("m-wx").value,vibe=$("m-vibe").value,plan=$("m-plan").value.trim();
  if(pool.length<3){$("m-status").textContent="Add at least a top, bottoms and shoes to your closet first.";return}
  if(!sample){S.lastFits=fallbackFits(pool,temp,wx,vibe).map(f=>({...f,key:"f"+Date.now()+Math.random().toString(36).slice(2,6)}));renderFits();
    $("m-status").textContent=(S.recreate?"Recreating a pin needs a Gemini key (You → Settings). These are your best fits for today instead. ":"Built-in stylist: matched on weather, vibe and proportions. ")+"Rate them so it learns.";return}
  const liked=S.feedback.filter(f=>f.vote===1).slice(0,12),nope=S.feedback.filter(f=>f.vote===-1).slice(0,12);
  const names=ids=>ids.map(id=>S.items.find(i=>i.id===id)?.name).filter(Boolean).join(" + ");
  const pr=S.profile;const recreate=S.recreate;
  let imgs=[];if(recreate&&imgMax){const b=await blobFor(recreate.img);if(b)imgs=[b]}
  const prompt=`You're styling a young man (a college student in Chicago) from clothes he already owns. ${bodyText()} Use his build to judge how much volume and layering flatters him, and where cropped vs longer layers and wide vs straight legs work best on his frame. Fit and proportion matter more than genre labels: use each piece's silhouette, length and "fit on him" notes to balance proportions (e.g. wide or long bottoms with shorter or boxier tops, intentional layering lengths, how pants break on the shoes).
${pr?`His style profile from saved inspo: ${pr.summary} Silhouettes he likes: ${(pr.silhouettes||[]).join("; ")}. Palette: ${(pr.palette||[]).join(", ")}.${VIBES.map(v=>pr.vibes?.[v]?` His ${v}: ${pr.vibes[v]}`:"").join("")}`:""}
${liked.length?`Fits he liked: ${liked.map(f=>names(f.items)).join(" | ")}`:""}
${nope.length?`Fits he rejected: ${nope.map(f=>names(f.items)).join(" | ")}`:""}
Vibe definitions: ${VIBE_DEF}.
Today: ${temp}°F, ${wx}.${plan?` Plans: ${plan}.`:""}${recreate?" The attached image is an inspo outfit: recreate it as closely as possible with his clothes.":` Vibe: ${vibe==="any"?"any of grisch / streetwear / cozy, vary them":vibe}.`}

Closet (id | name | type | color | silhouette, length | warmth 1-3 | vibes | notes). Use ONLY these ids:
${closetText(pool)}

Reply with only JSON: {"fits":[{"title": 2-4 word name, "vibe": "grisch"|"streetwear"|"cozy", "items": [ids], "why": one sentence on why it works today, "proportion": one sentence on how the pieces balance on his body${recreate?`, "missing": what the inspo has that his closet can't match, or ""`:""}}]}
${recreate?"Give 2 fits.":"Give 3 distinct fits."} Each fit needs something on top, a bottom and shoes, plus a jacket or coat when it's under about 55°F or wet. Dress for the weather.`;
  ctl=new AbortController();$("m-go").disabled=true;$("m-stop").hidden=false;$("m-status").textContent="Thinking…";
  try{const r=await sample.json(prompt,Object.assign({signal:ctl.signal,cache:false},imgs.length?{images:imgs}:{}));
    const valid=new Set(pool.map(i=>i.id));
    S.lastFits=(r.fits||[]).map(f=>({...f,items:(f.items||[]).filter(id=>valid.has(id)),key:"f"+Date.now()+Math.random().toString(36).slice(2,6)})).filter(f=>f.items.length);
    renderFits();$("m-status").textContent=S.lastFits.length?"Rate them so the next batch gets closer.":"No usable fits came back. Try again.";
  }catch(e){if(e&&e.code==="cancelled"){$("m-status").textContent="Stopped.";}
    else{S.lastFits=fallbackFits(pool,temp,wx,vibe).map(f=>({...f,key:"f"+Date.now()+Math.random().toString(36).slice(2,6)}));renderFits();
      $("m-status").textContent=sampleErr(e)+" These fits came from the built-in stylist instead. Rate them so it learns.";}}finally{$("m-go").disabled=false;$("m-stop").hidden=true}};

/* ---------- brand atlas link ---------- */
// [style, category, brand, tier, type, note]
const ATLAS=[["grisch","Garments","Moncler",3,"Buy used","The reference puffer and vest. Authenticated resale is often 40–60% off."],["grisch","Garments","Canada Goose",3,"Tested","Heavy parkas and lighter down jackets for real cold."],["grisch","Garments","Colmar",3,"Niche","Italian puffers with the Moncler look at a lower price."],["grisch","Garments","Herno",3,"Niche","Italian down, very refined, quiet logos."],["grisch","Garments","Peuterey",3,"Niche","Italian outerwear, glossy puffers and vests."],["grisch","Garments","Save the Duck",2,"Rising","Animal-free puffers with a clean, shiny finish."],["grisch","Garments","Rains",2,"Rising","Danish minimal puffers and rain jackets."],["grisch","Garments","Uniqlo Ultra Light Down",1,"Tested","Cheapest way to get the vest look."],["grisch","Garments","Patagonia Down Sweater",2,"Tested","Durable down vest and jacket; lifetime repairs."],["grisch","Garments","Arc'teryx Cerium",3,"Tested","Light, technical down that reads premium."],["grisch","Garments","Polo Ralph Lauren",2,"Tested","Knits, polos, hoodies and caps. Cheapest at RL Factory outlets."],["grisch","Garments","Lacoste",2,"Tested","Polos and knits with a small logo."],["grisch","Garments","Gant",2,"Tested","Preppy Swedish-American knits and shirts."],["grisch","Garments","Tommy Hilfiger",1,"Tested","Preppy basics, frequently on sale."],["grisch","Garments","Brooks Brothers",2,"Tested","Oxford shirts and knits, the American original."],["grisch","Garments","Massimo Dutti",2,"Tested","The best 'looks expensive' brand for this style."],["grisch","Garments","Arket",2,"Rising","Scandinavian basics, overshirts and knits."],["grisch","Garments","COS",2,"Tested","Minimal knits and clean outerwear."],["grisch","Garments","Quince",1,"Rising","Real cashmere and merino at low prices."],["grisch","Garments","Naadam",2,"Rising","Cashmere crewnecks and quarter-zips."],["grisch","Garments","J.Crew",2,"Tested","Cashmere and cotton knits; wait for sales."],["grisch","Garments","Suitsupply",2,"Tested","Fine-gauge knits and turtlenecks at fair prices."],["grisch","Garments","Reiss",2,"Tested","Polished British menswear, knits and jackets."],["grisch","Garments","Scotch & Soda",2,"Tested","Dutch brand, sharp knits and denim."],["grisch","Garments","Les Deux",2,"Rising","Danish preppy basics popular with this crowd."],["grisch","Garments","Morris Stockholm",2,"Niche","Scandinavian preppy knits and shirts."],["grisch","Garments","Sunspel",3,"Niche","British tees and polos that last for years."],["grisch","Garments","Percival",2,"Niche","London knits and shirts with small details."],["grisch","Garments","Todd Snyder",3,"Tested","American knits and jackets; good sales."],["grisch","Garments","Hackett London",3,"Tested","British preppy knits and quarter-zips."],["grisch","Garments","Ami Paris",3,"Rising","The small heart-logo knits and tees."],["grisch","Garments","Stone Island",3,"Buy used","Overshirts and jackets with the compass badge; easy to find on Grailed."],["grisch","Garments","C.P. Company",3,"Tested","Stone Island's sister brand, goggle jackets and overshirts."],["grisch","Garments","Levi's 501 / 568",1,"Tested","Light-wash or grey straight jeans."],["grisch","Garments","Nudie Jeans",2,"Tested","Straight jeans with free lifetime repairs."],["grisch","Garments","A.P.C.",3,"Tested","Classic raw and washed denim."],["grisch","Garments","Abercrombie 90s Straight",1,"Rising","Surprisingly good fit for the price."],["grisch","Garments","Uniqlo Selvedge Jeans",1,"Tested","Budget selvedge denim."],["grisch","Shoes","Golden Goose",3,"Buy used","Distressed Superstars from the reference photos."],["grisch","Shoes","Philippe Model",3,"Niche","French low-tops; check Nordstrom Rack and resale."],["grisch","Shoes","Valentino Open",3,"Buy used","White sneaker with the stripe; buy on resale."],["grisch","Shoes","Common Projects Achilles",3,"Tested","The minimalist white sneaker benchmark."],["grisch","Shoes","Axel Arigato Clean 90",2,"Rising","Very on-trend for this look."],["grisch","Shoes","Koio",2,"Rising","Italian-made leather sneakers under Common Projects' price."],["grisch","Shoes","Oliver Cabell",2,"Rising","Italian-made, clean designs, good value."],["grisch","Shoes","Filling Pieces",2,"Rising","Dutch sneaker brand popular in this scene."],["grisch","Shoes","National Standard",2,"Niche","French-made minimalist sneakers."],["grisch","Shoes","Diemme",3,"Niche","Italian suede sneakers and boots."],["grisch","Shoes","Veja",2,"Rising","V-10 and Campo in white leather."],["grisch","Shoes","Adidas Stan Smith",1,"Tested","The budget white-sneaker classic."],["grisch","Shoes","Lacoste Carnaby",1,"Tested","Cheap white leather sneaker with a small logo."],["grisch","Shoes","Clae",1,"Niche","Affordable clean leather sneakers."],["grisch","Shoes","G.H. Bass Weejuns",1,"Tested","Penny loafers for dressier days."],["grisch","Shoes","Sebago Docksides",1,"Tested","Boat shoes for summer."],["grisch","Shoes","Tod's",3,"Tested","Driving loafers, the old-money staple."],["grisch","Shoes","Paraboot",3,"Niche","French leather shoes that last decades."],["grisch","Boots","R.M. Williams Comfort Craftsman",3,"Tested","The Australian Chelsea boot; resoleable and lasts decades."],["grisch","Boots","Thursday Boot Co. Duke / Captain",2,"Rising","Clean Chelsea and lace-up boots at a fair price."],["grisch","Boots","Beckett Simonon Chelsea",2,"Rising","Made-to-order, Goodyear-welted, good value."],["grisch","Boots","Clarks Desert Boot",1,"Tested","Suede chukka; easy with straight jeans and a knit."],["grisch","Boots","Paraboot Avoriaz",3,"Niche","French Norwegian-welt mountain boot, very European."],["grisch","Boots","Diemme Roccia Vet",3,"Niche","Italian suede hiker, the grisch winter boot."],["grisch","Boots","Grenson",3,"Niche","British Goodyear-welted brogue boots and Chelseas."],["grisch","Accessories","Tissot PRX",2,"Tested","The go-to budget watch for this style."],["grisch","Accessories","Seiko Presage / Seiko 5",1,"Tested","Great automatic watches for the money."],["grisch","Accessories","Orient Bambino",1,"Tested","Classic dress watch, very affordable."],["grisch","Accessories","Hamilton",2,"Tested","Khaki Field and Jazzmaster, Swiss quality."],["grisch","Accessories","Longines",3,"Tested","Swiss luxury below Rolex prices."],["grisch","Accessories","Rolex Datejust (pre-owned)",3,"Buy used","Buy from reputable dealers like Chrono24 with authentication."],["grisch","Accessories","Cartier Tank Must",3,"Buy used","The rectangular watch from the pics."],["grisch","Accessories","Goyard card holder",3,"Buy used","Buy authenticated from Fashionphile or The RealReal."],["grisch","Accessories","Bellroy",1,"Tested","Slim leather card holders and wallets."],["grisch","Accessories","Montblanc leather",2,"Tested","Card holders and belts."],["grisch","Accessories","Il Bussetto",2,"Niche","Italian leather card holders that age well."],["grisch","Accessories","Anderson's belts",3,"Niche","Italian woven and leather belts."],["grisch","Accessories","Acqua di Parma Colonia",3,"Tested","The cologne from the pics. Try a decant first."],["grisch","Accessories","Dior Homme",3,"Tested","Classic designer scent."],["grisch","Accessories","Bleu de Chanel",3,"Tested","Safe, crowd-pleasing designer fragrance."],["grisch","Accessories","Prada L'Homme",2,"Tested","Clean, soapy, polished."],["grisch","Accessories","Montblanc Explorer",1,"Tested","Budget pick with a luxury feel."],["grisch","Accessories","Dossier",1,"Rising","Cheap inspired versions of designer scents."],["grisch","Accessories","Polo RL cap",1,"Tested","Navy or cream cap with the small pony."],["grisch","Accessories","Ray-Ban Wayfarer",2,"Tested","The classic sunglasses."],["grisch","Accessories","Persol",2,"Tested","Italian sunglasses, a step up."],["grisch","Accessories","Oliver Peoples",3,"Niche","Understated luxury eyewear."],["grisch","Accessories","Miansai",2,"Rising","Cord and rope bracelets like the Valentino one."],["grisch","Accessories","Carl Friedrik",2,"Rising","Leather weekenders and bags."],["street","Garments","Carhartt WIP",2,"Tested","The fashion line of Carhartt: pants, jackets, hoodies."],["street","Garments","Carhartt (mainline)",1,"Tested","Double-knee pants and Detroit jackets that last."],["street","Garments","Dickies",1,"Tested","874 work pants and skate fits."],["street","Garments","Gramicci",2,"Tested","Climbing pants with the built-in belt."],["street","Garments","Levi's SilverTab",1,"Rising","Baggy 90s-style jeans, revived."],["street","Garments","Champion Reverse Weave",1,"Tested","Hoodies that don't shrink much."],["street","Garments","Los Angeles Apparel",2,"Tested","Heavyweight tees and hoodies, made in the USA."],["street","Garments","Camber USA",2,"Niche","Extremely thick tees and hoodies."],["street","Garments","Shaka Wear",1,"Niche","Very cheap heavyweight boxy tees."],["street","Garments","Pro Club",1,"Tested","Cheap heavyweight tees, a West Coast staple."],["street","Garments","Uniqlo U",1,"Tested","Boxy tees, cargos and basics."],["street","Garments","Stüssy",2,"Tested","The original skate-surf streetwear."],["street","Garments","Essentials (Fear of God)",2,"Rising","Relaxed basics; buy on sale."],["street","Garments","Fear of God",3,"Tested","Premium mainline; buy used."],["street","Garments","Aimé Leon Dore",3,"Rising","Preppy streetwear from Queens; buy on sale."],["street","Garments","Kith",3,"Tested","Hoodies and collabs; sales are good."],["street","Garments","Noah",3,"Niche","Preppy-skate, well made."],["street","Garments","Palace",2,"Tested","London skate brand; resale easy to find."],["street","Garments","Supreme",2,"Buy used","Box logo classics, lots on resale."],["street","Garments","Represent",3,"Rising","Heavy, premium UK streetwear."],["street","Garments","Corteiz",2,"Rising","London hype brand with limited drops."],["street","Garments","Cole Buxton",3,"Rising","Premium heavy basics."],["street","Garments","Awake NY",2,"Rising","NYC graphics and caps."],["street","Garments","Brain Dead",2,"Niche","Arty graphics, odd colors."],["street","Garments","Pleasures",2,"Niche","Punk-leaning graphics."],["street","Garments","Polar Skate Co.",2,"Niche","Swedish skate brand, famous Big Boy jeans."],["street","Garments","Dime",2,"Niche","Montreal skate brand, funny graphics."],["street","Garments","Obey",1,"Tested","Affordable graphics and caps."],["street","Garments","HUF",1,"Tested","Skate basics, affordable."],["street","Garments","Nike / Adidas / NB apparel",1,"Tested","Tracksuits, fleece and tech wear."],["street","Garments","Arc'teryx",3,"Tested","Shells and fleece that crossover into streetwear."],["street","Garments","BAPE",3,"Buy used","Camo and shark hoodies."],["street","Garments","Human Made",3,"Niche","Japanese brand with playful graphics."],["street","Garments","Needles",3,"Niche","Japanese track pants with the butterfly."],["street","Garments","Kapital",3,"Niche","Japanese denim and patchwork."],["street","Garments","Neighborhood",3,"Niche","Japanese biker-workwear streetwear."],["street","Garments","Denim Tears",3,"Rising","Cotton-wreath jeans and hoodies."],["street","Shoes","Nike Air Force 1 / Dunk",2,"Tested","The staples."],["street","Shoes","Nike Air Max 90 / 95",2,"Tested","Classic runners."],["street","Shoes","New Balance 550 / 9060 / 1906R",2,"Rising","Chunky and retro-runner looks."],["street","Shoes","New Balance 990 (Made in USA)",3,"Tested","Very durable, made in USA."],["street","Shoes","Adidas Samba / Gazelle / Campus",1,"Tested","Low-profile terrace classics."],["street","Shoes","Asics Gel-1130 / Kayano 14",2,"Rising","Comfy retro runners, cheaper than hype pairs."],["street","Shoes","Onitsuka Tiger Mexico 66",2,"Tested","Slim Japanese classic."],["street","Shoes","Saucony Shadow 6000",2,"Niche","Underrated retro runner."],["street","Shoes","Mizuno Wave Rider",2,"Niche","Japanese runner getting a revival."],["street","Shoes","Salomon XT-6",3,"Rising","Trail-shoe crossover."],["street","Shoes","Vans Old Skool / Knu Skool",1,"Tested","Skate classics, chunkier Knu version."],["street","Shoes","Converse Chuck 70",1,"Tested","Sturdier than regular Chucks."],["street","Shoes","Puma Speedcat / Suede",1,"Rising","Slim sneaker trend."],["street","Shoes","Reebok Club C",1,"Tested","Cheap clean court shoe."],["street","Shoes","Clarks Wallabee",2,"Tested","Suede moc-toe, hip-hop classic."],["street","Shoes","Autry",2,"Niche","Retro Dallas-born court sneakers."],["street","Boots","Timberland 6-inch",2,"Tested","The classic wheat boot. Already in your rotation."],["street","Boots","Dingo 1969 Revolver",2,"Rising","Western-style boot; stack straight or bootcut jeans over the shaft."],["street","Boots","Dr. Martens 1460 / 2976",2,"Tested","8-eye or Chelsea; go for the Made in England line for durability."],["street","Boots","Solovair",2,"Niche","Made in the original Docs factory, sturdier build."],["street","Boots","Red Wing Iron Ranger / Moc Toe",3,"Tested","Heritage work boots; resoleable for life."],["street","Boots","Thorogood Moc Toe",2,"Tested","Made-in-USA Red Wing alternative for less."],["street","Boots","Danner Mountain Light",3,"Tested","Heritage hiker, resoleable, looks great with work pants."],["street","Boots","Caterpillar Colorado",1,"Tested","90s work-boot look on a budget."],["street","Boots","Tecovas",3,"Rising","Handmade Western boots if the Dingo look sticks."],["street","Boots","Ariat",2,"Tested","Western boots that are built to be worn hard."],["street","Accessories","New Era",1,"Tested","59FIFTY fitteds and 9TWENTY caps."],["street","Accessories","Carhartt WIP beanie",1,"Tested","The watch-cap beanie."],["street","Accessories","Casio G-Shock",1,"Tested","Nearly indestructible."],["street","Accessories","Casio A168 / A700",1,"Tested","Cheap retro digital watches."],["street","Accessories","Arc'teryx Mantis 2",2,"Tested","The crossbody waist bag."],["street","Accessories","Nike Heritage waist bag",1,"Tested","Cheap crossbody bag."],["street","Accessories","Porter Yoshida",3,"Niche","Japanese bags built to last."],["street","Accessories","Herschel",1,"Tested","Affordable backpacks."],["street","Accessories","Stance / Nike Everyday socks",1,"Tested","Crew socks to show off."],["street","Accessories","Oakley",2,"Rising","Wraparound sunglasses are back."],["street","Accessories","Knockaround",1,"Tested","Cheap sunglasses."],["street","Accessories","Vitaly",2,"Niche","Recycled-steel jewelry that won't tarnish."],["street","Accessories","Serge DeNimes",2,"Niche","UK silver rings and chains."],["street","Accessories","Etsy sterling silver",1,"Niche","Solid 925 chains and rings from small makers."],["street","Accessories","Chrome Hearts",3,"Buy used","Heavy silver jewelry; only authenticated resale."],["cozy","Garments","Uniqlo",1,"Tested","Fleece, Heattech, sweats, ultra-light down."],["cozy","Garments","American Giant",2,"Tested","Classic Full Zip hoodie, famously long-lasting."],["cozy","Garments","Reigning Champ",3,"Tested","Premium Canadian fleece."],["cozy","Garments","Todd Snyder x Champion",2,"Tested","Elevated sweatshirts and sweatpants."],["cozy","Garments","Patagonia",2,"Tested","Synchilla, Better Sweater, Retro-X. Worn Wear sells used."],["cozy","Garments","L.L.Bean",1,"Tested","Fleece, flannel-lined pants, sweaters."],["cozy","Garments","Lands' End",1,"Tested","Cheap, durable basics and fleece."],["cozy","Garments","The North Face Denali",2,"Tested","Classic retro fleece."],["cozy","Garments","Columbia",1,"Tested","Budget fleece and jackets."],["cozy","Garments","Quince",1,"Rising","Cashmere and merino sweaters cheap."],["cozy","Garments","Buck Mason",2,"Rising","Soft tees and henleys that hold shape."],["cozy","Garments","Vuori",2,"Rising","Very soft joggers and lounge wear."],["cozy","Garments","Lululemon",2,"Tested","ABC joggers and soft pullovers."],["cozy","Garments","Rhone",2,"Rising","Athleisure joggers and tops."],["cozy","Garments","Muji",1,"Tested","Simple lounge basics."],["cozy","Garments","Costco Kirkland",1,"Tested","Surprisingly good joggers and fleece."],["cozy","Garments","Everlane",2,"Tested","Basic knits and sweats."],["cozy","Garments","Kotn",2,"Rising","Egyptian cotton basics."],["cozy","Garments","Tentree",1,"Rising","Soft sustainable hoodies."],["cozy","Garments","Faherty",3,"Tested","Soft flannels and knits."],["cozy","Garments","Taylor Stitch",2,"Rising","Flannels and jackets; resale and repair program."],["cozy","Garments","Outerknown",2,"Rising","Blanket shirts and organic basics."],["cozy","Garments","Pendleton",2,"Tested","Wool shirts and blankets."],["cozy","Garments","Filson",3,"Tested","Heavy wool and flannel; lasts decades."],["cozy","Garments","Fjällräven",2,"Tested","Swedish sweaters and outerwear."],["cozy","Garments","Houdini",3,"Niche","Swedish technical fleece."],["cozy","Garments","Snow Peak",3,"Niche","Japanese outdoors-lounge crossover."],["cozy","Garments","Nanamica",3,"Niche","Japanese technical casualwear."],["cozy","Shoes","L.L.Bean Wicked Good Slippers",2,"Tested","The classic slipper."],["cozy","Shoes","Birkenstock Boston",2,"Tested","Suede clogs, wear with socks."],["cozy","Shoes","UGG Tasman",2,"Rising","Suede slipper-shoes."],["cozy","Shoes","Glerups",2,"Niche","Danish felted wool slippers and boots."],["cozy","Shoes","Haflinger",2,"Niche","Felted wool clogs."],["cozy","Shoes","Minnetonka",1,"Tested","Affordable moccasins."],["cozy","Shoes","Merrell Jungle Moc",1,"Tested","Easy slip-on."],["cozy","Shoes","Hoka Clifton / Bondi",2,"Rising","Cloud-like everyday sneakers."],["cozy","Shoes","On Cloud",2,"Rising","Light, easy sneakers."],["cozy","Shoes","New Balance 990 / 574",2,"Tested","Comfortable classics."],["cozy","Shoes","Kizik",2,"Rising","Hands-free slip-in sneakers."],["cozy","Shoes","Allbirds",1,"Tested","Wool runners."],["cozy","Shoes","Crocs (lined)",1,"Tested","Fleece-lined for cold months."],["cozy","Shoes","Salomon RX Slide",1,"Rising","Recovery slides."],["cozy","Shoes","Oofos",1,"Rising","Very soft recovery slides."],["cozy","Shoes","Teva ReEmber",1,"Rising","Puffy slip-ons."],["cozy","Shoes","Olukai",2,"Niche","Slippers with collapsible heels."],["cozy","Boots","Blundstone 500 / 550",2,"Tested","Pull-on Chelsea boots that last years."],["cozy","Boots","Sorel Caribou / Cheyanne",2,"Tested","Warm, waterproof winter boots."],["cozy","Boots","L.L.Bean Bean Boot",2,"Tested","Rain and slush boot, repairable."],["cozy","Boots","UGG Neumel / Classic Mini",2,"Tested","Shearling-lined, warm and easy."],["cozy","Boots","Glerups Boot",2,"Niche","Felted wool indoor/outdoor boot."],["cozy","Boots","Kamik",1,"Tested","Cheap, warm, waterproof snow boots."],["cozy","Accessories","Darn Tough",2,"Tested","Wool socks with a lifetime warranty."],["cozy","Accessories","Smartwool",2,"Tested","Wool socks and beanies."],["cozy","Accessories","Bombas",2,"Rising","Soft socks with good cushioning."],["cozy","Accessories","Patagonia beanie",1,"Tested","Fisherman rolled beanie."],["cozy","Accessories","Quince cashmere scarf",1,"Rising","Cheap real cashmere."],["cozy","Accessories","Johnstons of Elgin",3,"Niche","Scottish cashmere scarves."],["cozy","Accessories","Hestra",2,"Niche","Swedish gloves that last years."],["cozy","Accessories","Fjällräven Kånken",2,"Tested","The square backpack."],["cozy","Accessories","Topo Designs",2,"Rising","Colorful, sturdy bags."],["cozy","Accessories","Cotopaxi",2,"Rising","Colorful packs and fleece."],["cozy","Accessories","L.L.Bean Boat and Tote",1,"Tested","Canvas tote that lasts decades."],["cozy","Accessories","KAVU Rope Bag",1,"Niche","Crossbody sling."],["all","Where to shop","Grailed",2,"Buy used","Menswear resale, great for Stone Island, Carhartt WIP."],["all","Where to shop","The RealReal",2,"Buy used","Authenticated luxury resale."],["all","Where to shop","Vestiaire Collective",2,"Buy used","Authenticated luxury, strong European stock."],["all","Where to shop","Fashionphile",3,"Buy used","Authenticated bags and small leather goods."],["all","Where to shop","eBay (Authenticity Guarantee)",2,"Buy used","Authentication on sneakers, watches, bags."],["all","Where to shop","Depop / Poshmark",1,"Buy used","Cheap used streetwear and basics."],["all","Where to shop","StockX / GOAT",2,"Tested","Verified sneaker resale."],["all","Where to shop","Chrono24",3,"Tested","Pre-owned watches with escrow."],["all","Where to shop","END. Clothing",2,"Tested","Big sales on streetwear and designer."],["all","Where to shop","SSENSE",2,"Tested","Designer and niche sales."],["all","Where to shop","Mr Porter",3,"Tested","Luxury menswear, good sale section."],["all","Where to shop","Nordstrom Rack",1,"Tested","Discounted designer shoes and knits."],["all","Where to shop","Saks Off 5th",1,"Tested","Discounted designer."],["all","Where to shop","TJ Maxx / Marshalls",1,"Tested","Random RL, Carhartt, basics."],["all","Where to shop","Ralph Lauren Factory",1,"Tested","Outlet for polos, knits, caps."],["all","Where to shop","Nike / Adidas outlets",1,"Tested","Discount sneakers and apparel."],["all","Where to shop","Patagonia Worn Wear",1,"Buy used","Used Patagonia, repaired and inspected."],["all","Where to shop","Buffalo Exchange / Crossroads",1,"Buy used","Curated secondhand stores."],["all","Where to shop","Goodwill / thrift stores",1,"Buy used","Cheapest finds, flannels and knits."]];
const TIER={1:"$",2:"$$",3:"$$$"};
const normTxt=x=>String(x||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

const VIBE2ATLAS={grisch:"grisch",streetwear:"street",cozy:"cozy"};
const ATLAS_CATS=["Garments","Shoes","Boots","Accessories","Where to shop"];
function goBrands(style,cat,q){const st=["all","grisch","street","cozy"].includes(style)?style:(VIBE2ATLAS[style]||"all");
  Object.assign(B,{style:st,cat:ATLAS_CATS.includes(cat)?cat:null,tier:null,tag:null,mine:false,q:q||""});$("b-q").value=B.q;saveB();setTab("brands");window.scrollTo(0,0)}
function findBrand(n,style){const k=normTxt(n);const st=VIBE2ATLAS[style]||style;let c=ATLAS.filter(r=>normTxt(r[2])===k);if(!c.length)c=ATLAS.filter(r=>normTxt(r[2]).startsWith(k)||k.startsWith(normTxt(r[2])));return c.find(r=>r[0]===st)||c[0]||null}

/* ---------- body ---------- */
const BODY_DEF={ft:5,inch:10,lb:165,build:"medium",shoulders:"average",prop:"balanced",show:"",hide:""};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dims(b){b=Object.assign({},BODY_DEF,b||{});const inches=clamp((+b.ft||5)*12+(+b.inch||0),54,84);const H=inches*0.0254;
  const bmi=703*clamp(+b.lb||160,80,400)/(inches*inches);let g=clamp(0.82+(bmi-18)*0.035,0.8,1.5)+({slim:-.05,athletic:0,medium:0,broad:.04,heavier:.08}[b.build]||0);
  let sh=({narrow:.92,average:1,broad:1.1}[b.shoulders]||1)*((b.build==="athletic"||b.build==="broad")?1.04:1);
  const c=({"longer legs":.49,balanced:.47,"longer torso":.45}[b.prop]||.47);return {H,g,sh,c,bmi,inches,b}}
function bodyText(){const b=S.body;if(!b)return "He has a medium build (his exact height and weight aren't set yet).";
  return `He's ${b.ft}'${b.inch}" and ${b.lb} lb, with a ${b.build} build, ${b.shoulders} shoulders and ${b.prop} proportions.${b.show?` He wants to show off: ${b.show}.`:""}${b.hide?` He'd rather play down: ${b.hide}.`:""}`}
function bodyFlags(){if(!S.body)return null;const d=dims(S.body);return {short:d.inches<68,tall:d.inches>73,big:d.bmi>=28||S.body.build==="heavier",broad:S.body.build==="broad"||S.body.shoulders==="broad",slim:d.bmi<20||S.body.build==="slim",longTorso:S.body.prop==="longer torso",longLegs:S.body.prop==="longer legs"}}
function readBodyForm(){return {ft:+$("b-ft").value||5,inch:+$("b-in").value||0,lb:+$("b-lb").value||160,build:$("b-build").value,shoulders:$("b-sh").value,prop:$("b-prop").value,show:$("b-show").value.trim(),hide:$("b-hide").value.trim()}}
function fillBodyForm(){const b=Object.assign({},BODY_DEF,S.body||{});$("b-ft").value=b.ft;$("b-in").value=b.inch;$("b-lb").value=b.lb;$("b-build").value=b.build;$("b-sh").value=b.shoulders;$("b-prop").value=b.prop;$("b-show").value=b.show||"";$("b-hide").value=b.hide||"";
  $("b-state").textContent=S.body?"Saved. The fit maker is using this.":"Not saved yet. The fit maker assumes a medium build until you save."}

/* ---------- colors ---------- */
function colorOf(it){const t=((it.color||"")+" "+(it.name||"")).toLowerCase();
  const R=[[/light|bleach|pale blue|sky/,/blue|wash|denim|bleach|sky/,"#9fb4cc"],[/indigo|raw|rinse/,null,"#28324d"],[/stonewash|mid-dark|mid wash|mid-wash/,null,"#51627c"],
    [/navy/,null,"#202a42"],[/khaki|sand|beige|stone/,null,"#c6b28c"],[/wheat|tan|camel/,null,"#9a6a2c"],[/brown|chocolate/,null,"#4a3024"],[/burgundy|oxblood|maroon/,null,"#5c1f26"],
    [/forest|green|olive|sage/,null,"#27392c"],[/faded black|charcoal/,null,"#3b3b3f"],[/black/,null,"#1c1c1f"],[/heather|grey|gray/,null,"#a2a4a8"],
    [/cream|ecru|off-white|oatmeal/,null,"#e6dcc6"],[/white/,null,"#ececea"],[/red/,null,"#a3302a"],[/pink/,null,"#e0a6b4"],[/orange/,null,"#d06f2c"],[/purple|lilac/,null,"#6b5a86"],[/yellow/,null,"#d6b340"],[/blue|denim/,null,"#3f5b8a"]];
  for(const [a,b,c] of R)if(a.test(t)&&(!b||b.test(t)))return c;return "#8a8a8a"}

/* ---------- outfit board ---------- */
const ORDER={outer:0,mid:1,top:2,bottom:3,shoes:4,acc:5};
function fitItems(ids){return (ids||[]).map(id=>S.items.find(i=>i.id===id)).filter(Boolean).sort((a,b)=>(ORDER[a.cat]??9)-(ORDER[b.cat]??9))}
const SLOT={outer:"Jacket",mid:"Layer",top:"Top",bottom:"Bottoms",shoes:"Shoes",acc:"Accessory"};
function cell(it,body){const im=body?it.body:(it.flat||it.body);return `<figure class="b-cell" title="${esc(it.name)}"><div class="ph">${im?`<img src="${src(im)}" alt="${esc(it.name)}" loading="lazy">`:`<span class="label">No photo</span>`}</div><figcaption>${esc(SLOT[it.cat]||it.cat)}</figcaption></figure>`}
function boardHTML(ids){const its=fitItems(ids);
  const onBody=its.length>=2&&its.every(i=>i.body)?`<div class="b-body" style="grid-template-columns:repeat(${its.length},1fr)">${its.map(i=>cell(i,true)).join("")}</div>`:"";
  return `<div class="board">${its.map(i=>cell(i)).join("")}${onBody}</div>`}
function piecesHTML(ids){return `<ul class="pieces">${fitItems(ids).map(i=>`<li><span class="sw" style="background:${colorOf(i)}"></span>${esc(i.name)}</li>`).join("")}</ul>`}

/* ---------- next buys ---------- */
function curGaps(){return sample?S.gaps:ruleGaps()}
function liveGaps(){const skip=new Set(S.gapfb.map(f=>normTxt(f.item)));return (curGaps()?.gaps||[]).filter(x=>!skip.has(normTxt(x.item)))}
function renderGaps(){const g=curGaps(),box=$("g-list");const list=liveGaps();$("n-buys").textContent=list.length;
  $("g-go").hidden=!sample;$("g-mode").textContent=sample?"What your inspo keeps showing that your closet doesn't have, ranked by how many new fits each piece unlocks. It rebuilds itself with Gemini when you add pins or pieces, and skips anything you mark \"Not for me\".":"What your tagged pins keep showing that your closet doesn't have, ranked by pins, your boots-and-bootcut focus and how many fits each piece unlocks. It updates the moment you add a piece or tag a pin.";
  if(!g||!list.length){box.innerHTML=`<div class="empty"><h3>No list yet</h3><p>${sample?'Tap "Find my next buys" to compare your inspo against your closet.':"Add pieces to your closet and tag the pieces in your pins. The list builds itself from those."}</p></div>`;renderFresh();return}
  box.innerHTML=(g.note?`<p class="muted">${esc(g.note)}</p>`:"")+list.map((x,i)=>{const brands=(x.brands||[]).map(n=>findBrand(n,x.atlasStyle||x.vibe)).filter(Boolean);
    return `<article class="gap"><div class="gap-rank" aria-label="Priority ${i+1}">${i+1}</div><div class="gap-main">
      <div class="row" style="justify-content:space-between;align-items:baseline;gap:8px"><h3>${esc(x.item)}</h3>${x.vibe?`<span class="chip">${esc(x.vibe)}</span>`:""}</div>
      <p>${esc(x.why||"")}</p>
      ${(x.pins||x.unlocks)?`<div class="gap-stats">${x.pins?`<span><b>${+x.pins}</b> of your pins</span>`:""}${x.unlocks?`<span><b>${+x.unlocks}+</b> new fits with your closet</span>`:""}</div>`:""}
      ${x.size?`<span class="gap-size">Your size: ${esc(x.size)}</span>`:""}
      ${brands.length?`<div class="brands">${brands.map(r=>`<button class="brand" data-go="${esc(r[0])}|${esc(r[1])}|${esc(r[2])}">${esc(r[2])}<span>${TIER[r[3]]}</span></button>`).join("")}</div>`:""}
      <button class="atlas-link" data-go="${esc(x.atlasStyle||x.vibe||"")}|${esc(x.atlasCat||"")}|${esc(x.search||"")}">Browse ${esc(x.search||x.atlasCat||"this")} in Brands →</button>
      <div class="votes"><button class="btn ghost small" data-got="${esc(x.item)}">Bought it</button><button class="btn ghost small" data-skip="${esc(x.item)}">Not for me</button></div>
    </div></article>`}).join("")+`<p class="label">${g.rules?"Built-in list · updates as you add pieces and tag pins":"Updated "+new Date(g.at).toLocaleDateString()}${g.nInspo!=null?` from ${g.nInspo} pins and ${g.nItems} pieces`:""}</p>`;
  box.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{const [s,c,q]=b.dataset.go.split("|");goBrands(s,c,q)});
  box.querySelectorAll("[data-skip]").forEach(b=>b.onclick=()=>gapVerdict(b.dataset.skip,"skip"));
  box.querySelectorAll("[data-got]").forEach(b=>b.onclick=()=>{gapVerdict(b.dataset.got,"bought");openSheet(null);$("f-name").value=b.dataset.got;
    $("f-status").textContent="Add a photo and tap Tag it, or fill it in by hand."});
  renderFresh()}
const TASTE="He wants a big emphasis on boots and bootcut jeans. Loafers and quarter-zips count as grisch.";
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)}
function inspoSig(){return hashStr(S.inspo.map(p=>p.id).sort().join())}
function closetSig(){return hashStr(S.items.map(i=>i.id+":"+i.name+":"+(i.vibes||[]).join("")).sort().join("|"))}
function brandKey(n){return normTxt(n).replace(/ /g,"_").slice(0,80)}
function marked(kind){return S.marks.filter(m=>m.mark===kind).map(m=>m.brand)}
// What changed since the list was last built
function staleness(){const g=S.gaps;if(!g)return null;
  const pins=S.inspo.filter(p=>(p.created||0)>g.at).length,pieces=S.items.filter(i=>(i.created||0)>g.at).length;
  const marks=S.marks.filter(m=>(m.at||0)>g.at).length+S.gapfb.filter(f=>(f.at||0)>g.at).length;
  const changed=g.sigInspo!==inspoSig()||g.sigCloset!==closetSig()||marks>0;
  return changed?{pins,pieces,marks}:null}
function staleText(s){const p=[];if(s.pins)p.push(`${s.pins} new pin${s.pins>1?"s":""}`);if(s.pieces)p.push(`${s.pieces} new piece${s.pieces>1?"s":""}`);
  if(s.marks)p.push(`${s.marks} brand or list change${s.marks>1?"s":""}`);return (p.length?p.join(", "):"Closet or inspo edits")+" since this list was built."}
function renderFresh(){if(!sample){$("g-fresh").hidden=true;return}const s=staleness(),box=$("g-fresh");box.hidden=!s||busyBuys;if(s)$("g-fresh-t").textContent=staleText(s)}
let busyBuys=false,autoTried="";
function maybeAutoRefresh(){if(!sample||!db||busyBuys||!S.gaps||!S.loaded)return;const s=staleness();if(!s)return;
  const key=inspoSig()+closetSig()+S.marks.length+S.gapfb.length;if(autoTried===key)return;autoTried=key;refreshBuys(true)}
async function refreshBuys(auto){if(!sample){renderGaps();return}
  if(S.inspo.length<3&&!S.profile){$("g-status").textContent="Add at least 3 inspo images first.";return}
  busyBuys=true;$("g-go").disabled=true;$("g-fresh").hidden=true;
  try{let pr=S.profile;
    if(S.inspo.length>=3&&(!pr||pr.sig!==inspoSig())){$("g-status").textContent=(auto?"New pins found. ":"")+"Reading your inspo… this can take a minute.";pr=await readInspo()}
    $("g-status").textContent="Comparing your inspo to your closet…";
    await buildGaps(pr);$("g-status").textContent=auto?"Updated with your latest pins and pieces.":"";
  }catch(e){$("g-status").textContent=e.code?sampleErr(e):"Couldn't save the list."}
  finally{busyBuys=false;$("g-go").disabled=false;renderFresh()}}
async function buildGaps(pr){
  const owned=[...new Set([...marked("own"),...closetBrands()])],wants=marked("want");
  const skipped=S.gapfb.filter(f=>f.verdict==="skip").map(f=>f.item),bought=S.gapfb.filter(f=>f.verdict==="bought").map(f=>f.item);
  const prompt=`You're helping a young man decide his next clothing buys. ${bodyText()} He wants reasonably priced, long-lasting pieces and rotates between three vibes. ${VIBE_DEF}. ${TASTE}
His style profile from ${pr.n||"his"} saved inspo pins: ${pr.summary} Silhouettes: ${(pr.silhouettes||[]).join("; ")}. Recurring pieces: ${(pr.pieces||[]).join("; ")}. Palette: ${(pr.palette||[]).join(", ")}.${VIBES.map(v=>pr.vibes?.[v]?` His ${v}: ${pr.vibes[v]}`:"").join("")}

His closet:
${closetText(S.items)||"(empty)"}
${owned.length?`\nBrands he already owns: ${owned.join(", ")}.`:""}${wants.length?`\nBrands he wants to try: ${wants.join(", ")} (prefer these when they fit).`:""}${skipped.length?`\nHe said "not for me" to: ${skipped.join("; ")}. Don't suggest these or close variants again.`:""}${bought.length?`\nHe already bought: ${bought.join("; ")}. Don't list these again.`:""}

Find the pieces his inspo relies on that his closet is missing, ranked by how many new outfits each would unlock with what he already owns. If a whole basic category is empty (for example he has no tees or button-ups listed), he may simply not have added them yet: mention that in "note" instead of listing basic tees as buys.
Sizing: his usual jeans are 30W x 32L; bootcut jeans worn over boots should be 30W x 34L. For any jeans or trousers, put the size to buy in "size"; otherwise "".
For each gap, pick 2-4 brands ONLY from this Brand Atlas list (style | category | brand | price | type), favouring $ and $$ and matching the vibe:
${ATLAS.map(r=>`${r[0]} | ${r[1]} | ${r[2]} | ${TIER[r[3]]} | ${r[4]}`).join("\n")}

Reply with only JSON: {"note": one sentence or "", "gaps": [{"item": specific piece with color (e.g. "Navy or grey quarter-zip knit"), "vibe": "grisch"|"streetwear"|"cozy", "why": one sentence tying it to his pins and closet, "pins": roughly how many of his pins show it, "unlocks": roughly how many new outfits it creates with his closet, "size": string, "atlasStyle": "grisch"|"street"|"cozy", "atlasCat": "Garments"|"Shoes"|"Boots"|"Accessories", "search": one or two words to search the atlas notes for, or "", "brands": [exact brand names from the list]}]}
Give 5 to 7 gaps, most useful first.`;
  const r=await sample.json(prompt,{cache:false});if(!Array.isArray(r.gaps))throw{code:"invalid_json"};
  await db.collection("gaps").doc().set({note:r.note||"",gaps:r.gaps.slice(0,8),at:Date.now(),sigInspo:inspoSig(),sigCloset:closetSig(),nInspo:S.inspo.length,nItems:S.items.length})}
$("g-go").onclick=()=>refreshBuys(false);
$("g-fresh-go").onclick=()=>refreshBuys(false);
async function gapVerdict(item,verdict){if(!db)return;try{await db.doc("gapfb/"+brandKey(item)).set({item,verdict,at:Date.now()});if(verdict==="skip")toast("Removed. The next list will skip it.")}catch{toast("Couldn't save that.")}}

/* ---------- built-in next buys (no AI needed) ---------- */
// key, short label, full label, vibe, closet type, closet match, atlas style, atlas category, brands, size
const PIECES=[
 ["bootcut","Bootcut jeans","Bootcut or flared jeans, faded mid-wash","streetwear","bottom",/bootcut|flare/,"street","Garments",["Levi's SilverTab","Abercrombie 90s Straight","Depop / Poshmark"],"30W x 34L (bootcut over boots)"],
 ["straightjeans","Straight jeans","Light-wash straight jeans","grisch","bottom",/straight|501|568|light.?wash|bleach/,"grisch","Garments",["Levi's 501 / 568","Nudie Jeans","Uniqlo Selvedge Jeans"],"30W x 32L"],
 ["baggyjeans","Baggy jeans","Baggy or wide-leg jeans","streetwear","bottom",/baggy|wide|barrel|loose/,"street","Garments",["Levi's SilverTab","Carhartt WIP"],"30W x 32L"],
 ["workpants","Work pants","Double-knee or carpenter work pants","streetwear","bottom",/work pant|double.?knee|carpenter|dickies|cargo/,"street","Garments",["Carhartt WIP","Dickies","Gramicci"],"30W x 32L"],
 ["chinos","Chinos","Chinos or pleated trousers","grisch","bottom",/chino|trouser|pleat|slacks/,"grisch","Garments",["J.Crew","Massimo Dutti","COS"],"30W x 32L"],
 ["sweats","Sweatpants","Grey sweatpants or joggers","cozy","bottom",/sweatpant|jogger|sweats/,"cozy","Garments",["Todd Snyder x Champion","American Giant","Uniqlo"],""],
 ["quarterzip","Quarter-zip","Quarter-zip knit in navy, grey or brown","grisch","mid",/quarter|1\/4|half.?zip/,"grisch","Garments",["Quince","Polo Ralph Lauren","Massimo Dutti","Naadam"],""],
 ["knit","Crewneck knit","Fine crewneck knit (wool, merino or cashmere)","grisch","mid",/knit|sweater|cashmere|merino|cable|cardigan/,"grisch","Garments",["Quince","J.Crew","Suitsupply"],""],
 ["oxford","Oxford shirt","Pale blue oxford or button-up shirt","grisch","top",/oxford|button|shirt(?!.*t-shirt)/,"grisch","Garments",["Brooks Brothers","Gant","Polo Ralph Lauren"],""],
 ["tee","Heavyweight tee","Heavyweight tees (white, black, navy)","streetwear","top",/\btee\b|t-shirt|tshirt/,"street","Garments",["Los Angeles Apparel","Camber USA","Pro Club"],""],
 ["henley","Henley","Ribbed henley","streetwear","top",/henley/,"street","Garments",["Los Angeles Apparel","Uniqlo U"],""],
 ["hoodie","Hoodie","Heavyweight hoodie","streetwear","mid",/hoodie|hooded/,"street","Garments",["Champion Reverse Weave","Los Angeles Apparel","Essentials (Fear of God)"],""],
 ["fleece","Fleece","Fleece or sherpa layer","cozy","mid",/fleece|sherpa|synchilla|better sweater/,"cozy","Garments",["Patagonia","L.L.Bean","The North Face Denali"],""],
 ["vest","Down vest","Navy down vest","grisch","outer",/vest|gilet/,"grisch","Garments",["Uniqlo Ultra Light Down","Patagonia Down Sweater","Save the Duck"],""],
 ["puffer","Puffer","Down jacket or puffer","grisch","outer",/puffer|down jacket|\bdown\b|650|parka/,"grisch","Garments",["Uniqlo Ultra Light Down","Patagonia Down Sweater","Rains"],""],
 ["leather","Leather jacket","Short leather or suede jacket (buy used)","streetwear","outer",/leather|suede/,"all","Where to shop",["Grailed","Depop / Poshmark","Buffalo Exchange / Crossroads"],""],
 ["workjacket","Work jacket","Work or chore jacket (canvas, corduroy or denim)","streetwear","outer",/work jacket|chore|detroit|trucker|harrington|corduroy|denim jacket|jean jacket/,"street","Garments",["Carhartt WIP","Carhartt (mainline)","Levi's SilverTab"],""],
 ["westernboots","Western boots","Sleek boots: pointed Chelsea or western, black or dark brown","streetwear","shoes",/chelsea|western|cowboy|dingo|pointed|roper/,"street","Boots",["Dingo 1969 Revolver","Tecovas","Ariat","Thursday Boot Co. Duke / Captain"],""],
 ["workboots","Work boots","Work boots (6-inch or moc toe)","streetwear","shoes",/timberland|timbs|work boot|moc toe|red wing|6.?inch/,"street","Boots",["Timberland 6-inch","Thorogood Moc Toe","Red Wing Iron Ranger / Moc Toe"],""],
 ["loafers","Loafers","Penny loafers","grisch","shoes",/loafer|penny|weejun/,"grisch","Shoes",["G.H. Bass Weejuns","Paraboot","Tod's"],""],
 ["whitesneakers","White sneakers","Beat-up white leather sneakers","grisch","shoes",/white.*(sneaker|leather|trainer)|stan smith|achilles|golden goose|koio/,"grisch","Shoes",["Adidas Stan Smith","Koio","Axel Arigato Clean 90"],""],
 ["terrace","Terrace sneakers","Low terrace or chunky sneaker (Samba, 550)","streetwear","shoes",/samba|gazelle|campus|terrace|550|9060|1906|gel|dunk|air force/,"street","Shoes",["Adidas Samba / Gazelle / Campus","New Balance 550 / 9060 / 1906R","Asics Gel-1130 / Kayano 14"],""],
 ["slippers","Clogs or slippers","Clogs or lined slippers","cozy","shoes",/slipper|clog|boston|birkenstock|tasman|moc(?!.*toe)/,"cozy","Shoes",["Birkenstock Boston","L.L.Bean Wicked Good Slippers","UGG Tasman"],""],
 ["belt","Leather belt","Brown leather belt with a visible buckle","grisch","acc",/belt/,"grisch","Accessories",["Anderson's belts","Montblanc leather"],""],
 ["watch","Watch","Everyday watch, simple dial","grisch","acc",/watch|seiko|tissot|casio|g-shock|orient|timex/,"grisch","Accessories",["Tissot PRX","Seiko Presage / Seiko 5","Orient Bambino"],""],
 ["cap","Cap","Cap (black or navy)","streetwear","acc",/\bcap\b|fitted|snapback|baseball hat/,"street","Accessories",["New Era","Polo RL cap"],""],
 ["beanie","Beanie","Knit beanie","cozy","acc",/beanie/,"cozy","Accessories",["Carhartt WIP beanie","Patagonia beanie"],""],
 ["socks","Wool socks","Wool socks","cozy","acc",/sock/,"cozy","Accessories",["Darn Tough","Smartwool"],""],
].map(([key,short,label,vibe,cat,re,st,ac,brands,size])=>({key,short,label,vibe,cat,re,st,ac,brands,size}));
const PIECE=Object.fromEntries(PIECES.map(p=>[p.key,p]));
const EMPH=new Set(["bootcut","westernboots","workboots"]);
const STARTER=new Set(["quarterzip","straightjeans","whitesneakers","vest","watch","tee","hoodie","workpants","terrace","cap","fleece","sweats","slippers","socks","loafers"]);
function tagCounts(){const c={};S.inspo.forEach(p=>(p.tags||[]).forEach(k=>c[k]=(c[k]||0)+1));return c}
// Newer pins count more (oldest ×0.75 → newest ×1.5), so the list follows where your taste is heading.
function tagWeights(){const w={};const byAge=[...S.inspo].filter(p=>(p.tags||[]).length).sort((a,b)=>(a.created||0)-(b.created||0));const n=byAge.length;
  byAge.forEach((p,i)=>{const f=n>1?.75+.75*i/(n-1):1;p.tags.forEach(k=>w[k]=(w[k]||0)+f)});return w}
function ownsPiece(p){return S.items.some(i=>i.cat===p.cat&&p.re.test(((i.name||"")+" "+(i.notes||"")+" "+(i.color||"")).toLowerCase()))}
function ruleGaps(){
  const pins=tagCounts(),wts=tagWeights(),tagged=S.inspo.filter(p=>(p.tags||[]).length).length;
  const vw={grisch:1,streetwear:1,cozy:1};
  PIECES.forEach(p=>{if(pins[p.key])vw[p.vibe]+=pins[p.key]});S.items.forEach(i=>(i.vibes||[]).forEach(v=>{if(v in vw)vw[v]+=.5}));
  const vt=vw.grisch+vw.streetwear+vw.cozy;
  const n=c=>S.items.filter(i=>i.cat===c).length;
  const wants=new Set(marked("want"));
  const out=[];
  const noTops=!n("top");
  for(const p of PIECES){if(ownsPiece(p))continue;if(noTops&&p.cat==="top")continue;
    const pc=pins[p.key]||0;
    const unlocks=p.cat==="bottom"?n("top")+n("mid")+n("outer"):p.cat==="shoes"?n("bottom"):p.cat==="acc"?Math.ceil(S.items.length/3):n("bottom");
    const sc=(wts[p.key]||0)*3+(EMPH.has(p.key)?6:0)+(STARTER.has(p.key)?1:0)+3*vw[p.vibe]/vt+Math.min(unlocks,12)*.25;
    const why=[];
    if(pc)why.push(`in ${pc} of your ${tagged} tagged pins`);
    if(EMPH.has(p.key))why.push("boots and bootcut are your focus");else if(!pc&&STARTER.has(p.key))why.push(`a ${p.vibe} starter piece you don't own yet`);
    if(unlocks)why.push(`works with ${unlocks} piece${unlocks>1?"s":""} you own`);
    const w=why.join("; ");
    const br=[...ATLAS.filter(r=>wants.has(r[2])&&r[1]===p.ac).map(r=>r[2]),...p.brands].filter((b,i,a)=>a.indexOf(b)===i).slice(0,4);
    out.push({sc,item:p.label,vibe:p.vibe,why:w.charAt(0).toUpperCase()+w.slice(1)+".",pins:pc,unlocks,size:p.size,atlasStyle:p.st,atlasCat:p.ac,search:"",brands:br});}
  out.sort((a,b)=>b.sc-a.sc);
  const notes=[];
  if(noTops)notes.push("Your closet has no tees or shirts yet, so they're left off this list. Add the ones you own and any real gaps will show up here.");
  if(S.inspo.length&&!tagged)notes.push("Tag the pieces in your pins (Inspo tab) and this list starts following what you save.");
  return {note:notes.join(" "),gaps:out.slice(0,7),at:Date.now(),rules:true};
}
function tagSummary(){const pins=tagCounts(),keys=Object.keys(pins).filter(k=>PIECE[k]).sort((a,b)=>pins[b]-pins[a]);if(!keys.length)return "";
  const vc={grisch:0,streetwear:0,cozy:0};keys.forEach(k=>vc[PIECE[k].vibe]+=pins[k]);const t=vc.grisch+vc.streetwear+vc.cozy;
  return `<p>What your pins keep showing, from ${S.inspo.filter(p=>(p.tags||[]).length).length} tagged pins.</p><div class="profile">
    <div><span class="label">Recurring pieces</span><ul>${keys.slice(0,8).map(k=>`<li>${esc(PIECE[k].short)} <span class="muted">× ${pins[k]}</span></li>`).join("")}</ul></div>
    <div><span class="label">Vibe mix in your pins</span><ul>${Object.entries(vc).map(([v,c])=>`<li>${v} <span class="muted">${Math.round(c/t*100)}%</span></li>`).join("")}</ul></div>
    <div><span class="label">Still missing from your closet</span><ul>${keys.filter(k=>!ownsPiece(PIECE[k])).slice(0,5).map(k=>`<li>${esc(PIECE[k].short)}</li>`).join("")||"<li>Nothing, you own every piece you've pinned.</li>"}</ul></div></div>`}
let tagging=null;
function openTagSheet(p){if(!p)return;tagging=p;$("t-img").src=src(p.img);const cur=new Set(p.tags||[]);
  $("t-groups").innerHTML=["grisch","streetwear","cozy"].map(v=>`<div class="t-group"><span class="label">${v}</span><div class="chips">${PIECES.filter(x=>x.vibe===v).map(x=>`<label class="chip"><input type="checkbox" value="${x.key}"${cur.has(x.key)?" checked":""}>${esc(x.short)}</label>`).join("")}</div></div>`).join("");
  $("tagsheet").hidden=false}
$("t-close").onclick=()=>$("tagsheet").hidden=true;
$("tagsheet").addEventListener("click",e=>{if(e.target.id==="tagsheet")$("tagsheet").hidden=true});
$("t-save").onclick=async()=>{if(!tagging||!db)return;const tags=[...$("t-groups").querySelectorAll("input:checked")].map(i=>i.value);const {id,...rest}=tagging;
  try{await db.doc("inspo/"+id).set({...rest,tags});$("tagsheet").hidden=true;toast(tags.length?"Tags saved. Next buys updated.":"Tags cleared.")}catch{toast("Couldn't save the tags.")}};

/* ---------- brands ---------- */
const STY={grisch:{name:"Grisch",c:"var(--grisch)",blurb:"Clean, preppy and polished: puffers and vests, fine knits, light-wash denim, loafers, boots and a good watch."},
  street:{name:"Streetwear",c:"var(--street)",blurb:"Heavyweight tees, hoodies, work pants, statement sneakers, work boots and caps."},
  cozy:{name:"Cozy",c:"var(--cozy)",blurb:"Fleece, soft knits, joggers, slippers and warm layers built to last."},
  all:{name:"Where to shop",c:"var(--ink)",blurb:"Stores, outlets and resale sites that cover every style."}};
const B={style:"all",cat:null,tier:null,tag:null,mine:false,q:""};
try{const s=JSON.parse(localStorage.getItem("rot-brands")||"null");if(s)Object.assign(B,s,{q:""})}catch{}
function saveB(){try{localStorage.setItem("rot-brands",JSON.stringify({style:B.style,cat:B.cat,tier:B.tier,tag:B.tag,mine:B.mine}))}catch{}}
function brandStem(n){const t=normTxt(n.split("/")[0]).split(" ");let s="";for(const w of t){s=(s?s+" ":"")+w;if(s.replace(/ /g,"").length>=4)break}return s}
function closetBrands(){const txt=" "+S.items.map(i=>normTxt(i.name+" "+(i.notes||"")+" "+(i.fitNotes||""))).join(" | ")+" ";
  const out=new Set();for(const r of ATLAS){if(r[1]==="Where to shop")continue;const s=brandStem(r[2]);if(s.length>=4&&txt.includes(" "+s+" "))out.add(r[2])}return [...out]}
function listBrands(){const s=new Set();for(const x of liveGaps())for(const n of (x.brands||[])){const r=findBrand(n,x.atlasStyle||x.vibe);if(r)s.add(r[2])}return s}
function renderMix(){const c={grisch:0,streetwear:0,cozy:0};S.items.forEach(i=>(i.vibes||[]).forEach(v=>{if(v in c)c[v]++}));
  const tot=c.grisch+c.streetwear+c.cozy;const own=new Set([...marked("own"),...closetBrands()]).size,lst=listBrands().size;
  $("b-mix").innerHTML=(tot?`<span>Closet mix <b>grisch ${Math.round(c.grisch/tot*100)}%</b> · <b>street ${Math.round(c.streetwear/tot*100)}%</b> · <b>cozy ${Math.round(c.cozy/tot*100)}%</b></span>`:"")+
    `<span><b>${own}</b> brands you own</span><span><b>${lst}</b> on your next-buys list</span>`}
function bChips(id,key,vals,lab){$(id).innerHTML=`<button class="b-chip" data-v="" aria-pressed="${B[key]===null}">Any</button>`+vals.map(v=>`<button class="b-chip" data-v="${esc(v)}" aria-pressed="${String(B[key])===String(v)}">${esc(lab?lab(v):v)}</button>`).join("");
  $(id).querySelectorAll("button").forEach(b=>b.onclick=()=>{const v=b.dataset.v;B[key]=v===""?null:(key==="tier"?+v:v);saveB();renderBrands()})}
function renderBrands(){if(!$("view-brands"))return;
  $("b-styles").innerHTML=[["all","All three"],["grisch","Grisch"],["street","Streetwear"],["cozy","Cozy"]].map(([k,l])=>`<button class="b-style" data-s="${k}" style="--sc:${k==="all"?"var(--ink)":STY[k].c}" aria-pressed="${B.style===k}">${l}</button>`).join("")+
    `<button class="b-style" data-mine="1" style="--sc:var(--accent)" aria-pressed="${B.mine}">Mine &amp; my list</button>`;
  $("b-styles").querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{B.style=b.dataset.s;saveB();renderBrands()});
  $("b-styles").querySelector("[data-mine]").onclick=()=>{B.mine=!B.mine;saveB();renderBrands()};
  bChips("b-cats","cat",ATLAS_CATS);bChips("b-tiers","tier",[1,2,3],v=>TIER[v]);bChips("b-tags","tag",["Tested","Niche","Rising","Buy used"]);
  renderMix();
  const own=new Set([...marked("own"),...closetBrands()]),want=new Set(marked("want")),onList=listBrands();
  const q=normTxt(B.q);
  const f=ATLAS.filter(r=>(B.style==="all"||r[0]===B.style||r[0]==="all")&&(!B.cat||r[1]===B.cat)&&(!B.tier||r[3]===B.tier)&&(!B.tag||r[4]===B.tag)&&(!q||normTxt(r[2]+" "+r[5]).includes(q))&&(!B.mine||own.has(r[2])||want.has(r[2])||onList.has(r[2])));
  $("b-count").textContent=f.length+" of "+ATLAS.length+" brands";
  const L=$("b-list");
  if(!f.length){L.innerHTML=`<p class="muted" style="padding:20px 0">${B.mine?"Nothing marked yet. Tap Own or Want on a brand, or build your next-buys list.":"No brands match those filters. Set one back to Any."}</p>`;return}
  L.innerHTML=["grisch","street","cozy","all"].map(sk=>{const rows=f.filter(r=>r[0]===sk);if(!rows.length)return "";
    return `<section class="b-sec" style="--sc:${STY[sk].c}"><div class="b-head"><h2>${STY[sk].name}</h2><p>${STY[sk].blurb}</p></div>`+
      ATLAS_CATS.map(c=>{const g=rows.filter(r=>r[1]===c);if(!g.length)return "";
        return `<p class="b-h3">${c} · ${g.length}</p><div class="b-grid">`+g.map(r=>{const k=brandKey(r[2]),m=S.marks.find(x=>x.id===k)?.mark;
          const pill=own.has(r[2])?`<span class="b-pill">You own</span>`:onList.has(r[2])?`<span class="b-pill want">On your list</span>`:want.has(r[2])?`<span class="b-pill want">Want</span>`:"";
          return `<div class="b-item${onList.has(r[2])?" hit":""}"><span class="nm">${esc(r[2])}</span><span class="tr">${TIER[r[3]]}</span><span class="nt">${esc(r[5])}</span>
            <div class="ft"><span class="b-tag">${esc(r[4])}</span>${pill}${r[1]!=="Where to shop"?`<span class="b-mark"><button data-k="${k}" data-b="${esc(r[2])}" data-m="own" aria-pressed="${m==="own"}">Own</button><button data-k="${k}" data-b="${esc(r[2])}" data-m="want" aria-pressed="${m==="want"}">Want</button></span>`:""}</div></div>`}).join("")+`</div>`}).join("")+`</section>`}).join("");
  L.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{if(!db){toast("Can't save in this view.");return}
    const cur=S.marks.find(x=>x.id===b.dataset.k)?.mark;try{if(cur===b.dataset.m)await db.doc("brandmarks/"+b.dataset.k).delete();
      else await db.doc("brandmarks/"+b.dataset.k).set({brand:b.dataset.b,mark:b.dataset.m,at:Date.now()})}catch{toast("Couldn't save that.")}})}
$("b-q").addEventListener("input",e=>{B.q=e.target.value;renderBrands()});

/* ---------- 3D mannequin ---------- */
let THREEP=null;
function loadThree(){if(window.THREE)return Promise.resolve(window.THREE);if(THREEP)return THREEP;
  THREEP=new Promise((res,rej)=>{const s=document.createElement("script");s.src="three.min.js";s.onload=()=>res(window.THREE);s.onerror=()=>{THREEP=null;rej(new Error("load"))};document.head.appendChild(s)});return THREEP}
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim()||"#888";
const TEX={};
function fabricOf(it){const n=((it.name||"")+" "+(it.color||"")).toLowerCase();
  if(it.cat==="shoes")return /boot|timberland|nubuck|suede/.test(n)?"nubuck":/loafer|penny|weejun|leather/.test(n)?"leather":"sneaker";
  if(/jean|denim|501|rinse/.test(n))return "denim";
  if(/down|puffer|650|quilt|vest/.test(n))return "quilt";
  if(/fleece|sherpa/.test(n))return "fleece";
  if(/knit|sweater|quarter|cable|cardigan|merino|cashmere/.test(n))return "knit";
  if(/harrington|work jacket|chore|canvas|coach|khaki|chino|trouser/.test(n))return "canvas";
  if(/leather/.test(n))return "leather";
  return "jersey"}
const FAB={denim:{k:7,r:.95},knit:{k:5,r:.97},quilt:{k:3.1,r:.42},fleece:{k:5,r:1},canvas:{k:9,r:.85},jersey:{k:5,r:.92},nubuck:{k:8,r:.95},leather:{k:4,r:.32},sneaker:{k:6,r:.6}};
function texFor(T,fab,hex){const key=fab+hex;if(TEX[key])return TEX[key];const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");
  x.fillStyle=hex;x.fillRect(0,0,256,256);const dk=a=>`rgba(0,0,0,${a})`,lt=a=>`rgba(255,255,255,${a})`;
  const speck=(n,a)=>{for(let i=0;i<n;i++){x.fillStyle=Math.random()<.5?dk(a*Math.random()):lt(a*Math.random());x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*1.5,1+Math.random()*1.5)}};
  if(fab==="denim"){x.lineWidth=1.6;for(let i=-256;i<512;i+=4){x.strokeStyle=(i/4)%2?lt(.13):dk(.16);x.beginPath();x.moveTo(i,0);x.lineTo(i+256,256);x.stroke()}speck(3000,.22);
    for(let i=0;i<40;i++){x.strokeStyle=lt(.08);x.lineWidth=1;const yy=Math.random()*256;x.beginPath();x.moveTo(0,yy);x.lineTo(256,yy+Math.random()*4);x.stroke()}}
  else if(fab==="knit"){for(let i=0;i<256;i+=8){const g=x.createLinearGradient(i,0,i+8,0);g.addColorStop(0,dk(.22));g.addColorStop(.5,lt(.1));g.addColorStop(1,dk(.22));x.fillStyle=g;x.fillRect(i,0,8,256)}
    for(let j=0;j<256;j+=4){x.fillStyle=dk(.05);x.fillRect(0,j,256,1)}speck(900,.08)}
  else if(fab==="quilt"){for(let yy=0;yy<256;yy+=64)for(let xx=0;xx<256;xx+=64){const g=x.createRadialGradient(xx+30,yy+26,3,xx+32,yy+32,48);g.addColorStop(0,lt(.22));g.addColorStop(.7,dk(.05));g.addColorStop(1,dk(.45));x.fillStyle=g;x.fillRect(xx,yy,64,64)}
    x.fillStyle=dk(.6);for(let i=0;i<256;i+=64){x.fillRect(0,i,256,2);x.fillRect(i,0,2,256)}}
  else if(fab==="fleece"){speck(12000,.14)}
  else if(fab==="canvas"){for(let i=0;i<256;i+=2){x.fillStyle=dk(.07);x.fillRect(0,i,256,1);x.fillStyle=lt(.05);x.fillRect(i,0,1,256)}speck(1500,.1)}
  else if(fab==="nubuck"){speck(8000,.12);for(let i=0;i<30;i++){x.fillStyle=dk(.08);x.beginPath();x.arc(Math.random()*256,Math.random()*256,4+Math.random()*14,0,7);x.fill()}}
  else if(fab==="leather"){speck(2000,.06)}
  else{speck(3500,.06);for(let i=0;i<256;i+=3){x.fillStyle=dk(.035);x.fillRect(0,i,256,1)}}
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.encoding=T.sRGBEncoding;t.anisotropy=4;TEX[key]=t;return t}
function kf(keys,y){if(y<=keys[0].y)return Object.assign({},keys[0],{y});for(let i=1;i<keys.length;i++){const k1=keys[i];if(y<=k1.y){const k0=keys[i-1];let t=(y-k0.y)/(k1.y-k0.y||1);
  const o={y};for(const p of ["a","b","n","cx","cz"])o[p]=(k0[p]??(p==="n"?2:0))+((k1[p]??(p==="n"?2:0))-(k0[p]??(p==="n"?2:0)))*t;return o}}return Object.assign({},keys[keys.length-1],{y})}
function sampleSecs(keys,y0,y1,count,f){let out=[];for(let i=0;i<=count;i++){const y=y0+(y1-y0)*i/count;out.push(kf(keys,y))}
  if(count>6)for(let pass=0;pass<4;pass++){out=out.map((s,i)=>{if(i===0||i===out.length-1)return s;const p=out[i-1],q=out[i+1],r=Object.assign({},s);for(const k of ["a","b","cx","cz","n"])r[k]=(p[k]??0)*.25+(s[k]??0)*.5+(q[k]??0)*.25;return r})}
  if(f)out=out.map((s,i)=>f(s,i/count)||s);return out}
function loftGeo(T,secs,K=6,seg=56){const pos=[],uv=[],idx=[];
  for(const s of secs){const p=2/(s.n||2);let per=0,px=null,pz=null;
    for(let i=0;i<=seg;i++){const t=i/seg*Math.PI*2,ct=Math.cos(t),st=Math.sin(t);
      const x=(s.cx||0)+s.a*Math.sign(ct)*Math.pow(Math.abs(ct),p),z=(s.cz||0)+s.b*Math.sign(st)*Math.pow(Math.abs(st),p);
      if(px!==null)per+=Math.hypot(x-px,z-pz);px=x;pz=z;pos.push(x,s.y,z);uv.push(per*K,s.y*K)}}
  for(let r=0;r<secs.length-1;r++)for(let i=0;i<seg;i++){const a=r*(seg+1)+i,b=a+seg+1;idx.push(a,a+1,b,b,a+1,b+1)}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();fixSeam(g,secs.length,seg);return g}
function fixSeam(g,rows,seg){const n=g.attributes.normal;for(let r=0;r<rows;r++){const a=r*(seg+1),b=a+seg;const x=(n.getX(a)+n.getX(b))/2,y=(n.getY(a)+n.getY(b))/2,z=(n.getZ(a)+n.getZ(b))/2;n.setXYZ(a,x,y,z);n.setXYZ(b,x,y,z)}n.needsUpdate=true}
function wrinkle(g,amp,freq,rows,seg){if(!amp)return;const p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<p.count;i++){const col=i%(seg+1),ang=col/seg*Math.PI*2,y=p.getY(i);
    const w=freq>80?amp*(Math.abs(Math.sin(y*freq))-.5):amp*(Math.sin(ang*7+y*6)*.5+Math.sin(ang*11-y*9+1.3)*.3+Math.sin(ang*4+y*3)*.2);
    p.setXYZ(i,p.getX(i)+n.getX(i)*w,y,p.getZ(i)+n.getZ(i)*w)}p.needsUpdate=true;g.computeVertexNormals();fixSeam(g,rows,seg)}

function buildFigure(T,body,items,opts={}){
  const {H,g,sh,c}=dims(body);const Y=f=>f*H;const G=new T.Group();
  const gw=Math.pow(g,.85),gd=Math.pow(g,1.1),gf=Math.pow(g,.6);
  const crotch=Y(c),waist=Y(c+.125),chest=Y(c+.25),armpit=Y(c+.275),shY=Y(c+.33),shTop=Y(c+.348),neckB=Y(c+.362),neckT=Y(c+.395),headC=Y(c+.45);
  const legX=Y(.052)*Math.pow(g,.6),neckR=Y(.037)*Math.sqrt(g);
  const TK=[{y:crotch-Y(.025),a:Y(.094)*gw,b:Y(.068)*gd,n:2.2},{y:crotch+Y(.04),a:Y(.104)*gw,b:Y(.075)*gd,n:2.4},{y:waist,a:Y(.093)*Math.pow(g,1.15),b:Y(.069)*Math.pow(g,1.35),n:2.3},
    {y:Y(c+.2),a:Y(.1)*gw*Math.sqrt(sh),b:Y(.074)*gd,n:2.4},{y:chest,a:Y(.106)*sh*Math.pow(g,.6),b:Y(.079)*gd,n:2.5},{y:armpit,a:Y(.113)*sh,b:Y(.075)*Math.pow(g,.8),n:2.8},
    {y:shY,a:Y(.119)*sh,b:Y(.06)*Math.pow(g,.6),n:3.2},{y:shY+Y(.009),a:Y(.106)*sh,b:Y(.056),n:2.9},{y:shTop,a:Y(.072)*sh,b:Y(.05),n:2.5},{y:neckB,a:neckR,b:neckR,n:2}];
  const sx=Y(.119)*sh-Y(.03)+Y(.02)*(g-1);
  const armKeys=s=>[{y:Y(.468),a:Y(.019),b:Y(.016),cx:s*(sx+Y(.047)),cz:Y(.014)},{y:Y(.55),a:Y(.027)*gf,b:Y(.024)*gf,cx:s*(sx+Y(.037)),cz:Y(.012)},
    {y:Y(.625),a:Y(.024)*gf,b:Y(.026)*gf,cx:s*(sx+Y(.026)),cz:Y(.002)},{y:Y(.7),a:Y(.032)*gf,b:Y(.034)*gf,cx:s*(sx+Y(.012)),cz:0},{y:shY+Y(.006),a:Y(.037)*gf,b:Y(.041)*gf,cx:s*sx,cz:0}];
  const legKeys=s=>[{y:Y(.04),a:Y(.022),b:Y(.024),cx:s*legX*.9},{y:Y(.075),a:Y(.024),b:Y(.027),cx:s*legX*.9},{y:Y(.2),a:Y(.04)*Math.pow(g,.5),b:Y(.046)*Math.pow(g,.5),cx:s*legX*.9,cz:-Y(.005)},
    {y:Y(.265),a:Y(.036)*gf,b:Y(.038)*gf,cx:s*legX*.92},{y:Y(.3),a:Y(.041)*gf,b:Y(.043)*gf,cx:s*legX*.93},{y:Y(.4),a:Y(.05)*gw,b:Y(.053)*gd,cx:s*legX*.98},{y:crotch+Y(.06),a:Y(.06)*gw,b:Y(.062)*gd,cx:s*legX}];
  const meshes=[];const add=(geo,m,x=0,y=0,z=0)=>{const me=new T.Mesh(geo,m);me.position.set(x,y,z);me.castShadow=true;me.receiveShadow=true;G.add(me);meshes.push(me);return me};
  const skin=new T.MeshStandardMaterial({color:opts.skin||"#e4ded3",roughness:.55,metalness:0});
  const fabMat=(it,tint=1)=>{const fab=fabricOf(it);return new T.MeshStandardMaterial({map:texFor(T,fab,colorOf(it)),color:new T.Color(tint,tint,tint),roughness:FAB[fab].r,metalness:0,side:T.DoubleSide})};
  const plain=(col,r=.6,met=0)=>new T.MeshStandardMaterial({color:col,roughness:r,metalness:met});
  const tube=(pts,r,m)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),Math.max(8,pts.length*6),r,8,false),m);
  const shoe=items&&items.find(i=>i.cat==="shoes"),bot=items&&items.find(i=>i.cat==="bottom");
  const its=items||[],byCat=k=>its.find(i=>i.cat===k);
  // ---- body
  add(loftGeo(T,sampleSecs(TK,TK[0].y,neckB,44)),skin);
  add(loftGeo(T,sampleSecs([{y:neckB-Y(.01),a:neckR,b:neckR*1.05},{y:neckT+Y(.01),a:neckR*.92,b:neckR}],neckB-Y(.01),neckT+Y(.01),6)),skin);
  const head=add(new T.SphereGeometry(1,48,36),skin,0,headC,Y(.004));head.scale.set(Y(.047),Y(.064),Y(.056));
  const jaw=add(new T.SphereGeometry(1,32,24),skin,0,headC-Y(.03),Y(.012));jaw.scale.set(Y(.036),Y(.034),Y(.04));
  for(const s of [-1,1]){add(loftGeo(T,sampleSecs(legKeys(s),Y(.035),crotch+Y(.05),30)),skin);
    add(loftGeo(T,sampleSecs(armKeys(s),Y(.468),shY+Y(.006),30)),skin);
    const cap=add(new T.SphereGeometry(Y(.036)*gf,24,18),skin,s*sx,shY-Y(.022),0);cap.scale.set(1,1.05,1.05);
    add(loftGeo(T,sampleSecs([{y:Y(.385),a:Y(.008),b:Y(.012)},{y:Y(.41),a:Y(.012),b:Y(.022)},{y:Y(.45),a:Y(.012),b:Y(.021)},{y:Y(.472),a:Y(.014),b:Y(.018)}].map(k=>Object.assign(k,{cx:s*(sx+Y(.048)),cz:Y(.015)})),Y(.385),Y(.472),10)),skin);
    if(!shoe){const f=new T.Mesh(new T.SphereGeometry(1,24,16),skin);f.scale.set(Y(.026),Y(.02),Y(.07));f.position.set(s*legX*.9,Y(.02),Y(.035));f.castShadow=true;G.add(f)}}
  // ---- upper garments
  const upper=[["top",byCat("top"),.004],["mid",byCat("mid"),.01],["outer",opts.noOuter?null:byCat("outer"),.017]];
  const silF={slim:.97,regular:1.03,relaxed:1.1,oversized:1.18};
  const chestK=kf(TK,chest);let prevShape=null,prevSl=null;const present=upper.filter(u=>u[1]);const outerMost=present.length?present[present.length-1][1]:null;
  for(const [cat,it,off] of upper){if(!it)continue;
    const fab=fabricOf(it),nm=(it.name||"").toLowerCase(),o=Y(off)+(fab==="quilt"?Y(.01):0),f=silF[it.sil]||1.03,boxy=it.sil!=="slim";
    const m=fabMat(it),band=fabMat(it,.78);
    const hem=it.len==="cropped"?waist-Y(.006):it.len==="long"?crotch-Y(.08):cat==="outer"?crotch-Y(.006):cat==="mid"?crotch+Y(.018):crotch+Y(.008);
    const drop=it.sil==="oversized"?Y(.01):it.sil==="relaxed"?Y(.005):0;
    const shK=kf(TK,shY),wA=chestK.a*f*.98,wB=chestK.b*f*.96;
    const shape=s=>{const r=Object.assign({},s);if(boxy&&s.y<shY){const t=clamp((s.y-chest)/(shY-chest),0,1);r.a=Math.max(s.a,wA+(shK.a-wA)*t);r.b=Math.max(s.b,wB+(shK.b-wB)*t);r.n=Math.max(s.n,2.6)}
      else if(s.y<chest){r.a=s.a*1.01;r.b=s.b*1.01}
      {const t=clamp((s.y-(armpit-Y(.04)))/Y(.04),0,1),u=clamp((shTop-s.y)/Y(.02),0,1);r.a+=drop*t*t*(3-2*t)*u}r.a+=o;r.b+=o;
      if(myPrev){const p=myPrev(s);r.a=Math.max(r.a,p.a+Y(.004));r.b=Math.max(r.b,p.b+Y(.004))}return r};
    const myPrev=prevShape;
    const secs=sampleSecs(TK,hem,shTop,36,shape);const collarS={y:neckB+Y(.004),a:neckR+o*.75+Y(.006),b:neckR+o*.75+Y(.006),n:2};secs.push(collarS);
    const rib=/hood|sweat|crew|fleece|harrington|knit|quarter|sweater/.test(nm)||(cat==="outer"&&it.len==="cropped");
    if(rib){for(const s of secs)if(s.y<hem+Y(.03)){s.a*=.975;s.b*=.975}}
    const geo=loftGeo(T,secs,FAB[fab].k);wrinkle(geo,fab==="quilt"?Y(.006):Y(.0012),fab==="quilt"?Math.PI/Y(.045):20,secs.length,56);add(geo,m);
    const fz=y=>{const s=shape(kf(TK,clamp(y,hem,shTop)));return s.b};
    if(rib)add(loftGeo(T,sampleSecs(TK,hem-Y(.001),hem+Y(.028),4,s=>{const r=shape(s);r.a=r.a*.975+Y(.0025);r.b=r.b*.975+Y(.0025);return r}),6),band);
    // sleeves
    const short=cat==="top"&&/tee|t-shirt|polo|short/.test(nm),sEnd=short?Y(.655):cat==="outer"?Y(.472):Y(.478),ex=it.sil==="oversized"?Y(.013):it.sil==="relaxed"?Y(.007):0;
    for(const s of [-1,1]){const ak=armKeys(s);const upA=kf(ak,Y(.7)).a;
      const sl=sampleSecs(ak,sEnd,shY+Y(.004),24,(k,t)=>{const r=Object.assign({},k);r.a=Math.max(k.a,boxy?upA*(.7+.2*t):0)+o*.55+ex*.6;r.b=Math.max(k.b,boxy?upA*(.7+.2*t):0)+o*.55+ex*.6;if(k.y>shY-Y(.02))r.cx=k.cx+s*drop*.5;if(prevSl){const p=prevSl(k,t,s);r.a=Math.max(r.a,p.a+Y(.003));r.b=Math.max(r.b,p.b+Y(.003))}return r});
      const sg=loftGeo(T,sl,FAB[fab].k);wrinkle(sg,fab==="quilt"?Y(.005):Y(.001),fab==="quilt"?Math.PI/Y(.045):20,sl.length,56);add(sg,m);
      if(!short&&(rib||fab==="denim")){add(loftGeo(T,sampleSecs(ak,sEnd-Y(.001),sEnd+Y(.03),3,k=>Object.assign({},k,{a:k.a+o*.6+Y(.003),b:k.b+o*.6+Y(.003)})),FAB[fab].k),rib?band:m)}}
    {const sh2=shape,ex2=ex,o2=o,bx=boxy,dr=drop;prevShape=sh2;const ps=prevSl;
      prevSl=(k,t,sd)=>{const upA=kf(armKeys(sd),Y(.7)).a;const r={a:Math.max(k.a,bx?upA*(.7+.2*t):0)+o2*.55+ex2*.6,b:Math.max(k.b,bx?upA*(.7+.2*t):0)+o2*.55+ex2*.6};if(ps){const p=ps(k,t,sd);r.a=Math.max(r.a,p.a+Y(.003));r.b=Math.max(r.b,p.b+Y(.003))}return r}}
    const isOuter=it===outerMost;
    // collar
    const front=y=>fz(y)+Y(.0015);
    if(/hood/.test(nm)){const hg=new T.TorusGeometry(neckR+o+Y(.014),Y(.017),14,32,Math.PI*.7);hg.rotateZ(Math.PI*.15);const hd=add(hg,m,0,neckB+Y(.004),-Y(.012));hd.rotation.x=-Math.PI/2;hd.scale.set(1,1.2,1);
      const bag=add(new T.SphereGeometry(1,28,20),m,0,shY-Y(.035),-(fz(shY-Y(.035))+Y(.012)));bag.scale.set(Y(.07),Y(.06),Y(.028));
      for(const s of [-1,1])tube([[s*Y(.02),neckB,front(neckB)+Y(.006)],[s*Y(.021),neckB-Y(.05),front(neckB-Y(.05))+Y(.004)],[s*Y(.022),neckB-Y(.085),front(neckB-Y(.085))+Y(.003)]],Y(.0022),plain("#d8d4cc",.8))}
    else if(/fleece|harrington|down|650|puffer|quarter|track|stand/.test(nm)){add(loftGeo(T,[{y:neckB-Y(.004),a:neckR+o*.7+Y(.009),b:neckR+o*.7+Y(.009)},{y:neckB+Y(.03),a:neckR+o*.6+Y(.011),b:neckR+o*.6+Y(.012)}],FAB[fab].k),band)}
    else if(/shirt|oxford|button|work jacket|jean jacket|denim|chore|anderson|jwa|collar/.test(nm)){add(loftGeo(T,[{y:neckB-Y(.004),a:neckR+o*.7+Y(.007),b:neckR+o*.7+Y(.008)},{y:neckB+Y(.018),a:neckR+o*.6+Y(.009),b:neckR+o*.6+Y(.009)}],FAB[fab].k),m);
      for(const s of [-1,1]){const fl=add(new T.BoxGeometry(Y(.036),Y(.048),Y(.003)),m,s*Y(.03),neckB-Y(.012),front(neckB-Y(.012))+Y(.004));fl.rotation.set(-.35,s*.35,s*.62)}}
    else{add(new T.TorusGeometry(neckR+o*.75+Y(.006),Y(.0045),8,40),band,0,neckB+Y(.002),0).rotation.x=Math.PI/2}
    // closures & details
    const full=cat!=="top"&&/zip|jacket|harrington|fleece|down|650|puffer|cardigan|work|coat/.test(nm)&&!/quarter|pullover|crewneck|sweatshirt/.test(nm);
    const zipCol=/brass|gold/.test((it.color||"").toLowerCase())?"#b89a55":new T.Color(colorOf(it)).multiplyScalar(.55).getStyle();
    if(isOuter&&(full||/quarter/.test(nm))){const y0=full?hem+Y(.004):chest-Y(.02),pts=[];for(let k=0;k<=10;k++){const y=y0+(neckB-y0)*k/10;pts.push([0,y,front(y)+Y(.002)])}tube(pts,Y(.0028),plain(zipCol,.4,/b89a55/.test(zipCol)?.6:.1))}
    if(isOuter&&/snap/.test(nm)){const pts=[];for(let k=0;k<=6;k++){const y=chest-Y(.02)+(neckB-chest+Y(.02))*k/6;pts.push([Y(.012),y,front(y)+Y(.002)])}tube(pts,Y(.006),band);
      for(let k=0;k<3;k++){const y=chest+Y(.01)+k*Y(.03);add(new T.SphereGeometry(Y(.004),10,8),plain("#6b6f78",.4,.5),Y(.012),y,front(y)+Y(.007))}}
    if(isOuter&&/work|chore|jean jacket|denim|anderson|jwa/.test(nm)&&cat==="outer"){for(const s of [-1,1]){const y=hem+Y(.07),p=add(new T.BoxGeometry(Y(.055),Y(.06),Y(.004)),band,s*Y(.058),y,front(y)+Y(.004));p.rotation.y=s*.12}}
    if(isOuter&&/hood/.test(nm)&&!full){const y=hem+Y(.07),p=add(new T.BoxGeometry(Y(.12),Y(.07),Y(.004)),m,0,y,front(y)+Y(.004))}
    if(isOuter&&/crest|logo|emblem/.test(nm)){const y=chest+Y(.01),e=add(new T.CircleGeometry(Y(.012),20),plain(/red/.test(nm+it.color)?"#b0282a":"#d9d2c4",.7),-Y(.05),y,front(y)+Y(.005));}
  }
  // ---- bottoms
  if(bot){const fab=fabricOf(bot),m=fabMat(bot),band=fabMat(bot,.82),o=Y(.007),nm=(bot.name||"").toLowerCase();
    const extra=bot.sil==="oversized"?Y(.009):bot.sil==="relaxed"?Y(.005):0;
    const shorts=/short|jort/.test(nm),hw=({slim:Y(.03),regular:Y(.036),relaxed:Y(.043),oversized:Y(.05)}[bot.sil]||Y(.038))*Math.pow(g,.4);
    const stack=!shorts&&(bot.sil==="oversized"||bot.sil==="relaxed")&&bot.len!=="cropped";
    const hemY=shorts?Y(.29):bot.len==="cropped"?Y(.085):stack?Y(.017):bot.sil==="slim"?Y(.052):Y(.036);
    const top=crotch+Y(.05);
    for(const s of [-1,1]){const lk=legKeys(s);const topA=kf(lk,top).a+o+extra;
      const secs=sampleSecs(lk,hemY,top,40,(k,t)=>{const r=Object.assign({},k);const lin=hw+(topA-hw)*Math.pow(t,1.3);
        if(bot.sil==="slim"){r.a=Math.max(k.a+o,lin);r.b=Math.max(k.b+o,lin*1.05)}else{r.a=Math.max(k.a+o+extra*t,lin);r.b=Math.max(k.b+o+extra*t,lin*1.06)}
        r.cx=k.cx+s*extra*.35;r.n=2.1;
        if(stack&&k.y<hemY+Y(.1)){const w=1+.07*Math.sin((k.y-hemY)/Y(.1)*Math.PI*3.2)*(1-(k.y-hemY)/Y(.1));r.a*=w;r.b*=w}
        if(k.y<hemY+Y(.01)&&!shorts){r.cz=(k.cz||0)-Y(.004)}return r});
      const geo=loftGeo(T,secs,FAB[fab].k);wrinkle(geo,Y(.0012),20,secs.length,56);add(geo,m);
}
    const seat=sampleSecs(TK,crotch-Y(.012),waist+Y(.006),12,s=>Object.assign({},s,{a:s.a+o+extra*.5,b:s.b+o+extra*.4}));{const s0=seat[0];seat.unshift(Object.assign({},s0,{y:s0.y-Y(.02),a:s0.a*.1,b:s0.b*.1}),Object.assign({},s0,{y:s0.y-Y(.012),a:s0.a*.6,b:s0.b*.4}))}const sg=loftGeo(T,seat,FAB[fab].k);add(sg,m);
    add(loftGeo(T,sampleSecs(TK,waist-Y(.022),waist+Y(.008),3,s=>Object.assign({},s,{a:s.a+o+extra*.5+Y(.003),b:s.b+o+extra*.4+Y(.003)})),FAB[fab].k),band);
    const fr=y=>kf(TK,y).b+o+extra*.4;
    tube([[0,waist-Y(.04),fr(waist-Y(.04))+Y(.002)],[Y(.006),crotch+Y(.04),fr(crotch+Y(.04))+Y(.002)],[0,crotch-Y(.005),fr(crotch)+Y(.001)]],Y(.0015),band);
    if(fab==="denim"){add(new T.CylinderGeometry(Y(.006),Y(.006),Y(.003),16),plain("#b89060",.35,.7),0,waist-Y(.025),fr(waist-Y(.025))+Y(.004)).rotation.x=Math.PI/2}
  }
  // ---- shoes
  if(shoe){const nm=(shoe.name||"").toLowerCase(),boot=/boot|timberland/.test(nm),loaf=/loafer|penny|weejun/.test(nm);
    const upM=fabMat(shoe),soleM=plain(boot?"#5b3b24":loaf?"#241612":"#ecebe6",boot?.9:.6);
    const prof=boot?[[0,.033,.078],[.1,.037,.082],[.35,.041,.07],[.55,.044,.056],[.78,.044,.05],[.93,.038,.044],[1,.02,.028]]
      :loaf?[[0,.03,.038],[.15,.033,.036],[.45,.037,.036],[.7,.039,.03],[.9,.034,.024],[1,.018,.014]]
      :[[0,.032,.05],[.2,.036,.048],[.5,.04,.042],[.75,.041,.036],[.93,.035,.028],[1,.018,.016]];
    const soleT=boot?Y(.02):loaf?Y(.011):Y(.016),L=Y(boot?.155:.148),z0=-Y(.038);
    const capd=secs=>{const f=secs[0],l=secs[secs.length-1],d=L*.012;return [Object.assign({},f,{y:f.y-d,a:f.a*.35,b:f.b*.55}),...secs,Object.assign({},l,{y:l.y+d*.6,a:l.a*.3,b:l.b*.5})]};
    for(const s of [-1,1]){const x=s*legX*.9;
      const up=capd(prof.map(([t,w,h])=>({y:z0+L*t,a:Y(w),b:Y(h)/2,cz:-(soleT+Y(h)/2),n:loaf?2.4:3})));const ug=loftGeo(T,up,FAB[fabricOf(shoe)].k,40);ug.rotateX(Math.PI/2);add(ug,upM,x,0,0);
      const sp=capd(prof.map(([t,w])=>({y:z0+L*t,a:Y(w)+Y(.003),b:soleT/2,cz:-soleT/2,n:3.5})));const sg=loftGeo(T,sp,4,40);sg.rotateX(Math.PI/2);add(sg,soleM,x,0,0);
      if(boot){for(let k=0;k<7;k++){const lug=add(new T.BoxGeometry(Y(.07),Y(.006),Y(.01)),soleM,x,-Y(.001),z0+L*(.08+k*.13))}
        add(loftGeo(T,[{y:soleT+Y(.07),a:Y(.034),b:Y(.039)},{y:soleT+Y(.1),a:Y(.034),b:Y(.039)},{y:soleT+Y(.112),a:Y(.036),b:Y(.041)}].map(k=>Object.assign(k,{cx:x,cz:-Y(.004)})),8),upM);
        const col=add(new T.TorusGeometry(Y(.037),Y(.009),10,32),plain("#2e2118",.5),x,soleT+Y(.114),-Y(.004));col.rotation.x=Math.PI/2;col.scale.set(1,1.1,1);
        const lc=plain("#c79a2a",.7);for(let k=0;k<5;k++){const y=soleT+Y(.035)+k*Y(.017),zz=Y(.03)+Y(.016)*(4-k)*.35;tube([[x-Y(.018),y,zz],[x+Y(.018),y+Y(.012),zz+Y(.002)]],Y(.0018),lc);tube([[x+Y(.018),y,zz],[x-Y(.018),y+Y(.012),zz+Y(.002)]],Y(.0018),lc)}}
      else if(loaf){const strap=add(new T.BoxGeometry(Y(.06),Y(.008),Y(.012)),fabMat(shoe,.8),x,soleT+Y(.03),z0+L*.52);strap.rotation.x=-.25;
        const moc=add(new T.TorusGeometry(Y(.032),Y(.0022),6,32,Math.PI),fabMat(shoe,.7),x,soleT+Y(.026),z0+L*.66);moc.rotation.x=-Math.PI/2+.2;moc.scale.set(1,1.5,1)}
      else{tube([[x,soleT+Y(.045),z0+L*.45],[x,soleT+Y(.03),z0+L*.75]],Y(.012),upM)}
    }}
  G.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  G.scale.setScalar(H/(headC+Y(.064)));return {G,H};
}
class Viewer{constructor(host){this.host=host;this.rot=0;this.zoom=1;this.spin=!matchMedia("(prefers-reduced-motion: reduce)").matches;this.fig=null;this.alive=true}
  async init(){const T=this.T=await loadThree();if(!this.alive)return;
    const r=this.r=new T.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.08;
    r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;const el=r.domElement;el.style.display="block";el.style.touchAction="pan-y";this.host.appendChild(el);
    this.scene=new T.Scene();this.cam=new T.PerspectiveCamera(24,1,.05,60);
    this.scene.add(new T.HemisphereLight(0xffffff,0x8a8378,.55));
    const key=new T.DirectionalLight(0xfff3e6,1.7);key.position.set(1.3,2.8,2.3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);const sc=key.shadow.camera;sc.left=-1;sc.right=1;sc.top=2.2;sc.bottom=-.2;sc.near=.5;sc.far=8;key.shadow.bias=-.0006;key.shadow.radius=4;this.scene.add(key);
    const fill=new T.DirectionalLight(0xdde6ff,.6);fill.position.set(-2.2,1.4,1.2);this.scene.add(fill);
    const rim=new T.DirectionalLight(0xffffff,.9);rim.position.set(-.5,2.2,-2.6);this.scene.add(rim);
    const gnd=new T.Mesh(new T.PlaneGeometry(6,6),new T.ShadowMaterial({opacity:.22}));gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;this.scene.add(gnd);
    let px=null;el.addEventListener("pointerdown",e=>{this.spin=false;px=e.clientX;if(e.pointerType==="mouse")el.setPointerCapture(e.pointerId)});
    el.addEventListener("pointermove",e=>{if(px===null)return;this.rot+=(e.clientX-px)*.012;px=e.clientX});
    const up=()=>{px=null};el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);el.addEventListener("pointerleave",up);
    el.addEventListener("wheel",e=>{e.preventDefault();this.setZoom(this.zoom*(e.deltaY>0?1.08:.93))},{passive:false});
    this.ro=new ResizeObserver(()=>this.size());this.ro.observe(this.host);this.size();
    const loop=()=>{if(!this.alive)return;if(this.spin)this.rot+=.005;if(this.fig)this.fig.rotation.y=this.rot;this.r.render(this.scene,this.cam);this.raf=requestAnimationFrame(loop)};loop();}
  size(){if(!this.r)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.r.setSize(w,h,false);this.r.domElement.style.width=w+"px";this.r.domElement.style.height=h+"px";this.cam.aspect=w/h;this.cam.updateProjectionMatrix();this.frame()}
  frame(){if(!this.cam)return;const H=this.H||1.78;const fit=H*1.1/(2*Math.tan(12*Math.PI/180));const asp=this.cam.aspect<.55?.55/this.cam.aspect:1;
    this.cam.position.set(0,H*.56,fit*asp*this.zoom);this.cam.lookAt(0,H*.5,0)}
  setZoom(z){this.zoom=clamp(z,.35,1.5);this.frame()}
  view(r){this.spin=false;this.rot=r}
  set(body,items,opts){if(!this.T)return;if(this.fig){this.scene.remove(this.fig);this.fig.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})}
    const {G,H}=buildFigure(this.T,body,items,opts);this.fig=G;this.H=H;G.rotation.y=this.rot;this.scene.add(G);this.frame()}
  dispose(){this.alive=false;cancelAnimationFrame(this.raf);this.ro?.disconnect();if(this.fig)this.fig.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});this.r?.dispose();this.r?.domElement.remove()}}


let MQ=null,mqState=null;
async function openMannequin(ids,title){const its=fitItems(ids);mqState={its};$("mq-title").textContent=title||"On the mannequin";
  $("mq-jacket-wrap").hidden=!its.some(i=>i.cat==="outer");$("mq-jacket").checked=true;
  $("mq-legend").innerHTML=its.map(i=>`<li><span class="sw" style="background:${colorOf(i)}"></span>${esc(i.name)} <span class="muted">· ${esc(i.sil)}${i.len&&i.len!=="regular"?", "+esc(i.len):""}</span></li>`).join("");
  $("mq-body-note").hidden=!!S.body;$("mq").hidden=false;$("mq-status").textContent="Loading 3D…";$("mq-status").hidden=false;
  try{if(!MQ){MQ=new Viewer($("mq-stage"));await MQ.init()}MQ.rot=0;MQ.zoom=1;MQ.set(S.body,its);$("mq-status").hidden=true}
  catch{$("mq-status").textContent="The 3D view couldn't load here. Check your connection and try again."}}
function closeMannequin(){$("mq").hidden=true;if(MQ){MQ.dispose();MQ=null}}
$("mq-close").onclick=closeMannequin;$("mq").addEventListener("click",e=>{if(e.target.id==="mq")closeMannequin()});
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>MQ?.view(+b.dataset.view));
$("mq-zin").onclick=()=>MQ?.setZoom(MQ.zoom*.85);$("mq-zout").onclick=()=>MQ?.setZoom(MQ.zoom*1.15);
$("mq-jacket").onchange=()=>{if(MQ&&mqState)MQ.set(S.body,mqState.its,{noOuter:!$("mq-jacket").checked})};

/* ---------- you tab ---------- */
let YV=null,yT=null;
async function openYou(){fillBodyForm();if(YV)return;YV=new Viewer($("you-stage"));$("you-status").hidden=false;
  try{await YV.init();YV.set(readBodyForm(),[]);$("you-status").hidden=true}catch{$("you-status").textContent="The 3D preview couldn't load here."}}
function closeYou(){if(YV){YV.dispose();YV=null}}
["b-ft","b-in","b-lb","b-build","b-sh","b-prop"].forEach(id=>$(id).addEventListener("input",()=>{clearTimeout(yT);yT=setTimeout(()=>YV?.set(readBodyForm(),[]),120)}));
$("b-save").onclick=async()=>{if(!db){toast("Can't save in this view.");return}const b=readBodyForm();$("b-save").disabled=true;
  try{await db.doc("body/me").set({...b,at:Date.now()});toast("Build saved")}catch{toast("Couldn't save. Try again.")}finally{$("b-save").disabled=false}};

/* ---------- saved ---------- */
function renderSaved(){$("n-saved").textContent=S.fits.length;const l=$("s-list");
  l.innerHTML=S.fits.length?S.fits.map(f=>fitCard(f,0,"saved")).join(""):`<div class="empty"><h3>No saved fits</h3><p>Hit Save on a fit you'd actually wear and it lands here.</p></div>`;
  l.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const f=S.fits.find(x=>x.id===b.dataset.mq);if(f)openMannequin(f.items,f.title)});
  l.querySelectorAll("[data-unsave]").forEach(b=>b.onclick=async()=>{try{await db.doc("fits/"+b.dataset.unsave).delete()}catch{toast("Couldn't remove.")}});}

function renderAll(){renderCloset();renderInspo();renderSaved();renderRecreate();renderGaps()}
renderAll();RP.renderSettings();const HASH_TAB=(location.hash||"").slice(1);const START=["make","closet","buys","brands","inspo","you","saved"].includes(HASH_TAB)?HASH_TAB:null;setTab(START||"closet");

/* ---------- boot ---------- */
(async()=>{
  if(!window.claude?.use){$("conn").textContent="Your closet couldn't start. Reload the page.";return}
  const [d,a,s]=await Promise.all([claude.use("db"),claude.use("assets"),claude.use("sample")]);db=d;assets=a;sample=s;
  if(sample){try{const lim=await sample.limits();imgMax=lim.images?.maxCount||0}catch{imgMax=0}}
  if(!db){$("conn").textContent="Your closet couldn't load. Reload the page.";return}
  $("conn").textContent="";
  if(!$("conn").textContent)$("conn").hidden=true;
  let first=true;
  const sub=(q,key,after)=>q.onSnapshot(snap=>{S[key]=snap.docs.map(d=>({id:d.id,...d.data()}));after();
    if(key==="items"&&first){first=false;S.loaded=true;if(!START)setTab(S.items.length?"make":"closet");else if(START==="buys")maybeAutoRefresh()}},()=>{});
  sub(db.collection("items").orderBy("created","desc"),"items",()=>{renderCloset();renderFits();renderFresh();if(!sample)renderGaps();if(S.tab==="brands")renderBrands()});
  sub(db.collection("brandmarks"),"marks",()=>{renderFresh();if(!sample)renderGaps();if(S.tab==="brands")renderBrands()});
  sub(db.collection("gapfb"),"gapfb",()=>{renderGaps();if(S.tab==="brands")renderBrands()});
  sub(db.collection("inspo").orderBy("created","desc"),"inspo",()=>{renderInspo();renderFresh();if(!sample)renderGaps();if(S.recreate&&!S.inspo.find(p=>p.id===S.recreate.id)){S.recreate=null;renderRecreate()}});
  sub(db.collection("fits").orderBy("at","desc").limit(60),"fits",renderSaved);
  sub(db.collection("feedback").orderBy("at","desc").limit(60),"feedback",()=>{});
  db.collection("profile").orderBy("at","desc").limit(1).onSnapshot(q=>{S.profile=q.docs[0]?q.docs[0].data():null;renderInspo()},()=>{});
  db.collection("gaps").orderBy("at","desc").limit(1).onSnapshot(q=>{S.gaps=q.docs[0]?q.docs[0].data():null;renderGaps();if(S.tab==="brands")renderBrands();if(S.tab==="buys")maybeAutoRefresh()},()=>{});
  db.doc("body/me").onSnapshot(d=>{S.body=d.exists?d.data():null;if(S.tab==="you"){fillBodyForm();YV?.set(readBodyForm(),[])}},()=>{});
})();
