const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path"), fs = require("fs");
const { Core } = require("./core.js");

let core, win, updater = null, updMsg = "";
const dataDir = () => path.join(app.getPath("userData"), "podaci");

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 1000, minHeight: 640, backgroundColor: "#1f2430",
    title: "Limarija WD-36", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: false, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "..", "app", "index.html"));
  // linkovi (mejl, internet) se otvaraju u spoljnom programu, nikad u prozoru aplikacije
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); } });
}

async function saveFile({ filename, data }) {
  const dir = path.join(app.getPath("documents"), "Limarija WD-36");
  fs.mkdirSync(dir, { recursive: true });
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(dir, String(filename).replace(/[\\/:*?"<>|]/g, "_")) });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, Buffer.from(data));
  if (/\.pdf$/i.test(r.filePath)) shell.openPath(r.filePath);
  return { ok: true, path: r.filePath };
}

/* ---------- automatsko ažuriranje (GitHub Releases) ---------- */
function setupUpdater() {
  if (!app.isPackaged) return;
  try {
    updater = require("electron-updater").autoUpdater;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.on("update-available", (i) => { updMsg = "Preuzimam verziju " + i.version + "…"; });
    updater.on("update-not-available", () => { updMsg = "Imaš najnoviju verziju."; });
    updater.on("error", (e) => { updMsg = "Provera ažuriranja nije uspela (nema interneta?)."; });
    updater.on("update-downloaded", async (i) => {
      updMsg = "Verzija " + i.version + " je spremna.";
      const r = await dialog.showMessageBox(win, { type: "info", buttons: ["Ažuriraj i pokreni ponovo", "Kasnije"], defaultId: 0, cancelId: 1,
        title: "Nova verzija", message: "Dostupna je nova verzija programa (" + i.version + ").", detail: "Podaci ostaju netaknuti. Ako izabereš „Kasnije“, program se ažurira pri sledećem zatvaranju." });
      if (r.response === 0) { core.flush(); updater.quitAndInstall(); }
    });
    setTimeout(() => updater.checkForUpdates().catch(() => {}), 5000);
  } catch (e) { updater = null; }
}
async function checkUpdate() {
  if (!updater) return "Ažuriranje radi samo u instaliranom programu.";
  updMsg = "Proveravam…";
  try { await updater.checkForUpdates(); } catch (e) { return "Provera ažuriranja nije uspela (nema interneta?)."; }
  return updMsg;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    core = new Core(dataDir(), { version: app.getVersion() });
    const reset = path.join(core.dir, "reset-lozinke.txt");
    if (fs.existsSync(reset)) { core.backupNow("pre-reseta-lozinke"); core.handle("auth.resetOwner"); fs.unlinkSync(reset); core.flush(); }
    core.autoBackup();
    ipcMain.handle("wd", async (e, op, a) => {
      if (op === "file.save") { core.need(); return saveFile(a); }
      if (op === "app.openBackups") { core.owner(); return shell.openPath(core.backupDir); }
      if (op === "app.update") { core.owner(); return checkUpdate(); }
      if (op === "app.logout") { core.handle("auth.logout"); win.webContents.reload(); return true; }
      return core.handle(op, a);
    });
    createWindow();
    setupUpdater();
    app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on("before-quit", () => { if (core) core.flush(); });
  app.on("window-all-closed", () => { if (core) core.flush(); app.quit(); });
}
