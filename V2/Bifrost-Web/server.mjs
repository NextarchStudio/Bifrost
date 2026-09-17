import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./dist", import.meta.url)));
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Ugyldig URL.");
    return;
  }
  const requestedPath = resolve(root, `.${normalize(pathname)}`);
  const isInsideRoot = requestedPath === root || requestedPath.startsWith(`${root}${sep}`);
  const safePath = isInsideRoot ? requestedPath : join(root, "index.html");
  const filePath = existsSync(safePath) && statSync(safePath).isFile() ? safePath : join(root, "index.html");
  const isAsset = filePath.includes(`${join(root, "assets")}`);

  response.setHeader("Content-Type", mimeTypes.get(extname(filePath)) ?? "application/octet-stream");
  response.setHeader("Cache-Control", isAsset ? "public, max-age=31536000, immutable" : "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  createReadStream(filePath).pipe(response);
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info("Bifrost-Web shutting down", { signal });

  const forceTimer = setTimeout(() => {
    console.error("Bifrost-Web forcing open connections closed", { signal });
    server.closeAllConnections();
  }, 8_000);
  forceTimer.unref();

  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      console.error("Bifrost-Web shutdown failed", { error, signal });
      process.exitCode = 1;
      return;
    }
    console.info("Bifrost-Web shutdown complete", { signal });
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

const webHost = process.env.BIFROST_WEB_HOST?.trim() || "0.0.0.0";
const webPort = readPort(process.env.BIFROST_WEB_PORT, 3000, "BIFROST_WEB_PORT");

server.listen(webPort, webHost, () => console.info("Bifrost-Web listening", { host: webHost, port: webPort }));

function readPort(value, fallback, name) {
  if (value === undefined || value.trim() === "") return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`${name} må være et heltall mellom 1 og 65535.`);
  return port;
}
