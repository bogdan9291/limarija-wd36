/* ---------- lista ---------- */
let sortKey="broj",sortDir=-1;
const STR={u_radu:0,zavrsen:1,isporucen:2};
function orderCmp(a,b){
  let r=0;
  if(sortKey==="datum")r=String(a.date||"").localeCompare(String(b.date||""));
  else if(sortKey==="kupac")r=String(a.customer||"").localeCompare(String(b.customer||""),"sr-Latn");
  else if(sortKey==="kom")r=num(a.totalKom)-num(b.totalKom);
  else if(sortKey==="m2")r=num(a.totalM2)-num(b.totalM2);
  else if(sortKey==="status")r=(STR[a.status]??9)-(STR[b.status]??9);
  else r=a.year-b.year||a.no-b.no;
  return r*sortDir||(b.year-a.year||b.no-a.no);
}
function markSort(){document.querySelectorAll("#list th[data-sort]").forEach(th=>{th.textContent=th.dataset.l+(th.dataset.sort===sortKey?(sortDir>0?" ▲":" ▼"):"")})}
function renderList(){markSort();
  const q=fold($("q").value),fy=$("fy").value;
  const years=[...new Set(orders.map(o=>o.year))].sort((a,b)=>b-a);
  const sel=$("fy"),keep=sel.value;
  sel.innerHTML='<option value="">Sve godine</option>'+years.map(y=>`<option>${y}</option>`).join("");
  sel.value=years.map(String).includes(keep)?keep:"";
  const ms=[...new Set(orders.filter(o=>!sel.value||String(o.year)===sel.value).map(o=>String(o.date||"").slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))].sort().reverse();
  const fm=$("fm"),mk=fm.value;fm.innerHTML='<option value="">Svi meseci</option>'+ms.map(k=>`<option value="${k}">${MES[+k.slice(5)-1]} ${k.slice(0,4)}</option>`).join("");fm.value=ms.includes(mk)?mk:"";
  const rows=orders.filter(o=>(!sel.value||String(o.year)===sel.value)&&(!fm.value||String(o.date||"").slice(0,7)===fm.value)&&(!q||fold(o.no+"/"+o.year+" "+o.customer).includes(q)))
    .sort(orderCmp);
  const rowHtml=o=>`<tr class="cl" data-id="${esc(oid(o))}"><td>${o.no}/${o.year}${isOrderLocked(o)?" 🔒":""}</td><td>${fmtDate(o.date)}</td><td>${esc(o.customer)}</td><td class="n">${o.totalKom}</td><td class="n">${fmt(o.totalM2)}</td><td><span class="tag ${o.status}">${{u_radu:"U radu",zavrsen:"Završen",isporucen:"Isporučen"}[o.status]||""}</span>${partTag(o)}</td><td><button data-copyo title="Kopiraj nalog">⧉</button> <button class="d" data-delo title="${isOrderLocked(o)?"Zaključano – izdata otpremnica":"Obriši nalog"}"${isOrderLocked(o)?" disabled":""}>✕</button></td></tr>`;
  if($("fv").value==="mes"){
    const g={};rows.forEach(o=>{const k=String(o.date||"").slice(0,7);(g[k]=g[k]||[]).push(o)});
    $("tb").innerHTML=Object.keys(g).sort().reverse().map(k=>{const a=g[k],lbl=/^\d{4}-\d{2}$/.test(k)?MES[+k.slice(5)-1]+" "+k.slice(0,4):"Bez datuma";
      return `<tr class="mh"><td colspan="7"><b>${lbl}</b> · ${a.length} naloga · ${fmt(a.reduce((t,o)=>t+num(o.totalM2),0))} m²</td></tr>`+a.map(rowHtml).join("")}).join("");
  }else $("tb").innerHTML=rows.map(rowHtml).join("");
  $("empty").textContent=rows.length?"":(db?"Nema radnih naloga. Napravi prvi dugmetom „Novi radni nalog“.":"");
  $("cnt").textContent=rows.length+" naloga";
  $("sum").textContent="Ukupno: "+fmt(rows.reduce((a,o)=>a+o.totalM2,0))+" m²";
}

/* ---------- forma ---------- */
function bopts(arr,v){const a=(v&&!arr.includes(v))?[...arr,v]:arr;return a.map(x=>`<option${x===v?" selected":""}>${esc(x)}${x===v&&!BOJE.includes(x)&&x?" (uklonjena)":""}</option>`).join("")}
function opts(arr,v){return arr.map(x=>`<option${x===v?" selected":""}>${esc(x)}</option>`).join("")}
const UNITS=["m²","komad","sat","km","metar","set"];
function unitOf(v,d){const k=String(v).trim().toLowerCase();const p=prices.find(x=>String(x.naziv).trim().toLowerCase()===k);return p?p.jm:(d||"m²")}
const usesLen=v=>{const u=unitOf(v);return u==="m²"||u==="metar"};
// broj iz teksta: „1.234,50“ → 1234.5; „12,5“ → 12.5; „12.5“ → 12.5
const num=x=>{x=String(x);if(x.includes(","))x=x.replace(/\./g,"").replace(",",".");return parseFloat(x)||0};
// Opšiv: dužina se unosi u METRIMA (zaokružuje se na 2 decimale). Stari nalozi su čuvali milimetre (>= 50), pa se oni pretvaraju.
const opsLm=it=>{const d=num(it.duzina);return it.um==="m"||d<50?d:d/1000};
const mTxt=d=>(Math.round((+d||0)*100)/100).toFixed(2).replace(".",",");
const dLine=it=>kindOf(it.tip||"trapez")==="opsiv"?(num(it.duzina)?mTxt(opsLm(it))+" m":""):it.duzina;
const BASE_T={trapez:"Trapezni lim",opsiv:"Opšiv",oluk:"Oluk",srafovska:"Šrafovska roba"};
const TIPOVI={...BASE_T};
const kindOf=t=>BASE_T[t]?t:((SET&&SET.gKind&&SET.gKind[t])||"trapez");
function applyGrupe(){
  const n=(SET&&SET.gNames)||{},cu=(SET&&Array.isArray(SET.gCustom))?SET.gCustom:[];
  const all=[...Object.keys(BASE_T),...cu],ord=(SET&&Array.isArray(SET.gOrder))?SET.gOrder:[];
  const seq=[...ord.filter((k,i)=>all.includes(k)&&ord.indexOf(k)===i),...all.filter(k=>!ord.includes(k))];
  Object.keys(TIPOVI).forEach(k=>delete TIPOVI[k]);
  seq.forEach(k=>{TIPOVI[k]=BASE_T[k]?(String(n[k]||"").trim()||BASE_T[k]):(String(n[k]||"").trim()||"Nova grupa");if(!BASE_T[k])DEFU[k]=DEFU[kindOf(k)]||"komad"});
}
const DEFU={trapez:"m²",opsiv:"m²",oluk:"metar",srafovska:"komad"};
const TH={trapez:["Vrsta robe","Dužina (mm)","Boja","Kom."],opsiv:["Vrsta robe","Dužina (m)","RŠ (mm)","Boja","Kom."],oluk:["Vrsta robe","Dužina (m)","Jedinica","Boja","Kom."],srafovska:["Vrsta robe","Boja","Kom."]};
function rowUnit(it){const t=kindOf(it.tip||"trapez");return t==="opsiv"?"m²":t==="oluk"?(it.jm==="komad"?"komad":"metar"):t==="srafovska"?unitOf(it.vrsta,"komad"):unitOf(it.vrsta)}
const lenOf=it=>{const t=kindOf(it.tip||"trapez");return t==="opsiv"?true:t==="oluk"?it.jm!=="komad":t==="srafovska"?false:usesLen(it.vrsta)};
const rowM2=it=>{const d=num(it.duzina),k=num(it.kom),t=kindOf(it.tip||"trapez");if(t==="opsiv")return r2(opsLm(it))*num(it.sirina)/1000*k;if(t==="oluk")return it.jm==="komad"?k:d*k;if(t==="srafovska")return k;return usesLen(it.vrsta)?m2(it.vrsta,d,k):k};
const qtyTxt=it=>{const q=rowM2(it),u=rowUnit(it);return((u==="komad"||u==="set")&&Number.isInteger(q)?String(q):fmt(q))+" "+u};
const cntK=a=>a.filter(i=>i.jm!=="sat"&&i.jm!=="km").reduce((s,i)=>s+i.kom,0),sumM=a=>Math.round(a.filter(i=>i.jm==="m²").reduce((s,i)=>s+i.m2,0)*100)/100;
function vl(c,t){const g=t||"trapez",s=new Set(),a=[];prices.filter(p=>(p.grupa||"trapez")===g).map(p=>String(p.naziv).trim()).forEach(x=>{const k=x.toLowerCase();if(x&&!s.has(k)){s.add(k);a.push(x)}});return a.sort((x,y)=>x.localeCompare(y))}
function segTot(sg){let k=0,m=0;sg.items.forEach(it=>{const u=rowUnit(it);if(u!=="sat"&&u!=="km")k+=num(it.kom);if(u==="m²")m+=rowM2(it)});return{k:Math.round(k*100)/100,m:Math.round(m*100)/100}}
function totals(){let k=0,m=0;cur.segments.forEach(sg=>{const t=segTot(sg);k+=t.k;m+=t.m});return{k,m:Math.round(m*100)/100}}
const CG='<colgroup><col style="width:44px"><col style="width:26%"><col style="width:17%"><col style="width:23%"><col style="width:10%"><col></colgroup>';
function cells(it,tip){
  const K=kindOf(tip);
  const L=vl("",tip),legacy=!!it.vrsta&&!L.some(x=>x.toLowerCase()===String(it.vrsta).trim().toLowerCase()),all=legacy?[it.vrsta,...L]:L;
  const v=`<td><select data-f="vrsta">${all.length?opts(all,it.vrsta):'<option value="">Nema stavki u cenovniku</option>'}</select>${legacy?'<div style="font-size:11px;color:#c0392b">nije u cenovniku</div>':""}</td>`;
  const d=`<td><input data-f="duzina" inputmode="${K==="oluk"||K==="opsiv"?"decimal":"numeric"}" value="${esc(it.duzina||"")}" style="width:100px"${lenOf(it)?"":" disabled"}></td>`;
  const b=`<td><select data-f="boja">${bopts(["",...BOJE],it.boja||"")}</select></td>`;
  const k=`<td><input data-f="kom" inputmode="decimal" value="${esc(it.kom)}" style="width:80px"></td>`;
  if(K==="srafovska")return v+`<td><select data-f="boja">${bopts(["",...BOJE],it.boja||"")}</select></td>`+k;
  if(K==="opsiv")return v+d+`<td><input data-f="sirina" inputmode="numeric" value="${esc(it.sirina||"")}" style="width:110px"></td>`+b+k;
  if(K==="oluk")return v+d+`<td><select data-f="jm">${opts(["metar","komad"],it.jm==="komad"?"komad":"metar")}</select></td>`+b+k;
  return v+d+b+k;
}
const newSid=()=>"g"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function updSegBadges(){
  try{if(!cur||cur._new||cur._pro)return;const o=orders.find(x=>oid(x)===oid(cur));
  document.querySelectorAll("#segs [data-sb]").forEach(el=>{let t="Nije otpremljeno",c="u_radu";
    if(o){const d=orderDeliv(o,null).find(z=>z.sid===el.dataset.sb);if(d){if(!d.lines.length&&d.tot>0){t="Otpremljeno ✓";c="isporucen"}else if(d.del>0.005){t="Delimično otpremljeno";c="zavrsen"}}}
    el.textContent=t;el.className="tag segbadge "+c})}catch(e){}
}
function renderItems(){
  cur.segments.forEach(sg=>{if(!sg.sid)sg.sid=newSid();if(!sg.status)sg.status=cur.status==="u_radu"?"u_radu":"zavrsen"});
  cur.segments.forEach(sg=>{sg.tip=sg.tip||"trapez";sg.items.forEach(i=>{i.tip=sg.tip;if(!i.vrsta){const L=vl("",sg.tip);if(L.length)i.vrsta=L[0]}if(i.boja===undefined&&kindOf(sg.tip)!=="srafovska")i.boja=defBoja();if(kindOf(sg.tip)==="opsiv"&&i.um!=="m"){const d=num(i.duzina);if(d>=50)i.duzina=mTxt(d/1000);i.um="m"}})});
  $("segs").innerHTML=cur.segments.map((sg,si)=>{const t=segTot(sg),tip=sg.tip;return `<div class="seg" data-s="${si}">
   <div class="row" style="margin-bottom:6px;align-items:flex-end"><span class="dh" data-drag="seg" title="Prevuci grupu za promenu redosleda" style="font-size:22px;padding-bottom:8px">⠿</span><div style="flex:1;min-width:160px"><label>Vrsta grupe</label><select data-st="1" style="font-weight:600">${Object.keys(TIPOVI).map(k=>`<option value="${k}"${k===tip?" selected":""}>${TIPOVI[k]}</option>`).join("")}</select></div><div class="gstw" style="width:150px"><label>Status grupe</label><select data-gst><option value="u_radu"${sg.status!=="zavrsen"?" selected":""}>U radu</option><option value="zavrsen"${sg.status==="zavrsen"?" selected":""}>Završena</option></select></div><span class="tag segbadge" data-sb="${sg.sid}"></span><button class="d" data-delseg${cur.segments.length<2?" disabled":""}>Ukloni grupu</button></div>
   <div class="sc"><table><thead><tr><th>#</th>${(TH[kindOf(tip)]||TH.trapez).map(h=>`<th>${h}</th>`).join("")}<th class="n">Ukupno</th><th></th></tr></thead><tbody>`+
   sg.items.map((it,i)=>`<tr data-i="${i}"><td style="white-space:nowrap"><span class="dh" data-drag="row" title="Prevuci za promenu redosleda">⠿</span>${i+1}.</td>${cells(it,tip)}<td class="n" data-m2>${qtyTxt(it)}</td><td><button class="d" data-del title="Ukloni stavku">✕</button></td></tr>`).join("")+
   `</tbody><tfoot><tr><td colspan="${(TH[kindOf(tip)]||TH.trapez).length}" class="n"><b>Zbir grupe:</b></td><td data-sk><b>${t.k}</b></td><td class="n" data-sm><b>${t.m?fmt(t.m)+" m²":"–"}</b></td><td></td></tr></tfoot></table></div>
   <div class="row" style="margin-top:8px"><button data-add>+ Dodaj stavku</button></div></div>`}).join("");
  renderSheet();applyOrderLock();updSegBadges();
}
function renderSheet(){
  const t=totals(),multi=cur.segments.length>1;
  const CG7='<colgroup><col style="width:44px"><col style="width:20%"><col style="width:12%"><col style="width:16%"><col style="width:15%"><col style="width:8%"><col></colgroup>';
  const CG4='<colgroup><col style="width:44px"><col style="width:38%"><col style="width:20%"><col style="width:12%"><col></colgroup>';
  const parts=cur.segments.map(sg=>{
    const tip=sg.tip||"trapez",K=kindOf(tip),its=sg.items.filter(it=>it.duzina||it.kom||it.sirina);if(!its.length)return"";
    const st=segTot(sg),n=(TH[kindOf(tip)]||TH.trapez).length+2;
    const rows=its.map((it,i)=>{
      if(K==="srafovska")return `<tr><td>${i+1}.</td><td>${esc(it.vrsta)}</td><td>${bj(it.boja)}</td><td>${esc(it.kom)}</td><td>${qtyTxt(it)}</td></tr>`;
      const dv=lenOf(it)?(K==="opsiv"?(num(it.duzina)?mTxt(opsLm(it)):""):esc(it.duzina)):"–";
      const ex=K==="opsiv"?`<td>${esc(it.sirina)}</td>`:K==="oluk"?`<td>${it.jm==="komad"?"komad":"metar"}</td>`:"";
      return `<tr><td>${i+1}.</td><td>${esc(it.vrsta)}</td><td>${dv}</td>${ex}<td>${bj(it.boja)}</td><td>${esc(it.kom)}</td><td>${qtyTxt(it)}</td></tr>`}).join("");
    const cg=K==="srafovska"?CG4:(K==="opsiv"||K==="oluk")?CG7:CG;
    return `<div class="sg"><div class="st">${TIPOVI[tip]}</div><table>${cg}<thead><tr><th>#</th>${(TH[kindOf(tip)]||TH.trapez).map(h=>`<th>${h}</th>`).join("")}<th>Ukupno</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="${n-2}" style="text-align:right">${multi?"Zbir:":"UKUPNO:"}</td><td>${st.k}</td><td>${st.m?fmt(st.m)+" m²":"–"}</td></tr></tfoot></table></div>`}).join("");
  $("sheet").innerHTML=wf(`<div class="bn"><div><h2>Limarija WD-36</h2><div class="ad"><b>Miloš Spasić PR Kovačka radionica WD-36</b><br>Lole Ribara 40, 25250 Odžaci<br>PIB: 110029026 · MB: 64594940<br>Tekući račun: 325-9500600059441-13</div></div></div><div class="bd">
  <div class="hd"><div style="flex:2"><span>Radni nalog</span><b class="no">${esc(cur.no)}/${esc(cur.year)}</b><span style="margin-top:10px">Datum</span><b>${fmtDate(cur.date)}</b></div><div style="flex:3"><span>Kupac</span><b>${esc(cur.customer)}</b>${custLine(cur.addr,cur.phone,cur.pib)}</div></div>
  ${parts}
  ${multi?`<table class="sg gt ns">${CG}<tbody><tr><td colspan="4" style="text-align:right;font-weight:700">UKUPNO (sve grupe):</td><td style="font-weight:700">${t.k}</td><td style="font-weight:700">${t.m?fmt(t.m)+" m²":"–"}</td></tr></tbody></table>`:""}
  ${cur.note?`<div class="nt"><b>Napomena:</b> ${esc(cur.note)}</div>`:""}</div>`);
}
function syncHead(){
  cur.no=parseInt($("fNo").value)||0;cur.year=parseInt($("fYr").value)||new Date().getFullYear();
  cur.customer=$("fCust").value;cur.addr=$("fAddr").value;cur.phone=$("fPhone").value;cur.pib=$("fPib").value;cur.date=$("fDate").value;cur.status=$("fSt").value;cur.note=$("fNote").value;
}
function openForm(o,isNew){
  cur=JSON.parse(JSON.stringify(o));cur._new=isNew;dirty=false;
  if(!cur.segments)cur.segments=[{tip:"trapez",items:cur.items||[blank(null,"trapez")]}];cur.segments.forEach((sg,i)=>{sg.tip=sg.tip||"trapez";if(!sg.sid&&!isNew)sg.sid="s"+i});delete cur.items;
  $("fNo").value=cur.no;$("fYr").value=cur.year;$("fCust").value=cur.customer;$("fAddr").value=cur.addr||"";$("fPhone").value=cur.phone||"";$("fPib").value=cur.pib||"";$("fDate").value=cur.date;$("fSt").value=cur.status;$("fNote").value=cur.note||"";
  $("btnDel").classList.toggle("hide",isNew);$("btnCopy").classList.toggle("hide",isNew);$("status").textContent="";
  $("list").classList.add("hide");$("view").classList.remove("hide");$("btnNew").classList.add("hide");
  renderItems();applyOrderLock();window.scrollTo(0,0);
}
async function closeForm(){
  if(cur&&cur._pro){if(dirty&&!(await ask("Ima nesačuvanih izmena. Napustiti predračun?")))return;cur=null;dirty=false;$("view").appendChild($("sheetbox"));show("pl");return}
  if(dirty&&!(await ask("Ima nesačuvanih izmena. Napustiti nalog?")))return;
  cur=null;$("view").classList.add("hide");$("list").classList.remove("hide");$("btnNew").classList.remove("hide");renderList();
}

/* ---------- događaji ---------- */
$("btnNew").onclick=()=>openForm(newOrder(),true);
$("btnBack").onclick=closeForm;
$("list").addEventListener("click",e=>{
  const th=e.target.closest("th[data-sort]");if(!th)return;
  const k=th.dataset.sort;
  if(k===sortKey)sortDir=-sortDir;else{sortKey=k;sortDir=(k==="kupac"||k==="status")?1:-1}
  renderList();
});
$("q").oninput=renderList;$("fy").onchange=renderList;$("fm").onchange=renderList;$("fv").onchange=renderList;
$("tb").onclick=async e=>{
  const tr=e.target.closest("tr[data-id]");if(!tr)return;const o=orders.find(x=>oid(x)===tr.dataset.id);if(!o)return;
  if(e.target.dataset.copyo!==undefined){copyOrder(o);return}
  if(e.target.dataset.delo!==undefined){
    if(isOrderLocked(o)){$("empty").textContent="Nalog je zaključan (izdata otpremnica).";return}
    if(!(await ask("Trajno obrisati radni nalog "+o.no+"/"+o.year+" ("+o.customer+")?")))return;
    try{await db.collection("orders").doc(oid(o)).delete()}catch(x){$("empty").textContent="Brisanje nije uspelo."}
    return;
  }
  openForm(o,false);
};
$("fSt").addEventListener("input",()=>{if(!cur)return;const v=$("fSt").value;cur.segments.forEach(z=>{z.status=v==="u_radu"?"u_radu":"zavrsen"});document.querySelectorAll("#segs [data-gst]").forEach((el,i)=>{if(cur.segments[i])el.value=cur.segments[i].status})});
["fNo","fYr","fCust","fAddr","fPhone","fPib","fDate","fSt","fNote"].forEach(id=>$(id).addEventListener("input",()=>{syncHead();dirty=true;renderSheet()}));
$("btnSeg").onclick=()=>{const l=cur.segments[cur.segments.length-1];cur.segments.push({tip:"trapez",items:[blank(l.items[l.items.length-1],"trapez")]});dirty=true;renderItems()};
$("segs").addEventListener("change",e=>{
  const seg=e.target.closest(".seg");if(!seg||e.target.dataset.f!=="duzina")return;const sg=cur.segments[+seg.dataset.s];
  if(kindOf(sg.tip)!=="opsiv")return;const it=sg.items[+e.target.closest("tr[data-i]").dataset.i],v=num(e.target.value);
  const t=v>0?mTxt(v):"";it.um="m";e.target.value=t;e.target.dispatchEvent(new Event("input",{bubbles:true}));
});
$("segs").addEventListener("input",async e=>{
  const seg=e.target.closest(".seg");if(!seg)return;const sg=cur.segments[+seg.dataset.s];
  if(e.target.dataset.gst!==undefined){sg.status=e.target.value;dirty=true;if(cur.status!=="isporucen"){cur.status=cur.segments.every(z=>z.status==="zavrsen")?"zavrsen":"u_radu";$("fSt").value=cur.status}renderSheet();return}
  if(e.target.dataset.st){
    const nt=e.target.value;
    if(sg.items.some(i=>i.duzina||i.kom)&&!(await ask("Promena vrste grupe briše unete stavke u ovoj grupi. Nastaviti?"))){e.target.value=sg.tip;return}
    sg.tip=nt;sg.items=[blank(null,nt)];dirty=true;renderItems();return;
  }
  const tr=e.target.closest("tr[data-i]");if(!tr||!e.target.dataset.f)return;dirty=true;
  const it=sg.items[+tr.dataset.i],f=e.target.dataset.f;it[f]=e.target.value;
  if(f==="vrsta"||f==="jm"){renderItems();return}
  tr.querySelector("[data-m2]").textContent=qtyTxt(it);
  const t=segTot(sg);seg.querySelector("[data-sk]").innerHTML="<b>"+t.k+"</b>";seg.querySelector("[data-sm]").innerHTML="<b>"+(t.m?fmt(t.m)+" m²":"–")+"</b>";
  renderSheet();
});
let drag=null;
function dragClear(){if(!drag)return;drag.list.forEach(x=>x.classList.remove("dropb","dropa"));drag.el.style.opacity="";drag=null}
$("segs").addEventListener("pointerdown",e=>{
  const h=e.target.closest("[data-drag]");if(!h)return;e.preventDefault();if(cur&&!cur._new&&isOrderLocked(cur))return;
  const kind=h.dataset.drag,seg=h.closest(".seg"),si=+seg.dataset.s,el=kind==="row"?h.closest("tr"):seg;
  const list=kind==="row"?[...seg.querySelectorAll("tbody tr[data-i]")]:[...$("segs").querySelectorAll(":scope>.seg")];
  drag={kind,si,el,list,from:kind==="row"?+el.dataset.i:si,pos:null};
  el.style.opacity=".45";try{h.setPointerCapture(e.pointerId)}catch(x){}
});
$("segs").addEventListener("pointermove",e=>{
  if(!drag)return;
  const y=e.clientY;let pos=0;
  drag.list.forEach(x=>{const r=x.getBoundingClientRect();if(y>r.top+r.height/2)pos++});
  drag.list.forEach(x=>x.classList.remove("dropb","dropa"));
  if(pos<drag.list.length)drag.list[pos].classList.add("dropb");else drag.list[drag.list.length-1].classList.add("dropa");
  drag.pos=pos;
  if(y<70)window.scrollBy(0,-14);else if(y>window.innerHeight-70)window.scrollBy(0,14);
});
$("segs").addEventListener("pointerup",e=>{
  if(!drag)return;const d=drag;dragClear();
  if(d.pos==null)return;
  const to=d.pos>d.from?d.pos-1:d.pos;if(to===d.from)return;
  const arr=d.kind==="row"?cur.segments[d.si].items:cur.segments;
  const m=arr.splice(d.from,1)[0];arr.splice(to,0,m);dirty=true;renderItems();
});
$("segs").addEventListener("pointercancel",dragClear);
$("segs").addEventListener("click",async e=>{
  const seg=e.target.closest(".seg");if(!seg)return;const si=+seg.dataset.s,sg=cur.segments[si],d=e.target.dataset;
  if(d.add!==undefined){sg.items.push(blank(sg.items[sg.items.length-1],sg.tip));dirty=true;renderItems()}
  else if(d.del!==undefined){sg.items.splice(+e.target.closest("tr").dataset.i,1);if(!sg.items.length)sg.items.push(blank(null,sg.tip));dirty=true;renderItems()}
  else if(d.delseg!==undefined&&cur.segments.length>1&&await ask("Ukloniti celu grupu?")){cur.segments.splice(si,1);dirty=true;renderItems()}
});

function mkSegments(){return cur.segments.map(sg=>{
    const items=sg.items.filter(it=>it.vrsta&&(num(it.kom)>0)&&(lenOf(it)?num(it.duzina)>0:true)&&(kindOf(sg.tip)!=="opsiv"||num(it.sirina)>0)).map(it=>({vrsta:it.vrsta,tip:sg.tip,duzina:kindOf(sg.tip)==="opsiv"?r2(opsLm(it)):num(it.duzina),...(kindOf(sg.tip)==="opsiv"?{um:"m"}:{}),sirina:num(it.sirina),boja:it.boja||"",kom:num(it.kom),jm:rowUnit(it),m2:r2(rowM2(it))}));
    return{tip:sg.tip,title:TIPOVI[sg.tip],sid:sg.sid||newSid(),status:sg.status||"u_radu",items,totalKom:cntK(items),totalM2:sumM(items)};
  }).filter(sg=>sg.items.length)}
async function save(){
  if(cur&&cur._pro)return saveProDraft();
  if(!db){$("status").textContent="Baza nije dostupna.";return false}
  syncHead();
  if(!cur.no||!cur.customer.trim()){$("status").textContent="Unesi broj naloga i kupca.";return false}
  const segments=mkSegments();
  if(!segments.length){$("status").textContent="Dodaj bar jednu stavku sa dužinom i brojem komada.";return false}
  const dropped=cur.segments.reduce((n,sg)=>n+sg.items.length,0)-segments.reduce((n,sg)=>n+sg.items.length,0);
  const id=oid(cur);
  if(cur._new&&orders.some(o=>oid(o)===id)){$("status").textContent="Nalog "+cur.no+"/"+cur.year+" već postoji – promeni broj.";return false}
  const flat=segments.flatMap(sg=>sg.items.map(i=>({...i,segment:sg.title})));
  const now=new Date().toISOString();
  const doc={no:cur.no,year:cur.year,customer:cur.customer.trim(),addr:(cur.addr||"").trim(),phone:(cur.phone||"").trim(),pib:(cur.pib||"").trim(),date:cur.date,status:cur.status,note:cur.note||"",segments,items:flat,
    totalKom:cntK(flat),totalM2:sumM(flat),updatedAt:now,createdAt:cur._new?now:((orders.find(o=>oid(o)===id)||{}).createdAt||now)};
  try{await db.collection("orders").doc(id).set(doc);custSync(doc);cur._new=false;dirty=false;if(dropped>0){dirty=true}else cur.segments=segments.map(sg=>({tip:sg.tip,sid:sg.sid,status:sg.status,items:sg.items.map(i=>({vrsta:i.vrsta,tip:sg.tip,duzina:i.duzina||"",um:i.um,sirina:i.sirina||"",boja:i.boja,kom:i.kom,jm:i.jm}))}));renderItems();$("btnDel").classList.remove("hide");$("status").textContent=dropped>0?"Sačuvano, ali "+dropped+" nepotpunih redova NIJE sačuvano (nedostaje vrsta, dužina ili količina) – ostali su u formi, dopuni ih i sačuvaj ponovo.":"Sačuvano ✓";lastDoc=doc;try{const d=await syncProformas(doc);if(d.length)$("status").textContent="Sačuvano ✓ – ažuriran i predračun "+d.join(", ")}catch(e){}return true}
  catch(e){$("status").textContent="Greška pri čuvanju: "+(e.message||e.code||"nepoznata");return false}
}

