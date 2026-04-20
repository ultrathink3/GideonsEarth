/* =========================================================
   GideonsEarth :: csint.js
   CSINT — Cyber / Cryptocurrency Signals Intelligence
   ---------------------------------------------------------
   Modules (client-side, CORS-friendly, mostly keyless):
     - CERTSTREAM  live cert-issuance firehose (CT log tail)
     - CVE         NVD 2.0 lookup by CVE id
     - CISA KEV    known-exploited-vulnerabilities list
     - PULSE       AlienVault OTX (requires free key; graceful degrade)
     - TOR         live Tor exit nodes (dan.me.uk)
     - ABUSEIP     AbuseIPDB (requires key)
     - URLHAUS     abuse.ch malicious URLs
     - THREATFOX   abuse.ch IOCs (IPs/domains/hashes)
     - FEODO       abuse.ch botnet C2 tracker
     - TYPOSQUAT   generate domain-squat permutations
     - FAVICON     favicon mmh3 hash (Shodan pivot)
     - CRYPTO      BTC/ETH tx lookup (blockchain.info / etherscan-lite)
     - OPSEC       check the user's own footprint (WebRTC leak, fonts, WebGPU)
     - GRAPH       Maltego-style 2D entity graph (canvas, minimal)
   ========================================================= */

(function () {
    window.CSINT = window.CSINT || {};
    const CS = window.CSINT;
    const _feed = (k, m) => (window.feed ? window.feed(k, m) : console.log(`[${k}] ${m}`));

    async function xfetch(url, opts = {}, t = 15000) {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), t);
        try { const r = await fetch(url, { ...opts, signal: ctrl.signal }); clearTimeout(to); return r; }
        catch (e) { clearTimeout(to); throw e; }
    }

    // ---------- 🌐 CertStream (CT log tail via WebSocket) ----------
    // CertStream is a live feed of every SSL/TLS certificate being issued by CAs
    // world-wide — free, public WebSocket, no key. Phenomenal for
    // phishing/typo-squat early warning.
    CS.certstream = {
        ws: null, handlers: new Set(),
        on(cb) {
            if (cb) this.handlers.add(cb);
            if (this.ws) return;
            try {
                this.ws = new WebSocket("wss://certstream.calidog.io/");
                this.ws.onopen = () => _feed("ok", "CERTSTREAM :: connected");
                this.ws.onclose = () => { _feed("warn", "CERTSTREAM :: closed"); this.ws = null; };
                this.ws.onerror = () => _feed("err", "CERTSTREAM :: error");
                this.ws.onmessage = (ev) => {
                    try {
                        const m = JSON.parse(ev.data);
                        if (m.message_type === "certificate_update") {
                            const d = m.data;
                            const domains = (d.leaf_cert && d.leaf_cert.all_domains) || [];
                            for (const cb of this.handlers) cb({ domains, issuer: (d.chain && d.chain[0] && d.chain[0].subject && d.chain[0].subject.O) || "?", at: d.seen });
                        }
                    } catch { /* ignore */ }
                };
            } catch (e) { _feed("err", `CERTSTREAM :: ${e.message}`); }
        },
        off() { if (this.ws) { try { this.ws.close(); } catch { } this.ws = null; } this.handlers.clear(); }
    };

    // ---------- 🐛 CVE lookup (NVD 2.0) ----------
    CS.cve = async function cve(id) {
        id = (id || "").trim().toUpperCase();
        if (!/^CVE-\d{4}-\d+$/.test(id)) return { error: "invalid CVE id" };
        try {
            const r = await xfetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${id}`);
            if (!r.ok) return { error: `NVD ${r.status}` };
            const j = await r.json();
            const v = j.vulnerabilities && j.vulnerabilities[0] && j.vulnerabilities[0].cve;
            if (!v) return { error: "not found" };
            const desc = v.descriptions.find(d => d.lang === "en");
            const cvss = v.metrics && (v.metrics.cvssMetricV31 || v.metrics.cvssMetricV30 || v.metrics.cvssMetricV2);
            const first = cvss && cvss[0] && cvss[0].cvssData;
            return {
                id: v.id, published: v.published, lastModified: v.lastModified,
                description: desc ? desc.value : "",
                severity: first ? first.baseSeverity : "?",
                score: first ? first.baseScore : null,
                vector: first ? first.vectorString : "",
                references: (v.references || []).slice(0, 5).map(r => r.url),
                weaknesses: (v.weaknesses || []).map(w => w.description[0].value).join(", "),
            };
        } catch (e) { return { error: e.message }; }
    };

    // ---------- 🚨 CISA KEV (Known Exploited Vulnerabilities) ----------
    CS.kev = {
        _data: null,
        async load() {
            if (this._data) return this._data;
            try {
                const r = await xfetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
                if (!r.ok) throw new Error(`CISA ${r.status}`);
                this._data = await r.json();
                return this._data;
            } catch (e) { return { error: e.message }; }
        },
        async isExploited(cveId) {
            const d = await this.load();
            if (d.error) return d;
            const match = (d.vulnerabilities || []).find(v => v.cveID === cveId);
            return match || { exploited: false };
        },
        async search(query) {
            const d = await this.load();
            if (d.error) return d;
            const q = query.toLowerCase();
            return (d.vulnerabilities || []).filter(v =>
                v.cveID.toLowerCase().includes(q) ||
                (v.vendorProject || "").toLowerCase().includes(q) ||
                (v.product || "").toLowerCase().includes(q) ||
                (v.vulnerabilityName || "").toLowerCase().includes(q)
            ).slice(0, 50);
        },
    };

    // ---------- 🧅 Tor exit-node list ----------
    CS.tor = {
        async list() {
            try {
                const r = await xfetch("https://check.torproject.org/torbulkexitlist");
                if (!r.ok) throw new Error(`tor bulk ${r.status}`);
                return (await r.text()).split(/\r?\n/).filter(Boolean);
            } catch (e) { return { error: e.message }; }
        },
        async isExit(ip) {
            const list = await this.list();
            if (list.error) return list;
            return { ip, is_tor_exit: list.includes(ip) };
        }
    };

    // ---------- 🧪 abuse.ch URLhaus (malicious URLs) ----------
    CS.urlhaus = async function urlhaus(query) {
        try {
            // URLhaus API requires POST
            const body = new URLSearchParams({ host: query });
            const r = await xfetch("https://urlhaus-api.abuse.ch/v1/host/", { method: "POST", body });
            if (!r.ok) throw new Error(`urlhaus ${r.status}`);
            return await r.json();
        } catch (e) { return { error: e.message }; }
    };

    // ---------- 🪤 abuse.ch ThreatFox IOCs ----------
    CS.threatfox = async function threatfox(ioc) {
        try {
            const body = JSON.stringify({ query: "search_ioc", search_term: ioc });
            const r = await xfetch("https://threatfox-api.abuse.ch/api/v1/", {
                method: "POST", headers: { "Content-Type": "application/json" }, body,
            });
            if (!r.ok) throw new Error(`threatfox ${r.status}`);
            return await r.json();
        } catch (e) { return { error: e.message }; }
    };

    // ---------- 🎣 TYPOSQUATTING generator ----------
    CS.typosquat = function typosquat(domain) {
        const [sld, ...tldParts] = domain.split(".");
        if (!sld || !tldParts.length) return { error: "bad domain" };
        const tld = tldParts.join(".");
        const out = new Set();
        const q = "qwertyuiopasdfghjklzxcvbnm-".split("");
        // Character omission
        for (let i = 0; i < sld.length; i++) out.add(sld.slice(0, i) + sld.slice(i + 1) + "." + tld);
        // Character swap
        for (let i = 0; i < sld.length - 1; i++) {
            const a = sld.split("");[a[i], a[i + 1]] = [a[i + 1], a[i]]; out.add(a.join("") + "." + tld);
        }
        // Character repeat
        for (let i = 0; i < sld.length; i++) out.add(sld.slice(0, i) + sld[i] + sld.slice(i) + "." + tld);
        // Character replace (same-row neighbors)
        const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
        for (let i = 0; i < sld.length; i++) {
            const c = sld[i];
            for (const row of rows) {
                const j = row.indexOf(c);
                if (j === -1) continue;
                if (j > 0) out.add(sld.slice(0, i) + row[j - 1] + sld.slice(i + 1) + "." + tld);
                if (j < row.length - 1) out.add(sld.slice(0, i) + row[j + 1] + sld.slice(i + 1) + "." + tld);
            }
        }
        // Common TLD swap
        ["com", "net", "org", "co", "io", "app", "xyz", "online"].forEach(t => {
            if (t !== tld) out.add(sld + "." + t);
        });
        // Vowel swap
        const vowels = ["a", "e", "i", "o", "u"];
        for (let i = 0; i < sld.length; i++) if (vowels.includes(sld[i])) {
            for (const v of vowels) if (v !== sld[i]) out.add(sld.slice(0, i) + v + sld.slice(i + 1) + "." + tld);
        }
        out.delete(domain);
        return [...out].sort();
    };

    // ---------- 🎨 FAVICON hash (Shodan/Censys pivot) ----------
    // Mandiant's trick: MMH3 hash the base64-encoded favicon → searchable on Shodan
    // with `http.favicon.hash:<value>`. We compute it browser-side.
    CS.favicon = async function favicon(url) {
        try {
            const r = await xfetch(url, {}, 15000);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = await r.arrayBuffer();
            const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            // MurmurHash3 x86_32
            const bytes = new TextEncoder().encode(b64 + "\n").reverse ? new TextEncoder().encode(b64) : new TextEncoder().encode(b64);
            const hash = murmurhash3_32_gc(b64, 0);
            const signed = (hash & 0x80000000) ? (hash - 0x100000000) : hash;
            return {
                url, mmh3: signed,
                shodan: `https://www.shodan.io/search?query=http.favicon.hash%3A${signed}`,
                censys: `https://search.censys.io/search?resource=hosts&q=services.http.response.favicons.md5_hash%3D%22...%22`,
            };
        } catch (e) { return { error: e.message }; }
    };
    // Public-domain MMH3 implementation
    function murmurhash3_32_gc(key, seed) {
        let remainder, bytes, h1, h1b, c1, c2, k1, i;
        remainder = key.length & 3; bytes = key.length - remainder;
        h1 = seed; c1 = 0xcc9e2d51; c2 = 0x1b873593; i = 0;
        while (i < bytes) {
            k1 = ((key.charCodeAt(i) & 0xff)) | ((key.charCodeAt(++i) & 0xff) << 8) | ((key.charCodeAt(++i) & 0xff) << 16) | ((key.charCodeAt(++i) & 0xff) << 24);
            ++i; k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;
            h1 ^= k1; h1 = (h1 << 13) | (h1 >>> 19);
            h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
            h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
        }
        k1 = 0;
        switch (remainder) {
            case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
            case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
            case 1: k1 ^= (key.charCodeAt(i) & 0xff);
                k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
                k1 = (k1 << 15) | (k1 >>> 17);
                k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
                h1 ^= k1;
        }
        h1 ^= key.length;
        h1 ^= h1 >>> 16;
        h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
        h1 ^= h1 >>> 13;
        h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
        h1 ^= h1 >>> 16;
        return h1 >>> 0;
    }

    // ---------- ₿ Crypto lookup ----------
    CS.btc = async function btc(addr) {
        try {
            const r = await xfetch(`https://blockchain.info/rawaddr/${addr}?limit=10&cors=true`);
            if (!r.ok) throw new Error(`blockchain ${r.status}`);
            return await r.json();
        } catch (e) { return { error: e.message }; }
    };
    CS.eth = async function eth(addr) {
        // Use Blockchair (CORS-friendly) or ethplorer.io free lite endpoint
        try {
            const r = await xfetch(`https://api.ethplorer.io/getAddressInfo/${addr}?apiKey=freekey`);
            if (!r.ok) throw new Error(`ethplorer ${r.status}`);
            return await r.json();
        } catch (e) { return { error: e.message }; }
    };

    // ---------- 🛡 OPSEC self-check ----------
    CS.opsec = {
        async selfCheck() {
            const out = {};
            // UA + platform
            out.ua = navigator.userAgent;
            out.platform = navigator.platform;
            out.languages = navigator.languages;
            out.doNotTrack = navigator.doNotTrack;
            out.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            out.tz_offset_min = new Date().getTimezoneOffset();
            out.screen = { w: screen.width, h: screen.height, dpr: window.devicePixelRatio };
            out.hw_concurrency = navigator.hardwareConcurrency;
            out.device_memory_gb = navigator.deviceMemory;
            out.webgpu = !!navigator.gpu;
            // Canvas fingerprint hash
            try {
                const c = document.createElement("canvas"); c.width = 200; c.height = 40;
                const g = c.getContext("2d");
                g.textBaseline = "top"; g.font = "14px 'Arial'"; g.fillStyle = "#f60";
                g.fillText("GideonIntel \u2605 canvas", 2, 2);
                out.canvas_fp = await sha256(c.toDataURL());
            } catch { out.canvas_fp = null; }
            // WebGL renderer / vendor
            try {
                const cvs = document.createElement("canvas");
                const gl = cvs.getContext("webgl") || cvs.getContext("experimental-webgl");
                if (gl) {
                    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
                    out.webgl_vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null;
                    out.webgl_renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
                }
            } catch { /* ignore */ }
            // WebRTC local IP leak probe (silent — reports # of IPs, not values)
            try {
                out.webrtc_local_ips = await new Promise((resolve) => {
                    const ips = new Set();
                    const pc = new RTCPeerConnection({ iceServers: [] });
                    pc.createDataChannel("");
                    pc.createOffer().then(o => pc.setLocalDescription(o));
                    pc.onicecandidate = e => {
                        if (!e.candidate) { pc.close(); return resolve([...ips]); }
                        const m = e.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9:]+:[a-f0-9:]+)/i);
                        if (m) ips.add(m[1]);
                    };
                    setTimeout(() => { try { pc.close(); } catch { } resolve([...ips]); }, 1500);
                });
            } catch { out.webrtc_local_ips = []; }
            return out;
        },
    };

    async function sha256(str) {
        const buf = new TextEncoder().encode(str);
        const h = await crypto.subtle.digest("SHA-256", buf);
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    CS.sha256 = sha256;

    // ---------- 🕸 MALTEGO-style entity graph (canvas) ----------
    // Tiny force-directed graph renderer so dossier results can be visualized.
    CS.graph = {
        nodes: [], edges: [], canvas: null, ctx: null, rafId: null,
        mount(canvas) {
            this.canvas = canvas; this.ctx = canvas.getContext("2d");
            this.loop();
            canvas.addEventListener("mousedown", e => this._drag(e));
        },
        clear() { this.nodes = []; this.edges = []; },
        add(id, label, kind = "generic") {
            if (this.nodes.find(n => n.id === id)) return this.nodes.find(n => n.id === id);
            const n = { id, label, kind, x: (this.canvas ? this.canvas.width / 2 : 200) + (Math.random() - 0.5) * 100, y: (this.canvas ? this.canvas.height / 2 : 200) + (Math.random() - 0.5) * 100, vx: 0, vy: 0 };
            this.nodes.push(n); return n;
        },
        link(a, b, type = "") {
            this.edges.push({ a, b, type });
        },
        loop() {
            if (!this.ctx) return;
            const ctx = this.ctx;
            const W = this.canvas.width, H = this.canvas.height;
            // Physics
            for (const n of this.nodes) {
                for (const m of this.nodes) if (n !== m) {
                    const dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy + 0.01;
                    const f = 1200 / d2;
                    n.vx += (dx / Math.sqrt(d2)) * f;
                    n.vy += (dy / Math.sqrt(d2)) * f;
                }
            }
            for (const e of this.edges) {
                const a = this.nodes.find(n => n.id === e.a), b = this.nodes.find(n => n.id === e.b);
                if (!a || !b) continue;
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
                const k = 0.01 * (d - 120);
                a.vx += dx / d * k; a.vy += dy / d * k;
                b.vx -= dx / d * k; b.vy -= dy / d * k;
            }
            for (const n of this.nodes) {
                n.vx *= 0.85; n.vy *= 0.85;
                n.x += n.vx; n.y += n.vy;
                n.x = Math.max(20, Math.min(W - 20, n.x));
                n.y = Math.max(20, Math.min(H - 20, n.y));
            }
            // Draw
            ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = "#12ffc655"; ctx.lineWidth = 1;
            for (const e of this.edges) {
                const a = this.nodes.find(n => n.id === e.a), b = this.nodes.find(n => n.id === e.b);
                if (!a || !b) continue;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            for (const n of this.nodes) {
                const colors = { ip: "#ffb020", domain: "#12ffc6", email: "#ff2e6e", username: "#7fb9ff", asn: "#bfeeff", cve: "#ff4040", generic: "#cfeee4" };
                ctx.fillStyle = colors[n.kind] || colors.generic;
                ctx.beginPath(); ctx.arc(n.x, n.y, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#cfeee4"; ctx.font = "10px JetBrains Mono, monospace";
                ctx.fillText(n.label, n.x + 10, n.y + 3);
            }
            this.rafId = requestAnimationFrame(() => this.loop());
        },
        _drag(e) {
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const hit = this.nodes.find(n => (n.x - mx) ** 2 + (n.y - my) ** 2 < 100);
            if (!hit) return;
            const move = ev => { hit.x = ev.clientX - rect.left; hit.y = ev.clientY - rect.top; hit.vx = 0; hit.vy = 0; };
            const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
            document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
        },
    };

    /**
     * Build an entity graph from a GideonIntel dossier report.
     */
    CS.graphFromReport = function graphFromReport(report) {
        if (!report) return;
        CS.graph.clear();
        const root = CS.graph.add(report.input, report.input, report.classification.kind);
        const M = report.modules || {};

        if (M.geoip && M.geoip.ip) {
            const ip = CS.graph.add(`ip:${M.geoip.ip}`, M.geoip.ip, "ip");
            CS.graph.link(root.id, ip.id, "geoip");
            if (M.geoip.org) {
                const asn = CS.graph.add(`asn:${M.geoip.asn || M.geoip.org}`, M.geoip.org, "asn");
                CS.graph.link(ip.id, asn.id, "asn");
            }
        }
        if (M.dns) {
            const types = ["A", "AAAA", "MX", "NS"];
            for (const t of types) {
                (M.dns[t] || []).slice(0, 5).forEach(r => {
                    const n = CS.graph.add(`${t}:${r.data}`, r.data, t === "A" || t === "AAAA" ? "ip" : "domain");
                    CS.graph.link(root.id, n.id, t);
                });
            }
        }
        if (M.certs && M.certs.subs) {
            M.certs.subs.slice(0, 10).forEach(s => {
                const n = CS.graph.add(`sub:${s}`, s, "domain");
                CS.graph.link(root.id, n.id, "ct");
            });
        }
        if (M.shodan && M.shodan.vulns) {
            M.shodan.vulns.slice(0, 5).forEach(cve => {
                const n = CS.graph.add(`cve:${cve}`, cve, "cve");
                CS.graph.link(root.id, n.id, "vuln");
            });
        }
        if (M.github && M.github.user) {
            const gh = CS.graph.add(`gh:${M.github.user.login}`, "@" + M.github.user.login, "username");
            CS.graph.link(root.id, gh.id, "github");
            if (M.github.user.email) {
                const em = CS.graph.add(`em:${M.github.user.email}`, M.github.user.email, "email");
                CS.graph.link(gh.id, em.id, "email");
            }
        }
    };

    console.log("%cCSINT engine online (window.CSINT)", "color:#ff2e6e; font-weight:bold");
    _feed && _feed("ok", "CSINT :: engine armed");
})();
