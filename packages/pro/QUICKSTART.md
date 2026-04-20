# GideonsEarth // PRO TIER — QUICKSTART GUIDE

```
// STATUS: PRO ACTIVE
// VERSION: GideonIntel v3 // OMNI-INT
// CLEARANCE: TIER-2
```

---

## FIRST 5 MINUTES

### Step 1 — Clone & Serve

```bash
git clone https://github.com/ultrathink3/GideonsEarth.git
cd GideonsEarth
python -m http.server 8765
```

Open `http://localhost:8765` in Chrome or Firefox (Chromium-based recommended).

### Step 2 — Activate Your Key

1. Click **💎 UPGRADE** (bottom-right of the HUD)
2. Paste `GIDEON-PRO-C64F4273` into **ENTER LICENSE KEY**
3. Click **✓ ACTIVATE** — page reloads with PRO unlocked
4. The upgrade button now reads **PRO** in amber

### Step 3 — Run Your First DOSSIER Sweep

1. Click the **DOSSIER** tab in the right panel
2. Paste any target — try `8.8.8.8`, `github.com`, or an email address
3. Hit **SWEEP**
4. Watch 40+ modules fire in parallel — results stream in live

---

## MODULE-BY-MODULE GUIDE

---

### 🗂 DOSSIER — Auto-Classifying Intel Sweep

**Where:** Right panel → `DOSSIER` tab (first tab, active by default)

The DOSSIER engine auto-detects your target type and routes it through every
applicable module simultaneously. No need to know which tool to use — paste
anything and let it work.

**Supported target formats:**

| Input | Auto-detected as | Modules fired |
|---|---|---|
| `8.8.8.8` | IPv4 address | GeoIP · Shodan · BGP · Traceroute |
| `192.168.1.1` | Private IP | Flagged as RFC-1918 — no external lookup |
| `github.com` | Domain | DNS · RDAP · crt.sh · URLScan · Wayback · Shodan |
| `https://example.com/path` | URL | URLScan · Wayback · domain extraction |
| `user@example.com` | Email | HIBP · Gravatar · MX probe · domain pivot |
| `@handle` | Username | WhatsMyName 600+ sites · GitHub profile |
| `AS15169` | ASN | BGPView peering · prefix map |
| `0x1234...` | ETH wallet | Ethplorer on-chain history |
| `bc1q...` | BTC wallet | blockchain.info UTXO lookup |

**HIBP API Key (optional):**
For full Have I Been Pwned breach data, paste your HIBP API key into the
`HIBP API KEY` field below the sweep input. It is stored locally in
`localStorage` — never transmitted to anyone except HIBP's own k-anon endpoint.

**Buttons:**
- **↯ Traceroute arc** — fires a traceroute and draws each hop as an animated
  great-circle arc on the 3D globe
- **⬇ JSON** — exports the full dossier as a structured JSON file
- **⬇ Markdown** — exports as a formatted Markdown report

---

### 🌐 GRAPH — Maltego-Style Entity Canvas

**Where:** Right panel → `GRAPH` tab

After running a DOSSIER sweep, open GRAPH to see the target's relationships
visualized as a force-directed node-edge canvas.

**Node colors:**
| Color | Entity Type |
|---|---|
| 🟡 Yellow | IP address |
| 🟢 Green | Domain / hostname |
| 🔴 Red | Email address |
| 🟣 Purple | CVE identifier |
| 🔵 Blue | Username / social handle |
| ⚪ White | Generic / unclassified |

**Controls:**
- **Drag nodes** to reposition them
- **↻ Rebuild** — regenerates the graph from the last DOSSIER result
- **✕ Clear** — wipes the canvas

**Pivot workflow:**
Click any node → note the entity value → paste it back into DOSSIER as a new
target → rebuild GRAPH to expand the chain. This is the Maltego-style pivot
loop that turns a single IP into a full infrastructure map.

---

### 🔬 CSINT — Cyber Signal Intelligence

**Where:** Right panel → `CSINT` tab

Six sub-modules for cyber threat intelligence:

#### CVE Lookup (NVD 2.0 + CISA KEV)

```
Input: CVE-2024-3400
```

Returns: CVSS score, description, affected products, CWE, references.
If the CVE is on CISA's Known Exploited Vulnerabilities catalogue, it is
flagged in red — `⚠ CISA KEV: ACTIVELY EXPLOITED`.

#### ThreatFox IOC Search (abuse.ch)

```
Input: IP address, domain, MD5 hash, or SHA256 hash
```

Returns: malware family, threat type, confidence level, first/last seen,
reporter, tags. Covers Cobalt Strike, Emotet, QakBot, and hundreds more.

#### Typosquat Generator

```
Input: yourdomain.com
```

Generates homograph variants, bitsquat mutations, combosquats, and
transposition typos of your domain. Use this to monitor for brand-jacking
or phishing infrastructure targeting your users.

#### Favicon MMH3 → Shodan Pivot

```
Input: https://target.com/favicon.ico  (or any direct favicon URL)
```

Computes the MurmurHash3 fingerprint of the favicon — the same technique
used by Mandiant / Shodan. Returns the `http.favicon.hash:XXXXXXX` Shodan
dork you can use to find every server running the same software stack.

#### Tor Exit-Node Check

Open the module to fetch the live Tor Project exit-node list. Paste any IP
to check if it is a known Tor exit relay. Useful for identifying anonymized
traffic sources in logs.

#### BTC / ETH Wallet Lookup

```
Input: 0xBbeedC09212C66C6639BdF46ebC1910De6111b46  (ETH)
       bc1qu06prvw6085dlj5e6vuuwkx0wl8n5kka5xj7gn  (BTC)
```

Returns: balance, transaction count, first/last activity, token holdings (ETH).

---

### 🔴 CERTSTREAM — Live TLS Firehose

**Where:** Right panel → `CERTSTREAM` tab

Connects to `wss://certstream.calidog.io` — a real-time stream of every TLS
certificate logged to public Certificate Transparency logs globally.

**How to use:**
1. Open the CERTSTREAM tab — the connection establishes automatically
2. New domain registrations appear in the feed as they are minted
3. Use the **keyword filter** to narrow the stream:
   - Filter `paypal` → catch PayPal phishing domains as they spin up
   - Filter `yourcompany` → monitor for brand impersonation
   - Filter `crypto` / `wallet` / `metamask` → catch crypto phishing infrastructure

**What to look for:**
- Domains that mimic legitimate services (`paypa1.com`, `googlе.com`)
- Wildcard certs for suspicious base domains
- Burst issuance (many certs in seconds = likely automated phishing kit)
- Unusual TLDs paired with brand names (`.xyz`, `.top`, `.cf`)

---

### 📍 CHRONO — Sun-Angle Chronolocation

**Where:** Right panel → `CHRONO` tab

Implements Bellingcat-style sun-angle analysis to estimate **when a photo was
taken** from the geometry of shadows.

**Workflow:**
1. Identify the approximate **latitude and longitude** of the photo location
   (use the globe — double-click to drop a pin and read coordinates from the HUD)
2. Measure the **sun azimuth** (compass bearing of the shadow, 0–360°) and
   **sun altitude** (angle above horizon, 0–90°) from the image
3. Enter these values into CHRONO
4. The engine returns a list of candidate **dates and times (UTC)** when the
   sun was at exactly that position for that location
5. Cross-reference with other OSINT to eliminate false candidates

**Tips:**
- Shadow length gives altitude; shadow direction gives azimuth
- Buildings, poles, and people cast the most reliable shadows
- Time of year narrows rapidly once you have azimuth + altitude together
- Works best for solar elevations between 10° and 70°

---

### 🛡 OPSEC — Self-Fingerprint Scan

**Where:** Right panel → `OPSEC` tab

Audits your own browser for identity leaks before you run any operations.
Run this first, every session.

**What it checks:**

| Test | What it finds |
|---|---|
| **WebRTC IP leak** | Your real local/public IP even behind a VPN |
| **Canvas fingerprint** | Unique rendering hash from your GPU/driver |
| **GPU renderer string** | Exact graphics hardware + driver version |
| **Timezone mismatch** | Declared timezone vs. system timezone vs. VPN exit |
| **User-Agent** | Browser + OS string sent with every request |
| **Screen resolution** | Can be used for cross-site tracking |
| **Language headers** | Accept-Language leak |
| **Do Not Track** | Whether DNT is set (paradoxically makes you more unique) |

**Red flags to act on:**
- WebRTC showing a real IP while on VPN → disable WebRTC in browser settings
- Canvas FP changing between sessions → likely in Private/Incognito (good)
- Timezone mismatch → your VPN exit and system clock disagree (common leak)

---

### 📤 EXPORT

**Where:** DOSSIER tab → `⬇ JSON` and `⬇ Markdown` buttons

After any DOSSIER sweep, export the full result set:

- **JSON** — machine-readable, structured. Use for piping into other tools,
  archiving, or building datasets.
- **Markdown** — human-readable formatted report. Paste directly into
  Obsidian, Notion, a GitHub issue, or any markdown-aware document.

---

### ↯ TRACEROUTE ARCS

**Where:** DOSSIER tab → `↯ Traceroute arc` button

Fires a traceroute against the current DOSSIER target and renders each hop
as an animated glowing arc on the 3D globe. Each arc is labeled with the
hop's IP, hostname (if resolvable), ASN, and country flag.

**Note:** Browser-based traceroute uses ICMP-via-WebRTC tricks and public
traceroute APIs — results are directional, not forensic-grade. Use for
visualization and pivot-point discovery, not definitive path analysis.

---

## PRO WORKFLOW EXAMPLES

### Example 1 — Domain Infrastructure Mapping

```
1. DOSSIER → github.com
   → DNS records, crt.sh subdomains, Shodan open ports, BGP ASN

2. GRAPH → rebuild
   → See: github.com ← IP nodes ← CVE nodes

3. Pick an IP node → paste into DOSSIER
   → Expands the ASN, reverse DNS, more ports

4. CERTSTREAM → filter "github"
   → Catch any phishing domains imitating GitHub in real time
```

### Example 2 — Email OSINT

```
1. DOSSIER → target@company.com
   → HIBP breaches, Gravatar avatar, MX probe, domain pivot

2. DOSSIER → company.com (from the domain pivot)
   → Full DNS, certs, Shodan, Wayback snapshots

3. GRAPH → rebuild
   → Email → domain → IP → CVE chain visualized
```

### Example 3 — CVE-to-Infrastructure Pivot

```
1. CSINT → CVE Lookup → CVE-2024-3400 (PAN-OS RCE)
   → CVSS 10.0, CISA KEV flagged

2. CSINT → Favicon MMH3 → find PAN-OS admin login favicon
   → Get Shodan dork: http.favicon.hash:-1440659185

3. Paste dork into Shodan manually → enumerate exposed PAN-OS instances
```

---

## KEYBOARD SHORTCUTS

| Shortcut | Action |
|---|---|
| `Double-click globe` | Drop a waypoint pin at that location |
| `Scroll` | Zoom in/out |
| `Left-drag` | Rotate globe |
| `Middle-drag` | Tilt camera |
| `ESC` | Exit any active mode |

---

## TIPS & TRICKS

- **Chain targets:** Every result with a clickable IP, domain, or email is a
  pivot point. DOSSIER → GRAPH → DOSSIER is the core loop.
- **Certstream + DOSSIER:** Catch a suspicious domain in Certstream → immediately
  paste it into DOSSIER for full infrastructure context.
- **Export before clearing:** The graph canvas clears on tab switch. Export JSON
  first if you want to preserve the session.
- **OPSEC first:** Run the OPSEC tab before starting any sensitive investigation.
  Know your own leak surface.
- **HIBP k-anon:** The password check NEVER sends your password to HIBP. Only the
  first 5 characters of the SHA-1 hash are transmitted — the full hash is matched
  locally. This is how HIBP designed it.

---

## SUPPORT

- **Email:** keys@gideonintel.io (subject: `[PRO] ...`)
- **GitHub:** https://github.com/ultrathink3/GideonsEarth/issues
- **Response:** ≤ 24 hours

---

```
// GIDEON-PRO-C64F4273
// RECON GRID: ONLINE
// CLEARANCE: TIER-2 // PRO
// GideonIntel v3 // OMNI-INT
```

*The globe never sleeps. Neither does the grid.* 🌍