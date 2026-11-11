// `pnpm desktop:dev`: the app against the Vite dev server. The renderer is served by apps/web's
// own Vite config, so it hot-reloads as in the browser; main, preload and the sim process are
// rebuilt by esbuild on every change, and the app restarts when one of them was. Flags after `--`
// go to the app (`pnpm desktop:dev -- --mock`). Closing the window ends it.

import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { context } from "esbuild";
import { createServer } from "vite";
import { desktopDir, electronPath, nodeBundles, webDir } from "./common.ts";

/** The dev server's port for the desktop app: not 5173, so the browser dev server can run beside it. */
const DEV_PORT = 5183;
/** Rebuilds that finish within this of each other restart the app once. */
const RESTART_DEBOUNCE_MS = 150;

const server = await createServer({
  root: webDir,
  configFile: join(webDir, "vite.config.ts"),
  server: { port: DEV_PORT, strictPort: false },
});
await server.listen();
const url = server.resolvedUrls?.local[0];
if (url === undefined) throw new Error("the dev server has no local URL");
console.log(`renderer: ${url}`);

const appFlags = process.argv.slice(2).filter((a) => a !== "--");
let app: ChildProcess | null = null;
let stopping = false;
let timer: NodeJS.Timeout | null = null;

function startApp(): void {
  const child = spawn(electronPath(), [desktopDir, `--dev-server=${url}`, ...appFlags], { stdio: "inherit" });
  app = child;
  child.on("exit", () => {
    // The window was closed (not a restart of ours): the session is over.
    if (app === child && !stopping) void stop(0);
  });
}

function restartApp(): void {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    const old = app;
    app = null;
    old?.kill();
    if (!stopping) startApp();
  }, RESTART_DEBOUNCE_MS);
}

const bundles = nodeBundles();
let built = 0;
const contexts = await Promise.all(
  bundles.map((options) =>
    context({
      ...options,
      plugins: [
        {
          name: "restart-app",
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length > 0) return;
              built += 1;
              // The first build of each bundle starts the app once; later ones restart it.
              if (built >= bundles.length) restartApp();
            });
          },
        },
      ],
    }),
  ),
);
await Promise.all(contexts.map((c) => c.watch()));

async function stop(code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (timer !== null) clearTimeout(timer);
  app?.kill();
  await Promise.all(contexts.map((c) => c.dispose()));
  await server.close();
  process.exit(code);
}
process.on("SIGINT", () => void stop(0));
process.on("SIGTERM", () => void stop(0));
