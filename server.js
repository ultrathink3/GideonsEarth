const http = require("http");
const fs = require("fs");
const path = require("path");
const { default: localtunnel } = require("localtunnel");

const PORT = 8765;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// ── LINK-TRACE: in-memory hit store ─────────────────────────────────────
// campaigns[slug] = { target, tag, hits: [{ip, ts, ua, ref}] }
const campaigns = {};

function realIP(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

const server = http.createServer((req, res) => {
  const qs = new URLSearchParams(req.url.split("?")[1] || "");
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";

  // ── CORS pre-flight ────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // ── REGISTER a new campaign (called when the operator generates a link)
  // POST /t/:slug/register  body: {target, tag}
  if (req.method === "POST" && /^\/t\/([a-z0-9]+)\/register$/.test(urlPath)) {
    const slug = urlPath.split("/")[2];
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        const { target, tag } = JSON.parse(body);
        campaigns[slug] = { target: target || "/", tag: tag || "", hits: [] };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("bad json");
      }
    });
    return;
  }

  // ── TRACKING click: GET /t/:slug  — log IP then redirect ──────────────
  if (req.method === "GET" && /^\/t\/([a-z0-9]+)$/.test(urlPath)) {
    const slug = urlPath.split("/")[2];
    const campaign = campaigns[slug];
    const ip = realIP(req);
    const hit = {
      ip,
      ts: new Date().toISOString(),
      ua: req.headers["user-agent"] || "",
      ref: req.headers["referer"] || "",
    };
    if (campaign) {
      campaign.hits.push(hit);
      console.log(`  [LINK-TRACE] /${slug} hit from ${ip}`);
    }
    const dest = campaign ? campaign.target : "/";
    res.writeHead(302, { Location: dest });
    return res.end();
  }

  // ── PUBLIC URL API: GET /api/tunnel-url ─────────────────────────────────
  if (req.method === "GET" && urlPath === "/api/tunnel-url") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ url: publicUrl || "http://localhost:" + PORT }),
    );
  }

  // ── HITS API: GET /t/:slug/hits  — return all hits for a campaign ─────
  if (req.method === "GET" && /^\/t\/([a-z0-9]+)\/hits$/.test(urlPath)) {
    const slug = urlPath.split("/")[2];
    const campaign = campaigns[slug];
    if (!campaign) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ slug, tag: campaign.tag, hits: campaign.hits }),
    );
  }

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

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": mime,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
});

// ── PUBLIC URL (localtunnel) ──────────────────────────────────────────────
let publicUrl = null;

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: PORT });
    publicUrl = tunnel.url;
    console.log("  ─────────────────────────────────────────");
    console.log("  Public URL: " + publicUrl);
    console.log("  Share this URL for real IP tracking links");
    console.log("  ─────────────────────────────────────────");
    tunnel.on("close", () => {
      console.log("  [TUNNEL] closed — restart server to get a new URL");
      publicUrl = null;
    });
    tunnel.on("error", (err) => {
      console.error("  [TUNNEL] error:", err.message);
      publicUrl = null;
    });
  } catch (err) {
    console.warn("  [TUNNEL] could not start localtunnel:", err.message);
    console.warn("  [TUNNEL] tracking links will use localhost only");
  }
}

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
  startTunnel();
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
