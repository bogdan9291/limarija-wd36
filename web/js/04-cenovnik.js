/* ---------- cenovnik i predračuni ---------- */
let lockOn=true,SET={pdv:20,lockAfterDelivery:true};
async function saveSet(p){SET={...SET,...p};await db.doc("settings/main").set(SET)}
function lineOid(x,l){return l.oid||x.orderId||(x.izvorTip==="nalog"?x.izvorId:"")||""}
function otpOrderIds(x){const s=new Set();(x.lines||[]).forEach(l=>{const i=lineOid(x,l);if(i)s.add(i)});const i=x.orderId||(x.izvorTip==="nalog"?x.izvorId:"");if(i)s.add(i);return s}
function lockedOrderIds(){const s=new Set();if(!lockOn)return s;otpr.forEach(x=>otpOrderIds(x).forEach(i=>s.add(i)));return s}
function isOrderLocked(o){return !!o&&lockedOrderIds().has(oid(o))}
function isProLocked(p){if(!lockOn||!p)return false;return otpr.some(x=>x.izvorTip==="predracun"&&x.izvorId===p.year+"_"+p.no)||!!(p.orderId&&lockedOrderIds().has(p.orderId))}
function lockNums(o){const id=oid(o);return otpr.filter(x=>otpOrderIds(x).has(id)).map(x=>x.no+"/"+x.year).join(", ")}
function applyOrderLock(){
  const lk=!!cur&&!cur._new&&!cur._pro&&isOrderLocked(cur),rl=ROLE==="radnik",ro=ROLE==="pregled";
  document.querySelectorAll("#view > .card input,#view > .card select,#view > .card textarea,#view > .card button").forEach(el=>{el.disabled=ro||(rl?!(el.id==="fSt"||el.dataset.gst!==undefined):(lk&&el.id!=="fSt"&&el.dataset.gst===undefined))});
  $("btnDel").disabled=lk||rl||ro;$("btnSave").disabled=ro;
  const m=$("lockMsg");m.classList.toggle("hide",!(lk||rl||ro));if(rl)m.textContent="Radnik: možeš da menjaš samo status.";else if(ro)m.textContent="Samo pregled – izmene nisu dozvoljene.";else if(lk)m.textContent="🔒 Nalog je zaključan jer je izdata otpremnica "+lockNums(cur)+". Menjati možeš samo status. Podešavanje možeš da promeniš u tabu Podešavanja.";
}
function applyProLock(){
  const lk=!!pcur&&!pcur._new&&isProLocked(pcur);
  document.querySelectorAll("#pview > .card input,#pview > .card select,#pview > .card textarea,#pview > .card button").forEach(el=>{el.disabled=ROLE==="pregled"||(lk&&!el.closest("#paybox"))});
  if(!lk&&pcur)$("pNo").disabled=$("pYr").disabled=!pcur._new;
  $("pDel").disabled=lk;
  const m=$("pLockMsg");m.classList.toggle("hide",!lk);if(lk)m.textContent="🔒 Predračun je zaključan jer je izdata otpremnica. Menjati možeš samo uplate.";
}
let prices=[],proformas=[],otpr=[],nabavne=[],ocur=null,odirty=false,pdvRate=20,pcur=null,pdirty=false,lastDoc=null;
const money=n=>(+n||0).toLocaleString("sr-RS",{minimumFractionDigits:2,maximumFractionDigits:2});
const r2=n=>Math.round(n*100)/100,cn=l=>parseFloat(String(l.cena).replace(",","."))||0;
const VIEWS={h:"home",n:"list",o:"view",pl:"plist",pv:"pview",c:"cen",ol:"olist",ov:"oview",r:"prod",s:"sett",k:"kup"};
let curView="h";
function show(t){
  curView=t;const pm=!!(cur&&cur._pro&&t==="o");$("view").classList.toggle("promode",pm);$("fStl").textContent=pm?"Predračun":"Radni nalog";$("fNoL").textContent=pm?"Broj predračuna":"Broj naloga";$("btnSave").textContent=pm?"Sačuvaj i nastavi na cene →":"Sačuvaj";
  Object.values(VIEWS).forEach(id=>$(id).classList.add("hide"));$(VIEWS[t]).classList.remove("hide");
  $("btnNew").classList.toggle("hide",t!=="n");
  $("ptitle").textContent=pm?"Predračuni":{h:"Početna",n:"Nalozi",o:"Nalozi",pl:"Predračuni",pv:"Predračuni",c:"Cenovnik",ol:"Otpremnice",ov:"Otpremnice",r:"Proizvodnja",s:"Podešavanja",k:"Kupci"}[t]||"";
  const tab=pm?"tabP":{h:"tabH",n:"tabN",o:"tabN",pl:"tabP",pv:"tabP",c:"tabC",ol:"tabO",ov:"tabO",r:"tabR",s:"tabS",k:"tabK"}[t];["tabH","tabN","tabP","tabC","tabO","tabR","tabS","tabK"].forEach(id=>$(id).classList.toggle("on",id===tab));
  if(t==="n")renderList();if(t==="pl")renderPL();if(t==="h")renderHome();if(t==="ol")renderOL();if(t==="r"){renderNab();renderProd()}if(t==="c")renderPrices();if(t==="k")showKupci();if(t==="s"){$("setLock").checked=lockOn;bkInfo()}
}
async function goTab(t){
  if((ROLE_DENY[ROLE]||[]).includes(t))return;
  if(((cur&&dirty)||(pcur&&pdirty)||(ocur&&odirty))&&!(await ask("Ima nesačuvanih izmena. Napustiti?")))return;
  cur=null;dirty=false;pcur=null;pdirty=false;ocur=null;odirty=false;$("view").appendChild($("sheetbox"));show(t);
}
$("tabH").onclick=()=>goTab("h");$("tabN").onclick=()=>goTab("n");$("tabP").onclick=()=>goTab("pl");$("tabC").onclick=()=>goTab("c");$("tabO").onclick=()=>goTab("ol");$("tabR").onclick=()=>goTab("r");$("tabS").onclick=()=>goTab("s");$("tabK").onclick=()=>goTab("k");

// cenovnik
function priceFor(v){const k=String(v).trim().toLowerCase();const a=prices.find(p=>String(p.naziv).trim().toLowerCase()===k&&p.vele>0);return a?a.vele:null}
function priceRow(p){return `<tr data-id="${esc(p.id)}"><td><input data-k="naziv" value="${esc(p.naziv)}" placeholder="Naziv" style="min-width:200px"></td><td><select data-k="jm">${opts(UNITS.includes(p.jm)?UNITS:[...UNITS,p.jm],p.jm)}</select></td><td><input data-k="vele" inputmode="decimal" value="${esc(r2(p.vele))}" style="width:140px"></td><td><input data-k="mp" inputmode="decimal" value="${esc(r2(p.vele*(1+pdvRate/100)))}" style="width:140px"></td><td style="white-space:nowrap"><button data-cp title="Kopiraj stavku">⧉</button> <button class="d" data-x title="Obriši">✕</button></td></tr>`}
function renderPrices(){
  $("cen").appendChild($("sheetbox"));priceSheet();
  const a=document.activeElement;if(a&&$("ptb").contains(a)&&a.tagName!=="BUTTON")return;
  $("ptb").innerHTML=Object.keys(TIPOVI).map(g=>{
    const rows=prices.filter(p=>(p.grupa||"trapez")===g).sort((x,y)=>String(x.naziv).localeCompare(String(y.naziv),"sr-Latn"));
    return `<div class="seg" data-g="${g}"><div class="row" style="justify-content:space-between;margin-bottom:6px"><div class="row" style="gap:6px;flex-wrap:nowrap"><span data-gh="${g}" title="Prevuci da promeniš redosled grupa" aria-label="Prevuci grupu" style="cursor:grab;touch-action:none;user-select:none;padding:6px 8px;font-size:20px;line-height:1;color:var(--mu)">⠿</span><input data-gn="${g}" value="${esc(TIPOVI[g])}" style="font-weight:700;min-width:200px;max-width:320px" title="Klikni da preimenuješ grupu" aria-label="Naziv grupe">${(!BASE_T[g]&&!rows.length)?`<button class="d" data-gdel="${g}" title="Ukloni praznu grupu">✕</button>`:""}</div><div class="row" style="gap:8px;flex-wrap:nowrap"><button class="p" data-gdup="${g}" title="Napravi kopiju cele grupe sa svim cenama" style="white-space:nowrap">⧉ Dupliraj grupu</button><button class="p" data-addp="${g}" style="white-space:nowrap">+ Dodaj cenu</button></div></div>${rows.length?`<div class="sc"><table><thead><tr><th>Naziv</th><th>Jedinica mere</th><th>Veleprodajna cena (RSD)</th><th>Maloprodajna cena (RSD, +${esc(pdvRate)}% PDV)</th><th></th></tr></thead><tbody>${rows.map(priceRow).join("")}</tbody></table></div>`:`<div class="msg" style="padding:8px">Nema stavki.</div>`}</div>`}).join("");
  $("pempty").textContent="";
}
$("ptb").addEventListener("change",async e=>{
  const tr=e.target.closest("tr"),k=e.target.dataset.k;if(!tr||!k)return;const p=prices.find(x=>x.id===tr.dataset.id);if(!p)return;
  if(k==="mp"){p.vele=Math.round(num(e.target.value)/(1+pdvRate/100)*10000)/10000;tr.querySelector('[data-k="vele"]').value=r2(p.vele)}
  else p[k]=k==="vele"?num(e.target.value):e.target.value;
  try{await db.collection("prices").doc(p.id).set({grupa:p.grupa||"trapez",naziv:p.naziv,jm:p.jm,vele:p.vele});$("cstatus").textContent="Sačuvano ✓"}catch(x){$("cstatus").textContent="Greška pri čuvanju"}
});
$("ptb").addEventListener("click",async e=>{
  const d=e.target.dataset;
  if(d.addp){try{await db.collection("prices").doc().set({grupa:d.addp,naziv:"",jm:DEFU[d.addp]||"komad",vele:0})}catch(x){$("cstatus").textContent="Greška pri čuvanju"}return}
  if(d.cp!==undefined){const p=prices.find(x=>x.id===e.target.closest("tr").dataset.id);if(!p)return;
    try{await db.collection("prices").doc().set({grupa:p.grupa||"trapez",naziv:String(p.naziv||"")+" (kopija)",jm:p.jm,vele:p.vele});$("cstatus").textContent="Stavka je kopirana – promeni naziv kopije."}catch(x){$("cstatus").textContent="Greška pri kopiranju"}return}
  if(d.x===undefined||!(await ask("Obrisati ovu cenu?")))return;
  try{await db.collection("prices").doc(e.target.closest("tr").dataset.id).delete()}catch(x){$("cstatus").textContent="Brisanje nije uspelo"}
});

$("ptb").addEventListener("change",async e=>{
  const g=e.target.dataset.gn;if(!g)return;const S=$("cstatus");
  const name=e.target.value.trim();
  if(!name){e.target.value=TIPOVI[g];S.textContent="Naziv grupe ne sme biti prazan.";return}
  if(Object.keys(TIPOVI).some(k=>k!==g&&TIPOVI[k].toLowerCase()===name.toLowerCase())){e.target.value=TIPOVI[g];S.textContent="Grupa sa tim nazivom već postoji.";return}
  try{await saveSet({gNames:{...(SET.gNames||{}),[g]:name}});applyGrupe();S.textContent="Grupa preimenovana ✓";renderPrices()}catch(x){S.textContent="Greška pri čuvanju"}
});

$("ptb").addEventListener("click",async e=>{
  const g=e.target.dataset.gdup;if(!g)return;const S=$("cstatus"),B=e.target;B.disabled=true;
  try{
    const src=prices.filter(p=>(p.grupa||"trapez")===g),base=TIPOVI[g]||"Grupa";
    let name=base+" (kopija)",i=2;while(Object.values(TIPOVI).some(v=>v.toLowerCase()===name.toLowerCase()))name=base+" (kopija "+(i++)+")";
    const id="g"+Date.now().toString(36);
    await saveSet({gCustom:[...(Array.isArray(SET.gCustom)?SET.gCustom:[]),id],gNames:{...(SET.gNames||{}),[id]:name},gKind:{...(SET.gKind||{}),[id]:kindOf(g)}});applyGrupe();
    for(const p of src)await db.collection("prices").doc().set({grupa:id,naziv:p.naziv,jm:p.jm,vele:p.vele});
    S.textContent="Grupa „"+name+"“ napravljena sa "+src.length+" cena – preimenuj je i prilagodi cene.";renderPrices();
  }catch(x){S.textContent="Greška pri dupliranju: "+(x.message||x.code||"nepoznata")}
  finally{B.disabled=false}
});
let gdrag=null;
function gdClear(){$("ptb").querySelectorAll(".seg").forEach(x=>x.classList.remove("dropB","dropA","dragging"))}
$("ptb").addEventListener("pointerdown",e=>{const h=e.target.closest("[data-gh]");if(!h)return;e.preventDefault();const seg=h.closest(".seg");gdrag={g:h.dataset.gh,seg,over:null,after:false};seg.classList.add("dragging");try{h.setPointerCapture(e.pointerId)}catch(x){}});
$("ptb").addEventListener("pointermove",e=>{
  if(!gdrag)return;
  if(e.clientY<90)window.scrollBy(0,-14);else if(e.clientY>window.innerHeight-90)window.scrollBy(0,14);
  const el=document.elementFromPoint(e.clientX,e.clientY),t=el&&el.closest?el.closest("#ptb .seg"):null;
  $("ptb").querySelectorAll(".seg").forEach(x=>x.classList.remove("dropB","dropA"));
  if(t&&t!==gdrag.seg){const r=t.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;t.classList.add(after?"dropA":"dropB");gdrag.over=t.dataset.g;gdrag.after=after}else gdrag.over=null;
});
$("ptb").addEventListener("pointerup",async()=>{
  if(!gdrag)return;const d=gdrag;gdrag=null;gdClear();if(!d.over)return;
  const keys=Object.keys(TIPOVI).filter(k=>k!==d.g);keys.splice(keys.indexOf(d.over)+(d.after?1:0),0,d.g);
  try{await saveSet({gOrder:keys});applyGrupe();renderPrices();$("cstatus").textContent="Redosled grupa sačuvan ✓"}catch(x){$("cstatus").textContent="Greška pri čuvanju"}
});
$("ptb").addEventListener("pointercancel",()=>{gdrag=null;gdClear()});
$("gAdd").onclick=async()=>{
  const S=$("cstatus"),name=$("gNewName").value.trim();
  if(!name){S.textContent="Upiši naziv nove grupe.";return}
  if(Object.values(TIPOVI).some(v=>v.toLowerCase()===name.toLowerCase())){S.textContent="Grupa sa tim nazivom već postoji.";return}
  const id="g"+Date.now().toString(36);
  try{await saveSet({gCustom:[...(Array.isArray(SET.gCustom)?SET.gCustom:[]),id],gNames:{...(SET.gNames||{}),[id]:name}});applyGrupe();$("gNewName").value="";S.textContent="Grupa „"+name+"“ dodata – dodaj cene u nju.";renderPrices()}catch(x){S.textContent="Greška pri čuvanju"}
};
$("ptb").addEventListener("click",async e=>{
  const g=e.target.dataset.gdel;if(!g)return;const S=$("cstatus");
  if(prices.some(p=>(p.grupa||"trapez")===g)){S.textContent="Grupa nije prazna.";return}
  if(orders.some(o=>(o.segments||[]).some(sg=>sg.tip===g))||proformas.some(q=>(q.segments||[]).some(sg=>sg.tip===g))){S.textContent="Grupa se koristi u nalozima – ne može da se ukloni.";return}
  if(!(await ask("Ukloniti praznu grupu „"+TIPOVI[g]+"“?")))return;
  try{const n={...(SET.gNames||{})},kd={...(SET.gKind||{})};delete n[g];delete kd[g];await saveSet({gCustom:(SET.gCustom||[]).filter(x=>x!==g),gNames:n,gKind:kd});applyGrupe();renderPrices()}catch(x){S.textContent="Greška pri čuvanju"}
});
$("ptb").addEventListener("input",e=>{
  const k=e.target.dataset.k,tr=e.target.closest("tr");if(k!=="vele"&&k!=="mp")return;
  const rt=1+pdvRate/100,v=num(e.target.value);
  if(k==="vele")tr.querySelector('[data-k="mp"]').value=r2(v*rt);else tr.querySelector('[data-k="vele"]').value=r2(v/rt);
});
function priceSheet(){
  const CG5='<colgroup><col style="width:44px"><col style="width:38%"><col style="width:14%"><col style="width:21%"><col></colgroup>';
  const parts=Object.keys(TIPOVI).map(g=>{
    const rows=prices.filter(p=>(p.grupa||"trapez")===g&&String(p.naziv).trim()).sort((x,y)=>String(x.naziv).localeCompare(String(y.naziv),"sr-Latn")).map((p,i)=>`<tr><td>${i+1}.</td><td>${esc(p.naziv)}</td><td>${esc(p.jm)}</td><td>${money(p.vele)}</td><td>${money(r2(p.vele*(1+pdvRate/100)))}</td></tr>`).join("");
    if(!rows)return"";
    return `<div class="sg"><div class="st">${TIPOVI[g]}</div><table>${CG5}<thead><tr><th>#</th><th>Naziv</th><th>Jed. mere</th><th>Veleprodajna cena (RSD)</th><th>Maloprodajna cena (RSD)</th></tr></thead><tbody>${rows}</tbody></table></div>`}).join("");
  $("sheet").innerHTML=wf(`<div class="bn"><div><h2>Limarija WD-36</h2><div class="ad"><b>Miloš Spasić PR Kovačka radionica WD-36</b><br>Lole Ribara 40, 25250 Odžaci<br>PIB: 110029026 · MB: 64594940<br>Tekući račun: 325-9500600059441-13</div></div></div><div class="bd">
  <div class="hd"><div style="flex:2"><span>Dokument</span><b class="no">Cenovnik</b></div><div><span>Datum</span><b>${fmtDate(new Date().toISOString().slice(0,10))}</b></div><div><span>PDV</span><b>${esc(pdvRate)}%</b></div></div>
  ${parts}</div>`);
}
function refreshLocks(){
  try{if(!$("list").classList.contains("hide"))renderList();if(!$("plist").classList.contains("hide"))renderPL();if(cur){applyOrderLock();updSegBadges()}if(pcur)applyProLock()}catch(e){}
}
$("setLock").onchange=async()=>{lockOn=$("setLock").checked;refreshLocks();
  try{await saveSet({lockAfterDelivery:lockOn});$("setStatus").textContent="Sačuvano ✓"}catch(e){$("setStatus").textContent="Greška pri čuvanju"}};
