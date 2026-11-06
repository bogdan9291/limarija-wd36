const { contextBridge, ipcRenderer } = require("electron");
const { make } = require("./shim.js");
const invoke = (op, args) => ipcRenderer.invoke("wd", op, args).catch((e) => {
  throw new Error(String(e.message || e).replace(/^Error invoking remote method '[^']*': (Error: )?/, ""));
});
// Ekran za prijavu živi u stranici, a ne preko contextBridge-a, pa se shim pokreće na DOMContentLoaded
let claude;
window.addEventListener("DOMContentLoaded", () => { claude = make(invoke, document); });
contextBridge.exposeInMainWorld("claude", {
  use: async (name) => {
    while (!claude) await new Promise((r) => setTimeout(r, 20));
    const o = await claude.use(name);
    return o; // contextBridge prosleđuje funkcije
  },
});
