/* =========================================================
   GideonsEarth :: osint-ui.js
   UI wiring for GideonIntel v2 OSINT engine (osint.js / window.GI)
   ========================================================= */

(function () {
  const GI = window.GI;
  if (!GI) {
    console.error("GI engine missing");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const feed = window.feed || ((k, m) => console.log(`[${k}] ${m}`));

  // ---------- WMN PAGINATION + LIVE PROBE STATE ----------
  // ── WMN CARD GRID ────────────────────────────────────────────────────────

  function siteDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  }

  function buildWMNCards(container, sites, statuses, username) {
    if (!container) return;
    statuses = statuses || new Map();
    container._wmnSites = sites;
    container._wmnStatuses = statuses;
    container._wmnUsername = username || container._wmnUsername || "";

    const total = sites.length;
    const found = [...statuses.values()].filter((v) => v === "found").length;
    const probed = [...statuses.values()].filter((v) => v !== "pending").length;
    const searchVal = container.querySelector(".wmn-card-search")?.value || "";

    const cards = sites
      .map((s) => {
        const st = statuses.get(s.name);
        const domain = siteDomain(s.url);
        const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=24`;
        const cardCls =
          st === "found"
            ? "dos-card wmn-site-card wmn-card-found"
            : st === "not_found"
              ? "dos-card wmn-site-card wmn-card-not-found"
              : "dos-card wmn-site-card wmn-card-pending";
        const hidden =
          searchVal && !s.name.toLowerCase().includes(searchVal.toLowerCase())
            ? ' style="display:none"'
            : "";
        const statusLabel =
          st === "found"
            ? "✓ Found"
            : st === "not_found"
              ? "✗ Not found"
              : "⟳ Probing…";
        return `
          <div class="${cardCls}"${hidden} data-site="${escapeHtml(s.name)}">
            <div class="dos-card-head">
              <img class="dos-card-favicon" src="${favicon}" onerror="this.style.display='none'" alt="">
              <span class="dos-card-title">${escapeHtml(s.name)}</span>
            </div>
            <div class="dos-card-preview">
              <div class="dos-preview-rows">
                ${iRow("Username", container._wmnUsername)}
                ${iRow("Category", s.category)}
                ${iRow("Status", statusLabel)}
              </div>
            </div>
            <div class="dos-card-foot">
              <a class="dos-card-foot-btn" href="${escapeHtml(s.url)}" target="_blank" title="Open profile" onclick="event.stopPropagation()">↗</a>
              <span class="dos-card-foot-btn wmn-card-domain">${escapeHtml(domain)}</span>
            </div>
          </div>`;
      })
      .join("");

    container.innerHTML = `
      <div class="wmn-card-toolbar">
        <input class="wmn-card-search" placeholder="🔍  Search ${total} sites…" type="text" autocomplete="off" value="${escapeHtml(searchVal)}">
        <div class="wmn-probe-status">
          <span class="wmn-probe-found">● ${found} found</span>
          &nbsp;·&nbsp;
          <span class="wmn-probe-scanned">${probed} / ${total}</span>
          ${probed < total ? '<span class="wmn-probe-spinner">↻</span>' : ""}
        </div>
      </div>
      <div class="wmn-cards-grid">${cards}</div>`;

    const inp = container.querySelector(".wmn-card-search");
    if (inp) {
      inp.focus();
      inp.addEventListener("input", () => {
        const q = inp.value.toLowerCase().trim();
        container.querySelectorAll(".wmn-site-card").forEach((c) => {
          const name = c.dataset.site?.toLowerCase() || "";
          c.style.display = !q || name.includes(q) ? "" : "none";
        });
      });
    }
  }

  // Fire background probes and update cards live
  function startWMNProbe(username, container) {
    if (!container) return;
    const sites = container._wmnSites || [];
    const statuses = container._wmnStatuses || new Map();
    sites.forEach((s) => {
      if (!statuses.has(s.name)) statuses.set(s.name, "pending");
    });

    let renderTimer = null;
    function scheduleRender() {
      if (renderTimer) return;
      renderTimer = setTimeout(() => {
        renderTimer = null;
        buildWMNCards(container, container._wmnSites, statuses, container._wmnUsername);
      }, 150);
    }

    GI.usernameProbe(username, (hit) => {
      statuses.set(hit.site, hit.status === "reachable" ? "found" : "not_found");
      scheduleRender();
    });
  }

  // ---------- DOSSIER ----------
  const dosIn = $("dos-input");
  const dosCls = $("dos-class");
  const dosOut = $("dos-result");
  const hibpKeyEl = $("hibp-key");
  let lastReport = null;

  // Persist HIBP key
  if (hibpKeyEl) {
    hibpKeyEl.value = localStorage.getItem("gi:hibp") || "";
    hibpKeyEl.addEventListener("change", () =>
      localStorage.setItem("gi:hibp", hibpKeyEl.value.trim()),
    );
  }

  function showClass(input) {
    const c = GI.classify(input);
    dosCls.innerHTML = `<div class="kv"><span class="k">CLASSIFIED</span><span class="v">${c.kind.toUpperCase()}</span></div>
                            <div class="kv"><span class="k">TARGET</span><span class="v">${c.q || "—"}</span></div>`;
    return c;
  }
  if (dosIn) {
    dosIn.addEventListener("input", () => showClass(dosIn.value));
  }

  async function runSweep() {
    const q = dosIn.value.trim();
    if (!q) return;
    showClass(q);
    dosOut.innerHTML = `<div class="placeholder">// sweeping ${q}…</div>`;
    feed("warn", `DOSSIER :: sweeping ${q}`);
    const report = await GI.dossier(q, {
      hibpKey: (localStorage.getItem("gi:hibp") || "").trim(),
    });
    lastReport = report;
    renderReport(report);
    feed("ok", `DOSSIER :: complete in ${report.finishedMs} ms`);
    // Pin to globe if we have geo
    const geo = report.modules && report.modules.geoip;
    if (geo && geo.lat && geo.lon && window.pinTarget) {
      window.pinTarget({
        label: q,
        lat: geo.lat,
        lon: geo.lon,
        meta: `${geo.city || "?"}, ${geo.country_code || "?"} · ${geo.org || "?"}`,
      });
    }
  }

  // ── module meta: icon, title, accent colour, full-width flag ──────────────
  const MOD_META = {
    geoip: { favicon: "ipinfo.io", title: "GEO-IP", wide: false },
    shodan: { favicon: "shodan.io", title: "Shodan", wide: false },
    bgp: { favicon: "bgpview.io", title: "BGP / ASN", wide: false },
    dns: { favicon: "cloudflare-dns.com", title: "DNS", wide: false },
    certs: { favicon: "crt.sh", title: "Cert Transparency", wide: true },
    rdap: { favicon: "rdap.org", title: "RDAP / WHOIS", wide: false },
    urlscan: { favicon: "urlscan.io", title: "URLScan", wide: false },
    wayback: { favicon: "archive.org", title: "Wayback Machine", wide: false },
    email: { favicon: "gravatar.com", title: "Email", wide: false },
    username: { favicon: "whatsmyname.app", title: "WhatsMyName", wide: true },
    github: { favicon: "github.com", title: "GitHub", wide: true },
    hibp: {
      favicon: "haveibeenpwned.com",
      title: "HaveIBeenPwned",
      wide: true,
    },
  };

  // ── inline "Label: Value" row helper ─────────────────────────────────────
  function iRow(key, val) {
    if (val == null || val === "" || val === "undefined" || val === "null")
      return "";
    return `<div class="dos-irow"><span class="dos-irow-key">${escapeHtml(String(key))}:</span><span class="dos-irow-val">${escapeHtml(String(val))}</span></div>`;
  }

  // ── compact card preview — PayPal-style inline KV + photo top-right ───────
  function renderCardPreview(mod, d) {
    if (!d) return '<span class="dos-preview-empty">no data</span>';
    if (d.error)
      return `<span class="dos-preview-err">⚠ ${escapeHtml(d.error)}</span>`;

    // Profile photo (top-right float)
    let photo = "";
    if (mod === "github" && d.user?.avatar_url)
      photo = `<img class="dos-card-photo" src="${escapeHtml(d.user.avatar_url)}" alt="">`;
    else if (mod === "email" && d.gravatar_exists)
      photo = `<img class="dos-card-photo" src="${escapeHtml(d.gravatar_url)}&s=80" alt="">`;

    let rows = "";
    switch (mod) {
      case "geoip":
        rows = [
          iRow("IP", d.ip),
          iRow("City", d.city),
          iRow(
            "Country",
            d.country
              ? `${d.country} (${d.country_code || ""})`
              : d.country_code,
          ),
          iRow("Org", d.org),
          iRow("ASN", d.asn),
          iRow("Timezone", d.timezone),
        ].join("");
        break;
      case "shodan":
        rows = [
          iRow("IP", d.ip),
          iRow("Ports", (d.ports || []).join(", ") || "none"),
          iRow("CVEs", (d.vulns || []).join(", ") || "none"),
          iRow("Hostnames", (d.hostnames || []).slice(0, 2).join(", ") || null),
          iRow("Tags", (d.tags || []).join(", ") || null),
        ].join("");
        break;
      case "bgp":
        rows = [
          iRow("ASN", d.asn || d.prefixes?.[0]?.asn?.asn),
          iRow("Name", d.name || d.prefixes?.[0]?.asn?.name),
          iRow("Country", d.country_code || d.prefixes?.[0]?.asn?.country_code),
          iRow("Prefixes", d.prefixes?.length),
        ].join("");
        break;
      case "dns": {
        const aRec  = (d.A    || [])[0]?.data || null;
        const mxRec = (d.MX   || [])[0]?.data?.replace(/^\d+\s+/, "") || null;
        const nsRec = (d.NS   || [])[0]?.data || null;
        const spf   = (d.SPF  || d.TXT || []).map(r => r.data).find(v => v?.includes("v=spf1"));
        const dmarc = (d.DMARC || []).map(r => r.data).find(v => v?.includes("v=DMARC1"));
        rows = [
          iRow("A",     aRec),
          iRow("MX",    mxRec),
          iRow("NS",    nsRec),
          iRow("SPF",   spf   ? "✓ configured" : null),
          iRow("DMARC", dmarc ? `p=${(dmarc.match(/p=(\w+)/)||[])[1] || "set"}` : null),
          iRow("Types", Object.entries(d).filter(([,v]) => Array.isArray(v) && v.length).map(([k]) => k).join(" · ")),
        ].join("");
        break;
      }
      case "certs":
        rows = [
          iRow("CT Rows", d.count),
          iRow("Subdomains", (d.subs || []).length),
          iRow("Sample", (d.subs || []).slice(0, 2).join(", ") || null),
        ].join("");
        break;
      case "rdap":
        rows = [
          iRow("Handle", d.handle),
          iRow("Name", d.name || d.ldhName),
          iRow("Status", (d.status || []).slice(0, 2).join(", ")),
        ].join("");
        break;
      case "urlscan":
        rows = [
          iRow("Total Scans", d.total || 0),
          iRow("Latest ID", (d.results || [])[0]?._id || null),
        ].join("");
        break;
      case "wayback": {
        const s = d.archived_snapshots?.closest;
        rows = s
          ? [
              iRow("Status", s.status),
              iRow("Timestamp", s.timestamp?.slice(0, 8)),
              iRow("URL", (s.url || "").slice(0, 40) + "…"),
            ].join("")
          : iRow("Status", "No snapshot");
        break;
      }
      case "email":
        rows = [
          iRow("Domain", d.domain),
          iRow("Gravatar", d.gravatar_exists ? "✓ Found" : "✗ None"),
          iRow(
            "MX",
            (d.mx || [])
              .map((r) => r.data)
              .slice(0, 2)
              .join(", ") || null,
          ),
          iRow("Disposable", d.disposable ? "⚠ Yes" : "No"),
        ].join("");
        break;
      case "username": {
        const sites = Array.isArray(d) ? d : [];
        rows = [
          iRow("Sites", sites.length),
          iRow("Action", "Click to search all"),
        ].join("");
        break;
      }
      case "github":
        rows = [
          iRow("Login", d.user?.login),
          iRow("Name", d.user?.name),
          iRow("Location", d.user?.location),
          iRow("Repos", d.user?.public_repos),
          iRow("Followers", d.user?.followers),
          iRow("Created", d.user?.created_at?.slice(0, 10)),
        ].join("");
        break;
      case "hibp": {
        const b = d.breaches || [];
        rows = [
          iRow("Breaches", b.length ? `⚠ ${b.length}` : "✓ Clean"),
          ...b
            .slice(0, 3)
            .map((br) =>
              iRow(
                br.Name,
                `${br.BreachDate} · ${Number(br.PwnCount).toLocaleString()}`,
              ),
            ),
        ].join("");
        break;
      }
      default:
        rows = iRow(mod, JSON.stringify(d).slice(0, 80));
    }

    return `${photo}<div class="dos-preview-rows">${rows}</div>`;
  }

  // ── full-screen module modal ──────────────────────────────────────────────
  function showModuleModal(mod, data, title, favicon, input) {
    document.querySelectorAll(".dos-modal-overlay").forEach((n) => n.remove());
    const ov = document.createElement("div");
    ov.className = "dos-modal-overlay";
    ov.innerHTML = `
      <div class="dos-modal">
        <div class="dos-modal-head">
          <img class="dos-card-favicon" src="https://www.google.com/s2/favicons?domain=${escapeHtml(favicon)}&sz=24" onerror="this.style.display='none'" alt="">
          <span class="dos-modal-title">${escapeHtml(title)}</span>
          <button class="dos-modal-close">✕</button>
        </div>
        <div class="dos-modal-body" id="dos-modal-body">
          ${mod === "username" ? `<div class="dos-modal-wmn"></div>` : renderCardBody(mod, data)}
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector(".dos-modal-close").onclick = () => ov.remove();
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });

    if (mod === "username") {
      const sites = Array.isArray(data) ? data : [];
      const wmn = ov.querySelector(".dos-modal-wmn");
      buildWMNCards(wmn, sites, new Map(), input || "");
      startWMNProbe(input || "", wmn);
    }
  }

  function renderReport(report) {
    // ── header strip ─────────────────────────────────────────────────────────
    const modCount = Object.keys(report.modules || {}).length;
    const header = `
      <div class="dos-header">
        <span class="dos-header-target">${escapeHtml(report.input || "—")}</span>
        <span class="dos-header-meta">${modCount} modules · ${report.finishedMs} ms</span>
      </div>
      <div class="dos-search-wrap">
        <input class="dos-grid-search" id="dos-grid-search" placeholder="🔍  Filter cards…" type="text" autocomplete="off">
      </div>`;

    // ── card grid ─────────────────────────────────────────────────────────────
    const cards = Object.entries(report.modules || {})
      .map(([mod, data]) => {
        const meta = MOD_META[mod] || {
          favicon: "",
          title: mod.toUpperCase(),
          wide: false,
        };
        const hasErr = data && data.error;
        const cardCls = `dos-card dos-card-click${hasErr ? " dos-card-err" : ""}`;
        const extLink = meta.favicon ? `https://${meta.favicon}` : "#";
        return `
        <div class="${cardCls}" data-mod="${escapeHtml(mod)}" data-search="${escapeHtml((meta.title + " " + mod).toLowerCase())}">
          <div class="dos-card-head">
            <img class="dos-card-favicon" src="https://www.google.com/s2/favicons?domain=${meta.favicon}&sz=24" onerror="this.style.display='none'" alt="">
            <span class="dos-card-title">${escapeHtml(meta.title)}</span>
          </div>
          <div class="dos-card-preview">
            ${renderCardPreview(mod, data)}
          </div>
          <div class="dos-card-foot">
            <a class="dos-card-foot-btn" href="${escapeHtml(extLink)}" target="_blank" title="Open service" onclick="event.stopPropagation()">↗</a>
            <button class="dos-card-foot-btn dos-card-foot-expand" title="Full report">⤢</button>
          </div>
        </div>`;
      })
      .join("");

    dosOut.innerHTML =
      header + `<div class="dos-grid" id="dos-grid-main">${cards}</div>`;

    // ── wire card clicks → modal ──────────────────────────────────────────────
    dosOut.querySelectorAll(".dos-card-click").forEach((card) => {
      const mod = card.dataset.mod;
      const data = report.modules[mod];
      const meta = MOD_META[mod] || { favicon: "", title: mod };
      card.addEventListener("click", () =>
        showModuleModal(mod, data, meta.title, meta.favicon, report.input),
      );
    });

    // ── wire grid search filter ───────────────────────────────────────────────
    const searchInput = document.getElementById("dos-grid-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.toLowerCase().trim();
        dosOut.querySelectorAll(".dos-card-click").forEach((card) => {
          const match =
            !q ||
            card.dataset.search.includes(q) ||
            card.textContent.toLowerCase().includes(q);
          card.style.display = match ? "" : "none";
        });
      });
    }

    // ── wire WMN card grid into dossier username module ───────────────────────
    const wmnDos = dosOut.querySelector(".wmn-dossier-container");
    if (wmnDos && report.modules && report.modules.username) {
      const sites = report.modules.username || [];
      buildWMNCards(wmnDos, sites, new Map(), report.input);
      startWMNProbe(report.input, wmnDos);
    }
  }

  // ── card body renderer ────────────────────────────────────────────────────
  function renderCardBody(mod, d) {
    if (!d) return dRow("STATUS", "—");
    if (d.error) return `<div class="dos-kv-err">${escapeHtml(d.error)}</div>`;

    switch (mod) {
      case "geoip":
        return [
          dRow("IP", d.ip),
          dRow("CITY", d.city),
          dRow("REGION", d.region),
          dRow(
            "COUNTRY",
            d.country ? `${d.country} (${d.country_code || ""})` : null,
          ),
          dRow("ORG", d.org),
          dRow("ASN", d.asn),
          dRow("TZ", d.timezone),
        ].join("");

      case "shodan":
        return [
          dRow("IP", d.ip),
          dRow("PORTS", (d.ports || []).join(", ") || "none"),
          dRow("CVEs", (d.vulns || []).join(", ") || "none"),
          dRow("HOSTNAMES", (d.hostnames || []).join(", ") || null),
          dRow("TAGS", (d.tags || []).join(", ") || null),
        ].join("");

      case "bgp":
        return [
          dRow("ASN", d.asn || d.prefixes?.[0]?.asn?.asn),
          dRow("NAME", d.name || d.prefixes?.[0]?.asn?.name),
          dRow("COUNTRY", d.country_code || d.prefixes?.[0]?.asn?.country_code),
          dRow("PREFIXES", d.prefixes ? d.prefixes.length : "—"),
        ].join("");

      case "dns": {
        // Priority order for display
        const ORDER = ["A", "AAAA", "MX", "NS", "TXT", "SPF", "DMARC", "CAA", "SOA"];
        const all = Object.entries(d).filter(([, v]) => Array.isArray(v) && v.length);
        const sorted = [
          ...ORDER.map(t => all.find(([k]) => k === t)).filter(Boolean),
          ...all.filter(([k]) => !ORDER.includes(k)),
        ];

        function cleanDnsVal(type, raw) {
          const s = String(raw || "").trim();
          // Skip raw hex CAA
          if (type === "CAA" && s.startsWith("\\#")) return null;
          // Strip outer quotes from TXT/SPF/DMARC
          if (["TXT","SPF","DMARC"].includes(type)) return s.replace(/^"|"$/g, "");
          // Truncate long IPv6
          if (type === "AAAA" && s.length > 20) return s.slice(0, 20) + "…";
          // MX: strip priority number prefix for cleaner look
          if (type === "MX") return s.replace(/^\d+\s+/, "");
          // SOA: shorten
          if (type === "SOA") return s.split(" ").slice(0, 3).join(" ");
          return s;
        }

        const rows = sorted.map(([type, recs]) => {
          const vals = recs
            .map(r => cleanDnsVal(type, r.data))
            .filter(v => v != null && v !== "");
          if (!vals.length) return "";
          return `<div class="dns-record-block">
            <span class="dns-record-type">${escapeHtml(type)}</span>
            <div class="dns-record-vals">${vals.map(v =>
              `<span class="dns-record-val">${escapeHtml(v)}</span>`
            ).join("")}</div>
          </div>`;
        }).filter(Boolean);

        return rows.join("") || dRow("STATUS", "no records");
      }

      case "certs":
        return [
          dRow("CT ROWS", d.count),
          `<div class="dos-sub-label">SUBDOMAINS</div>`,
          `<div class="dos-subs">${(d.subs || [])
            .map(
              (s) =>
                `<a class="dos-sub-chip" href="https://${s}" target="_blank">${escapeHtml(s)}</a>`,
            )
            .join("")}</div>`,
        ].join("");

      case "rdap":
        return [
          dRow("HANDLE", d.handle),
          dRow("NAME", d.name || d.ldhName),
          dRow("STATUS", (d.status || []).join(", ")),
          dRow(
            "EVENTS",
            (d.events || [])
              .map((e) => `${e.eventAction}: ${e.eventDate}`)
              .join(" · "),
          ),
        ].join("");

      case "urlscan":
        return (
          (d.results || [])
            .slice(0, 10)
            .map(
              (r) =>
                `<div class="dos-url-row">
            <span class="dos-kv-key">SCAN</span>
            <a class="dos-kv-val" href="https://urlscan.io/result/${r._id}/" target="_blank">${escapeHtml(r._id)}</a>
          </div>`,
            )
            .join("") || dRow("STATUS", "no results")
        );

      case "wayback": {
        const s = d.archived_snapshots?.closest;
        return s
          ? [
              dRow("STATUS", s.status),
              dRow("TIMESTAMP", s.timestamp),
              dRow("URL", s.url),
            ].join("")
          : dRow("STATUS", "no snapshot");
      }

      case "email": {
        const gravHtml = d.gravatar_exists
          ? `<img class="dos-avatar" src="${escapeHtml(d.gravatar_url)}&s=64" alt="gravatar"/>`
          : "";
        return [
          gravHtml,
          dRow("DOMAIN", d.domain),
          dRow("GRAVATAR", d.gravatar_exists ? "✓ found" : "✗ none"),
          dRow("HASH", d.gravatar_hash),
          dRow("MX", (d.mx || []).map((r) => r.data).join(" · ")),
          dRow("DISPOSABLE", d.disposable ? "⚠ YES" : "no"),
        ].join("");
      }

      case "username":
        return `<div class="wmn-dossier-container" style="min-height:80px"></div>`;

      case "github": {
        if (!d.user) return dRow("STATUS", "user not found");
        const avatar = d.user.avatar_url
          ? `<img class="dos-avatar" src="${escapeHtml(d.user.avatar_url)}" alt="avatar"/>`
          : "";
        const repos = (d.repos || [])
          .slice(0, 12)
          .map(
            (r) =>
              `<div class="dos-repo-row">
            <a href="${escapeHtml(r.html_url || "#")}" target="_blank" class="dos-repo-name">${escapeHtml(r.name)}</a>
            <span class="dos-repo-stars">★ ${r.stargazers_count}</span>
          </div>`,
          )
          .join("");
        return [
          `<div class="dos-gh-profile">`,
          avatar,
          `<div class="dos-gh-info">`,
          dRow("LOGIN", d.user.login),
          dRow("NAME", d.user.name),
          dRow("BIO", d.user.bio),
          `</div></div>`,
          dRow("LOCATION", d.user.location),
          dRow("COMPANY", d.user.company),
          dRow("EMAIL", d.user.email),
          dRow("BLOG", d.user.blog),
          dRow("TWITTER", d.user.twitter_username),
          dRow("REPOS", d.user.public_repos),
          dRow("FOLLOWERS", d.user.followers),
          dRow("CREATED", d.user.created_at),
          repos
            ? `<div class="dos-sub-label">REPOSITORIES</div><div class="dos-repo-list">${repos}</div>`
            : "",
        ].join("");
      }

      case "hibp":
        if (!(d.breaches || []).length)
          return dRow("STATUS", "✓ no breaches found");
        return [
          dRow("TOTAL BREACHES", d.breaches.length),
          `<div class="dos-breach-list">`,
          ...d.breaches.map(
            (b) =>
              `<div class="dos-breach-row">
              <span class="dos-breach-name">${escapeHtml(b.Name)}</span>
              <span class="dos-breach-meta">${b.BreachDate} · ${Number(b.PwnCount).toLocaleString()} accounts</span>
            </div>`,
          ),
          `</div>`,
        ].join("");

      default:
        return `<pre class="kv-json">${escapeHtml(JSON.stringify(d, null, 2))}</pre>`;
    }
  }

  // helper — one labelled row: dim key above bold value
  function dRow(key, val) {
    if (val == null || val === "" || val === "undefined") return "";
    return `<div class="dos-kv">
      <span class="dos-kv-key">${escapeHtml(String(key))}</span>
      <span class="dos-kv-val">${escapeHtml(String(val))}</span>
    </div>`;
  }

  function summary(mod, d) {
    if (!d) return "—";
    if (d.error) return d.error;
    switch (mod) {
      case "geoip":
        return `${d.city || "?"}, ${d.country_code || "?"}`;
      case "shodan":
        return `${(d.ports || []).length} port · ${(d.vulns || []).length} CVE`;
      case "bgp":
        return `${d.prefixes ? d.prefixes.length + " prefix" : d.name || "asn"}`;
      case "rdap":
        return d.handle || d.name || d.ldhName || "ok";
      case "dns":
        return Object.entries(d)
          .filter(([, v]) => Array.isArray(v) && v.length)
          .map(([k]) => k)
          .join(" · ");
      case "certs":
        return `${(d.subs || []).length} subdomains`;
      case "urlscan":
        return `${d.total || 0} scans`;
      case "wayback":
        return d.archived_snapshots && d.archived_snapshots.closest
          ? "archived"
          : "no snapshot";
      case "email":
        return d.gravatar_exists
          ? "gravatar ✓"
          : d.disposable
            ? "disposable"
            : "ok";
      case "username":
        return `${(d || []).length} sites`;
      case "github":
        return d.user
          ? `@${d.user.login} · ${d.user.public_repos} repos`
          : "none";
      case "hibp":
        return `${(d.breaches || []).length} breaches`;
      default:
        return "ok";
    }
  }

  function renderModule(mod, d) {
    if (!d) return "<div class='placeholder'>—</div>";
    if (d.error)
      return `<div class="placeholder" style="color:var(--danger)">error: ${escapeHtml(d.error)}</div>`;
    switch (mod) {
      case "geoip":
        return kvList({
          IP: d.ip,
          CITY: d.city,
          REGION: d.region,
          COUNTRY: `${d.country || ""} (${d.country_code || ""})`,
          LAT: d.lat,
          LON: d.lon,
          ORG: d.org,
          ASN: d.asn,
          TZ: d.timezone,
        });
      case "shodan":
        return [
          kvList({
            IP: d.ip,
            PORTS: (d.ports || []).join(", "),
            HOSTNAMES: (d.hostnames || []).join(", "),
            CVES: (d.vulns || []).join(", "),
            TAGS: (d.tags || []).join(", "),
          }),
        ].join("");
      case "bgp":
        return kvList({
          ASN:
            d.asn ||
            (d.prefixes &&
              d.prefixes[0] &&
              d.prefixes[0].asn &&
              d.prefixes[0].asn.asn),
          NAME:
            d.name ||
            (d.prefixes &&
              d.prefixes[0] &&
              d.prefixes[0].asn &&
              d.prefixes[0].asn.name),
          COUNTRY:
            d.country_code ||
            (d.prefixes &&
              d.prefixes[0] &&
              d.prefixes[0].asn &&
              d.prefixes[0].asn.country_code),
          PREFIXES: d.prefixes ? d.prefixes.length : "—",
        });
      case "dns":
        return Object.entries(d)
          .filter(([, v]) => Array.isArray(v) && v.length)
          .map(
            ([type, rows]) =>
              `<div class="kv"><span class="k">${type}</span><span class="v">${rows.map((r) => escapeHtml(String(r.data || ""))).join(" · ")}</span></div>`,
          )
          .join("");
      case "certs":
        return (
          `<div class="kv"><span class="k">CT ROWS</span><span class="v">${d.count}</span></div>` +
          `<div class="kv-subs">${(d.subs || []).map((s) => `<a href="https://${s}" target="_blank">${escapeHtml(s)}</a>`).join(" · ")}</div>`
        );
      case "urlscan":
        return (
          (d.results || [])
            .map(
              (r) =>
                `<div class="kv"><span class="k">${escapeHtml((r.page && r.page.domain) || "")}</span>
                     <span class="v"><a href="https://urlscan.io/result/${r._id}/" target="_blank">${escapeHtml(r._id)}</a></span></div>`,
            )
            .join("") || "<div class='placeholder'>no results</div>"
        );
      case "wayback":
        const s = d.archived_snapshots && d.archived_snapshots.closest;
        return s
          ? kvList({ STATUS: s.status, TIMESTAMP: s.timestamp, URL: s.url })
          : "<div class='placeholder'>no snapshot</div>";
      case "rdap":
        return kvList({
          HANDLE: d.handle,
          NAME: d.name,
          LDH_NAME: d.ldhName,
          STATUS: (d.status || []).join(", "),
          EVENTS: (d.events || [])
            .map((e) => `${e.eventAction}:${e.eventDate}`)
            .join(" · "),
        });
      case "email":
        return kvList({
          DOMAIN: d.domain,
          GRAVATAR: d.gravatar_exists
            ? `<img src="${d.gravatar_url}&s=48" style="height:24px;vertical-align:middle;border-radius:3px">`
            : "—",
          HASH: d.gravatar_hash,
          MX: (d.mx || []).map((r) => r.data).join(" · "),
          DISPOSABLE: d.disposable ? "YES" : "no",
        });
      case "username":
        // Rendered via buildWMNPage after innerHTML is set — return a placeholder container
        return `<div class="wmn-dossier-container"></div>`;
      case "github":
        if (!d.user) return "<div class='placeholder'>user not found</div>";
        return (
          kvList({
            LOGIN: d.user.login,
            NAME: d.user.name,
            BIO: d.user.bio,
            LOCATION: d.user.location,
            COMPANY: d.user.company,
            EMAIL: d.user.email,
            BLOG: d.user.blog,
            TWITTER: d.user.twitter_username,
            REPOS: d.user.public_repos,
            FOLLOWERS: d.user.followers,
            CREATED: d.user.created_at,
          }) +
          `<details><summary>REPOS (${d.repos.length})</summary>${d.repos.map((r) => `<div class="kv"><span class="k">${escapeHtml(r.name)}</span><span class="v">${r.stargazers_count}★</span></div>`).join("")}</details>`
        );
      case "hibp":
        return (
          (d.breaches || [])
            .map(
              (b) =>
                `<div class="kv"><span class="k">${escapeHtml(b.Name)}</span><span class="v">${b.BreachDate} · ${b.PwnCount.toLocaleString()}</span></div>`,
            )
            .join("") || "<div class='placeholder'>no breaches</div>"
        );
      default:
        return `<pre class="kv-json">${escapeHtml(JSON.stringify(d, null, 2))}</pre>`;
    }
  }

  function kvList(obj) {
    return Object.entries(obj)
      .filter(([, v]) => v != null && v !== "")
      .map(
        ([k, v]) =>
          `<div class="kv"><span class="k">${k}</span><span class="v">${typeof v === "string" && v.startsWith("<img") ? v : escapeHtml(String(v))}</span></div>`,
      )
      .join("");
  }
  function escapeHtml(s) {
    return String(s).replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
    );
  }

  $("dos-go") && $("dos-go").addEventListener("click", runSweep);
  dosIn &&
    dosIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSweep();
    });

  $("dos-trace") &&
    $("dos-trace").addEventListener("click", async () => {
      const q = dosIn.value.trim();
      if (!q) return;
      feed("warn", `TRACE :: ${q}`);
      await GI.traceroute(q);
    });
  $("dos-export-json") &&
    $("dos-export-json").addEventListener("click", () => {
      if (!lastReport) {
        feed("err", "EXPORT :: run a sweep first");
        return;
      }
      GI.exportJSON(
        lastReport,
        `gideon-${lastReport.classification.kind}-${Date.now()}.json`,
      );
    });
  $("dos-export-md") &&
    $("dos-export-md").addEventListener("click", () => {
      if (!lastReport) {
        feed("err", "EXPORT :: run a sweep first");
        return;
      }
      GI.exportMarkdown(
        lastReport,
        `gideon-${lastReport.classification.kind}-${Date.now()}.md`,
      );
    });

  // ---------- DNS ----------
  const dnsIn = $("dns-input");
  const dnsOut = $("dns-result");
  async function runDns() {
    const d = dnsIn.value.trim();
    if (!d) return;
    dnsOut.innerHTML = `<div class="placeholder">// resolving ${d}…</div>`;
    const [dns, certs, rdap] = await Promise.all([
      GI.dnsSweep(d),
      GI.certs(d),
      GI.rdap(d, "domain"),
    ]);
    dnsOut.innerHTML = `
      <details open><summary><span class="k">DNS</span> <span class="v">DoH resolved</span></summary>${renderModule("dns", dns)}</details>
      <details open><summary><span class="k">CERT TRANSPARENCY</span> <span class="v">${(certs.subs || []).length} subdomains</span></summary>${renderModule("certs", certs)}</details>
      <details><summary><span class="k">RDAP</span> <span class="v">whois</span></summary>${renderModule("rdap", rdap)}</details>`;
    feed("ok", `DNS :: ${d} resolved`);
  }
  $("dns-go") && $("dns-go").addEventListener("click", runDns);
  dnsIn &&
    dnsIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runDns();
    });

  // ---------- USERNAME ----------
  const userIn = $("user-input");
  const userOut = $("user-result");
  async function runUser() {
    const u = userIn.value.trim();
    if (!u) return;
    userOut.innerHTML = `<div class="placeholder">// hunting ${u}…</div>`;
    const [sites, gh] = await Promise.all([GI.usernameLinks(u), GI.github(u)]);
    userOut.innerHTML = `
      <details open><summary><span class="k">GITHUB</span> <span class="v">${gh.user ? "@" + gh.user.login : "not found"}</span></summary>${renderModule("github", gh)}</details>
      <details open><summary><span class="k">WHATSMYNAME</span> <span class="v">${sites.length} sites</span></summary><div class="wmn-user-container" style="padding:8px 0"></div></details>`;
    const wmnCont = userOut.querySelector(".wmn-user-container");
    buildWMNCards(wmnCont, sites, new Map(), u);
    feed("ok", `USERNAME :: ${u} → ${sites.length} sites — probing…`);
    startWMNProbe(u, wmnCont);
  }
  $("user-go") && $("user-go").addEventListener("click", runUser);
  userIn &&
    userIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runUser();
    });

  // ---------- EMAIL ----------
  const emIn = $("em-input");
  const emOut = $("em-result");
  async function runEmail() {
    const e = emIn.value.trim();
    if (!e) return;
    emOut.innerHTML = `<div class="placeholder">// checking ${e}…</div>`;
    const d = await GI.email(e);
    emOut.innerHTML = `<details open><summary><span class="k">EMAIL</span> <span class="v">${d.gravatar_exists ? "gravatar ✓" : "gravatar ✗"}${d.disposable ? " · DISPOSABLE" : ""}</span></summary>${renderModule("email", d)}</details>`;
    feed(
      d.gravatar_exists ? "ok" : "warn",
      `EMAIL :: ${e} gravatar=${d.gravatar_exists}`,
    );
  }
  $("em-go") && $("em-go").addEventListener("click", runEmail);
  emIn &&
    emIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runEmail();
    });

  $("pw-go") &&
    $("pw-go").addEventListener("click", async () => {
      const pw = $("pw-input").value;
      if (!pw) return;
      feed("warn", "HIBP :: checking password k-anonymity");
      const r = await GI.pwnedPassword(pw);
      const existing = emOut.innerHTML.includes("placeholder")
        ? ""
        : emOut.innerHTML;
      const pwBox = `<div class="kv"><span class="k">PWNED?</span><span class="v" style="color:${r.pwned ? "var(--danger)" : "var(--accent)"}">${r.pwned ? `YES · seen ${r.count.toLocaleString()} times` : "NO — clean"}</span></div>`;
      emOut.innerHTML = pwBox + existing;
      feed(
        r.pwned ? "err" : "ok",
        `HIBP :: password ${r.pwned ? "PWNED × " + r.count : "clean"}`,
      );
    });

  // ---------- Satellites toggle ----------
  const btnSats = $("btn-sats");
  let satsOn = false;
  btnSats &&
    btnSats.addEventListener("click", async () => {
      if (!satsOn) {
        satsOn = true;
        btnSats.classList.add("active");
        feed("warn", "SATS :: fetching CelesTrak TLE…");
        await GI.satellites.boot();
      } else {
        GI.satellites.clear();
        satsOn = false;
        btnSats.classList.remove("active");
        feed("warn", "SATS :: cleared");
      }
    });

  // ---------- Replay on boot (persist click history across reloads) ----------
  window.addEventListener("load", () => {
    setTimeout(() => {
      if (GI.replay && GI.replay.all().length) {
        feed(
          "ok",
          `REPLAY :: ${GI.replay.all().length} past hits available — window.GI.replay.play()`,
        );
      }
    }, 2500);
  });

  console.log("%cGideonIntel UI wired", "color:#12ffc6");
})();
