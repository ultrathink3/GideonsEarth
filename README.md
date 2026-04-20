<div align="center">

```
 ██████╗ ██╗██████╗ ███████╗ ██████╗ ███╗   ██╗███████╗
██╔════╝ ██║██╔══██╗██╔════╝██╔═══██╗████╗  ██║██╔════╝
██║  ███╗██║██║  ██║█████╗  ██║   ██║██╔██╗ ██║███████╗
██║   ██║██║██║  ██║██╔══╝  ██║   ██║██║╚██╗██║╚════██║
╚██████╔╝██║██████╔╝███████╗╚██████╔╝██║ ╚████║███████║
 ╚═════╝ ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
          E A R T H  //  R E C O N   G R I D
```

### **State-of-the-Art OSINT · GEOINT · CSINT — fused into one living, breathing 3D Earth cockpit.**

[![mode](https://img.shields.io/badge/mode-RECON%20GRID%20ONLINE-12ffc6?style=for-the-badge&logo=satellite&logoColor=black)](https://github.com/ultrathink3/GideonsEarth)
[![stack](https://img.shields.io/badge/stack-CesiumJS%20%7C%20Vanilla%20ES2024-12ffc6?style=for-the-badge&logo=javascript&logoColor=black)](https://github.com/ultrathink3/GideonsEarth)
[![tiers](https://img.shields.io/badge/tiers-FREE%20%7C%20PRO%20%249%20%7C%20ENT%20%2425-ffb020?style=for-the-badge)](https://github.com/ultrathink3/GideonsEarth)
[![license](https://img.shields.io/badge/license-SOURCE%20AVAILABLE-ff2e6e?style=for-the-badge)](./LICENSE)
[![modules](https://img.shields.io/badge/intel%20modules-40%2B-12ffc6?style=for-the-badge)](https://github.com/ultrathink3/GideonsEarth)
[![zero-build](https://img.shields.io/badge/build%20step-NONE-ffb020?style=for-the-badge&logo=html5&logoColor=black)](https://github.com/ultrathink3/GideonsEarth)
[![backend](https://img.shields.io/badge/backend-ZERO-ff2e6e?style=for-the-badge)](https://github.com/ultrathink3/GideonsEarth)

</div>

---

> **GideonsEarth** is a cyberpunk 3D Earth cockpit fused with **GideonIntel v3 // OMNI-INT** —
> a fully **client-side**, zero-backend, **40+ module** intelligence fusion platform
> combining OSINT · GEOINT · CSINT into a single photorealistic WebGL globe.
> Track live satellites, military ADS-B flights, earthquakes, volcanoes, TLS certificate issuance,
> and CVE/KEV threat feeds — simultaneously — from inside a single browser tab.
> Then switch modes and **pilot GIDEON-1**, a cyberpunk gunship, to defend Earth from asteroids
> in the **GIDEON DEFENSE GRID** arcade.

---

## ⚡ Why GideonsEarth?

| Traditional OSINT Stack | GideonsEarth OMNI-INT |
|---|---|
| Separate tools, separate tabs | **One cockpit. Every feed. Zero switching.** |
| Server-side APIs leaking your queries | **100% client-side — your queries stay yours** |
| Static maps & text dumps | **Real-time 3D Earth with live data overlaid** |
| Hours of setup & dependencies | **Clone → `python -m http.server` → done** |
| $500+/mo SaaS platforms | **FREE tier + $9 PRO + $25 ENTERPRISE** |

---

## 🚀 Instant Deploy

```bash
git clone https://github.com/ultrathink3/GideonsEarth.git
cd GideonsEarth
python -m http.server 8765
# 🌍 visit http://localhost:8765
```

**No npm. No webpack. No Docker. No cloud account.** One `index.html` + a handful of ES modules.
Runs entirely in the browser. Your intelligence ops, your machine.

---

## 🧠 State-of-the-Art Intelligence Modules


### 🕵️ OSINT — `window.GI`  *(40+ sub-modules)*
> Multi-source, parallel-fetching, auto-classifying open-source intelligence engine.

| Module | What it does |
|---|---|
| **DOSSIER** | Auto-classifying sweep — paste any target (IP, domain, email, username, wallet) and watch all 40+ engines fire in parallel |
| **GEO-IP** | Dual-provider triangulation (GeoJS + ipapi) with globe fly-to, ASN graph, and traceroute arcs |
| **DNS / DoH** | Dual-resolver DNS-over-HTTPS (Cloudflare + Google), crt.sh cert history, RDAP WHOIS |
| **Shodan** | InternetDB open-port + CVE correlation without an API key |
| **BGP / ASN** | BGPView peering map, upstream graph, announced prefixes |
| **URLScan** | Live scan submission + historical screenshot timeline |
| **Wayback** | Temporal diffing via Wayback Machine CDX API — see what a target was hiding |
| **GitHub OSINT** | Repo enumeration, commit email harvesting, org membership graph |
| **WhatsMyName** | 600+ site username enumeration (full Bellingcat dataset) |
| **HIBP + Gravatar** | k-anonymity HIBP password check, Gravatar avatar extraction, MX probing |
| **GRAPH** | Maltego-style force-directed entity canvas — nodes, edges, pivot chains |
| **Link-Trace** | Covert redirect campaign builder — track who clicks, when, and from where |

### 🛰️ GEOINT — `window.GEOINT`  *(ENTERPRISE)*
> Live Earth intelligence — fused, real-time, rendered in photorealistic 3D.

| Feed | Source | Cadence |
|---|---|---|
| **ADS-B military aircraft** | adsb.lol | Live |
| **ISS + Starlink + GPS** | CelesTrak TLE + satellite.js SGP4 | Live orbital propagation |
| **USGS earthquakes** | USGS Earthquake Hazards | M1.0+ global, real-time |
| **Smithsonian volcanoes** | GVP weekly bulletin | Weekly sync |
| **NASA GIBS imagery** | MODIS · VIIRS · ASTER | Date-aware, switchable |
| **FIRMS wildfires** | NASA FIRMS | 24h active fire perimeters |
| **Open-Meteo weather** | Open-Meteo | Forecast + historical |
| **OSM Overpass** | OpenStreetMap | On-demand feature queries |
| **Sun-angle chronolocation** | Ephemeris math | Image → date/time estimation |

### 🔬 CSINT — `window.CSINT`  *(PRO+)*
> Cyber-signal intelligence — threat intel, live TLS firehose, CVE/KEV fusion.

| Module | Description |
|---|---|
| **CertStream** | Live TLS certificate issuance firehose (wss://certstream.calidog.io) — watch the internet mint new domains in real time |
| **NVD CVE + CISA KEV** | NIST vulnerability database fused with CISA Known Exploited Vulnerabilities — searchable, enriched |
| **ThreatFox / URLhaus** | abuse.ch IOC feeds — malware C2s, phishing URLs, tagged by threat actor |
| **Typosquat generator** | Automated homograph + bitsquat + combosquat generation for brand monitoring |
| **Favicon MMH3 → Shodan** | Mandiant-style favicon hash → Shodan pivot (zero-key) |
| **Tor exit-node list** | Live Tor Project exit list — identify anonymized traffic |
| **BTC / ETH wallet** | blockchain.info + ethplorer on-chain lookup — follow the money |
| **OPSEC self-scan** | WebRTC IP leak · canvas fingerprint · GPU renderer · timezone mismatch |
| **Maltego graph** | Full CSINT node→edge pivot graph, exportable |

### ☄️ GIDEON DEFENSE GRID  *(All tiers)*
> A **cinematic asteroid-defense arcade** built directly into the Cesium globe. Because why not.

- **Pilot GIDEON-1** — a cyberpunk gunship orbiting Earth at 2,500 km altitude
- **Auto-targeting laser** (`SPACE`) with manual aim-fire (`CLICK`)
- **Wave-based escalation** — bosses, ×1→×10 combo multiplier, power-ups
- **Power-ups**: 🛡 SHIELD · ⏱ SLOW-MO · 💥 NUKE (clears the board)
- **Top-10 persistent leaderboard** with name sign-in

---

## 💎 Tiers

| Feature | **FREE** | **PRO** · $9/mo | **ENTERPRISE** · $25/mo |
|---|:---:|:---:|:---:|
| GEO-IP tracer | ✓ | ✓ | ✓ |

| DNS + Cert-Transparency | ✓ | ✓ | ✓ |
| Username hunt (WhatsMyName 600+) | ✓ | ✓ | ✓ |
| Email + HIBP k-anon password check | ✓ | ✓ | ✓ |
| Link-Trace campaigns | ✓ | ✓ | ✓ |
| **GIDEON DEFENSE GRID** arcade | ✓ | ✓ | ✓ |
| Global Leaderboard | ✓ | ✓ | ✓ |
| **DOSSIER** auto-classifying sweep | 🔒 | ✓ | ✓ |
   
| **GRAPH** Maltego-style entity graph | 🔒 | ✓ | ✓ |
| **CSINT** — CVE · KEV · ThreatFox · typosquat · favicon MMH3 · Tor | 🔒 | ✓ | ✓ |
| **CERTSTREAM** — live TLS firehose | 🔒 | ✓ | ✓ |
| **CHRONO** sun-angle chronolocation | 🔒 | ✓ | ✓ |
| **OPSEC** — WebRTC · canvas · GPU fingerprint self-scan | 🔒 | ✓ | ✓ |
| Export dossier → JSON / Markdown | 🔒 | ✓ | ✓ |
| Traceroute arcs | 🔒 | ✓ | ✓ |
| **GEOINT** live feeds — ADS-B · satellites · quakes · volcanoes · NASA GIBS | 🔒 | 🔒 | ✓ |
| **MODELS** — drag-drop 3D upload to Cesium Ion | 🔒 | 🔒 | ✓ |
| **WALK-MAN** first-person street-level mode | 🔒 | 🔒 | ✓ |
| Priority support + custom deployments | — | — | ✓ |

Click **💎 UPGRADE** inside the app to open the pricing / activation modal.

---

## 💰 Pay with Crypto

We accept **crypto only**. Send **≥ $9 (PRO)** or **≥ $25 (ENTERPRISE)** USD-equivalent
to any address below, then email the transaction ID to
**csinttt@proton.me** (or open a GitHub issue with the txid).
Your license key arrives within **24 hours**.

| Chain | Address |
|---|---|
| **ETH / USDT-ERC20 / USDC / EVM (Polygon · Arbitrum · Base · BSC)** | `0xBbeedC09212C66C6639BdF46ebC1910De6111b46` |
| **BTC** (native SegWit) | `bc1qu06prvw6085dlj5e6vuuwkx0wl8n5kka5xj7gn` |
| **SOL / USDC-SPL** | `DVfJ3Hzuu4dcxWCk19Y9RLNLLAA4EeQwNP9xZRqTpaWw` |
| **TRON / USDT-TRC20** *(lowest fee)* | `TGcmWKHEx1o6sDXQhiD35HDtEzNeQAur8i` |

> Once you have your key (`GIDEON-PRO-XXXXXXXX` / `GIDEON-ENT-XXXXXXXX`),
> click **💎 UPGRADE** in-app → paste into **ENTER LICENSE KEY** → **✓ ACTIVATE**.
> Stored in `localStorage`. No account. No tracking. No cloud.

---

## 🏗️ Architecture — SOTA Design Decisions

```
GideonsEarth/
├── index.html        HUD markup · Cesium container · OSINT panel
├── styles.css        Cyberpunk HUD + paywall + crypto-modal theme
├── app.js            Globe init · WALK-MAN · MODELS pipeline · GEO-IP
├── osint.js          OSINT engine — window.GI (40+ modules)
├── osint-ui.js       OSINT tab wiring + result rendering
├── geoint.js         GEOINT engine — window.GEOINT (live Earth feeds)
├── csint.js          CSINT engine — window.CSINT (threat intel + graph)
├── int-ui.js         GEOINT + CSINT tab wiring
├── defense.js        GIDEON DEFENSE GRID arcade + leaderboard
├── license.js        Client-side tier gate + crypto paywall modal
├── LICENSE           Source-available license terms
└── README.md
```

**Why vanilla JS + no build step?**
- **Zero supply-chain attack surface** — no `node_modules`, no transitive deps, no npm audit hell
- **Instant AOT delivery** — the browser parses and executes native ES modules; no transpilation, no bundling, no tree-shaking overhead
- **Forensic auditability** — you can read every line of what's running; no obfuscated bundles
- **Works offline** after first load — no CDN dependency for core logic

---

## 🌍 The Globe Stack

| Layer | Technology |
|---|---|
| **3D Engine** | CesiumJS — WebGL photorealistic globe |
| **Terrain** | Cesium World Terrain (Quantized Mesh) |
| **Imagery** | Bing Aerial + Google Photorealistic 3D Tiles |
| **Buildings** | Google 3D Tiles (photogrammetry mesh) |
| **Satellites** | CelesTrak TLE → satellite.js SGP4 orbital propagation |
| **Geocoder** | Nominatim (OSM) — zero API key |
| **Skybox** | Custom Milky Way cubemap + real sun/moon ephemeris |
| **Planets** | Keplerian orbital elements → real-time J2000 positions |

---

## 🔌 Data Providers

All CORS-friendly, client-side, and **mostly keyless**.

**OSINT** · `get.geojs.io` · `ipapi.co` · `cloudflare-dns.com` · `dns.google` · `crt.sh` ·
`rdap.org` · `internetdb.shodan.io` · `api.bgpview.io` · `urlscan.io` · `archive.org` ·
`api.github.com` · WhatsMyName · `gravatar.com` · `haveibeenpwned.com` · `nominatim.openstreetmap.org`

**GEOINT** · `celestrak.org` · `api.adsb.lol` · `earthquake.usgs.gov` · Smithsonian GVP ·
`firms.modaps.eosdis.nasa.gov` · `map1.vis.earthdata.nasa.gov` · `api.open-meteo.com` · `overpass-api.de`

**CSINT** · `wss://certstream.calidog.io` · `services.nvd.nist.gov` · `cisa.gov` ·
`check.torproject.org` · `urlhaus-api.abuse.ch` · `threatfox-api.abuse.ch` ·
`blockchain.info` · `api.ethplorer.io` · `api.coingecko.com`

---

## 🎮 Controls Cheat-Sheet

**Globe**
| Action | Input |
|---|---|
| Rotate / pan | Left-drag |
| Zoom | Scroll wheel |
| Tilt | Middle-drag · right-drag |
| Drop waypoint pin | Double-click |
| Geocode & fly | Address bar → Enter |

**Defense Grid**
| Key | Action |
|---|---|
| `W / S` | Thrust forward / reverse |
| `A / D` | Yaw left / right |
| `SPACE` | Fire auto-targeted laser |
| `CLICK` | Aim-fire at screen point |
| `P` | Pause / resume |
| `ESC` | Exit to globe |

**WALK-MAN** *(ENTERPRISE)*
| Key | Action |
|---|---|
| `W A S D` | Walk |
| `SHIFT` | Run |
| `SPACE` | Jump |
| `MOUSE` | Look |
| `Q / E` | Fly down / up |
| `ESC` | Exit |

---

## 🗺️ Roadmap

- [x] **OSINT SOTA v3.0 OMNI-INT** — 40+ parallel modules, entity graph, auto-classifier
- [x] **GEOINT live feeds** — ADS-B · quakes · volcanoes · GIBS imagery · FIRMS wildfires
- [x] **CSINT** — CertStream firehose · CVE · KEV · ThreatFox · typosquat · favicon MMH3 · Tor
- [x] **Chronolocation** — Bellingcat-style sun azimuth/altitude image dating
- [x] **Maltego graph** — force-directed entity pivot canvas
- [x] **Defense Grid** — full arcade with waves, bosses, combos, leaderboard
- [x] **Tiered paywall** — crypto-native payment, local key activation
- [x] **WALK-MAN** — first-person street-level / photogrammetry exploration
- [x] **MODELS** — drag-drop 3D asset upload to Cesium Ion with live globe placement
- [ ] **On-device LLM dossier summarizer** — WebLLM / transformers.js (zero data exfil)
- [ ] **EXIF + Reverse Image** — PimEyes / TinEye / Yandex automated pivot
- [ ] **AIS vessel tracking** — live global ship positions fused into globe
- [ ] **Real multi-hop traceroute** — ASN-enriched with globe arc visualization
- [ ] **WALK-MAN multiplayer** — shared reconnaissance sessions

---

## ⚖️ Legal & Responsible Use

**This is a research and educational tool.** It aggregates *only* publicly available
intelligence sources. You are solely responsible for the lawfulness of every query you run.
Do not use it for harassment, stalking, unauthorized access, or violation of any third-party
API's terms of service.

Distributed under a **source-available** license. You may study the source and self-host
the FREE tier for personal / educational use. Redistributing PRO or ENTERPRISE paywalled
features, or operating a public instance with the paywall removed, is prohibited without a
commercial license. See [`LICENSE`](LICENSE) for full terms.

---

<div align="center">

**Built for Gideon. Recon grid online.** 🌍🛸☄️🏆

*The globe never sleeps. Neither does the grid.*

[![GitHub stars](https://img.shields.io/github/stars/ultrathink3/GideonsEarth?style=for-the-badge&color=12ffc6)](https://github.com/ultrathink3/GideonsEarth/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ultrathink3/GideonsEarth?style=for-the-badge&color=ffb020)](https://github.com/ultrathink3/GideonsEarth/network)
[![GitHub issues](https://img.shields.io/github/issues/ultrathink3/GideonsEarth?style=for-the-badge&color=ff2e6e)](https://github.com/ultrathink3/GideonsEarth/issues)

</div>
