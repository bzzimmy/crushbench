import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RUFFLE_DIR = join(ROOT, "node_modules/@ruffle-rs/ruffle");
const SWF = join(ROOT, "game/build/CandyCrush.swf");
const INDEX = join(ROOT, "web/index.html");

/** Tiny static server for the Ruffle host page. Port 0 = pick a free one. */
export function startGameServer(port = 0) {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/" || path === "/index.html") return new Response(Bun.file(INDEX));
      if (path === "/CandyCrush.swf") {
        return new Response(Bun.file(SWF), { headers: { "content-type": "application/x-shockwave-flash" } });
      }
      if (path.startsWith("/ruffle/")) {
        const f = Bun.file(join(RUFFLE_DIR, path.slice("/ruffle/".length)));
        if (await f.exists()) return new Response(f);
      }
      return new Response("not found", { status: 404 });
    },
  });
  return { url: `http://localhost:${server.port}`, stop: () => server.stop(true) };
}
