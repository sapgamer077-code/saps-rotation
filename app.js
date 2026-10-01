/* Rotation — app. Everything personal (styles, sizes, focus, brands) comes from each user's own prefs. */

const CATS=[["top","Tee / shirt"],["mid","Hoodie / knit"],["outer","Jacket / coat"],["bottom","Pants / shorts"],["shoes","Shoes"],["acc","Accessory"]];
const CATNAME=Object.fromEntries(CATS);
const S={items:[],inspo:[],fits:[],feedback:[],marks:[],gapfb:[],mybrands:[],wears:[],swipes:[],prices:[],pricealerts:[],fitref:[],sizes:null,trends:null,pool:[],ai:null,prefs:null,loaded:false,profile:null,gaps:null,body:null,filter:"all",tab:null,recreate:null,editing:null,pending:{flat:null,body:null},lastFits:[]};
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
    (z.tops||z.bottoms||z.shoes)?`Sizes: tops ${z.tops||"not given"}, bottoms ${z.bottoms||"not given"}, shoes ${z.shoes||"not given"}.`:"",typeof sizeText==="function"?sizeText():""].filter(Boolean).join(" ")}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2600)}
function sampleErr(e){const c=e&&e.code;return c==="bad_key"||c==="not_granted"?"Google rejected your Gemini key. Check it in You → Settings.":c==="rate_limited"?"Today's free Gemini limit is used up. Try again tomorrow.":c==="bad_model"?"That Gemini model isn't available. Change it in You → Settings.":c==="invalid_json"?"The answer came back garbled. Try again.":c==="network"?"Couldn't reach Gemini. Check your connection.":c==="cancelled"?"Stopped.":"Gemini couldn't answer"+(e&&e.message?": "+e.message:".")}

/* ---------- tabs ---------- */
function setTab(t){const prev=S.tab;S.tab=t;for(const b of document.querySelectorAll(".tab"))b.setAttribute("aria-selected",b.dataset.tab===t);
  for(const v of ["make","closet","buys","brands","inspo","you","saved"])$("view-"+v).hidden=v!==t;
  if(t==="brands")renderBrands();if(t==="buys")maybeAutoRefresh();
  if(t==="you")openYou();else if(prev==="you")closeYou();if(prev!==t&&typeof sayNow==="function")sayNow(true);if(t==="buys"&&typeof loadProducts==="function")loadProducts().then(renderLikes);}
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
  <span class="meta"><span class="label">${esc(CATNAME[it.cat]||it.cat)} · ${esc(it.sil)} · ${esc(it.len)}</span><span class="name">${esc(it.name)}</span><span class="muted" style="font-size:.85rem">${esc(it.color||"")}</span>${wornLabel(it)}</span></button>`}
function renderCloset(){renderFilters();$("n-closet").textContent=S.items.length;
  const box=$("c-body");
  if(!S.items.length){box.innerHTML=`<div class="empty"><h3>Your closet is empty</h3><p>Add each piece with a photo. The tags and "how it fits you" notes are what the fit maker reasons from, so it's worth a few seconds per item.</p>
    <p class="label">Photo tips</p><ul><li>Flat-lay on a bed or floor, or on a hanger against a plain wall. Daylight from a window, no flash.</li>
    <li>No full-length mirror? Prop your phone at waist height, use the 10-second timer, and stand 6–8 ft back.</li>
    <li>On-body shots matter most for pants, jackets, and anything cropped or oversized.</li></ul></div>`;return}
  renderReport();const list=sortCloset(S.items.filter(i=>S.filter==="all"?true:S.filter==="wash"?i.wash:i.cat===S.filter));
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
    $("f-len").value=it.len||"regular";$("f-warm").value=String(it.warmth||2);$("f-fit").value=it.fitNotes||"";$("f-notes").value=it.notes||"";$("f-wash").checked=!!it.wash;$("f-brand").value=it.brand||"";$("f-price").value=it.price||"";
    FORMV.forEach(v=>$("fv-"+v).checked=(it.vibes||[]).includes(v));}
  setPreview("flat",it?.flat&&src(it.flat));setPreview("body",it?.body&&src(it.body));
  $("f-wear").hidden=!it;if(it){$("f-wear-stat").textContent=wearStatText(it);$("f-wore").textContent=wornToday([it.id])?"Logged today ✓":"Wore it today"}
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
      warmth:+$("f-warm").value,vibes:FORMV.filter(v=>$("fv-"+v).checked),fitNotes:$("f-fit").value.trim(),notes:$("f-notes").value.trim(),wash:$("f-wash").checked,brand:$("f-brand").value.trim(),price:+$("f-price").value||0,
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
function closetText(items){return items.map(i=>`${i.id} | ${i.name} | ${CATNAME[i.cat]||i.cat} | ${i.color} | ${i.sil}, ${i.len} | warmth ${i.warmth} | vibes: ${(i.vibes||[]).join("/")||"-"}${i.fitNotes?` | fit on them: ${i.fitNotes}`:""}${i.notes?` | note: ${i.notes}`:""}${typeof wearOf==="function"&&S.wears.length?(w=>` | worn ${w.n}x${w.n?`, last ${w.since}d ago`:""}`)(wearOf(i)):""}`).join("\n")}
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
  <div class="row" style="gap:6px"><button class="btn ghost small" data-mq="${mode==="new"?i:esc(f.id)}">ROT tries it on</button><button class="btn ghost small" data-share="${mode==="new"?i:esc(f.id)}">Share</button><button class="btn ghost small" data-stand="${mode==="new"?i:esc(f.id)}">In your pic</button></div></div></div>
  ${mode==="new"?`<div class="votes"><button class="btn ghost small ${voted===1?"voted-up":""}" data-v="1" data-i="${i}">Good fit</button><button class="btn ghost small ${voted===-1?"voted-down":""}" data-v="-1" data-i="${i}">Not it</button><button class="btn ghost small" data-save="${i}">${f.saved?"Saved":"Save"}</button><button class="btn ghost small${wornToday(f.items)?" voted-wore":""}" data-wore="${i}">${wornToday(f.items)?"Wore it ✓":"Wore this"}</button></div>`
  :`<div class="votes"><button class="btn ghost small${wornToday(f.items)?" voted-wore":""}" data-wores="${esc(f.id)}">${wornToday(f.items)?"Wore it ✓":"Wore this"}</button><button class="btn ghost small" data-unsave="${esc(f.id)}">Remove</button></div>`}</article>`}
function renderFits(){if(typeof sayNow==="function")sayNow();const o=$("m-out");o.innerHTML=S.lastFits.map((f,i)=>fitCard(f,i,"new")).join("");
  o.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const f=S.lastFits[+b.dataset.mq];openMannequin(f.items,f.title,f.vibe)});
  o.querySelectorAll("[data-v]").forEach(b=>b.onclick=async()=>{const f=S.lastFits[+b.dataset.i];f.vote=+b.dataset.v;renderFits();
    if(db)try{await db.doc("feedback/"+f.key).set({title:f.title,items:f.items,vote:f.vote,at:Date.now()})}catch{}});
  o.querySelectorAll("[data-stand]").forEach(b=>b.onclick=()=>{const f=S.lastFits[+b.dataset.stand];openStand(f.items,f.vibe)});
  o.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>{const f=S.lastFits[+b.dataset.share];shareFit(f.items,f.title,f.why,f.vibe)});
  o.querySelectorAll("[data-wore]").forEach(b=>b.onclick=()=>{const f=S.lastFits[+b.dataset.wore];logWear(f.items,f.title)});
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
    if(S.wears.length){for(const it of [t,m,o,b,sh].filter(Boolean)){const w=wearOf(it);if(w.since>=21)sc+=0.6;else if(w.since<=1&&w.n)sc-=0.8}
      const idle=[t,m,o,b].filter(Boolean).find(it=>wearOf(it).since>=21);if(idle&&!why.some(x=>/sitting/.test(x)))why.push(`your ${idle.name.toLowerCase()} has been sitting ${wearOf(idle).since} days`)}
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
  // On-body shots: the pieces whose shape matters most first (pants, jackets, layers), small so it stays fast
  const PRI={bottom:0,outer:1,mid:2,top:3,shoes:4,acc:5};
  const room=Math.max(0,Math.min(10,(imgMax||12)-imgs.length-1));
  const withBody=pool.filter(i=>i.body).sort((a,b)=>(PRI[a.cat]??9)-(PRI[b.cat]??9)).slice(0,room);
  const bodyShots=[];if(withBody.length){$("m-status").textContent=`Looking at ${withBody.length} on-body shot${withBody.length>1?"s":""}…`;
    for(const it of withBody){const b=await blobFor(it.body);if(b){bodyShots.push({it,b:await shrink(b,448)})}}}
  imgs=imgs.concat(bodyShots.map(x=>x.b));
  const bodyNote=bodyShots.length?`\nOn-body photos of their own pieces are attached${recreate?" after the inspo image":""}, in this order: ${bodyShots.map((x,k)=>`photo ${k+1+(recreate?1:0)} = ${x.it.id} (${x.it.name})`).join("; ")}. Look at them to judge how each piece actually sits on this person: rise, where hems land, how wide the leg falls, how the jacket hits the hip, shoulder fit, stacking over shoes. Use what you see to balance proportions; trust the photos over the text notes when they disagree.`:"";
  const keys=userStyles();
  const prompt=`You're styling someone from clothes they already own. ${personText()} ${bodyText()} Use their build to judge how much volume and layering flatters them, and where cropped vs longer layers and wide vs straight legs work best on their frame. Fit and proportion matter more than genre labels: use each piece's silhouette, length and "fit on them" notes to balance proportions (e.g. wide or long bottoms with shorter or boxier tops, intentional layering lengths, how pants break on the shoes).
${pr?`Their style profile from saved inspo: ${pr.summary} Silhouettes they like: ${(pr.silhouettes||[]).join("; ")}. Palette: ${(pr.palette||[]).join(", ")}.${keys.map(v=>pr.vibes?.[v]?` Their ${styleName(v)}: ${pr.vibes[v]}`:"").join("")}`:""}
${liked.length?`Fits they liked: ${liked.map(f=>names(f.items)).join(" | ")}`:""}
${nope.length?`Fits they rejected: ${nope.map(f=>names(f.items)).join(" | ")}`:""}
Style definitions: ${styleDefs(keys)}.
Today: ${temp}°F, ${wx}.${WX.data?` Forecast: ${weatherText()}.`:""}${plan?` Plans: ${plan}.`:""}${recreate?" The attached image is an inspo outfit: recreate it as closely as possible with their clothes.":` Style: ${vibe==="any"?`any of ${keys.join(" / ")}, vary them`:vibe}.`}

Closet (id | name | type | color | silhouette, length | warmth 1-3 | styles | notes). Use ONLY these ids:
${closetText(pool)}${bodyNote}

Reply with only JSON: {"fits":[{"title": 2-4 word name, "vibe": one of ${JSON.stringify(keys)}, "items": [ids], "why": one sentence on why it works today, "proportion": one sentence on how the pieces balance on their body${recreate?`, "missing": what the inspo has that their closet can't match, or ""`:""}}]}
${recreate?"Give 2 fits.":"Give 3 distinct fits."} Each fit needs something on top, a bottom and shoes, plus a jacket or coat when it's under about 55°F or wet. Dress for the weather.`;
  ctl=new AbortController();$("m-go").disabled=true;$("m-stop").hidden=false;$("m-status").textContent=bodyShots.length?`Thinking, with ${bodyShots.length} of your on-body shots…`:"Thinking…";
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
function allBrands(){const m=new Map();for(const r of CATALOG)m.set(r.b,r);for(const r of S.pool)if(!m.has(r.b))m.set(r.b,{...r,pool:true});
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
      ${typeof priceLine==="function"?priceLine(pwKeyGap(x.item)):""}
      ${(()=>{const t=window.SIZE?fitTips(x,brands):[];return t.length?`<p class="gap-fit">${t.map(([b,s])=>`<b>${esc(b)}</b>: ${esc(s)}`).join(" · ")}</p>`:""})()}
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
function sizeFor(p){const z=S.prefs?.sizes||{};const typed=p.cat==="bottom"?z.bottoms||"":p.cat==="shoes"?z.shoes||"":["top","mid","outer"].includes(p.cat)?z.tops||"":"";
  return typed||(window.SIZE?SIZE.forPiece(sizeCard(),p.cat):"")}
function tagCounts(){const c={};S.inspo.forEach(p=>(p.tags||[]).forEach(k=>c[k]=(c[k]||0)+1));return c}
// Newer pins count more (oldest ×0.75 → newest ×1.5), so the list follows where their taste is heading.
function tagWeights(){const w={};const byAge=[...S.inspo].filter(p=>(p.tags||[]).length).sort((a,b)=>(a.created||0)-(b.created||0));const n=byAge.length;
  byAge.forEach((p,i)=>{const f=n>1?.75+.75*i/(n-1):1;p.tags.forEach(k=>w[k]=(w[k]||0)+f)});
  for(const s of S.swipes)if(s.piece)w[s.piece]=(w[s.piece]||0)+(s.v===1?1:-0.3);return w}
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
const B={style:"all",cat:null,tier:null,tag:null,region:null,mine:false,hidden:false,allPrices:false,q:"",more:{}};
try{const s=JSON.parse(localStorage.getItem("rot-brands2")||"null");if(s)Object.assign(B,s,{q:"",more:{}})}catch{}
function saveB(){try{localStorage.setItem("rot-brands2",JSON.stringify({style:B.style,cat:B.cat,tier:B.tier,tag:B.tag,region:B.region,mine:B.mine,allPrices:B.allPrices}))}catch{}}
function brandStem(n){const t=normTxt(n.split("/")[0]).split(" ");let s="";for(const w of t){s=(s?s+" ":"")+w;if(s.replace(/ /g,"").length>=4)break}return s}
function closetBrands(){const txt=" "+S.items.map(i=>normTxt(i.name+" "+(i.notes||"")+" "+(i.fitNotes||""))).join(" | ")+" ";
  const out=new Set();for(const r of allBrands()){if(r.c==="Where to shop")continue;const s=brandStem(r.b);if(s.length>=4&&txt.includes(" "+s+" "))out.add(r.b)}return [...out]}
function listBrands(){const s=new Set();for(const x of liveGaps())for(const n of (x.brands||[])){const r=findBrand(n);if(r)s.add(r.b)}return s}
function renderMix(){renderBrandCount();const keys=userStyles(),c={};keys.forEach(k=>c[k]=0);S.items.forEach(i=>(i.vibes||[]).forEach(v=>{if(v in c)c[v]++}));
  const tot=Object.values(c).reduce((a,b)=>a+b,0);const own=new Set([...marked("own"),...closetBrands()]).size,lst=listBrands().size;
  $("b-mix").innerHTML=(tot?`<span>Closet mix ${keys.map(k=>`<b>${esc(styleName(k))} ${Math.round(c[k]/tot*100)}%</b>`).join(" · ")}</span>`:"")+
    `<span><b>${myAtlas().length}</b> brands in your atlas</span><span><b>${own}</b> you own</span><span><b>${lst}</b> on your next-buys list</span>`}
function bChips(id,key,vals,lab){$(id).innerHTML=`<button class="b-chip" data-v="" aria-pressed="${B[key]===null}">Any</button>`+vals.map(v=>`<button class="b-chip" data-v="${esc(v)}" aria-pressed="${String(B[key])===String(v)}">${esc(lab?lab(v):v)}</button>`).join("");
  $(id).querySelectorAll("button").forEach(b=>b.onclick=()=>{const v=b.dataset.v;B[key]=v===""?null:(key==="tier"?+v:v);B.more={};saveB();renderBrands()})}
const flagOf=cc=>/^[A-Z]{2}$/.test(cc||"")?String.fromCodePoint(...[...cc].map(c=>127397+c.charCodeAt(0))):"";
const countryOf=r=>(typeof COUNTRIES!=="undefined"&&COUNTRIES[r.cc])||"";
const regionName=k=>(REGIONS.find(x=>x[0]===k)||[,k])[1];
const BRAND_RANK=new Map(CATALOG.map((r,i)=>[r.b,i]));
function brandCard(r,{own,want,onList,hiddenView,sc}){const k=brandKey(r.b),m=S.marks.find(x=>x.id===k)?.mark;
  const pill=own.has(r.b)?`<span class="b-pill">You own</span>`:onList.has(r.b)?`<span class="b-pill want">On your list</span>`:want.has(r.b)?`<span class="b-pill want">Want</span>`:r.custom?`<span class="b-pill want">Added by you</span>`:"";
  const acts=hiddenView?`<button data-k="${k}" data-b="${esc(r.b)}" data-m="hide" aria-pressed="true">Show again</button>`:
    r.c==="Where to shop"?`<button data-k="${k}" data-b="${esc(r.b)}" data-m="hide" aria-pressed="false">Hide</button>`:
    `<button data-k="${k}" data-b="${esc(r.b)}" data-m="own" aria-pressed="${m==="own"}">Own</button><button data-k="${k}" data-b="${esc(r.b)}" data-m="want" aria-pressed="${m==="want"}">Want</button>${r.custom?`<button data-rmb="${esc(r.id||k)}">Remove</button>`:`<button data-k="${k}" data-b="${esc(r.b)}" data-m="hide" aria-pressed="false">Hide</button>`}`;
  return `<div class="b-item${onList.has(r.b)?" hit":""}" style="--sc:${sc}"><span class="nm">${esc(r.b)}</span><span class="tr">${TIER[r.t]||""}</span><span class="nt">${esc(r.n||"")}</span>
    ${r.why?`<span class="why">For you: ${esc(r.why)}</span>`:""}
    <div class="ft"><span class="b-tag">${esc(r.k||"")}</span>${r.cc?`<span class="b-cc">${flagOf(r.cc)} ${esc(countryOf(r))}</span>`:""}${pill}<span class="b-mark">${acts}</span></div></div>`}
function renderBrands(){if(!$("view-brands"))return;loadShared();
  const keys=userStyles();if(B.style!=="all"&&!keys.includes(B.style))B.style="all";
  const hiddenSet=new Set(marked("hide"));
  $("b-styles").innerHTML=[["all","All my styles"],...keys.map(k=>[k,styleName(k)])].map(([k,l])=>`<button class="b-style" data-s="${k}" style="--sc:${stColor(k)}" aria-pressed="${B.style===k&&!B.hidden}">${esc(l)}</button>`).join("")+
    `<button class="b-style" data-mine="1" style="--sc:var(--accent)" aria-pressed="${B.mine&&!B.hidden}">Mine &amp; my list</button>`+
    (hiddenSet.size?`<button class="b-style" data-hid="1" style="--sc:var(--muted)" aria-pressed="${B.hidden}">Hidden · ${hiddenSet.size}</button>`:"");
  $("b-styles").querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{B.style=b.dataset.s;B.hidden=false;saveB();renderBrands()});
  $("b-styles").querySelector("[data-mine]").onclick=()=>{B.mine=!B.mine;B.hidden=false;saveB();renderBrands()};
  const hb=$("b-styles").querySelector("[data-hid]");if(hb)hb.onclick=()=>{B.hidden=!B.hidden;renderBrands()};
  bChips("b-cats","cat",ATLAS_CATS);bChips("b-tags","tag",TYPES);bChips("b-regions","region",REGIONS.map(x=>x[0]),regionName);
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
    &&(!B.tag||r.k===B.tag)&&(!B.region||REGION_OF[r.cc]===B.region)&&(!q||normTxt(r.b+" "+(r.n||"")+" "+(r.why||"")+" "+countryOf(r)).includes(q))&&(B.hidden||!B.mine||own.has(r.b)||want.has(r.b)||onList.has(r.b)||r.custom));
  $("b-count").textContent=f.length+" brand"+(f.length===1?"":"s");
  const L=$("b-list");
  if(!f.length){L.innerHTML=`<p class="muted" style="padding:20px 0">${B.mine?"Nothing marked yet. Tap Own or Want on a brand, or build your next-buys list.":"No brands match those filters. Set one back to Any."}</p>`;return}
  const ctx={own,want,onList,hiddenView:B.hidden};
  // Your marks first, then the hand-picked originals, then the rest of the world list in catalog order
  const rank=r=>(own.has(r.b)||want.has(r.b)||onList.has(r.b)?0:r.ai||r.custom?1:2)*1e5+(BRAND_RANK.get(r.b)??9e4);
  const PAGE=12;
  const section=(title,blurb,sc,rows,id)=>{rows=rows.slice().sort((a,b)=>rank(a)-rank(b));
    return `<section class="b-sec" style="--sc:${sc}"><div class="b-head"><h2>${esc(title)}</h2>${blurb?`<p>${esc(blurb)}</p>`:""}</div>`+
    ATLAS_CATS.map(c=>{const g=rows.filter(r=>r.c===c);if(!g.length)return "";const key=(id||title)+"|"+c,lim=B.more[key]||PAGE,left=g.length-lim;
      return `<p class="b-h3">${c} · ${g.length}</p><div class="b-grid">`+g.slice(0,lim).map(r=>brandCard(r,{...ctx,sc})).join("")+
      (left>0?`<button class="btn ghost small b-more" data-more="${esc(key)}">Show ${Math.min(left,PAGE*2)} more · ${left} left</button>`:"")+`</div>`}).join("")+`</section>`};
  let html="",used=new Set();
  if(B.hidden){html=section("Hidden brands","Brands you hid. Tap Show again to bring one back.","var(--muted)",f)}
  else{
    html+=trendSection();
    const picks=f.filter(r=>r.ai);if(picks.length){picks.forEach(r=>used.add(r.b));html+=section("Picked for you",S.ai?.summary||"Chosen by Gemini from your styles, pins and closet.","var(--accent)",picks)}
    const mine=f.filter(r=>r.custom&&!used.has(r.b));if(mine.length){mine.forEach(r=>used.add(r.b));html+=section("Added by you","","var(--accent)",mine)}
    for(const k of (B.style==="all"?keys:[B.style])){const rows=f.filter(r=>!used.has(r.b)&&(r.s||[]).includes(k));rows.forEach(r=>used.add(r.b));if(rows.length)html+=section(styleName(k),STYLES[k].blurb,stColor(k),rows,k)}
    const shops=f.filter(r=>!used.has(r.b)&&(r.s||[]).includes("all"));if(shops.length)html+=section("Where to shop","Stores, outlets and resale sites that cover every style.","var(--ink)",shops);
  }
  L.innerHTML=html;
  L.querySelectorAll("[data-trend]").forEach(b=>b.onclick=()=>{B.q=b.dataset.trend;$("b-q").value=B.q;B.region=null;B.tag=null;B.cat=null;B.style="all";B.allPrices=true;renderBrands();$("b-q").scrollIntoView({block:"center"})});
  L.querySelectorAll("[data-more]").forEach(b=>b.onclick=()=>{const k=b.dataset.more;B.more[k]=(B.more[k]||PAGE)+PAGE*2;const y=scrollY;renderBrands();scrollTo(0,y)});
  L.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{if(!db){toast("Can't save in this view.");return}
    const cur=S.marks.find(x=>x.id===b.dataset.k)?.mark;try{if(cur===b.dataset.m)await db.doc("brandmarks/"+b.dataset.k).delete();
      else await db.doc("brandmarks/"+b.dataset.k).set({brand:b.dataset.b,mark:b.dataset.m,at:Date.now()});if(b.dataset.m==="hide"&&cur!=="hide")toast("Hidden. Find it under Hidden to bring it back.")}catch{toast("Couldn't save that.")}});
  L.querySelectorAll("[data-rmb]").forEach(b=>b.onclick=async()=>{try{await db.doc("mybrands/"+b.dataset.rmb).delete();toast("Removed from your atlas.")}catch{toast("Couldn't remove it.")}})}
let bqT=null;$("b-q").addEventListener("input",e=>{B.q=e.target.value;B.more={};clearTimeout(bqT);bqT=setTimeout(renderBrands,120)});
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
  try{await db.doc("mybrands/"+brandKey(name)).set(doc);$("brandsheet").hidden=true;toast("Added to your atlas.");
    if($("bf-share").checked&&!CATALOG.some(r=>normTxt(r.b)===normTxt(name))){const sh=await claude.use("shared");if(sh)sh.from("brand_suggestions").insert({b:name,c:doc.c,t:doc.t,n:doc.n,s:doc.s.filter(x=>x!=="all"),a:"u"}).then(()=>{},()=>{})}}catch{$("bf-msg").textContent="Couldn't save it. Try again."}};
// Gemini-curated picks
async function aiAtlas(){const keys=userStyles(),pins=tagCounts();
  const topPins=Object.entries(pins).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,c])=>`${PIECE[k]?.short||k} ×${c}`).join(", ");
  const own=[...new Set([...marked("own"),...closetBrands()])],want=marked("want"),hidden=marked("hide");
  const prompt=`You're curating a personal brand guide for one person. ${personText()} Their styles: ${styleDefs(keys)}. ${tasteText()}
${S.profile?`Their style profile from saved inspo: ${S.profile.summary}`:""}
${topPins?`Pieces that keep showing up in their saved pins: ${topPins}.`:""}
Their closet: ${S.items.map(i=>i.name).join("; ")||"(empty so far)"}
${own.length?`Brands they own: ${own.join(", ")}.`:""} ${want.length?`Brands they want: ${want.join(", ")}.`:""} ${hidden.length?`Brands they hid (never suggest): ${hidden.join(", ")}.`:""}
Suggest 20 to 30 brands that fit this person specifically: a mix of well-known, niche and newer labels, mostly within their budget, plus a few resale picks for pricier pieces. Include brands outside the obvious ones, from anywhere in the world, not just the US and Europe. Only real, currently operating brands.
Reply with only JSON: {"summary": one sentence on how you tailored the list, "picks": [{"brand": name, "category": "Garments"|"Shoes"|"Boots"|"Accessories"|"Where to shop", "price": 1|2|3, "type": "Tested"|"Niche"|"Rising"|"Buy used"|"Retailer", "style": one of ${JSON.stringify([...keys,"all"])}, "country": 2-letter ISO code where the brand is based, "note": one short sentence on what to buy there, "why": one short sentence tying it to their taste}]}`;
  const r=await sample.json(prompt,{cache:false,modelTier:"complex"});if(!Array.isArray(r.picks))throw{code:"invalid_json"};
  const picks=r.picks.filter(p=>p&&p.brand).slice(0,32).map(p=>({b:String(p.brand).slice(0,80),c:ATLAS_CATS.includes(p.category)?p.category:"Garments",t:[1,2,3].includes(+p.price)?+p.price:2,
    k:TYPES.includes(p.type)?p.type:"Rising",s:[keys.includes(p.style)||p.style==="all"?p.style:keys[0]],a:"u",cc:/^[A-Z]{2}$/.test(String(p.country||"").toUpperCase())?String(p.country).toUpperCase():undefined,n:String(p.note||"").slice(0,200),why:String(p.why||"").slice(0,200)}));
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
  rotOutfit=dailyOutfit();
  ROT.render($("rot-cv"),rotOutfit,{scale:1,seed:7,glitch:true,body:rotBody()});if(S.tab==="you")drawYou();applyTheme();sayNow()},60)}
function rotLine(t){const n=S.items.length,st=styleName(mainStyle()).toLowerCase();
  const worn=(rotOutfit?.detail||[]).find(d=>d.owned&&["outer","mid","top"].includes(ROT.SLOT[d.k]));
  const wornItem=worn&&S.items.find(i=>{const p=PIECE[worn.k];return p&&i.cat===p.cat&&p.re.test(((i.name||"")+" "+(i.notes||"")).toLowerCase())});
  if(t==="make"){if(n<3)return "i need a top, bottoms and shoes before i can dress you.";if(S.lastFits.length)return "rate them. i learn from every tap.";
    const td=rotOutfit?.today,its=td?fitItems(td.ids):[],main=its.find(i=>i.cat==="outer")||its.find(i=>i.cat==="mid")||its.find(i=>i.cat==="bottom");
    return `${$("m-temp").value||60}° and ${($("m-wx").value||"clear").toLowerCase()}.${main?(td.worn?` matching you today: your ${main.name.toLowerCase()}.`:` today i'm in your ${main.name.toLowerCase()}.`):""} want three fits?`}
  if(t==="closet"){if(!n)return "empty closet. add a piece and i'll start wearing it.";const idl=typeof idlePieces==="function"?idlePieces(1)[0]:null;if(idl)return `${idl.i.name.toLowerCase()}: ${idl.w.since} days untouched. wear it or let it go.`;return `${n} pieces. mostly ${st}.${wornItem?` wearing your ${wornItem.name.toLowerCase()} right now.`:""}`}
  if(t==="buys"){const pa=(S.pricealerts||[]).filter(a=>!a.seen&&Date.now()-a.at<7*864e5).sort((a,b)=>b.at-a.at)[0];if(pa)return `price drop. ${pa.label.toLowerCase()} is ${money2(pa.to,pa.currency)}${pa.store?` at ${pa.store.toLowerCase()}`:""}. move.`;const g=liveGaps()[0];return g?`${g.item.toLowerCase()}. that's the gap.`:"tag the pieces in your pins and i'll find what's missing."}
  if(t==="brands")return `${myAtlas().length} brands for ${userStyles().map(k=>styleName(k).toLowerCase()).join(", ")}. hide what isn't you.`;
  if(t==="inspo"){const c=tagCounts(),top=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];if(!S.inspo.length)return "drop screenshots here. i read what you save.";
    return top?`${S.inspo.length} pins. ${(PIECE[top]?.short||top).toLowerCase()} keeps showing up.`:`${S.inspo.length} pins. tag what's in them so i can read them.`}
  if(t==="you")return `${S.prefs?.name?S.prefs.name.toLowerCase()+", ":""}this is you. i copy what you wear.`;
  if(t==="saved")return S.fits.length?`${S.fits.length} saved fit${S.fits.length>1?"s":""}. the good ones.`:"save a fit and it lives here.";
  return "ready."}
// ROT's fit of the day: what you logged as worn today, otherwise a daily pick from your clean closet for today's weather
function dailyIds(){const d=today();const w=S.wears.filter(x=>x.day===d).sort((a,b)=>b.at-a.at)[0];if(w?.items?.length)return {ids:w.items,worn:true};
  let c=null;try{c=JSON.parse(localStorage.getItem("rot-daily")||"null")}catch{}
  const valid=ids=>ids.filter(id=>S.items.some(i=>i.id===id&&!i.wash));
  if(c?.day===d&&valid(c.ids||[]).length>=2)return {ids:valid(c.ids),worn:false};
  const pool=S.items.filter(i=>!i.wash);if(pool.length<3||typeof fallbackFits!=="function")return {ids:[],worn:false};
  const temp=WX?.data?WX.data.feels:(+$("m-temp").value||60),wx=WX?.data?wxBucket(WX.data.code,WX.data.wind):($("m-wx").value||"Clear");
  const fs=fallbackFits(pool,temp,wx,"any"),dh=[...d].reduce((h,c)=>(h*31+c.charCodeAt(0))|0,7)>>>0,f=fs[dh%Math.max(1,fs.length)];const ids=f?f.items:[];
  if(ids.length&&(WX?.data||!WX?.loc))try{localStorage.setItem("rot-daily",JSON.stringify({day:d,ids}))}catch{}
  return {ids,worn:false}}
function dailyOutfit(){const style=mainStyle(),{ids,worn}=dailyIds();
  if(ids.length>=2){const o=ROT.outfitFor({style,items:fitItems(ids),pins:{},focus:[]});o.today={ids,worn};return o}
  return ROT.outfitFor({style,items:S.items,pins:tagCounts(),focus:S.prefs?.focus||[]})}
let sayTimer=null,lastSaid="";
function say(text,animate){const el=$("rot-say");if(!el)return;clearInterval(sayTimer);lastSaid=text;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hint=()=>{const h=document.createElement("span");h.className="talk";h.textContent="tap to talk to rot";el.appendChild(h)};
  if(!animate||reduce){el.textContent=text;hint();return}
  let i=0;el.textContent="";const caret=document.createElement("span");caret.className="rot-caret";
  sayTimer=setInterval(()=>{i+=2;el.textContent=text.slice(0,i);el.appendChild(caret);if(i>=text.length){clearInterval(sayTimer);el.textContent=text;hint()}},22)}
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
function openYou(){fillBodyForm();fillSizeForm();drawYou()}
function closeYou(){}
["b-ft","b-in","b-lb","b-build","b-sh","b-prop"].forEach(id=>$(id).addEventListener("input",()=>{clearTimeout(yT);yT=setTimeout(()=>drawYou(readBodyForm()),80)}));
$("b-save").onclick=async()=>{if(!db){toast("Can't save in this view.");return}const b=readBodyForm();$("b-save").disabled=true;
  try{await db.doc("body/me").set({...b,at:Date.now()});toast("Build saved")}catch{toast("Couldn't save. Try again.")}finally{$("b-save").disabled=false}};

/* ---------- sizes ---------- */
const Z_IDS=["z-cut","z-unit","z-fit","z-chest","z-waist","z-hips","z-inseam","z-shoe","z-shoesys"];
function sizeDefaults(){return {cut:shopFor()==="womens"?"womens":"mens",unit:"in",fit:"regular",chest:"",waist:"",hips:"",inseam:"",shoe:{sys:shopFor()==="womens"?"USW":"USM",v:""}}}
function readSizeForm(){return {cut:$("z-cut").value,unit:$("z-unit").value,fit:$("z-fit").value,chest:$("z-chest").value,waist:$("z-waist").value,hips:$("z-hips").value,inseam:$("z-inseam").value,shoe:{sys:$("z-shoesys").value,v:$("z-shoe").value.trim()}}}
function fillSizeForm(){const m=Object.assign(sizeDefaults(),S.sizes||{});["cut","unit","fit","chest","waist","hips","inseam"].forEach(k=>$("z-"+k).value=m[k]??"");
  $("z-shoe").value=m.shoe?.v||"";$("z-shoesys").value=m.shoe?.sys||"USM";$("z-state").textContent=S.sizes?"Saved. Next buys show these sizes.":"";renderSizeCard(m);renderFitRefs()}
function heightIn(){return S.body?dims(S.body).inches:null}
function sizeCard(m){m=m||S.sizes;return m&&window.SIZE?SIZE.compute(m,heightIn()):null}
function renderSizeCard(m){const c=sizeCard(m),box=$("z-card");if(!box)return;$("z-chest-l").textContent=(m||{}).cut==="womens"?"Bust":"Chest";
  if(!c||(!c.tops&&!c.bottoms&&!c.shoes)){box.innerHTML=`<p class="muted" style="font-size:.9rem">Fill in any measurement to see your sizes.</p>`;return}
  const w=c.cut==="womens",rows=[];
  if(c.tops)rows.push(["Tops",c.tops.US.replace(" / "," "),c.tops.UK,c.tops.EU,c.tops.JP,c.tops.KR]);
  if(c.tops&&!w)rows.push(["Jackets",c.tops.suit,c.tops.suit,c.tops.suitEU,c.tops.JP,c.tops.KR]);
  if(c.dress)rows.push(["Dresses",c.dress.US.replace(" / "," "),c.dress.UK,c.dress.EU,c.dress.JP,c.dress.KR]);
  if(c.bottoms)rows.push(w?["Jeans",c.bottoms.denim,c.bottoms.UK,c.bottoms.EU,c.bottoms.JP,c.bottoms.KR]:["Pants",c.bottoms.US,c.bottoms.UK,c.bottoms.EU,c.bottoms.JP,c.bottoms.KR]);
  if(c.shoes)rows.push(["Shoes",w?`${c.shoes.USW}W`:`${c.shoes.USM}`,c.shoes.UK,c.shoes.EU,c.shoes.JP.replace(" cm",""),c.shoes.KR]);
  box.innerHTML=`<div class="z-table-wrap"><table class="z-table"><thead><tr><th></th><th>US</th><th>UK</th><th>EU</th><th>JP</th><th>KR</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r[0]}</th>${r.slice(1).map((v,i)=>`<td${i===0?' class="main"':""}>${esc(String(v??""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`+
    `<ul class="z-notes">${[c.tops?.wear?`For your oversized fit, buy tops in ${c.tops.wear}.`:"",...c.notes.filter(n=>!/^You like it oversized/.test(n)||!c.tops?.wear),w&&c.bottoms?.L?`Inseam about ${c.bottoms.L}": shop ${c.bottoms.len} lengths.`:"",w&&c.tops?`Italian sizes run 4 above EU: tops IT ${c.tops.IT}.`:"","Japanese and Korean labels often run small. If you're between sizes there, go up.","Charts are averages. Sizes you add below beat the chart for that brand."].filter(Boolean).map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`}
Z_IDS.forEach(id=>$(id).addEventListener("input",()=>renderSizeCard(readSizeForm())));
$("z-save").onclick=async()=>{if(!db){toast("Can't save in this view.");return}$("z-save").disabled=true;
  try{await db.doc("sizes/me").set({...readSizeForm(),at:Date.now()});toast("Sizes saved")}catch{toast("Couldn't save. Try again.")}finally{$("z-save").disabled=false}};
function renderFitRefs(){const l=$("zr-list");if(!l)return;const kinds={tops:"Tops",bottoms:"Bottoms",shoes:"Shoes"},fits={right:"fits right",small:"ran small",big:"ran big"};
  l.innerHTML=S.fitref.length?S.fitref.map(r=>`<li><span><b>${esc(r.brand)}</b> · ${esc(kinds[r.kind]||r.kind)} · ${esc(r.size)} <span class="muted">· ${fits[r.fit]||""}</span></span><button class="btn ghost small" data-rmz="${esc(r.id)}">Remove</button></li>`).join(""):`<li class="muted" style="border-style:dashed">Nothing yet. Try your best-fitting jeans and sneakers.</li>`;
  l.querySelectorAll("[data-rmz]").forEach(b=>b.onclick=async()=>{try{await db.doc("fitref/"+b.dataset.rmz).delete()}catch{toast("Couldn't remove it.")}})}
$("zr-form").onsubmit=async e=>{e.preventDefault();if(!db)return;const brand=$("zr-brand").value.trim(),size=$("zr-size").value.trim();
  if(!brand||!size){toast("Add a brand and a size.");return}const an=t=>String(t).toLowerCase().replace(/[^a-z0-9]/g,""),known=allBrands().find(r=>an(r.b)===an(brand));
  try{await db.collection("fitref").doc().set({brand:known?known.b:brand,kind:$("zr-kind").value,size,fit:$("zr-fit").value,at:Date.now()});
    $("zr-brand").value="";$("zr-size").value="";toast("Saved. Rotation will use it for "+brand+".")}catch{toast("Couldn't save that.")}};
function fitTips(x,brands){const card=sizeCard(),p=PIECES.find(q=>q.label===x.item);const cat=p?.cat||({Shoes:"shoes",Boots:"shoes"}[x.atlasCat])||"top";
  return brands.map(r=>[r.b,SIZE.brandTip(r,cat,card,S.fitref)]).filter(t=>t[1]).slice(0,3)}
function sizeText(){const c=sizeCard();if(!c)return "";const a=[];if(c.tops)a.push(`tops ${c.tops.US}`);if(c.bottoms)a.push(c.cut==="womens"?`jeans ${c.bottoms.denim}`:`pants ${c.bottoms.US}`);if(c.shoes)a.push(`shoes ${c.shoes.main}`);
  const refs=S.fitref.slice(0,8).map(r=>`${r.brand} ${r.size} (${r.fit==="right"?"fits":r.fit==="small"?"ran small":"ran big"})`);
  return (a.length?`From their measurements they wear ${a.join(", ")}, and like a ${c.fit} fit.`:"")+(refs.length?` Sizes they own: ${refs.join("; ")}.`:"")}

/* ---------- shared brand signals (collectors) ---------- */
let trendsAt=0;
async function loadShared(force){if(!force&&Date.now()-trendsAt<30*60e3)return;trendsAt=Date.now();
  let sh=null;try{sh=await claude.use("shared")}catch{}if(!sh)return;
  try{const [t,p]=await Promise.all([sh.from("brand_trends").select("*").limit(400),sh.from("brand_suggestions").select("b,c,t,n,s,a,cc").eq("approved",true).limit(2000)]);
    if(!t.error)S.trends=t.data||[];if(!p.error)S.pool=(p.data||[]).map(r=>({...r,k:"Rising",s:(r.s&&r.s.length?r.s:["all"])}));
    if(S.tab==="brands")renderBrands()}catch{}}
function trendSection(){const T=S.trends||[];if(!T.length||B.hidden||B.mine||B.q)return "";
  const keys=new Set(userStyles()),byName=new Map(allBrands().map(r=>[r.b,r]));
  const score=t=>t.week*2+Math.max(0,t.week-t.prev_week)*3+Math.max(0,+t.growth_30d||0);
  const rows=T.map(t=>({...t,r:byName.get(t.brand)})).filter(t=>t.r&&audOk(t.r.a)&&(!B.region||REGION_OF[t.r.cc]===B.region)&&(t.week>0||+t.growth_30d>0))
    .sort((a,b)=>((b.r.s||[]).some(x=>keys.has(x))-(a.r.s||[]).some(x=>keys.has(x)))||score(b)-score(a)).slice(0,10);
  if(!rows.length)return "";
  const fmt=n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?Math.round(n/1e3)+"K":String(n);
  return `<section class="b-sec" style="--sc:var(--accent)"><div class="b-head"><h2>Trending this week</h2><p>Brands getting the most mentions on fashion sites and newsletters this week, and accounts growing fastest on Instagram. Tap one to find it.</p></div><div class="trend-list">`+
    rows.map(t=>`<div class="trend"><button class="tn" data-trend="${esc(t.r.b)}">${flagOf(t.r.cc)} ${esc(t.r.b)}</button>
      <span class="ts">${t.week?`<b>${t.week}</b> mention${t.week>1?"s":""}${t.week>t.prev_week?` <span class="upw">▲ ${t.prev_week?"from "+t.prev_week:"new"}</span>`:""}`:""}${t.followers?`${t.week?" · ":""}${fmt(t.followers)} followers${t.growth_30d!=null?` <span class="upw">${+t.growth_30d>=0?"+":""}${t.growth_30d}%</span>`:""}`:""}</span>
      ${t.top_url?`<a href="${esc(t.top_url)}" target="_blank" rel="noopener">${esc(t.top_title||"Top post")}</a>`:""}</div>`).join("")+`</div></section>`}

/* ---------- live weather (Open-Meteo: free, no key) ---------- */
const WX={loc:null,data:null,at:0,edited:false};
try{WX.loc=JSON.parse(localStorage.getItem("rot-loc")||"null")}catch{}
const WX_CODES={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",56:"Freezing drizzle",57:"Freezing drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Showers",81:"Showers",82:"Heavy showers",85:"Snow showers",86:"Snow showers",95:"Thunderstorms",96:"Thunderstorms",99:"Thunderstorms"};
function wxBucket(code,wind){if([71,73,75,77,85,86].includes(code))return "Snow";if(code>=51&&code<=99&&code!==71)return "Rain";if(wind>=20)return "Windy";if(code>=2)return "Cloudy";return "Clear"}
function saveLoc(l){WX.loc=l;try{localStorage.setItem("rot-loc",JSON.stringify(l))}catch{}}
async function loadWeather(force){if(!WX.loc){paintWeather();return}if(!force&&WX.data&&Date.now()-WX.at<30*60e3){paintWeather();return}
  $("wx-line").textContent="Checking the weather…";
  try{const {lat,lon}=WX.loc;const u=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
    const j=await (await fetch(u)).json();if(!j.current)throw 0;
    WX.data={temp:Math.round(j.current.temperature_2m),feels:Math.round(j.current.apparent_temperature),code:j.current.weather_code,wind:Math.round(j.current.wind_speed_10m),
      hi:Math.round(j.daily.temperature_2m_max[0]),lo:Math.round(j.daily.temperature_2m_min[0]),rain:j.daily.precipitation_probability_max[0]??0,dayCode:j.daily.weather_code[0]};WX.at=Date.now();
    if(!WX.edited){const d=WX.data;$("m-temp").value=d.feels;const wet=d.rain>=50&&[61,63,65,80,81,82,95,71,73,75].includes(d.dayCode);$("m-wx").value=wet?wxBucket(d.dayCode,d.wind):wxBucket(d.code,d.wind)}
    paintWeather();renderRot();if(S.tab==="make")sayNow()}
  catch{$("wx-line").textContent="Couldn't reach the weather service. Set it by hand below, or tap Refresh.";$("wx-refresh").hidden=false}}
function paintWeather(){const d=WX.data,l=WX.loc;$("wx-refresh").hidden=!l;$("wx-here").textContent=l?"Update location":"Use my location";$("wx-city").textContent=l?"Change city":"Pick a city";
  if(!l){$("wx-line").textContent="Set your location to fill in today's weather automatically.";return}
  if(!d)return;$("wx-line").innerHTML=`<b>${esc(l.name)}</b> · ${d.temp}°F, feels ${d.feels}° · ${esc(WX_CODES[d.code]||"")} · H ${d.hi}° / L ${d.lo}°${d.rain?` · ${d.rain}% rain`:""}${d.wind>=15?` · wind ${d.wind} mph`:""}`}
function weatherText(){const d=WX.data;if(!d)return `${$("m-temp").value||60}°F, ${$("m-wx").value}`;return `${d.temp}°F (feels ${d.feels}°), ${WX_CODES[d.code]||""}, high ${d.hi}° low ${d.lo}°, ${d.rain}% chance of rain, wind ${d.wind} mph${WX.loc?` in ${WX.loc.name}`:""}`}
["m-temp","m-wx"].forEach(id=>$(id).addEventListener("input",()=>{WX.edited=true}));
$("wx-refresh").onclick=()=>{WX.edited=false;loadWeather(true)};
$("wx-here").onclick=()=>{if(!navigator.geolocation){toast("This browser can't share location. Pick a city instead.");return}
  $("wx-line").textContent="Finding you…";
  navigator.geolocation.getCurrentPosition(async p=>{const lat=+p.coords.latitude.toFixed(3),lon=+p.coords.longitude.toFixed(3);let name="Your location";
      try{const r=await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)).json();name=r.city||r.locality||r.principalSubdivision||name}catch{}
      saveLoc({lat,lon,name});WX.edited=false;loadWeather(true)},
    ()=>{$("wx-line").textContent="Location is blocked. Pick a city instead, or allow location for this app in your phone's settings.";$("wx-form").hidden=false},{timeout:12000,maximumAge:30*60e3})};
$("wx-city").onclick=()=>{$("wx-form").hidden=!$("wx-form").hidden;if(!$("wx-form").hidden)$("wx-q").focus()};
$("wx-form").onsubmit=async e=>{e.preventDefault();const q=$("wx-q").value.trim();if(!q)return;const box=$("wx-pick");box.innerHTML='<span class="muted">Searching…</span>';
  try{const r=await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en`)).json();const res=r.results||[];
    box.innerHTML=res.length?res.map((c,i)=>`<button type="button" class="btn ghost small" data-c="${i}">${esc([c.name,c.admin1,c.country_code].filter(Boolean).join(", "))}</button>`).join(""):'<span class="muted">No match. Try another spelling.</span>';
    box.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{const c=res[+b.dataset.c];saveLoc({lat:+c.latitude.toFixed(3),lon:+c.longitude.toFixed(3),name:c.name});box.innerHTML="";$("wx-form").hidden=true;$("wx-q").value="";WX.edited=false;loadWeather(true)})}
  catch{box.innerHTML='<span class="muted">Couldn\'t search right now.</span>'}};

/* ---------- talk to ROT ---------- */
const CHAT={msgs:[],busy:false};
try{CHAT.msgs=JSON.parse(localStorage.getItem("rot-chat")||"[]")}catch{}
function saveChat(){CHAT.msgs=CHAT.msgs.slice(-40);try{localStorage.setItem("rot-chat",JSON.stringify(CHAT.msgs))}catch{}}
function openChat(){$("rotchat").hidden=false;document.body.classList.add("locked");
  if(window.ROT&&rotOutfit)ROT.render($("chat-rot"),rotOutfit,{scale:1,seed:7,glitch:true});
  $("chat-mode").textContent=sample?"gemini mode":"built-in mode";
  if(!CHAT.msgs.length)CHAT.msgs.push({who:"rot",text:`${S.prefs?.name?S.prefs.name.toLowerCase()+". ":""}i'm rot. i know your closet, your pins and the weather. ask me what to wear, what to buy, or whether something works.`});
  renderChat();loadWeather();setTimeout(()=>$("chat-in").focus(),50)}
function closeChat(){$("rotchat").hidden=true;document.body.classList.remove("locked")}
function renderChat(){const L=$("chat-log");
  L.innerHTML=CHAT.msgs.map((m,i)=>{if(m.who==="me")return `<div class="msg me">${esc(m.text)}</div>`;
    const items=(m.items||[]).filter(id=>S.items.some(x=>x.id===id));
    const brands=(m.brands||[]).map(n=>findBrand(n)).filter(Boolean);
    return `<div class="msg rot">${esc(m.text)}${items.length?`<div class="chat-fit">${fitItems(items).map(x=>cell(x)).join("")}</div>${piecesHTML(items)}<div class="row" style="gap:6px;margin-top:6px"><button class="btn ghost small" data-chatmq="${i}">ROT tries it on</button><button class="btn ghost small" data-chatshare="${i}">Share</button></div>`:""}${brands.length?`<div class="chat-brands">${brands.map(r=>`<button class="brand" data-cb="${esc(r.b)}">${esc(r.b)}<span>${TIER[r.t]||""}</span></button>`).join("")}</div>`:""}${actsHTML(m,i)}</div>`}).join("")+
    (CHAT.busy?`<div class="msg rot typing">thinking…</div>`:"");
  L.querySelectorAll("[data-chatmq]").forEach(b=>b.onclick=()=>{const m=CHAT.msgs[+b.dataset.chatmq];closeChat();openMannequin(m.items,"ROT's pick","")});
  L.querySelectorAll("[data-chatshare]").forEach(b=>b.onclick=()=>{const m=CHAT.msgs[+b.dataset.chatshare];shareFit(m.items,"rot's pick",m.text,"")});
  L.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const [mi,ai]=b.dataset.act.split(":").map(Number);runAct(CHAT.msgs[mi],ai)});
  L.querySelectorAll("[data-cb]").forEach(b=>b.onclick=()=>{closeChat();goBrands("all",null,b.dataset.cb)});
  L.scrollTop=L.scrollHeight;
  const chips=["what should i wear today","what should i buy next","what's my size in japanese brands","which of my pieces go together least"];
  $("chat-chips").innerHTML=chips.map(c=>`<button type="button" class="btn ghost small" data-chip="${esc(c)}">${esc(c)}</button>`).join("");
  $("chat-chips").querySelectorAll("[data-chip]").forEach(b=>b.onclick=()=>sendChat(b.dataset.chip))}
const ACT_LABEL={save_fit:"Save this fit",wore:"Wore this today",want:"Add to want list",wash:"Mark in the wash",unwash:"Out of the wash"};
function actsHTML(m,i){const a=(m.acts||[]);if(!a.length)return "";
  return `<div class="chat-acts">${a.map((x,k)=>{const label=x.t==="want"?`Want ${x.brand}`:ACT_LABEL[x.t]||x.t;return x.done?`<span class="act-done">✓ ${esc(x.doneText||label)}</span>`:`<button class="btn small" data-act="${i}:${k}">${esc(label)}</button>`}).join("")}</div>`}
async function runAct(m,k){const a=m?.acts?.[k];if(!a||a.done||!db)return;const ids=m.items||[];
  try{if(a.t==="save_fit"){await db.doc("fits/c"+Date.now()).set({title:"ROT's pick",items:ids,why:m.text.slice(0,240),proportion:"",vibe:"",at:Date.now()});a.doneText="Saved to Saved fits"}
    else if(a.t==="wore"){if(!wornToday(ids))await logWear(ids,"ROT's pick");a.doneText="Logged as worn today"}
    else if(a.t==="want"){const b=findBrand(a.brand);const name=b?.b||a.brand;await db.doc("brandmarks/"+brandKey(name)).set({brand:name,mark:"want",at:Date.now()});a.doneText=`${name} is on your want list`}
    else if(a.t==="wash"||a.t==="unwash"){for(const id of a.ids){const it=S.items.find(i=>i.id===id);if(it)await db.doc("items/"+id).set({...it,id:undefined,wash:a.t==="wash"})}a.doneText=a.t==="wash"?"In the wash":"Back in rotation"}
    a.done=true;saveChat();renderChat()}
  catch{toast("Couldn't do that. Try again.")}}
function chatContext(){const pool=S.items.filter(i=>!i.wash);const tc=tagCounts();
  const pins=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,c])=>`${PIECE[k]?.short||k} ×${c}`).join(", ");
  const gaps=liveGaps().slice(0,5).map(g=>g.item).join("; ");
  const own=[...new Set([...marked("own"),...closetBrands()])].slice(0,30),want=marked("want").slice(0,20);
  return `${personText()} ${bodyText()} ${tasteText()}
Their styles: ${styleDefs(userStyles())}.
${S.profile?`Style profile from their inspo: ${S.profile.summary}`:""}
${pins?`Pieces that keep showing up in their saved pins: ${pins}.`:""}
${gaps?`Their current next-buys list: ${gaps}.`:""}
${own.length?`Brands they own: ${own.join(", ")}.`:""} ${want.length?`Brands they want: ${want.join(", ")}.`:""}
Weather right now: ${weatherText()}. Today's date: ${new Date().toDateString()}.
Closet (id | name | type | color | silhouette, length | warmth 1-3 | styles | notes). Items marked in the wash are left out:
${closetText(pool)}`}
async function sendChat(text){text=(text||"").trim();if(!text||CHAT.busy)return;$("chat-in").value="";
  CHAT.msgs.push({who:"me",text});CHAT.busy=true;renderChat();
  let reply;
  try{reply=sample?await rotGemini(text):rotBuiltIn(text)}
  catch(e){reply={text:e?.code==="rate_limited"?"gemini's out of free questions for today. i'll be back tomorrow. built-in answers still work.":e?.code==="bad_key"?"your gemini key got rejected. check it in You → settings.":"lost the connection. try again."}}
  CHAT.busy=false;CHAT.msgs.push({who:"rot",...reply});saveChat();renderChat()}
async function rotGemini(text){
  const hist=CHAT.msgs.slice(-13,-1).map(m=>`${m.who==="me"?"User":"ROT"}: ${m.text}`).join("\n");
  const prompt=`You are ROT, the stylist character inside the wardrobe app Rotation: an edgy, dithered pixel figure who wears the user's clothes. Voice: all lowercase, short, dry, confident, a little blunt, never mean, no emoji, no hashtags. Give real, specific styling advice using their actual closet, sizes and weather. Keep replies under 90 words unless they ask for detail. Only recommend real brands. If they ask something unrelated to clothes, style, shopping or their day's plans, answer briefly and steer back.
${chatContext()}

Conversation so far:
${hist||"(new chat)"}
User: ${text}

You can offer actions the user confirms with one tap. Offer one only when it clearly fits what they asked: "save_fit" (save the outfit in "items"), "wore" (log the outfit in "items" as worn today), "want" (add a brand to their want list, set "brand"), "wash" (mark closet "ids" as in the wash), "unwash" (take closet "ids" out of the wash).
Reply with only JSON: {"reply": your message, "items": [closet ids if you're proposing a specific outfit from their closet, else []], "brands": [up to 4 brand names if you recommend shopping somewhere, else []], "actions": [{"type": "save_fit"|"wore"|"want"|"wash"|"unwash", "brand": "only for want", "ids": ["only for wash/unwash"]}]}`;
  const r=await sample.json(prompt,{cache:false});
  const ids=new Set(S.items.map(i=>i.id));
  const items=(r.items||[]).filter(id=>ids.has(id)).slice(0,6);
  const acts=(Array.isArray(r.actions)?r.actions:[]).map(a=>({t:String(a?.type||""),brand:a?.brand?String(a.brand).slice(0,80):undefined,ids:(a?.ids||[]).filter(id=>ids.has(id))}))
    .filter(a=>((a.t==="save_fit"||a.t==="wore")&&items.length>=2)||(a.t==="want"&&a.brand)||((a.t==="wash"||a.t==="unwash")&&a.ids.length)).slice(0,3);
  if(items.length>=2&&!acts.some(a=>a.t==="save_fit"))acts.push({t:"save_fit"});
  return {text:String(r.reply||"…").slice(0,1200),items,brands:(r.brands||[]).map(String).slice(0,4),acts}}
function rotBuiltIn(text){const t=text.toLowerCase();const pool=S.items.filter(i=>!i.wash);
  if(/wear|fit|outfit|dress|today|tonight|tomorrow/.test(t)){
    if(pool.length<3)return {text:"i need at least a top, bottoms and shoes in your closet before i can dress you."};
    const temp=+$("m-temp").value||60,wx=$("m-wx").value;const f=fallbackFits(pool,temp,wx,"any")[0];
    if(!f)return {text:"couldn't make a full fit from what's clean. add more pieces or take some out of the wash."};
    return {acts:[{t:"save_fit"},{t:"wore"}],text:`${weatherText().split(",").slice(0,2).join(",").toLowerCase()}. ${f.why.charAt(0).toLowerCase()+f.why.slice(1)}${f.proportion?" "+f.proportion.toLowerCase():""}`,items:f.items}}
  const washM=t.match(/^(?:put |mark )?(?:my )?(.+?) (?:is |are )?(?:in the wash|dirty)$/)||t.match(/^wash (?:my )?(.+)$/);
  if(washM){const hit=S.items.filter(i=>i.name.toLowerCase().includes(washM[1].replace(/^the /,"").trim()));if(hit.length)return {text:`${hit.map(i=>i.name.toLowerCase()).join(", ")}. mark ${hit.length>1?"them":"it"} as in the wash?`,acts:[{t:"wash",ids:hit.slice(0,4).map(i=>i.id)}]}}
  if(/buy|need|missing|next|shop|get/.test(t)){const g=liveGaps().slice(0,3);if(!g.length)return {text:"tag the pieces in your pins and i'll find what's missing."};
    return {text:g.map((x,i)=>`${i+1}. ${x.item.toLowerCase()}${x.size?` (your size: ${x.size})`:""}`).join("\n"),brands:[...new Set(g.flatMap(x=>x.brands||[]))].slice(0,4)}}
  if(/size|fit me|measure/.test(t)){const c=sizeCard();if(!c)return {text:"add your measurements in You → measurements & sizes and i'll convert them for any country."};
    const a=[];if(c.tops)a.push(`tops ${c.tops.US} (jp ${c.tops.JP}, kr ${c.tops.KR})`);if(c.bottoms)a.push(c.cut==="womens"?`jeans ${c.bottoms.denim}`:`pants ${c.bottoms.US} (eu ${c.bottoms.EU})`);if(c.shoes)a.push(`shoes ${c.shoes.main.toLowerCase()} (eu ${c.shoes.EU}, ${c.shoes.JP})`);
    return {text:a.join("\n")+"\njapanese and korean labels run small. go up when you're between sizes."}}
  if(/weather|cold|hot|rain|snow|temp/.test(t))return {text:WX.data?weatherText().toLowerCase()+".":"set your location on make a fit and i'll keep the weather current."};
  const b=findBrand(text.replace(/^(what about|tell me about|is|are|how is|how's)\s+/i,"").replace(/[?!.]+$/,""));
  if(b)return {text:`${b.b.toLowerCase()}${b.cc?` (${(countryOf(b)||b.cc).toLowerCase()})`:""}. ${(b.n||"").toLowerCase()} ${TIER[b.t]||""}`.trim(),brands:[b.b]};
  return {text:"in built-in mode i can do: what to wear today, what to buy next, your sizes, the weather, and brand lookups. add a free gemini key in You → settings and i can actually talk."}}
$("rot-cv").parentElement.addEventListener("click",openChat);
$("rot-say").addEventListener("click",openChat);
$("chat-close").onclick=closeChat;
$("rotchat").addEventListener("click",e=>{if(e.target.id==="rotchat")closeChat()});
$("chat-clear").onclick=()=>{CHAT.msgs=[];saveChat();openChat()};
$("chat-form").onsubmit=e=>{e.preventDefault();sendChat($("chat-in").value)};
loadWeather();

/* ---------- wear tracking ---------- */
const DAY=864e5;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
let wearCache=null;
function wearStats(){if(wearCache)return wearCache;const m=new Map();
  for(const w of S.wears)for(const id of (w.items||[])){const s=m.get(id)||{n:0,last:0,days:new Set()};if(!s.days.has(w.day)){s.days.add(w.day);s.n++}s.last=Math.max(s.last,w.at||0);m.set(id,s)}
  return wearCache=m}
function wearOf(it){const s=wearStats().get(it.id);const n=s?.n||0,last=s?.last||0;const since=Math.floor((Date.now()-(last||it.created||Date.now()))/DAY);
  const price=+it.price||0;return {n,last,since,cpw:price?(n?price/n:price):null}}
function wornLabel(it){const w=wearOf(it);if(!S.wears.length)return "";if(!w.n)return w.since>=21?`<span class="worn idle">never worn · ${w.since}d</span>`:`<span class="worn">not worn yet</span>`;
  return `<span class="worn${w.since>=30?" idle":""}">worn ${w.n}× · ${w.since===0?"today":w.since+"d ago"}</span>`}
const money=v=>v>=100?"$"+Math.round(v):"$"+v.toFixed(v<10?2:0);
function wearStatText(it){const w=wearOf(it);const parts=[w.n?`Worn ${w.n}×, last ${w.since===0?"today":w.since===1?"yesterday":w.since+" days ago"}.`:"Not worn yet."];
  if(w.cpw!=null)parts.push(`${money(w.cpw)} per wear${w.n?"":" (wear it once and it starts dropping)"}.`);return parts.join(" ")}
function wornToday(ids){const d=today(),k=[...ids].sort().join();return S.wears.find(w=>w.day===d&&[...(w.items||[])].sort().join()===k)}
async function logWear(ids,title){if(!db||!ids?.length)return;const hit=wornToday(ids);
  try{if(hit){await db.doc("wears/"+hit.id).delete();toast("Took it off today's log.")}
    else{await db.collection("wears").doc().set({day:today(),items:ids,title:title||"",at:Date.now()});toast("Logged. ROT will rotate around it.")}}catch{toast("Couldn't log that.")}}
// pieces that have been sitting longest (only once there's some history)
function idlePieces(n=3){if(S.wears.length<3)return [];return S.items.filter(i=>!i.wash).map(i=>({i,w:wearOf(i)})).filter(x=>x.w.since>=21).sort((a,b)=>b.w.since-a.w.since).slice(0,n)}
function renderReport(){const box=$("c-report");if(!box)return;if(!S.wears.length||!S.items.length){box.innerHTML="";return}
  const month=Date.now()-30*DAY,ids=new Set();let outfits=0;for(const w of S.wears)if(w.at>=month){outfits++;(w.items||[]).forEach(x=>ids.add(x))}
  const used=S.items.filter(i=>ids.has(i.id)).length,pct=Math.round(100*used/S.items.length);
  const priced=S.items.filter(i=>+i.price>0),spent=priced.reduce((t,i)=>t+ +i.price,0),wornN=priced.reduce((t,i)=>t+wearOf(i).n,0);
  const idle=idlePieces(2);
  box.innerHTML=`<div><div class="k">${pct}%</div><div class="l">of closet worn in 30 days</div></div><div><div class="k">${outfits}</div><div class="l">fits logged in 30 days</div></div>
    <div><div class="k">${priced.length&&wornN?money(spent/wornN):"—"}</div><div class="l">avg cost per wear</div></div>
    ${idle.length?`<div class="idle-row">rot › sitting longest: ${idle.map(x=>`<button data-idle="${esc(x.i.id)}">${esc(x.i.name.toLowerCase())}</button> (${x.w.since}d)`).join(", ")}. wear ${idle.length>1?"one":"it"} this week.</div>`:""}`;
  box.querySelectorAll("[data-idle]").forEach(b=>b.onclick=()=>openSheet(S.items.find(i=>i.id===b.dataset.idle)))}
let cSort="new";try{cSort=localStorage.getItem("rot-csort")||"new"}catch{}
$("c-sort").value=cSort;$("c-sort").onchange=e=>{cSort=e.target.value;try{localStorage.setItem("rot-csort",cSort)}catch{}renderCloset()};
function sortCloset(list){const by={most:(a,b)=>wearOf(b).n-wearOf(a).n,least:(a,b)=>wearOf(a).n-wearOf(b).n||wearOf(b).since-wearOf(a).since,
  idle:(a,b)=>wearOf(b).since-wearOf(a).since,cpw:(a,b)=>(wearOf(b).cpw??-1)-(wearOf(a).cpw??-1)}[cSort];return by?list.slice().sort(by):list}
$("f-wore").onclick=async()=>{const it=S.editing;if(!it)return;await logWear([it.id],it.name);setTimeout(()=>{$("f-wear-stat").textContent=wearStatText(S.items.find(i=>i.id===it.id)||it);$("f-wore").textContent=wornToday([it.id])?"Logged today ✓":"Wore it today"},400)};

/* ---------- swipe deck (real products) ---------- */
const SW={list:null,at:0,hist:[],busy:false};
const CUR={USD:"$",GBP:"£",EUR:"€",JPY:"¥",CAD:"CA$",AUD:"A$",KRW:"₩",INR:"₹"};
const priceText=p=>p.price!=null?`${CUR[p.currency]||((p.currency||"")+" ")}${p.price>=100||p.currency==="JPY"||p.currency==="KRW"?Math.round(p.price).toLocaleString():(+p.price).toFixed(2)}`:"";
function classifyProduct(title,brand){const t=(title||"").toLowerCase();const p=PIECES.find(q=>q.re.test(t));const b=brand?findBrand(brand):null;
  let styles=b?.s?.filter(x=>x!=="all")||[];if(p)styles=styles.length?styles.filter(x=>p.s.includes(x)).concat(p.s).slice(0,3):p.s.slice(0,3);
  return {piece:p?.key||null,styles:[...new Set(styles)].slice(0,4),audience:p?.a||b?.a||"u"}}
async function loadProducts(force){if(!force&&SW.list&&Date.now()-SW.at<10*60e3)return SW.list;let sh=null;try{sh=await claude.use("shared")}catch{}
  if(!sh){SW.list=SW.list||[];return SW.list}
  try{const r=await sh.from("products").select("*").order("created_at",{ascending:false}).limit(800);if(!r.error){SW.list=r.data||[];SW.at=Date.now()}}catch{}
  return SW.list||[]}
function swipedIds(){return new Set(S.swipes.map(s=>String(s.pid)))}
function productScore(p){const keys=new Set(userStyles()),w=tagWeights(),own=new Set([...marked("own"),...marked("want"),...closetBrands()]);
  let sc=Math.random()*0.8;const why=[];
  const st=(p.styles||[]).filter(x=>keys.has(x));if(st.length){sc+=3;why.push(`${styleName(st[0]).toLowerCase()}`)}
  const pw=p.piece?w[p.piece]||0:0;if(pw>0){sc+=Math.min(4,pw);why.push(`${(PIECE[p.piece]?.short||p.piece).toLowerCase()} keeps showing up in your pins`)}
  const b=p.brand?findBrand(p.brand):null;if(b&&own.has(b.b)){sc+=1.5;why.push(`you're into ${b.b.toLowerCase()}`)}
  if(p.piece&&PIECE[p.piece]&&ownsPiece(PIECE[p.piece]))sc-=1;
  const budget=S.prefs?.budget||2;if(b&&b.t>budget&&b.k!=="Buy used")sc-=1.5;
  return {sc,why}}
function deck(){const seen=swipedIds();return (SW.list||[]).filter(p=>!seen.has(String(p.id))&&audOk(p.audience)).map(p=>({p,...productScore(p)})).sort((a,b)=>b.sc-a.sc)}
function cardHTML(x,behind){const p=x.p;const sz=p.piece&&PIECE[p.piece]?sizeFor(PIECE[p.piece]):"";
  return `<div class="sw-card${behind?" behind":""}" data-pid="${esc(String(p.id))}"><span class="stamp yes">like</span><span class="stamp no">nope</span>
    <div class="im"><img src="${esc(p.image)}" alt="${esc(p.title)}" referrerpolicy="no-referrer" loading="eager"></div>
    <div class="info"><span class="t">${esc(p.title)}</span><span class="m">${esc([p.brand,p.store,priceText(p)].filter(Boolean).join(" · "))}${sz?` · your size ${esc(sz)}`:""}</span>
    ${x.why.length?`<span class="why">rot › ${esc(x.why.slice(0,2).join(", "))}.</span>`:""}<a href="${esc(p.url)}" target="_blank" rel="noopener">See it on ${esc(p.store||"the shop")} ↗</a></div></div>`}
function renderDeck(){const st=$("sw-stack"),d=deck();
  $("sw-title").textContent=d.length?`Swipe · ${d.length} left`:"Swipe";
  if(!d.length){st.innerHTML=`<div class="sw-empty"><p class="rot-line">${(SW.list||[]).length?"you've seen everything. add more links and the deck grows for everyone.":"deck's empty. paste links to products you're eyeing and they show up here for everyone."}</p><button class="btn" id="sw-empty-add">Add product links</button></div>`;
    $("sw-empty-add").onclick=openAdd;$("sw-yes").disabled=$("sw-no").disabled=true;return}
  $("sw-yes").disabled=$("sw-no").disabled=false;
  st.innerHTML=(d[1]?cardHTML(d[1],true):"")+cardHTML(d[0]);
  const card=st.querySelector(".sw-card:not(.behind)");dragCard(card,d[0].p)}
function dragCard(card,p){let x0=0,y0=0,dx=0,active=false;
  const stamp=v=>{card.querySelector(".stamp.yes").style.opacity=Math.max(0,Math.min(1,v/90));card.querySelector(".stamp.no").style.opacity=Math.max(0,Math.min(1,-v/90))};
  card.addEventListener("pointerdown",e=>{if(e.target.closest("a"))return;active=true;x0=e.clientX;y0=e.clientY;dx=0;card.classList.add("drag");card.setPointerCapture(e.pointerId)});
  card.addEventListener("pointermove",e=>{if(!active)return;dx=e.clientX-x0;const dy=(e.clientY-y0)*0.2;card.style.transform=`translate(${dx}px,${dy}px) rotate(${dx/18}deg)`;stamp(dx)});
  const end=()=>{if(!active)return;active=false;card.classList.remove("drag");if(Math.abs(dx)>90)swipe(p,dx>0?1:-1,card);else{card.style.transform="";stamp(0)}};
  card.addEventListener("pointerup",end);card.addEventListener("pointercancel",end)}
async function swipe(p,v,card){card=card||$("sw-stack").querySelector(".sw-card:not(.behind)");if(!card||SW.busy)return;SW.busy=true;
  card.style.transform=`translate(${v*window.innerWidth}px,0) rotate(${v*20}deg)`;card.style.opacity="0";
  const doc={pid:p.id,v,at:Date.now(),title:p.title,image:p.image,url:p.url,price:p.price,currency:p.currency,brand:p.brand,store:p.store,piece:p.piece||null};
  S.swipes=[...S.swipes.filter(s=>String(s.pid)!==String(p.id)),{id:"p"+p.id,...doc}];SW.hist.push(p.id);
  setTimeout(()=>{SW.busy=false;renderDeck()},220);
  if(db)try{await db.doc("swipes/p"+p.id).set(doc)}catch{}}
$("sw-yes").onclick=()=>{const d=deck()[0];if(d)swipe(d.p,1)};
$("sw-no").onclick=()=>{const d=deck()[0];if(d)swipe(d.p,-1)};
$("sw-undo").onclick=async()=>{const id=SW.hist.pop();if(id==null){toast("Nothing to undo.");return}S.swipes=S.swipes.filter(s=>String(s.pid)!==String(id));renderDeck();if(db)try{await db.doc("swipes/p"+id).delete()}catch{}};
async function openDeck(){$("swipe").hidden=false;document.body.classList.add("locked");$("sw-stack").innerHTML='<div class="sw-empty"><p class="rot-line">loading the deck…</p></div>';
  await loadProducts();if(!(await claude.use("shared"))&&!(SW.list||[]).length){$("sw-stack").innerHTML='<div class="sw-empty"><p class="rot-line">the swipe deck needs sync turned on. sign in with your rotation account.</p></div>';return}renderDeck()}
function closeDeck(){$("swipe").hidden=true;document.body.classList.remove("locked");renderLikes();renderGaps()}
function openAdd(){$("swf").reset();$("swf-msg").textContent="";$("swadd").hidden=false;setTimeout(()=>$("swf-urls").focus(),50)}
$("sw-open").onclick=openDeck;$("sw-close").onclick=closeDeck;$("sw-add").onclick=openAdd;$("sw-add2").onclick=openAdd;
$("swf-close").onclick=()=>$("swadd").hidden=true;
$("swf").onsubmit=async e=>{e.preventDefault();const urls=[...new Set(($("swf-urls").value.match(/https:\/\/[^\s<>"']+/g)||[]))].slice(0,20);
  if(!urls.length){$("swf-msg").textContent="Paste at least one https link.";return}
  const sh=await claude.use("shared");if(!sh){$("swf-msg").textContent="Adding products needs sync turned on (sign in).";return}
  $("swf-go").disabled=true;let ok=0;const bad=[];
  for(const [n,u] of urls.entries()){$("swf-msg").textContent=`Reading ${n+1} of ${urls.length}…`;
    try{const {data,error}=await sh.functions.invoke("product",{body:{url:u}});const err=error?(await error.context?.json?.().catch(()=>null))?.error||error.message:data?.error;
      if(err||!data?.product){bad.push(`${new URL(u).hostname.replace(/^www\./,"")}: ${err||"no product found"}`);continue}
      const p=data.product;if(!data.existed&&!p.piece){const c=classifyProduct(p.title,p.brand);if(c.piece||c.styles.length){await sh.from("products").update(c).eq("id",p.id);Object.assign(p,c)}}
      SW.list=[p,...(SW.list||[]).filter(x=>x.id!==p.id)];ok++}
    catch(x){bad.push(`${u.slice(0,40)}…: ${x.message||"failed"}`)}}
  $("swf-go").disabled=false;$("sw-count").textContent=SW.list?.length?`${deck().length} to swipe`:"";
  $("swf-msg").textContent=(ok?`Added ${ok}. `:"")+(bad.length?`Couldn't read: ${bad.join("; ")}`:"");
  if(ok&&!bad.length){setTimeout(()=>{$("swadd").hidden=true;if(!$("swipe").hidden)renderDeck()},700)}else if(ok&&!$("swipe").hidden)renderDeck()};
function renderLikes(){const box=$("sw-likes");if(!box)return;const likes=S.swipes.filter(s=>s.v===1).sort((a,b)=>b.at-a.at);
  if(SW.list&&$("sw-count"))$("sw-count").textContent=deck().length?`${deck().length} to swipe`:"";
  if(!likes.length){box.innerHTML="";return}
  box.innerHTML=`<div class="panel"><h2>Liked from the deck</h2><p class="muted" style="font-size:.9rem">These count like pins: what you like here moves your Next buys.</p><div class="like-grid">${likes.map(s=>`<div class="like"><img src="${esc(s.image)}" alt="" referrerpolicy="no-referrer" loading="lazy"><div class="b"><span class="t">${esc(s.title)}</span><span class="muted">${esc([s.brand||s.store,priceText(s)].filter(Boolean).join(" · "))}</span>${typeof priceLine==="function"?priceLine("p"+s.pid):""}<div class="row"><a href="${esc(s.url)}" target="_blank" rel="noopener">Buy ↗</a><button class="btn ghost small" data-unlike="${esc(String(s.pid))}">Remove</button></div></div></div>`).join("")}</div></div>`;
  box.querySelectorAll("[data-unlike]").forEach(b=>b.onclick=async()=>{const id=b.dataset.unlike;S.swipes=S.swipes.filter(s=>String(s.pid)!==id);renderLikes();renderGaps();if(db)try{await db.doc("swipes/p"+id).delete()}catch{}})}

/* ---------- trip packing ---------- */
const TRIP={place:null,last:null};
try{TRIP.last=JSON.parse(localStorage.getItem("rot-trip")||"null")}catch{}
(()=>{const d=new Date(Date.now()+7*DAY);$("trip-start").value=d.toISOString().slice(0,10)})();
$("trip-city").addEventListener("input",()=>{TRIP.place=null});
async function findPlace(q){const r=await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en`)).json();return r.results||[]}
async function tripWeather(pl,start,days){const s=new Date(start+"T12:00:00"),e=new Date(s.getTime()+(days-1)*DAY);const iso=d=>d.toISOString().slice(0,10);
  const ahead=(e-Date.now())/DAY;const daily="temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max";
  let url,typical=false;
  if(ahead<=15)url=`https://api.open-meteo.com/v1/forecast?latitude=${pl.latitude}&longitude=${pl.longitude}&daily=${daily}&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&start_date=${iso(s)}&end_date=${iso(e)}`;
  else{typical=true;const ly=d=>{const x=new Date(d);x.setFullYear(x.getFullYear()-1);return iso(x)};
    url=`https://archive-api.open-meteo.com/v1/archive?latitude=${pl.latitude}&longitude=${pl.longitude}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,weather_code,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&start_date=${ly(s)}&end_date=${ly(e)}`}
  const j=await (await fetch(url)).json();if(!j.daily)throw 0;const D=j.daily;
  return {typical,days:D.time.map((t,i)=>{const hi=Math.round(D.apparent_temperature_max?.[i]??D.temperature_2m_max[i]),lo=Math.round(D.apparent_temperature_min?.[i]??D.temperature_2m_min[i]);
    const code=D.weather_code[i],rain=D.precipitation_probability_max?.[i]??((D.precipitation_sum[i]||0)>0.08?70:10),wind=Math.round(D.wind_speed_10m_max[i]||0);
    const date=new Date(s.getTime()+i*DAY);return {date:iso(date),label:date.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}),hi,lo,code,rain,wind,
      wx:rain>=50?wxBucket([71,73,75,77,85,86].includes(code)?71:63,wind):wxBucket(code,wind)}})}}
// one fit per day, preferring pieces already in the bag so you pack less
function packBuiltIn(days,pool){const packed=new Set(),plan=[];
  for(const d of days){const temp=Math.round(d.lo+(d.hi-d.lo)*0.6);let opts=[];for(let k=0;k<4;k++)opts.push(...fallbackFits(pool,temp,d.wx,"any"));
    const seen=new Set();opts=opts.filter(f=>{const k=f.items.join();if(seen.has(k))return false;seen.add(k);return true});
    const used=new Set(plan.map(p=>p.items.join()));
    const best=opts.map(f=>({f,s:f.items.filter(id=>packed.has(id)).length*2-(used.has(f.items.join())?3:0)-f.items.length*0.5})).sort((a,b)=>b.s-a.s)[0];
    if(!best){plan.push({...d,items:[],note:"nothing clean fits this weather"});continue}
    best.f.items.forEach(id=>packed.add(id));plan.push({...d,items:best.f.items,note:best.f.why})}
  return plan}
function extrasFor(days,plan){const n=days.length,cold=days.some(d=>d.lo<40),wet=days.some(d=>d.rain>=50),hot=days.some(d=>d.hi>=82);
  const x=[`${n+1} pairs of underwear and socks`,"sleepwear",n>=3?"a spare tee":"",wet?"a compact umbrella":"",cold?"a beanie and gloves":"",hot?"sunglasses and sunscreen":"","a charger and a laundry bag"];return x.filter(Boolean)}
function renderTrip(t){const box=$("trip-out");if(!t){box.innerHTML="";return}
  const ids=[...new Set(t.plan.flatMap(d=>d.items))].filter(id=>S.items.some(i=>i.id===id));const its=ids.map(id=>S.items.find(i=>i.id===id));
  const groups=CATS.map(([c,l])=>[l.split(" /")[0],its.filter(i=>i.cat===c)]).filter(g=>g[1].length);
  box.innerHTML=`<div class="trip-pack"><h3>${esc(t.city)} · ${t.plan.length} day${t.plan.length>1?"s":""} · ${ids.length} pieces</h3>
    ${t.typical?`<p class="muted" style="font-size:.85rem">Too far out for a forecast, so this uses last year's weather for the same dates.</p>`:""}
    ${t.note?`<p class="rot-line">${esc(t.note)}</p>`:""}
    <ul>${groups.map(([l,g])=>`<li><b>${esc(l)}:</b> ${g.map(i=>esc(i.name)).join(", ")}</li>`).join("")}</ul>
    <p class="label" style="margin-top:8px">Also pack</p><ul>${t.extras.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></div>`+
    t.plan.map((d,i)=>`<div class="trip-day"><h3>${esc(d.label)}</h3><span class="wxl">feels ${d.lo}–${d.hi}°F · ${esc(WX_CODES[d.code]||d.wx)}${d.rain>=30?` · ${d.rain}% rain`:""}${d.wind>=18?` · windy`:""}</span>
      ${d.items.length?`<div class="chat-fit">${fitItems(d.items).map(x=>cell(x)).join("")}</div>${piecesHTML(d.items)}`:""}${d.note?`<p class="rot-line">${esc(d.note.charAt(0).toLowerCase()+d.note.slice(1))}</p>`:""}
      ${d.items.length?`<button class="btn ghost small" style="align-self:flex-start" data-tripmq="${i}">ROT tries it on</button>`:""}</div>`).join("");
  box.querySelectorAll("[data-tripmq]").forEach(b=>b.onclick=()=>{const d=t.plan[+b.dataset.tripmq];openMannequin(d.items,d.label,"")})}
$("trip-form").onsubmit=async e=>{e.preventDefault();const q=$("trip-city").value.trim(),start=$("trip-start").value,days=Math.max(1,Math.min(14,+$("trip-days").value||3)),plan=$("trip-plan").value.trim();
  const pool=S.items.filter(i=>!i.wash);if(pool.length<3){$("trip-status").textContent="Add a top, bottoms and shoes to your closet first.";return}
  if(!q||!start){$("trip-status").textContent="Add a city and a date.";return}
  try{if(!TRIP.place||TRIP.place.name.toLowerCase()!==q.toLowerCase().split(",")[0].trim()){$("trip-status").textContent="Finding the city…";const res=await findPlace(q.split(",")[0]);
      if(!res.length){$("trip-status").textContent="Couldn't find that city. Try another spelling.";return}
      if(res.length>1&&!TRIP.place){$("trip-pick").innerHTML=res.map((c,i)=>`<button type="button" class="btn ghost small" data-tc="${i}">${esc([c.name,c.admin1,c.country_code].filter(Boolean).join(", "))}</button>`).join("");
        $("trip-status").textContent="Which one?";$("trip-pick").querySelectorAll("[data-tc]").forEach(b=>b.onclick=()=>{TRIP.place=res[+b.dataset.tc];$("trip-city").value=TRIP.place.name;$("trip-pick").innerHTML="";$("trip-form").requestSubmit()});return}
      TRIP.place=TRIP.place||res[0]}
    $("trip-go").disabled=true;$("trip-status").textContent="Checking the weather…";
    const W=await tripWeather(TRIP.place,start,days);let out;
    if(sample){$("trip-status").textContent="ROT is packing…";
      try{const r=await sample.json(`You're packing a carry-on for someone from clothes they already own. ${personText()} ${bodyText()} ${tasteText()}
Their styles: ${styleDefs(userStyles())}.
Trip: ${TRIP.place.name}, ${TRIP.place.country||""}, ${days} days.${plan?` Plans: ${plan}.`:""}
${W.typical?"Typical weather for those dates (last year's):":"Forecast"} (feels-like °F):
${W.days.map(d=>`${d.date}: ${d.lo}-${d.hi}°F, ${WX_CODES[d.code]||d.wx}, ${d.rain}% rain, wind ${d.wind} mph`).join("\n")}
Pack as few pieces as possible: re-wear bottoms, outerwear and shoes across days, vary tops. One full outfit per day (top or layer, bottom, shoes, plus a jacket when it's cold or wet). Match each day's weather.
Closet (id | name | type | color | silhouette, length | warmth 1-3 | styles | notes). Use ONLY these ids:
${closetText(pool)}
Reply with only JSON: {"note": one short lowercase sentence in the voice of ROT, a blunt stylist, about how you packed, "days": [{"date": "YYYY-MM-DD", "items": [ids], "note": one short sentence on why this works that day}], "extras": [short strings for non-closet things to bring, like underwear counts, an umbrella]}`,{cache:false,modelTier:"complex"});
        const ok=new Set(pool.map(i=>i.id));const byDate=new Map((r.days||[]).map(d=>[d.date,d]));
        const planDays=W.days.map(d=>{const g=byDate.get(d.date);return {...d,items:(g?.items||[]).filter(id=>ok.has(id)),note:String(g?.note||"")}});
        if(planDays.every(d=>d.items.length>=2))out={plan:planDays,extras:(r.extras||[]).map(String).slice(0,10),note:String(r.note||"")}}
      catch{}}
    if(!out)out={plan:packBuiltIn(W.days,pool),extras:extrasFor(W.days),note:""};
    TRIP.last={city:TRIP.place.name,typical:W.typical,...out};try{localStorage.setItem("rot-trip",JSON.stringify(TRIP.last))}catch{}
    renderTrip(TRIP.last);$("trip-status").textContent="";}
  catch{$("trip-status").textContent="Couldn't get the weather for that trip. Check your connection and try again."}
  finally{$("trip-go").disabled=false}};
if(TRIP.last){$("trip-city").value=TRIP.last.city||"";renderTrip(TRIP.last)}

/* ---------- share a fit ---------- */
async function bmpFor(id){try{const b=await RP.getBlob(id);return b?await createImageBitmap(b):null}catch{return null}}
function wrapText(x,text,maxW){const words=String(text).split(/\s+/),lines=[];let cur="";for(const w of words){const t=cur?cur+" "+w:w;if(x.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t}if(cur)lines.push(cur);return lines}
async function fitCardImage(ids,title,why,vibe){const its=fitItems(ids);if(!its.length)throw 0;
  const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  const style=STYLES[vibe]?vibe:mainStyle(),[ink,paper,acc]=(ROT.PALETTES[style]||ROT.PALETTES.streetwear).map(a=>`rgb(${a.join(",")})`);
  try{await document.fonts.ready}catch{}
  const MONO='"IBM Plex Mono", ui-monospace, monospace',DISP='"Silkscreen", "IBM Plex Mono", monospace',BODY='"Archivo", system-ui, sans-serif';
  x.fillStyle=paper;x.fillRect(0,0,W,H);
  // header
  x.fillStyle=ink;x.font=`700 30px ${MONO}`;x.textBaseline="top";x.fillText("ROTATION",56,52);
  x.font=`500 26px ${MONO}`;const d=new Date().toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}).toLowerCase();x.fillText(d,W-56-x.measureText(d).width,54);
  x.fillRect(56,98,W-112,4);
  x.font=`700 64px ${DISP}`;const tl=wrapText(x,(title||"today's fit").toUpperCase(),W-112).slice(0,2);tl.forEach((l,i)=>x.fillText(l,56,128+i*70));
  const top=128+tl.length*70+24;
  // ROT wearing the fit (left)
  const rc=document.createElement("canvas");rc.width=160;rc.height=280;ROT.render(rc,ROT.outfitFromItems(its,style),{scale:1,seed:9,glitch:true,body:rotBody()});
  const rw=360,rh=630;x.fillStyle=ink;x.fillRect(56,top,rw+8,rh+8);x.imageSmoothingEnabled=false;x.drawImage(rc,60,top+4,rw,rh);x.fillStyle=acc;x.fillRect(60,top+rh-6,rw,10);
  // real photos (right grid)
  const gx=56+rw+40,gw=W-56-gx,n=Math.min(its.length,6),cols=n<=2?1:2,rows=Math.ceil(n/cols),gap=14,cw=(gw-(cols-1)*gap)/cols,ch=(rh+8-(rows-1)*gap)/rows;
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";
  for(let i=0;i<n;i++){const it=its[i],cx=gx+(i%cols)*(cw+gap),cy=top+Math.floor(i/cols)*(ch+gap);x.fillStyle="#fff";x.fillRect(cx,cy,cw,ch);
    const bm=await bmpFor(it.flat||it.body);if(bm){const s=Math.max(cw/bm.width,ch/bm.height),dw=bm.width*s,dh=bm.height*s;x.save();x.beginPath();x.rect(cx,cy,cw,ch);x.clip();x.drawImage(bm,cx+(cw-dw)/2,cy+(ch-dh)/2,dw,dh);x.restore()}
    else{x.fillStyle=ink;x.font=`500 22px ${MONO}`;x.fillText((SLOT[it.cat]||it.cat).toLowerCase(),cx+14,cy+14)}
    x.strokeStyle=ink;x.lineWidth=4;x.strokeRect(cx,cy,cw,ch)}
  // pieces
  let y=top+rh+48;x.fillStyle=ink;x.font=`600 30px ${BODY}`;
  for(const it of its.slice(0,6)){const label=it.brand&&!it.name.toLowerCase().includes(it.brand.toLowerCase())?`${it.brand} ${it.name}`:it.name;
    x.fillStyle=colorOf(it);x.fillRect(56,y+6,22,22);x.strokeStyle=ink;x.lineWidth=2;x.strokeRect(56,y+6,22,22);x.fillStyle=ink;x.fillText(wrapText(x,label,W-112-40)[0],92,y);y+=46;if(y>H-150)break}
  // rot's line + footer
  if(why&&y<H-140){x.font=`500 26px ${MONO}`;x.fillStyle=ink;wrapText(x,"rot › "+why.charAt(0).toLowerCase()+why.slice(1),W-112).slice(0,2).forEach((l,i)=>x.fillText(l,56,y+14+i*36))}
  x.fillStyle=ink;x.fillRect(0,H-70,W,70);x.fillStyle=paper;x.font=`600 24px ${MONO}`;x.fillText("dressed by rot · "+location.host.replace(/^www\./,""),56,H-52);x.fillStyle=acc;x.fillRect(W-56-90,H-48,90,26);
  return await new Promise(r=>c.toBlob(r,"image/png"))}
async function shareFit(ids,title,why,vibe){try{toast("Making the card…");const blob=await fitCardImage(ids,title,why,vibe);const file=new File([blob],"rotation-fit.png",{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:title||"My fit",text:"dressed by rot"})}catch(e){if(e.name!=="AbortError")throw e}return}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="rotation-fit.png";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),20000);toast("Saved the card. Share it from your photos or downloads.")}
  catch{toast("Couldn't make the card.")}}

/* ---------- ROT in your pic ---------- */
const ST={photo:null,w:0,h:0,x:.72,y:.9,size:1.1,pose:"loom",look:"manifest",mask:null,base:null,assets:null,behind:true,aura:true,flip:false,seed:7,items:null,vibe:"",person:null,segFailed:false,busy:false};
const SEG_CDN="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/";
let segLib=null;
function loadSeg(){if(segLib)return segLib;segLib=new Promise((res,rej)=>{const s=document.createElement("script");s.src=SEG_CDN+"selfie_segmentation.js";s.crossOrigin="anonymous";
  s.onload=()=>{try{const seg=new window.SelfieSegmentation({locateFile:f=>SEG_CDN+f});seg.setOptions({modelSelection:0,selfieMode:false});res(seg)}catch(e){rej(e)}};s.onerror=rej;document.head.appendChild(s)});
  segLib.catch(()=>{segLib=null});return segLib}
function standOutfit(){const style=STYLES[ST.vibe]?ST.vibe:mainStyle();
  if(ST.items?.length)return ROT.outfitFromItems(fitItems(ST.items),style);
  return rotOutfit||ROT.outfitFor({style,items:S.items,pins:tagCounts(),focus:S.prefs?.focus||[]})}
const LOOKS={manifest:{grade:1,dissolve:1,lines:0,rim:1,grain:1},impact:{grade:1,dissolve:0,lines:1,rim:1,grain:1,streak:1},clean:{grade:0,dissolve:0,lines:0,rim:0,grain:0}};
const B8S=[[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],[3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]];
const hash=(x,y,k)=>{let h=(x*374761393+y*668265263+k*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295};
// ROT at native pixels, plus everything that only changes with pose/outfit/seed (cached)
function standBase(){const o=standOutfit(),key=[ST.pose,ST.seed,o.style,JSON.stringify(o.layers),JSON.stringify(rotBody())].join("|");
  if(ST.base?.key===key)return ST.base;
  const pal=ROT.PALETTES[o.style]||ROT.PALETTES.streetwear,rc=document.createElement("canvas");ROT.render(rc,o,{scale:1,seed:ST.seed,glitch:true,body:rotBody(),cutout:true,pose:ST.pose});
  const P=40,w=rc.width+P*2,h=rc.height+P*2,d=rc.getContext("2d").getImageData(0,0,rc.width,rc.height).data;
  let y0=1e9,y1=0,x0=1e9,x1=0;const eyes=[];
  for(let y=0;y<rc.height;y++)for(let x=0;x<rc.width;x++){const i=(y*rc.width+x)*4;if(d[i+3]){if(y<y0)y0=y;if(y>y1)y1=y;if(x<x0)x0=x;if(x>x1)x1=x;
    if(Math.abs(d[i]-pal[2][0])<6&&Math.abs(d[i+1]-pal[2][1])<6&&Math.abs(d[i+2]-pal[2][2])<6)eyes.push([x+P,y+P])}}
  // eyes = accent pixels in the top fifth of the figure (zips and snaps stay put)
  const headY=y0+(y1-y0)*.2,eyePx=eyes.filter(([,y])=>y-P<=headY);
  const blur=(px)=>{const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.filter=`blur(${px}px)`;x.drawImage(rc,P,P);x.drawImage(rc,P,P-4);x.filter="none";return x.getImageData(0,0,w,h).data};
  ST.base={key,rc,P,w,h,pal,style:o.style,box:[x0+P,y0+P,x1+P,y1+P],eyes:eyePx,auraA:blur(10),rimA:blur(2)};return ST.base}
// one animation frame of the ROT layer
function standLayer(t,look){const B=standBase(),{rc,P,w,h,pal}=B,acc=pal[2],paper=pal[1];
  const L=document.createElement("canvas");L.width=w;L.height=h;const x=L.getContext("2d");
  const fr=Math.floor(t*12);
  if(ST.aura){const img=x.createImageData(w,h),D=img.data,A=B.auraA,Rm=B.rimA;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const i=(yy*w+xx)*4;
      const wob=.78+.22*Math.sin(yy/6-t*7)+.12*(hash(xx>>2,yy>>2,fr)-.5);
      const v=A[i+3]/255*1.9*wob,th=(B8S[yy&7][xx&7]+.5)/64;
      if(look.rim&&Rm[i+3]>40&&Rm[i+3]<215){D[i]=Math.min(255,paper[0]+20);D[i+1]=Math.min(255,paper[1]+20);D[i+2]=Math.min(255,paper[2]+20);D[i+3]=hash(xx,yy,fr)>.25?235:0}
      else if(v>th){D[i]=acc[0];D[i+1]=acc[1];D[i+2]=acc[2];D[i+3]=170+Math.round(60*v)}}
    x.putImageData(img,0,0)}
  // chromatic ghost that jitters, then ROT
  const g=document.createElement("canvas");g.width=rc.width;g.height=rc.height;const gx=g.getContext("2d");gx.drawImage(rc,0,0);gx.globalCompositeOperation="source-in";gx.fillStyle=`rgb(${acc.join(",")})`;gx.fillRect(0,0,g.width,g.height);
  const jx=(hash(fr,1,ST.seed)>.8?-5:-2),jy=hash(fr,2,ST.seed)>.9?2:0;
  x.globalAlpha=.5;x.drawImage(g,P+jx,P+jy);x.globalAlpha=.96;x.drawImage(rc,P,P);x.globalAlpha=1;
  // occasional glitch slice
  if(hash(fr,3,ST.seed)>.82){const sy=Math.floor(B.box[1]+hash(fr,4,1)*(B.box[3]-B.box[1])),sh=2+Math.floor(hash(fr,5,1)*5),sx=(hash(fr,6,1)>.5?1:-1)*(3+Math.floor(hash(fr,7,1)*6));
    const strip=x.getImageData(0,sy,w,sh);x.clearRect(0,sy,w,sh);x.putImageData(strip,sx,sy)}
  // legs dissolve into static, with bits drifting up
  if(look.dissolve){const [bx0,by0,bx1,by1]=B.box,fy0=by0+(by1-by0)*.5,img=x.getImageData(0,0,w,h),D=img.data;
    for(let yy=Math.floor(fy0);yy<h;yy++){const f=Math.min(1,(yy-fy0)/(by1-fy0+1));for(let xx=0;xx<w;xx++){const i=(yy*w+xx)*4;if(!D[i+3])continue;
      if(hash(xx>>1,yy>>1,fr>>1)<f*1.15)D[i+3]=0;else if(f>.5)D[i+3]=Math.round(D[i+3]*(1.25-f))}}
    x.putImageData(img,0,0);
    for(let k=0;k<46;k++){const life=(t*.55+hash(k,9,ST.seed))%1,px=bx0+hash(k,10,ST.seed)*(bx1-bx0)+Math.sin(t*2+k)*4,py=by1-life*(by1-by0)*.75;
      x.fillStyle=k%3?`rgba(${pal[0].join(",")},${(1-life)*.9})`:`rgba(${acc.join(",")},${(1-life)})`;const sz=k%4?2:3;x.fillRect(Math.round(px),Math.round(py),sz,sz)}}
  return {L,B}}
function gradeCanvas(src,pal){const c=document.createElement("canvas");c.width=ST.w;c.height=ST.h;const x=c.getContext("2d");
  x.filter="contrast(1.22) saturate(.72) brightness(.86)";x.drawImage(src,0,0,ST.w,ST.h);x.filter="none";
  x.globalCompositeOperation="soft-light";x.fillStyle=`rgba(${pal[2].join(",")},.28)`;x.fillRect(0,0,ST.w,ST.h);
  x.globalCompositeOperation="multiply";x.fillStyle=`rgba(${pal[0].map(v=>Math.min(255,v+120)).join(",")},.35)`;x.fillRect(0,0,ST.w,ST.h);
  x.globalCompositeOperation="source-over";const v=x.createRadialGradient(ST.w/2,ST.h*.45,Math.min(ST.w,ST.h)*.35,ST.w/2,ST.h*.5,Math.max(ST.w,ST.h)*.75);
  v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,.62)");x.fillStyle=v;x.fillRect(0,0,ST.w,ST.h);return c}
function personFrom(bg){if(!ST.mask)return null;const c=document.createElement("canvas");c.width=ST.w;c.height=ST.h;const x=c.getContext("2d");x.drawImage(ST.mask,0,0);x.globalCompositeOperation="source-in";x.drawImage(bg,0,0,ST.w,ST.h);return c}
function stageAssets(look){const pal=standBase().pal,k=[look.grade,pal.join()].join("|");
  if(ST.assets?.k===k&&ST.assets.mask===ST.mask)return ST.assets;
  const bg=look.grade?gradeCanvas(ST.photo,pal):ST.photo;
  let grain=null;if(look.grain){grain=document.createElement("canvas");grain.width=grain.height=128;const gx=grain.getContext("2d"),im=gx.createImageData(128,128);
    for(let i=0;i<im.data.length;i+=4){const v=Math.random()*255;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=26}gx.putImageData(im,0,0)}
  ST.assets={k,mask:ST.mask,bg,person:personFrom(bg),grain};return ST.assets}
function drawStand(cv,t=0){if(!ST.photo)return;const look=LOOKS[ST.look]||LOOKS.manifest;
  if(cv.width!==ST.w||cv.height!==ST.h){cv.width=ST.w;cv.height=ST.h}const x=cv.getContext("2d");const A=stageAssets(look);
  x.drawImage(A.bg,0,0,ST.w,ST.h);
  const {L,B}=standLayer(t,look),{P,rc,pal}=B,rh=rc.height,dh=ST.size*ST.h,sc=dh/rh,dw=L.width*sc,dH=L.height*sc;
  const bob=Math.sin(t*2*Math.PI/2.6)*ST.h*.01;const cx=ST.x*ST.w,feet=ST.y*ST.h+bob,left=cx-dw/2,top=feet-(P+rh)*sc;
  const mapX=px=>{const X=left+px*sc;return ST.flip?2*cx-X:X},mapY=py=>top+py*sc;
  // speed lines from ROT's chest
  if(look.lines){const ox=mapX((B.box[0]+B.box[2])/2),oy=mapY(B.box[1]+(B.box[3]-B.box[1])*.35),R=Math.hypot(ST.w,ST.h),n=72,fr=Math.floor(t*12);
    x.save();for(let k=0;k<n;k++){if(hash(k,fr,5)<.35)continue;const a=k/n*Math.PI*2+hash(k,fr,6)*.05,r0=dh*(.42+hash(k,fr,7)*.3),wd=.006+hash(k,1,8)*.012;
      x.fillStyle=k%5?`rgba(${pal[1].join(",")},.32)`:`rgba(${pal[2].join(",")},.45)`;x.beginPath();x.moveTo(ox+Math.cos(a)*r0,oy+Math.sin(a)*r0);
      x.lineTo(ox+Math.cos(a-wd)*R,oy+Math.sin(a-wd)*R);x.lineTo(ox+Math.cos(a+wd)*R,oy+Math.sin(a+wd)*R);x.closePath();x.fill()}x.restore()}
  x.save();x.imageSmoothingEnabled=false;if(ST.flip){x.translate(cx,0);x.scale(-1,1);x.translate(-cx,0)}x.drawImage(L,left,top,dw,dH);x.restore();
  // glowing eyes (and a light streak on Impact)
  if(B.eyes.length&&look.rim!==0){x.save();x.globalCompositeOperation="lighter";const pulse=1+.18*Math.sin(t*5);
    const ex=B.eyes.reduce((a,[ex,ey])=>[a[0]+ex,a[1]+ey],[0,0]).map(v=>v/B.eyes.length);
    for(const [px,py] of [[ex[0]-3,ex[1]],[ex[0]+3,ex[1]]]){const X=mapX(px),Y=mapY(py),r=sc*7*pulse,gr=x.createRadialGradient(X,Y,0,X,Y,r);
      gr.addColorStop(0,`rgba(${pal[2].join(",")},.95)`);gr.addColorStop(.35,`rgba(${pal[2].join(",")},.45)`);gr.addColorStop(1,`rgba(${pal[2].join(",")},0)`);x.fillStyle=gr;x.fillRect(X-r,Y-r,r*2,r*2);
      if(look.streak){const dir=ST.flip?-1:1,len=sc*(26+10*Math.sin(t*3));const lg=x.createLinearGradient(X,Y,X+dir*len,Y);lg.addColorStop(0,`rgba(${pal[2].join(",")},.85)`);lg.addColorStop(1,`rgba(${pal[2].join(",")},0)`);
        x.fillStyle=lg;x.fillRect(Math.min(X,X+dir*len),Y-sc*.8,len,sc*1.6)}}
    x.restore()}
  if(ST.behind&&A.person)x.drawImage(A.person,0,0);
  if(A.grain){x.save();x.globalCompositeOperation="overlay";const off=(Math.floor(t*12)*37)%128;x.translate(-off,-off);x.fillStyle=x.createPattern(A.grain,"repeat");x.fillRect(0,0,ST.w+128,ST.h+128);x.restore()}
  // tag
  const f=Math.max(14,Math.round(ST.w/40));x.font=`700 ${f}px "IBM Plex Mono", ui-monospace, monospace`;const tag=`ROT ▸ ${styleName(B.style).toLowerCase()}`,tw=x.measureText(tag).width;
  const tx=Math.round(ST.w*.04),ty=Math.round(ST.h-f*2.4);x.fillStyle=`rgb(${pal[0].join(",")})`;x.fillRect(tx,ty,tw+f,f*1.5);x.fillStyle=`rgb(${pal[2].join(",")})`;x.fillRect(tx,ty+f*1.5-3,tw+f,3);
  x.fillStyle=`rgb(${pal[1].join(",")})`;x.textBaseline="middle";x.fillText(tag,tx+f/2,ty+f*.75)}
// Put ROT on the emptier side of you, bigger than you, head above yours
function autoPlace(){const m=ST.mask;if(!m)return;const d=m.getContext("2d").getImageData(0,0,ST.w,ST.h).data;let x0=ST.w,x1=0,y0=ST.h,y1=0;
  for(let y=0;y<ST.h;y+=4)for(let xx=0;xx<ST.w;xx+=4)if(d[(y*ST.w+xx)*4+3]>128){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<=x0||Math.max(x0,ST.w-x1)<ST.w*.18||y0<ST.h*.03)return;
  const right=ST.w-x1>=x0,ph=(y1-y0)/ST.h;ST.size=Math.max(.5,Math.min(1.5,ph*1.5));$("st-size").value=Math.round(ST.size*100);
  const rh=360,sc=ST.size*ST.h/rh,dw=(280+80)*sc;ST.flip=!right;$("st-flip").checked=ST.flip;
  ST.x=Math.max(.05,Math.min(.95,(right?x1-dw*.02:x0+dw*.02)/ST.w));ST.y=Math.min(1.5,(y0-.1*ST.h+(rh-40)*sc)/ST.h)}
// animation: ~12fps while the sheet is open
let stRAF=0,stLast=0;const stT0=performance.now();
function stLoop(now){stRAF=requestAnimationFrame(stLoop);if(now-stLast<80)return;stLast=now;try{drawStand($("st-cv"),(now-stT0)/1000)}catch{}}
function startAnim(){cancelAnimationFrame(stRAF);if(matchMedia("(prefers-reduced-motion: reduce)").matches){drawStand($("st-cv"),.4);return}stRAF=requestAnimationFrame(stLoop)}
function stopAnim(){cancelAnimationFrame(stRAF);stRAF=0}
function redrawStand(){if(!stRAF&&ST.photo)drawStand($("st-cv"),.4)}
async function cutPerson(){if(ST.mask||ST.segFailed)return ST.mask;$("st-status").textContent="Finding you in the photo…";
  try{const seg=await loadSeg();const src=document.createElement("canvas");src.width=ST.w;src.height=ST.h;src.getContext("2d").drawImage(ST.photo,0,0,ST.w,ST.h);
    const mask=await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error("timeout")),25000);seg.onResults(r=>{clearTimeout(t);res(r.segmentationMask)});seg.send({image:src}).catch(rej)});
    const c=document.createElement("canvas");c.width=ST.w;c.height=ST.h;const x=c.getContext("2d");x.filter=`blur(${Math.max(1,Math.round(ST.w/400))}px)`;x.drawImage(mask,0,0,ST.w,ST.h);
    ST.mask=c;ST.person=c;$("st-status").textContent="";return c}
  catch{ST.segFailed=true;$("st-behind").checked=false;ST.behind=false;$("st-status").textContent="Couldn't cut you out of this photo, so ROT stands in front. Try a photo with a plainer background.";return null}}
async function loadStandPhoto(file){if(!file)return;$("st-status").textContent="Loading…";
  try{const bmp=await createImageBitmap(await shrink(file,1440));ST.photo=bmp;ST.w=bmp.width;ST.h=bmp.height;ST.mask=null;ST.person=null;ST.assets=null;ST.segFailed=false;
    $("st-pick").hidden=true;$("st-cv").classList.add("on");$("st-controls").hidden=false;$("st-hint").hidden=false;$("st-verdict").hidden=true;$("st-rate").hidden=!sample;
    ST.size=+$("st-size").value/100;ST.y=Math.min(1.1,.08+ST.size*.8);ST.x=.72;startAnim();$("st-status").textContent="";if(ST.behind){await cutPerson();autoPlace()}}
  catch{$("st-status").textContent="Couldn't open that photo."}}
function renderPoses(){const box=$("st-poses");const o=standOutfit();
  box.innerHTML=Object.entries(ROT.POSES).filter(([k])=>k!=="stand").map(([k,p])=>`<button type="button" data-pose="${k}" aria-pressed="${ST.pose===k}"><canvas width="280" height="360"></canvas>${esc(p.name)}</button>`).join("")+`<button type="button" data-pose="random" aria-pressed="false"><canvas width="280" height="360"></canvas>random</button>`;
  box.querySelectorAll("[data-pose]").forEach(b=>{const k=b.dataset.pose;if(k!=="random")ROT.render(b.querySelector("canvas"),o,{scale:1,seed:3,glitch:false,body:rotBody(),pose:k});
    b.onclick=()=>{let k2=k;if(k==="random"){const ks=Object.keys(ROT.POSES).filter(x=>x!=="stand"&&x!==ST.pose);k2=ks[Math.floor(Math.random()*ks.length)]}
      ST.pose=k2;box.querySelectorAll("[data-pose]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.pose===k2));redrawStand()}})}
function renderLooks(){$("st-looks").querySelectorAll("[data-look]").forEach(b=>{b.setAttribute("aria-pressed",b.dataset.look===ST.look);b.onclick=()=>{ST.look=b.dataset.look;renderLooks();redrawStand()}})}
function openStand(items,vibe){ST.items=items||null;ST.vibe=vibe||"";ST.seed=7;ST.base=null;ST.assets=null;setTimeout(renderPoses,30);renderLooks();$("stand").hidden=false;document.body.classList.add("locked");
  if(!ST.photo){$("st-pick").hidden=false;$("st-cv").classList.remove("on");$("st-controls").hidden=true;$("st-hint").hidden=true}else startAnim()}
function closeStand(){stopAnim();$("stand").hidden=true;document.body.classList.remove("locked")}
$("st-close").onclick=closeStand;
$("st-file").onchange=e=>loadStandPhoto(e.target.files[0]);$("st-file2").onchange=e=>loadStandPhoto(e.target.files[0]);
$("st-size").oninput=e=>{ST.size=+e.target.value/100;redrawStand()};
$("st-behind").onchange=async e=>{ST.behind=e.target.checked;if(ST.behind)await cutPerson();redrawStand()};
$("st-aura").onchange=e=>{ST.aura=e.target.checked;redrawStand()};
$("st-flip").onchange=e=>{ST.flip=e.target.checked;redrawStand()};
$("st-glitch").onclick=()=>{ST.seed=1+Math.floor(Math.random()*999);redrawStand()};
(()=>{const cv=$("st-cv");let drag=null;
  cv.addEventListener("pointerdown",e=>{const r=cv.getBoundingClientRect();drag={px:e.clientX,py:e.clientY,x:ST.x,y:ST.y,k:ST.w/r.width};cv.setPointerCapture(e.pointerId)});
  cv.addEventListener("pointermove",e=>{if(!drag)return;ST.x=Math.max(-.2,Math.min(1.2,drag.x+(e.clientX-drag.px)*drag.k/ST.w));ST.y=Math.max(.2,Math.min(1.8,drag.y+(e.clientY-drag.py)*drag.k/ST.h));redrawStand()});
  const end=()=>{drag=null};cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end)})();
async function shareBlob(blob,name,text){const file=new File([blob],name,{type:blob.type});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});return}}catch(e){if(e.name==="AbortError")return}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),30000);toast("Saved. Find it in your downloads or photos.")}
$("st-share").onclick=async()=>{const cv=document.createElement("canvas");drawStand(cv,(performance.now()-stT0)/1000);const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",.93));
  shareBlob(blob,"rot-fit.jpg",$("st-verdict").hidden?"dressed by rot":$("st-verdict").textContent)};
// a 3-second loop of the animated pic
$("st-video").onclick=async()=>{const cv=$("st-cv");if(!cv.captureStream||!window.MediaRecorder){toast("This browser can't record video. Save the photo instead.");return}
  const type=["video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9","video/webm"].find(t=>MediaRecorder.isTypeSupported?.(t));if(!type){toast("This browser can't record video. Save the photo instead.");return}
  const b=$("st-video");b.disabled=true;b.textContent="Recording…";startAnim();
  try{const rec=new MediaRecorder(cv.captureStream(24),{mimeType:type,videoBitsPerSecond:6e6}),chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
    const done=new Promise(r=>rec.onstop=r);rec.start();await new Promise(r=>setTimeout(r,3200));rec.stop();await done;
    const blob=new Blob(chunks,{type:type.split(";")[0]});await shareBlob(blob,"rot-fit."+(type.includes("mp4")?"mp4":"webm"),"dressed by rot")}
  catch{toast("Couldn't record. Save the photo instead.")}finally{b.disabled=false;b.textContent="Save video"}};
$("st-rate").onclick=async()=>{if(!sample||!ST.photo)return;$("st-rate").disabled=true;$("st-status").textContent="ROT is looking…";
  try{const c=document.createElement("canvas");const s=Math.min(1,900/Math.max(ST.w,ST.h));c.width=ST.w*s;c.height=ST.h*s;c.getContext("2d").drawImage(ST.photo,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
    const r=await sample.json(`You are ROT, the stylist character in the wardrobe app Rotation: all lowercase, dry, blunt, never mean, no emoji. This is the user's fit pic. ${personText()} Their styles: ${styleDefs(userStyles())}.
Judge the outfit itself (fit, proportions, colors, shoes, how it reads for their style), not their body or face. Reply with only JSON: {"verdict": one or two short sentences, "score": 1-10, "fix": one specific tweak, using their closet if it helps: ${S.items.slice(0,40).map(i=>i.name).join("; ")}}`,{images:[blob],cache:false});
    $("st-verdict").textContent=`${r.score?r.score+"/10. ":""}${String(r.verdict||"").toLowerCase()}${r.fix?" fix: "+String(r.fix).toLowerCase():""}`;$("st-verdict").hidden=false;$("st-status").textContent=""}
  catch(e){$("st-status").textContent=sampleErr(e)}finally{$("st-rate").disabled=false}};
$("you-stand").onclick=()=>openStand(null,"");

/* ---------- price watch (needs Gemini) ---------- */
const PW={busy:false};
const pwKeyGap=item=>"g-"+hashStr(normTxt(item));
function pwTargets(){const gaps=liveGaps().slice(0,5).map(x=>({key:pwKeyGap(x.item),kind:"gap",label:x.item,brands:(x.brands||[]).slice(0,4),size:x.size||""}));
  const likes=S.swipes.filter(s=>s.v===1).sort((a,b)=>b.at-a.at).slice(0,6).map(s=>({key:"p"+s.pid,kind:"like",label:s.title,brand:s.brand||"",url:s.url,store:s.store,price:s.price,currency:s.currency}));
  return [...gaps,...likes]}
const pwOf=key=>S.prices.find(p=>p.id===key);
const money2=(v,c)=>v==null?"":`${CUR?.[c]||(c&&c!=="USD"?c+" ":"$")}${(+v)>=100||Number.isInteger(+v)?Math.round(+v).toLocaleString():(+v).toFixed(2)}`;
function pwAgo(at){const m=Math.round((Date.now()-at)/6e4);return m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`}
async function checkPrices(force){if(!sample||!db||PW.busy)return;const targets=pwTargets();if(!targets.length)return;
  const last=Math.max(0,...S.prices.map(p=>p.checked||0));if(!force&&Date.now()-last<12*36e5)return;
  PW.busy=true;$("pw-check").disabled=true;$("pw-meta").textContent="Gemini is checking prices…";
  const region=(navigator.language||"en-US").split("-")[1]||"US",budget=S.prefs?.budget||2;
  const prompt=`You're a price tracker for a wardrobe app. Search the web for the current price of each item below, the way a shopper in region ${region} would buy it new today. ${personText()}
Budget: ${budget===1?"budget ($)":budget===2?"mid-range ($$)":"open to premium and resale"}.
For general items, find the best-value current listing from a reputable retailer, preferring the suggested brands. For specific products with a link, check that exact product.
Mark "sale": true only when the listing shows a markdown from a higher price, and put that original price in "was".
Items:
${targets.map(t=>t.kind==="gap"?`- key ${t.key}: ${t.label}${t.brands.length?` (suggested brands: ${t.brands.join(", ")})`:""}${t.size?` (size ${t.size})`:""}`:`- key ${t.key}: ${t.label}${t.brand?` by ${t.brand}`:""}, product page ${t.url}`).join("\n")}
Reply with only JSON, no other text: {"prices":[{"key": same key, "price": number, "currency": "USD" or the 3-letter code, "store": shop name, "url": product page link, "sale": true/false, "was": original price or null, "note": under 12 words}]}. Leave an item out if you can't find a real current listing.`;
  try{const r=await sample.json(prompt,{search:true,cache:false});const by=new Map(targets.map(t=>[t.key,t]));const now=Date.now(),alerts=[];
    for(const p of (r.prices||[])){const t=by.get(String(p.key));const price=+p.price;if(!t||!isFinite(price)||price<=0)continue;
      const url=/^https:\/\//.test(String(p.url||""))?String(p.url):t.url||"";const pt={at:now,price,currency:String(p.currency||"USD").slice(0,3).toUpperCase(),store:String(p.store||"").slice(0,60),url,sale:!!p.sale,was:+p.was||null,note:String(p.note||"").slice(0,90)};
      const cur=pwOf(t.key),hist=[...(cur?.history||[]),pt].slice(-30),prev=cur?.last,low=Math.min(...(cur?.history||[]).map(h=>h.price),Infinity);
      const drop=prev&&pt.currency===prev.currency&&price<=prev.price*0.95,newSale=pt.sale&&!(prev?.sale),newLow=isFinite(low)&&price<low;
      await db.doc("prices/"+t.key).set({kind:t.kind,label:t.label,last:pt,history:hist,checked:now});
      if(drop||newSale||newLow){const a={key:t.key,label:t.label,to:price,from:drop?prev.price:pt.was||null,currency:pt.currency,store:pt.store,url,sale:pt.sale,at:now};alerts.push(a);await db.doc("pricealerts/"+t.key+"-"+now).set(a)}}
    for(const t of targets)if(!pwOf(t.key)&&!(r.prices||[]).some(p=>String(p.key)===t.key))await db.doc("prices/"+t.key).set({kind:t.kind,label:t.label,last:null,history:[],checked:now});
    $("pw-meta").textContent=alerts.length?`${alerts.length} price drop${alerts.length>1?"s":""} found.`:"Checked. No drops yet.";if(alerts.length)toast(`rot › ${alerts[0].label.toLowerCase()} dropped to ${money2(alerts[0].to,alerts[0].currency)}.`)}
  catch(e){$("pw-meta").textContent=sampleErr(e)}
  finally{PW.busy=false;$("pw-check").disabled=false;renderPrices()}}
function priceLine(key){const p=pwOf(key);if(!p?.last)return "";const l=p.last;
  return `<div class="gap-price"><span>${l.sale?`<span class="sale">SALE</span> `:""}<b>${esc(money2(l.price,l.currency))}</b>${l.was?` <span class="was">${esc(money2(l.was,l.currency))}</span>`:""}</span><span>at ${l.url?`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.store||"the shop")} ↗</a>`:esc(l.store||"")}</span><span class="muted">checked ${pwAgo(p.checked)}</span></div>`}
function renderPrices(){const box=$("pw");if(!box)return;box.hidden=!sample;const dot=$("tab-buys").querySelector(".dot");const fresh=S.pricealerts.filter(a=>!a.seen&&Date.now()-a.at<7*864e5);
  if(fresh.length&&!dot)$("tab-buys").insertAdjacentHTML("beforeend",'<span class="dot" aria-label="New price drops"></span>');else if(!fresh.length&&dot)dot.remove();
  if(!sample)return;const last=Math.max(0,...S.prices.map(p=>p.checked||0));
  if(!PW.busy)$("pw-meta").textContent=last?`Gemini checks prices of your top next buys and liked products every 12 hours. Last check ${pwAgo(last)}.`:"Gemini will check prices of your top next buys and liked products.";
  $("pw-alerts").innerHTML=fresh.sort((a,b)=>b.at-a.at).slice(0,4).map(a=>`<div class="pw-alert"><p>rot › ${esc(a.label.toLowerCase())} ${a.sale&&!a.from?"is on sale":"dropped"}${a.from?` from ${esc(money2(a.from,a.currency))}`:""} to <b>${esc(money2(a.to,a.currency))}</b>${a.store?` at ${esc(a.store)}`:""}.${a.url?` <a href="${esc(a.url)}" target="_blank" rel="noopener">see it ↗</a>`:""}</p><button class="btn ghost small" data-seen="${esc(a.id)}">Got it</button></div>`).join("");
  $("pw-alerts").querySelectorAll("[data-seen]").forEach(b=>b.onclick=async()=>{const a=S.pricealerts.find(x=>x.id===b.dataset.seen);if(a&&db)try{await db.doc("pricealerts/"+a.id).set({...a,id:undefined,seen:true})}catch{}})}
$("pw-check").onclick=()=>checkPrices(true);

/* ---------- saved ---------- */
function renderSaved(){$("n-saved").textContent=S.fits.length;const l=$("s-list");
  l.innerHTML=S.fits.length?S.fits.map(f=>fitCard(f,0,"saved")).join(""):`<div class="empty"><h3>No saved fits</h3><p>Hit Save on a fit you'd actually wear and it lands here.</p></div>`;
  l.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const f=S.fits.find(x=>x.id===b.dataset.mq);if(f)openMannequin(f.items,f.title,f.vibe)});
  l.querySelectorAll("[data-stand]").forEach(b=>b.onclick=()=>{const f=S.fits.find(x=>x.id===b.dataset.stand);if(f)openStand(f.items,f.vibe)});
  l.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>{const f=S.fits.find(x=>x.id===b.dataset.share);if(f)shareFit(f.items,f.title,f.why,f.vibe)});
  l.querySelectorAll("[data-wores]").forEach(b=>b.onclick=()=>{const f=S.fits.find(x=>x.id===b.dataset.wores);if(f)logWear(f.items,f.title)});
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
  db.doc("sizes/me").onSnapshot(d=>{S.sizes=d.exists?d.data():null;if(!sample)renderGaps();if(S.tab==="you")fillSizeForm()},()=>{});
  sub(db.collection("prices"),"prices",()=>{renderPrices();renderGaps();renderLikes()});
  sub(db.collection("pricealerts").orderBy("at","desc").limit(50),"pricealerts",()=>{renderPrices();if(S.tab==="buys")sayNow()});
  sub(db.collection("swipes"),"swipes",()=>{renderLikes();if(!sample)renderGaps()});
  sub(db.collection("wears").orderBy("at","desc").limit(1000),"wears",()=>{wearCache=null;renderRot();renderCloset();renderFits();renderSaved();sayNow()});
  sub(db.collection("fitref"),"fitref",()=>{renderFitRefs();renderGaps()});
  db.doc("body/me").onSnapshot(d=>{S.body=d.exists?d.data():null;renderRot();if(S.tab==="you")fillBodyForm()},()=>{});
  // New here? Ask the style quiz once the account's data has had a chance to sync down.
  await RP.firstSync;if(!S.prefs)openOnboard();
  renderPrices();setTimeout(()=>checkPrices(false),4000);
})();
