/* ---------- proizvodnja ---------- */
const MES=["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"];
function nabFor(ym){
  const last=ym+"-31",c=nabavne.filter(n=>n.od&&n.od<=last).sort((a,b)=>String(a.od).localeCompare(String(b.od)));
  return c.length?c[c.length-1]:null;
}
function renderNab(){
  const a=document.activeElement;if(a&&$("ntb").contains(a)&&a.tagName!=="BUTTON")return;
  $("ntb").innerHTML=nabavne.slice().sort((x,y)=>String(x.od).localeCompare(String(y.od))).map(n=>`<tr data-id="${esc(n.id)}"><td><input type="date" data-k="od" value="${esc(n.od)}"></td><td><input data-k="lim" inputmode="decimal" value="${esc(n.lim)}" style="width:130px"></td><td><input data-k="filc" inputmode="decimal" value="${esc(n.filc)}" style="width:130px"></td><td><button class="d" data-x title="Obriši">✕</button></td></tr>`).join("");
  $("nempty").textContent=nabavne.length?"":"Nema unetih nabavnih cena. Dodaj prvu dugmetom „Dodaj nabavnu cenu“.";
}
$("btnNab").onclick=async()=>{try{await db.collection("nabavne").doc().set({od:today(),lim:0,filc:0})}catch(e){$("nstatus").textContent="Greška pri čuvanju"}};
$("ntb").addEventListener("change",async e=>{
  const tr=e.target.closest("tr"),k=e.target.dataset.k;if(!tr||!k)return;const n=nabavne.find(x=>x.id===tr.dataset.id);if(!n)return;
  n[k]=k==="od"?e.target.value:num(e.target.value);
  try{await db.collection("nabavne").doc(n.id).set({od:n.od,lim:n.lim,filc:n.filc});$("nstatus").textContent="Sačuvano ✓"}catch(x){$("nstatus").textContent="Greška pri čuvanju"}
});
$("ntb").addEventListener("click",async e=>{
  if(e.target.dataset.x===undefined)return;
  if(!(await ask("Obrisati ovu nabavnu cenu?")))return;
  try{await db.collection("nabavne").doc(e.target.closest("tr").dataset.id).delete()}catch(x){$("nstatus").textContent="Brisanje nije uspelo"}
});
const SKART="Škart";
function prodData(doneOpt){
  const done=doneOpt!==undefined?doneOpt:$("rSt").value==="done",data={};
  orders.forEach(o=>{
    if(done&&o.status==="u_radu")return;
    const ym=String(o.date||"").slice(0,7);if(!/^\d{4}-\d{2}$/.test(ym))return;
    (o.items||[]).forEach(i=>{
      if(kindOf(i.tip||"trapez")!=="trapez")return;
      const m=data[ym]=data[ym]||{},r=m[i.vrsta]=m[i.vrsta]||{kom:0,m2:0,sales:0,np:false};
      r.kom+=num(i.kom);if((i.jm||"m²")==="m²"){const q=num(i.m2);r.m2+=q;const p=priceForC(i.vrsta,o.customer);if(p==null)r.np=true;else r.sales+=q*p}
    });
  });
  return data;
}
const filcK=v=>/tr\s*-?\s*18/i.test(v)?1.19/1.1:1.19; // m² filca po m² obračunate kvadrature: TR 18 = 1,19 / 1,1; TR 35 = 1,19
const skPct=()=>SET.skartPct==null?0.1:Math.max(0,num(SET.skartPct));
const skPctF=()=>SET.skartPctF==null?0.05:Math.max(0,num(SET.skartPctF));
function calcMonth(ym,m){
  const nb=nabFor(ym);
  const rows=Object.keys(m).sort((a,b)=>a.localeCompare(b,"sr-Latn")).map(v=>{
    const r=m[v],filc=/filc/i.test(v),fl=filc?r2(r.m2*filcK(v)):0;
    const prodaja=r2(r.sales||0),nabavka=nb?r2(r.m2*num(nb.lim)+fl*num(nb.filc)):0;
    return{vrsta:v,kom:r.kom,m2:r.m2,lim:r.m2,filc:fl,prodaja,nabavka,bruto:r2(prodaja-nabavka),noPrice:!!r.np,noNab:!nb};
  });
  const pc=skPct(),pf=skPctF(),fm=x=>String(x).replace(".",",");
  if((pc>0||pf>0)&&rows.length){const sl=r2(rows.reduce((t,r)=>t+r.lim,0)*pc/100),sf=r2(rows.reduce((t,r)=>t+r.filc,0)*pf/100),nbk=nb?r2(sl*num(nb.lim)+sf*num(nb.filc)):0;
    rows.push({vrsta:SKART+" (lim "+fm(pc)+"%, filc "+fm(pf)+"%)",kom:0,m2:0,lim:sl,filc:sf,prodaja:0,nabavka:nbk,bruto:-nbk,noPrice:false,noNab:!nb})}
  return rows;
}
function mergeRows(list){
  const m={};
  list.flat().forEach(r=>{
    const t=m[r.vrsta]=m[r.vrsta]||{vrsta:r.vrsta,kom:0,m2:0,lim:0,filc:0,prodaja:0,nabavka:0,bruto:0,noPrice:false,noNab:false};
    ["kom","m2","lim","filc","prodaja","nabavka","bruto"].forEach(k=>t[k]+=r[k]);t.noPrice=t.noPrice||r.noPrice;t.noNab=t.noNab||r.noNab;
  });
  return Object.values(m).sort((a,b)=>(a.vrsta.startsWith(SKART)-b.vrsta.startsWith(SKART))||a.vrsta.localeCompare(b.vrsta,"sr-Latn"));
}
function recapCard(title,rows,pref){
  const T={kom:0,m2:0,lim:0,filc:0,prodaja:0,nabavka:0,bruto:0};rows.forEach(r=>Object.keys(T).forEach(k=>T[k]+=r[k]));
  const red=v=>v<0?' style="color:#c0392b"':"";
  const body=rows.map(r=>`<tr><td>${esc(r.vrsta)}</td><td class="n">${fmt(r.kom).replace(",00","")}</td><td class="n">${fmt(r.m2)}</td><td class="n">${fmt(r.lim)}</td><td class="n">${fmt(r.filc)}</td><td class="n">${money(r.prodaja)}</td><td class="n">${money(r.nabavka)}</td><td class="n"${red(r.bruto)}>${money(r.bruto)}</td></tr>`).join("");
  const np=rows.filter(r=>r.noPrice).map(r=>r.vrsta),nn=rows.some(r=>r.noNab);
  const warn=(np.length?`<div style="color:#c0392b;font-size:12px;margin-top:6px">Nema prodajne cene u cenovniku za: ${np.map(esc).join(", ")}.</div>`:"")+(nn?`<div style="color:#c0392b;font-size:12px;margin-top:6px">Za deo perioda nema nabavne cene – nabavka je prikazana kao 0. Unesi je gore.</div>`:"");
  const nOrd=orders.filter(o=>String(o.date||"").startsWith(pref||"@")).length;
  const kp=`<div class="grid" style="margin-top:10px"><div class="kpi"><span>Proizvedeno</span><b>${fmt(T.m2)} m²</b></div><div class="kpi"><span>Radnih naloga</span><b>${nOrd}</b></div><div class="kpi"><span>Prodaja (bez PDV)</span><b>${money(T.prodaja)}</b></div><div class="kpi"><span>Bruto zarada</span><b${red(T.bruto)}>${money(T.bruto)}</b></div></div>`;
  return `<div class="card"><b>${esc(title)}</b>${kp}<div class="sc" style="margin-top:12px"><table><thead><tr><th>Profil</th><th class="n">Kom.</th><th class="n">Proizvedeno (m²)</th><th class="n">Utrošen lim (m²)</th><th class="n">Utrošen filc (m²)</th><th class="n">Prodaja (RSD)</th><th class="n">Nabavka (RSD)</th><th class="n">Bruto zarada (RSD)</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td><b>UKUPNO</b></td><td class="n"><b>${fmt(T.kom).replace(",00","")}</b></td><td class="n"><b>${fmt(T.m2)}</b></td><td class="n"><b>${fmt(T.lim)}</b></td><td class="n"><b>${fmt(T.filc)}</b></td><td class="n"><b>${money(T.prodaja)}</b></td><td class="n"><b>${money(T.nabavka)}</b></td><td class="n"${red(T.bruto)}><b>${money(T.bruto)}</b></td></tr></tfoot></table></div>${warn}</div>`;
}
function renderProd(){
  renderStock();
  const data=prodData(),yms=Object.keys(data).sort().reverse();
  const years=[...new Set(yms.map(k=>k.slice(0,4)))].sort().reverse();
  const keep=$("rYear").value;
  $("rYear").innerHTML='<option value="all">Sve godine</option>'+years.map(y=>`<option>${y}</option>`).join("");
  $("rYear").value=(keep==="all"||years.includes(keep))&&keep?keep:(years[0]||"all");
  const sel=$("rYear").value,monthRows={};
  yms.forEach(ym=>{monthRows[ym]=calcMonth(ym,data[ym])});
  let html="";
  if(!yms.length)html='<div class="card"><div class="msg">Nema naloga sa trapeznim limom za izabrani period.</div></div>';
  else if(sel==="all")html=years.map(y=>recapCard(y+". godina – ukupno",mergeRows(yms.filter(k=>k.startsWith(y)).map(k=>monthRows[k])),y+"-")).join("");
  else{
    const mine=yms.filter(k=>k.startsWith(sel));
    html=recapCard(sel+". godina – ukupno",mergeRows(mine.map(k=>monthRows[k])),sel+"-")+mine.map(k=>recapCard(MES[+k.slice(5)-1]+" "+sel,monthRows[k],k)).join("");
  }
  $("rbody").innerHTML=html;
  if(typeof renderRep==="function")renderRep();
}
$("rYear").onchange=renderProd;$("rSt").onchange=renderProd;

