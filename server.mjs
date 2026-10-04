// A tiny static file server, so the game can be opened on http://localhost.
// (Browsers will not load ES modules from file://.) No dependencies.
//
//   node server.mjs          → http://localhost:5177
//   PORT=8080 node server.mjs

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT) || 5177;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  // Dev only (this server isn't deployed): save a frame from the game to
  // jam/<name>.png, for the jam page.
  if (req.method === "POST" && req.url.startsWith("/__capture")) {
    const name = (new URL(req.url, "http://x").searchParams.get("name") || "shot").replace(/[^a-z0-9-_]/gi, "");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const data = Buffer.concat(chunks).toString().replace(/^data:image\/\w+;base64,/, "");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, "jam"), { recursive: true });
    await writeFile(join(root, "jam", `${name}.png`), Buffer.from(data, "base64"));
    res.writeHead(200).end("ok");
    return;
  }
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep) && file !== root) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`Last Flame on http://localhost:${port}`));
