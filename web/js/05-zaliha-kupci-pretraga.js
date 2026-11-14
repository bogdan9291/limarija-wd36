/* ---------- kopiranje ---------- */
function copyOrder(src){
  const n=newOrder(),c=JSON.parse(JSON.stringify(src));
  if(c.items&&!c.segments)c.segments=[{tip:"trapez",items:c.items}];
  c.segments=(c.segments||[]).map(g=>({tip:g.tip||"trapez",items:g.items.map(i=>({vrsta:i.vrsta,tip:g.tip||"trapez",duzina:i.duzina||"",um:i.um,sirina:i.sirina||"",boja:i.boja||"",kom:i.kom,jm:i.jm}))}));
  const d={id:null,no:n.no,year:n.year,customer:c.customer,addr:c.addr||"",phone:c.phone||"",pib:c.pib||"",date:n.date,status:"u_radu",note:c.note||"",segments:c.segments.length?c.segments:n.segments};
  $("view").appendChild($("sheetbox"));openForm(d,true);show("o");dirty=true;$("status").textContent="Kopija naloga "+(src.no?src.no+"/"+src.year:"")+" – proveri podatke i sačuvaj.";
}
function copyPro(src){
  const y=new Date().getFullYear(),c=JSON.parse(JSON.stringify(src));
  const d={_new:true,no:nextPro(y),year:y,orderId:"",orderNo:"",customer:c.customer,addr:c.addr||"",phone:c.phone||"",pib:c.pib||"",kupac:c.kupac||kupacOf(c),date:new Date().toISOString().slice(0,10),note:c.note||"",uplate:[],pdv:c.pdv,lines:c.lines.map(l=>({vrsta:l.vrsta,boja:l.boja,duzina:l.duzina,kom:l.kom,m2:l.m2,jm:l.jm||"m²",cena:l.cena}))};
  {const so=orders.find(x=>oid(x)===c.orderId),sg=(c.segments&&c.segments.length)?c.segments:(so&&so.segments)||null;if(sg){d.segments=editSegs(sg).map(g=>({...g,items:g.items.map(i=>({...i,m2:Math.round(rowM2(i)*100)/100,jm:rowUnit(i)}))}));d.samostalan=true}}
  openPro(d);pdirty=true;$("pstatus").textContent="Kopija predračuna "+(src.no?src.no+"/"+src.year:"")+" – nije povezana sa radnim nalogom. Proveri i sačuvaj.";
}
$("btnCopy").onclick=()=>{syncHead();copyOrder(cur)};
$("pCopy").onclick=()=>copyPro(pcur);
/* ---------- zaliha ---------- */
let zaliha=[];
function stockOf(tip){
  const e=zaliha.filter(z=>z.tip===tip&&z.datum);if(!e.length)return null;
  const start=e.map(z=>z.datum).sort()[0],ulaz=r2(e.reduce((t,z)=>t+num(z.kolicina),0));let use=0;
  orders.forEach(o=>{if(String(o.date||"")<start)return;
    (o.items||[]).forEach(i=>{if(kindOf(i.tip||"trapez")!=="trapez"||(i.jm||"m²")!=="m²")return;const m=num(i.m2);if(tip==="lim")use+=m;else if(/filc/i.test(i.vrsta))use+=m*filcK(i.vrsta)});
    });
  use=r2(use*(1+(tip==="lim"?skPct():skPctF())/100));return{start,ulaz,use,left:r2(ulaz-use)};
}
function renderStock(){
  if(document.activeElement!==$("skPct"))$("skPct").value=String(skPct()).replace(".",",");
  if(document.activeElement!==$("skPctF"))$("skPctF").value=String(skPctF()).replace(".",",");
  const min={lim:num(SET.minLim),filc:num(SET.minFilc)},T={lim:"Lim",filc:"Filc"};
  $("zKpi").innerHTML=["lim","filc"].map(t=>{const st=stockOf(t);if(!st)return `<div class="kpi"><span>${T[t]} – na zalihi</span><b>–</b><small>Nema unosa</small></div>`;
    const low=min[t]>0&&st.left<min[t];return `<div class="kpi"><span>${T[t]} – na zalihi</span><b${low||st.left<0?' style="color:#c0392b"':""}>${fmt(st.left)} m²</b><small>Uneto ${fmt(st.ulaz)} · utrošeno ${fmt(st.use)}${low?" · ISPOD MINIMUMA":""}</small></div>`}).join("");
  if(document.activeElement!==$("zMinL"))$("zMinL").value=SET.minLim??"";if(document.activeElement!==$("zMinF"))$("zMinF").value=SET.minFilc??"";
  const a=document.activeElement;if(a&&$("ztb").contains(a)&&a.tagName!=="BUTTON")return;
  $("ztb").innerHTML=zaliha.slice().sort((x,y)=>String(y.datum).localeCompare(String(x.datum))).map(z=>`<tr data-id="${esc(z.id)}"><td><input type="date" data-k="datum" value="${esc(z.datum)}"></td><td><select data-k="tip"><option value="lim"${z.tip==="lim"?" selected":""}>Lim</option><option value="filc"${z.tip==="filc"?" selected":""}>Filc</option></select></td><td class="n"><input data-k="kolicina" inputmode="decimal" value="${esc(z.kolicina)}" style="width:120px"></td><td><input data-k="nap" value="${esc(z.nap||"")}" placeholder="npr. popis, isporuka…"></td><td><button class="d" data-x title="Obriši">✕</button></td></tr>`).join("");
  $("zempty").textContent=zaliha.length?"":"Nema unosa. Dodaj početno stanje ili prvu isporuku materijala.";
}
$("btnZal").onclick=async()=>{try{await db.collection("zaliha").doc().set({datum:today(),tip:"lim",kolicina:0,nap:""})}catch(e){$("zstatus").textContent="Greška pri čuvanju"}};
$("ztb").addEventListener("change",async e=>{
  const tr=e.target.closest("tr"),k=e.target.dataset.k;if(!tr||!k)return;const z=zaliha.find(x=>x.id===tr.dataset.id);if(!z)return;
  z[k]=k==="kolicina"?num(e.target.value):e.target.value;
  try{await db.collection("zaliha").doc(z.id).set({datum:z.datum,tip:z.tip,kolicina:z.kolicina,nap:z.nap||""});$("zstatus").textContent="Sačuvano ✓"}catch(x){$("zstatus").textContent="Greška pri čuvanju"}
});
$("ztb").addEventListener("click",async e=>{
  if(e.target.dataset.x===undefined)return;if(!(await ask("Obrisati ovaj ulaz materijala?")))return;
  try{await db.collection("zaliha").doc(e.target.closest("tr").dataset.id).delete()}catch(x){$("zstatus").textContent="Brisanje nije uspelo"}
});
$("skPctF").onchange=async()=>{try{await saveSet({skartPctF:Math.max(0,num($("skPctF").value))});$("skStatus").textContent="Sačuvano ✓";renderProd()}catch(e){$("skStatus").textContent="Greška pri čuvanju"}};
$("skPct").onchange=async()=>{try{await saveSet({skartPct:Math.max(0,num($("skPct").value))});$("skStatus").textContent="Sačuvano ✓";renderProd()}catch(e){$("skStatus").textContent="Greška pri čuvanju"}};
[["zMinL","minLim"],["zMinF","minFilc"]].forEach(([id,k])=>$(id).onchange=async()=>{try{await saveSet({[k]:num($(id).value)});$("zstatus").textContent="Sačuvano ✓"}catch(e){$("zstatus").textContent="Greška pri čuvanju"}});
/* ---------- uloge ---------- */
let ROLE="vlasnik";
const ROLE_TXT={radnik:"Radnik – bez cena i finansija",pregled:"Samo pregled"};
async function initRole(){
  try{
    const u=await claude.use("user");if(!u)return;
    if((await u.isOwner())||(await u.canEdit()))return;
    const cw=await u.can("data.write");ROLE=cw===false?"pregled":(cw===true?"radnik":"vlasnik");
    if(ROLE==="vlasnik")return;
    document.body.classList.add("role-"+ROLE);
    (ROLE==="radnik"?["tabP","tabR","tabK","tabC","tabS"]:["tabS"]).forEach(id=>$(id).classList.add("hide"));
    const b=document.createElement("div");b.className="role-badge";b.innerHTML="Prijavljen kao:<br><b>"+ROLE_TXT[ROLE]+"</b>";document.querySelector(".side").insertBefore(b,document.querySelector(".side nav").nextSibling);
    show(curView||"h");
  }catch(e){}
}
const ROLE_DENY={radnik:["pl","pv","r","k","c","s"],pregled:["s"]};
/* ---------- kupci ---------- */
let customers=[],kcur=null;
const nrm=v=>String(v||"").trim().toLowerCase();
/* pretraga bez obzira na č/ć/š/ž/đ: „cacak“ nalazi „Čačak“, „djordje“ nalazi „Đorđe“ */
const fold=v=>String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/dj/g,"d");
// Baza u Artifact-u dozvoljava u ID-ju samo slova, cifre i _ - . ~ : @ + (bez š, đ, č, ć, ž…): ostali znaci se zamenjuju, a dodaje se kratak kod da dva imena ne dobiju isti ID
const safeDocId=s=>{s=String(s);if(/^[A-Za-z0-9_.~:@+-]+$/.test(s))return s;
  const t=s.replace(/đ/g,"dj").replace(/Đ/g,"Dj").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_.~:@+-]+/g,"_");
  let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;return t.slice(0,70)+"_"+h.toString(36)};
const custId=n=>safeDocId(nrm(n).replace(/[\/\\#?%\s]+/g,"_").slice(0,80));
const custBy=n=>customers.find(c=>nrm(c.name)===nrm(n));
function fillCustList(){$("custl").innerHTML=customers.map(c=>`<option value="${esc(c.name)}">`).join("")}
async function custSync(d){
  try{const name=String(d.customer||"").trim();if(!name||!db)return;const c=custBy(name);
    if(!c){await db.collection("customers").doc(custId(name)).set({name,addr:d.addr||"",phone:d.phone||"",pib:d.pib||"",email:""})}
    else{const up={};["addr","phone","pib"].forEach(k=>{if(!c[k]&&d[k])up[k]=d[k]});if(Object.keys(up).length){const {id:_i,...rest}=c;await db.collection("customers").doc(c.id).set({...rest,...up})}}}
  catch(e){}
}
[["fCust","f"],["pCust","p"],["oCust","o"]].forEach(([id,pre])=>$(id).addEventListener("change",()=>{
  const c=custBy($(id).value);if(!c)return;
  [["Addr","addr"],["Phone","phone"],["Pib","pib"]].forEach(([f,k])=>{const el=$(pre+f);if(el&&!el.value&&c[k]){el.value=c[k];el.dispatchEvent(new Event("input",{bubbles:true}))}});
}));
const custDocs=name=>({o:orders.filter(x=>nrm(x.customer)===nrm(name)),p:proformas.filter(x=>nrm(x.customer)===nrm(name)),t:otpr.filter(x=>nrm(x.customer)===nrm(name))});
const proRest=q=>q.ostalo!=null?num(q.ostalo):r2(num(q.ukupno)-num(q.placeno));
function showKupci(){$("kList").classList.remove("hide");$("kDet").classList.add("hide");kcur=null;renderKupci()}
function renderKupci(){
  const q=fold($("kSearch").value);
  const rows=customers.filter(c=>!q||[c.name,c.phone,c.pib,c.addr].some(v=>fold(v).includes(q))).sort((a,b)=>String(a.name).localeCompare(String(b.name),"sr-Latn"));
  $("ktb").innerHTML=rows.map(c=>{const d=custDocs(c.name),debt=r2(d.p.reduce((t,x)=>t+Math.max(0,proRest(x)),0));return `<tr class="cl" data-kid="${esc(c.id)}"><td>${esc(c.name)}${c.cene&&Object.keys(c.cene).length?' <span class="tag zavrsen" title="Kupac ima poseban cenovnik">poseban cenovnik</span>':c.cenaOd?' <span class="tag zavrsen" title="Koristi cenovnik drugog kupca">cenovnik: '+esc((customers.find(x=>x.id===c.cenaOd)||{name:"?"}).name)+"</span>":""}</td><td>${esc(c.phone||"")}</td><td>${esc(c.pib||"")}</td><td class="n">${d.o.length}</td><td class="n"${debt>0?' style="color:#c0392b;font-weight:600"':""}>${debt>0?money(debt):"–"}</td></tr>`}).join("");
  $("kEmpty").textContent=rows.length?"":(customers.length?"Nema rezultata.":"Još nema kupaca. Dodaju se sami kad sačuvaš dokument ili klikom na „+ Novi kupac“.");
}
function openKupac(c){
  kcur=c?{...c}:{id:"",name:"",addr:"",phone:"",pib:"",email:"",_new:true};
  $("kName").value=kcur.name;$("kAddr").value=kcur.addr||"";$("kPhone").value=kcur.phone||"";$("kPib").value=kcur.pib||"";$("kMail").value=kcur.email||"";
  $("kDel").classList.toggle("hide",!!kcur._new);$("kStatus").textContent="";
  $("kList").classList.add("hide");$("kDet").classList.remove("hide");renderKHist();kpDirty=false;renderKPrc();window.scrollTo(0,0);
}
function renderKHist(){
  if(kcur._new){$("kHist").innerHTML='<div class="msg">Istorija će se pojaviti nakon prvog dokumenta.</div>';return}
  const d=custDocs(kcur.name),m2=r2(d.o.reduce((t,x)=>t+num(x.totalM2),0)),fak=r2(d.p.reduce((t,x)=>t+num(x.ukupno),0)),debt=r2(d.p.reduce((t,x)=>t+Math.max(0,proRest(x)),0));
  const tb=(arr,fn)=>arr.length?`<div class="sc"><table><tbody>${arr.map(fn).join("")}</tbody></table></div>`:'<div class="more">Nema.</div>';
  $("kHist").innerHTML=`<div class="grid"><div class="kpi"><span>Radnih naloga</span><b>${d.o.length}</b></div><div class="kpi"><span>Ukupno proizvedeno</span><b>${fmt(m2)} m²</b></div><div class="kpi"><span>Fakturisano (sa PDV)</span><b>${money(fak)}</b></div><div class="kpi"><span>Dug</span><b${debt>0?' style="color:#c0392b"':""}>${money(debt)}</b></div></div>
  <div class="hs">Radni nalozi</div>${tb(d.o.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))),o=>`<tr class="cl" data-ko="${esc(oid(o))}"><td>${o.no}/${o.year}</td><td>${fmtDate(o.date)}</td><td class="n">${fmt(o.totalM2)} m²</td><td>${({u_radu:"U radu",zavrsen:"Završen",isporucen:"Isporučen"})[o.status]||""}</td></tr>`)}
  <div class="hs">Predračuni</div>${tb(d.p.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))),q=>`<tr class="cl" data-kp="${q.year}_${q.no}"><td>${q.no}/${q.year}</td><td>${fmtDate(q.date)}</td><td class="n">${money(q.ukupno)}</td><td class="n">${proRest(q)>0.005?"Ostalo "+money(proRest(q)):"Plaćeno"}</td></tr>`)}
  <div class="hs">Otpremnice</div>${tb(d.t.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))),t=>`<tr class="cl" data-kt="${t.year}_${t.no}"><td>${t.no}/${t.year}</td><td>${fmtDate(t.date)}</td><td>${esc(t.izvor||"")}</td></tr>`)}`;
}
$("kSearch").addEventListener("input",renderKupci);
$("ktb").addEventListener("click",e=>{const tr=e.target.closest("tr[data-kid]");if(!tr)return;const c=customers.find(x=>x.id===tr.dataset.kid);if(c)openKupac(c)});
$("kNew").onclick=()=>openKupac(null);
$("kBack").onclick=showKupci;
$("kHist").addEventListener("click",e=>{
  const tr=e.target.closest("tr[data-ko],tr[data-kp],tr[data-kt]");if(!tr)return;$("view").appendChild($("sheetbox"));
  if(tr.dataset.ko)openOrderById(tr.dataset.ko);
  else if(tr.dataset.kp){const q=proformas.find(x=>x.year+"_"+x.no===tr.dataset.kp);if(q)openPro(q)}
  else{const t=otpr.find(x=>x.year+"_"+x.no===tr.dataset.kt);if(t)openOtp(t)}
});
$("kSave").onclick=async()=>{
  const S=$("kStatus"),name=$("kName").value.trim();if(!name){S.textContent="Unesi ime kupca.";return}
  const d={name,addr:$("kAddr").value.trim(),phone:$("kPhone").value.trim(),pib:$("kPib").value.trim(),email:$("kMail").value.trim(),...(kcur.cene&&Object.keys(kcur.cene).length?{cene:kcur.cene}:kcur.cenaOd?{cenaOd:kcur.cenaOd}:{})},id=kcur._new?custId(name):kcur.id;
  if(kcur._new&&customers.some(c=>c.id===id)){S.textContent="Kupac sa tim imenom već postoji.";return}
  try{
    if(!kcur._new&&nrm(kcur.name)!==nrm(name)&&custDocs(kcur.name).o.length+custDocs(kcur.name).p.length+custDocs(kcur.name).t.length){
      if(!(await ask("Postojeći dokumenti kupca zadržavaju staro ime ("+kcur.name+"). Nastaviti?")))return}
    await db.collection("customers").doc(id).set(d);kcur={...d,id};S.textContent="Sačuvano ✓";$("kDel").classList.remove("hide");renderKHist();kpDirty=false;renderKPrc()}
  catch(e){S.textContent="Greška pri čuvanju: "+(e.message||e.code||"nepoznata")}
};
$("kDel").onclick=async()=>{
  if(!(await ask("Obrisati kupca "+kcur.name+" iz adresara? Dokumenti ostaju."))) return;
  try{await db.collection("customers").doc(kcur.id).delete();showKupci()}catch(e){$("kStatus").textContent="Brisanje nije uspelo."}
};
/* ---------- pretraga ---------- */
$("gs").addEventListener("input",()=>{
  const toks=fold($("gs").value).split(/\s+/).filter(Boolean),box=$("gsr");
  if(!toks.length){box.classList.add("hide");box.innerHTML="";return}
  const hit=o=>{const h=fold([o.customer,o.no+"/"+o.year,o.pib,o.phone,o.addr,o.note,o.izvor].join(" "));return toks.every(t=>h.includes(t))};
  const R=[];
  orders.filter(hit).forEach(o=>R.push({k:"Nalog",id:'data-so="'+esc(oid(o))+'"',n:o.no+"/"+o.year,c:o.customer,d:o.date}));
  proformas.filter(hit).forEach(o=>R.push({k:"Predračun",id:'data-sp="'+o.year+"_"+o.no+'"',n:o.no+"/"+o.year,c:o.customer,d:o.date}));
  otpr.filter(hit).forEach(o=>R.push({k:"Otpremnica",id:'data-st="'+o.year+"_"+o.no+'"',n:o.no+"/"+o.year,c:o.customer,d:o.date}));
  customers.filter(c=>toks.every(t=>fold([c.name,c.phone,c.pib,c.addr].join(" ")).includes(t))).forEach(c=>R.push({k:"Kupac",id:'data-sk="'+esc(c.id)+'"',n:"",c:c.name,d:""}));
  R.sort((a,b)=>String(b.d).localeCompare(String(a.d)));
  box.classList.remove("hide");
  box.innerHTML=R.length?`<table><tbody>${R.slice(0,15).map(r=>`<tr class="cl" ${r.id}><td><span class="tag">${r.k}</span></td><td>${r.n}</td><td>${esc(r.c)}</td><td>${r.d?fmtDate(r.d):""}</td></tr>`).join("")}${R.length>15?`<tr><td colspan="4" class="more">… i još ${R.length-15}, suzi pretragu</td></tr>`:""}</tbody></table>`:'<div class="msg">Nema rezultata.</div>';
});
$("gsr").addEventListener("click",e=>{
  const tr=e.target.closest("tr[data-so],tr[data-sp],tr[data-st],tr[data-sk]");if(!tr)return;$("view").appendChild($("sheetbox"));
  if(tr.dataset.so)openOrderById(tr.dataset.so);
  else if(tr.dataset.sp){const q=proformas.find(x=>x.year+"_"+x.no===tr.dataset.sp);if(q)openPro(q)}
  else if(tr.dataset.st){const t=otpr.find(x=>x.year+"_"+x.no===tr.dataset.st);if(t)openOtp(t)}
  else{goTab("k").then(()=>{const c=customers.find(x=>x.id===tr.dataset.sk);if(c)openKupac(c)})}
});
