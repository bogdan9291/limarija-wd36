/* ---------- izveštaji po kupcu, boji i mesecu ---------- */
const gi=n=>Math.round(+n||0).toLocaleString("sr-RS");
function repRows(){
  const by=$("xBy").value,yr=$("xYear").value,mo=$("xMon").value,done=$("xSt").value==="done",g={};
  orders.forEach(o=>{
    if(done&&o.status==="u_radu")return;
    const d=String(o.date||"");if(!/^\d{4}-\d{2}/.test(d))return;
    if(yr!=="all"&&d.slice(0,4)!==yr)return;if(mo&&d.slice(5,7)!==mo)return;
    (o.items||[]).forEach(i=>{
      const key=by==="kupac"?fold(o.customer)||"(bez imena)":by==="boja"?(String(i.boja||"").trim()?fold(i.boja):"(bez boje)"):d.slice(0,7);
      const lbl=by==="kupac"?(String(o.customer||"").trim()||"(bez imena)"):by==="boja"?(String(i.boja||"").trim()||"(bez boje)"):d.slice(0,7);
      const r=g[key]=g[key]||{key,names:{},ords:new Set(),kom:0,m2:0,m:0,prodaja:0,last:""};
      r.names[lbl]=(r.names[lbl]||0)+1;r.ords.add(oid(o));r.kom+=num(i.kom);
      if((i.jm||"m²")==="m²"){const m2=num(i.m2);r.m2+=m2;if(kindOf(i.tip||"trapez")==="trapez"){const p=priceFor(i.vrsta);if(p!=null)r.prodaja+=m2*p}}
      else if(i.jm==="metar")r.m+=num(i.duzina)*num(i.kom);
      if(d>r.last)r.last=d;
    });
  });
  const rows=Object.values(g).map(r=>({key:r.key,label:Object.entries(r.names).sort((a,b)=>b[1]-a[1])[0][0],nalozi:r.ords.size,kom:r.kom,m2:r.m2,m:r.m,prodaja:r.prodaja,last:r.last}));
  if(by==="mesec")rows.sort((a,b)=>b.key.localeCompare(a.key));else rows.sort((a,b)=>b.m2-a.m2||b.kom-a.kom||a.label.localeCompare(b.label,"sr-Latn"));
  rows.forEach(r=>{if(by==="mesec"){const[y,m]=r.key.split("-");r.label=MES[+m-1]+" "+y}});
  return rows;
}
function repTotal(rows){
  return rows.reduce((t,r)=>({kom:t.kom+r.kom,m2:t.m2+r.m2,m:t.m+r.m,prodaja:t.prodaja+r.prodaja}),{kom:0,m2:0,m:0,prodaja:0});
}
function repCount(){ // broj različitih naloga u izabranom periodu
  const yr=$("xYear").value,mo=$("xMon").value,done=$("xSt").value==="done";
  return orders.filter(o=>{if(done&&o.status==="u_radu")return false;const d=String(o.date||"");return /^\d{4}-\d{2}/.test(d)&&(yr==="all"||d.slice(0,4)===yr)&&(!mo||d.slice(5,7)===mo)}).length;
}
function renderRep(){
  if(!$("xCard"))return;
  const yrs=[...new Set(orders.map(o=>String(o.date||"").slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort().reverse();
  const keepY=$("xYear").value;
  $("xYear").innerHTML='<option value="all">Sve godine</option>'+yrs.map(y=>`<option>${y}</option>`).join("");
  $("xYear").value=keepY&&(keepY==="all"||yrs.includes(keepY))?keepY:(yrs[0]||"all");
  if(!$("xMon").options.length||$("xMon").options.length<13){const k=$("xMon").value;$("xMon").innerHTML='<option value="">Svi meseci</option>'+MES.map((m,i)=>`<option value="${String(i+1).padStart(2,"0")}">${m}</option>`).join("");$("xMon").value=k||""}
  const by=$("xBy").value,rows=repRows(),T=repTotal(rows),first=by==="kupac"?"Kupac":by==="boja"?"Boja":"Mesec";
  $("xHead").innerHTML=`<tr><th>${first}</th><th class="n">Naloga</th><th class="n">Komada</th><th class="n">Kvadratura (m²)</th><th class="n">Metara</th><th class="n">Prodaja (RSD)</th>${by==="kupac"?'<th>Poslednji nalog</th>':""}</tr>`;
  $("xBody").innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.label)}</td><td class="n">${r.nalozi}</td><td class="n">${gi(r.kom)}</td><td class="n">${money(r.m2)}</td><td class="n">${r2(r.m)?money(r.m):"–"}</td><td class="n">${r2(r.prodaja)?money(r.prodaja):"–"}</td>${by==="kupac"?`<td>${fmtDate(r.last)}</td>`:""}</tr>`).join("")
    +`<tr style="font-weight:700"><td>Ukupno</td><td class="n">${repCount()}</td><td class="n">${gi(T.kom)}</td><td class="n">${money(T.m2)}</td><td class="n">${r2(T.m)?money(T.m):"–"}</td><td class="n">${money(T.prodaja)}</td>${by==="kupac"?"<td></td>":""}</tr>`
    :`<tr><td colspan="7"><div class="msg">Nema naloga za izabrani period.</div></td></tr>`;
}
["xBy","xYear","xMon","xSt"].forEach(i=>$(i).onchange=renderRep);
$("xCsv").onclick=async()=>{
  const by=$("xBy").value,rows=repRows(),T=repTotal(rows),q=v=>'"'+String(v).replace(/"/g,'""')+'"',n=v=>String(r2(v)).replace(".",",");
  const head=[by==="kupac"?"Kupac":by==="boja"?"Boja":"Mesec","Naloga","Komada","Kvadratura (m2)","Metara","Prodaja (RSD)"].concat(by==="kupac"?["Poslednji nalog"]:[]);
  const lines=[head.map(q).join(";")].concat(rows.map(r=>[q(r.label),r.nalozi,n(r.kom),n(r.m2),n(r.m),n(r.prodaja)].concat(by==="kupac"?[q(fmtDate(r.last))]:[]).join(";")));
  lines.push([q("Ukupno"),repCount(),n(T.kom),n(T.m2),n(T.m),n(T.prodaja)].concat(by==="kupac"?[q("")]:[]).join(";"));
  const nm="Izvestaj_po_"+(by==="kupac"?"kupcu":by==="boja"?"boji":"mesecu")+"_"+($("xYear").value==="all"?"sve":$("xYear").value)+($("xMon").value?"-"+$("xMon").value:"")+".csv";
  try{await saveFile(nm,"﻿sep=;\r\n"+lines.join("\r\n"));$("xMsg").textContent="Sačuvano: "+nm}catch(e){$("xMsg").textContent="Greška: "+(e.message||"preuzimanje nije uspelo")}
};
