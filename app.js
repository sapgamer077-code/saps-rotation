/* Rotation — app. Everything personal (styles, sizes, focus, brands) comes from each user's own prefs. */

const CATS=[["top","Tee / shirt"],["mid","Hoodie / knit"],["outer","Jacket / coat"],["bottom","Pants / shorts"],["shoes","Shoes"],["acc","Accessory"]];
const CATNAME=Object.fromEntries(CATS);
const S={items:[],inspo:[],fits:[],feedback:[],marks:[],gapfb:[],mybrands:[],ai:null,prefs:null,loaded:false,profile:null,gaps:null,body:null,filter:"all",tab:null,recreate:null,editing:null,pending:{flat:null,body:null},lastFits:[]};
let db=null,assets=null,sample=null,imgMax=0,ctl=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const src=id=>id?RP.srcFor(id):"";
/* ---------- the person using the app ---------- */
function userStyles(){const p=S.prefs?.styles;if(p&&p.length)return p.filter(k=>STYLES[k]);
  const seen=new Set();S.items.forEach(i=>(i.vibes||[]).forEach(v=>STYLES[v]&&seen.add(v)));return seen.size?[...seen]:["streetwear","minimal","cozy"]}
const styleName=k=>STYLES[k]?.name||k;
function styleDefs(keys=userStyles()){return keys.map(k=>`${k} = ${STYLES[k].def}`).join("; ")}
function shopFor(){return S.prefs?.shop||"both"}
function audFor(shop,a){return !a||a==="u"||shop==="both"||!shop||(shop==="mens"&&a==="m")||(shop==="womens"&&a==="w")}
const audOk=a=>audFor(shopFor(),a);
function personText(){const p=S.prefs||{};const who=p.shop==="mens"?"shops menswear":p.shop==="womens"?"shops womenswear":"shops across menswear and womenswear";return `The user${p.name?` (${p.name})`:""} ${who}.`}
function tasteText(){const p=S.prefs||{};const f=(p.focus||[]).map(k=>PIECE[k]?.short).filter(Boolean);const z=p.sizes||{};const b=p.budget||2;
  return [f.length?`They want more of: ${f.join(", ")}.`:"",`Budget: ${b===1?"mostly budget ($)":b===2?"up to mid-range ($$)":"open to premium ($$$) and resale"}.`,
    (z.tops||z.bottoms||z.shoes)?`Sizes: tops ${z.tops||"not given"}, bottoms ${z.bottoms||"not given"}, shoes ${z.shoes||"not given"}.`:""].filter(Boolean).join(" ")}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2600)}
function sampleErr(e){const c=e&&e.code;return c==="bad_key"||c==="not_granted"?"Google rejected your Gemini key. Check it in You → Settings.":c==="rate_limited"?"Today's free Gemini limit is used up. Try again tomorrow.":c==="bad_model"?"That Gemini model isn't available. Change it in You → Settings.":c==="invalid_json"?"The answer came back garbled. Try again.":c==="network"?"Couldn't reach Gemini. Check your connection.":c==="cancelled"?"Stopped.":"Gemini couldn't answer"+(e&&e.message?": "+e.message:".")}

/* ---------- tabs ---------- */
function setTab(t){const prev=S.tab;S.tab=t;for(const b of document.querySelectorAll(".tab"))b.setAttribute("aria-selected",b.dataset.tab===t);
  for(const v of ["make","closet","buys","brands","inspo","you","saved"])$("view-"+v).hidden=v!==t;
  if(t==="brands")renderBrands();if(t==="buys")maybeAutoRefresh();
  if(t==="you")openYou();else if(prev==="you")closeYou();if(prev!==t&&typeof sayNow==="function")sayNow(true);}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));

/* ---------- closet ---------- */
$("f-cat").innerHTML=CATS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
let FORMV=[];
function renderVibeChips(extra=[]){FORMV=[...new Set([...userStyles(),...extra])].filter(k=>STYLES[k]);
  $("f-vibes").innerHTML=FORMV.map(v=>`<label class="chip"><input type="checkbox" value="${v}" id="fv-${v}">${esc(styleName(v))}</label>`).join("")}
renderVibeChips();
function renderFilters(){const opts=[["all","All"],...CATS.map(([v,l])=>[v,l.split(" /")[0]]),["wash","In wash"]];
  $("c-filters").innerHTML=opts.map(([v,l])=>`<button data-f="${v}" aria-pressed="${S.filter===v}">${esc(l)}</button>`).join("");
  $("c-filters").querySelectorAll("button").forEach(b=>b.onclick=()=>{S.filter=b.dataset.f;renderCloset()});}
function tagCard(it){return `<button class="tagcard${it.wash?" wash":""}" data-id="${esc(it.id)}"><span class="hole"></span>${it.wash?'<span class="flag">In wash</span>':""}${it.body?'<span class="bodydot">On-body ✓</span>':""}
  <span class="ph duo">${it.flat?`<img src="${src(it.flat)}" alt="" loading="lazy">`:it.body?`<img src="${src(it.body)}" alt="" loading="lazy">`:`<span class="none">No photo yet</span>`}</span>
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
function openSheet(it){S.editing=it||null;S.pending={flat:null,body:null};$("f").reset();renderVibeChips(it?.vibes||[]);
  $("f-title").textContent=it?"Edit piece":"Add a piece";$("f-del").hidden=!it;$("f-del").textContent="Delete piece";$("f-del").dataset.arm="";
  $("f-status").textContent="";
  if(it){$("f-name").value=it.name||"";$("f-cat").value=it.cat||"top";$("f-color").value=it.color||"";$("f-sil").value=it.sil||"regular";
    $("f-len").value=it.len||"regular";$("f-warm").value=String(it.warmth||2);$("f-fit").value=it.fitNotes||"";$("f-notes").value=it.notes||"";$("f-wash").checked=!!it.wash;
    FORMV.forEach(v=>$("fv-"+v).checked=(it.vibes||[]).includes(v));}
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
  const desc=flat&&body?`Image 1 is the item laid flat or on a hanger. Image 2 is the item worn by its owner (${bodyText()}).`:flat?"The image is the item laid flat or on a hanger.":`The image shows the item worn by its owner (${bodyText()}).`;
  try{const r=await sample.json(`You tag clothing for a personal wardrobe app. ${desc}
Reply with only a JSON object:
{"name": short descriptive name like "Washed black boxy hoodie",
 "cat": one of ${JSON.stringify(CATS.map(c=>c[0]))} (top=tee/shirt, mid=hoodie/sweater/knit, outer=jacket/coat, acc=hat/bag/jewelry/belt),
 "color": plain color description,
 "sil": one of ["slim","regular","relaxed","oversized"],
 "len": one of ["cropped","regular","long"],
 "warmth": 1, 2 or 3,
 "vibes": subset of ${JSON.stringify(userStyles())} (${styleDefs()}),
 "fitNotes": ${body?"one or two sentences on how it sits on their body: where hems land, drape, shoulder fit, leg shape, stacking":"\"\""}}`,{images:imgs.slice(0,imgMax||2)});
    if(r.name)$("f-name").value=r.name;if(CATNAME[r.cat])$("f-cat").value=r.cat;if(r.color)$("f-color").value=r.color;
    if(["slim","regular","relaxed","oversized"].includes(r.sil))$("f-sil").value=r.sil;if(["cropped","regular","long"].includes(r.len))$("f-len").value=r.len;
    if([1,2,3].includes(+r.warmth))$("f-warm").value=String(+r.warmth);
    if(Array.isArray(r.vibes))FORMV.forEach(v=>$("fv-"+v).checked=r.vibes.includes(v));
    if(r.fitNotes&&!$("f-fit").value)$("f-fit").value=r.fitNotes;
    $("f-status").textContent="Filled in. Fix anything that's off.";
  }catch(e){$("f-status").textContent=sampleErr(e)}finally{$("f-auto").disabled=false}};

$("f").onsubmit=async e=>{e.preventDefault();if(!db){toast("Can't save in this view.");return}
  const btn=$("f-save");btn.disabled=true;btn.textContent="Saving…";
  try{const it=S.editing||{};const data={name:$("f-name").value.trim(),cat:$("f-cat").value,color:$("f-color").value.trim(),sil:$("f-sil").value,len:$("f-len").value,
      warmth:+$("f-warm").value,vibes:FORMV.filter(v=>$("fv-"+v).checked),fitNotes:$("f-fit").value.trim(),notes:$("f-notes").value.trim(),wash:$("f-wash").checked,
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
  g.innerHTML=S.inspo.length?S.inspo.map(p=>`<div class="inspo-card"><div class="ph duo"><img src="${src(p.img)}" alt="Inspiration image" loading="lazy"></div>
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
    ${userStyles().map(v=>pr.vibes?.[v]?`<div><span class="label">Your ${esc(styleName(v).toLowerCase())}</span><p>${esc(pr.vibes[v])}</p></div>`:"").join("")}</div>
    <p class="label">Read ${new Date(pr.at).toLocaleDateString()} from ${pr.n} images</p>`;}
$("i-file").onchange=async e=>{const files=[...e.target.files];e.target.value="";if(!files.length)return;if(!db||!assets){toast("Uploads aren't available in this view.");return}
  $("i-status").textContent=`Adding ${files.length} image${files.length>1?"s":""}…`;
  for(const f of files){try{const up=await assets.upload(await shrink(f,1400),{type:"image/jpeg"});await db.collection("inspo").doc().set({img:up.id,created:Date.now()})}catch{toast("One image didn't upload.")}}
  $("i-status").textContent="";};
function closetText(items){return items.map(i=>`${i.id} | ${i.name} | ${CATNAME[i.cat]||i.cat} | ${i.color} | ${i.sil}, ${i.len} | warmth ${i.warmth} | vibes: ${(i.vibes||[]).join("/")||"-"}${i.fitNotes?` | fit on them: ${i.fitNotes}`:""}${i.notes?` | note: ${i.notes}`:""}`).join("\n")}
async function readInspo(){
  const pick=S.inspo.slice(0,imgMax||20);
  const pairs=(await Promise.all(pick.map(async p=>[p,await blobFor(p.img)]))).filter(x=>x[1]);const blobs=pairs.map(x=>x[1]);
  const keys=userStyles();
  const r=await sample.json(`These ${blobs.length} images are outfit inspiration saved by someone who rotates between these styles: ${styleDefs(keys)}. ${personText()} ${bodyText()} ${tasteText()} They want reasonably priced, long-lasting pieces.
Build their style profile from what repeats across the images. Then compare against their current closet and name gaps.

Their closet:
${closetText(S.items)||"(empty so far)"}

Reply with only JSON:
{"summary": 2 sentences on their taste,
 "palette": up to 6 color descriptions,
 "silhouettes": up to 5 proportion patterns (e.g. "boxy cropped top over wide straight pants"),
 "pieces": up to 6 recurring garment types,
 "vibes": {${keys.map(k=>`"${k}": one sentence`).join(", ")}} (omit a style that doesn't show up),
 "gaps": up to 5 specific pieces the inspo relies on that their closet lacks, most useful first,
 "pinTags": one list per image, in the same order as the images, of the keys from this list that appear in that image: ${PIECES.filter(p=>audOk(p.a)).map(p=>p.key).join(", ")}}`,{images:blobs,modelTier:"complex"});
  const {pinTags,...prof}=r;
  if(Array.isArray(pinTags))for(let i=0;i<pairs.length;i++){const p=pairs[i][0],t=(pinTags[i]||[]).filter(k=>PIECE[k]);if(t.length&&!(p.tags||[]).length){const {id,...rest}=p;db.doc("inspo/"+id).set({...rest,tags:t})}}
  const doc={...prof,n:blobs.length,at:Date.now(),sig:inspoSig()};await db.collection("profile").doc().set(doc);return doc}
$("i-build").onclick=async()=>{if(!sample){$("i-status").textContent="Add a free Gemini key in You → Settings to read pins automatically. Until then, tag the pieces on each pin.";return}
  if(S.inspo.length<3){$("i-status").textContent="Add at least 3 inspo images first.";return}
  $("i-build").disabled=true;$("i-status").textContent="Reading your inspo… this can take a minute.";
  try{await readInspo();$("i-status").textContent="Profile updated. Next buys will refresh the next time you open it."}
  catch(e){$("i-status").textContent=e.code?sampleErr(e):"Couldn't save the profile."}finally{$("i-build").disabled=false}};

/* ---------- make ---------- */
function renderVibeSelect(){const cur=$("m-vibe").value;$("m-vibe").innerHTML=`<option value="any">Surprise me</option>`+userStyles().map(k=>`<option value="${k}">${esc(styleName(k))}</option>`).join("");if([...$("m-vibe").options].some(o=>o.value===cur))$("m-vibe").value=cur}
renderVibeSelect();
function renderRecreate(){const r=S.recreate;$("m-recreate").hidden=!r;if(r)$("m-recreate-img").src=src(r.img);$("m-go").textContent=r?"Recreate it":"Make 3 fits"}
$("m-recreate-x").onclick=()=>{S.recreate=null;renderRecreate()};
function itemFig(id){const it=S.items.find(i=>i.id===id);if(!it)return"";const im=it.flat||it.body;
  return `<figure><div class="ph">${im?`<img src="${src(im)}" alt="">`:`<span class="label" style="padding:6px;text-align:center">${esc(CATNAME[it.cat]||"")}</span>`}</div><figcaption>${esc(it.name)}</figcaption></figure>`}
function fitCard(f,i,mode){const voted=f.vote;return `<article class="fit"><div class="row" style="justify-content:space-between;align-items:baseline"><h3>${esc(f.title)}</h3>${f.vibe?`<span class="chip">${esc(styleName(f.vibe))}</span>`:""}</div>
  <div class="fitgrid">${boardHTML(f.items)}<div class="fit-detail">${piecesHTML(f.items)}
  ${f.why?`<p class="rot-line">${esc(f.why.charAt(0).toLowerCase()+f.why.slice(1))}</p>`:""}${f.proportion?`<p class="muted" style="font-size:.92rem"><span class="label">Proportion</span> ${esc(f.proportion)}</p>`:""}
  ${f.missing?`<p class="muted" style="font-size:.92rem"><span class="label">Missing vs. inspo</span> ${esc(f.missing)}</p>`:""}
  <button class="btn ghost small" style="align-self:flex-start" data-mq="${mode==="new"?i:esc(f.id)}">ROT tries it on</button></div></div>
  ${mode==="new"?`<div class="votes"><button class="btn ghost small ${voted===1?"voted-up":""}" data-v="1" data-i="${i}">Good fit</button><button class="btn ghost small ${voted===-1?"voted-down":""}" data-v="-1" data-i="${i}">Not it</button><button class="btn ghost small" data-save="${i}">${f.saved?"Saved":"Save"}</button></div>`
  :`<div class="votes"><button class="btn ghost small" data-unsave="${esc(f.id)}">Remove</button></div>`}</article>`}
function renderFits(){if(typeof sayNow==="function")sayNow();const o=$("m-out");o.innerHTML=S.lastFits.map((f,i)=>fitCard(f,i,"new")).join("");
  o.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const f=S.lastFits[+b.dataset.mq];openMannequin(f.items,f.title,f.vibe)});
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
  const keys=userStyles();
  const prompt=`You're styling someone from clothes they already own. ${personText()} ${bodyText()} Use their build to judge how much volume and layering flatters them, and where cropped vs longer layers and wide vs straight legs work best on their frame. Fit and proportion matter more than genre labels: use each piece's silhouette, length and "fit on them" notes to balance proportions (e.g. wide or long bottoms with shorter or boxier tops, intentional layering lengths, how pants break on the shoes).
${pr?`Their style profile from saved inspo: ${pr.summary} Silhouettes they like: ${(pr.silhouettes||[]).join("; ")}. Palette: ${(pr.palette||[]).join(", ")}.${keys.map(v=>pr.vibes?.[v]?` Their ${styleName(v)}: ${pr.vibes[v]}`:"").join("")}`:""}
${liked.length?`Fits they liked: ${liked.map(f=>names(f.items)).join(" | ")}`:""}
${nope.length?`Fits they rejected: ${nope.map(f=>names(f.items)).join(" | ")}`:""}
Style definitions: ${styleDefs(keys)}.
Today: ${temp}°F, ${wx}.${plan?` Plans: ${plan}.`:""}${recreate?" The attached image is an inspo outfit: recreate it as closely as possible with their clothes.":` Style: ${vibe==="any"?`any of ${keys.join(" / ")}, vary them`:vibe}.`}

Closet (id | name | type | color | silhouette, length | warmth 1-3 | styles | notes). Use ONLY these ids:
${closetText(pool)}

Reply with only JSON: {"fits":[{"title": 2-4 word name, "vibe": one of ${JSON.stringify(keys)}, "items": [ids], "why": one sentence on why it works today, "proportion": one sentence on how the pieces balance on their body${recreate?`, "missing": what the inspo has that their closet can't match, or ""`:""}}]}
${recreate?"Give 2 fits.":"Give 3 distinct fits."} Each fit needs something on top, a bottom and shoes, plus a jacket or coat when it's under about 55°F or wet. Dress for the weather.`;
  ctl=new AbortController();$("m-go").disabled=true;$("m-stop").hidden=false;$("m-status").textContent="Thinking…";
  try{const r=await sample.json(prompt,Object.assign({signal:ctl.signal,cache:false},imgs.length?{images:imgs}:{}));
    const valid=new Set(pool.map(i=>i.id));
    S.lastFits=(r.fits||[]).map(f=>({...f,items:(f.items||[]).filter(id=>valid.has(id)),key:"f"+Date.now()+Math.random().toString(36).slice(2,6)})).filter(f=>f.items.length);
    renderFits();$("m-status").textContent=S.lastFits.length?"Rate them so the next batch gets closer.":"No usable fits came back. Try again.";
  }catch(e){if(e&&e.code==="cancelled"){$("m-status").textContent="Stopped.";}
    else{S.lastFits=fallbackFits(pool,temp,wx,vibe).map(f=>({...f,key:"f"+Date.now()+Math.random().toString(36).slice(2,6)}));renderFits();
      $("m-status").textContent=sampleErr(e)+" These fits came from the built-in stylist instead. Rate them so it learns.";}}finally{$("m-go").disabled=false;$("m-stop").hidden=true}};

/* ---------- each person's brand atlas ---------- */
const TIER={1:"$",2:"$$",3:"$$$"};
const normTxt=x=>String(x||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const LEGACY={street:"streetwear",grisch:"grisch",cozy:"cozy",all:"all"};
const ATLAS_CATS=["Garments","Shoes","Boots","Accessories","Where to shop"];
function marked(kind){return S.marks.filter(m=>m.mark===kind).map(m=>m.brand)}
// Shared catalog + brands the user added + brands Gemini picked for them
function allBrands(){const m=new Map();for(const r of CATALOG)m.set(r.b,r);
  for(const r of (S.ai?.picks||[]))m.set(r.b,{...(m.get(r.b)||r),ai:true,why:r.why,s:[...new Set([...(m.get(r.b)?.s||[]),...(r.s||[])])]});
  for(const r of S.mybrands)m.set(r.b,{...r,custom:true});return [...m.values()]}
function myAtlas(){const st=new Set(userStyles()),hidden=new Set(marked("hide"));
  return allBrands().filter(r=>!hidden.has(r.b)&&(r.custom||r.ai||(audOk(r.a)&&(r.s||[]).some(x=>x==="all"||st.has(x)))))}
function goBrands(style,cat,q){let st=LEGACY[style]||style;if(!userStyles().includes(st))st="all";
  Object.assign(B,{style:st,cat:ATLAS_CATS.includes(cat)?cat:null,tier:null,tag:null,mine:false,hidden:false,allPrices:true,q:q||""});$("b-q").value=B.q;saveB();setTab("brands");window.scrollTo(0,0)}
function findBrand(n){const k=normTxt(n);const all=allBrands();return all.find(r=>normTxt(r.b)===k)||all.find(r=>normTxt(r.b).startsWith(k)||k.startsWith(normTxt(r.b)))||null}

/* ---------- body ---------- */
const BODY_DEF={ft:5,inch:10,lb:165,build:"medium",shoulders:"average",prop:"balanced",show:"",hide:""};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dims(b){b=Object.assign({},BODY_DEF,b||{});const inches=clamp((+b.ft||5)*12+(+b.inch||0),54,84);const H=inches*0.0254;
  const bmi=703*clamp(+b.lb||160,80,400)/(inches*inches);let g=clamp(0.82+(bmi-18)*0.035,0.8,1.5)+({slim:-.05,athletic:0,medium:0,broad:.04,heavier:.08}[b.build]||0);
  let sh=({narrow:.92,average:1,broad:1.1}[b.shoulders]||1)*((b.build==="athletic"||b.build==="broad")?1.04:1);
  const c=({"longer legs":.49,balanced:.47,"longer torso":.45}[b.prop]||.47);return {H,g,sh,c,bmi,inches,b}}
function bodyText(){const b=S.body;if(!b)return "Their exact height and build aren't set yet.";
  return `They're ${b.ft}'${b.inch}" and ${b.lb} lb, with a ${b.build} build, ${b.shoulders} shoulders and ${b.prop} proportions.${b.show?` They want to show off: ${b.show}.`:""}${b.hide?` They'd rather play down: ${b.hide}.`:""}`}
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
function gapStyleLabel(x){const k=LEGACY[x.vibe]||x.vibe;return STYLES[k]?styleName(k):(x.vibe||"")}
function renderGaps(){const g=curGaps(),box=$("g-list");const list=liveGaps();$("n-buys").textContent=list.length;
  $("g-go").hidden=!sample;$("g-mode").textContent=sample?"What your inspo keeps showing that your closet doesn't have, ranked by how many new fits each piece unlocks. It rebuilds itself with Gemini when you add pins or pieces, and skips anything you mark \"Not for me\".":"What your tagged pins keep showing that your closet doesn't have, ranked by pins, your want-more-of list and how many fits each piece unlocks. It updates the moment you add a piece or tag a pin.";
  if(!g||!list.length){box.innerHTML=`<div class="empty"><h3>No list yet</h3><p>${sample?'Tap "Find my next buys" to compare your inspo against your closet.':"Add pieces to your closet and tag the pieces in your pins. The list builds itself from those."}</p></div>`;renderFresh();return}
  box.innerHTML=(g.note?`<p class="muted">${esc(g.note)}</p>`:"")+list.map((x,i)=>{const brands=(x.brands||[]).map(n=>findBrand(n)).filter(Boolean);
    return `<article class="gap"><div class="gap-rank" aria-label="Priority ${i+1}">${i+1}</div><div class="gap-main">
      <div class="row" style="justify-content:space-between;align-items:baseline;gap:8px"><h3>${esc(x.item)}</h3>${x.vibe?`<span class="chip">${esc(gapStyleLabel(x))}</span>`:""}</div>
      <p class="rot-line">${esc((x.why||"").charAt(0).toLowerCase()+(x.why||"").slice(1))}</p>
      ${(x.pins||x.unlocks)?`<div class="gap-stats">${x.pins?`<span><b>${+x.pins}</b> of your pins</span>`:""}${x.unlocks?`<span><b>${+x.unlocks}+</b> new fits with your closet</span>`:""}</div>`:""}
      ${x.size?`<span class="gap-size">Your size: ${esc(x.size)}</span>`:""}
      ${brands.length?`<div class="brands">${brands.map(r=>`<button class="brand" data-go="${esc((r.s||["all"])[0])}|${esc(r.c)}|${esc(r.b)}">${esc(r.b)}<span>${TIER[r.t]||""}</span></button>`).join("")}</div>`:""}
      <button class="atlas-link" data-go="${esc(x.atlasStyle||x.vibe||"")}|${esc(x.atlasCat||"")}|${esc(x.search||"")}">Browse ${esc(x.search||x.atlasCat||"this")} in Brands →</button>
      <div class="votes"><button class="btn ghost small" data-got="${esc(x.item)}">Bought it</button><button class="btn ghost small" data-skip="${esc(x.item)}">Not for me</button></div>
    </div></article>`}).join("")+`<p class="label">${g.rules?"Built-in list · updates as you add pieces and tag pins":"Updated "+new Date(g.at).toLocaleDateString()}${g.nInspo!=null?` from ${g.nInspo} pins and ${g.nItems} pieces`:""}</p>`;
  box.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{const [s,c,q]=b.dataset.go.split("|");goBrands(s,c,q)});
  box.querySelectorAll("[data-skip]").forEach(b=>b.onclick=()=>gapVerdict(b.dataset.skip,"skip"));
  box.querySelectorAll("[data-got]").forEach(b=>b.onclick=()=>{gapVerdict(b.dataset.got,"bought");openSheet(null);$("f-name").value=b.dataset.got;
    $("f-status").textContent="Add a photo and tap Tag it, or fill it in by hand."});
  renderFresh()}
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)}
function inspoSig(){return hashStr(S.inspo.map(p=>p.id).sort().join())}
function closetSig(){return hashStr(S.items.map(i=>i.id+":"+i.name+":"+(i.vibes||[]).join("")).sort().join("|"))}
function brandKey(n){return normTxt(n).replace(/ /g,"_").slice(0,80)}
// What changed since the list was last built
function staleness(){const g=S.gaps;if(!g)return null;
  const pins=S.inspo.filter(p=>(p.created||0)>g.at).length,pieces=S.items.filter(i=>(i.created||0)>g.at).length;
  const marks=S.marks.filter(m=>(m.at||0)>g.at).length+S.gapfb.filter(f=>(f.at||0)>g.at).length+((S.prefs?.at||0)>g.at?1:0);
  const changed=g.sigInspo!==inspoSig()||g.sigCloset!==closetSig()||marks>0;
  return changed?{pins,pieces,marks}:null}
function staleText(s){const p=[];if(s.pins)p.push(`${s.pins} new pin${s.pins>1?"s":""}`);if(s.pieces)p.push(`${s.pieces} new piece${s.pieces>1?"s":""}`);
  if(s.marks)p.push(`${s.marks} style, brand or list change${s.marks>1?"s":""}`);return (p.length?p.join(", "):"Closet or inspo edits")+" since this list was built."}
function renderFresh(){if(!sample){$("g-fresh").hidden=true;return}const s=staleness(),box=$("g-fresh");box.hidden=!s||busyBuys;if(s)$("g-fresh-t").textContent=staleText(s)}
let busyBuys=false,autoTried="";
function maybeAutoRefresh(){if(!sample||!db||busyBuys||!S.gaps||!S.loaded)return;const s=staleness();if(!s)return;
  const key=inspoSig()+closetSig()+S.marks.length+S.gapfb.length+(S.prefs?.at||0);if(autoTried===key)return;autoTried=key;refreshBuys(true)}
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
  const keys=userStyles(),atlas=myAtlas().slice(0,240);
  const owned=[...new Set([...marked("own"),...closetBrands()])],wants=marked("want"),hidden=marked("hide");
  const skipped=S.gapfb.filter(f=>f.verdict==="skip").map(f=>f.item),bought=S.gapfb.filter(f=>f.verdict==="bought").map(f=>f.item);
  const prompt=`You're helping someone decide their next clothing buys. ${personText()} ${bodyText()} They want reasonably priced, long-lasting pieces and rotate between these styles: ${styleDefs(keys)}. ${tasteText()}
${pr?`Their style profile from ${pr.n||"their"} saved inspo pins: ${pr.summary} Silhouettes: ${(pr.silhouettes||[]).join("; ")}. Recurring pieces: ${(pr.pieces||[]).join("; ")}. Palette: ${(pr.palette||[]).join(", ")}.${keys.map(v=>pr.vibes?.[v]?` Their ${styleName(v)}: ${pr.vibes[v]}`:"").join("")}`:""}

Their closet:
${closetText(S.items)||"(empty)"}
${owned.length?`\nBrands they already own: ${owned.join(", ")}.`:""}${wants.length?`\nBrands they want to try: ${wants.join(", ")} (prefer these when they fit).`:""}${hidden.length?`\nBrands they hid (never suggest): ${hidden.join(", ")}.`:""}${skipped.length?`\nThey said "not for me" to: ${skipped.join("; ")}. Don't suggest these or close variants again.`:""}${bought.length?`\nThey already bought: ${bought.join("; ")}. Don't list these again.`:""}

Find the pieces their inspo relies on that their closet is missing, ranked by how many new outfits each would unlock with what they already own. If a whole basic category is empty (for example no tees or shirts listed), they may simply not have added them yet: mention that in "note" instead of listing basics as buys.
Put the size to buy in "size" using their sizes above when the piece is sized; otherwise "".
For each gap, pick 2-4 brands ONLY from their brand list below (brand | category | price | type | styles), within their budget and matching the style:
${atlas.map(r=>`${r.b} | ${r.c} | ${TIER[r.t]} | ${r.k} | ${(r.s||[]).join("/")}`).join("\n")}

Reply with only JSON: {"note": one sentence or "", "gaps": [{"item": specific piece with color, "vibe": one of ${JSON.stringify(keys)}, "why": one sentence tying it to their pins and closet, "pins": roughly how many of their pins show it, "unlocks": roughly how many new outfits it creates with their closet, "size": string, "atlasStyle": one of ${JSON.stringify([...keys,"all"])}, "atlasCat": "Garments"|"Shoes"|"Boots"|"Accessories"|"Where to shop", "search": one or two words to search brand notes for, or "", "brands": [exact brand names from the list]}]}
Give 5 to 7 gaps, most useful first.`;
  const r=await sample.json(prompt,{cache:false});if(!Array.isArray(r.gaps))throw{code:"invalid_json"};
  await db.collection("gaps").doc().set({note:r.note||"",gaps:r.gaps.slice(0,8),at:Date.now(),sigInspo:inspoSig(),sigCloset:closetSig(),nInspo:S.inspo.length,nItems:S.items.length})}
$("g-go").onclick=()=>refreshBuys(false);
$("g-fresh-go").onclick=()=>refreshBuys(false);
async function gapVerdict(item,verdict){if(!db)return;try{await db.doc("gapfb/"+brandKey(item)).set({item,verdict,at:Date.now()});if(verdict==="skip")toast("Removed. The next list will skip it.")}catch{toast("Couldn't save that.")}}

/* ---------- built-in next buys (no AI needed) ---------- */
const focusSet=()=>new Set(S.prefs?.focus||[]);
function starterSet(){const s=new Set();userStyles().forEach(k=>(STYLES[k].starter||[]).forEach(x=>s.add(x)));return s}
function myPieces(){const st=new Set(userStyles()),f=focusSet();return PIECES.filter(p=>audOk(p.a)&&(f.has(p.key)||p.s.some(x=>st.has(x))))}
function pieceStyle(p){const st=userStyles();return p.s.find(x=>st.includes(x))||p.s[0]}
function sizeFor(p){const z=S.prefs?.sizes||{};return p.cat==="bottom"?z.bottoms||"":p.cat==="shoes"?z.shoes||"":["top","mid","outer"].includes(p.cat)?z.tops||"":""}
function tagCounts(){const c={};S.inspo.forEach(p=>(p.tags||[]).forEach(k=>c[k]=(c[k]||0)+1));return c}
// Newer pins count more (oldest ×0.75 → newest ×1.5), so the list follows where their taste is heading.
function tagWeights(){const w={};const byAge=[...S.inspo].filter(p=>(p.tags||[]).length).sort((a,b)=>(a.created||0)-(b.created||0));const n=byAge.length;
  byAge.forEach((p,i)=>{const f=n>1?.75+.75*i/(n-1):1;p.tags.forEach(k=>w[k]=(w[k]||0)+f)});return w}
function ownsPiece(p){return S.items.some(i=>i.cat===p.cat&&p.re.test(((i.name||"")+" "+(i.notes||"")+" "+(i.color||"")).toLowerCase()))}
function ruleGaps(){
  const pins=tagCounts(),wts=tagWeights(),tagged=S.inspo.filter(p=>(p.tags||[]).length).length,keys=userStyles();
  const vw={};keys.forEach(k=>vw[k]=1);
  PIECES.forEach(p=>{if(pins[p.key]){const s=pieceStyle(p);if(s in vw)vw[s]+=pins[p.key]}});S.items.forEach(i=>(i.vibes||[]).forEach(v=>{if(v in vw)vw[v]+=.5}));
  const vt=Object.values(vw).reduce((a,b)=>a+b,0)||1;
  const n=c=>S.items.filter(i=>i.cat===c).length;
  const wants=new Set(marked("want")),hidden=new Set(marked("hide")),focus=focusSet(),starter=starterSet(),budget=S.prefs?.budget||3;
  const atlas=myAtlas();const byName=new Map(allBrands().map(r=>[r.b,r]));
  const out=[];const noTops=!n("top");
  for(const p of myPieces()){if(ownsPiece(p))continue;if(noTops&&p.cat==="top"&&!focus.has(p.key))continue;
    const pc=pins[p.key]||0,st=pieceStyle(p);
    const unlocks=p.cat==="bottom"?n("top")+n("mid")+n("outer"):p.cat==="shoes"?n("bottom"):p.cat==="acc"?Math.ceil(S.items.length/3):n("bottom");
    const sc=(wts[p.key]||0)*3+(focus.has(p.key)?6:0)+(starter.has(p.key)?1:0)+3*(vw[st]||0)/vt+Math.min(unlocks,12)*.25;
    const why=[];
    if(pc)why.push(`in ${pc} of your ${tagged} tagged pins`);
    if(focus.has(p.key))why.push("it's on your want-more-of list");else if(!pc&&starter.has(p.key))why.push(`a ${styleName(st).toLowerCase()} starter piece you don't own yet`);
    if(unlocks)why.push(`works with ${unlocks} piece${unlocks>1?"s":""} you own`);
    const w=why.join("; ");
    const fits=b=>{const r=byName.get(b);return r&&!hidden.has(b)&&audOk(r.a)&&(r.t<=budget||r.k==="Buy used")};
    let br=[...atlas.filter(r=>wants.has(r.b)&&r.c===p.ac&&(r.s||[]).some(x=>p.s.includes(x))).map(r=>r.b),...p.brands.filter(fits)];
    if(!br.length)br=p.brands.filter(b=>byName.has(b)&&audOk(byName.get(b).a));
    br=br.filter((b,i,a)=>a.indexOf(b)===i).slice(0,4);
    out.push({sc,item:p.label,vibe:st,why:w.charAt(0).toUpperCase()+w.slice(1)+".",pins:pc,unlocks,size:sizeFor(p),atlasStyle:st,atlasCat:p.ac,search:"",brands:br});}
  out.sort((a,b)=>b.sc-a.sc);
  const notes=[];
  if(!S.prefs)notes.push("Take the style quiz in You & settings so this list matches your styles.");
  if(noTops)notes.push("Your closet has no tees or shirts yet, so they're left off this list. Add the ones you own and any real gaps will show up here.");
  if(S.inspo.length&&!tagged)notes.push("Tag the pieces in your pins (Inspo tab) and this list starts following what you save.");
  return {note:notes.join(" "),gaps:out.slice(0,7),at:Date.now(),rules:true};
}
function tagSummary(){const pins=tagCounts(),keys=Object.keys(pins).filter(k=>PIECE[k]).sort((a,b)=>pins[b]-pins[a]);if(!keys.length)return "";
  const vc={};userStyles().forEach(k=>vc[k]=0);keys.forEach(k=>{const s=pieceStyle(PIECE[k]);if(s in vc)vc[s]+=pins[k]});const t=Object.values(vc).reduce((a,b)=>a+b,0)||1;
  return `<p>What your pins keep showing, from ${S.inspo.filter(p=>(p.tags||[]).length).length} tagged pins.</p><div class="profile">
    <div><span class="label">Recurring pieces</span><ul>${keys.slice(0,8).map(k=>`<li>${esc(PIECE[k].short)} <span class="muted">× ${pins[k]}</span></li>`).join("")}</ul></div>
    <div><span class="label">Style mix in your pins</span><ul>${Object.entries(vc).map(([v,c])=>`<li>${esc(styleName(v))} <span class="muted">${Math.round(c/t*100)}%</span></li>`).join("")}</ul></div>
    <div><span class="label">Still missing from your closet</span><ul>${keys.filter(k=>!ownsPiece(PIECE[k])).slice(0,5).map(k=>`<li>${esc(PIECE[k].short)}</li>`).join("")||"<li>Nothing, you own every piece you've pinned.</li>"}</ul></div></div>`}
let tagging=null;
function openTagSheet(p){if(!p)return;tagging=p;$("t-img").src=src(p.img);const cur=new Set(p.tags||[]);
  const mine=myPieces(),shown=new Set();const chip=x=>`<label class="chip"><input type="checkbox" value="${x.key}"${cur.has(x.key)?" checked":""}>${esc(x.short)}</label>`;
  const groups=userStyles().map(v=>{const list=mine.filter(x=>pieceStyle(x)===v&&!shown.has(x.key));list.forEach(x=>shown.add(x.key));
    return list.length?`<div class="t-group"><span class="label">${esc(styleName(v))}</span><div class="chips">${list.map(chip).join("")}</div></div>`:""});
  const extra=PIECES.filter(x=>!shown.has(x.key)&&audOk(x.a));
  $("t-groups").innerHTML=groups.join("")+(extra.length?`<details class="t-more"${extra.some(x=>cur.has(x.key))?" open":""}><summary class="label">More pieces</summary><div class="chips">${extra.map(chip).join("")}</div></details>`:"");
  $("tagsheet").hidden=false}
$("t-close").onclick=()=>$("tagsheet").hidden=true;
$("tagsheet").addEventListener("click",e=>{if(e.target.id==="tagsheet")$("tagsheet").hidden=true});
$("t-save").onclick=async()=>{if(!tagging||!db)return;const tags=[...$("t-groups").querySelectorAll("input:checked")].map(i=>i.value);const {id,...rest}=tagging;
  try{await db.doc("inspo/"+id).set({...rest,tags});$("tagsheet").hidden=true;toast(tags.length?"Tags saved. Next buys updated.":"Tags cleared.")}catch{toast("Couldn't save the tags.")}};

/* ---------- brands ---------- */
function applyStyleColors(){let l="",d="";for(const [k,v] of Object.entries(STYLES)){l+=`--st-${k}:${v.c[0]};`;d+=`--st-${k}:${v.c[1]};`}
  let el=document.getElementById("st-colors");if(!el){el=document.createElement("style");el.id="st-colors";document.head.appendChild(el)}
  el.textContent=`:root{${l}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${d}}}:root[data-theme="dark"]{${d}}`}
applyStyleColors();
const stColor=k=>k==="all"?"var(--ink)":`var(--st-${k})`;
const B={style:"all",cat:null,tier:null,tag:null,mine:false,hidden:false,allPrices:false,q:""};
try{const s=JSON.parse(localStorage.getItem("rot-brands2")||"null");if(s)Object.assign(B,s,{q:""})}catch{}
function saveB(){try{localStorage.setItem("rot-brands2",JSON.stringify({style:B.style,cat:B.cat,tier:B.tier,tag:B.tag,mine:B.mine,allPrices:B.allPrices}))}catch{}}
function brandStem(n){const t=normTxt(n.split("/")[0]).split(" ");let s="";for(const w of t){s=(s?s+" ":"")+w;if(s.replace(/ /g,"").length>=4)break}return s}
function closetBrands(){const txt=" "+S.items.map(i=>normTxt(i.name+" "+(i.notes||"")+" "+(i.fitNotes||""))).join(" | ")+" ";
  const out=new Set();for(const r of allBrands()){if(r.c==="Where to shop")continue;const s=brandStem(r.b);if(s.length>=4&&txt.includes(" "+s+" "))out.add(r.b)}return [...out]}
function listBrands(){const s=new Set();for(const x of liveGaps())for(const n of (x.brands||[])){const r=findBrand(n);if(r)s.add(r.b)}return s}
function renderMix(){renderBrandCount();const keys=userStyles(),c={};keys.forEach(k=>c[k]=0);S.items.forEach(i=>(i.vibes||[]).forEach(v=>{if(v in c)c[v]++}));
  const tot=Object.values(c).reduce((a,b)=>a+b,0);const own=new Set([...marked("own"),...closetBrands()]).size,lst=listBrands().size;
  $("b-mix").innerHTML=(tot?`<span>Closet mix ${keys.map(k=>`<b>${esc(styleName(k))} ${Math.round(c[k]/tot*100)}%</b>`).join(" · ")}</span>`:"")+
    `<span><b>${myAtlas().length}</b> brands in your atlas</span><span><b>${own}</b> you own</span><span><b>${lst}</b> on your next-buys list</span>`}
function bChips(id,key,vals,lab){$(id).innerHTML=`<button class="b-chip" data-v="" aria-pressed="${B[key]===null}">Any</button>`+vals.map(v=>`<button class="b-chip" data-v="${esc(v)}" aria-pressed="${String(B[key])===String(v)}">${esc(lab?lab(v):v)}</button>`).join("");
  $(id).querySelectorAll("button").forEach(b=>b.onclick=()=>{const v=b.dataset.v;B[key]=v===""?null:(key==="tier"?+v:v);saveB();renderBrands()})}
function brandCard(r,{own,want,onList,hiddenView,sc}){const k=brandKey(r.b),m=S.marks.find(x=>x.id===k)?.mark;
  const pill=own.has(r.b)?`<span class="b-pill">You own</span>`:onList.has(r.b)?`<span class="b-pill want">On your list</span>`:want.has(r.b)?`<span class="b-pill want">Want</span>`:r.custom?`<span class="b-pill want">Added by you</span>`:"";
  const acts=hiddenView?`<button data-k="${k}" data-b="${esc(r.b)}" data-m="hide" aria-pressed="true">Show again</button>`:
    r.c==="Where to shop"?`<button data-k="${k}" data-b="${esc(r.b)}" data-m="hide" aria-pressed="false">Hide</button>`:
    `<button data-k="${k}" data-b="${esc(r.b)}" data-m="own" aria-pressed="${m==="own"}">Own</button><button data-k="${k}" data-b="${esc(r.b)}" data-m="want" aria-pressed="${m==="want"}">Want</button>${r.custom?`<button data-rmb="${esc(r.id||k)}">Remove</button>`:`<button data-k="${k}" data-b="${esc(r.b)}" data-m="hide" aria-pressed="false">Hide</button>`}`;
  return `<div class="b-item${onList.has(r.b)?" hit":""}" style="--sc:${sc}"><span class="nm">${esc(r.b)}</span><span class="tr">${TIER[r.t]||""}</span><span class="nt">${esc(r.n||"")}</span>
    ${r.why?`<span class="why">For you: ${esc(r.why)}</span>`:""}
    <div class="ft"><span class="b-tag">${esc(r.k||"")}</span>${pill}<span class="b-mark">${acts}</span></div></div>`}
function renderBrands(){if(!$("view-brands"))return;
  const keys=userStyles();if(B.style!=="all"&&!keys.includes(B.style))B.style="all";
  const hiddenSet=new Set(marked("hide"));
  $("b-styles").innerHTML=[["all","All my styles"],...keys.map(k=>[k,styleName(k)])].map(([k,l])=>`<button class="b-style" data-s="${k}" style="--sc:${stColor(k)}" aria-pressed="${B.style===k&&!B.hidden}">${esc(l)}</button>`).join("")+
    `<button class="b-style" data-mine="1" style="--sc:var(--accent)" aria-pressed="${B.mine&&!B.hidden}">Mine &amp; my list</button>`+
    (hiddenSet.size?`<button class="b-style" data-hid="1" style="--sc:var(--muted)" aria-pressed="${B.hidden}">Hidden · ${hiddenSet.size}</button>`:"");
  $("b-styles").querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{B.style=b.dataset.s;B.hidden=false;saveB();renderBrands()});
  $("b-styles").querySelector("[data-mine]").onclick=()=>{B.mine=!B.mine;B.hidden=false;saveB();renderBrands()};
  const hb=$("b-styles").querySelector("[data-hid]");if(hb)hb.onclick=()=>{B.hidden=!B.hidden;renderBrands()};
  bChips("b-cats","cat",ATLAS_CATS);bChips("b-tags","tag",TYPES);
  const budget=S.prefs?.budget||3;
  $("b-tiers").innerHTML=[1,2,3].map(v=>`<button class="b-chip" data-v="${v}" aria-pressed="${B.tier===v}">${TIER[v]}</button>`).join("")+
    (budget<3?`<button class="b-chip" data-all="1" aria-pressed="${B.allPrices}">${B.allPrices?"Showing all prices":"Show pricier brands"}</button>`:"");
  $("b-tiers").querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{const v=+b.dataset.v;B.tier=B.tier===v?null:v;saveB();renderBrands()});
  const ab=$("b-tiers").querySelector("[data-all]");if(ab)ab.onclick=()=>{B.allPrices=!B.allPrices;saveB();renderBrands()};
  $("b-ai-go").hidden=!sample;$("b-ai-hint").hidden=!!sample;
  $("b-ai-go").textContent=S.ai?"Refresh my AI picks":"Personalize with Gemini";
  renderMix();renderKits();
  const own=new Set([...marked("own"),...closetBrands()]),want=new Set(marked("want")),onList=listBrands();
  const q=normTxt(B.q);
  const base=B.hidden?allBrands().filter(r=>hiddenSet.has(r.b)):myAtlas();
  const f=base.filter(r=>(B.hidden||B.style==="all"||(r.s||[]).includes(B.style)||(r.s||[]).includes("all")||r.custom)&&(!B.cat||r.c===B.cat)&&(!B.tier||r.t===B.tier)
    &&(B.hidden||B.allPrices||B.tier||B.mine||r.t<=budget||r.k==="Buy used"||r.custom||r.ai||own.has(r.b)||want.has(r.b))
    &&(!B.tag||r.k===B.tag)&&(!q||normTxt(r.b+" "+(r.n||"")+" "+(r.why||"")).includes(q))&&(B.hidden||!B.mine||own.has(r.b)||want.has(r.b)||onList.has(r.b)||r.custom));
  $("b-count").textContent=f.length+" brand"+(f.length===1?"":"s");
  const L=$("b-list");
  if(!f.length){L.innerHTML=`<p class="muted" style="padding:20px 0">${B.mine?"Nothing marked yet. Tap Own or Want on a brand, or build your next-buys list.":"No brands match those filters. Set one back to Any."}</p>`;return}
  const ctx={own,want,onList,hiddenView:B.hidden};
  const section=(title,blurb,sc,rows)=>`<section class="b-sec" style="--sc:${sc}"><div class="b-head"><h2>${esc(title)}</h2>${blurb?`<p>${esc(blurb)}</p>`:""}</div>`+
    ATLAS_CATS.map(c=>{const g=rows.filter(r=>r.c===c);if(!g.length)return "";return `<p class="b-h3">${c} · ${g.length}</p><div class="b-grid">`+g.map(r=>brandCard(r,{...ctx,sc})).join("")+`</div>`}).join("")+`</section>`;
  let html="",used=new Set();
  if(B.hidden){html=section("Hidden brands","Brands you hid. Tap Show again to bring one back.","var(--muted)",f)}
  else{
    const picks=f.filter(r=>r.ai);if(picks.length){picks.forEach(r=>used.add(r.b));html+=section("Picked for you",S.ai?.summary||"Chosen by Gemini from your styles, pins and closet.","var(--accent)",picks)}
    const mine=f.filter(r=>r.custom&&!used.has(r.b));if(mine.length){mine.forEach(r=>used.add(r.b));html+=section("Added by you","","var(--accent)",mine)}
    for(const k of (B.style==="all"?keys:[B.style])){const rows=f.filter(r=>!used.has(r.b)&&(r.s||[]).includes(k));rows.forEach(r=>used.add(r.b));if(rows.length)html+=section(styleName(k),STYLES[k].blurb,stColor(k),rows)}
    const shops=f.filter(r=>!used.has(r.b)&&(r.s||[]).includes("all"));if(shops.length)html+=section("Where to shop","Stores, outlets and resale sites that cover every style.","var(--ink)",shops);
  }
  L.innerHTML=html;
  L.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{if(!db){toast("Can't save in this view.");return}
    const cur=S.marks.find(x=>x.id===b.dataset.k)?.mark;try{if(cur===b.dataset.m)await db.doc("brandmarks/"+b.dataset.k).delete();
      else await db.doc("brandmarks/"+b.dataset.k).set({brand:b.dataset.b,mark:b.dataset.m,at:Date.now()});if(b.dataset.m==="hide"&&cur!=="hide")toast("Hidden. Find it under Hidden to bring it back.")}catch{toast("Couldn't save that.")}});
  L.querySelectorAll("[data-rmb]").forEach(b=>b.onclick=async()=>{try{await db.doc("mybrands/"+b.dataset.rmb).delete();toast("Removed from your atlas.")}catch{toast("Couldn't remove it.")}})}
$("b-q").addEventListener("input",e=>{B.q=e.target.value;renderBrands()});
function renderKits(){const keys=userStyles(),atlas=myAtlas(),budget=S.prefs?.budget||3;
  $("b-kits").innerHTML=keys.map(k=>{const items=(STYLES[k].starter||[]).map(x=>PIECE[x]).filter(p=>p&&audOk(p.a));
    return `<div class="box" style="border-top:3px solid ${stColor(k)}"><h4>${esc(styleName(k))} starter kit</h4><ol>${items.map(p=>{const b=p.brands.find(n=>atlas.some(r=>r.b===n&&(r.t<=budget||r.k==="Buy used")))||p.brands.find(n=>atlas.some(r=>r.b===n));return `<li>${esc(p.label)}${b?` <span class="muted">(${esc(b)})</span>`:""}</li>`}).join("")}</ol></div>`}).join("")+
    `<div class="box"><h4>How to tell quality</h4><ul><li>Tees: 6 oz or heavier cotton, tight collar ribbing</li><li>Knits: wool, merino or cashmere, not acrylic blends</li><li>Down: 600+ fill power</li><li>Shoes: full-grain leather; Goodyear-welted boots can be resoled</li><li>Look for repair programs and lifetime warranties</li></ul></div>`}
// Add your own brand
$("b-add").onclick=()=>{$("bf").reset();$("bf-style").innerHTML=userStyles().map(k=>`<option value="${k}">${esc(styleName(k))}</option>`).join("")+`<option value="all">Any style (a store)</option>`;$("bf-msg").textContent="";$("brandsheet").hidden=false};
$("bf-close").onclick=()=>$("brandsheet").hidden=true;
$("brandsheet").addEventListener("click",e=>{if(e.target.id==="brandsheet")$("brandsheet").hidden=true});
$("bf").onsubmit=async e=>{e.preventDefault();const name=$("bf-name").value.trim();if(!name){$("bf-msg").textContent="Give it a name.";return}if(!db)return;
  const st=$("bf-style").value;const doc={b:name,c:st==="all"?"Where to shop":$("bf-cat").value,t:+$("bf-tier").value,k:"Mine",n:$("bf-note").value.trim(),s:[st],a:"u",at:Date.now()};
  try{await db.doc("mybrands/"+brandKey(name)).set(doc);$("brandsheet").hidden=true;toast("Added to your atlas.")}catch{$("bf-msg").textContent="Couldn't save it. Try again."}};
// Gemini-curated picks
async function aiAtlas(){const keys=userStyles(),pins=tagCounts();
  const topPins=Object.entries(pins).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,c])=>`${PIECE[k]?.short||k} ×${c}`).join(", ");
  const own=[...new Set([...marked("own"),...closetBrands()])],want=marked("want"),hidden=marked("hide");
  const prompt=`You're curating a personal brand guide for one person. ${personText()} Their styles: ${styleDefs(keys)}. ${tasteText()}
${S.profile?`Their style profile from saved inspo: ${S.profile.summary}`:""}
${topPins?`Pieces that keep showing up in their saved pins: ${topPins}.`:""}
Their closet: ${S.items.map(i=>i.name).join("; ")||"(empty so far)"}
${own.length?`Brands they own: ${own.join(", ")}.`:""} ${want.length?`Brands they want: ${want.join(", ")}.`:""} ${hidden.length?`Brands they hid (never suggest): ${hidden.join(", ")}.`:""}
Suggest 20 to 30 brands that fit this person specifically: a mix of well-known, niche and newer labels, mostly within their budget, plus a few resale picks for pricier pieces. Include brands outside the obvious ones. Only real, currently operating brands.
Reply with only JSON: {"summary": one sentence on how you tailored the list, "picks": [{"brand": name, "category": "Garments"|"Shoes"|"Boots"|"Accessories"|"Where to shop", "price": 1|2|3, "type": "Tested"|"Niche"|"Rising"|"Buy used", "style": one of ${JSON.stringify([...keys,"all"])}, "note": one short sentence on what to buy there, "why": one short sentence tying it to their taste}]}`;
  const r=await sample.json(prompt,{cache:false,modelTier:"complex"});if(!Array.isArray(r.picks))throw{code:"invalid_json"};
  const picks=r.picks.filter(p=>p&&p.brand).slice(0,32).map(p=>({b:String(p.brand).slice(0,80),c:ATLAS_CATS.includes(p.category)?p.category:"Garments",t:[1,2,3].includes(+p.price)?+p.price:2,
    k:TYPES.includes(p.type)?p.type:"Rising",s:[keys.includes(p.style)||p.style==="all"?p.style:keys[0]],a:"u",n:String(p.note||"").slice(0,200),why:String(p.why||"").slice(0,200)}));
  await db.doc("aiatlas/latest").set({summary:String(r.summary||"").slice(0,240),picks,at:Date.now()})}
$("b-ai-go").onclick=async()=>{if(!sample)return;$("b-ai-go").disabled=true;$("b-ai-status").textContent="Gemini is picking brands for you… this can take a minute.";
  try{await aiAtlas();$("b-ai-status").textContent="Done. Your picks are at the top.";B.style="all";B.mine=false;B.hidden=false;renderBrands()}
  catch(e){$("b-ai-status").textContent=e.code?sampleErr(e):"Couldn't save your picks."}finally{$("b-ai-go").disabled=false}};

/* ---------- style quiz ---------- */
const OB={step:0,d:null};
function openOnboard(){const p=S.prefs||{};const legacy=[...new Set(S.items.flatMap(i=>i.vibes||[]))].filter(k=>STYLES[k]);
  OB.d={name:p.name||"",shop:p.shop||"",styles:[...(p.styles||legacy)],budget:p.budget||2,sizes:{tops:"",bottoms:"",shoes:"",...(p.sizes||{})},focus:[...(p.focus||[])]};
  OB.step=0;OB.edit=!!S.prefs;$("onboard").hidden=false;document.body.classList.add("locked");renderOnboard()}
function closeOnboard(){$("onboard").hidden=true;document.body.classList.remove("locked")}
function renderOnboard(){const d=OB.d,box=$("ob-body"),N=4;
  const head=(t,h,p)=>`<p class="label">Step ${OB.step+1} of ${N} · ${t}</p><h2>${h}</h2>${p?`<p class="muted">${p}</p>`:""}`;
  let html="";
  if(OB.step===0){html=head("About you",OB.edit?"Your style":"Let's set up your closet","A few quick questions so fits, next buys and your brand atlas match you. You can change any of this later.")+
    `<div class="field"><label class="label" for="ob-name">What should we call you?</label><input type="text" id="ob-name" autocomplete="given-name" value="${esc(d.name)}" placeholder="First name or nickname"></div>
     <div class="field"><span class="label">Which clothes do you shop for?</span><div class="chips ob-radio">${[["mens","Menswear"],["womens","Womenswear"],["both","Both"]].map(([v,l])=>`<label class="chip"><input type="radio" name="ob-shop" value="${v}"${d.shop===v?" checked":""}>${l}</label>`).join("")}</div></div>`}
  else if(OB.step===1){html=head("Your styles","Pick the styles you wear","Choose 1 to 4. Your brand atlas and next buys are built from these.")+
    `<div class="ob-grid">${STYLE_KEYS.map(k=>`<label class="ob-card" style="--sc:${stColor(k)}"><input type="checkbox" value="${k}"${d.styles.includes(k)?" checked":""}><span class="ob-rot"><canvas data-kit="${k}" width="160" height="280"></canvas></span><span class="ob-text"><span class="ob-name">${esc(STYLES[k].name)}</span><span class="ob-blurb">${esc(STYLES[k].blurb)}</span></span></label>`).join("")}</div>`}
  else if(OB.step===2){html=head("Budget and sizes","What do you usually spend?","Brands above your budget stay hidden unless you ask for them.")+
    `<div class="chips ob-radio">${[[1,"Mostly budget ($)"],[2,"Up to mid-range ($$)"],[3,"Anything, including $$$ and resale"]].map(([v,l])=>`<label class="chip"><input type="radio" name="ob-budget" value="${v}"${d.budget===v?" checked":""}>${l}</label>`).join("")}</div>
     <p class="label" style="margin-top:6px">Your sizes (optional)</p>
     <div class="field"><label class="label" for="ob-tops">Tops</label><input type="text" id="ob-tops" value="${esc(d.sizes.tops)}" placeholder="M, or 40 chest"></div>
     <div class="field"><label class="label" for="ob-bottoms">Bottoms</label><input type="text" id="ob-bottoms" value="${esc(d.sizes.bottoms)}" placeholder="30W x 32L, or 27"></div>
     <div class="field"><label class="label" for="ob-shoes">Shoes</label><input type="text" id="ob-shoes" value="${esc(d.sizes.shoes)}" placeholder="US 10, or EU 43"></div>`}
  else{const st=new Set(d.styles);const opts=PIECES.filter(p=>audFor(d.shop,p.a)&&p.s.some(x=>st.has(x)));
    html=head("Your focus","What do you want more of?","Optional. These get extra weight in Next buys.")+
    `<div class="chips">${opts.map(p=>`<label class="chip"><input type="checkbox" value="${p.key}"${d.focus.includes(p.key)?" checked":""}>${esc(p.short)}</label>`).join("")}</div>`}
  html+=`<p class="status" id="ob-msg" aria-live="polite"></p><div class="su-actions">${OB.step>0?`<button class="btn ghost" id="ob-back">Back</button>`:OB.edit?`<button class="btn ghost" id="ob-cancel">Cancel</button>`:""}<button class="btn" id="ob-next">${OB.step<N-1?"Next":"Finish"}</button></div>`;
  box.innerHTML=html;box.scrollTop=0;$("onboard").scrollTop=0;
  if(window.ROT)box.querySelectorAll("canvas[data-kit]").forEach(cv=>{ROT.render(cv,ROT.kit(cv.dataset.kit),{scale:1,seed:3,glitch:false});const pp=ROT.PALETTES[cv.dataset.kit];if(pp)cv.parentElement.style.background=`rgb(${pp[1].join(",")})`});
  const read=()=>{if(OB.step===0){d.name=$("ob-name").value.trim();d.shop=box.querySelector('input[name="ob-shop"]:checked')?.value||""}
    else if(OB.step===1)d.styles=[...box.querySelectorAll(".ob-card input:checked")].map(i=>i.value);
    else if(OB.step===2){d.budget=+(box.querySelector('input[name="ob-budget"]:checked')?.value||2);d.sizes={tops:$("ob-tops").value.trim(),bottoms:$("ob-bottoms").value.trim(),shoes:$("ob-shoes").value.trim()}}
    else d.focus=[...box.querySelectorAll("input:checked")].map(i=>i.value)};
  if(OB.step===1)box.querySelectorAll(".ob-card input").forEach(i=>i.onchange=()=>{const n=box.querySelectorAll(".ob-card input:checked").length;if(n>4){i.checked=false;$("ob-msg").textContent="Pick up to 4 styles."}else $("ob-msg").textContent=""});
  const back=$("ob-back");if(back)back.onclick=()=>{read();OB.step--;renderOnboard()};
  const cancel=$("ob-cancel");if(cancel)cancel.onclick=closeOnboard;
  $("ob-next").onclick=async()=>{read();
    if(OB.step===0&&!d.shop){$("ob-msg").textContent="Pick which clothes you shop for.";return}
    if(OB.step===1&&!d.styles.length){$("ob-msg").textContent="Pick at least one style.";return}
    if(OB.step<N-1){OB.step++;renderOnboard();return}
    if(!db){$("ob-msg").textContent="Your closet isn't ready yet. Try again in a moment.";return}
    $("ob-next").disabled=true;
    try{await db.doc("prefs/me").set({...d,focus:d.focus.filter(k=>PIECE[k]),at:Date.now()});closeOnboard();toast(OB.edit?"Style updated":"You're all set")}
    catch{$("ob-msg").textContent="Couldn't save. Try again.";$("ob-next").disabled=false}}}
function renderStylePanel(){const box=$("stylepanel");if(!box)return;const p=S.prefs;
  if(!p){box.innerHTML=`<h2>Your style</h2><p class="muted">Take the style quiz so your brand atlas and next buys match you.</p><button class="btn" id="sp-edit" style="align-self:flex-start">Take the style quiz</button>`}
  else{const z=p.sizes||{};box.innerHTML=`<h2>Your style</h2>
    <div class="profile"><div><span class="label">Name</span><p>${esc(p.name||"Not set")}</p></div>
    <div><span class="label">Shops for</span><p>${{mens:"Menswear",womens:"Womenswear",both:"Menswear and womenswear"}[p.shop]||"Not set"}</p></div>
    <div><span class="label">Styles</span><div class="chips">${userStyles().map(k=>`<span class="chip">${esc(styleName(k))}</span>`).join("")}</div></div>
    <div><span class="label">Budget</span><p>${{1:"Mostly budget ($)",2:"Up to mid-range ($$)",3:"Anything, including $$$"}[p.budget]||"Not set"}</p></div>
    <div><span class="label">Sizes</span><p>${[z.tops&&"Tops "+esc(z.tops),z.bottoms&&"Bottoms "+esc(z.bottoms),z.shoes&&"Shoes "+esc(z.shoes)].filter(Boolean).join(" · ")||"Not set"}</p></div>
    <div><span class="label">Want more of</span><p>${(p.focus||[]).map(k=>esc(PIECE[k]?.short||k)).join(", ")||"Nothing picked"}</p></div></div>
    <button class="btn ghost" id="sp-edit" style="align-self:flex-start">Edit your style</button>`}
  $("sp-edit").onclick=openOnboard}
function renderHeader(){const n=S.prefs?.name;$("mast-eyebrow").textContent=n?`${n}'s closet`:"Closet · fits · next buys · brands"}
function renderBrandCount(){$("n-brands").textContent=myAtlas().length}
function applyPrefs(){renderRot();
  // Prefs that arrive late from sync (slow network) close a first-run quiz that opened too early.
  if(S.prefs&&!OB.edit&&!$("onboard").hidden)closeOnboard();
  renderBrandCount();renderVibeSelect();renderVibeChips();renderHeader();renderStylePanel();renderGaps();renderInspo();if(S.tab==="brands")renderBrands();renderFresh()}

/* ---------- ROT: the face and voice of the app ---------- */
function mainStyle(){const keys=userStyles();const c={};S.items.forEach(i=>(i.vibes||[]).forEach(v=>{if(keys.includes(v))c[v]=(c[v]||0)+1}));
  return keys.slice().sort((a,b)=>(c[b]||0)-(c[a]||0))[0]||keys[0]||"streetwear"}
function applyTheme(){if(!window.ROT)return;const pal=ROT.PALETTES[mainStyle()]||ROT.PALETTES.streetwear;const r=document.documentElement.style;
  r.setProperty("--p-ink",pal[0].join(" "));r.setProperty("--p-paper",pal[1].join(" "));r.setProperty("--p-acc",pal[2].join(" "));
  document.querySelectorAll('meta[name="theme-color"]').forEach((m,i)=>m.content=i===0?`rgb(${pal[1].join(",")})`:`rgb(${pal[0].join(",")})`)}
let rotOutfit=null,rotT=null;
function renderRot(){clearTimeout(rotT);rotT=setTimeout(()=>{if(!window.ROT)return;
  rotOutfit=ROT.outfitFor({style:mainStyle(),items:S.items,pins:tagCounts(),focus:S.prefs?.focus||[]});
  ROT.render($("rot-cv"),rotOutfit,{scale:1,seed:7,glitch:true,body:rotBody()});if(S.tab==="you")drawYou();applyTheme();sayNow()},60)}
function rotLine(t){const n=S.items.length,st=styleName(mainStyle()).toLowerCase();
  const worn=(rotOutfit?.detail||[]).find(d=>d.owned&&["outer","mid","top"].includes(ROT.SLOT[d.k]));
  const wornItem=worn&&S.items.find(i=>{const p=PIECE[worn.k];return p&&i.cat===p.cat&&p.re.test(((i.name||"")+" "+(i.notes||"")).toLowerCase())});
  if(t==="make"){if(n<3)return "i need a top, bottoms and shoes before i can dress you.";if(S.lastFits.length)return "rate them. i learn from every tap.";
    return `${$("m-temp").value||60}° and ${($("m-wx").value||"clear").toLowerCase()}. want three fits?`}
  if(t==="closet"){if(!n)return "empty closet. add a piece and i'll start wearing it.";return `${n} pieces. mostly ${st}.${wornItem?` wearing your ${wornItem.name.toLowerCase()} right now.`:""}`}
  if(t==="buys"){const g=liveGaps()[0];return g?`${g.item.toLowerCase()}. that's the gap.`:"tag the pieces in your pins and i'll find what's missing."}
  if(t==="brands")return `${myAtlas().length} brands for ${userStyles().map(k=>styleName(k).toLowerCase()).join(", ")}. hide what isn't you.`;
  if(t==="inspo"){const c=tagCounts(),top=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];if(!S.inspo.length)return "drop screenshots here. i read what you save.";
    return top?`${S.inspo.length} pins. ${(PIECE[top]?.short||top).toLowerCase()} keeps showing up.`:`${S.inspo.length} pins. tag what's in them so i can read them.`}
  if(t==="you")return `${S.prefs?.name?S.prefs.name.toLowerCase()+", ":""}this is you. i copy what you wear.`;
  if(t==="saved")return S.fits.length?`${S.fits.length} saved fit${S.fits.length>1?"s":""}. the good ones.`:"save a fit and it lives here.";
  return "ready."}
let sayTimer=null,lastSaid="";
function say(text,animate){const el=$("rot-say");if(!el)return;clearInterval(sayTimer);lastSaid=text;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!animate||reduce){el.textContent=text;return}
  let i=0;el.textContent="";const caret=document.createElement("span");caret.className="rot-caret";
  sayTimer=setInterval(()=>{i+=2;el.textContent=text.slice(0,i);el.appendChild(caret);if(i>=text.length){clearInterval(sayTimer);el.textContent=text}},22)}
function sayNow(animate){const t=rotLine(S.tab);if(t!==lastSaid||animate)say(t,animate)}
let showColor=false;try{showColor=localStorage.getItem("rot-color")==="1"}catch{}
function applyColorToggle(){document.body.classList.toggle("show-color",showColor);$("c-color").setAttribute("aria-pressed",showColor);$("c-color").textContent=showColor?"Two-tone":"Show colors"}
$("c-color").onclick=()=>{showColor=!showColor;try{localStorage.setItem("rot-color",showColor?"1":"0")}catch{}applyColorToggle()};
applyColorToggle();

/* ---------- ROT try-on (replaces the 3D mannequin) ---------- */
// ROT's build: wider for broader/heavier builds, taller or shorter with height
function rotBody(b){b=Object.assign({},BODY_DEF,b||S.body||{});const d=dims(b);
  const sx=clamp(0.9+(d.g-0.82)*0.28+(d.sh-1)*0.5,0.86,1.2),sy=clamp(0.9+(d.inches-62)*0.011,0.9,1.05);return {sx,sy}}
let mqState=null;
function drawTryOn(){if(!mqState||!window.ROT)return;const its=$("mq-jacket").checked?mqState.its:mqState.its.filter(i=>i.cat!=="outer");
  const style=STYLES[mqState.vibe]?mqState.vibe:mainStyle();ROT.render($("mq-rot"),ROT.outfitFromItems(its,style),{scale:2,seed:9,glitch:false,body:rotBody()})}
function openMannequin(ids,title,vibe){const its=fitItems(ids);mqState={its,vibe};$("mq-title").textContent=title||"ROT tries it on";
  $("mq-jacket-wrap").hidden=!its.some(i=>i.cat==="outer");$("mq-jacket").checked=true;
  $("mq-legend").innerHTML=its.map(i=>{const worn=!!ROT.matchPiece(i);
    return `<li><span class="sw" style="background:${colorOf(i)}"></span>${esc(i.name)} <span class="muted">· ${worn?esc(i.sil):"not drawn yet"}</span></li>`}).join("");
  $("mq-say").textContent=its.some(i=>i.cat==="outer")?"this is me in your fit. toggle the jacket to see what's under it.":"this is me in your fit.";
  $("mq-body-note").hidden=!!S.body;$("mq").hidden=false;drawTryOn()}
function closeMannequin(){$("mq").hidden=true}
$("mq-close").onclick=closeMannequin;$("mq").addEventListener("click",e=>{if(e.target.id==="mq")closeMannequin()});
$("mq-jacket").onchange=drawTryOn;

/* ---------- you tab ---------- */
let yT=null;
function drawYou(body){if(!window.ROT||!$("you-rot"))return;const o=rotOutfit||ROT.outfitFor({style:mainStyle(),items:S.items,pins:tagCounts(),focus:S.prefs?.focus||[]});
  ROT.render($("you-rot"),o,{scale:2,seed:7,glitch:true,body:rotBody(body)});
  const owned=o.detail?o.detail.filter(d=>d.owned).length:0,pinned=o.detail?o.detail.filter(d=>d.pinned&&!d.owned).length:0;
  $("you-rot-note").textContent=`${owned} piece${owned===1?"":"s"} from your closet, ${pinned} from your pins. style: ${styleName(mainStyle()).toLowerCase()}.`}
function openYou(){fillBodyForm();drawYou()}
function closeYou(){}
["b-ft","b-in","b-lb","b-build","b-sh","b-prop"].forEach(id=>$(id).addEventListener("input",()=>{clearTimeout(yT);yT=setTimeout(()=>drawYou(readBodyForm()),80)}));
$("b-save").onclick=async()=>{if(!db){toast("Can't save in this view.");return}const b=readBodyForm();$("b-save").disabled=true;
  try{await db.doc("body/me").set({...b,at:Date.now()});toast("Build saved")}catch{toast("Couldn't save. Try again.")}finally{$("b-save").disabled=false}};

/* ---------- saved ---------- */
function renderSaved(){$("n-saved").textContent=S.fits.length;const l=$("s-list");
  l.innerHTML=S.fits.length?S.fits.map(f=>fitCard(f,0,"saved")).join(""):`<div class="empty"><h3>No saved fits</h3><p>Hit Save on a fit you'd actually wear and it lands here.</p></div>`;
  l.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const f=S.fits.find(x=>x.id===b.dataset.mq);if(f)openMannequin(f.items,f.title,f.vibe)});
  l.querySelectorAll("[data-unsave]").forEach(b=>b.onclick=async()=>{try{await db.doc("fits/"+b.dataset.unsave).delete()}catch{toast("Couldn't remove.")}});}

function renderAll(){renderCloset();renderInspo();renderSaved();renderRecreate();renderGaps();renderHeader();renderStylePanel()}
renderAll();RP.renderSettings();renderRot();const HASH_TAB=(location.hash||"").slice(1);const START=["make","closet","buys","brands","inspo","you","saved"].includes(HASH_TAB)?HASH_TAB:null;setTab(START||"closet");

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
  sub(db.collection("items").orderBy("created","desc"),"items",()=>{renderRot();renderCloset();renderFits();renderFresh();if(!sample)renderGaps();if(S.tab==="brands")renderBrands()});
  db.doc("prefs/me").onSnapshot(d=>{S.prefs=d.exists?d.data():null;applyPrefs()},()=>{});
  sub(db.collection("brandmarks"),"marks",()=>{renderBrandCount();renderFresh();if(!sample)renderGaps();if(S.tab==="brands")renderBrands()});
  sub(db.collection("mybrands"),"mybrands",()=>{renderBrandCount();if(!sample)renderGaps();if(S.tab==="brands")renderBrands()});
  db.doc("aiatlas/latest").onSnapshot(d=>{S.ai=d.exists?d.data():null;renderBrandCount();if(!sample)renderGaps();if(S.tab==="brands")renderBrands()},()=>{});
  sub(db.collection("gapfb"),"gapfb",()=>{renderGaps();if(S.tab==="brands")renderBrands()});
  sub(db.collection("inspo").orderBy("created","desc"),"inspo",()=>{renderRot();renderInspo();renderFresh();if(!sample)renderGaps();if(S.recreate&&!S.inspo.find(p=>p.id===S.recreate.id)){S.recreate=null;renderRecreate()}});
  sub(db.collection("fits").orderBy("at","desc").limit(60),"fits",()=>{renderSaved();sayNow()});
  sub(db.collection("feedback").orderBy("at","desc").limit(60),"feedback",()=>{});
  db.collection("profile").orderBy("at","desc").limit(1).onSnapshot(q=>{S.profile=q.docs[0]?q.docs[0].data():null;renderInspo()},()=>{});
  db.collection("gaps").orderBy("at","desc").limit(1).onSnapshot(q=>{S.gaps=q.docs[0]?q.docs[0].data():null;renderGaps();if(S.tab==="brands")renderBrands();if(S.tab==="buys")maybeAutoRefresh()},()=>{});
  db.doc("body/me").onSnapshot(d=>{S.body=d.exists?d.data():null;renderRot();if(S.tab==="you")fillBodyForm()},()=>{});
  // New here? Ask the style quiz once the account's data has had a chance to sync down.
  await RP.firstSync;if(!S.prefs)openOnboard();
})();
