// Sastavlja web/index.html + styles.css + js/*.js u JEDAN fajl html/radni-nalozi.html
// (koristi se za Artifact i za desktop program; prepare.js posle toga pravi app/index.html).
// Pokretanje:  node tools/build-html.js [izlazni_fajl ...]
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const web = path.join(root, "web");
let h = fs.readFileSync(path.join(web, "index.html"), "utf8");
const css = fs.readFileSync(path.join(web, "styles.css"), "utf8");
const link = '<link rel="stylesheet" href="styles.css">';
if (!h.includes(link)) { console.error("BUILD GREŠKA: nema <link> za styles.css u index.html"); process.exit(1); }
h = h.replace(link, () => "<style>\n" + css + "</style>");
const re = /(?:<script src="js\/[^"]+"><\/script>\r?\n)+/;
const m = h.match(re);
if (!m) { console.error("BUILD GREŠKA: nema <script src=\"js/...\"> tagova"); process.exit(1); }
const files = [...m[0].matchAll(/src="js\/([^"]+)"/g)].map(x => x[1]);
const js = files.map(f => fs.readFileSync(path.join(web, "js", f), "utf8")).join("");
h = h.replace(re, () => "<script>\n" + js + "</script>\n");
const outs = process.argv.slice(2);
if (!outs.length) outs.push(path.join(root, "html", "radni-nalozi.html"));
outs.forEach(o => { fs.writeFileSync(o, h); console.log("napravljen " + o + " (" + Math.round(h.length / 1024) + " KB, " + files.length + " JS fajlova)"); });
