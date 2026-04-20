/* =========================================================
   GideonsEarth :: int-ui.js
   UI wiring for GEOINT (geoint.js) + CSINT (csint.js)
   ========================================================= */

(function () {
    const GI = window.GI, GEO = window.GEOINT, CS = window.CSINT;
    const $ = (id) => document.getElementById(id);
    const feed = window.feed || ((k, m) => console.log(`[${k}] ${m}`));
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;

    // ---- Bump panel version to v3.0 ----
    const verEl = document.querySelector(".panel-ver");
    if (verEl) verEl.textContent = "v3.0 // OMNI-INT";

    // ---------- Tool-rail toggles ----------
    const toggle = (btn, onFn, offFn, label) => {
        let on = false;
        btn.addEventListener("click", async () => {
            if (!on) { btn.classList.add("active"); feed("warn", `${label} :: loading…`); on = true; await onFn(); }
            else { btn.classList.remove("active"); offFn(); on = false; feed("ok", `${label} :: cleared`); }
        });
    };
    if ($("btn-flights")) toggle($("btn-flights"), () => GEO.flights.on(), () => GEO.flights.off(), "FLIGHTS");
    if ($("btn-quakes")) toggle($("btn-quakes"), () => GEO.quakes.on("all_day"), () => GEO.quakes.off(), "QUAKES");
    if ($("btn-volcano")) toggle($("btn-volcano"), () => GEO.volcanoes.on(), () => GEO.volcanoes.off(), "VOLCANO");
    if ($("btn-gibs")) toggle($("btn-gibs"), () => GEO.gibs.trueColor(), () => GEO.gibs.off(), "GIBS");

    // ---------- GRAPH ----------
    const gcanvas = $("graph-canvas");
    if (gcanvas && CS && CS.graph) {
        // Resize to CSS width
        const resize = () => {
            const r = gcanvas.getBoundingClientRect();
            gcanvas.width = Math.max(320, r.width);
            gcanvas.height = 380;
        };
        resize(); window.addEventListener("resize", resize);
        CS.graph.mount(gcanvas);
    }
    $("graph-rebuild") && $("graph-rebuild").addEventListener("click", () => {
        if (!window._lastDossier) { feed("err", "GRAPH :: run a DOSSIER sweep first"); return; }
        CS.graphFromReport(window._lastDossier);
        feed("ok", `GRAPH :: rebuilt with ${CS.graph.nodes.length} nodes`);
    });
    $("graph-clear") && $("graph-clear").addEventListener("click", () => CS.graph.clear());

    // Hook the existing DOSSIER runner to stash the last report on window
    // (we patch osint-ui's private `lastReport` by observing the dossier button)
    $("dos-go") && $("dos-go").addEventListener("click", () => {
        // After the sweep finishes, `lastReport` inside osint-ui is not global —
        // so we piggy-back: when the dossier result DOM changes, pull from GI API.
        // osint-ui exposes nothing, so we re-run a lightweight dossier here only
        // if graph tab needs it. Cheaper: set up an observer on #dos-result.
    });
    const dosResObserver = new MutationObserver(() => {
        // Heuristic: if #dos-result has real rendered modules, take the latest
        // by re-classifying the input (lightweight) and letting the user hit
        // "Rebuild" manually for a full re-sweep → avoids doing the work twice.
    });
    const dosRes = $("dos-result");
    if (dosRes) dosResObserver.observe(dosRes, { childList: true, subtree: true });

    // Hook directly: monkey-patch GI.dossier to cache last report globally
    if (GI && GI.dossier && !GI._wrapped) {
        const orig = GI.dossier.bind(GI);
        GI.dossier = async function (...args) {
            const r = await orig(...args);
            window._lastDossier = r;
            // Auto-rebuild the graph when a new sweep finishes
            try { if (CS && CS.graph && gcanvas) CS.graphFromReport(r); } catch { }
            return r;
        };
        GI._wrapped = true;
    }

    // ---------- CSINT ----------
    $("cve-go") && $("cve-go").addEventListener("click", async () => {
        const id = $("cve-input").value.trim();
        $("cve-result").innerHTML = `<div class="placeholder">// looking up ${esc(id)}…</div>`;
        const [cve, kev] = await Promise.all([CS.cve(id), CS.kev.isExploited(id.toUpperCase())]);
        if (cve.error) { $("cve-result").innerHTML = `<div class="placeholder" style="color:var(--danger)">${esc(cve.error)}</div>`; return; }
        const kevFlag = (kev && kev.cveID) ? `<div class="kv"><span class="k">CISA KEV</span><span class="v" style="color:var(--danger)">🚨 ACTIVELY EXPLOITED — ${esc(kev.vendorProject)} ${esc(kev.product)} · added ${esc(kev.dateAdded)}</span></div>` : `<div class="kv"><span class="k">CISA KEV</span><span class="v">not in catalog</span></div>`;
        $("cve-result").innerHTML = kevFlag +
            kv("ID", cve.id) + kv("SEVERITY", `${cve.severity} (${cve.score})`) +
            kv("VECTOR", cve.vector) + kv("PUBLISHED", cve.published) +
            kv("WEAKNESS", cve.weaknesses) +
            `<div class="kv"><span class="k">SUMMARY</span><span class="v">${esc(cve.description).slice(0, 500)}…</span></div>` +
            `<div class="kv"><span class="k">REFS</span><span class="v">${cve.references.map(u => `<a href="${u}" target="_blank">${esc(u.slice(0, 40))}</a>`).join("<br>")}</span></div>`;
        feed("warn", `CVE :: ${id} · ${cve.severity} ${cve.score}${kev.cveID ? " · KEV!" : ""}`);
    });

    $("tfox-go") && $("tfox-go").addEventListener("click", async () => {
        const q = $("tfox-input").value.trim();
        $("tfox-result").innerHTML = `<div class="placeholder">// searching…</div>`;
        const r = await CS.threatfox(q);
        if (r.error) { $("tfox-result").innerHTML = `<div class="placeholder" style="color:var(--danger)">${esc(r.error)}</div>`; return; }
        if (!r.data || !r.data.length) { $("tfox-result").innerHTML = `<div class="placeholder">no IOCs found</div>`; return; }
        $("tfox-result").innerHTML = r.data.slice(0, 8).map(d =>
            kv("IOC", `${d.ioc_type}: ${d.ioc}`) +
            kv("THREAT", d.threat_type) +
            kv("MALWARE", d.malware_printable || d.malware) +
            kv("FIRST_SEEN", d.first_seen) +
            `<hr style="opacity:.1">`
        ).join("");
        feed("err", `THREATFOX :: ${r.data.length} IOC match for ${q}`);
    });

    $("typo-go") && $("typo-go").addEventListener("click", () => {
        const d = $("typo-input").value.trim();
        const list = CS.typosquat(d);
        if (list.error) { $("typo-result").innerHTML = `<div class="placeholder">${list.error}</div>`; return; }
        $("typo-result").innerHTML = `<div class="kv"><span class="k">VARIANTS</span><span class="v">${list.length}</span></div>
            <div class="kv-subs">${list.map(x => `<a href="https://${x}" target="_blank">${esc(x)}</a>`).join(" · ")}</div>`;
        feed("warn", `TYPOSQUAT :: ${list.length} variants of ${d}`);
    });

    $("fav-go") && $("fav-go").addEventListener("click", async () => {
        const u = $("fav-input").value.trim();
        $("fav-result").innerHTML = `<div class="placeholder">// fetching & hashing…</div>`;
        const r = await CS.favicon(u);
        if (r.error) { $("fav-result").innerHTML = `<div class="placeholder" style="color:var(--danger)">${esc(r.error)}</div>`; return; }
        $("fav-result").innerHTML =
            kv("URL", r.url) + kv("MMH3", r.mmh3) +
            `<div class="kv"><span class="k">SHODAN</span><span class="v"><a href="${r.shodan}" target="_blank">pivot →</a></span></div>`;
        feed("ok", `FAVICON :: mmh3 ${r.mmh3}`);
    });

    $("tor-go") && $("tor-go").addEventListener("click", async () => {
        const ip = $("tor-input").value.trim();
        $("tor-result").innerHTML = `<div class="placeholder">// checking tor list…</div>`;
        const r = await CS.tor.isExit(ip);
        if (r.error) { $("tor-result").innerHTML = `<div class="placeholder">${esc(r.error)}</div>`; return; }
        $("tor-result").innerHTML = kv("IP", r.ip) +
            `<div class="kv"><span class="k">TOR EXIT?</span><span class="v" style="color:${r.is_tor_exit ? "var(--danger)" : "var(--accent)"}">${r.is_tor_exit ? "YES — active exit node" : "no"}</span></div>`;
        feed(r.is_tor_exit ? "err" : "ok", `TOR :: ${ip} ${r.is_tor_exit ? "IS" : "is not"} an exit`);
    });

    // ---------- CERTSTREAM ----------
    const csList = $("cs-list"), csCount = $("cs-count"), csFilter = $("cs-filter");
    let csTotal = 0;
    $("cs-start") && $("cs-start").addEventListener("click", () => {
        csTotal = 0;
        CS.certstream.on((hit) => {
            const filter = (csFilter.value || "").toLowerCase();
            const match = !filter || hit.domains.some(d => d.toLowerCase().includes(filter));
            if (!match) return;
            csTotal++;
            csCount.textContent = String(csTotal);
            const div = document.createElement("div");
            div.className = "feed-item warn";
            const t = new Date((hit.at || Date.now() / 1000) * 1000).toISOString().slice(11, 19);
            div.innerHTML = `<span class="t">${t}</span><span class="m">[${esc(hit.issuer)}] ${hit.domains.slice(0, 3).map(esc).join(" · ")}</span>`;
            csList.prepend(div);
            while (csList.children.length > 200) csList.lastChild.remove();
        });
    });
    $("cs-stop") && $("cs-stop").addEventListener("click", () => {
        CS.certstream.off();
        feed("warn", "CERTSTREAM :: stopped");
    });

    // ---------- CHRONO ----------
    $("chrono-go") && $("chrono-go").addEventListener("click", async () => {
        const ts = $("chrono-ts").value.trim();
        const az = parseFloat($("chrono-az").value);
        const alt = parseFloat($("chrono-alt").value);
        if (!ts || !Number.isFinite(az) || !Number.isFinite(alt)) {
            $("chrono-result").innerHTML = `<div class="placeholder" style="color:var(--danger)">need timestamp + azimuth + altitude</div>`; return;
        }
        $("chrono-result").innerHTML = `<div class="placeholder">// scanning globe…</div>`;
        feed("warn", "CHRONO :: scanning for sun-angle matches…");
        const date = new Date(ts);
        const hits = GEO.sun.chronolocate(date, az, alt);
        if (!hits.length) {
            $("chrono-result").innerHTML = `<div class="placeholder">no matches — refine angles</div>`; return;
        }
        $("chrono-result").innerHTML = hits.map((h, i) =>
            `<div class="kv"><span class="k">CAND ${i + 1}</span><span class="v">${h.lat.toFixed(2)}, ${h.lon.toFixed(2)} · err ${(h.azErr + h.altErr).toFixed(2)}°</span></div>`
        ).join("");
        // Pin best 5 on globe
        hits.slice(0, 5).forEach((h, i) => {
            if (window.pinTarget) window.pinTarget({
                label: `CHRONO-${i + 1}`, lat: h.lat, lon: h.lon,
                meta: `sun az=${az}° alt=${alt}° @ ${ts}`,
                danger: i === 0,
            });
        });
        feed("ok", `CHRONO :: ${hits.length} candidate locations, best ${hits[0].lat.toFixed(2)}, ${hits[0].lon.toFixed(2)}`);
    });

    // ---------- OPSEC ----------
    $("opsec-go") && $("opsec-go").addEventListener("click", async () => {
        $("opsec-result").innerHTML = `<div class="placeholder">// fingerprinting your browser…</div>`;
        const r = await CS.opsec.selfCheck();
        const rows = [];
        const flag = (k, v, danger) => rows.push(`<div class="kv"><span class="k">${k}</span><span class="v"${danger ? ' style="color:var(--danger)"' : ''}>${esc(v)}</span></div>`);
        flag("UA", r.ua);
        flag("PLATFORM", r.platform);
        flag("LANGS", (r.languages || []).join(", "));
        flag("DNT", r.doNotTrack || "(not set)");
        flag("TIMEZONE", `${r.timeZone} · UTC${r.tz_offset_min > 0 ? "-" : "+"}${Math.abs(r.tz_offset_min / 60)}`);
        flag("SCREEN", `${r.screen.w}×${r.screen.h} @ ${r.screen.dpr}x`);
        flag("CPU", r.hw_concurrency + " cores");
        flag("RAM", (r.device_memory_gb || "?") + " GB");
        flag("WEBGPU", r.webgpu ? "enabled" : "off");
        flag("WEBGL", `${r.webgl_vendor || "?"} · ${r.webgl_renderer || "?"}`);
        flag("CANVAS FP", (r.canvas_fp || "").slice(0, 32) + "…");
        const leak = (r.webrtc_local_ips || []).length > 0;
        flag("WEBRTC LEAK", leak ? `${r.webrtc_local_ips.length} local IP(s) leaked: ${r.webrtc_local_ips.join(", ")}` : "no leak", leak);
        $("opsec-result").innerHTML = rows.join("");
        feed(leak ? "err" : "ok", `OPSEC :: self-check complete${leak ? " — WebRTC leak!" : ""}`);
    });

    console.log("%cGideonIntel UI (GEOINT + CSINT) wired", "color:#ffb020");
})();
