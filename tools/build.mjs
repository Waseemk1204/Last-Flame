// Packs the whole game into one HTML file that runs by double-clicking it:
// no server, no folder. Browsers won't load module files from file://, so
// every module (three.js too) is carried inside the page as text, turned
// into a blob: URL when the page opens, and wired together with an import
// map. Imports are rewritten to bare names ("lf/src/game.js") so they
// resolve through that map.
//
//   node tools/build.mjs  → dist/LastFlame.html and dist/index.html

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");

const modules = {};
for (const dir of ["src", "shared"]) {
  for (const f of await readdir(join(root, dir))) {
    if (!f.endsWith(".js")) continue;
    const path = `${dir}/${f}`;
    let code = await readFile(join(root, path), "utf8");
    code = code.replace(/(from\s+|import\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, pre, q, spec) => `${pre}${q}lf/${posix.normalize(posix.join(dir, spec))}${q}`);
    modules[`lf/${path}`] = code;
  }
}
modules.three = await readFile(join(root, "assets/vendor/three.module.min.js"), "utf8");

// Text inside a <script> mustn't close it.
const safe = (s) => JSON.stringify(s).replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

let html = await readFile(join(root, "index.html"), "utf8");
const css = await readFile(join(root, "src/styles.css"), "utf8");
const icon = await readFile(join(root, "assets/icon.svg"), "utf8");
html = html.replace(/<link rel="stylesheet" href="\.\/src\/styles\.css" \/>/, () => `<style>\n${css}\n</style>`);
html = html.replace(/href="\.\/assets\/icon\.svg"/, () => `href="data:image/svg+xml,${encodeURIComponent(icon)}"`);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*<script type="module" src="\.\/src\/main\.js"><\/script>/, () =>
  `<script>
      // The game's modules, packed (see tools/build.mjs).
      (() => {
        const SRC = ${safe(modules)};
        const imports = {};
        for (const k in SRC) imports[k] = URL.createObjectURL(new Blob([SRC[k]], { type: "text/javascript" }));
        const map = document.createElement("script");
        map.type = "importmap";
        map.textContent = JSON.stringify({ imports });
        document.head.appendChild(map);
        const main = document.createElement("script");
        main.type = "module";
        main.textContent = 'import "lf/src/main.js";';
        document.body.appendChild(main);
      })();
    </script>`,
);
if (html.includes('src="./src/main.js"')) throw new Error("index.html changed: the build couldn't find the scripts to pack");

await mkdir(out, { recursive: true });
await writeFile(join(out, "LastFlame.html"), html);
await writeFile(join(out, "index.html"), html);
console.log(`dist/LastFlame.html (${(html.length / 1024).toFixed(0)} KB, ${Object.keys(modules).length} modules)`);
