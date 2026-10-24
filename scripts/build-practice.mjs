// Bundles the BADTOWN engine + bots + practice UI into one self-contained HTML page.
//   node scripts/build-practice.mjs   ->  dist/badtown-practice.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");
const modules = ["src/badtown/rng.ts", "src/badtown/config.ts", "src/badtown/engine.ts", "src/badtown/bots.ts"];
const body = modules
  .map((p) => {
    let js = stripTypeScriptTypes(read(p), { mode: "strip" });
    js = js.replace(/^import[\s\S]*?;\s*$/gm, "");
    js = js.replace(/^export\s+(?=(const|function|class|let|async))/gm, "");
    return `// ---- ${p}\n${js}`;
  })
  .join("\n");
const engine = `const BT = (() => {\n${body}\nreturn { newRoom, addPlayer, applyCommand, viewFor, botMove, botChatter, playerById, TABLES, CONFIG };\n})();`;
const html = read("practice/index.html")
  .replace("/*STYLE*/", () => read("practice/style.css"))
  .replace("/*ENGINE*/", () => engine)
  .replace("/*APP*/", () => read("practice/app.js"));
mkdirSync(root + "dist", { recursive: true });
writeFileSync(root + "dist/badtown-practice.html", html);
console.log(`dist/badtown-practice.html (${(html.length / 1024).toFixed(0)} KB)`);
