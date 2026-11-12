const VRSTE=["TR 35","TR 35 FILC","TR 18","TR 18 FILC"];
const BOJE_DEF=["Antracit","Crna","Bordo","Braon","Plava","Bela","Zelena","Silver","Drvo Dekor","Pocink."];
const BOJE=[...BOJE_DEF];
const defBoja=()=>BOJE.includes("Braon")?"Braon":(BOJE[0]||"");
const fixB=(a)=>{(a||[]).forEach(x=>{if(x&&x.boja==="Pocinkovano")x.boja="Pocink."});return a};
const fixDoc=d=>{if(d){fixB(d.items);fixB(d.lines);(d.segments||[]).forEach(g=>fixB(g.items))}return d};
const $=id=>document.getElementById(id);
function ask(m){return new Promise(r=>{$("ovm").textContent=m;$("ov").classList.remove("hide");const f=v=>{$("ov").classList.add("hide");$("ovy").onclick=$("ovn").onclick=null;r(v)};$("ovy").onclick=()=>f(true);$("ovn").onclick=()=>f(false);$("ovn").focus()})}
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=n=>(Math.round(n*100)/100).toFixed(2).replace(".",",");
const custLine=(a,t,p)=>{const x=[];if(a&&String(a).trim())x.push(esc(String(a).trim()));if(t&&String(t).trim())x.push("Tel: "+esc(String(t).trim()));if(p&&String(p).trim())x.push("PIB: "+esc(String(p).trim()));return x.map(l=>`<small style="display:block;font-size:12.5px;font-weight:400;color:#000;margin-top:2px">${l}</small>`).join("")};
const FOOT=`<div class="sfoot"><hr><div><span class="f1">Miloš Spasić PR Kovačka radionica WD-36</span> · PIB: 110029026 · Lole Ribara 40, 25250 Odžaci · Tel: 069/4567-999 · Tekući račun: 325-9500600059441-13</div></div>`;
const wf=h=>h+FOOT;
const BHEX={"antracit":"#3b3f44","crna":"#111","bordo":"#6d1a2a","braon":"#6b4226","plava":"#1f4e9c","bela":"#fff","zelena":"#2e6b3a","silver":"#b8bcc2","drvo dekor":"#9a6a3a","pocink.":"#d3d6da"};
const bj=b=>{const t=String(b||"").trim();if(!t)return"–";const h=BHEX[t.toLowerCase()];return esc(t)};
const goodsName=l=>{const v=String(l.vrsta||"").trim(),b=String(l.boja||"").trim(),tz=l.tip==="trapez"||l.seg===TIPOVI.trapez||l.seg==="Trapezni lim"||(!l.tip&&/^tr\s*-?\s*\d+/i.test(v));return(tz&&!/^trapezni/i.test(v)?"Trapezni lim ":"")+v+(b?" - "+b:"")};
const fmtDate=s=>{if(!s)return"";const[y,m,d]=s.split("-");return d+"."+m+"."+y+"."};
// ista formula kao u .ods: TR 18 i TR 18 FILC računaju se sa širinom 1,1 m
const m2=(v,d,k)=>(/tr\s*-?\s*18(?!\d)/i.test(String(v||""))?d*1.1*k:d*k)/1000;

let db=null,orders=[],cur=null,dirty=false;
function blank(l,tip){tip=tip||"trapez";const def="";return{tip,vrsta:(l&&l.tip===tip&&l.vrsta)||def,duzina:"",sirina:"",jm:"metar",boja:kindOf(tip)==="srafovska"?((l&&l.tip===tip&&l.boja)||""):((l&&l.tip===tip)?(l.boja||""):((l&&l.boja)||defBoja())),kom:""}}

function newOrder(){
  const y=new Date().getFullYear();
  const nums=orders.filter(o=>o.year===y).map(o=>o.no);
  return{id:null,no:(nums.length?Math.max(...nums):0)+1,year:y,customer:"",addr:"",phone:"",pib:"",date:new Date().toISOString().slice(0,10),status:"u_radu",note:"",segments:[{tip:"trapez",items:[blank(null,"trapez")]}]};
}
const oid=o=>o.year+"_"+o.no;

