/* ---------- početna ---------- */
$("hbody").addEventListener("change",e=>{const id=e.target.id;if(id!=="hMo"&&id!=="hYr")return;if(id==="hYr")homeY=+e.target.value;else{homeM=+e.target.value;homePer=homeM<0?"g":"m";try{localStorage.setItem("homePer",homePer)}catch(x){}}renderHome()});
const homeUp=()=>{if(!$("home").classList.contains("hide"))renderHome()};
function openOrderById(id){const o=orders.find(x=>oid(x)===id);if(!o)return;$("view").appendChild($("sheetbox"));openForm(o,false);show("o")}
const ageTag=(d,t0)=>{const n=Math.max(0,Math.floor((t0-new Date(d))/864e5));return `<span class="age" style="font-size:12px;font-weight:600;color:${n>60?"#c0392b":n>30?"var(--wa)":"var(--mu)"}">· ${n} ${n===1?"dan":"dana"}</span>`};
let homePer="m";try{homePer=localStorage.getItem("homePer")==="g"?"g":"m"}catch(e){}
let homeY=new Date().getFullYear(),homeM=homePer==="g"?-1:new Date().getMonth();
function renderHome(){
  const t0=new Date(),ym=t0.getFullYear()+"-"+String(t0.getMonth()+1).padStart(2,"0");
  const pd=new Date(t0.getFullYear(),t0.getMonth()-1,1),pym=pd.getFullYear()+"-"+String(pd.getMonth()+1).padStart(2,"0");
  $("hdate").textContent=t0.toLocaleDateString("sr-Latn-RS",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const hasOtp=new Set(),hasPro=new Set();
  otpr.forEach(x=>otpOrderIds(x).forEach(i=>hasOtp.add(i)));
  proformas.forEach(x=>{if(x.orderId)hasPro.add(x.orderId)});
  const inWork=orders.filter(o=>o.status==="u_radu"&&!hasOtp.has(oid(o))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const waitOtp=orders.filter(o=>o.status!=="isporucen"&&orderDeliv(o,null).some(g=>g.prod==="zavrsen"&&g.lines.length)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const noPro=orders.filter(o=>!hasPro.has(oid(o))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const rest=q=>q.ostalo!=null?num(q.ostalo):r2(num(q.ukupno)-num(q.placeno));
  const unpaid=proformas.filter(q=>rest(q)>0.005).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const debt=r2(unpaid.reduce((t,q)=>t+rest(q),0));
  const oRows=(arr,max)=>arr.slice(0,max).map(o=>`<tr class="cl" data-oid="${esc(oid(o))}"><td>${o.no}/${o.year}</td><td>${esc(o.customer)}</td><td>${fmtDate(o.date)}</td><td class="n">${fmt(o.totalM2)} m²</td></tr>`).join("")+(arr.length>max?`<tr><td colspan="4" class="more">… i još ${arr.length-max}</td></tr>`:"");
  const oTableX=0;
  const oTable=(arr,max)=>arr.length?`<div class="sc"><table><tbody>${oRows(arr,max)}</tbody></table></div>`:"";
  if(ROLE==="radnik"){
    $("hbody").innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><b>Nalozi u radu (${inWork.length})</b><span style="color:var(--mu);font-size:13px">${fmt(inWork.reduce((t,o)=>t+num(o.totalM2),0))} m²</span></div>${inWork.length?oTable(inWork,15):'<div class="msg">Nema naloga u radu.</div>'}</div><div class="card"><b>Završeni nalozi, čekaju isporuku (${waitOtp.length})</b>${waitOtp.length?oTable(waitOtp,10):'<div class="more">Nema.</div>'}</div>`;
    return;
  }
  // proizvodnja
  const Y=homeY,G=homeM<0,M=G?0:homeM,yr=String(Y),pyr=String(Y-1),sm=Y+"-"+String(M+1).padStart(2,"0");
  const spd=new Date(Y,M-1,1),spm=spd.getFullYear()+"-"+String(spd.getMonth()+1).padStart(2,"0");
  const data=prodData(false),yRows=y=>mergeRows(Object.keys(data).filter(k=>k.startsWith(y+"-")).map(k=>calcMonth(k,data[k])));
  const ys=new Set([Y,t0.getFullYear()]);Object.keys(data).forEach(k=>{const y=+k.slice(0,4);if(y>2000)ys.add(y)});orders.forEach(o=>{const y=+String(o.date||"").slice(0,4);if(y>2000)ys.add(y)});
  const yOpts=[...ys].sort((a,b)=>b-a).map(y=>`<option value="${y}"${y===Y?" selected":""}>${y}.</option>`).join("");
  const mOpts=`<option value="-1"${G?" selected":""}>Cela godina</option>`+MES.map((n,i)=>`<option value="${i}"${!G&&i===M?" selected":""}>${n}</option>`).join("");
  const cm=G?yRows(yr):calcMonth(sm,data[sm]||{}),pm=G?yRows(pyr):calcMonth(spm,data[spm]||{});
  const sum=(rows,k)=>rows.reduce((t,r)=>t+r[k],0),m2c=sum(cm,"m2"),m2p=sum(pm,"m2");
  const nOrd=orders.filter(o=>String(o.date||"").startsWith(G?yr+"-":sm)).length;
  const delta=m2p>0?Math.round((m2c-m2p)/m2p*100):null;
  const bruto=r2(sum(cm,"bruto")),red=bruto<0?' style="color:#c0392b"':"";
  const dTxt=delta==null?"":`<small style="color:${delta>=0?"var(--ok)":"#c0392b"}">${delta>=0?"+":""}${delta}% u odnosu na ${G?pyr+".":MES[spd.getMonth()].toLowerCase()}</small>`;
  const months=[];for(let i=G?0:5;G?i<12:i>=0;G?i++:i--){const d=G?new Date(Y,i,1):new Date(Y,M-i,1),k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");months.push({k,lbl:MES[d.getMonth()].slice(0,3),v:sum(calcMonth(k,data[k]||{}),"m2")})}
  const mx=Math.max(1,...months.map(m=>m.v));
  const bars=months.map(m=>`<div><span>${m.v?(G?Math.round(m.v).toLocaleString("sr-RS"):fmt(m.v).replace(",00","")):""}</span><i style="height:${Math.round(m.v/mx*70)}px"></i>${m.lbl}</div>`).join("");
  const prow=cm.length?`<div class="sc" style="margin-top:12px"><table><thead><tr><th>Profil</th><th class="n">Kom.</th><th class="n">m²</th></tr></thead><tbody>${cm.map(r=>`<tr><td>${esc(r.vrsta)}</td><td class="n">${fmt(r.kom).replace(",00","")}</td><td class="n">${fmt(r.m2)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="msg">${G?"Ove godine":"Ovog meseca"} još nema naloga sa trapeznim limom.</div>`;
  // upozorenja
  const W=[];
  const miss=new Set();orders.filter(o=>{const k=String(o.date||"").slice(0,7);return k===ym||k===pym}).forEach(o=>(o.items||[]).forEach(i=>{if(priceFor(i.vrsta)==null)miss.add(i.vrsta)}));
  if(miss.size)W.push(`Nema cene u cenovniku za: ${[...miss].map(esc).join(", ")}.`);
  if(!nabFor(ym))W.push("Nema nabavne cene lima i filca za tekući mesec – bruto zarada nije tačna (tab Proizvodnja).");
  {const lb=SET.lastBackup?(t0-new Date(SET.lastBackup))/864e5:null;if(lb==null||lb>7)W.push(lb==null?"Još nije napravljena rezervna kopija podataka (tab Podešavanja).":"Rezervna kopija je stara "+Math.floor(lb)+" dana (tab Podešavanja).")}
  ["lim","filc"].forEach(t=>{const st=stockOf(t),mn=num(t==="lim"?SET.minLim:SET.minFilc);if(st&&mn>0&&st.left<mn)W.push(`Zaliha ${t==="lim"?"lima":"filca"} je ispod minimuma (${fmt(st.left)} m²) – vreme je za porudžbinu.`)});
  const old=inWork.filter(o=>(t0-new Date(o.date))/864e5>14).length;
  if(old)W.push(`${old} ${old===1?"nalog je":"naloga je"} u radu duže od 14 dana.`);
  const warn=W.length?`<div class="card"><div class="hs">Upozorenja</div>${W.map(w=>`<div class="wr">⚠ ${w}</div>`).join("")}</div>`:"";
  $("hbody").innerHTML=`
  <div class="card">
   <div class="row" style="justify-content:space-between;margin-bottom:10px"><b>Proizvodnja – ${G?yr+". godina":MES[M]+" "+Y}</b><div class="row"><select id="hMo" aria-label="Mesec" style="width:auto;flex:none">${mOpts}</select><select id="hYr" aria-label="Godina" style="width:auto;flex:none">${yOpts}</select><button data-go="r">Detalji →</button></div></div>
   <div class="grid"><div class="kpi"><span>Proizvedeno</span><b>${fmt(m2c)} m²</b>${dTxt}</div><div class="kpi"><span>Radnih naloga</span><b>${nOrd}</b></div></div>
   ${prow}
   <div class="hs" style="margin-top:16px">Proizvedeno po mesecima (m²)</div><div class="bars${G?" y12":""}">${bars}</div>
  </div>
  <div class="card">
   <div class="row" style="justify-content:space-between;margin-bottom:6px"><b>Nalozi u radu (${inWork.length})</b><span style="color:var(--mu);font-size:13px">${fmt(inWork.reduce((t,o)=>t+num(o.totalM2),0))} m²</span></div>
   ${inWork.length?oTable(inWork,10):'<div class="msg">Nema naloga u radu.</div>'}
  </div>
  <div class="card">
   <b>Isporuka i naplata</b>
   <div class="hs">Završeni nalozi, čekaju otpremnicu (${waitOtp.length})</div>${waitOtp.length?oTable(waitOtp,6):'<div class="more">Nema.</div>'}
   <div class="hs">Neplaćeni predračuni (${unpaid.length}) – ukupno za naplatu: ${money(debt)} RSD</div>
   ${unpaid.length?`<div class="sc"><table><tbody>${unpaid.slice(0,8).map(q=>`<tr class="cl" data-pid="${q.year}_${q.no}"><td>${q.no}/${q.year}</td><td>${esc(q.customer)}</td><td>${fmtDate(q.date)} ${ageTag(q.date,t0)}</td><td class="n">${money(rest(q))} RSD</td></tr>`).join("")}${unpaid.length>8?`<tr><td colspan="4" class="more">… i još ${unpaid.length-8}</td></tr>`:""}</tbody></table></div>`:'<div class="more">Nema.</div>'}
   <div class="hs">Nalozi bez predračuna (${noPro.length})</div>${noPro.length?oTable(noPro,5):'<div class="more">Nema.</div>'}
  </div>
  ${warn}`;
}
$("home").addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g){goTab(g.dataset.go);return}
  const tr=e.target.closest("tr[data-oid],tr[data-pid]");if(!tr)return;
  if(tr.dataset.oid)openOrderById(tr.dataset.oid);
  else{const q=proformas.find(x=>x.year+"_"+x.no===tr.dataset.pid);if(q)openPro(q)}
});
$("btnNewPH").onclick=()=>openProDraft(newProDraft(),true);
$("pNew").onclick=()=>openProDraft(newProDraft(),true);
$("btnNewH").onclick=()=>{$("view").appendChild($("sheetbox"));openForm(newOrder(),true);show("o")};
try{document.querySelectorAll(".side nav button").forEach(b=>{b.title=b.textContent.trim()})}catch(e){}
show("h");
initRole();

/* ---------- baza ---------- */
(async()=>{
  $("empty").textContent="Učitavanje…";
  try{db=await claude.use("db")}catch(e){db=null}
  if(!db){$("empty").textContent="Baza nije dostupna. Otvori aplikaciju prijavljen/a na svoj nalog.";$("btnNew").disabled=true;return}
  let t=setTimeout(()=>{$("empty").textContent="Baza ne odgovara. Osveži stranicu."},10000);
  db.collection("orders").onSnapshot(s=>{setTimeout(homeUp,0);
    clearTimeout(t);
    orders=s.docs.map(d=>fixDoc(d.data())).filter(Boolean);
    if(!cur)renderList();
    if(!$("prod").classList.contains("hide"))renderProd();
  },e=>{clearTimeout(t);$("empty").textContent="Greška baze: "+(e.message||e.code)});
  db.collection("prices").onSnapshot(s=>{setTimeout(homeUp,0);prices=s.docs.map(d=>{const x=d.data()||{};return{id:d.id,naziv:x.naziv??x.vrsta??"",grupa:x.grupa||"trapez",jm:x.jm??"m²",vele:+(x.vele??x.cena??0)}});if(!$("cen").classList.contains("hide"))renderPrices();if(cur&&!$("view").classList.contains("hide")&&!$("segs").contains(document.activeElement))renderItems()},()=>{});
  db.collection("customers").onSnapshot(s=>{customers=s.docs.map(d=>({...d.data(),id:d.id}));fillCustList();if(!$("kup").classList.contains("hide")&&!kcur)renderKupci()},()=>{});
  db.collection("zaliha").onSnapshot(s=>{zaliha=s.docs.map(d=>({...d.data(),id:d.id}));if(!$("prod").classList.contains("hide"))renderStock();setTimeout(homeUp,0)},()=>{});
  db.collection("nabavne").onSnapshot(s=>{setTimeout(homeUp,0);nabavne=s.docs.map(d=>({id:d.id,od:"",lim:0,filc:0,...d.data()}));if(!$("prod").classList.contains("hide")){renderNab();renderProd()}},()=>{});
  db.collection("otpremnice").onSnapshot(s=>{setTimeout(homeUp,0);otpr=s.docs.map(d=>fixDoc(d.data())).filter(Boolean);refreshLocks();if(!$("olist").classList.contains("hide"))renderOL()},()=>{});
  db.collection("proformas").onSnapshot(s=>{setTimeout(homeUp,0);proformas=s.docs.map(d=>fixDoc(d.data())).filter(Boolean);if(!$("plist").classList.contains("hide"))renderPL()},()=>{});
  db.doc("settings/main").onSnapshot(s=>{const d=s.data();SET={...SET,...(d||{})};setLoaded=true;applyGrupe();applyBoje();if(cur&&!$("view").classList.contains("hide")&&document.activeElement===document.body){try{syncHead();renderItems()}catch(e){}}if(document.activeElement!==$("bkDays"))$("bkDays").value=bkDays();setTimeout(checkBk,1500);setTimeout(checkBk,5000);pdvRate=d&&d.pdv!=null?+d.pdv:20;lockOn=d&&d.lockAfterDelivery!=null?!!d.lockAfterDelivery:true;$("setLock").checked=lockOn;refreshLocks();if(!$("cen").classList.contains("hide"))renderPrices();if(document.activeElement!==$("pdv"))$("pdv").value=pdvRate},()=>{});
})();
