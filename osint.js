/* =========================================================
   GideonsEarth :: osint.js
   GideonIntel v2 — SOTA OSINT engine (client-side only)
   ---------------------------------------------------------
   Modules (all browser-native, CORS-friendly, no backend):
     - DOSSIER         unified target sweep (IP/domain/email/user/ASN)
     - DNS             DoH (Cloudflare + Google) A/AAAA/MX/NS/TXT/CAA/SPF/DMARC
     - CERTS           crt.sh certificate transparency → subdomains
     - RDAP WHOIS      rdap.org (domain + IP)
     - SHODAN IDB      internetdb.shodan.io (free, keyless)
     - BGP / ASN       api.bgpview.io
     - USERNAME        WhatsMyName dataset (600+ sites) — Sherlock-class
     - EMAIL           Gravatar + MX + disposable + HIBP-pwd (k-anon)
     - GITHUB          api.github.com user + repos + sniff
     - URLSCAN         urlscan.io/api/v1/search
     - WAYBACK         archive.org availability
     - SATELLITES      CelesTrak TLE + satellite.js SGP4 (ISS + custom)
     - TRACEROUTE      ASN-hop geo arcs (best-effort)
     - EXPORT          dossier JSON / Markdown
     - REPLAY          link-trace click history
   ========================================================= */

// Namespace — everything we expose goes through window.GI (GideonIntel)
window.GI = window.GI || {};
const GI = window.GI;

// Pull in helpers from the main app
const _viewer = () => window.GideonsEarth && window.GideonsEarth.viewer;
const _feed = (k, m) =>
  window.feed ? window.feed(k, m) : console.log(`[${k}] ${m}`);
const _pin = (p) => (window.pinTarget ? window.pinTarget(p) : null);

// ---------- shared fetch with timeout + retry ----------
async function xfetch(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    return r;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

// ---------- classification ----------
GI.classify = function classify(input) {
  const q = (input || "").trim();
  if (!q) return { kind: "empty", q };
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(q)) return { kind: "ipv4", q };
  // IPv6 (loose)
  if (/^[a-f0-9:]+$/i.test(q) && q.includes(":")) return { kind: "ipv6", q };
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return { kind: "email", q };
  // URL
  if (/^https?:\/\//i.test(q)) return { kind: "url", q };
  // ASN
  if (/^AS\d+$/i.test(q)) return { kind: "asn", q: q.toUpperCase() };
  // hash (md5 / sha1 / sha256)
  if (/^[a-f0-9]{32}$/i.test(q)) return { kind: "md5", q };
  if (/^[a-f0-9]{40}$/i.test(q)) return { kind: "sha1", q };
  if (/^[a-f0-9]{64}$/i.test(q)) return { kind: "sha256", q };
  // bitcoin-ish
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(q)) return { kind: "btc", q };
  // domain
  if (/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(q))
    return { kind: "domain", q: q.toLowerCase() };
  // username fallback
  if (/^[a-z0-9_.-]{2,32}$/i.test(q)) return { kind: "username", q };
  return { kind: "unknown", q };
};

// ---------- DoH (DNS over HTTPS) ----------
GI.doh = async function doh(name, type = "A") {
  // Try Cloudflare first
  try {
    const r = await xfetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { Accept: "application/dns-json" } },
    );
    if (r.ok) {
      const j = await r.json();
      return (j.Answer || []).map((a) => ({
        name: a.name,
        type: a.type,
        data: a.data,
        ttl: a.TTL,
      }));
    }
  } catch {
    /* fallthrough */
  }
  // Fallback to Google
  try {
    const r = await xfetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    );
    if (r.ok) {
      const j = await r.json();
      return (j.Answer || []).map((a) => ({
        name: a.name,
        type: a.type,
        data: a.data,
        ttl: a.TTL,
      }));
    }
  } catch {
    /* fallthrough */
  }
  return [];
};

GI.dnsSweep = async function dnsSweep(domain) {
  const types = ["A", "AAAA", "MX", "NS", "TXT", "CAA", "SOA"];
  const results = {};
  await Promise.all(
    types.map(async (t) => {
      results[t] = await GI.doh(domain, t);
    }),
  );
  // Probe common prefixes for SPF/DMARC hints
  const extra = await Promise.all([
    GI.doh(`_dmarc.${domain}`, "TXT"),
    GI.doh(`_domainkey.${domain}`, "TXT"),
  ]);
  results.DMARC = extra[0];
  results.DKIM = extra[1];
  // Extract SPF from TXT
  results.SPF = (results.TXT || []).filter((r) => /v=spf1/i.test(r.data || ""));
  return results;
};

// ---------- Certificate Transparency → subdomains ----------
GI.certs = async function certs(domain) {
  try {
    const r = await xfetch(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
    );
    if (!r.ok) return { error: `crt.sh HTTP ${r.status}`, subs: [], rows: [] };
    const rows = await r.json();
    const subs = new Set();
    for (const row of rows) {
      const name = (row.name_value || "").toLowerCase();
      name.split("\n").forEach((n) => {
        if (n && !n.startsWith("*")) subs.add(n.trim());
      });
    }
    return {
      rows: rows.slice(0, 50),
      subs: [...subs].sort(),
      count: rows.length,
    };
  } catch (e) {
    return { error: e.message, subs: [], rows: [] };
  }
};

// ---------- RDAP (modern WHOIS) ----------
GI.rdap = async function rdap(target, kind) {
  const path = kind === "ipv4" || kind === "ipv6" ? "ip" : "domain";
  try {
    const r = await xfetch(
      `https://rdap.org/${path}/${encodeURIComponent(target)}`,
    );
    if (!r.ok) return { error: `RDAP HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
};

// ---------- Shodan InternetDB (free, keyless) ----------
GI.shodan = async function shodan(ip) {
  try {
    const r = await xfetch(
      `https://internetdb.shodan.io/${encodeURIComponent(ip)}`,
    );
    if (r.status === 404)
      return { ip, ports: [], cpes: [], hostnames: [], tags: [], vulns: [] };
    if (!r.ok) return { error: `Shodan IDB HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
};

// ---------- BGPView / ASN ----------
GI.bgp = async function bgp(target) {
  // /ip/X or /asn/N
  const isAsn = /^AS\d+$/i.test(target);
  const url = isAsn
    ? `https://api.bgpview.io/asn/${target.replace(/^AS/i, "")}`
    : `https://api.bgpview.io/ip/${encodeURIComponent(target)}`;
  try {
    const r = await xfetch(url);
    if (!r.ok) return { error: `BGPView HTTP ${r.status}` };
    return (await r.json()).data;
  } catch (e) {
    return { error: e.message };
  }
};

// ---------- URLScan search ----------
GI.urlscan = async function urlscan(query) {
  try {
    const r = await xfetch(
      `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(query)}&size=20`,
    );
    if (!r.ok) return { error: `urlscan HTTP ${r.status}`, results: [] };
    const j = await r.json();
    return { total: j.total, results: j.results || [] };
  } catch (e) {
    return { error: e.message, results: [] };
  }
};

// ---------- Wayback Machine ----------
GI.wayback = async function wayback(url) {
  try {
    const r = await xfetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    );
    if (!r.ok) return { error: `wayback HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
};

// ---------- GitHub user ----------
GI.github = async function github(user) {
  try {
    const [userRes, repoRes] = await Promise.all([
      xfetch(`https://api.github.com/users/${encodeURIComponent(user)}`),
      xfetch(
        `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=30&sort=updated`,
      ),
    ]);
    const u = userRes.ok ? await userRes.json() : null;
    const repos = repoRes.ok ? await repoRes.json() : [];
    return { user: u, repos };
  } catch (e) {
    return { error: e.message };
  }
};

// ---------- Email OSINT ----------
async function md5(str) {
  // Pure-JS MD5 for Gravatar (avoids extra CDN). Adapted from public-domain impl.
  function L(k, d) {
    return (k << d) | (k >>> (32 - d));
  }
  function K(G, k) {
    let I, d, F, H, x;
    F = G & 2147483648;
    H = k & 2147483648;
    I = G & 1073741824;
    d = k & 1073741824;
    x = (G & 1073741823) + (k & 1073741823);
    if (I & d) return x ^ 2147483648 ^ F ^ H;
    if (I | d) {
      if (x & 1073741824) return x ^ 3221225472 ^ F ^ H;
      else return x ^ 1073741824 ^ F ^ H;
    }
    return x ^ F ^ H;
  }
  function r(d, F, k) {
    return (d & F) | (~d & k);
  }
  function q(d, F, k) {
    return (d & k) | (F & ~k);
  }
  function p(d, F, k) {
    return d ^ F ^ k;
  }
  function n(d, F, k) {
    return F ^ (d | ~k);
  }
  function u(G, F, aa, Z, k, H, I) {
    G = K(G, K(K(r(F, aa, Z), k), I));
    return K(L(G, H), F);
  }
  function f(G, F, aa, Z, k, H, I) {
    G = K(G, K(K(q(F, aa, Z), k), I));
    return K(L(G, H), F);
  }
  function D(G, F, aa, Z, k, H, I) {
    G = K(G, K(K(p(F, aa, Z), k), I));
    return K(L(G, H), F);
  }
  function t(G, F, aa, Z, k, H, I) {
    G = K(G, K(K(n(F, aa, Z), k), I));
    return K(L(G, H), F);
  }
  function e(G) {
    let Z,
      F = G.length,
      x = F + 8,
      k = (x - (x % 64)) / 64,
      I = (k + 1) * 16,
      aa = Array(I - 1),
      d = 0,
      H = 0;
    while (H < F) {
      Z = (H - (H % 4)) / 4;
      d = (H % 4) * 8;
      aa[Z] = aa[Z] | (G.charCodeAt(H) << d);
      H++;
    }
    Z = (H - (H % 4)) / 4;
    d = (H % 4) * 8;
    aa[Z] = aa[Z] | (0x80 << d);
    aa[I - 2] = F << 3;
    aa[I - 1] = F >>> 29;
    return aa;
  }
  function B(x) {
    let k = "",
      F = "",
      G,
      d;
    for (d = 0; d <= 3; d++) {
      G = (x >>> (d * 8)) & 255;
      F = "0" + G.toString(16);
      k = k + F.substr(F.length - 2, 2);
    }
    return k;
  }
  function J(k) {
    k = k.replace(/\r\n/g, "\n");
    let d = "";
    for (let F = 0; F < k.length; F++) {
      const x = k.charCodeAt(F);
      if (x < 128) d += String.fromCharCode(x);
      else if (x > 127 && x < 2048) {
        d += String.fromCharCode((x >> 6) | 192);
        d += String.fromCharCode((x & 63) | 128);
      } else {
        d += String.fromCharCode((x >> 12) | 224);
        d += String.fromCharCode(((x >> 6) & 63) | 128);
        d += String.fromCharCode((x & 63) | 128);
      }
    }
    return d;
  }
  let C = [],
    P,
    h,
    E,
    v,
    g,
    Y,
    X,
    W,
    V,
    S = 7,
    Q = 12,
    N = 17,
    M = 22,
    A = 5,
    z = 9,
    y = 14,
    w = 20,
    o = 4,
    m = 11,
    l = 16,
    j = 23,
    U = 6,
    T = 10,
    R = 15,
    O = 21;
  str = J(str);
  C = e(str);
  Y = 1732584193;
  X = 4023233417;
  W = 2562383102;
  V = 271733878;
  for (P = 0; P < C.length; P += 16) {
    h = Y;
    E = X;
    v = W;
    g = V;
    Y = u(Y, X, W, V, C[P + 0], S, 3614090360);
    V = u(V, Y, X, W, C[P + 1], Q, 3905402710);
    W = u(W, V, Y, X, C[P + 2], N, 606105819);
    X = u(X, W, V, Y, C[P + 3], M, 3250441966);
    Y = u(Y, X, W, V, C[P + 4], S, 4118548399);
    V = u(V, Y, X, W, C[P + 5], Q, 1200080426);
    W = u(W, V, Y, X, C[P + 6], N, 2821735955);
    X = u(X, W, V, Y, C[P + 7], M, 4249261313);
    Y = u(Y, X, W, V, C[P + 8], S, 1770035416);
    V = u(V, Y, X, W, C[P + 9], Q, 2336552879);
    W = u(W, V, Y, X, C[P + 10], N, 4294925233);
    X = u(X, W, V, Y, C[P + 11], M, 2304563134);
    Y = u(Y, X, W, V, C[P + 12], S, 1804603682);
    V = u(V, Y, X, W, C[P + 13], Q, 4254626195);
    W = u(W, V, Y, X, C[P + 14], N, 2792965006);
    X = u(X, W, V, Y, C[P + 15], M, 1236535329);
    Y = f(Y, X, W, V, C[P + 1], A, 4129170786);
    V = f(V, Y, X, W, C[P + 6], z, 3225465664);
    W = f(W, V, Y, X, C[P + 11], y, 643717713);
    X = f(X, W, V, Y, C[P + 0], w, 3921069994);
    Y = f(Y, X, W, V, C[P + 5], A, 3593408605);
    V = f(V, Y, X, W, C[P + 10], z, 38016083);
    W = f(W, V, Y, X, C[P + 15], y, 3634488961);
    X = f(X, W, V, Y, C[P + 4], w, 3889429448);
    Y = f(Y, X, W, V, C[P + 9], A, 568446438);
    V = f(V, Y, X, W, C[P + 14], z, 3275163606);
    W = f(W, V, Y, X, C[P + 3], y, 4107603335);
    X = f(X, W, V, Y, C[P + 8], w, 1163531501);
    Y = f(Y, X, W, V, C[P + 13], A, 2850285829);
    V = f(V, Y, X, W, C[P + 2], z, 4243563512);
    W = f(W, V, Y, X, C[P + 7], y, 1735328473);
    X = f(X, W, V, Y, C[P + 12], w, 2368359562);
    Y = D(Y, X, W, V, C[P + 5], o, 4294588738);
    V = D(V, Y, X, W, C[P + 8], m, 2272392833);
    W = D(W, V, Y, X, C[P + 11], l, 1839030562);
    X = D(X, W, V, Y, C[P + 14], j, 4259657740);
    Y = D(Y, X, W, V, C[P + 1], o, 2763975236);
    V = D(V, Y, X, W, C[P + 4], m, 1272893353);
    W = D(W, V, Y, X, C[P + 7], l, 4139469664);
    X = D(X, W, V, Y, C[P + 10], j, 3200236656);
    Y = D(Y, X, W, V, C[P + 13], o, 681279174);
    V = D(V, Y, X, W, C[P + 0], m, 3936430074);
    W = D(W, V, Y, X, C[P + 3], l, 3572445317);
    X = D(X, W, V, Y, C[P + 6], j, 76029189);
    Y = D(Y, X, W, V, C[P + 9], o, 3654602809);
    V = D(V, Y, X, W, C[P + 12], m, 3873151461);
    W = D(W, V, Y, X, C[P + 15], l, 530742520);
    X = D(X, W, V, Y, C[P + 2], j, 3299628645);
    Y = t(Y, X, W, V, C[P + 0], U, 4096336452);
    V = t(V, Y, X, W, C[P + 7], T, 1126891415);
    W = t(W, V, Y, X, C[P + 14], R, 2878612391);
    X = t(X, W, V, Y, C[P + 5], O, 4237533241);
    Y = t(Y, X, W, V, C[P + 12], U, 1700485571);
    V = t(V, Y, X, W, C[P + 3], T, 2399980690);
    W = t(W, V, Y, X, C[P + 10], R, 4293915773);
    X = t(X, W, V, Y, C[P + 1], O, 2240044497);
    Y = t(Y, X, W, V, C[P + 8], U, 1873313359);
    V = t(V, Y, X, W, C[P + 15], T, 4264355552);
    W = t(W, V, Y, X, C[P + 6], R, 2734768916);
    X = t(X, W, V, Y, C[P + 13], O, 1309151649);
    Y = t(Y, X, W, V, C[P + 4], U, 4149444226);
    V = t(V, Y, X, W, C[P + 11], T, 3174756917);
    W = t(W, V, Y, X, C[P + 2], R, 718787259);
    X = t(X, W, V, Y, C[P + 9], O, 3951481745);
    Y = K(Y, h);
    X = K(X, E);
    W = K(W, v);
    V = K(V, g);
  }
  return (B(Y) + B(X) + B(W) + B(V)).toLowerCase();
}

async function sha1(msg) {
  const buf = new TextEncoder().encode(msg);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

GI.md5 = md5;
GI.sha1 = sha1;

GI.email = async function email(addr) {
  const [local, domain] = addr.toLowerCase().split("@");
  const out = { address: addr, domain };
  // Gravatar existence via d=404 + HEAD-able img
  const hash = await md5(addr.toLowerCase());
  out.gravatar_hash = hash;
  out.gravatar_url = `https://gravatar.com/avatar/${hash}?d=404`;
  out.gravatar_exists = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = out.gravatar_url + "&s=32";
  });
  // MX via DoH
  out.mx = await GI.doh(domain, "MX");
  // Disposable domain list (tiny inline subset — Discard/Mailinator class)
  const DISPOSABLE = [
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "trashmail.com",
    "yopmail.com",
    "tempmail.com",
    "dispostable.com",
    "maildrop.cc",
    "getnada.com",
    "sharklasers.com",
    "fakeinbox.com",
    "tempr.email",
    "throwawaymail.com",
    "mohmal.com",
  ];
  out.disposable = DISPOSABLE.includes(domain);
  return out;
};

// HIBP password k-anon (password range API — free, no key)
GI.pwnedPassword = async function pwnedPassword(password) {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const r = await xfetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!r.ok) return { error: `HIBP HTTP ${r.status}` };
  const text = await r.text();
  for (const line of text.split(/\r?\n/)) {
    const [s, c] = line.split(":");
    if (s && s.trim() === suffix)
      return { pwned: true, count: parseInt(c, 10) };
  }
  return { pwned: false, count: 0 };
};

// HIBP breaches (requires key)
GI.hibpBreaches = async function hibpBreaches(email, apiKey) {
  if (!apiKey) return { error: "HIBP api key required" };
  try {
    const r = await xfetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: { "hibp-api-key": apiKey, "user-agent": "GideonIntel" },
      },
    );
    if (r.status === 404) return { breaches: [] };
    if (!r.ok) return { error: `HIBP HTTP ${r.status}` };
    return { breaches: await r.json() };
  } catch (e) {
    return { error: e.message };
  }
};

// ---------- Username enumeration (WhatsMyName dataset, 600+ sites) ----------
let _wmnData = null;
async function loadWMN() {
  if (_wmnData) return _wmnData;
  try {
    const r = await xfetch(
      "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json",
    );
    if (!r.ok) throw new Error(`WMN HTTP ${r.status}`);
    _wmnData = await r.json();
    return _wmnData;
  } catch (e) {
    console.warn("WhatsMyName load failed:", e);
    return { sites: [] };
  }
}

GI.usernameLinks = async function usernameLinks(username) {
  const data = await loadWMN();
  const safe = encodeURIComponent(username);
  // Filter to a safe-for-linkout subset (all sites in dataset are fine to link out)
  const sites = (data.sites || []).map((s) => ({
    name: s.name,
    category: s.cat,
    url: s.uri_pretty
      ? s.uri_pretty.replace("{account}", username)
      : s.uri_check.replace("{account}", safe),
    check_url: s.uri_check.replace("{account}", safe),
  }));
  return sites;
};

/**
 * Best-effort CORS-constrained username probe.
 *   Because most sites block cross-origin XHR, we use a no-cors fetch +
 *   img-tag fallback to check HTTP existence in an opaque way. Results are
 *   "maybe-present" rather than "confirmed". For high-confidence scans we
 *   also produce clickable dossier links.
 */
GI.usernameProbe = async function usernameProbe(
  username,
  onResult,
  { limit = Infinity } = {},
) {
  const sites = await GI.usernameLinks(username);
  const slice = limit === Infinity ? sites : sites.slice(0, limit);
  const results = [];
  await Promise.all(
    slice.map(async (s) => {
      try {
        const r = await xfetch(
          s.check_url,
          { method: "GET", mode: "no-cors" },
          6000,
        );
        // no-cors → opaque; we infer "reachable" from promise fulfilment only
        const hit = {
          site: s.name,
          url: s.url,
          check: s.check_url,
          status: "reachable",
          category: s.category,
        };
        results.push(hit);
        if (onResult) onResult(hit);
      } catch {
        const hit = {
          site: s.name,
          url: s.url,
          check: s.check_url,
          status: "blocked",
          category: s.category,
        };
        results.push(hit);
        if (onResult) onResult(hit);
      }
    }),
  );
  return results;
};

// ---------- Unified DOSSIER ----------
GI.dossier = async function dossier(input, { hibpKey } = {}) {
  const cls = GI.classify(input);
  const started = Date.now();
  const report = { input, classification: cls, started, modules: {} };

  if (cls.kind === "empty" || cls.kind === "unknown") {
    report.error = "cannot classify target";
    return report;
  }

  const tasks = [];
  const add = (name, p) =>
    tasks.push(
      p
        .then((v) => {
          report.modules[name] = v;
          _feed("ok", `DOSSIER :: ${name} ✓`);
        })
        .catch((e) => {
          report.modules[name] = { error: e.message };
          _feed("err", `DOSSIER :: ${name} → ${e.message}`);
        }),
    );

  if (cls.kind === "ipv4" || cls.kind === "ipv6") {
    add(
      "geoip",
      window.fetchGeo ? window.fetchGeo(cls.q) : Promise.resolve(null),
    );
    add("shodan", GI.shodan(cls.q));
    add("bgp", GI.bgp(cls.q));
    add("rdap", GI.rdap(cls.q, cls.kind));
    add("urlscan", GI.urlscan(cls.q));
  } else if (cls.kind === "domain") {
    add("dns", GI.dnsSweep(cls.q));
    add("certs", GI.certs(cls.q));
    add("rdap", GI.rdap(cls.q, cls.kind));
    add("urlscan", GI.urlscan(cls.q));
    add("wayback", GI.wayback(`http://${cls.q}`));
    // After DNS we also enrich resolved IPs with Shodan InternetDB
    const a = await GI.doh(cls.q, "A");
    if (a.length) {
      add("shodan", GI.shodan(a[0].data));
      add("bgp", GI.bgp(a[0].data));
      add(
        "geoip",
        window.fetchGeo ? window.fetchGeo(a[0].data) : Promise.resolve(null),
      );
    }
  } else if (cls.kind === "url") {
    const u = new URL(cls.q);
    add("urlscan", GI.urlscan(u.hostname));
    add("wayback", GI.wayback(cls.q));
    add("dns", GI.dnsSweep(u.hostname));
  } else if (cls.kind === "email") {
    add("email", GI.email(cls.q));
    const dom = cls.q.split("@")[1];
    add("dns", GI.dnsSweep(dom));
    if (hibpKey) add("hibp", GI.hibpBreaches(cls.q, hibpKey));
  } else if (cls.kind === "username") {
    add("username", GI.usernameLinks(cls.q));
    add("github", GI.github(cls.q));
  } else if (cls.kind === "asn") {
    add("bgp", GI.bgp(cls.q));
  }

  await Promise.all(tasks);
  report.finishedMs = Date.now() - started;
  return report;
};

// ---------- Satellites (CelesTrak TLE + SGP4) ----------
// Uses satellite.js (added as CDN in index.html). Renders ISS + a handful of
// high-interest payloads orbiting in real time.
GI.satellites = {
  _added: [],
  async boot() {
    if (!window.satellite) {
      _feed("warn", "SAT :: satellite.js not loaded yet, retrying");
      setTimeout(() => this.boot(), 1500);
      return;
    }
    const viewer = _viewer();
    if (!viewer) return;
    const groups = [
      {
        url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
        color: "#12ffc6",
        label: true,
      },
      {
        url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle&LIMIT=60",
        color: "#ff2e6e",
        label: false,
        limit: 60,
      },
      {
        url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle",
        color: "#ffb020",
        label: false,
      },
    ];
    for (const g of groups) {
      try {
        const r = await xfetch(g.url, {}, 15000);
        if (!r.ok) {
          _feed("err", `SAT :: fetch ${g.url} → HTTP ${r.status}`);
          continue;
        }
        const text = await r.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        let spawned = 0;
        for (let i = 0; i + 2 < lines.length; i += 3) {
          if (g.limit && spawned >= g.limit) break;
          const name = lines[i].trim();
          const l1 = lines[i + 1];
          const l2 = lines[i + 2];
          if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) continue;
          this._spawn(name, l1, l2, g.color, g.label);
          spawned++;
        }
        _feed(
          "ok",
          `SAT :: spawned ${spawned} from ${g.url.split("GROUP=")[1].split("&")[0]}`,
        );
      } catch (e) {
        _feed("err", `SAT :: ${e.message}`);
      }
    }
  },
  _spawn(name, tle1, tle2, color, showLabel) {
    const viewer = _viewer();
    const rec = window.satellite.twoline2satrec(tle1, tle2);
    const getPos = () => {
      const now = new Date();
      const pv = window.satellite.propagate(rec, now);
      if (!pv.position) return null;
      const gmst = window.satellite.gstime(now);
      const g = window.satellite.eciToGeodetic(pv.position, gmst);
      return Cesium.Cartesian3.fromDegrees(
        window.satellite.degreesLong(g.longitude),
        window.satellite.degreesLat(g.latitude),
        g.height * 1000,
      );
    };
    const ent = viewer.entities.add({
      name,
      position: new Cesium.CallbackProperty(getPos, false),
      point: {
        pixelSize: 5,
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: showLabel
        ? {
            text: name,
            font: "9px JetBrains Mono, monospace",
            fillColor: Cesium.Color.fromCssColorString(color),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(8, -6),
            scaleByDistance: new Cesium.NearFarScalar(1e6, 1.1, 5e7, 0.3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }
        : undefined,
    });
    this._added.push(ent.id);
  },
  clear() {
    const viewer = _viewer();
    if (!viewer) return;
    this._added.forEach((id) => {
      try {
        viewer.entities.removeById(id);
      } catch {}
    });
    this._added = [];
  },
};

// ---------- Export ----------
GI.exportJSON = function exportJSON(obj, filename = "gideon-dossier.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
GI.exportMarkdown = function exportMarkdown(
  report,
  filename = "gideon-dossier.md",
) {
  const L = [];
  L.push(`# GideonIntel Dossier — ${report.input}`);
  L.push(`\n**Classification:** \`${report.classification.kind}\`  `);
  L.push(`**Started:** ${new Date(report.started).toISOString()}  `);
  L.push(`**Duration:** ${report.finishedMs} ms\n`);
  for (const [mod, data] of Object.entries(report.modules || {})) {
    L.push(`## ${mod.toUpperCase()}`);
    L.push("```json");
    L.push(JSON.stringify(data, null, 2));
    L.push("```\n");
  }
  const blob = new Blob([L.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// ---------- Replay mode for link-trace clicks ----------
GI.replay = {
  _hits: JSON.parse(localStorage.getItem("gi:hits") || "[]"),
  record(hit) {
    this._hits.push({ ...hit, at: Date.now() });
    localStorage.setItem("gi:hits", JSON.stringify(this._hits.slice(-500)));
  },
  all() {
    return this._hits.slice();
  },
  clear() {
    this._hits = [];
    localStorage.removeItem("gi:hits");
  },
  async play(speedMs = 400) {
    for (const h of this._hits) {
      if (h.lat != null && h.lon != null && _pin) {
        _pin({
          label: h.label || h.slug,
          lat: h.lat,
          lon: h.lon,
          meta: h.tag,
          danger: true,
        });
        await new Promise((r) => setTimeout(r, speedMs));
      }
    }
  },
};

// ---------- Multi-hop traceroute arcs (simulated) ----------
// Real traceroute is impossible from the browser. This builds a plausible
// ASN-hop route between you and a target IP using BGPView upstream chains +
// geoip each hop, and draws a glowing arc chain on the globe.
GI.traceroute = async function traceroute(target) {
  const hops = [];
  try {
    if (window.fetchGeo) {
      const self = await window.fetchGeo("");
      if (self) hops.push({ label: "YOU", ...self });
    }
    const t = await window.fetchGeo(target);
    if (t) {
      const bgp = await GI.bgp(target);
      // Synthetic hops — we can't actually measure in-browser, so we
      // place an intermediate ASN city halfway between you and target
      if (hops.length && t) {
        const midLat = (hops[0].lat + t.lat) / 2;
        const midLon = (hops[0].lon + t.lon) / 2;
        hops.push({
          label: `ASN${(bgp && bgp.prefixes && bgp.prefixes[0] && bgp.prefixes[0].asn && bgp.prefixes[0].asn.asn) || "?"}`,
          lat: midLat,
          lon: midLon,
        });
      }
      hops.push({ label: t.ip || target, ...t });
    }
  } catch (e) {
    _feed("err", `TRACE :: ${e.message}`);
  }
  // Draw arcs
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i],
      b = hops[i + 1];
    if (window.arcPositions && _viewer()) {
      _viewer().entities.add({
        polyline: {
          positions: window.arcPositions(a.lon, a.lat, b.lon, b.lat, 300_000),
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString("#ffb020").withAlpha(0.85),
          }),
          arcType: Cesium.ArcType.NONE,
        },
      });
    }
    if (_pin)
      _pin({
        label: a.label,
        lat: a.lat,
        lon: a.lon,
        meta: `hop ${i}`,
        danger: i === hops.length - 2,
      });
  }
  if (hops.length)
    _pin({
      label: hops[hops.length - 1].label,
      lat: hops[hops.length - 1].lat,
      lon: hops[hops.length - 1].lon,
      meta: "TARGET",
      danger: true,
    });
  return hops;
};

// ---------- UI glue ----------
GI.renderKVs = function renderKVs(container, obj, depth = 0) {
  if (!container) return;
  if (obj == null) {
    container.innerHTML = `<div class="placeholder">—</div>`;
    return;
  }
  if (typeof obj !== "object") {
    container.textContent = String(obj);
    return;
  }
  const rows = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "object") {
      const label = Array.isArray(v)
        ? `${v.length} item${v.length === 1 ? "" : "s"}`
        : "{...}";
      rows.push(
        `<details class="kv-group"><summary><span class="k">${k}</span> <span class="v">${label}</span></summary><pre class="kv-json">${escapeHtml(JSON.stringify(v, null, 2))}</pre></details>`,
      );
    } else {
      rows.push(
        `<div class="kv"><span class="k">${k}</span><span class="v">${escapeHtml(String(v))}</span></div>`,
      );
    }
  }
  container.innerHTML = rows.join("");
};
function escapeHtml(s) {
  return s.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
}

// Signal ready
console.log(
  "%cGideonIntel OSINT engine v2 ready — window.GI",
  "color:#12ffc6; font-weight:bold",
);
_feed && _feed("ok", "GIDEONINTEL :: OSINT engine v2 online");
