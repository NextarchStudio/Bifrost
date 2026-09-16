import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
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

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const requestedPath = resolve(root, `.${normalize(pathname)}`);
  const safePath = requestedPath.startsWith(root) ? requestedPath : join(root, "index.html");
  const filePath = existsSync(safePath) && statSync(safePath).isFile() ? safePath : join(root, "index.html");
  const isAsset = filePath.includes(`${join(root, "assets")}`);

  response.setHeader("Content-Type", mimeTypes.get(extname(filePath)) ?? "application/octet-stream");
  response.setHeader("Cache-Control", isAsset ? "public, max-age=31536000, immutable" : "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  createReadStream(filePath).pipe(response);
}).listen(3000, "0.0.0.0", () => console.info("bifrost-web listening", { port: 3000 }));
