// What the `app://game/` scheme serves (pivot 15.1), with no Electron in reach so a test can check
// it: a page path to a file on disk, and the file as a Response.

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

/**
 * Where the game's files are on disk: the built renderer, and the data folders the sim process
 * reads. Unpackaged (dev and `electron .`) the data folders are the repository's own, so the app
 * and the headless runner read the very same files; packaged, they are a `data` folder in the
 * app's resources with the layout of the `/data/` URLs.
 */
export interface ServeDirs {
  renderer: string;
  worlds: string;
  design: string;
  map: string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".csv": "text/csv; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

/** `path` under `root`, or null when it would leave it. */
function inside(root: string, path: string): string | null {
  const base = resolve(root);
  const full = resolve(base, `.${sep}${path}`);
  return full === base || full.startsWith(base + sep) ? full : null;
}

/**
 * The file a page path names, or null. `/data/worlds/*`, `/data/design/*` and `/data/map/*` are
 * the data folders; everything else, and any data file not found there, is the built renderer
 * (whose build also holds a copy of the data). A path that names nothing is null, never the index
 * page: the page tells a missing optional file by its 404.
 */
export function fileFor(pathname: string, dirs: ServeDirs): string | null {
  let path: string;
  try {
    path = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }
  const candidates: (string | null)[] = [];
  for (const [prefix, dir] of [
    ["data/worlds/", dirs.worlds],
    ["data/design/", dirs.design],
    ["data/map/", dirs.map],
  ] as const) {
    if (path.startsWith(prefix)) candidates.push(inside(dir, path.slice(prefix.length)));
  }
  candidates.push(inside(dirs.renderer, path === "" ? "index.html" : path));
  for (const file of candidates) {
    if (file !== null && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

/** The answer to a request for `url` on host `host`: the file, or a 404. */
export function serve(url: string, host: string, dirs: ServeDirs): Response {
  const u = new URL(url);
  const file = u.host === host ? fileFor(u.pathname, dirs) : null;
  if (file === null)
    return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  return new Response(readFileSync(file), { headers: { "content-type": type } });
}
