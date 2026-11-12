// predračuni
function nextPro(y){const n=proformas.filter(p=>p.year===y).map(p=>p.no);return(n.length?Math.max(...n):0)+1}
function buildPro(o){
  const y=new Date().getFullYear();
  return{_new:true,no:nextPro(y),year:y,orderId:oid(o),orderNo:o.no+"/"+o.year,customer:o.customer,addr:o.addr||"",phone:o.phone||"",pib:o.pib||"",date:new Date().toISOString().slice(0,10),note:"",uplate:[],pdv:pdvRate,
   lines:(o.items||[]).map(i=>{const pr=priceFor(i.vrsta,i.boja);return{vrsta:i.vrsta,boja:i.boja,duzina:i.duzina,kom:i.kom,m2:i.m2,jm:i.jm||"m²",cena:pr==null?"":pr}})};
}
const payTotal=q=>r2((q.uplate||[]).reduce((t,u)=>t+num(u.iznos),0));
function renderPays(){
  $("pPays").innerHTML=(pcur.uplate||[]).map((u,i)=>`<div class="row" data-i="${i}" style="margin-bottom:6px;flex-wrap:nowrap"><input type="date" data-pd value="${esc(u.date||"")}" style="width:150px;flex:none"><input data-pa inputmode="decimal" placeholder="Iznos" value="${esc(u.iznos)}" style="width:110px;flex:none"><input data-pn placeholder="Napomena (npr. avans)" value="${esc(u.nap||"")}" style="min-width:0;flex:1"><button class="d" data-px title="Obriši uplatu">✕</button></div>`).join("");
  const t=payTotal(pcur);$("pPayTot").textContent=(pcur.uplate||[]).length?"Ukupno uplaćeno: "+money(t)+" RSD":"Nema uplata.";
}
const kupacOf=q=>q.kupac||((String(q.pib||"").trim())?"pravno":"fizicko");
const priceVat=(l,rate)=>r2(cn(l)*(1+rate/100));
const lineAmt=(l,rate,kup)=>kup==="fizicko"?r2(r2(num(l.m2))*priceVat(l,rate)):r2(num(l.m2)*cn(l));
function calcPro(lines,rate,kup){
  let b,p,t;
  if(kup==="fizicko"){t=r2(lines.reduce((a,l)=>a+lineAmt(l,rate,kup),0));b=r2(t/(1+rate/100));p=r2(t-b)}
  else{b=r2(lines.reduce((a,l)=>a+lineAmt(l,rate,kup),0));p=r2(b*rate/100);t=r2(b+p)}
  return{b,p,t};
}
function proTot(){const rate=parseFloat(String(pcur.pdv).replace(",","."))||0,k=calcPro(pcur.lines,rate,kupacOf(pcur)),paid=payTotal(pcur);return{b:k.b,rate,p:k.p,t:k.t,paid,left:r2(k.t-paid)}}
function openPro(p){
  pcur=JSON.parse(JSON.stringify(p));pdirty=false;cur=null;dirty=false;if(pcur.pdv==null)pcur.pdv=pdvRate;
  $("pview").appendChild($("sheetbox"));
  $("pNo").value=pcur.no;$("pYr").value=pcur.year;$("pCust").value=pcur.customer;$("pAddr").value=pcur.addr||"";$("pPhone").value=pcur.phone||"";$("pPib").value=pcur.pib||"";$("pDate").value=pcur.date;$("pNote").value=pcur.note||"";$("pPdv").value=pcur.pdv;pcur.kupac=kupacOf(pcur);$("pKup").value=pcur.kupac;if(!pcur.uplate)pcur.uplate=num(pcur.placeno)>0?[{date:pcur.date,iznos:pcur.placeno,nap:"Avans"}]:[];renderPays();
  $("pNo").disabled=$("pYr").disabled=!pcur._new;$("pDel").classList.toggle("hide",!!pcur._new);$("pCopy").classList.toggle("hide",!!pcur._new);$("pOrd").classList.toggle("hide",!pcur.orderId);{const sg=!!(pcur.segments&&pcur.segments.length&&!pcur.orderId);$("pEdit").classList.toggle("hide",!sg);$("pMkOrd").classList.toggle("hide",!sg)}
  $("pstatus").textContent=pcur.lines.some(l=>!cn(l))?"Neke stavke nemaju cenu u cenovniku – upiši je ručno.":"";
  show("pv");renderPro();applyProLock();window.scrollTo(0,0);
}
function renderPro(){
  $("phint").textContent="Cene su preuzete iz cenovnika. Prazno (crveno) polje znači da cene nema u cenovniku – upiši je ručno.";
  $("plines").innerHTML=pcur.lines.map((l,i)=>`<tr data-i="${i}"><td>${esc(l.vrsta)}</td><td>${esc(l.boja)}</td><td>${esc(l.duzina)}</td><td>${esc(l.kom)}</td><td class="n">${fmt(num(l.m2))} ${esc(l.jm||"m²")}</td><td><input data-pc value="${esc(l.cena)}" inputmode="decimal" style="width:110px${cn(l)?"":";border-color:#c0392b"}"></td><td class="n" data-am>${money(lineAmt(l,proTot().rate,kupacOf(pcur)))}</td></tr>`).join("");
  proSheet();
}
function proSheet(){
  const t=proTot(),CG8='<colgroup><col style="width:44px"><col style="width:41%"><col style="width:9%"><col style="width:13%"><col style="width:16%"><col></colgroup>',fz=kupacOf(pcur)==="fizicko";
  const grp=new Map();pcur.lines.filter(l=>String(l.vrsta).trim()||num(l.m2)).forEach(l=>{const k=[String(l.vrsta).trim().toLowerCase(),String(l.boja||"").trim().toLowerCase(),l.jm||"m²",cn(l)].join("|");const g=grp.get(k);if(g){g.m2+=num(l.m2);if(l.kom!==""&&l.kom!=null)g.kom=(g.kom===""?0:g.kom)+num(l.kom)}else grp.set(k,{vrsta:l.vrsta,boja:l.boja,jm:l.jm,cena:l.cena,m2:num(l.m2),kom:(l.kom!==""&&l.kom!=null)?num(l.kom):""})});
  const rows=[...grp.values()].map((l,i)=>`<tr><td>${i+1}.</td><td>${esc(goodsName(l))}</td><td>${esc(l.jm||"m²")}</td><td>${fmt(r2(l.m2))}</td><td>${money(fz?priceVat(l,t.rate):cn(l))}</td><td>${money(lineAmt(l,t.rate,fz?"fizicko":"pravno"))}</td></tr>`).join("");
  const ntx=[pcur.orderNo?"Po radnom nalogu br. "+esc(pcur.orderNo):"",pcur.note?esc(pcur.note):""].filter(Boolean).join(" · ");
  const R='style="text-align:right"';
  $("sheet").innerHTML=wf(`<div class="bn"><div><h2>Limarija WD-36</h2><div class="ad"><b>Miloš Spasić PR Kovačka radionica WD-36</b><br>Lole Ribara 40, 25250 Odžaci<br>PIB: 110029026 · MB: 64594940<br>Tekući račun: 325-9500600059441-13</div></div></div><div class="bd">
  <div class="hd"><div style="flex:2"><span>Predračun</span><b class="no">${esc(pcur.no)}/${esc(pcur.year)}</b><span style="margin-top:10px">Datum</span><b>${fmtDate(pcur.date)}</b></div><div style="flex:3"><span>Kupac</span><b>${esc(pcur.customer)}</b>${custLine(pcur.addr,pcur.phone,pcur.pib)}</div></div>
  <div class="sg"><table>${CG8}<thead><tr><th>#</th><th>Vrsta robe</th><th>Jed.</th><th>Količina</th><th>${fz?"Cena sa PDV":"Cena bez PDV"}</th><th>Iznos</th></tr></thead><tbody>${rows}</tbody></table></div>
  <table class="sg ns" style="width:60%;margin-left:auto"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tbody>
  ${fz?"":`<tr><td ${R}>Osnovica:</td><td ${R}>${money(t.b)} RSD</td></tr>${t.rate?`<tr><td ${R}>PDV (${esc(t.rate)}%):</td><td ${R}>${money(t.p)} RSD</td></tr>`:""}`}
  <tr><td style="background:#f1f2f4;color:#000;font-weight:700;text-align:right">UKUPNO:</td><td style="background:#f1f2f4;color:#000;font-weight:700;text-align:right">${money(t.t)} RSD</td></tr>
  <tr><td ${R}>Plaćeno:</td><td ${R}>${money(t.paid)} RSD</td></tr>
  <tr><td style="background:#f8f9fa;font-weight:700;text-align:right">Ostalo za plaćanje:</td><td style="background:#f8f9fa;font-weight:700;text-align:right">${money(t.left)} RSD</td></tr></tbody></table>
  ${ntx?`<div class="nt">${ntx}</div>`:""}
  <div class="sigblock" style="display:flex;justify-content:flex-end;margin-top:56px"><div style="width:42%;border-top:1px solid #444;padding-top:4px;text-align:center;font-size:13px">Sastavio</div></div></div>`);
}
["pNo","pYr","pCust","pAddr","pPhone","pPib","pKup","pDate","pNote","pPdv"].forEach(id=>$(id).addEventListener("input",()=>{
  pcur.no=parseInt($("pNo").value)||0;pcur.year=parseInt($("pYr").value)||pcur.year;pcur.customer=$("pCust").value;pcur.addr=$("pAddr").value;pcur.phone=$("pPhone").value;pcur.pib=$("pPib").value;pcur.date=$("pDate").value;pcur.note=$("pNote").value;pcur.pdv=$("pPdv").value;pcur.kupac=$("pKup").value;pdirty=true;renderPro();
}));
$("pPays").addEventListener("input",e=>{
  const row=e.target.closest("[data-i]");if(!row)return;const u=pcur.uplate[+row.dataset.i];
  if(e.target.dataset.pd!==undefined)u.date=e.target.value;else if(e.target.dataset.pa!==undefined)u.iznos=e.target.value;else if(e.target.dataset.pn!==undefined)u.nap=e.target.value;
  pdirty=true;$("pPayTot").textContent="Ukupno uplaćeno: "+money(payTotal(pcur))+" RSD";proSheet();
});
$("pPays").addEventListener("click",e=>{const b=e.target.closest("[data-px]");if(!b)return;pcur.uplate.splice(+b.closest("[data-i]").dataset.i,1);pdirty=true;renderPays();proSheet()});
$("pPayAdd").onclick=()=>{pcur.uplate=pcur.uplate||[];const left=Math.max(0,proTot().left);pcur.uplate.push({date:new Date().toISOString().slice(0,10),iznos:left?String(left).replace(".",","):"",nap:""});pdirty=true;renderPays();proSheet()};
$("plines").addEventListener("input",e=>{
  const tr=e.target.closest("tr");if(!tr||!("pc" in e.target.dataset))return;
  const l=pcur.lines[+tr.dataset.i];l.cena=e.target.value;pdirty=true;e.target.style.borderColor=cn(l)?"":"#c0392b";
  tr.querySelector("[data-am]").textContent=money(lineAmt(l,proTot().rate,kupacOf(pcur)));proSheet();
});
async function savePro(){
  const S=$("pstatus");if(!db)return false;
  if(!pcur.no||!pcur.customer.trim()){S.textContent="Unesi broj i kupca.";return false}
  if(pcur._new&&proformas.some(p=>p.year===pcur.year&&p.no===pcur.no)){S.textContent="Predračun "+pcur.no+"/"+pcur.year+" već postoji – promeni broj.";return false}
  const lines=pcur.lines.filter(l=>String(l.vrsta).trim()&&num(l.m2)>0);
  if(!lines.length){S.textContent="Dodaj bar jednu stavku sa nazivom i količinom.";return false}
  const t=proTot(),now=new Date().toISOString(),old=proformas.find(p=>p.year===pcur.year&&p.no===pcur.no);
  const doc={no:pcur.no,year:pcur.year,orderId:pcur.orderId||"",orderNo:pcur.orderNo||"",customer:pcur.customer.trim(),addr:(pcur.addr||"").trim(),phone:(pcur.phone||"").trim(),pib:(pcur.pib||"").trim(),kupac:kupacOf(pcur),date:pcur.date,note:pcur.note||"",pdv:t.rate,placeno:t.paid,ostalo:t.left,uplate:(pcur.uplate||[]).filter(u=>num(u.iznos)>0).map(u=>({date:u.date||"",iznos:r2(num(u.iznos)),nap:u.nap||""})),
   lines:lines.map(l=>({vrsta:String(l.vrsta).trim(),boja:l.boja||"",duzina:l.duzina,kom:l.kom,m2:num(l.m2),jm:l.jm||"m²",cena:cn(l),iznos:lineAmt(l,t.rate,kupacOf(pcur))})),osnovica:t.b,pdvIznos:t.p,ukupno:t.t,createdAt:old?old.createdAt:now,updatedAt:now};
  if(!pcur.orderId&&pcur.segments&&pcur.segments.length){doc.segments=pcur.segments;doc.samostalan=true}
  try{await db.collection("proformas").doc(pcur.year+"_"+pcur.no).set(doc);custSync(doc);pcur._new=false;pdirty=false;$("pNo").disabled=$("pYr").disabled=true;$("pDel").classList.remove("hide");S.textContent="Sačuvano ✓";return true}
  catch(e){S.textContent="Greška pri čuvanju: "+(e.message||e.code||"nepoznata");return false}
}
$("pSave").onclick=savePro;
$("pEdit").onclick=async()=>{
  const S=$("pstatus");if(!pcur||!pcur.segments)return;
  if(isProLocked(pcur)){S.textContent="Predračun je zaključan (izdata otpremnica) – stavke se ne menjaju.";return}
  if((pcur._new||pdirty)&&!(await savePro()))return;
  const d={id:null,no:pcur.no,year:pcur.year,customer:pcur.customer,addr:pcur.addr||"",phone:pcur.phone||"",pib:pcur.pib||"",date:pcur.date,status:"u_radu",note:pcur.note||"",segments:editSegs(pcur.segments),kupac:pcur.kupac,pdv:pcur.pdv,uplate:pcur.uplate||[],lines:pcur.lines||[],createdAt:pcur.createdAt,_origId:pcur.year+"_"+pcur.no};
  pcur=null;pdirty=false;openProDraft(d,false);
};
$("pMkOrd").onclick=async()=>{
  const S=$("pstatus");if(!db||!pcur||!pcur.segments||pcur.orderId)return;
  if((pcur._new||pdirty)&&!(await savePro()))return;
  const y=new Date().getFullYear(),nums=orders.filter(o=>o.year===y).map(o=>o.no),no=(nums.length?Math.max(...nums):0)+1,id=y+"_"+no;
  if(!(await ask("Kupac je prihvatio predračun? Napraviti radni nalog "+no+"/"+y+" od predračuna "+pcur.no+"/"+pcur.year+"?")))return;
  if(orders.some(o=>oid(o)===id)){S.textContent="Nalog "+no+"/"+y+" već postoji.";return}
  const segments=pcur.segments.map(sg=>{const items=sg.items.map(i=>({...i}));return{tip:sg.tip,title:TIPOVI[sg.tip]||sg.title||"",sid:newSid(),status:"u_radu",items,totalKom:cntK(items),totalM2:sumM(items)}});
  const flat=segments.flatMap(sg=>sg.items.map(i=>({...i,segment:sg.title}))),now=new Date().toISOString();
  const od={no,year:y,customer:pcur.customer,addr:pcur.addr||"",phone:pcur.phone||"",pib:pcur.pib||"",date:now.slice(0,10),status:"u_radu",note:pcur.note||"",segments,items:flat,totalKom:cntK(flat),totalM2:sumM(flat),createdAt:now,updatedAt:now,izPredracuna:pcur.year+"_"+pcur.no};
  try{await db.collection("orders").doc(id).set(od)}catch(e){S.textContent="Greška pri pravljenju naloga: "+(e.message||e.code||"nepoznata");return}
  pcur.orderId=id;pcur.orderNo=no+"/"+y;delete pcur.segments;delete pcur.samostalan;
  if(!(await savePro())){S.textContent="Nalog je napravljen, ali veza sa predračunom nije sačuvana.";return}
  const o=od;pcur=null;pdirty=false;$("view").appendChild($("sheetbox"));openForm(o,false);show("o");$("status").textContent="Radni nalog "+no+"/"+y+" napravljen iz predračuna – proveri i po potrebi dopuni.";
};

$("pDel").onclick=async()=>{
  if(!(await ask("Trajno obrisati predračun "+pcur.no+"/"+pcur.year+"?")))return;
  try{await db.collection("proformas").doc(pcur.year+"_"+pcur.no).delete();pdirty=false;goTab("pl")}catch(e){$("pstatus").textContent="Brisanje nije uspelo."}
};
$("pBack").onclick=()=>goTab("pl");
$("pOrd").onclick=async()=>{
  const o=orders.find(x=>oid(x)===pcur.orderId);if(!o){$("pstatus").textContent="Radni nalog nije pronađen.";return}
  if(pdirty&&!(await ask("Ima nesačuvanih izmena. Napustiti?")))return;
  pcur=null;pdirty=false;$("view").appendChild($("sheetbox"));openForm(o,false);show("o");
};
$("btnPro").onclick=async()=>{
  const was=cur._new||dirty;if(was&&!(await save()))return;
  const ex=proformas.find(p=>p.orderId===oid(cur));if(ex){openPro(ex);return}
  const o=was?lastDoc:orders.find(x=>oid(x)===oid(cur));
  if(!o||!orderItems(o).length){$("status").textContent="Sačuvaj nalog pa pokušaj ponovo.";return}
  openPro(buildPro(o));
};
function renderPL(){
  const r=proformas.slice().sort((a,b)=>b.year-a.year||b.no-a.no);
  $("pltb").innerHTML=r.map(p=>`<tr class="cl" data-id="${p.year}_${p.no}"><td>${p.no}/${p.year}${isProLocked(p)?" 🔒":""}</td><td>${fmtDate(p.date)}</td><td>${esc(p.customer)}</td><td>${p.orderNo?esc(p.orderNo):(p.segments&&p.segments.length?'<span class="tag u_radu">Čeka nalog</span>':"–")}</td><td class="n">${money(p.ukupno)}</td><td><button data-copyp title="Kopiraj predračun">⧉</button> <button class="d" data-delp title="${isProLocked(p)?"Zaključano – izdata otpremnica":"Obriši predračun"}"${isProLocked(p)?" disabled":""}>✕</button></td></tr>`).join("");
  $("plempty").textContent=r.length?"":"Nema predračuna. Napravi ga dugmetom „Novi predračun“ ili iz radnog naloga.";
}
$("pltb").onclick=async e=>{
  const tr=e.target.closest("tr[data-id]");const p=tr&&proformas.find(x=>x.year+"_"+x.no===tr.dataset.id);if(!p)return;
  if(e.target.dataset.copyp!==undefined){copyPro(p);return}
  if(e.target.dataset.delp!==undefined){
    if(isProLocked(p)){$("plempty").textContent="Predračun je zaključan (izdata otpremnica).";return}
    if(!(await ask("Trajno obrisati predračun "+p.no+"/"+p.year+" ("+p.customer+")?")))return;
    try{await db.collection("proformas").doc(p.year+"_"+p.no).delete()}catch(x){$("plempty").textContent="Brisanje nije uspelo."}
    return;
  }
  openPro(p);
};
