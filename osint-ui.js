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
  const WMN_PER_PAGE = 50;

  // statuses: Map<siteName, 'found'|'not_found'|'pending'>
  function buildWMNPage(container, sites, page, statuses) {
    if (!container) return;
    statuses = statuses || new Map();
    const total = sites.length;
    const totalPages = Math.ceil(total / WMN_PER_PAGE) || 1;
    page = Math.max(0, Math.min(page, totalPages - 1));
    const start = page * WMN_PER_PAGE;
    const slice = sites.slice(start, start + WMN_PER_PAGE);

    const probed = [...statuses.values()].filter((v) => v !== "pending").length;
    const found = [...statuses.values()].filter((v) => v === "found").length;
    const probeBar =
      statuses.size > 0
        ? `<div class="wmn-probe-status">
           <span class="wmn-probe-found">● ${found} found</span>
           &nbsp;·&nbsp;
           <span class="wmn-probe-scanned">${probed} / ${total} probed</span>
           ${probed < total ? ' &nbsp;<span class="wmn-probe-spinner">↻</span>' : ""}
         </div>`
        : "";

    const links = slice
      .map((s) => {
        const st = statuses.get(s.name);
        const cls =
          st === "found"
            ? "user-site wmn-found"
            : st === "not_found"
              ? "user-site wmn-not-found"
              : "user-site wmn-pending";
        return `<a class="${cls}" href="${escapeHtml(s.url)}" target="_blank" title="${escapeHtml(s.category || "")}">${escapeHtml(s.name)}</a>`;
      })
      .join(" ");

    const pageBar =
      totalPages > 1
        ? `<div class="wmn-pagebar">
                <button class="btn-ghost wmn-prev" ${page === 0 ? "disabled" : ""}>◀ PREV</button>
                <span class="wmn-pageinfo">Page ${page + 1} / ${totalPages} &nbsp;·&nbsp; ${start + 1}–${Math.min(start + WMN_PER_PAGE, total)} of ${total} sites</span>
                <button class="btn-ghost wmn-next" ${page >= totalPages - 1 ? "disabled" : ""}>NEXT ▶</button>
            </div>`
        : `<div class="wmn-pageinfo">${total} sites</div>`;

    container.innerHTML = `${probeBar}<div class="wmn-links">${links}</div>${pageBar}`;

    const prev = container.querySelector(".wmn-prev");
    const next = container.querySelector(".wmn-next");
    if (prev)
      prev.onclick = () => buildWMNPage(container, sites, page - 1, statuses);
    if (next)
      next.onclick = () => buildWMNPage(container, sites, page + 1, statuses);

    // store current page on the container so probes can re-render correctly
    container._wmnPage = page;
    container._wmnSites = sites;
    container._wmnStatuses = statuses;
  }

  // Fire background probes and update badges live as results arrive
  function startWMNProbe(username, container) {
    if (!container) return;
    const sites = container._wmnSites || [];
    const statuses = container._wmnStatuses || new Map();

    // mark all as pending first
    sites.forEach((s) => {
      if (!statuses.has(s.name)) statuses.set(s.name, "pending");
    });

    let renderTimer = null;
    function scheduleRender() {
      if (renderTimer) return;
      renderTimer = setTimeout(() => {
        renderTimer = null;
        buildWMNPage(
          container,
          container._wmnSites,
          container._wmnPage || 0,
          statuses,
        );
      }, 120); // debounce — batch re-renders every 120 ms
    }

    GI.usernameProbe(username, (hit) => {
      statuses.set(
        hit.site,
        hit.status === "reachable" ? "found" : "not_found",
      );
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

  function renderReport(report) {
    const parts = [];
    parts.push(
      `<div class="kv"><span class="k">DURATION</span><span class="v">${report.finishedMs} ms</span></div>`,
    );
    for (const [mod, data] of Object.entries(report.modules || {})) {
      const err = data && data.error;
      parts.push(`<details class="kv-group" ${err ? "" : "open"}>
                <summary><span class="k">${mod.toUpperCase()}</span>
                <span class="v">${err ? "error" : summary(mod, data)}</span></summary>
                ${renderModule(mod, data)}
            </details>`);
    }
    dosOut.innerHTML = parts.join("");
    // Wire up WMN pagination + live probing inside dossier
    const wmnCont = dosOut.querySelector(".wmn-dossier-container");
    if (wmnCont && report.modules && report.modules.username) {
      buildWMNPage(wmnCont, report.modules.username || [], 0, new Map());
      startWMNProbe(report.input, wmnCont);
    }
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
      <details open><summary><span class="k">WHATSMYNAME</span> <span class="v">${sites.length} sites</span></summary><div class="wmn-user-container"></div></details>`;
    const wmnCont = userOut.querySelector(".wmn-user-container");
    buildWMNPage(wmnCont, sites, 0, new Map());
    feed("ok", `USERNAME :: ${u} → ${sites.length} sites — probing…`);
    // kick off live probes — badges go green as accounts are confirmed
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
