/* ---------- rezervna kopija ---------- */
const BK_COLL=[
  {n:"orders",get:()=>orders.map(o=>[oid(o),o])},
  {n:"proformas",get:()=>proformas.map(q=>[q.year+"_"+q.no,q])},
  {n:"otpremnice",get:()=>otpr.map(q=>[q.year+"_"+q.no,q])},
  {n:"prices",get:()=>prices.map(({id,...d})=>[id,d])},
  {n:"nabavne",get:()=>nabavne.map(({id,...d})=>[id,d])},
  {n:"customers",get:()=>customers.map(({id,...d})=>[id,d])},
  {n:"zaliha",get:()=>zaliha.map(({id,...d})=>[id,d])}
];
const fdate=()=>new Date().toISOString().slice(0,10);
async function saveFile(name,text){const dl=await claude.use("downloads");if(!dl)throw new Error("Preuzimanje nije dostupno u ovom prikazu.");await dl.save({filename:name,data:new TextEncoder().encode(text).buffer})}
function applyBoje(){
  const before=JSON.stringify(BOJE),nl=(Array.isArray(SET.boje)&&SET.boje.length)?SET.boje:BOJE_DEF;
  BOJE.length=0;BOJE.push(...nl);
  try{renderBoje()}catch(e){}
  if(before!==JSON.stringify(BOJE)){try{if(cur&&!$("view").classList.contains("hide")){syncHead();renderItems()}if(ocur&&!$("oview").classList.contains("hide"))renderOtp()}catch(e){}}
}
function renderBoje(){
  const L=$("bojeList");if(!L||(document.activeElement&&L.contains(document.activeElement)))return;
  L.innerHTML=BOJE.map((b,i)=>`<div class="row" style="margin-bottom:6px" data-i="${i}"><input data-bn value="${esc(b)}" style="width:200px" aria-label="Naziv boje"><button class="d" data-bd title="Ukloni boju iz ponude">✕</button></div>`).join("");
}
async function saveBoje(list,msg){
  try{await saveSet({boje:list});$("bojeSt").textContent=msg||"Sačuvano ✓"}catch(e){$("bojeSt").textContent="Greška pri čuvanju"}
}
async function renameBoja(oldN,newN){
  const rep=a=>{let ch=false;(a||[]).forEach(x=>{if(x&&x.boja===oldN){x.boja=newN;ch=true}});return ch};
  let n=0;
  for(const o of orders){const d=JSON.parse(JSON.stringify(o));let ch=rep(d.items);(d.segments||[]).forEach(g=>{if(rep(g.items))ch=true});if(ch){await db.collection("orders").doc(oid(o)).set(d);n++}}
  for(const q of proformas){const d=JSON.parse(JSON.stringify(q));const {id:_i,...rest}=d;if(rep(rest.lines)){await db.collection("proformas").doc(q.year+"_"+q.no).set(rest);n++}}
  for(const x of otpr){const d=JSON.parse(JSON.stringify(x));if(rep(d.lines)){await db.collection("otpremnice").doc(x.year+"_"+x.no).set(d);n++}}
  return n;
}
$("bojeAdd").onclick=async()=>{
  const v=$("bojeNew").value.trim();if(!v)return;
  if(BOJE.some(b=>b.toLowerCase()===v.toLowerCase())){$("bojeSt").textContent="Ta boja već postoji.";return}
  await saveBoje([...BOJE,v]);$("bojeNew").value="";
};
$("bojeNew").addEventListener("keydown",e=>{if(e.key==="Enter")$("bojeAdd").click()});
$("bojeList").addEventListener("click",async e=>{
  if(e.target.dataset.bd===undefined)return;
  const i=+e.target.closest("[data-i]").dataset.i,n=BOJE[i];
  if(BOJE.length<2){$("bojeSt").textContent="Mora da ostane bar jedna boja.";return}
  if(!(await ask("Ukloniti boju „"+n+"“ iz ponude? Postojeći dokumenti zadržavaju ovu boju.")))return;
  await saveBoje(BOJE.filter((_,k)=>k!==i),"Boja je uklonjena iz ponude ✓");
});
$("bojeList").addEventListener("change",async e=>{
  if(e.target.dataset.bn===undefined)return;
  const i=+e.target.closest("[data-i]").dataset.i,oldN=BOJE[i],nv=e.target.value.trim();
  if(!nv||nv===oldN){e.target.value=oldN;return}
  if(BOJE.some((b,k)=>k!==i&&b.toLowerCase()===nv.toLowerCase())){$("bojeSt").textContent="Ta boja već postoji.";e.target.value=oldN;return}
  if(!(await ask("Preimenovati „"+oldN+"“ u „"+nv+"“? Naziv će se promeniti i u svim postojećim nalozima, predračunima i otpremnicama.")))
    {e.target.value=oldN;return}
  $("bojeSt").textContent="Menjanje u toku…";
  try{const n=await renameBoja(oldN,nv);const l=BOJE.slice();l[i]=nv;await saveBoje(l,"Preimenovano ✓"+(n?" (izmenjeno dokumenata: "+n+")":""))}
  catch(x){$("bojeSt").textContent="Greška pri preimenovanju: "+(x.message||x.code||"nepoznata")}
});
const bkDays=()=>SET.bkDays==null?7:Math.max(0,Math.round(num(SET.bkDays)));
let setLoaded=false;
function checkBk(){
  try{const el=$("bkBanner");
    const has=orders.length||proformas.length||otpr.length||prices.length||customers.length;
    const n=bkDays();let sn=0;try{sn=+localStorage.getItem("bkSnooze")||0}catch(e){}
    const t=SET.lastBackup?new Date(SET.lastBackup).getTime():0,age=t?(Date.now()-t)/864e5:Infinity;
    if(ROLE!=="vlasnik"||!setLoaded||!n||!has||age<n||sn>Date.now()){el.classList.add("hide");return}
    $("bkBanTx").innerHTML="<b>Podsetnik:</b> "+(t?"poslednja rezervna kopija je stara "+Math.floor(age)+" "+(Math.floor(age)===1?"dan":"dana")+".":"rezervna kopija još nije napravljena.")+" Preporuka je da je napraviš sada.";
    el.classList.remove("hide")}catch(e){}
}
$("bkbDrive").onclick=()=>{goTab("s");$("bkDrive").click()};
$("bkbJson").onclick=()=>{goTab("s");$("bkJson").click()};
$("bkbLater").onclick=()=>{try{localStorage.setItem("bkSnooze",String(Date.now()+864e5))}catch(e){}$("bkBanner").classList.add("hide")};
$("bkDays").onchange=async()=>{const v=Math.max(0,Math.round(num($("bkDays").value)));try{await saveSet({bkDays:v});$("setStatus").textContent="Sačuvano ✓";checkBk()}catch(e){$("setStatus").textContent="Greška pri čuvanju"}};
function bkInfo(){renderBkParts();checkBk();const t=SET.lastBackup;$("bkInfo").textContent=t?"Poslednja kopija: "+fmtDate(String(t).slice(0,10)):"Kopija još nije napravljena."}
$("bkDrive").onclick=async()=>{
  const S=$("bkStatus"),B=$("bkDrive");B.disabled=true;S.textContent="Slanje na Google Drive…";
  try{
    const mcp=await claude.use("mcp");if(!mcp)throw {code:"nomcp"};
    const data={};BK_COLL.forEach(c=>{data[c.n]=c.get()});data.settings=[["main",{...SET}]];
    const txt=JSON.stringify({app:"limarija-wd36",verzija:1,napravljeno:new Date().toISOString(),data}),name="Limarija_WD-36_kopija_"+fdate()+".json";
    let input={title:name,contentMimeType:"application/json",disableConversionToGoogleType:true};
    if(new TextEncoder().encode(txt).length>700000){
      const lt=await mcp.listTools();if(!lt.fileArgs)throw {code:"toobig"};
      input.base64Content={$file:{data:new Blob([txt],{type:"application/json"}),name,type:"application/json"}};
    }else input.textContent=txt;
    const r=await mcp.callTool("Google Drive","create_file",input,{cache:false});
    const f=r&&r.payload&&typeof r.payload==="object"?r.payload:{};const link=f.webViewLink||(f.id?"https://drive.google.com/file/d/"+f.id+"/view":"");
    await saveSet({lastBackup:new Date().toISOString()});bkInfo();
    S.innerHTML="Kopija sačuvana na Google Drive ✓ ("+esc(name)+")"+(/^https:\/\/drive\.google\.com\//.test(link)?' <a href="'+esc(link)+'" target="_blank" rel="noopener" style="color:var(--tx);font-weight:600">Otvori →</a>':"");
  }catch(e){
    const c=e&&e.code,M={nomcp:"Google Drive nije dostupan u ovom prikazu.",toobig:"Kopija je prevelika za slanje iz ovog prikaza – preuzmi je kao fajl.",approval_required:"Slanje na Drive nije odobreno. Klikni ponovo i odobri pristup.",consent_required:"Slanje na Drive nije odobreno. Klikni ponovo i odobri pristup.",not_in_manifest:"Pristup Google Drive-u nije dozvoljen za ovu aplikaciju.",server_not_connected:"Google Drive nije povezan. Poveži ga u claude.ai: Customize → Connectors.",needs_reauth:"Google Drive treba ponovo povezati u claude.ai: Customize → Connectors.",selection_required:"Izaberi koji Google Drive nalog da se koristi.",blocked_by_policy:"Organizacija ne dozvoljava upis na Google Drive.",tool_error:"Google Drive je odbio upis: "+(e&&e.message?String(e.message).slice(0,120):"nepoznata greška"),server_unavailable:"Google Drive trenutno ne odgovara. Pokušaj ponovo za koji minut.",upstream_error:"Slanje nije uspelo. Pokušaj ponovo."};
    S.textContent=M[c]||("Greška: "+((e&&e.message)||c||"nepoznata"));
  }finally{B.disabled=false}
};
const RST={
  all:{t:"Reset aplikacije",d:"Biće trajno obrisani nalozi, predračuni, otpremnice, nabavne cene i zaliha. Cenovnik, kupci i podešavanja ostaju.",c:["orders","proformas","otpremnice","nabavne","zaliha"]},
  orders:{t:"Reset naloga",d:"Biće trajno obrisani svi radni nalozi.",c:["orders"]},
  proformas:{t:"Reset predračuna",d:"Biće trajno obrisani svi predračuni.",c:["proformas"]},
  otpremnice:{t:"Reset otpremnica",d:"Biće trajno obrisane sve otpremnice. Nalozi i predračuni se time otključavaju.",c:["otpremnice"]},
  nabavne:{t:"Reset nabavnih cena",d:"Biće trajno obrisane sve nabavne cene materijala.",c:["nabavne"]},
  zaliha:{t:"Reset zalihe",d:"Biće trajno obrisani svi ulazi materijala u zalihu.",c:["zaliha"]},
  prices:{t:"Reset cenovnika",d:"Biće trajno obrisane sve stavke cenovnika.",c:["prices"]},
  customers:{t:"Reset kupaca",d:"Biće trajno obrisani svi kupci iz imenika.",c:["customers"]},
  settings:{t:"Reset podešavanja",d:"Podešavanja (PDV, zaključavanje, boje, minimumi zalihe, škart, podsetnik) vraćaju se na početne vrednosti.",c:[],settings:true}
};
let rstJob=null;
function openReset(k){if(ROLE!=="vlasnik")return;rstJob=RST[k];$("rTitle").textContent=rstJob.t;$("rDesc").textContent=rstJob.d+" Ovo ne može da se opozove.";$("rIn").value="";$("rMsg").textContent="";$("rGo").disabled=true;$("rov").classList.remove("hide");$("rIn").focus()}
$("btnReset").onclick=()=>openReset("all");
$("resetCats").addEventListener("click",e=>{const k=e.target.dataset.rc;if(k)openReset(k)});
$("rIn").addEventListener("input",()=>{$("rGo").disabled=$("rIn").value.trim().toLowerCase()!=="reset"});
$("rNo").onclick=()=>$("rov").classList.add("hide");
$("rBk").onclick=()=>$("bkJson").onclick();
$("rGo").onclick=async()=>{
  if(ROLE!=="vlasnik"||!rstJob||$("rIn").value.trim().toLowerCase()!=="reset")return;
  $("rGo").disabled=true;$("rMsg").textContent="Brisanje u toku…";
  try{
    for(const n of rstJob.c){const c=BK_COLL.find(z=>z.n===n);for(const [id] of c.get()){await db.collection(n).doc(id).delete()}}
    if(rstJob.settings){SET={pdv:20,lockAfterDelivery:true,lastBackup:SET.lastBackup};await db.doc("settings/main").set(SET);lockOn=true;try{$("setLock").checked=true;$("pdv").value="20"}catch(e){}}
    $("rov").classList.add("hide");$("bkStatus").textContent=rstJob.t+": završeno ✓";
    goTab(rstJob===RST.all?"h":"s");
  }catch(e){$("rMsg").textContent="Greška pri resetu: "+(e.message||e.code||"nepoznata");$("rGo").disabled=false}
};
$("bkJson").onclick=async()=>{
  const S=$("bkStatus");
  try{const data={};BK_COLL.forEach(c=>{data[c.n]=c.get()});data.settings=[["main",{...SET}]];
    await saveFile("Limarija_WD-36_kopija_"+fdate()+".json",JSON.stringify({app:"limarija-wd36",verzija:1,napravljeno:new Date().toISOString(),data}));
    await saveSet({lastBackup:new Date().toISOString()});bkInfo();S.textContent="Kopija sačuvana ✓"}
  catch(e){S.textContent=(e&&e.code==="declined")?"":"Greška: "+(e.message||e.code||"nepoznata")}
};
$("bkCsv").onclick=async()=>{
  const S=$("bkStatus"),q=v=>'"'+String(v??"").replace(/"/g,'""')+'"',rows=[["Vrsta","Broj","Datum","Kupac","PIB","Telefon","Iznos (RSD)","Plaćeno (RSD)","Količina (m²)","Status / izvor"]];
  orders.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(o=>rows.push(["Radni nalog",o.no+"/"+o.year,o.date,o.customer,o.pib||"",o.phone||"","","",o.totalM2,({u_radu:"U radu",zavrsen:"Završen",isporucen:"Isporučen"})[o.status]||o.status]));
  proformas.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(p=>rows.push(["Predračun",p.no+"/"+p.year,p.date,p.customer,p.pib||"",p.phone||"",p.ukupno,p.placeno,"",p.orderNo?"Nalog "+p.orderNo:""]));
  otpr.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(o=>rows.push(["Otpremnica",o.no+"/"+o.year,o.date,o.customer,o.pib||"",o.phone||"","","","",o.izvor||""]));
  try{await saveFile("Limarija_WD-36_pregled_"+fdate()+".csv","\ufeff"+rows.map(r=>r.map(x=>q(typeof x==="number"?String(x).replace(".",","):x)).join(";")).join("\n"));S.textContent="CSV sačuvan ✓"}
  catch(e){S.textContent=(e&&e.code==="declined")?"":"Greška: "+(e.message||e.code||"nepoznata")}
};

const BK_PARTS=[["orders","Radni nalozi"],["proformas","Predračuni"],["otpremnice","Otpremnice"],["prices","Cenovnik (sa grupama)"],["nabavne","Nabavne cene"],["customers","Kupci"],["zaliha","Zaliha"],["settings","Podešavanja (boje, mašine, PDV…)"]];
function renderBkParts(){
  const box=$("bkParts");if(!box)return;
  box.innerHTML=BK_PARTS.map(([k,t])=>{const c=BK_COLL.find(z=>z.n===k);return `<button data-part="${k}">${t}${c?" ("+c.get().length+")":""}</button>`}).join("");
}
$("bkParts").addEventListener("click",async e=>{
  const k=e.target.dataset.part;if(!k)return;const S=$("bkStatus"),data={},c=BK_COLL.find(z=>z.n===k);
  if(c)data[k]=c.get();
  if(k==="prices")data.settings=[["main",{gNames:SET.gNames||{},gCustom:Array.isArray(SET.gCustom)?SET.gCustom:[],gKind:SET.gKind||{},gOrder:Array.isArray(SET.gOrder)?SET.gOrder:[]}]];
  if(k==="settings"){const {lastBackup,...rest}=SET;data.settings=[["main",rest]]}
  const nm={orders:"nalozi",proformas:"predracuni",otpremnice:"otpremnice",prices:"cenovnik",nabavne:"nabavne",customers:"kupci",zaliha:"zaliha",settings:"podesavanja"}[k];
  try{await saveFile("Limarija_WD-36_"+nm+"_"+fdate()+".json",JSON.stringify({app:"limarija-wd36",verzija:1,napravljeno:new Date().toISOString(),delimicno:[k],data}));S.textContent="Fajl „"+nm+"“ sačuvan ✓"}
  catch(x){S.textContent=(x&&x.code==="declined")?"":"Greška: "+(x.message||x.code||"nepoznata")}
});
$("bkRestore").onclick=()=>$("bkFile").click();
$("bkFile").onchange=async()=>{
  const S=$("bkStatus"),f=$("bkFile").files[0];$("bkFile").value="";if(!f)return;
  try{
    const j=JSON.parse(await f.text());if(j.app!=="limarija-wd36"||!j.data)throw new Error("Ovo nije fajl rezervne kopije aplikacije.");
    const names=Object.keys(j.data).filter(n=>n!=="settings"),cnt=names.reduce((t,n)=>t+(j.data[n]||[]).length,0);
    const part=Array.isArray(j.delimicno)?j.delimicno:null,replacePrices=!!(part&&part.length===1&&part[0]==="prices");
    const msg=part?("Uvoz dela podataka ("+part.map(k=>(BK_PARTS.find(z=>z[0]===k)||[k,k])[1]).join(", ")+"): "+cnt+" dokumenata. "+(replacePrices?"Postojeći cenovnik biće ZAMENJEN cenovnikom iz fajla (stare cene se brišu). ":"Dokumenti sa istim brojem biće prepisani. ")+"Sve što nije u fajlu ostaje netaknuto."):("Vratiti "+cnt+" dokumenata iz kopije od "+fmtDate(String(j.napravljeno||"").slice(0,10))+"? Dokumenti sa istim brojem biće prepisani. Ostali ostaju nepromenjeni.");
    if(!(await ask(msg)))return;
    let n=0;for(const c of names)for(const [id,d] of j.data[c]){await db.collection(c).doc(id).set(d);n++;S.textContent="Vraćam… "+n+"/"+cnt}
    if(replacePrices){const keep=new Set((j.data.prices||[]).map(x=>x[0]));for(const pr of prices.slice()){if(!keep.has(pr.id))await db.collection("prices").doc(pr.id).delete()}}
    if(j.data.settings&&j.data.settings[0]){const si={...j.data.settings[0][1]};if(part)delete si.lastBackup;if(si.gNames||si.gCustom){si.gNames={...(SET.gNames||{}),...(si.gNames||{})};si.gKind={...(SET.gKind||{}),...(si.gKind||{})};if(Array.isArray(si.gOrder))si.gOrder=[...si.gOrder,...(Array.isArray(SET.gOrder)?SET.gOrder:[]).filter(k=>!si.gOrder.includes(k))];si.gCustom=[...new Set([...(Array.isArray(SET.gCustom)?SET.gCustom:[]),...(Array.isArray(si.gCustom)?si.gCustom:[])])]}await saveSet(si);applyGrupe()}
    S.textContent=n?("Vraćeno "+n+" dokumenata ✓"):"Podešavanja vraćena ✓";renderBkParts()}
  catch(e){S.textContent="Greška: "+(e.message||e.code||"nepoznata")}
};
$("btnCenPrint").onclick=()=>printSheet(priceSheet,$("cstatus"));
$("btnCenPdf").onclick=()=>{priceSheet();pdfOf("Cenovnik_"+new Date().toISOString().slice(0,10)+".pdf",$("cstatus"))};
$("pdv").onchange=async()=>{const v=parseFloat(String($("pdv").value).replace(",","."));try{await saveSet({pdv:isNaN(v)?20:v});$("setStatus").textContent="Sačuvano ✓"}catch(e){$("setStatus").textContent="Greška pri čuvanju"}};

