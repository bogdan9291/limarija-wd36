/* ---------- poseban cenovnik za kupca ---------- */
let kpDirty=false;
function kpRows(){ // sve stavke cenovnika sa cenom, po redosledu grupa
  const gk=Object.keys(TIPOVI);
  return prices.filter(p=>num(p.vele)>0).sort((a,b)=>(gk.indexOf(a.grupa||"trapez")-gk.indexOf(b.grupa||"trapez"))||String(a.naziv).localeCompare(String(b.naziv),"sr-Latn"));
}
const kpPct=(std,c)=>std>0&&c>0?Math.round((1-c/std)*10000)/100:"";
const kpTxt=v=>v===""?"":String(v).replace(".",",");
function renderKPrc(){
  const box=$("kPrc");if(!box)return;const c=kcur;if(!c){box.innerHTML="";return}
  const has=c.cene&&Object.keys(c.cene).length;
  if(!has){box.innerHTML=`<div class="stl" style="margin:0 0 8px">Cenovnik kupca</div><div style="color:var(--mu);font-size:13px;margin-bottom:10px">Ovaj kupac koristi standardni cenovnik. Ako mu dajete drugačije cene (npr. rabat), napravi poseban cenovnik – pravi se kopija standardnog, pa menjaš cene ili zadaš procenat rabata.</div><button class="p" id="kpMk">Napravi poseban cenovnik</button>`;return}
  const rows=kpRows(),gs=Object.keys(TIPOVI);
  box.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:8px"><div class="stl" style="margin:0">Cenovnik kupca <span class="tag zavrsen">poseban</span></div><span id="kpMsg" style="font-size:13px;font-weight:600;color:${kpDirty?"var(--rd,#c0392b)":"var(--mu)"}">${kpDirty?"Nesačuvane izmene – klikni „Sačuvaj“ gore.":""}</span></div>
  <div style="color:var(--mu);font-size:13px;margin-bottom:10px">Cene su bez PDV-a. Prazno polje znači da se za tu stavku koristi standardna cena. Važi za nove predračune, otpremnice i obračun prodaje; već izdati dokumenti se ne menjaju.</div>
  <div class="row" style="align-items:flex-end;margin-bottom:10px"><div style="width:120px"><label>Rabat (%)</label><input id="kpR" inputmode="decimal" placeholder="npr. 8"></div><div style="width:200px"><label>Primeni na</label><select id="kpG"><option value="">Sve grupe</option>${gs.map(k=>`<option value="${k}">${esc(TIPOVI[k])}</option>`).join("")}</select></div><button class="p" id="kpAp">Primeni rabat</button><button id="kpStd">Vrati standardni cenovnik</button></div>
  <div class="sc"><table><thead><tr><th>Grupa</th><th>Naziv</th><th>Jm</th><th class="n">Standardna</th><th class="n">Rabat %</th><th class="n">Cena kupca</th></tr></thead><tbody id="kpTb">${rows.map(p=>{const cc=num(c.cene[p.id]);return `<tr data-pid="${esc(p.id)}"><td>${esc(TIPOVI[p.grupa||"trapez"]||"")}</td><td>${esc(p.naziv)}</td><td>${esc(p.jm||"")}</td><td class="n">${money(p.vele)}</td><td class="n"><input data-kr inputmode="decimal" value="${kpTxt(kpPct(p.vele,cc))}" style="width:80px;text-align:right"></td><td class="n"><input data-kc inputmode="decimal" value="${cc>0?kpTxt(cc):""}" placeholder="standardna" style="width:120px;text-align:right"></td></tr>`}).join("")}</tbody></table></div>`;
}
function kpMark(){kpDirty=true;const m=$("kpMsg");if(m){m.textContent="Nesačuvane izmene – klikni „Sačuvaj“ gore.";m.style.color="var(--rd,#c0392b)"}}
function kpSet(tr,cena){ // upiše cenu u red (i u kupca), osveži polja
  const p=prices.find(x=>x.id===tr.dataset.pid);if(!p)return;kcur.cene=kcur.cene||{};
  if(cena>0)kcur.cene[p.id]=cena;else delete kcur.cene[p.id];
  tr.querySelector("[data-kc]").value=cena>0?kpTxt(cena):"";tr.querySelector("[data-kr]").value=kpTxt(kpPct(p.vele,cena));kpMark();
}
$("kPrc").addEventListener("click",async e=>{
  if(e.target.id==="kpMk"){kcur.cene={};kpRows().forEach(p=>{kcur.cene[p.id]=num(p.vele)});kpDirty=true;renderKPrc();return}
  if(e.target.id==="kpStd"){if(!(await ask("Vratiti ovog kupca na standardni cenovnik? Njegove posebne cene biće obrisane kad sačuvaš kupca.")))return;delete kcur.cene;kpDirty=true;renderKPrc();return}
  if(e.target.id==="kpAp"){
    const r=num($("kpR").value),g=$("kpG").value;if(!(r>=0&&r<100)||$("kpR").value.trim()===""){$("kpMsg").textContent="Upiši rabat između 0 i 99,99 %.";return}
    document.querySelectorAll("#kpTb tr").forEach(tr=>{const p=prices.find(x=>x.id===tr.dataset.pid);if(!p||(g&&(p.grupa||"trapez")!==g))return;kpSet(tr,Math.round(num(p.vele)*(100-r))/100)});
  }
});
$("kPrc").addEventListener("input",e=>{
  const tr=e.target.closest("tr[data-pid]");if(!tr)return;const p=prices.find(x=>x.id===tr.dataset.pid);if(!p)return;kcur.cene=kcur.cene||{};
  if(e.target.dataset.kc!==undefined){const v=num(e.target.value);if(v>0)kcur.cene[p.id]=v;else delete kcur.cene[p.id];tr.querySelector("[data-kr]").value=kpTxt(kpPct(p.vele,v));kpMark()}
  else if(e.target.dataset.kr!==undefined){const r=num(e.target.value);if(e.target.value.trim()===""){delete kcur.cene[p.id];tr.querySelector("[data-kc]").value="";kpMark();return}
    if(r>=0&&r<100){const v=Math.round(num(p.vele)*(100-r))/100;kcur.cene[p.id]=v;tr.querySelector("[data-kc]").value=kpTxt(v);kpMark()}}
});
