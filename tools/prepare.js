// Pravi app/index.html od izvornog HTML-a: zamenjuje claude.ai-specifične delove lokalnim.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
let h = fs.readFileSync(path.join(root, "html", "radni-nalozi.html"), "utf8");

function must(cond, what) { if (!cond) { console.error("PREPARE GREŠKA: ne nalazim " + what); process.exit(1); } }

// 1) sekcija "Pristup i uloge" -> "Korisnici i uloge"
const a = h.indexOf('<div class="stl" style="margin-top:22px">Pristup i uloge</div>');
const b = h.indexOf('<div class="stl" style="margin-top:22px">Podaci i rezervna kopija</div>');
must(a > 0 && b > a, "sekciju Pristup i uloge");
const usersHtml = `<div class="stl" style="margin-top:22px">Korisnici i uloge</div>
  <div style="color:var(--mu);font-size:13px;line-height:1.5"><b style="color:var(--tx)">Vlasnik</b> ima pun pristup. <b style="color:var(--tx)">Radnik</b> vidi naloge, menja status naloga i grupa, ali ne vidi cene, predračune, proizvodnju, kupce ni cenovnik. <b style="color:var(--tx)">Samo pregled</b> (npr. knjigovođa) vidi sve osim osetljivih podataka i ne može da menja ništa. Ograničenja važe i na nivou baze u programu, ne samo u prikazu.</div>
  <div id="usrList" style="margin-top:10px"></div>
  <div class="row" style="margin-top:8px"><input id="uIme" placeholder="Korisničko ime" style="width:170px" autocomplete="off"><input id="uPw" type="password" placeholder="Lozinka (min. 6)" style="width:170px" autocomplete="new-password"><select id="uRole" style="width:150px"><option value="radnik">Radnik</option><option value="pregled">Samo pregled</option><option value="vlasnik">Vlasnik</option></select><button class="p" id="uAdd">+ Dodaj korisnika</button></div>
  <div class="msg" id="uSt" style="padding:6px 0;text-align:left"></div>
  <div style="color:var(--mu);font-size:13px;line-height:1.5;margin-top:6px"><span id="appInfo"></span></div>
  <div class="row" style="margin-top:8px"><button id="appBk">Otvori folder sa automatskim kopijama</button><button id="appUp">Proveri ažuriranja</button><button id="appOut">Odjavi se</button></div>
  `;
h = h.slice(0, a) + usersHtml + h.slice(b);

// 2) Google Drive -> folder
must(h.includes("Sačuvaj kopiju na Google Drive"), "dugme za Drive");
h = h.replace("Sačuvaj kopiju na Google Drive", "Sačuvaj kopiju u folder…").replace("Sačuvaj na Google Drive", "Sačuvaj kopiju u folder…");

// 3) skripta: korisnici, Drive->JSON, informacije o programu (dodaje se pred poslednji </script>)
const js = `
/* ===== lokalna verzija (Electron) ===== */
(function(){
  const ROLE_LBL={vlasnik:"Vlasnik",radnik:"Radnik",pregled:"Samo pregled"};
  const U=()=>claude.use("users");
  const msg=(t,bad)=>{const s=$("uSt");s.textContent=t;s.style.color=bad?"var(--rd,#c0392b)":""};
  async function usrRender(){
    try{
      const u=await U(),list=await u.list();
      $("usrList").innerHTML=list.map(x=>'<div class="setrow" data-uid="'+x.id+'" style="border-bottom:1px solid var(--ln,#e6e8ec)"><b>'+esc(x.ime)+'</b>'+
        '<div class="row" style="flex-wrap:nowrap"><select data-ur style="width:140px">'+Object.keys(ROLE_LBL).map(r=>'<option value="'+r+'"'+(r===x.role?' selected':'')+'>'+ROLE_LBL[r]+'</option>').join("")+'</select>'+
        '<input data-up type="password" placeholder="Nova lozinka" style="width:130px" autocomplete="new-password"><button data-upset>Postavi</button><button class="d" data-udel title="Obriši korisnika">✕</button></div></div>').join("");
    }catch(e){$("usrList").innerHTML=""}
    try{const i=await (await claude.use("app")).info();$("appInfo").textContent="Verzija programa: "+i.version+". Podaci se čuvaju u: "+i.dataDir}catch(e){}
  }
  $("uAdd").onclick=async()=>{
    try{await (await U()).add({ime:$("uIme").value,lozinka:$("uPw").value,role:$("uRole").value});$("uIme").value="";$("uPw").value="";msg("Korisnik je dodat ✓");usrRender()}
    catch(e){msg(e.message,true)}
  };
  $("usrList").addEventListener("change",async e=>{
    if(e.target.dataset.ur===undefined)return;const id=e.target.closest("[data-uid]").dataset.uid;
    try{await (await U()).update({id,role:e.target.value});msg("Uloga je promenjena ✓")}catch(x){msg(x.message,true);usrRender()}
  });
  $("usrList").addEventListener("click",async e=>{
    const row=e.target.closest("[data-uid]");if(!row)return;const id=row.dataset.uid;
    try{
      if(e.target.dataset.upset!==undefined){const p=row.querySelector("[data-up]").value;await (await U()).update({id,lozinka:p});row.querySelector("[data-up]").value="";msg("Lozinka je promenjena ✓")}
      else if(e.target.dataset.udel!==undefined){if(!confirm("Obrisati ovog korisnika?"))return;await (await U()).remove({id});msg("Korisnik je obrisan ✓");usrRender()}
    }catch(x){msg(x.message,true)}
  });
  $("appBk").onclick=async()=>{try{await (await claude.use("app")).openBackups()}catch(e){msg(e.message,true)}};
  $("appUp").onclick=async()=>{const b=$("appUp");b.disabled=true;msg("Proveravam…");try{msg(await (await claude.use("app")).update())}catch(e){msg(e.message,true)}b.disabled=false};
  $("appOut").onclick=async()=>{try{await (await claude.use("app")).logout()}catch(e){}};
  // „Sačuvaj na Drive“ postaje čuvanje JSON kopije u folder
  $("bkDrive").onclick=()=>$("bkJson").click();
  $("bkbDrive").onclick=()=>{goTab("s");$("bkJson").click()};
  usrRender();
})();
`;
const i = h.lastIndexOf("</script>");
must(i > 0, "kraj skripte");
h = h.slice(0, i) + js + h.slice(i);

fs.mkdirSync(path.join(root, "app"), { recursive: true });
fs.writeFileSync(path.join(root, "app", "index.html"), h);
console.log("app/index.html napravljen (" + Math.round(h.length / 1024) + " KB)");
