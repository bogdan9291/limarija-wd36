const {chromium}=require("playwright"),fs=require("fs"),os=require("os"),path=require("path");
const {Core}=require("../src/core.js");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wd36ui-"));const core=new Core(dir,{version:"1.0.0"});
  const saved=[];
  const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1280,height:900}});
  pg.on("pageerror",e=>console.log("PAGEERR",e.message));
  await pg.exposeFunction("__invoke",async(op,a)=>{try{
    if(op==="file.save"){saved.push(a.filename);return{r:{ok:true}}}
    if(op==="app.openBackups")return{r:true};
    return{r:core.handle(op,a)}}catch(e){return{e:e.message}}});
  await pg.addInitScript(fs.readFileSync(path.join(__dirname,"../src/shim.js"),"utf8"));
  await pg.addInitScript(()=>{let sh;
    const inv=async(op,a)=>{const x=await window.__invoke(op,a);if(x&&x.e)throw new Error(x.e);return x.r};
    window.addEventListener("DOMContentLoaded",()=>{sh=window.WDShim.make(inv,document)});
    window.claude={use:async n=>{while(!sh)await new Promise(r=>setTimeout(r,20));return sh.use(n)}}});
  await pg.goto("file://"+path.join(__dirname,"../app/index.html"));
  await pg.waitForSelector("#wdLogin");
  console.log("prijava:",await pg.textContent("#wdLogin form div:nth-child(3)"));
  await pg.fill("#wdU","Vlasnik");await pg.fill("#wdP","abc");await pg.fill("#wdP2","abc");await pg.click("#wdLogin button");
  console.log("kratka lozinka ->",await pg.textContent("#wdE"));
  await pg.fill("#wdP","tajna123");await pg.fill("#wdP2","drugo12");await pg.click("#wdLogin button");
  console.log("razlicite ->",await pg.textContent("#wdE"));
  await pg.fill("#wdP","tajna123");await pg.fill("#wdP2","tajna123");await pg.click("#wdLogin button");
  await pg.waitForSelector("#wdLogin",{state:"detached"});await pg.waitForTimeout(600);
  // Podešavanja: korisnici
  await pg.click("#tabS");await pg.waitForTimeout(300);
  await pg.fill("#uIme","Marko");await pg.fill("#uPw","marko123");await pg.selectOption("#uRole","radnik");await pg.click("#uAdd");
  await pg.waitForTimeout(400);
  console.log("korisnici:",(await pg.$$eval("#usrList [data-uid] b",e=>e.map(x=>x.textContent))).join(","),"|",await pg.textContent("#uSt"));
  console.log("info:",await pg.textContent("#appInfo"));
  // kupac + cenovnik + nalog kroz pravi UI tok: samo provera da se čuva
  await pg.click("#tabC");await pg.waitForTimeout(200);
  const hasPrice=await pg.evaluate(()=>typeof prices!=="undefined");console.log("cenovnik učitan:",hasPrice);
  await pg.click("#tabS");await pg.waitForTimeout(200);
  // RESET kategorije cenovnika -> proba da pisanje/brisanje kroz shim radi
  await pg.evaluate(async()=>{const db=await claude.use("db");await db.collection("prices").doc().set({grupa:"trapez",naziv:"TR 35",jm:"m²",vele:100})});
  await pg.waitForTimeout(300);
  console.log("prices u bazi:",Object.keys(core.d.data.prices||{}).length,"| u aplikaciji:",await pg.evaluate(()=>prices.length));
  await pg.screenshot({path:"/tmp/pf/ui_users.png",fullPage:true});
  // snimi kopiju -> JSON u folder
  await pg.click("#bkDrive");await pg.waitForTimeout(500);
  console.log("sačuvano:",saved.join(","),"|",await pg.textContent("#bkStatus"));
  // uloga radnik
  core.sess=null;core.handle("auth.login",{ime:"Marko",lozinka:"marko123"});
  console.log("radnik čita cene:",core.handle("db.list",{coll:"prices"}).length);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
