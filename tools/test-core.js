const fs=require("fs"),os=require("os"),path=require("path"),assert=require("assert");
const {Core}=require("../src/core.js");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wd36-"));
let c=new Core(dir,{version:"t"});
const thr=(f,m)=>{try{f();}catch(e){assert(!m||m.test(e.message),e.message);return}assert.fail("očekivana greška "+m)};
// bez prijave
thr(()=>c.handle("db.list",{coll:"orders"}),/prijavljen/);
assert.equal(c.handle("auth.status").needsSetup,true);
thr(()=>c.handle("auth.setup",{ime:"Pera",lozinka:"123"}),/6 znakova/);
c.handle("auth.setup",{ime:"Pera",lozinka:"tajna123"});
thr(()=>c.handle("auth.setup",{ime:"X",lozinka:"tajna123"}),/već podešen/);
// podaci
c.handle("db.set",{coll:"orders",id:"o1",data:{a:1}});
c.handle("db.set",{coll:"prices",id:"p1",data:{naziv:"TR"}});
c.handle("db.set",{coll:"settings",id:"main",data:{pdv:20}});
// korisnici
c.handle("users.add",{ime:"Radnik1",lozinka:"radnik123",role:"radnik"});
c.handle("users.add",{ime:"Knjig",lozinka:"knjig123",role:"pregled"});
thr(()=>c.handle("users.add",{ime:"radnik1",lozinka:"abcdef",role:"radnik"}),/već postoji/);
thr(()=>c.handle("users.update",{id:c.handle("users.list").find(u=>u.role==="vlasnik").id,role:"radnik"}),/bar jedan vlasnik/);
c.flush();
// novo učitavanje iz fajla
c=new Core(dir,{version:"t"});
assert.equal(c.handle("auth.status").user,null);
thr(()=>c.handle("auth.login",{ime:"Pera",lozinka:"pogresna"}),/Pogrešno/);
c.handle("auth.login",{ime:"radnik1",lozinka:"radnik123"});
assert.equal(c.handle("db.list",{coll:"orders"}).length,1);
assert.deepEqual(c.handle("db.list",{coll:"prices"}),[]);          // osetljivo: radnik ne vidi
assert.equal(c.handle("db.list",{coll:"settings"}).length,1);       // podešavanja može da čita
c.handle("db.set",{coll:"orders",id:"o2",data:{b:2}});               // sme da menja naloge
thr(()=>c.handle("db.set",{coll:"prices",id:"p2",data:{}}),/dozvolu/);
thr(()=>c.handle("db.set",{coll:"settings",id:"main",data:{pdv:1}}),/dozvolu/);
thr(()=>c.handle("users.list"),/vlasnik/);
c.handle("auth.login",{ime:"Knjig",lozinka:"knjig123"});
thr(()=>c.handle("db.set",{coll:"orders",id:"o3",data:{}}),/dozvolu/);   // pregled: ništa ne menja
thr(()=>c.handle("db.del",{coll:"orders",id:"o1"}),/dozvolu/);
assert.equal(c.handle("db.list",{coll:"orders"}).length,2);
// blokada nakon 5 pogrešnih pokušaja
for(let i=0;i<5;i++)thr(()=>c.handle("auth.login",{ime:"Pera",lozinka:"x"}),/Pogrešno/);
thr(()=>c.handle("auth.login",{ime:"Pera",lozinka:"tajna123"}),/Previše/);
c.lockUntil=0;
// vlasnik briše
c.handle("auth.login",{ime:"Pera",lozinka:"tajna123"});
c.handle("db.del",{coll:"orders",id:"o1"});
thr(()=>c.handle("users.remove",{id:c.sess.id}),/sam\/a sebe/);
// automatska kopija i migracija ne ruši
c.autoBackup(); assert(fs.readdirSync(path.join(dir,"kopije")).length>=1);
// oštećen glavni fajl -> čita .bak
c.flush(); c.d.users[0].ime="Pera"; c.touch(); c.flush();
fs.writeFileSync(path.join(dir,"podaci.json"),"{oštećen");
const c2=new Core(dir); assert(c2.d.users.length===3,"vraćanje iz .bak");
// reset vlasnika zadržava podatke
c2.handle("auth.resetOwner"); assert.equal(c2.handle("auth.status").needsSetup,true);
assert.equal(Object.keys(c2.d.data.orders).length,1);
console.log("test-core: SVE U REDU");
