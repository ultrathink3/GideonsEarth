const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 8765;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".glb":  "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.join(ROOT, urlPath);

  // Stay inside ROOT — no directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("403 Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        return res.end("404 Not Found: " + urlPath);
      }
      res.writeHead(500);
      return res.end("500 Internal Server Error");
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type":                mime,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":               "no-cache",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  ██████╗ ██╗██████╗ ███████╗ ██████╗ ███╗   ██╗███████╗");
  console.log(" ██╔════╝ ██║██╔══██╗██╔════╝██╔═══██╗████╗  ██║██╔════╝");
  console.log(" ██║  ███╗██║██║  ██║█████╗  ██║   ██║██╔██╗ ██║███████╗");
  console.log(" ██║   ██║██║██║  ██║██╔══╝  ██║   ██║██║╚██╗██║╚════██║");
  console.log(" ╚██████╔╝██║██████╔╝███████╗╚██████╔╝██║ ╚████║███████║");
  console.log("  ╚═════╝ ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝");
  console.log("");
  console.log("  RECON GRID SERVER // ONLINE");
  console.log("  ─────────────────────────────────────────");
  console.log("  Local:   http://localhost:" + PORT);
  console.log("  Status:  LIVE — serving from " + ROOT);
  console.log("  ─────────────────────────────────────────");
  console.log("  Ctrl+C to shut down.");
  console.log("");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("  [ERROR] Port " + PORT + " is already in use.");
    console.error("  Kill the existing process or change PORT in server.js.");
  } else {
    console.error("  [ERROR]", err.message);
  }
  process.exit(1);
});
