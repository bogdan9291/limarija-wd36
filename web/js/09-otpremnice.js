/* ---------- otpremnice ---------- */
const today=()=>new Date().toISOString().slice(0,10);
function nextOtp(y){const n=otpr.filter(p=>p.year===y).map(p=>p.no);return(n.length?Math.max(...n):0)+1}
const dzTxt=(d,jm)=>{const n=num(d);if(!n)return"";return n+(jm==="metar"?" m":jm==="m²"?" mm":"")};
const qf=(q,jm)=>((jm==="komad"||jm==="set")&&Number.isInteger(q)?String(q):fmt(q))+" "+(jm||"m²");
function aggLines(raw,wp){
  const m=new Map();
  raw.forEach(l=>{const k=[String(l.vrsta).trim().toLowerCase(),String(l.boja||"").toLowerCase(),l.jm,wp?cn(l):""].join("|");if(m.has(k))m.get(k).push(l);else m.set(k,[l])});
  return [...m.values()].map(a=>{if(a.length===1)return a[0];const f=a[0];return{vrsta:f.vrsta,duzina:"",boja:f.boja,kom:a.reduce((t,l)=>t+num(l.kom),0),kolicina:r2(a.reduce((t,l)=>t+num(l.kolicina),0)),jm:f.jm,cena:f.cena}});
}
const delKey=l=>[nrm(l.vrsta),nrm(l.boja),l.jm||"m²"].join("|");
const orderItems=o=>(o.items&&o.items.length)?o.items:(o.segments||[]).flatMap(sg=>(sg.items||[]).map(i=>({...i,tip:i.tip||sg.tip})));
function ordSegs(o){
  const segs=(o.segments&&o.segments.length)?o.segments:[{tip:"trapez",items:o.items||[]}];
  return segs.map((sg,si)=>{const tip=sg.tip||"trapez";
    const base=aggLines((sg.items||[]).filter(i=>i&&String(i.vrsta||"").trim()).map(i=>{const q=Number.isFinite(Number(i.m2))&&i.m2!==""&&i.m2!=null?num(i.m2):r2(rowM2({...i,tip:i.tip||tip}));return{vrsta:i.vrsta+(kindOf(i.tip||tip)==="opsiv"&&i.sirina?" (RŠ "+i.sirina+" mm)":""),duzina:kindOf(i.tip||tip)==="opsiv"?(num(i.duzina)?mTxt(opsLm(i))+" m":""):dzTxt(i.duzina,i.jm),boja:i.boja||"",kom:i.kom,kolicina:q,jm:i.jm||rowUnit({...i,tip:i.tip||tip})}}));
    return{sid:sg.sid||"s"+si,tip,title:TIPOVI[tip]||sg.title||"Grupa",prod:sg.status||(o.status==="u_radu"?"u_radu":"zavrsen"),base}});
}
const orderBase=o=>ordSegs(o).flatMap(g=>g.base);
function deliveredIdx(excl,plus){
  const m={};
  const add=(id,l)=>{if(!id)return;let sid=l.sid;
    if(!sid){const o=orders.find(z=>oid(z)===id);if(o){const k=delKey(l),g=ordSegs(o).find(z=>z.base.some(b=>delKey(b)===k));sid=g?g.sid:"?"}else sid="?"}
    const k=id+"|"+sid+"|"+delKey(l),t=m[k]=m[k]||{kom:0,q:0};t.kom+=num(l.kom);t.q+=num(l.kolicina)};
  otpr.forEach(x=>{if(excl&&x.year+"_"+x.no===excl)return;(x.lines||[]).forEach(l=>add(lineOid(x,l),l))});
  (plus||[]).forEach(l=>{if(String(l.vrsta||"").trim())add(l.oid||"",l)});
  return m;
}
function segRem(g,id,idx){
  const lines=[];let tot=0,del=0;
  g.base.forEach(l=>{const d=idx[id+"|"+g.sid+"|"+delKey(l)]||{kom:0,q:0},q=r2(num(l.kolicina)-d.q);tot+=num(l.kolicina);del+=Math.min(num(l.kolicina),d.q);
    if(q>0.005){const k=l.kom===""||l.kom==null?"":Math.max(0,num(l.kom)-d.kom);lines.push({...l,oid:id,sid:g.sid,seg:g.title,kom:k,kolicina:q})}});
  return{lines,tot:r2(tot),del:r2(del)};
}
function orderDeliv(o,excl,plus){const idx=deliveredIdx(excl,plus),id=oid(o);return ordSegs(o).map(g=>({...g,...segRem(g,id,idx)}))}
function remainingSum(o,plus,excl){return r2(orderDeliv(o,excl,plus).reduce((t,g)=>t+g.lines.reduce((a,l)=>a+num(l.kolicina),0),0))}
function remainingLines(base,orderId,excl){
  if(!orderId)return{lines:base,done:false,had:false};
  const idx=deliveredIdx(excl),pre=orderId+"|",sum={};
  Object.keys(idx).forEach(k=>{if(k.startsWith(pre)){const dk=k.split("|").slice(2).join("|"),t=sum[dk]=sum[dk]||{kom:0,q:0};t.kom+=idx[k].kom;t.q+=idx[k].q}});
  const had=Object.keys(sum).length>0;if(!had)return{lines:base.map(l=>({...l,oid:orderId})),done:false,had:false};
  const lines=[];base.forEach(l=>{const d=sum[delKey(l)]||{kom:0,q:0},q=r2(num(l.kolicina)-d.q);if(q>0.005){const k=l.kom===""||l.kom==null?"":Math.max(0,num(l.kom)-d.kom);lines.push({...l,oid:orderId,kom:k,kolicina:q})}});
  return{lines,done:!lines.length,had:true};
}
const hasOtpFor=o=>otpr.some(x=>otpOrderIds(x).has(oid(o)));
const segTag=o=>{const g=ordSegs(o);if(g.length<2||o.status==="isporucen")return"";const n=g.filter(z=>z.prod==="zavrsen").length;return(n>0&&n<g.length)?' <span class="tag u_radu">'+n+'/'+g.length+' grupa završeno</span>':""};
const partTag=o=>((o.status!=="isporucen"&&hasOtpFor(o)&&remainingSum(o)>0.005)?' <span class="tag zavrsen">delimično otpremljen</span>':"")+segTag(o);
function otpFromOrder(o,sids){
  const y=new Date().getFullYear(),id=oid(o),ds=orderDeliv(o,null),open=ds.filter(g=>g.lines.length);
  const pick=sids?open.filter(g=>sids.includes(g.sid)):(open.length===1?open:[]);
  return{_new:true,no:nextOtp(y),year:y,izvorTip:"nalog",izvorId:id,izvor:"",orderId:id,customer:o.customer,addr:o.addr||"",phone:o.phone||"",pib:o.pib||"",date:today(),note:"",_partial:ds.some(g=>g.del>0.005),_allDone:!open.length,_pick:(!sids&&open.length>1)?id:"",lines:pick.flatMap(g=>g.lines.map(l=>({...l,onum:o.no+"/"+o.year})))};
}
function otpFromPro(q){
  const y=new Date().getFullYear(),base=aggLines((q.lines||[]).map(l=>({vrsta:l.vrsta,duzina:dzTxt(l.duzina,l.jm),boja:l.boja||"",kom:l.kom,kolicina:l.m2,jm:l.jm||"m²"}))),r=remainingLines(base,q.orderId||"",null);
  return{_new:true,no:nextOtp(y),year:y,izvorTip:"predracun",izvorId:q.year+"_"+q.no,izvor:"Predračun "+q.no+"/"+q.year,orderId:q.orderId||"",customer:q.customer,addr:q.addr||"",phone:q.phone||"",pib:q.pib||"",date:today(),note:"",_partial:r.had,_allDone:r.done,lines:r.lines};
}
function updateDeliv(){
  const box=$("oDeliv"),ids=[...new Set(ocur.lines.filter(l=>l.oid&&String(l.vrsta).trim()).map(l=>l.oid))];
  const key=ocur._new?null:ocur.year+"_"+ocur.no,idx=deliveredIdx(key,null),html=[];
  ids.forEach(id=>{const o=orders.find(x=>oid(x)===id);if(!o)return;let ord=0,prev=0;
    ordSegs(o).forEach(g=>g.base.forEach(l=>{const d=idx[id+"|"+g.sid+"|"+delKey(l)]||{q:0};ord+=num(l.kolicina);prev+=Math.min(num(l.kolicina),d.q)}));
    const now=ocur.lines.filter(l=>l.oid===id&&String(l.vrsta).trim()).reduce((t,l)=>t+num(l.kolicina),0),rest=Math.max(0,r2(ord-prev-now));
    html.push("Isporuka po nalogu <b>"+o.no+"/"+o.year+"</b>: naručeno "+fmt(ord)+" · ranije isporučeno "+fmt(prev)+" · ovom otpremnicom "+fmt(now)+" · <b>preostalo "+fmt(rest)+"</b>"+(rest<=0.005?" – nalog je u celosti isporučen.":""))});
  if(!html.length&&!(ocur._allDone&&ocur._new)){box.classList.add("hide");return}
  box.classList.remove("hide");
  box.innerHTML=html.join("<br>")+(ocur._allDone&&ocur._new?(html.length?"<br>":"")+"Sve je već isporučeno – dodaj stavke ručno ako treba.":"");
}
function openOtp(o){
  ocur=JSON.parse(JSON.stringify(o));odirty=false;cur=null;dirty=false;pcur=null;pdirty=false;
  ocur.lines.forEach(l=>{if(!l.oid&&ocur.orderId)l.oid=ocur.orderId});
  $("oview").appendChild($("sheetbox"));
  $("oNo").value=ocur.no;$("oYr").value=ocur.year;$("oCust").value=ocur.customer;$("oAddr").value=ocur.addr||"";$("oPhone").value=ocur.phone||"";$("oPib").value=ocur.pib||"";$("oDate").value=ocur.date;$("oNote").value=ocur.note||"";
  $("oCene").value=ocur.cene?"1":"0";$("oCeneBox").classList.toggle("hide",ROLE!=="vlasnik");
  $("oNo").disabled=$("oYr").disabled=!ocur._new;$("oDel").classList.toggle("hide",!!ocur._new);$("ostatus").textContent="";
  show("ov");renderOtp();
  if(ocur._pick){pickAll=ocur._pick==="*";renderPick(ocur._pick==="*"?"":ocur._pick)}else $("oPick").classList.add("hide");
  window.scrollTo(0,0);
}
function onumOf(l){if(l.onum)return l.onum;const o=orders.find(x=>oid(x)===l.oid);return o?o.no+"/"+o.year:String(l.oid||"").replace("_","/")}
function srcLbl(l){return "Nalog "+onumOf(l)+(l.seg?" · "+l.seg:"")}
function refreshIzvor(){
  if(ocur.izvorTip!=="nalog")return;
  const ls=ocur.lines.filter(l=>l.oid);if(!ls.length)return;
  const ns=[...new Set(ls.map(onumOf))];ocur.izvor=(ns.length>1?"Radni nalozi ":"Radni nalog ")+ns.join(", ");ocur.izvorId=ocur.orderId=ls[0].oid;
}
let pickAll=false;
let pickOrd="";
function pickCands(){
  const key=ocur._new?null:ocur.year+"_"+ocur.no,cu=nrm(ocur.customer||"");
  return orders.filter(o=>o.status!=="isporucen"&&(pickAll||!cu||nrm(o.customer)===cu||oid(o)===pickOrd)).sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    .map(o=>({o,gs:orderDeliv(o,key).filter(g=>g.lines.length)})).filter(x=>x.gs.length);
}
function pickGroups(){
  const have=new Set(ocur.lines.filter(l=>l.oid&&l.sid).map(l=>l.oid+"|"+l.sid)),c=pickCands().find(x=>oid(x.o)===pickOrd),sel=$("oPkG");
  if(!c){sel.innerHTML='<option value="">–</option>';return}
  const free=c.gs.filter(g=>!have.has(oid(c.o)+"|"+g.sid)).length;
  const qs=ls=>{const m={};ls.forEach(l=>{const j=l.jm||"m²";m[j]=(m[j]||0)+num(l.kolicina)});return Object.keys(m).map(j=>qf(r2(m[j]),j)).join(" + ")};
  sel.innerHTML=(c.gs.length>1?'<option value="*"'+(free?"":" disabled")+'>Sve neotpremljene grupe ('+free+')</option>':"")+c.gs.map(g=>{const hv=have.has(oid(c.o)+"|"+g.sid),part=g.del>0.005;
    return '<option value="'+esc(g.sid)+'"'+(hv?" disabled":"")+'>'+esc(g.title)+' · '+qs(g.base)+(part?' (preostalo '+qs(g.lines)+')':"")+' · '+(g.prod==="zavrsen"?"proizvedeno":"u radu")+(hv?" (već dodato)":"")+'</option>'}).join("");
  const first=[...sel.options].find(o=>!o.disabled);if(first)sel.value=first.value;
}
function renderPick(focus){
  const box=$("oPick");box.classList.remove("hide");if(focus)pickOrd=focus;
  const c=pickCands();if(!c.some(x=>oid(x.o)===pickOrd))pickOrd=c.length?oid(c[0].o):"";
  box.innerHTML='<div class="row" style="align-items:flex-end"><div style="flex:1;min-width:210px"><label>Nalog</label><select id="oPkO">'+(c.length?c.map(x=>'<option value="'+esc(oid(x.o))+'"'+(oid(x.o)===pickOrd?" selected":"")+'>'+x.o.no+'/'+x.o.year+' – '+esc(x.o.customer)+' ('+fmtDate(x.o.date)+')</option>').join(""):'<option value="">Nema neotpremljenih naloga</option>')+'</select></div>'+
   '<div style="flex:1;min-width:210px"><label>Grupa</label><select id="oPkG"></select></div>'+
   '<button class="p" id="oPickAdd"'+(c.length?"":" disabled")+'>Dodaj</button><button id="oPickAll">'+(pickAll?"Samo isti kupac":"Svi kupci")+'</button><button id="oPickClose">Zatvori</button></div>';
  pickGroups();
}
/* cene na otpremnici: vidi ih samo vlasnik; cena se uzima iz povezanog predračuna, pa iz cenovnika */
const otpC=()=>!!(ocur&&ocur.cene)&&ROLE==="vlasnik";
const otpRate=()=>{const r=parseFloat(String(ocur.pdv??pdvRate).replace(",","."));return isFinite(r)?r:0};
function otpPrice(l){
  const v=nrm(l.vrsta),bj=nrm(l.boja),qs=[];
  if(ocur.izvorTip==="predracun")qs.push(proformas.find(x=>x.year+"_"+x.no===ocur.izvorId));
  if(l.oid)qs.push(...proformas.filter(x=>x.orderId===l.oid));
  for(const q of qs.filter(Boolean)){const ls=q.lines||[],h=ls.find(z=>nrm(z.vrsta)===v&&nrm(z.boja)===bj&&cn(z))||ls.find(z=>nrm(z.vrsta)===v&&cn(z));if(h)return cn(h)}
  return priceFor(l.vrsta);
}
function otpFillPrices(){ocur.lines.forEach(l=>{if(l.cena==null&&String(l.vrsta).trim()){const c=otpPrice(l);l.cena=c==null?"":c}})}
function renderOtp(){
  const C=otpC();if(C)otpFillPrices();
  const pr=otpRate(),on=pr>0?pr:pdvRate;$("oPdvBox").classList.toggle("hide",!C);
  $("oPdv").innerHTML='<option value="'+esc(on)+'">PDV '+esc(on)+'%</option><option value="0">Bez PDV</option>';$("oPdv").value=pr>0?String(on):"0";
  $("ohead").innerHTML="<tr><th>Vrsta robe</th><th>Boja</th><th>Jed.</th><th>Količina</th>"+(C?"<th>Cena (bez PDV)</th>":"")+"<th></th></tr>";
  $("oHint").textContent="Stavke su preuzete iz izvora. Izmeni količinu isporučene robe ili ukloni stavke koje nisu isporučene. "+(C?"Cene su preuzete iz predračuna ili cenovnika. Crveno polje znači da cene nema – upiši je ručno.":"Cene se ne prikazuju.");
  $("olines").innerHTML=ocur.lines.map((l,i)=>`<tr data-i="${i}"><td><input data-of="vrsta" value="${esc(l.vrsta)}" style="min-width:190px">${l.oid?`<div class="osrc">${esc(srcLbl(l))}</div>`:""}</td><td><select data-of="boja">${bopts(["",...BOJE],l.boja||"")}</select></td><td><select data-of="jm">${opts(UNITS.includes(l.jm)?UNITS:[...UNITS,l.jm],l.jm||"m²")}</select></td><td><input data-of="kolicina" inputmode="decimal" value="${esc(l.kolicina)}" style="width:90px"></td>${C?`<td><input data-of="cena" inputmode="decimal" value="${esc(l.cena??"")}" style="width:100px${cn(l)||!String(l.vrsta).trim()?"":";border-color:#c0392b"}"></td>`:""}<td><button class="d" data-odel title="Ukloni stavku">✕</button></td></tr>`).join("");
  oSheet();
}
function oSheet(){
  try{refreshIzvor();updateDeliv()}catch(e){}
  const C=otpC(),rate=otpRate(),fz=false,kup="pravno",R='style="text-align:right"'; /* cene na otpremnici su uvek bez PDV */
  const CG=C?'<colgroup><col style="width:44px"><col style="width:41%"><col style="width:9%"><col style="width:13%"><col style="width:16%"><col></colgroup>':'<colgroup><col style="width:44px"><col style="width:58%"><col style="width:14%"><col></colgroup>';
  const vis=aggLines(ocur.lines.filter(l=>String(l.vrsta).trim()||num(l.kolicina)).map(l=>({...l,vrsta:String(l.vrsta).trim(),jm:l.jm||"m²"})),C);
  const pl=l=>({cena:l.cena,m2:l.kolicina});
  const rows=vis.map((l,i)=>`<tr><td>${i+1}.</td><td>${esc(goodsName(l))}</td><td>${esc(l.jm||"m²")}</td><td>${fmt(num(l.kolicina))}</td>${C?`<td>${money(fz?priceVat(l,rate):cn(l))}</td><td>${money(lineAmt(pl(l),rate,kup))}</td>`:""}</tr>`).join("");
  const tq=r2(vis.reduce((t,l)=>t+num(l.kolicina),0));
  const k=C?calcPro(vis.map(pl),rate,kup):null;
  const tot=vis.length?`<tr><td colspan="3" style="text-align:right"><b>Ukupno:</b></td><td style="text-align:center"><b>${fmt(tq)}</b></td>${C?`<td></td><td style="text-align:center"><b>${money(k.b)}</b></td>`:""}</tr>`:"";
  const sums=C&&vis.length?`<table class="sg ns" style="width:60%;margin-left:auto"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tbody>
  ${rate>0?`<tr><td ${R}>Osnovica (bez PDV):</td><td ${R}>${money(k.b)} RSD</td></tr><tr><td ${R}>PDV (${esc(rate)}%):</td><td ${R}>${money(k.p)} RSD</td></tr>`:""}
  <tr><td style="background:#f1f2f4;color:#000;font-weight:700;text-align:right">${rate>0?"UKUPNO SA PDV:":"UKUPNO (bez PDV):"}</td><td style="background:#f1f2f4;color:#000;font-weight:700;text-align:right">${money(k.t)} RSD</td></tr></tbody></table>`:"";
  const ntx=[ocur.izvor?esc(ocur.izvor):"",ocur.note?esc(ocur.note):""].filter(Boolean).join(" · ");
  const sg='style="width:42%;border-top:1px solid #444;padding-top:4px;text-align:center;font-size:13px"';
  $("sheet").innerHTML=wf(`<div class="bn"><div><h2>Limarija WD-36</h2><div class="ad"><b>Miloš Spasić PR Kovačka radionica WD-36</b><br>Lole Ribara 40, 25250 Odžaci<br>PIB: 110029026 · MB: 64594940<br>Tekući račun: 325-9500600059441-13</div></div></div><div class="bd">
  <div class="hd"><div style="flex:2"><span>Otpremnica</span><b class="no">${esc(ocur.no)}/${esc(ocur.year)}</b><span style="margin-top:10px">Datum</span><b>${fmtDate(ocur.date)}</b></div><div style="flex:3"><span>Kupac</span><b>${esc(ocur.customer)}</b>${custLine(ocur.addr,ocur.phone,ocur.pib)}</div></div>
  <div class="sg"><table>${CG}<thead><tr><th>#</th><th>Vrsta robe</th><th>Jed.</th><th>Količina</th>${C?`<th>${rate>0?"Cena bez PDV":"Cena"}</th><th>Iznos</th>`:""}</tr></thead><tbody>${rows}${tot}</tbody></table></div>
  ${sums}
  ${ntx?`<div class="nt">${ntx}</div>`:""}
  <div class="sigblock" style="display:flex;justify-content:space-between;margin-top:56px"><div ${sg}>Robu izdao</div><div ${sg}>Robu primio</div></div></div>`);
}
$("oPdv").onchange=()=>{ocur.pdv=num($("oPdv").value);odirty=true;oSheet()};
$("oCene").onchange=()=>{ocur.cene=$("oCene").value==="1";if(ocur.cene){if(ocur.pdv==null)ocur.pdv=pdvRate}odirty=true;renderOtp();
  if(ocur.cene&&ocur.lines.some(l=>String(l.vrsta).trim()&&!cn(l)))$("ostatus").textContent="Neke stavke nemaju cenu – upiši je ručno.";else $("ostatus").textContent=""};
["oNo","oYr","oCust","oAddr","oPhone","oPib","oDate","oNote"].forEach(id=>$(id).addEventListener("input",()=>{
  ocur.no=parseInt($("oNo").value)||0;ocur.year=parseInt($("oYr").value)||ocur.year;ocur.customer=$("oCust").value;ocur.addr=$("oAddr").value;ocur.phone=$("oPhone").value;ocur.pib=$("oPib").value;ocur.date=$("oDate").value;ocur.note=$("oNote").value;odirty=true;oSheet();
}));
$("olines").addEventListener("input",e=>{
  const tr=e.target.closest("tr"),f=e.target.dataset.of;if(!tr||!f)return;
  ocur.lines[+tr.dataset.i][f]=e.target.value;odirty=true;if(f==="cena")e.target.style.borderColor=num(e.target.value)>0?"":"#c0392b";oSheet();
});
$("olines").addEventListener("click",e=>{
  if(e.target.dataset.odel===undefined)return;
  ocur.lines.splice(+e.target.closest("tr").dataset.i,1);if(!ocur.lines.length)ocur.lines.push({vrsta:"",duzina:"",boja:"",kom:"",kolicina:"",jm:"komad"});odirty=true;renderOtp();
});
$("oAdd").onclick=()=>{ocur.lines.push({vrsta:"",duzina:"",boja:"",kom:"",kolicina:"",jm:"komad"});odirty=true;renderOtp()};
$("oSave").onclick=async()=>{
  const S=$("ostatus");if(!db)return;
  if(!ocur.no||!ocur.customer.trim()){S.textContent="Unesi broj i kupca.";return}
  if(ocur._new&&otpr.some(x=>x.year===ocur.year&&x.no===ocur.no)){S.textContent="Otpremnica "+ocur.no+"/"+ocur.year+" već postoji – promeni broj.";return}
  const lines=ocur.lines.filter(l=>String(l.vrsta).trim()&&num(l.kolicina)>0);
  if(!lines.length){S.textContent="Dodaj bar jednu stavku sa vrstom robe i količinom.";return}
  const now=new Date().toISOString(),old=otpr.find(x=>x.year===ocur.year&&x.no===ocur.no);
  const doc={no:ocur.no,year:ocur.year,izvorTip:ocur.izvorTip||"",izvorId:ocur.izvorId||"",izvor:ocur.izvor||"",orderId:ocur.orderId||"",customer:ocur.customer.trim(),addr:(ocur.addr||"").trim(),phone:(ocur.phone||"").trim(),pib:(ocur.pib||"").trim(),date:ocur.date,note:ocur.note||"",cene:!!ocur.cene,pdv:ocur.pdv??pdvRate,
   lines:lines.map(l=>({vrsta:String(l.vrsta).trim(),duzina:l.duzina||"",boja:l.boja||"",kom:l.kom===""||l.kom==null?"":num(l.kom),kolicina:num(l.kolicina),jm:l.jm||"m²",oid:l.oid||"",sid:l.sid||"",seg:l.seg||"",onum:l.oid?onumOf(l):"",...(l.cena!=null&&l.cena!==""?{cena:cn(l)}:{})})),createdAt:old?old.createdAt:now,updatedAt:now};
  try{const wasNew=ocur._new;await db.collection("otpremnice").doc(ocur.year+"_"+ocur.no).set(doc);custSync(doc);
    const key=ocur.year+"_"+ocur.no,ids=[...new Set([...doc.lines.map(l=>l.oid),...((old&&old.lines)||[]).map(l=>lineOid(old,l))].filter(Boolean))];
    for(const id of ids){const oo=orders.find(x=>oid(x)===id);if(!oo)continue;
      const ds=orderDeliv(oo,key,doc.lines),full=ds.every(g=>!g.lines.length);
      const segs=oo.segments?oo.segments.map((sg,i)=>({...sg,sid:sg.sid||"s"+i,status:(ds[i]&&ds[i].del>0.005)?"zavrsen":(sg.status||(oo.status==="u_radu"?"u_radu":"zavrsen"))})):oo.segments;
      const ns=full?"isporucen":((oo.status==="u_radu"&&segs&&segs.every(g=>g.status==="zavrsen"))?"zavrsen":(oo.status==="isporucen"?"zavrsen":oo.status));
      if(ns!==oo.status||JSON.stringify(segs)!==JSON.stringify(oo.segments)){try{await db.collection("orders").doc(id).set({...oo,segments:segs,status:ns,updatedAt:now})}catch(e){}}}
    ocur._new=false;odirty=false;$("oNo").disabled=$("oYr").disabled=true;$("oDel").classList.remove("hide");S.textContent="Sačuvano ✓"}
  catch(e){S.textContent="Greška pri čuvanju: "+(e.message||e.code||"nepoznata")}
};
$("oDel").onclick=async()=>{
  if(!(await ask("Trajno obrisati otpremnicu "+ocur.no+"/"+ocur.year+"?")))return;
  try{const dd=ocur;await db.collection("otpremnice").doc(dd.year+"_"+dd.no).delete();await afterOtpDelete(dd);odirty=false;goTab("ol")}catch(e){$("ostatus").textContent="Brisanje nije uspelo."}
};
async function afterOtpDelete(x){
  try{const key=x.year+"_"+x.no;for(const id of otpOrderIds(x)){const oo=orders.find(z=>oid(z)===id);if(oo&&oo.status==="isporucen"&&remainingSum(oo,null,key)>0.005)await db.collection("orders").doc(id).set({...oo,status:"zavrsen",updatedAt:new Date().toISOString()})}}catch(e){}
}
$("oBack").onclick=()=>goTab("ol");
$("oPickBtn").onclick=()=>renderPick("");
$("oPick").addEventListener("change",e=>{
  if(e.target.id==="oPkO"){pickOrd=e.target.value;pickGroups()}
});
$("oPick").addEventListener("click",e=>{
  if(e.target.id==="oPickClose"){$("oPick").classList.add("hide");return}
  if(e.target.id==="oPickAll"){pickAll=!pickAll;renderPick("");return}
  if(e.target.id!=="oPickAdd")return;
  const id=$("oPkO").value,gv=$("oPkG").value,o=orders.find(x=>oid(x)===id);
  if(!o||!gv){$("ostatus").textContent="Izaberi nalog i grupu.";return}
  const key=ocur._new?null:ocur.year+"_"+ocur.no,idx=deliveredIdx(key,null),have=new Set(ocur.lines.filter(l=>l.oid&&l.sid).map(l=>l.oid+"|"+l.sid));
  ocur.lines=ocur.lines.filter(l=>String(l.vrsta).trim()||num(l.kolicina));
  ordSegs(o).filter(g=>(gv==="*"||g.sid===gv)&&!have.has(id+"|"+g.sid)).forEach(g=>segRem(g,id,idx).lines.forEach(l=>ocur.lines.push({...l,onum:o.no+"/"+o.year})));
  if(!String(ocur.customer||"").trim()){ocur.customer=o.customer;ocur.addr=o.addr||"";ocur.phone=o.phone||"";ocur.pib=o.pib||"";$("oCust").value=ocur.customer;$("oAddr").value=ocur.addr;$("oPhone").value=ocur.phone;$("oPib").value=ocur.pib}
  if(!ocur.izvorTip)ocur.izvorTip="nalog";
  odirty=true;$("ostatus").textContent="";renderOtp();renderPick("");
});
$("oNew").onclick=()=>{const y=new Date().getFullYear();openOtp({_new:true,no:nextOtp(y),year:y,izvorTip:"nalog",izvorId:"",izvor:"",orderId:"",customer:"",addr:"",phone:"",pib:"",date:today(),note:"",_pick:"*",lines:[]})};
$("oSrc").onclick=async()=>{
  if(odirty&&!(await ask("Ima nesačuvanih izmena. Napustiti?")))return;
  if(ocur.izvorTip==="nalog"){
    const o=orders.find(x=>oid(x)===ocur.izvorId);if(!ocur.izvorId){$("ostatus").textContent="Otpremnica nema izvorni nalog.";return}if(!o){$("ostatus").textContent="Izvorni nalog nije pronađen.";return}
    ocur=null;odirty=false;$("view").appendChild($("sheetbox"));openForm(o,false);show("o");
  }else{
    const q=proformas.find(x=>x.year+"_"+x.no===ocur.izvorId);if(!q){$("ostatus").textContent="Izvorni predračun nije pronađen.";return}
    ocur=null;odirty=false;openPro(q);
  }
};
async function mailDoc(naziv,d,fname,S,extra){
  await pdfOf(fname,S);if(!/sačuvan/.test(S.textContent))return;
  const to=(custBy(d.customer)||{}).email||"",subj=naziv+" "+d.no+"/"+d.year+" – Limarija WD-36";
  const body="Poštovani,\n\nu prilogu se nalazi "+naziv.toLowerCase()+" br. "+d.no+"/"+d.year+"."+(extra?"\n\n"+extra:"")+"\n\nSrdačan pozdrav,\nKovačka radionica WD-36\nTel: 069/4567-999";
  const url="mailto:"+encodeURIComponent(to).replace(/%40/g,"@")+"?subject="+encodeURIComponent(subj)+"&body="+encodeURIComponent(body);
  S.innerHTML='PDF sačuvan ✓ – priloži ga u mejl. <a href="'+url.replace(/&/g,"&amp;")+'" target="_blank" rel="noopener" style="color:var(--tx);font-weight:600">Otvori mejl →</a>'+(to?"":" (kupac nema e-adresu u adresaru)");
  try{const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";document.body.appendChild(a);a.click();a.remove()}catch(e){}
}
$("pMail").onclick=()=>{const t=proTot();mailDoc("Predračun",pcur,"Predracun_"+pcur.no+"-"+pcur.year+"_"+pcur.customer.trim().replace(/\s+/g,"_")+".pdf",$("pstatus"),"Ukupno za uplatu: "+money(t.t)+" RSD"+(t.paid?" (preostalo: "+money(t.left)+" RSD)":"")+".")};
$("oMail").onclick=()=>mailDoc("Otpremnica",ocur,"Otpremnica_"+ocur.no+"-"+ocur.year+"_"+ocur.customer.trim().replace(/\s+/g,"_")+".pdf",$("ostatus"));
$("oPrint").onclick=()=>printSheet(null,$("ostatus"));
$("oPdf").onclick=()=>pdfOf("Otpremnica_"+ocur.no+"-"+ocur.year+"_"+ocur.customer.trim().replace(/\s+/g,"_")+".pdf",$("ostatus"));
$("btnOtp").onclick=async()=>{
  const was=cur._new||dirty;if(was&&!(await save()))return;
  const o=was?lastDoc:orders.find(x=>oid(x)===oid(cur));
  if(!o||!orderItems(o).length){$("status").textContent="Sačuvaj nalog pa pokušaj ponovo.";return}
  openOtp(otpFromOrder(o));
};
$("pOtp").onclick=()=>{
  if(pcur._new||pdirty){$("pstatus").textContent="Sačuvaj predračun pa napravi otpremnicu.";return}
  openOtp(otpFromPro(pcur));
};
function renderOL(){
  const r=otpr.slice().sort((a,b)=>b.year-a.year||b.no-a.no);
  $("oltb").innerHTML=r.map(o=>`<tr class="cl" data-id="${o.year}_${o.no}"><td>${o.no}/${o.year}</td><td>${fmtDate(o.date)}</td><td>${esc(o.customer)}</td><td>${esc(o.izvor)}</td><td><button class="d" data-delo title="Obriši otpremnicu">✕</button></td></tr>`).join("");
  $("olempty").textContent=r.length?"":"Nema otpremnica. Napravi je iz radnog naloga ili predračuna dugmetom „Otpremnica“.";
}
$("oltb").onclick=async e=>{
  const tr=e.target.closest("tr[data-id]");const o=tr&&otpr.find(x=>x.year+"_"+x.no===tr.dataset.id);if(!o)return;
  if(e.target.dataset.delo!==undefined){
    if(!(await ask("Trajno obrisati otpremnicu "+o.no+"/"+o.year+" ("+o.customer+")?")))return;
    try{await db.collection("otpremnice").doc(o.year+"_"+o.no).delete();await afterOtpDelete(o)}catch(x){$("olempty").textContent="Brisanje nije uspelo."}
    return;
  }
  openOtp(o);
};

