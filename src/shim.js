// Zamena za claude.ai okruženje: window.claude.use("db" | "user" | "downloads" | "users" | "app").
// invoke(op, args) -> Promise (IPC ka glavnom procesu). Isti kod se koristi i u testu.
(function (root) {
  function make(invoke, doc) {
    const subs = [];
    let loginP = null, curUser = null;

    /* ---------- prijava (preklopni ekran) ---------- */
    function overlay(status) {
      const el = doc.createElement("div");
      el.id = "wdLogin";
      el.style.cssText = "position:fixed;inset:0;z-index:99999;background:#1f2430;display:flex;align-items:center;justify-content:center;font-family:system-ui,Segoe UI,Arial,sans-serif";
      const setup = status.needsSetup;
      el.innerHTML =
        '<form style="background:#fff;border-radius:14px;padding:30px 32px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,.4)" autocomplete="off">' +
        '<div style="font-size:22px;font-weight:700;color:#23262f">Limarija WD-36</div>' +
        '<div style="height:3px;width:34px;background:#e8a317;margin:8px 0 14px"></div>' +
        '<div style="font-size:13px;color:#667;margin-bottom:14px;line-height:1.45">' +
        (setup ? "Prvo pokretanje. Napravi nalog vlasnika (imaš pun pristup). Kasnije dodaješ radnike u Podešavanjima." : "Prijavi se da bi nastavio.") + "</div>" +
        '<input id="wdU" placeholder="Korisničko ime" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border:1px solid #cfd3da;border-radius:8px;font-size:15px">' +
        '<input id="wdP" type="password" placeholder="Lozinka' + (setup ? " (min. 6 znakova)" : "") + '" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:' + (setup ? 8 : 12) + 'px;border:1px solid #cfd3da;border-radius:8px;font-size:15px">' +
        (setup ? '<input id="wdP2" type="password" placeholder="Ponovi lozinku" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:12px;border:1px solid #cfd3da;border-radius:8px;font-size:15px">' : "") +
        '<div id="wdE" style="color:#c0392b;font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
        '<button type="submit" style="width:100%;padding:11px;border:0;border-radius:8px;background:#e8a317;color:#23262f;font-weight:700;font-size:15px;cursor:pointer">' + (setup ? "Napravi nalog i uđi" : "Prijavi se") + "</button>" +
        (setup ? "" : '<div style="font-size:12px;color:#889;margin-top:12px;line-height:1.4">Zaboravljena lozinka vlasnika? Zatvori program, u folderu sa podacima napravi prazan fajl <b>reset-lozinke.txt</b> i pokreni program ponovo.</div>') +
        "</form>";
      doc.body.appendChild(el);
      return el;
    }
    function ensureLogin() {
      if (loginP) return loginP;
      loginP = (async () => {
        const st = await invoke("auth.status");
        if (st.user) { curUser = st.user; return st.user; }
        return new Promise((res) => {
          const el = overlay(st), $ = (i) => el.querySelector("#" + i);
          $("wdU").focus();
          el.querySelector("form").onsubmit = async (e) => {
            e.preventDefault();
            try {
              if (st.needsSetup && $("wdP").value !== $("wdP2").value) throw new Error("Lozinke se ne poklapaju.");
              const u = await invoke(st.needsSetup ? "auth.setup" : "auth.login", { ime: $("wdU").value, lozinka: $("wdP").value });
              curUser = u; el.remove(); res(u);
            } catch (x) { $("wdE").textContent = x.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, ""); $("wdP").value = ""; }
          };
        });
      })();
      return loginP;
    }

    /* ---------- baza ---------- */
    const emit = (s, entries) => {
      if (s.id === undefined) s.cb({ docs: entries.map(([id, d]) => ({ id, data: () => d })) });
      else { const f = entries.find(([id]) => id === s.id); s.cb({ data: () => (f ? f[1] : undefined), exists: !!f }); }
    };
    async function refresh(s) {
      try { emit(s, await invoke("db.list", { coll: s.coll })); } catch (e) { if (s.err) s.err(e); }
    }
    const refreshColl = (c) => Promise.all(subs.filter((s) => s.coll === c).map(refresh));
    const rid = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const docRef = (coll, id) => ({
      id,
      async set(data) { await invoke("db.set", { coll, id, data }); await refreshColl(coll); },
      async delete() { await invoke("db.del", { coll, id }); await refreshColl(coll); },
      onSnapshot(cb, err) { const s = { coll, id, cb, err }; subs.push(s); refresh(s); return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); }; },
    });
    const dbObj = {
      collection: (coll) => ({
        doc: (id) => docRef(coll, id || rid()),
        onSnapshot(cb, err) { const s = { coll, cb, err }; subs.push(s); refresh(s); return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); }; },
      }),
      doc: (path) => { const [c, i] = String(path).split("/"); return docRef(c, i); },
    };

    /* ---------- korisnik / preuzimanje / ostalo ---------- */
    const userObj = {
      isOwner: async () => curUser.role === "vlasnik",
      canEdit: async () => curUser.role === "vlasnik",
      can: async () => curUser.role !== "pregled",
      name: async () => curUser.ime,
    };
    const dlObj = {
      async save({ filename, data }) {
        const r = await invoke("file.save", { filename, data: new Uint8Array(data) });
        if (!r || !r.ok) throw new Error("Čuvanje je otkazano.");
        return r;
      },
    };
    const usersObj = {
      list: () => invoke("users.list"),
      add: (a) => invoke("users.add", a),
      update: (a) => invoke("users.update", a),
      remove: (a) => invoke("users.remove", a),
    };
    const appObj = { info: () => invoke("info"), openBackups: () => invoke("app.openBackups"), update: () => invoke("app.update"), logout: () => invoke("app.logout") };

    return {
      async use(name) {
        await ensureLogin();
        if (name === "db") return dbObj;
        if (name === "user") return userObj;
        if (name === "downloads") return dlObj;
        if (name === "users") return usersObj;
        if (name === "app") return appObj;
        return null; // "mcp" (Google Drive) nije dostupan u lokalnoj verziji
      },
    };
  }
  if (typeof module !== "undefined") module.exports = { make };
  else root.WDShim = { make };
})(typeof window !== "undefined" ? window : globalThis);
