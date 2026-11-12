// Jezgro: lokalna baza (JSON fajl), korisnici, uloge i dozvole. Nema zavisnosti od Electron-a, pa se testira običnim Node-om.
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const SCHEMA = 1;
const ADMIN_ONLY = new Set(["prices", "proformas", "nabavne", "customers"]); // samo vlasnik
const ROLES = ["vlasnik", "radnik", "pregled"];
const MAX_BACKUPS = 60; // 2 fajla dnevno (početak dana + poslednje stanje) = oko 30 dana

const err = (m) => Object.assign(new Error(m), { user: true });
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString("hex");
const pub = (u) => ({ id: u.id, ime: u.ime, role: u.role });
const today = () => new Date().toISOString().slice(0, 10);

class Core {
  constructor(dir, opts = {}) {
    this.dir = dir; this.opts = opts;
    this.file = path.join(dir, "podaci.json");
    this.backupDir = path.join(dir, "kopije");
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.cfgFile = path.join(dir, "kopije.json");
    try { this.cfg = JSON.parse(fs.readFileSync(this.cfgFile, "utf8")) || {}; } catch (e) { this.cfg = {}; }
    this.sess = null; this.fails = 0; this.lockUntil = 0; this.timer = null; this.dirty = false;
    this.load();
  }

  /* ---------- čuvanje ---------- */
  load() {
    let d = null;
    for (const f of [this.file, this.file + ".bak"]) {
      try { d = JSON.parse(fs.readFileSync(f, "utf8")); break; } catch (e) { /* pokušaj sledeći */ }
    }
    if (!d || typeof d !== "object") d = { schema: SCHEMA, users: [], data: {} };
    d.users = d.users || []; d.data = d.data || {};
    if ((d.schema || 0) < SCHEMA) { this.backupNow("pre-migracije"); this.migrate(d); }
    this.d = d;
  }
  migrate(d) { d.schema = SCHEMA; /* ovde ide prilagođavanje starih podataka kad se struktura menja */ }
  touch() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 150);
  }
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.dirty) return;
    this.dirty = false;
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.d));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + ".bak");
    fs.renameSync(tmp, this.file);
  }
  prune(dir) {
    const all = fs.readdirSync(dir).filter((f) => f.startsWith("kopija_")).sort();
    while (all.length > MAX_BACKUPS) fs.unlinkSync(path.join(dir, all.shift()));
  }
  mirrorWrite(name, txt) { // isti fajl i u dodatni folder (USB, OneDrive, mrežni disk…)
    const m = this.cfg.mirror; if (!m) return;
    try { fs.mkdirSync(m, { recursive: true }); fs.writeFileSync(path.join(m, name), txt); this.prune(m); this.cfg.mirrorErr = ""; }
    catch (e) { this.cfg.mirrorErr = String(e.message || e); }
  }
  backupNow(tag) {
    try {
      const name = "kopija_" + today() + (tag ? "_" + tag : "") + ".json";
      const p = path.join(this.backupDir, name);
      const txt = JSON.stringify(this.d || JSON.parse(fs.readFileSync(this.file, "utf8")));
      fs.writeFileSync(p, txt); this.prune(this.backupDir);
      this.mirrorWrite(name, txt);
      return p;
    } catch (e) { return null; }
  }
  autoBackup() { // jednom dnevno: stanje na početku dana (ne prepisuje se)
    const p = path.join(this.backupDir, "kopija_" + today() + ".json");
    if (!fs.existsSync(p) && Object.keys(this.d.data).length) this.backupNow("");
  }
  snapshot() { // poslednje stanje tekućeg dana: poziva se na 30 min i pri zatvaranju programa
    this.autoBackup();
    if (Object.keys(this.d.data).length) this.backupNow("zadnja");
  }
  backupInfo() {
    let last = null, count = 0;
    try {
      const fl = fs.readdirSync(this.backupDir).filter((f) => f.startsWith("kopija_"));
      count = fl.length;
      fl.forEach((f) => { const t = fs.statSync(path.join(this.backupDir, f)).mtimeMs; if (!last || t > last) last = t; });
    } catch (e) { /* prazno */ }
    return { last, count, dir: this.backupDir, mirror: this.cfg.mirror || "", mirrorErr: this.cfg.mirrorErr || "" };
  }
  setMirror(dir) {
    this.cfg.mirror = dir || ""; this.cfg.mirrorErr = "";
    fs.writeFileSync(this.cfgFile, JSON.stringify({ mirror: this.cfg.mirror }));
    if (dir) this.snapshot();
  }

  /* ---------- dozvole ---------- */
  need() { if (!this.sess) throw err("Niste prijavljeni."); return this.sess; }
  canRead(c) { const s = this.need(); return !(ADMIN_ONLY.has(c) && s.role !== "vlasnik"); }
  canWrite(c) {
    const s = this.need();
    if (s.role === "vlasnik") return true;
    if (s.role === "radnik") return !ADMIN_ONLY.has(c) && c !== "settings";
    return false;
  }
  owner() { const s = this.need(); if (s.role !== "vlasnik") throw err("Samo vlasnik može ovo da radi."); return s; }

  /* ---------- korisnici ---------- */
  validName(n) { n = String(n || "").trim(); if (n.length < 2 || n.length > 40) throw err("Korisničko ime mora imati 2–40 znakova."); return n; }
  validPw(p) { p = String(p || ""); if (p.length < 6) throw err("Lozinka mora imati najmanje 6 znakova."); return p; }
  mkUser(ime, lozinka, role) {
    ime = this.validName(ime); lozinka = this.validPw(lozinka);
    if (!ROLES.includes(role)) throw err("Nepoznata uloga.");
    if (this.d.users.some((u) => u.ime.toLowerCase() === ime.toLowerCase())) throw err("Korisnik sa tim imenom već postoji.");
    const salt = crypto.randomBytes(16).toString("hex");
    return { id: crypto.randomBytes(6).toString("hex"), ime, role, salt, hash: hashPw(lozinka, salt) };
  }

  /* ---------- jedinstvena tačka ulaza ---------- */
  handle(op, a = {}) {
    switch (op) {
      case "auth.status":
        return { needsSetup: this.d.users.length === 0, user: this.sess ? pub(this.sess) : null };
      case "auth.setup": {
        if (this.d.users.length) throw err("Program je već podešen.");
        const u = this.mkUser(a.ime, a.lozinka, "vlasnik");
        this.d.users.push(u); this.touch(); this.sess = u; return pub(u);
      }
      case "auth.login": {
        if (Date.now() < this.lockUntil) throw err("Previše pokušaja. Sačekaj " + Math.ceil((this.lockUntil - Date.now()) / 1000) + " s.");
        const u = this.d.users.find((x) => x.ime.toLowerCase() === String(a.ime || "").trim().toLowerCase());
        const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(a.lozinka || "", u.salt), "hex"), Buffer.from(u.hash, "hex"));
        if (!ok) { if (++this.fails >= 5) { this.fails = 0; this.lockUntil = Date.now() + 30000; } throw err("Pogrešno korisničko ime ili lozinka."); }
        this.fails = 0; this.sess = u; return pub(u);
      }
      case "auth.logout": this.sess = null; return true;
      case "auth.resetOwner": // poziva se samo iz glavnog procesa (nakon fajla reset-lozinke.txt)
        this.d.users = []; this.sess = null; this.touch(); return true;

      case "db.list": {
        if (!this.canRead(a.coll)) return [];
        return Object.entries(this.d.data[a.coll] || {});
      }
      case "db.set": {
        if (!this.canWrite(a.coll)) throw err("Nemaš dozvolu za izmenu (" + a.coll + ").");
        if (!a.id || typeof a.data !== "object") throw err("Neispravan zapis.");
        (this.d.data[a.coll] = this.d.data[a.coll] || {})[a.id] = JSON.parse(JSON.stringify(a.data));
        this.touch(); return true;
      }
      case "db.del": {
        if (!this.canWrite(a.coll)) throw err("Nemaš dozvolu za izmenu (" + a.coll + ").");
        if (this.d.data[a.coll]) delete this.d.data[a.coll][a.id];
        this.touch(); return true;
      }

      case "users.list": this.owner(); return this.d.users.map(pub);
      case "users.add": { this.owner(); const u = this.mkUser(a.ime, a.lozinka, a.role); this.d.users.push(u); this.touch(); return pub(u); }
      case "users.update": {
        this.owner();
        const u = this.d.users.find((x) => x.id === a.id); if (!u) throw err("Korisnik ne postoji.");
        if (a.role !== undefined) {
          if (!ROLES.includes(a.role)) throw err("Nepoznata uloga.");
          if (u.role === "vlasnik" && a.role !== "vlasnik" && this.d.users.filter((x) => x.role === "vlasnik").length < 2) throw err("Mora da ostane bar jedan vlasnik.");
          u.role = a.role;
        }
        if (a.lozinka !== undefined) { u.salt = crypto.randomBytes(16).toString("hex"); u.hash = hashPw(this.validPw(a.lozinka), u.salt); }
        this.touch(); return pub(u);
      }
      case "users.remove": {
        const s = this.owner();
        const u = this.d.users.find((x) => x.id === a.id); if (!u) throw err("Korisnik ne postoji.");
        if (u.id === s.id) throw err("Ne možeš da obrišeš sam/a sebe.");
        if (u.role === "vlasnik" && this.d.users.filter((x) => x.role === "vlasnik").length < 2) throw err("Mora da ostane bar jedan vlasnik.");
        this.d.users = this.d.users.filter((x) => x.id !== a.id); this.touch(); return true;
      }
      case "info": this.need(); return { version: this.opts.version || "dev", dataDir: this.dir, backupDir: this.backupDir };
      default: throw err("Nepoznata operacija: " + op);
    }
  }
}
module.exports = { Core, ADMIN_ONLY, ROLES };
