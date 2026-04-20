# GIDEONSEARTH // ENTERPRISE QUICKSTART
## OPERATOR FIELD MANUAL — v3.0 OMNI-INT

```
TIER   : ENTERPRISE
ACCESS : FULL SPECTRUM
STATUS : RECON GRID ONLINE
```

---

## 00 // GETTING ON THE GRID

```bash
git clone https://github.com/ultrathink3/GideonsEarth.git
cd GideonsEarth
python -m http.server 8765
# http://localhost:8765
```

1. Hit **💎 UPGRADE** in the HUD
2. Paste `GIDEON-ENT-2441E248` → **✓ ACTIVATE**
3. Reload. HUD reads **ENTERPRISE** in amber. You're in.

---

## 01 // THE GLOBE

The 3D Earth is your cockpit. Everything feeds into it.

| Interaction | How |
|---|---|
| Rotate / pan | Left-drag |
| Zoom | Scroll wheel |
| Tilt | Right-drag or middle-drag |
| Drop waypoint pin | Double-click any surface |
| Fly to address | Type in the top address bar → Enter |
| Random hotspot fly-to | Click ✈ in the left toolbar |
| Clear all pins | Click ✕ in the left toolbar |

**Layer toggles** (left toolbar):
| Icon | Layer |
|---|---|
| ◉ | 3D Globe mode |
| ▦ | 2D flat map |
| ◈ | Columbus view |
| ⌖ | Borders + labels |
| 🛣 | Roads + state lines |
| ☾ | Night lights overlay |
| ⌗ | Lat/Lon graticule grid |

---

## 02 // DOSSIER — 40+ MODULE PARALLEL SWEEP

**Tab:** `DOSSIER` (first tab, always visible)

Drop any target into the input field and hit **SWEEP**:

```
8.8.8.8                  → IP geolocation + ASN + Shodan
example.com              → DNS + certs + RDAP + BGP + URLScan
user@example.com         → Gravatar + MX + HIBP breach check
@handle                  → WhatsMyName 600-site username hunt
0x742d35Cc6634...        → Ethereum on-chain wallet lookup
bc1q...                  → Bitcoin on-chain lookup
github.com/user          → GitHub repo enum + commit email harvest
AS15169                  → BGP peering + prefix map
CVE-2024-3400            → NVD + CISA KEV + CVSS score
```

All modules fire **simultaneously**. Results stream in as they resolve.

**Extra actions (PRO+ buttons below the sweep bar):**

| Button | What it does |
|---|---|
| **↯ Traceroute arc** | Traces hops to target, draws arcs on the globe |
| **⬇ JSON** | Exports full dossier as structured JSON |
| **⬇ Markdown** | Exports formatted Markdown report |

**Optional:** Enter your HIBP API key (stored locally) for full breach detail.

---

## 03 // GEOINT — LIVE EARTH INTELLIGENCE

> ENTERPRISE exclusive. These are the buttons in the **left toolbar**.

---

### 🛰 SATELLITES

Click the **🛰** button to load live orbital positions.

- Pulls TLE data from **CelesTrak** in real time
- Propagates orbits using **satellite.js SGP4** — same math NASA uses
- Renders **ISS, Starlink constellation, GPS Block III** on the globe
- Orbits animate in real time — watch them move
- Click any satellite entity for name + altitude + velocity

---

### ✈️ ADS-B LIVE FLIGHTS

Click the **✈️** button.

- Pulls from **adsb.lol** — includes **military aircraft** (Mode-S transponders)
- Aircraft rendered as labeled entities on the globe at their reported altitude
- Updates every poll cycle
- Great for: spotting military exercise patterns, C-17/E-3/RC-135 tracks

**Pro tip:** Combine with USGS quakes overlay to correlate disaster-response
airlift activity against seismic events in near-real-time.

---

### ⚠ USGS EARTHQUAKES

Click the **⚠** button.

- Pulls from **USGS Earthquake Hazards Program** — M1.0+ globally, 24h window
- Magnitude-scaled markers on the globe
- Click any marker: magnitude, depth, location, time UTC
- Refreshes on each toggle

---

### 🌋 VOLCANOES

Click the **🌋** button.

- **Smithsonian Global Volcanism Program** weekly bulletin
- Active volcanoes with status labels
- Falls back to a curated list of 16 known active sites if the API is rate-limited
- Markers: color-coded by activity level

---

### 🌐 NASA GIBS IMAGERY

Click the **🌐** button.

- Loads **NASA GIBS** true-color satellite imagery layer over the globe
- Sources: MODIS Terra · VIIRS SNPP — date-aware
- Useful for: cloud cover analysis, smoke plume tracking, ice extent

**To change the date:** The GIBS layer uses a date parameter — modify the
`gibsDate` variable in `int-ui.js` or use the layer toggle to pull latest.

---

## 04 // CSINT — CYBER SIGNAL INTELLIGENCE

**Tab:** `CSINT`

---

### CVE Lookup

```
Input: CVE-2024-3400
```
Returns: CVSS base score, vector string, CWE, affected products,
CISA KEV flag (is it being actively exploited in the wild?), references.

---

### ThreatFox IOC Search

```
Input: IP address / domain / MD5 / SHA256
```
Returns: Malware family, confidence level, threat actor tags,
first/last seen, related IOCs from abuse.ch.

---

### Typosquat Generator

```
Input: yourdomain.com
```
Generates: homograph variants, bitsquats, combosquats, TLD swaps.
Use for: brand protection monitoring, phishing domain detection.

---

### Favicon MMH3 → Shodan Pivot

```
Input: https://target.com/favicon.ico
```
Computes the **MurmurHash3** of the favicon — a technique pioneered by
Mandiant / Shodan to fingerprint servers by their favicon.
Output: the hash + a direct Shodan search link to find every server
on the internet running the same software stack.

---

### Tor Exit Node Lookup

Pulls the live Tor Project exit list and checks if an IP is a known
Tor exit relay. Feed it IPs from your GEO-IP or DOSSIER results.

---

### BTC / ETH Wallet Lookup

```
Input: 0xAddress or bc1q...address
```
Returns: balance, transaction count, last activity, token holdings (ETH).
Useful for: following crypto payment trails, OSINT on threat actor wallets.

---

### CERTSTREAM — Live TLS Firehose

**Tab:** `CERTSTREAM`

Opens a WebSocket to `wss://certstream.calidog.io` — the Certificate
Transparency log aggregator. Every new TLS cert issued globally streams
in real time.

**What to watch for:**
- New domains containing your brand name → phishing prep
- Bulk cert issuance from a single registrar → bot infrastructure spin-up
- Let's Encrypt certs on suspicious subdomains → malware C2 staging

Filter by keyword to narrow the stream.

---

## 05 // GRAPH — MALTEGO-STYLE ENTITY CANVAS

**Tab:** `GRAPH`

After any DOSSIER sweep, click **↻ Rebuild from last dossier**.

- Force-directed canvas — drag nodes freely
- Auto-populated from every entity the sweep resolved
- **Node colors:**
  - 🟡 Yellow — IP address
  - 🟢 Green — domain / hostname
  - 🔴 Red — email address
  - 🟣 Purple — CVE
  - 🔵 Blue — username / handle
  - ⬜ White — generic entity
- Edges show relationships (resolved from, linked to, cert for, etc.)
- Click **✕ Clear** to reset

---

## 06 // CHRONO — SUN-ANGLE CHRONOLOCATION

**Tab:** `CHRONO`

Bellingcat-style open-source dating of photos using shadow geometry.

**Workflow:**
1. Find a photo with a visible shadow or sun position
2. Estimate the sun's **azimuth** (compass bearing, 0–360°) and
   **altitude** (elevation above horizon, 0–90°) from the image
3. Enter the **target location** (lat/lon or address)
4. CHRONO calculates the date/time window that matches that solar geometry

**Use cases:** Dating battlefield images, verifying claimed event timelines,
geolocating photos with partial landmark visibility.

---

## 07 // OPSEC SELF-SCAN

**Tab:** `OPSEC`

Run this before any sensitive operation. Finds your own leaks:

| Check | What It Tests |
|---|---|
| **WebRTC IP leak** | Does your browser expose your real LAN/WAN IP via WebRTC? |
| **Canvas fingerprint** | Your browser's unique canvas rendering hash |
| **GPU renderer** | Graphics card string exposed via WebGL — highly unique |
| **Timezone** | Does your reported timezone match your VPN exit? |
| **User-Agent** | Full UA string — browser + OS fingerprint |

Use the results to harden your browser config before running DOSSIER sweeps.

---

## 08 // WALK-MAN — FIRST-PERSON MODE

**Toolbar button:** 🚶

Drops you into first-person street-level / photogrammetry mode at your
current camera position. Powered by Google Photorealistic 3D Tiles.

| Key | Action |
|---|---|
| `W` | Walk forward |
| `S` | Walk backward |
| `A` | Strafe left |
| `D` | Strafe right |
| `SHIFT` | Run (3× speed) |
| `SPACE` | Jump |
| `Q` | Fly down |
| `E` | Fly up |
| `MOUSE` | Look around (click to lock pointer) |
| `ESC` | Exit back to globe |

**Pro tip:** Fly the globe to a target location first, zoom in close,
*then* enter WALK-MAN. It samples ground height at your camera position
and drops you right at street level.

---

## 09 // MODELS — 3D ASSET UPLOAD

**Tab:** `MODELS`

Upload your own 3D assets and place them live on the globe.

**Supported formats:**
| Extension | Type |
|---|---|
| `.glb` / `.gltf` | 3D model (recommended) |
| `.kmz` | Google Earth KMZ |
| `.geojson` | GeoJSON feature collection |
| `.czml` | Cesium CZML time-dynamic data |
| `.kml` | Keyhole Markup Language |
| `.obj` | Wavefront OBJ |

**Workflow:**
1. In the MODELS tab, set your **latitude / longitude** for placement
   *(or double-click the globe to drop a pin first — coords auto-fill)*
2. Drag your file onto the drop zone (or click to browse)
3. The file uploads to **Cesium Ion**, tiles automatically, and appears
   on the globe within seconds
4. Label and scale are set automatically — click the entity to inspect

**Requires:** Your own Cesium Ion access token set in `app.js` line 79.
Free Ion accounts include 5 GB of tiling quota per month.

---

## 10 // GIDEON DEFENSE GRID

**Button:** ☄ DEFEND EARTH (bottom of left toolbar)

Take a break from recon. Pilot **GIDEON-1**, a cyberpunk gunship at 2,500 km
altitude, and defend Earth from incoming asteroids.

| Key | Action |
|---|---|
| `W / S` | Thrust forward / reverse |
| `A / D` | Yaw left / right |
| `SPACE` | Fire auto-targeted laser |
| `CLICK` | Aim-fire at screen point |
| `P` | Pause / resume |
| `ESC` | Exit back to globe |

**Scoring:**
- Combo multiplier ×1 → ×10 for consecutive hits
- Power-ups: 🛡 SHIELD (absorbs one impact) · ⏱ SLOW-MO · 💥 NUKE (board clear)
- Top-10 leaderboard persists across sessions

---

## 11 // SUPPORT & ESCALATION

| Channel | Details |
|---|---|
| **Email** | keys@gideonintel.io |
| **Subject format** | `[ENT SUPPORT] Your issue` |
| **GitHub Issues** | https://github.com/ultrathink3/GideonsEarth/issues |
| **Response SLA** | ≤ 24 hours for ENTERPRISE |
| **Custom deploys** | Email with subject `[ENT CUSTOM]` |

ENTERPRISE subscribers have priority queue. Include your txid or key
prefix (`GIDEON-ENT-2441`) in every support message.

---

## 12 // QUICK REFERENCE CARD

```
TIER KEY       : GIDEON-ENT-2441E248
ACTIVATION     : 💎 UPGRADE → paste key → ✓ ACTIVATE
KEY STORE      : localStorage["gi:license"]
CONTACT        : keys@gideonintel.io

GEOINT TOOLBAR : 🛰 sats  ✈️ flights  ⚠ quakes  🌋 volcanoes  🌐 gibs
OSINT TABS     : DOSSIER  GRAPH  CSINT  CERTSTREAM  CHRONO  OPSEC
ENT TABS       : MODELS
TOOLS          : WALK-MAN 🚶  |  DEFENSE GRID ☄
EXPORT         : ⬇ JSON  |  ⬇ Markdown
```

---

*GideonIntel v3 // OMNI-INT · ENTERPRISE FIELD MANUAL*
*Recon grid online. The globe never sleeps.* 🌍🛸☄️🏆