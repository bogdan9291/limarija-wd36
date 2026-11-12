/* ---------- predračun bez radnog naloga ---------- */
function newProDraft(){const y=new Date().getFullYear();return{id:null,no:nextPro(y),year:y,customer:"",addr:"",phone:"",pib:"",date:new Date().toISOString().slice(0,10),status:"u_radu",note:"",segments:[{tip:"trapez",items:[blank(null,"trapez")]}],_pro:true,pdv:pdvRate,uplate:[],lines:[]}}
function openProDraft(d,isNew){d._pro=true;$("view").appendChild($("sheetbox"));openForm(d,isNew);show("o");if(isNew)$("status").textContent=""}
const editSegs=a=>(a||[]).map(g=>({tip:g.tip||"trapez",sid:g.sid||newSid(),status:"u_radu",items:(g.items||[]).map(i=>({vrsta:i.vrsta,tip:g.tip||"trapez",duzina:i.duzina||"",sirina:i.sirina||"",boja:i.boja||"",kom:i.kom,jm:i.jm}))}));
async function saveProDraft(){
  const S=$("status");if(!db){S.textContent="Baza nije dostupna.";return false}
  syncHead();
  if(!cur.no||!cur.customer.trim()){S.textContent="Unesi broj predračuna i kupca.";return false}
  const segments=mkSegments();
  if(!segments.length){S.textContent="Dodaj bar jednu stavku sa dužinom i brojem komada.";return false}
  if(cur._origId&&cur._origId!==cur.year+"_"+cur.no){S.textContent="Broj predračuna ne može da se menja ("+cur._origId.replace("_","/")+").";return false}
  if(cur._new&&proformas.some(p=>p.year===cur.year&&p.no===cur.no)){S.textContent="Predračun "+cur.no+"/"+cur.year+" već postoji – promeni broj.";return false}
  const droppedP=cur.segments.reduce((n,sg)=>n+sg.items.length,0)-segments.reduce((n,sg)=>n+sg.items.length,0);
  const flat=segments.flatMap(sg=>sg.items),old=cur.lines||[],used=new Set();
  const take=(v,b)=>{let k=old.findIndex((l,i)=>!used.has(i)&&l.vrsta===v&&(l.boja||"")===(b||""));if(k<0)k=old.findIndex((l,i)=>!used.has(i)&&l.vrsta===v);if(k>=0)used.add(k);return k>=0?old[k]:null};
  const lines=flat.map(i=>{const o=take(i.vrsta,i.boja),pr=o&&cn(o)>0?o.cena:priceFor(i.vrsta),cena=pr==null?"":pr;return{vrsta:i.vrsta,boja:i.boja||"",duzina:i.duzina,kom:i.kom,m2:i.m2,jm:i.jm||"m²",cena:cn({cena}),iznos:0}});
  const rate=cur.pdv==null||cur.pdv===""?pdvRate:(parseFloat(String(cur.pdv).replace(",","."))||0),kup=kupacOf({kupac:cur.kupac,pib:cur.pib});
  lines.forEach(l=>{l.iznos=lineAmt(l,rate,kup)});
  const kc=calcPro(lines,rate,kup),uplate=cur.uplate||[],paid=payTotal({uplate}),now=new Date().toISOString(),ex=proformas.find(p=>p.year===cur.year&&p.no===cur.no);
  const doc={no:cur.no,year:cur.year,orderId:"",orderNo:"",customer:cur.customer.trim(),addr:(cur.addr||"").trim(),phone:(cur.phone||"").trim(),pib:(cur.pib||"").trim(),kupac:kup,date:cur.date,note:cur.note||"",pdv:rate,placeno:paid,ostalo:r2(kc.t-paid),uplate,lines,osnovica:kc.b,pdvIznos:kc.p,ukupno:kc.t,segments,samostalan:true,createdAt:ex?ex.createdAt:now,updatedAt:now};
  try{await db.collection("proformas").doc(doc.year+"_"+doc.no).set(doc);custSync(doc)}
  catch(e){S.textContent="Greška pri čuvanju: "+(e.message||e.code||"nepoznata");return false}
  cur=null;dirty=false;openPro(doc);$("pstatus").textContent=droppedP>0?"Sačuvano, ali "+droppedP+" nepotpunih redova NIJE sačuvano (nedostaje vrsta, dužina ili količina). Klikni „Izmeni stavke“ da ih dopuniš.":"Stavke sačuvane ✓ – proveri cene.";return true;
}
async function syncProformas(doc){
  const id=oid(doc),done=[];
  for(const q of proformas.filter(x=>x.orderId===id&&!isProLocked(x))){
    const used=new Set(),old=q.lines||[];
    const take=(v,b)=>{let k=old.findIndex((l,i)=>!used.has(i)&&l.vrsta===v&&(l.boja||"")===(b||""));if(k<0)k=old.findIndex((l,i)=>!used.has(i)&&l.vrsta===v);if(k>=0)used.add(k);return k>=0?old[k]:null};
    const lines=(doc.items||[]).map(i=>{const o=take(i.vrsta,i.boja);const pr=o&&cn(o)>0?o.cena:priceFor(i.vrsta);const cena=pr==null?"":pr;
      return{vrsta:i.vrsta,boja:i.boja||"",duzina:i.duzina,kom:i.kom,m2:i.m2,jm:i.jm||"m²",cena:cn({cena}),iznos:0}});
    const rate=parseFloat(String(q.pdv).replace(",","."))||0,kup=kupacOf(q);lines.forEach(l=>{l.iznos=lineAmt(l,rate,kup)});
    const kc=calcPro(lines,rate,kup),b=kc.b,pv=kc.p,tot=kc.t,paid=r2(num(q.placeno));
    const nd={...q,customer:doc.customer,addr:doc.addr,phone:doc.phone,pib:doc.pib,lines,osnovica:b,pdvIznos:pv,ukupno:tot,placeno:paid,ostalo:r2(tot-paid),updatedAt:new Date().toISOString()};
    try{await db.collection("proformas").doc(q.year+"_"+q.no).set(nd);done.push(q.no+"/"+q.year)}catch(e){}
  }
  return done;
}
$("btnSave").onclick=save;
$("btnDel").onclick=async()=>{
  if(!(await ask("Trajno obrisati nalog "+cur.no+"/"+cur.year+"?")))return;
  try{await db.collection("orders").doc(oid(cur)).delete();dirty=false;closeForm()}catch(e){$("status").textContent="Brisanje nije uspelo."}
};
function buildPrintPages(){
  const H=1120,wrap=document.createElement("div");
  wrap.style.cssText="position:absolute;left:-10000px;top:0;width:794px;background:#fff";
  const cl=$("sheet").cloneNode(true);cl.style.cssText="width:794px;max-width:794px;border:0;margin:0";
  wrap.appendChild(cl);document.body.appendChild(wrap);
  try{
    const ft=cl.querySelector(".sfoot"),sg=cl.querySelector(".sigblock");
    let fh=0,sh=0;
    if(ft){ft.style.marginTop="0";fh=ft.offsetHeight}
    if(sg){sg.style.marginTop="0";sh=sg.offsetHeight}
    if(ft)ft.remove();if(sg)sg.remove();
    const base=cl.getBoundingClientRect().top,cuts=[];
    cl.querySelectorAll("tbody tr,tfoot tr,.sg,.hd,.bn,.nt").forEach(el=>{if(el.tagName==="TR"&&el.closest(".ns"))return;cuts.push(Math.round(el.getBoundingClientRect().bottom-base))});
    const total=Math.ceil(cl.getBoundingClientRect().height),bottom=H-fh-12,limit=bottom-10,pages=[];let y=0;
    while(y<total-1){
      const top=pages.length?24:0,avail=limit-top;let end=Math.min(total,y+avail);
      if(end<total){const c=cuts.filter(v=>v>y+40&&v<=end);if(c.length)end=Math.max(...c)}
      else if(sg&&top+(total-y)+sh+20>limit){const c=cuts.filter(v=>v>y+40&&v<total-5);if(c.length)end=Math.max(...c)}
      pages.push({y,end,top});y=end;
    }
    if(!pages.length)pages.push({y:0,end:total,top:0});
    if(sg){const L=pages[pages.length-1];if(L.top+(L.end-L.y)+sh+20>limit)pages.push({y:total,end:total,top:24})}
    let root=$("prtRoot");if(!root){root=document.createElement("div");root.id="prtRoot";document.body.appendChild(root)}
    root.innerHTML="";
    pages.forEach((pg,i)=>{
      const box=document.createElement("div");box.className="pbox";
      const win=document.createElement("div");win.className="pwin";win.style.cssText="top:"+pg.top+"px;height:"+(pg.end-pg.y)+"px";
      const inner=cl.cloneNode(true);inner.style.cssText="position:absolute;left:0;width:794px;max-width:794px;border:0;margin:0;top:"+(-pg.y)+"px";
      win.appendChild(inner);box.appendChild(win);
      if(ft){const f=ft.cloneNode(true);const w=document.createElement("div");w.id="sheet";w.style.cssText="position:absolute;left:0;width:794px;max-width:794px;border:0;margin:0;padding:0;overflow:visible;background:none;top:"+bottom+"px";f.style.cssText="margin:0";w.appendChild(f);box.appendChild(w)}
      if(sg&&i===pages.length-1){const g=sg.cloneNode(true);const w=document.createElement("div");w.id="sheet";w.style.cssText="position:absolute;left:0;width:794px;max-width:794px;border:0;margin:0;padding:0;overflow:visible;background:none;top:"+(bottom-sh-20)+"px";g.style.cssText=(sg.getAttribute("style")||"")+";margin:0 40px";w.appendChild(g);box.appendChild(w)}
      if(pages.length>1){const n=document.createElement("div");n.className="pnum";n.style.top=(H-13)+"px";n.textContent="Strana "+(i+1)+" / "+pages.length;box.appendChild(n)}
      root.appendChild(box);
    });
    return root;
  }finally{wrap.remove()}
}
function printSheet(prep,S){
  try{if(prep)prep()}catch(e){}
  if(!$("sheet").innerHTML.trim()){if(S)S.textContent="Nema dokumenta za štampu.";return}
  let root;try{root=buildPrintPages()}catch(e){if(S)S.textContent="Priprema štampe nije uspela: "+(e.message||e);return}
  document.body.classList.add("prt2");
  const done=()=>{document.body.classList.remove("prt2");if(root)root.innerHTML="";window.removeEventListener("afterprint",done)};
  window.addEventListener("afterprint",done);
  setTimeout(()=>{try{window.print()}catch(e){done();if(S)S.textContent="Štampa nije dostupna u ovom prikazu – koristi „Preuzmi PDF“."}},80);
}
(function(){const sh=$("sheet");if(!sh||!window.MutationObserver)return;const f=()=>{const n=[...sh.querySelectorAll("tbody tr")].filter(r=>!r.closest(".ns")).length;sh.classList.toggle("dense",n>18)};new MutationObserver(f).observe(sh,{childList:true,subtree:true});f()})();
$("btnPrint").onclick=()=>printSheet(()=>{syncHead();renderSheet()},$("status"));
$("btnPdf").onclick=()=>{syncHead();renderSheet();pdfOf("Radni_nalog_"+cur.no+"-"+cur.year+"_"+cur.customer.trim().replace(/\s+/g,"_")+".pdf",$("status"))};

