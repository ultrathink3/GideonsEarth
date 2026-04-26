/* =========================================================
   GideonsEarth :: license.js
   Client-side tier gate + license-key unlock
   ---------------------------------------------------------
   Tiers:
     FREE        → GEO-IP, DNS/CERTS, USERNAME, EMAIL, LINK-TRACE,
                   TARGETS, LIVE-FEED, Defense Grid, Leaderboard
     PRO ($9/mo) → DOSSIER, GRAPH, CSINT (CVE/KEV/ThreatFox/typosquat/
                   favicon/Tor), CERTSTREAM, CHRONO, OPSEC, export JSON/MD,
                   traceroute
     ENTERPRISE ($25/mo) → GEOINT live feeds (satellites, flights,
                   quakes, volcanoes, GIBS), MODELS, WALK-MAN
     ULTIMATE ($99/mo)   → Everything in ENTERPRISE + white-label deploy,
                   team/multi-operator access, direct dev line, API webhooks,
                   LLM dossier summarizer (early access), 4h SLA support
     ADMIN               → God-mode. All gates bypassed. Internal use only.

   Keys:
     GIDEON-PRO-xxxxxxxx        (8-char signature)
     GIDEON-ENT-xxxxxxxx
     GIDEON-ULT-xxxxxxxx
     GIDEON-ADM-xxxxxxxx
   Validation is local (HMAC-ish prefix). Keys are stored in localStorage.
   In production you'd also verify server-side before enabling sensitive
   features — but paywalled OSINT runs entirely in the client, so an
   offline check is the realistic option.
   ========================================================= */

(function () {
  window.LICENSE = window.LICENSE || {};
  const L = window.LICENSE;

  const KEY_STORE = "gi:license";
  const TRIAL_STORE = "gi:license:trial"; // { key, activatedAt }
  const SECRET = "GIDEON-OMNI-INT-2026-v3"; // baseline shared secret

  // ── Revoked keys (sig portion only — add 8-char hex to kill a specific key)
  const REVOKED = new Set([
    "81FD3B4F", // GIDEON-ULT-81FD3B4F — revoked 2026-04-25
  ]);

  // Trial-key lifecycle (ms)
  //   0h  → 10h : ULTIMATE   (full access — everything unlocked)
  //  10h  → 11h : PRO        (grace period — step-down)
  //  11h+       : FREE       (expired)
  const TRIAL_ULT_MS = 10 * 60 * 60 * 1000; // 10 hours
  const TRIAL_PRO_MS = 1 * 60 * 60 * 1000; //  1 hour
  const TRIAL_TOTAL_MS = TRIAL_ULT_MS + TRIAL_PRO_MS; // 11 hours

  // --- Feature → required tier map ---
  // `free` = no gate; `pro` = PRO or better; `ent` = ENTERPRISE only; `ult` = ULTIMATE only
  const GATE = {
    // ==== FREE ====
    "tab:geo": "free",
    "tab:dns": "free",
    "tab:user": "free",
    "tab:email": "free",
    "tab:link": "free",
    "tab:targets": "free",
    "tab:feed": "free",
    "tool:defense": "free",
    "tool:leaderboard": "free",
    // ==== PRO ====
    "tab:dossier": "pro",
    "tab:graph": "pro",
    "tab:csint": "pro",
    "tab:certstream": "pro",
    "tab:chrono": "pro",
    "tab:opsec": "pro",
    "feature:traceroute": "pro",
    "feature:export-json": "pro",
    "feature:export-md": "pro",
    // ==== ENTERPRISE ====
    "tool:sats": "ent",
    "tool:flights": "ent",
    "tool:quakes": "ent",
    "tool:volcano": "ent",
    "tool:gibs": "ent",
    "tab:models": "ent",
    "tool:walk": "ent",
    // ==== ULTIMATE ====
    "feature:llm-dossier": "ult",
    "feature:webhook": "ult",
    "feature:whitelabel": "ult",
    "feature:team": "ult",
    // ==== ADMIN ====
    "feature:admin": "adm",
  };

  // --- Trial-key state helpers ---
  // A valid trial key looks like: GIDEON-T10-XXXXXXXX
  // Once activated it is stored in TRIAL_STORE with its activation timestamp.
  // currentTier() then returns "ult" → "pro" → "free" based on elapsed time.
  function readTrial() {
    try {
      const raw = localStorage.getItem(TRIAL_STORE);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !o.key || !o.activatedAt) return null;
      return o;
    } catch {
      return null;
    }
  }

  function writeTrial(obj) {
    localStorage.setItem(TRIAL_STORE, JSON.stringify(obj));
  }

  function clearTrial() {
    localStorage.removeItem(TRIAL_STORE);
  }

  // Compute { tier, phase, remainingMs } for an active trial, or null
  L.trialStatus = function trialStatus() {
    const t = readTrial();
    if (!t) return null;
    const elapsed = Date.now() - t.activatedAt;
    if (elapsed < 0) {
      // clock skew — treat as freshly activated
      return {
        tier: "ult",
        phase: "ULTIMATE",
        remainingMs: TRIAL_ULT_MS,
        totalMs: TRIAL_TOTAL_MS,
      };
    }
    if (elapsed < TRIAL_ULT_MS) {
      return {
        tier: "ult",
        phase: "ULTIMATE",
        remainingMs: TRIAL_ULT_MS - elapsed,
        totalMs: TRIAL_TOTAL_MS,
      };
    }
    if (elapsed < TRIAL_TOTAL_MS) {
      return {
        tier: "pro",
        phase: "PRO (step-down)",
        remainingMs: TRIAL_TOTAL_MS - elapsed,
        totalMs: TRIAL_TOTAL_MS,
      };
    }
    // Expired — purge and fall back to FREE
    clearTrial();
    return null;
  };

  // --- Tier state ---
  L.currentTier = function currentTier() {
    // Permanent keys take precedence over trials
    const key = (localStorage.getItem(KEY_STORE) || "").trim();
    if (key) {
      const v = validateKey(key);
      if (v.valid) return v.tier;
    }
    // Trial key (time-limited)
    const tr = L.trialStatus();
    if (tr) return tr.tier;
    return "free";
  };

  // Public: is a feature unlocked by the current tier?
  L.isUnlocked = function isUnlocked(featureId) {
    const needed = GATE[featureId];
    if (!needed || needed === "free") return true;
    const tier = L.currentTier();
    if (tier === "adm") return true; // ADMIN bypasses every gate
    if (needed === "pro")
      return tier === "pro" || tier === "ent" || tier === "ult";
    if (needed === "ent") return tier === "ent" || tier === "ult";
    if (needed === "ult") return tier === "ult";
    return false;
  };

  // Public: get the human name for a tier
  L.tierLabel = function tierLabel(t) {
    const tier = t || L.currentTier();
    return (
      {
        free: "FREE",
        pro: "PRO",
        ent: "ENTERPRISE",
        ult: "ULTIMATE",
        adm: "⚡ ADMIN",
      }[tier] || "FREE"
    );
  };

  // --- Key validation (local signature check) ---
  // Real format: "GIDEON-<TIER>-<8CHAR_SIG>"
  // The 8-char sig is the first 8 chars of SHA-256("<TIER>:<SECRET>").
  // This stops trivial guessing while keeping everything client-side.
  async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const h = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(h)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Synchronous cache of valid sig prefixes (populated on first check)
  const sigCache = {};
  async function ensureSigs() {
    if (!sigCache.pro)
      sigCache.pro = (await sha256Hex("PRO:" + SECRET))
        .slice(0, 8)
        .toUpperCase();
    if (!sigCache.ent)
      sigCache.ent = (await sha256Hex("ENT:" + SECRET))
        .slice(0, 8)
        .toUpperCase();
    if (!sigCache.ult)
      sigCache.ult = (await sha256Hex("ULT:" + SECRET))
        .slice(0, 8)
        .toUpperCase();
    if (!sigCache.ult2)
      sigCache.ult2 = (await sha256Hex("ULT2:" + SECRET))
        .slice(0, 8)
        .toUpperCase();
    if (!sigCache.adm)
      sigCache.adm = (await sha256Hex("ADM:" + SECRET))
        .slice(0, 8)
        .toUpperCase();
  }

  function validateKey(key) {
    const m = (key || "")
      .trim()
      .toUpperCase()
      .match(/^GIDEON-(PRO|ENT|ULT|ADM)-([A-F0-9]{8})$/);
    if (!m) return { valid: false };
    const [, tag, sig] = m;
    // Check revocation list before anything else
    if (REVOKED.has(sig)) return { valid: false, revoked: true };
    // ULT accepts either the original slot or the ult2 slot
    if (tag === "ULT") {
      if (!sigCache.ult || !sigCache.ult2) return { valid: false, pending: true };
      const valid = sig === sigCache.ult || sig === sigCache.ult2;
      return { valid, tier: "ult" };
    }
    const expected =
      tag === "PRO"
        ? sigCache.pro
        : tag === "ENT"
          ? sigCache.ent
          : sigCache.adm;
    if (!expected) return { valid: false, pending: true };
    const tier =
      tag === "PRO"
        ? "pro"
        : tag === "ENT"
          ? "ent"
          : "adm";
    return { valid: sig === expected, tier };
  }

  // Public: attempt to activate a user-entered key
  L.activate = async function activate(key) {
    await ensureSigs();
    const v = validateKey(key);
    if (v.revoked) return { ok: false, error: "License key has been revoked" };
    if (!v.valid) return { ok: false, error: "Invalid license key" };

    const normKey = key.trim().toUpperCase();

    // Trial key → store with timestamp, drive ULT→PRO→FREE over 11 hours
    if (v.tag === "T10") {
      // Clear any prior permanent key — trial takes over the session
      localStorage.removeItem(KEY_STORE);
      writeTrial({ key: normKey, activatedAt: Date.now() });
      _feedOK(
        `LICENSE :: 10-HOUR TRIAL activated — ULTIMATE access for 10h, then PRO for 1h.`,
      );
      return { ok: true, tier: "ult", trial: true };
    }

    // Permanent key → store, trial (if any) is superseded
    localStorage.setItem(KEY_STORE, normKey);
    _feedOK(`LICENSE :: ${L.tierLabel(v.tier)} activated — welcome operator.`);
    return { ok: true, tier: v.tier };
  };

  L.deactivate = function deactivate() {
    localStorage.removeItem(KEY_STORE);
    clearTrial();
    _feedOK("LICENSE :: deactivated — reverted to FREE tier");
  };

  // Pre-compute sigs so isUnlocked is synchronous
  ensureSigs();

  // --- Helper: log to SIGINT feed if available ---
  function _feedOK(m) {
    if (window.feed) window.feed("ok", m);
    else console.log(m);
  }
  function _feedErr(m) {
    if (window.feed) window.feed("err", m);
    else console.error(m);
  }

  // --- UNLOCK MODAL ---
  L.showUpgrade = function showUpgrade(featureId) {
    // Close any existing modal
    document.querySelectorAll(".li-modal").forEach((n) => n.remove());
    const tier = L.currentTier();
    const needed = featureId ? GATE[featureId] : null;
    const neededLabel =
      needed === "adm"
        ? "ADMIN"
        : needed === "ult"
          ? "ULTIMATE"
          : needed === "ent"
            ? "ENTERPRISE"
            : "PRO";

    const ov = document.createElement("div");
    ov.className = "li-modal";
    ov.innerHTML = `
      <div class="li-card">
        <button class="li-x" id="li-close">✕</button>
        <div class="li-brand">GIDEON<span class="accent">INTEL</span></div>
        <div class="li-sub">// OMNI-INTELLIGENCE FUSION PLATFORM</div>

        ${
          featureId
            ? `<div class="li-locked">
          🔒 <b>${featureId}</b> requires <span class="li-tier-req">${neededLabel}</span>
        </div>`
            : ""
        }

        <div class="li-grid">
          <div class="li-tier">
            <div class="li-tier-name">FREE</div>
            <div class="li-tier-price">$0</div>
            <ul>
              <li>✓ GEO-IP tracer</li>
              <li>✓ DNS + Cert-Transparency</li>
              <li>✓ Username hunt (WhatsMyName)</li>
              <li>✓ Email + HIBP password check</li>
              <li>✓ Link-Trace campaigns</li>
              <li>✓ GIDEON DEFENSE GRID</li>
              <li>✓ Global Leaderboard</li>
            </ul>
            <div class="li-cta ${tier === "free" ? "active" : ""}">${tier === "free" ? "CURRENT" : "—"}</div>
          </div>
          <div class="li-tier li-tier-pro">
            <div class="li-tier-name">PRO</div>
            <div class="li-tier-price">$9<span>/mo</span></div>
            <ul>
              <li>✓ Everything in FREE</li>
              <li>★ <b>DOSSIER</b> unified sweep</li>
              <li>★ <b>GRAPH</b> entity graph</li>
              <li>★ <b>CSINT</b> (CVE+KEV · ThreatFox · typosquat · favicon · Tor)</li>
              <li>★ <b>CERTSTREAM</b> live firehose</li>
              <li>★ <b>CHRONO</b> sun-angle</li>
              <li>★ <b>OPSEC</b> self-scan</li>
              <li>★ Export JSON / Markdown</li>
              <li>★ Traceroute arcs</li>
            </ul>
            <button class="li-cta buy" data-tier="pro">PAY WITH CRYPTO →</button>
          </div>
          <div class="li-tier li-tier-ent">
            <div class="li-tier-name">ENTERPRISE</div>
            <div class="li-tier-price">$25<span>/mo</span></div>
            <ul>
              <li>✓ Everything in PRO</li>
              <li>★ <b>GEOINT feeds</b> — live ADS-B, satellites, quakes, volcanoes, NASA GIBS</li>
              <li>★ <b>MODELS</b> 3D upload to Cesium Ion</li>
              <li>★ <b>WALK-MAN</b> first-person</li>
              <li>★ Priority support</li>
              <li>★ Custom deployments</li>
            </ul>
            <button class="li-cta buy" data-tier="ent">PAY WITH CRYPTO →</button>
          </div>
          <div class="li-tier li-tier-ult">
            <div class="li-tier-name">⚡ ULTIMATE</div>
            <div class="li-tier-price">$99<span>/mo</span></div>
            <ul>
              <li>✓ Everything in ENTERPRISE</li>
              <li>⚡ <b>LLM DOSSIER</b> — on-device AI summarizer (early access)</li>
              <li>⚡ <b>TEAM MODE</b> — multi-operator shared sessions</li>
              <li>⚡ <b>WHITE-LABEL</b> — custom branding + private deploy</li>
              <li>⚡ <b>API WEBHOOKS</b> — pipe intel into your own stack</li>
              <li>⚡ <b>DIRECT DEV LINE</b> — custom module requests</li>
              <li>⚡ 4-hour SLA support</li>
            </ul>
            <button class="li-cta buy" data-tier="ult">PAY WITH CRYPTO →</button>
          </div>
          <div class="li-tier li-tier-adm" style="border-color:#ff2e6e;box-shadow:0 0 18px rgba(255,46,110,.4)">
            <div class="li-tier-name" style="color:#ff2e6e">⚡ ADMIN</div>
            <div class="li-tier-price" style="color:#ff2e6e">INTERNAL</div>
            <ul>
              <li>🔴 <b>ALL GATES BYPASSED</b></li>
              <li>🔴 Every feature unlocked</li>
              <li>🔴 All tiers included</li>
              <li>🔴 Dev console access</li>
              <li>🔴 Internal use only</li>
            </ul>
            <div class="li-cta" style="color:#ff2e6e;border-color:#ff2e6e">NOT FOR SALE</div>
          </div>
        </div>

        <div class="li-activate">
          <label>ENTER LICENSE KEY</label>
          <div class="li-activate-row">
            <input id="li-key" type="text" placeholder="GIDEON-PRO/ENT/ULT-XXXXXXXX" autocomplete="off" />
            <button id="li-go" class="btn-primary">✓ ACTIVATE</button>
          </div>
          <div id="li-msg"></div>
          ${tier !== "free" ? `<button id="li-deact" class="btn-ghost">✕ Deactivate current ${L.tierLabel(tier)} license</button>` : ""}
        </div>

        <div class="li-foot">
          Pay in crypto → email the txid → receive your GIDEON-PRO/ENT/ULT-XXXXXXXX key within 24h.
          Keys are stored locally in your browser — no account needed.
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    document.getElementById("li-close").onclick = () => ov.remove();
    ov.addEventListener("click", (e) => {
      if (e.target === ov) ov.remove();
    });
    // Wire PAY WITH CRYPTO buttons → open the crypto wallet picker
    ov.querySelectorAll(".li-cta.buy[data-tier]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        L.showCryptoPay(btn.dataset.tier);
      });
    });
    const msgEl = document.getElementById("li-msg");
    const keyEl = document.getElementById("li-key");
    document.getElementById("li-go").onclick = async () => {
      const r = await L.activate(keyEl.value);
      if (r.ok) {
        msgEl.innerHTML = `<span style="color:var(--accent)">✓ ${L.tierLabel(r.tier)} ACTIVATED — reloading…</span>`;
        setTimeout(() => location.reload(), 800);
      } else {
        msgEl.innerHTML = `<span style="color:var(--danger)">✗ ${r.error}</span>`;
      }
    };
    keyEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("li-go").click();
    });
    const deact = document.getElementById("li-deact");
    if (deact)
      deact.onclick = () => {
        if (confirm("Deactivate your license? You will revert to FREE tier.")) {
          L.deactivate();
          location.reload();
        }
      };
  };

  // ---------- AUTO-LOCK UI ELEMENTS ----------
  // After the DOM settles, scan the recon-panel tabs and tool-rail buttons
  // and apply a lock overlay to anything the current tier can't access.
  // Clicking a locked element opens the upgrade modal instead of firing
  // the feature's own handler.

  function lockTab(tabEl, featureId) {
    if (!tabEl || L.isUnlocked(featureId)) return;
    tabEl.classList.add("li-locked-tab");
    tabEl.setAttribute("data-lock", featureId);
    // Replace tab click handler to show upgrade
    const oldHandlers = tabEl.cloneNode(true);
    tabEl.replaceWith(oldHandlers);
    oldHandlers.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        L.showUpgrade(featureId);
      },
      true,
    );
  }

  function lockTool(btn, featureId) {
    if (!btn || L.isUnlocked(featureId)) return;
    btn.classList.add("li-locked-tool");
    btn.setAttribute("data-lock", featureId);
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        L.showUpgrade(featureId);
      },
      true,
    );
  }

  function lockButton(btnId, featureId) {
    const btn = document.getElementById(btnId);
    if (!btn || L.isUnlocked(featureId)) return;
    btn.classList.add("li-locked-btn");
    // Wrap click
    const wrapped = btn.cloneNode(true);
    btn.replaceWith(wrapped);
    wrapped.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        L.showUpgrade(featureId);
      },
      true,
    );
  }

  function applyGates() {
    // --- OSINT-panel tabs ---
    document.querySelectorAll(".tab[data-tab]").forEach((tab) => {
      const id = "tab:" + tab.dataset.tab;
      if (GATE[id] && GATE[id] !== "free") lockTab(tab, id);
    });
    // --- Tool-rail buttons by id ---
    const toolMap = {
      "btn-sats": "tool:sats",
      "btn-flights": "tool:flights",
      "btn-quakes": "tool:quakes",
      "btn-volcano": "tool:volcano",
      "btn-gibs": "tool:gibs",
      "btn-walk": "tool:walk",
    };
    for (const [id, feat] of Object.entries(toolMap)) {
      const b = document.getElementById(id);
      if (b) lockTool(b, feat);
    }
    // --- Individual Pro buttons ---
    lockButton("dos-export-json", "feature:export-json");
    lockButton("dos-export-md", "feature:export-md");
    lockButton("dos-trace", "feature:traceroute");
  }

  // Format remainingMs → "HHh MMm SSs"
  function fmtDur(ms) {
    if (ms <= 0) return "0s";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) return `${h}h ${pad(m)}m ${pad(sec)}s`;
    if (m > 0) return `${m}m ${pad(sec)}s`;
    return `${sec}s`;
  }

  // --- Inject the UPGRADE button in the HUD ---
  function injectUpgradeBtn() {
    if (document.getElementById("li-upgrade-btn")) return;
    const btn = document.createElement("button");
    btn.id = "li-upgrade-btn";
    btn.className = "li-upgrade-btn";
    btn.title = "GideonIntel tiers — FREE / PRO / ENTERPRISE / ULTIMATE";
    btn.addEventListener("click", () => L.showUpgrade());
    document.body.appendChild(btn);
    refreshUpgradeBtn();
  }

  // Keep the HUD pill in sync with the live tier/trial countdown
  function refreshUpgradeBtn() {
    const btn = document.getElementById("li-upgrade-btn");
    if (!btn) return;
    const tier = L.currentTier();
    const tr = L.trialStatus();
    let label = tier === "free" ? "UPGRADE" : L.tierLabel(tier);
    let sub = "";
    btn.classList.remove("li-trial-ult", "li-trial-pro");
    if (tr) {
      sub = `<span class="li-up-sub">${fmtDur(tr.remainingMs)}</span>`;
      if (tr.tier === "ult") {
        label = "TRIAL · ULT";
        btn.classList.add("li-trial-ult");
      } else {
        label = "TRIAL · PRO";
        btn.classList.add("li-trial-pro");
      }
    }
    btn.innerHTML = `<span class="li-up-icon">💎</span>
                     <span class="li-up-label">${label}</span>${sub}`;
  }

  // Re-evaluate the trial tier every second. When the tier actually changes
  // (ULT→PRO or PRO→FREE) we refresh gates and notify the operator. This
  // gives the "drops them off and reverts back to PRO for an hour" behaviour
  // without requiring a page reload.
  let _lastTierSeen = null;
  function startTrialWatcher() {
    if (window._liTrialTimer) return;
    _lastTierSeen = L.currentTier();
    window._liTrialTimer = setInterval(() => {
      refreshUpgradeBtn();
      const now = L.currentTier();
      if (now !== _lastTierSeen) {
        _feedOK(
          `LICENSE :: trial tier transitioned ${_lastTierSeen.toUpperCase()} → ${now.toUpperCase()}`,
        );
        _lastTierSeen = now;
        // Reapply gates so now-locked features get the overlay, and locked
        // tabs that were previously open reset to the upgrade handler. A
        // soft reload keeps the active view intact without a hard refresh.
        try {
          applyGates();
        } catch {
          /* ignore */
        }
        // If the tier actually dropped, do a hard reload so every module
        // (OSINT, GEOINT, etc.) re-queries isUnlocked() cleanly.
        const rank = { free: 0, pro: 1, ent: 2, ult: 3 };
        if (rank[now] < rank[_lastTierSeen] || now === "free" || now === "pro")
          setTimeout(() => location.reload(), 1200);
      }
    }, 1000);
  }

  // Wait a moment for index.html to be fully wired, then gate everything
  function boot() {
    injectUpgradeBtn();
    applyGates();
    startTrialWatcher();
    const tr = L.trialStatus();
    if (tr) {
      _feedOK(
        `LICENSE :: TRIAL active — ${tr.phase} · ${fmtDur(tr.remainingMs)} remaining`,
      );
    }
    console.log(
      "%cLICENSE :: tier=" + L.currentTier(),
      "color:#ffb020; font-weight:bold",
    );
    _feedOK(`LICENSE :: active tier = ${L.tierLabel()}`);
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(boot, 600);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(boot, 600));
  }

  // ---------- CRYPTO PAYMENT MODAL ----------
  const WALLETS = {
    ETH: {
      label: "Ethereum / USDT-ERC20 / USDC",
      addr: "0xBbeedC09212C66C6639BdF46ebC1910De6111b46",
      icon: "⟠",
      note: "Works for ETH, USDT/USDC (ERC-20), and most EVM chains (Polygon, Arbitrum, Base, BSC).",
    },
    BTC: {
      label: "Bitcoin",
      addr: "bc1qu06prvw6085dlj5e6vuuwkx0wl8n5kka5xj7gn",
      icon: "₿",
      note: "Native SegWit (bc1q…). Lightning not yet supported — use on-chain.",
    },
    SOL: {
      label: "Solana / USDC-SPL",
      addr: "DVfJ3Hzuu4dcxWCk19Y9RLNLLAA4EeQwNP9xZRqTpaWw",
      icon: "◎",
      note: "SOL or SPL-token USDC both fine. Confirmations are near-instant.",
    },
    TRX: {
      label: "Tron / USDT-TRC20",
      addr: "TGcmWKHEx1o6sDXQhiD35HDtEzNeQAur8i",
      icon: "🔻",
      note: "Lowest fees for USDT. Send USDT-TRC20 only — do not send other networks here.",
    },
  };

  // Rough USD → crypto hints (cosmetic; the actual amount is up to the buyer)
  // Values refresh on every open via a lightweight CoinGecko fetch (optional).
  const BASE_PRICE = { pro: 9, ent: 25, ult: 99, adm: 0 };
  let rates = { BTC: 65000, ETH: 3200, SOL: 150, TRX: 0.12 }; // fallback prices
  async function refreshRates() {
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tron&vs_currencies=usd",
      );
      if (!r.ok) return;
      const j = await r.json();
      if (j.bitcoin) rates.BTC = j.bitcoin.usd;
      if (j.ethereum) rates.ETH = j.ethereum.usd;
      if (j.solana) rates.SOL = j.solana.usd;
      if (j.tron) rates.TRX = j.tron.usd;
    } catch {
      /* use fallback */
    }
  }

  L.showCryptoPay = async function showCryptoPay(tier) {
    document.querySelectorAll(".li-crypto-modal").forEach((n) => n.remove());
    const usd = BASE_PRICE[tier] || 9;
    const tierLabel = tier === "ent" ? "ENTERPRISE" : "PRO";
    await refreshRates();

    const ov = document.createElement("div");
    ov.className = "li-modal li-crypto-modal";
    ov.innerHTML = `
      <div class="li-card" style="width:min(720px,95vw)">
        <button class="li-x" id="li-cx">✕</button>
        <div class="li-brand">PAY WITH <span class="accent">CRYPTO</span></div>
        <div class="li-sub">// ${tierLabel} TIER · $${usd}/month</div>

        <div class="li-crypto-grid">
          ${Object.entries(WALLETS)
            .map(([sym, w]) => {
              const est = (usd / rates[sym]).toFixed(
                sym === "TRX" ? 2 : sym === "BTC" ? 6 : 4,
              );
              return `
            <div class="li-crypto-row">
              <div class="li-crypto-icon">${w.icon}</div>
              <div class="li-crypto-body">
                <div class="li-crypto-label">${sym} <span>— ${w.label}</span></div>
                <div class="li-crypto-addr" data-addr="${esc(w.addr)}">${esc(w.addr)}</div>
                <div class="li-crypto-meta">Approx <b>${est} ${sym}</b> · ${esc(w.note)}</div>
              </div>
              <button class="li-crypto-copy" data-copy="${esc(w.addr)}">COPY</button>
            </div>`;
            })
            .join("")}
        </div>

        <div class="li-crypto-steps">
          <div class="li-crypto-step">1. Send any amount ≥ <b>$${usd}</b> to any address above.</div>
          <div class="li-crypto-step">2. Email the transaction ID + the receiving address to
            <a href="mailto:keys@gideonintel.io?subject=${tierLabel}%20key%20request">keys@gideonintel.io</a>.</div>
          <div class="li-crypto-step">3. Receive your <b>GIDEON-${tier === "ent" ? "ENT" : "PRO"}-XXXXXXXX</b> key within 24h.</div>
          <div class="li-crypto-step" style="color:var(--text-dim)">All prices quoted in USD. Live rates from CoinGecko.</div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    document.getElementById("li-cx").onclick = () => ov.remove();
    ov.addEventListener("click", (e) => {
      if (e.target === ov) ov.remove();
    });
    // Copy-to-clipboard on COPY buttons
    ov.querySelectorAll(".li-crypto-copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const addr = btn.getAttribute("data-copy");
        navigator.clipboard.writeText(addr).then(() => {
          btn.textContent = "✓ COPIED";
          setTimeout(() => (btn.textContent = "COPY"), 1400);
        });
      });
    });
    // Clicking an address also copies
    ov.querySelectorAll(".li-crypto-addr").forEach((el) => {
      el.addEventListener("click", () => {
        navigator.clipboard.writeText(el.getAttribute("data-addr")).then(() => {
          const orig = el.textContent;
          el.textContent = "✓ copied to clipboard";
          setTimeout(() => (el.textContent = orig), 1400);
        });
      });
    });
  };

  // Simple HTML-escape helper reused by the crypto modal
  function esc(s) {
    return String(s || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  // ----- DevTools helper (for issuing keys locally during development) -----
  // window.LICENSE.__issueKey("pro")   →  returns a valid PRO   key
  // window.LICENSE.__issueKey("ent")   →  returns a valid ENT   key
  // window.LICENSE.__issueKey("ult")   →  returns a valid ULT   key
  // window.LICENSE.__issueKey("trial") →  returns a valid 10-HOUR trial key
  L.__issueKey = async function __issueKey(tier) {
    await ensureSigs();
    const t = (tier || "").toLowerCase();
    const tag =
      t === "ult"
        ? "ULT"
        : t === "ent"
          ? "ENT"
          : t === "trial" || t === "t10"
            ? "T10"
            : "PRO";
    const sig =
      tag === "ULT"
        ? sigCache.ult
        : tag === "ENT"
          ? sigCache.ent
          : tag === "T10"
            ? sigCache.t10
            : sigCache.pro;
    const key = `GIDEON-${tag}-${sig}`;
    console.log("%cDEV KEY :: " + key, "color:#12ffc6; font-weight:bold");
    return key;
  };

  // Reset whatever license/trial state is stored locally (for support ops)
  L.__reset = function __reset() {
    localStorage.removeItem(KEY_STORE);
    clearTrial();
    console.log("LICENSE :: state cleared");
  };
})();
