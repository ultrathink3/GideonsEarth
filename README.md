# GideonsEarth // Recon Grid

> A cyberpunk 3D Earth cockpit fused with **GideonIntel v3 // OMNI-INT** — a
> client-side OSINT / GEOINT / CSINT platform with 40+ intelligence modules,
> an entity-graph view, a Maltego-style force-directed canvas, live CelesTrak
> satellites, ADS-B flights, USGS quakes, volcanoes, NASA GIBS imagery,
> certificate-transparency firehose, Bellingcat-style sun-angle chronolocation
> — and an asteroid-defense arcade mode (**GIDEON DEFENSE GRID**) where you
> pilot **GIDEON-1** around Earth to shoot down meteors with auto-targeted
> lasers.

![mode](https://img.shields.io/badge/mode-recon--grid-12ffc6?style=flat-square)
![stack](https://img.shields.io/badge/stack-CesiumJS%20%7C%20vanilla%20JS-12ffc6?style=flat-square)
![tiers](https://img.shields.io/badge/tiers-FREE%20%7C%20PRO%20$9%20%7C%20ENT%20$49-ffb020?style=flat-square)
![license](https://img.shields.io/badge/license-source--available-ff2e6e?style=flat-square)

---

## Try it

Clone, serve, open:

```bash
git clone https://github.com/ultrathink3/GideonsEarth.git
cd GideonsEarth
python -m http.server 8765
# visit http://localhost:8765
```

No build step. No npm. One `index.html` + a handful of ES modules.

---

## Tiers

| | **FREE** | **PRO** · $9/mo | **ENTERPRISE** · $25/mo |
|---|---|---|---| GEO-IP tracer | ✓ | ✓ | ✓ |
| DNS + Cert-Transparency | ✓ | ✓ | ✓ |
| Username hunt (WhatsMyName) | ✓ | ✓ | ✓ |
| Email + HIBP k-anon password check | ✓ | ✓ | ✓ |
| Link-Trace campaigns | ✓ | ✓ | ✓ |
| **GIDEON DEFENSE GRID** arcade | ✓ | ✓ | ✓ |
| Global Leaderboard (sign-in) | ✓ | ✓ | ✓ |
| **DOSSIER** auto-classifying sweep | 🔒 | ✓ | ✓ |
| **GRAPH** Maltego-style entity graph | 🔒 | ✓ | ✓ |
| **CSINT** — NVD CVE + CISA KEV, ThreatFox, typosquat, favicon MMH3, Tor | 🔒 | ✓ | ✓ |
| **CERTSTREAM** — live TLS firehose | 🔒 | ✓ | ✓ |
| **CHRONO** sun-angle chronolocation | 🔒 | ✓ | ✓ |
| **OPSEC** — WebRTC/canvas/GPU fingerprint self-scan | 🔒 | ✓ | ✓ |
| Export dossier → JSON / Markdown | 🔒 | ✓ | ✓ |
| Traceroute arcs | 🔒 | ✓ | ✓ |
| **GEOINT** live feeds — satellites · ADS-B · USGS quakes · volcanoes · NASA GIBS | 🔒 | 🔒 | ✓ |
| **MODELS** — drag-drop 3D upload to Cesium Ion | 🔒 | 🔒 | ✓ |
| **WALK-MAN** first-person mode | 🔒 | 🔒 | ✓ |
| Priority support + custom deployments | — | — | ✓ |

Click **💎 UPGRADE** inside the app to open the pricing / activation modal.

---

## Pay with crypto

We accept crypto only. Send **≥ $9 (PRO)** or **≥ $25(ENTERPRISE)** USD-equivalent
to any of the addresses below, then email the transaction id to
**keys@gideonintel.io** (or open a GitHub issue with the txid). You'll receive
your license key within 24 hours.

| Chain | Address |
|---|---|
| **ETH / USDT-ERC20 / USDC / EVM (Polygon, Arbitrum, Base, BSC)** | `0xBbeedC09212C66C6639BdF46ebC1910De6111b46` |
| **BTC** (native SegWit) | `bc1qu06prvw6085dlj5e6vuuwkx0wl8n5kka5xj7gn` |
| **SOL / USDC-SPL** | `DVfJ3Hzuu4dcxWCk19Y9RLNLLAA4EeQwNP9xZRqTpaWw` |
| **TRON / USDT-TRC20** (lowest fee) | `TGcmWKHEx1o6sDXQhiD35HDtEzNeQAur8i` |

> Once you have your key (`GIDEON-PRO-XXXXXXXX` / `GIDEON-ENT-XXXXXXXX`),
> click **💎 UPGRADE** in-app → paste into **ENTER LICENSE KEY** → **✓ ACTIVATE**.
> The key is stored in `localStorage`; no account required.

---

## What's inside

### 🛰️ GideonIntel v3 // OMNI-INT
A 40+ module client-side intelligence fusion platform. All requests are made
directly from the browser — no backend server.

- **OSINT** *(window.GI)* — DOSSIER auto-classifier · DoH DNS · crt.sh · RDAP ·
  Shodan InternetDB · BGPView · URLScan · Wayback · GitHub · WhatsMyName
  (600+ sites) · Gravatar/MX/HIBP.
- **GEOINT** *(window.GEOINT)* — live ADS-B military aircraft · USGS earthquakes ·
  Smithsonian volcanoes · NASA GIBS date-aware imagery · CelesTrak TLE satellites
  (ISS + Starlink + GPS via satellite.js SGP4) · FIRMS wildfires · Open-Meteo ·
  OSM Overpass · sun-angle chronolocation.
- **CSINT** *(window.CSINT)* — CertStream live firehose · NVD CVE + CISA KEV ·
  abuse.ch ThreatFox / URLhaus · Tor exit-node list · typosquat generator ·
  Mandiant favicon MMH3 → Shodan pivot · BTC/ETH wallet lookups · OPSEC
  self-fingerprint · Maltego-style entity graph.

### ☄️ GIDEON DEFENSE GRID
A cinematic asteroid-defense arcade inside the Cesium globe.

- **Pilot GIDEON-1** — cyberpunk gunship orbiting Earth at 2,500 km.
- **Controls** — `W/S` thrust forward/reverse · `A/D` yaw · `SPACE` auto-target
  laser · click to aim-fire · `P` pause · `ESC` exit.
- **Waves · bosses · ×1→×10 combo · power-ups** (🛡 SHIELD · ⏱ SLOW-MO · 💥 NUKE).
- **Top-10 leaderboard** with name sign-in, persistent across reloads.

### 🌍 Recon Grid
- **Real 3D Earth** — Bing Aerial + Cesium World Terrain + Google Photorealistic
  3D Tiles.
- **Satellites, planets, real sun/moon lighting**.
- **Address bar geocoder** (Nominatim).
- **Double-click** to drop waypoint pins.

---

## File map

```
GideonsEarth/
├── index.html        HUD markup, Cesium container, OSINT panel
├── styles.css        Cyberpunk HUD + paywall + crypto-modal theme
├── app.js            Globe init · WALK-MAN · MODELS pipeline · GEO-IP
├── osint.js          OSINT engine (window.GI)
├── osint-ui.js       OSINT tab wiring
├── geoint.js         GEOINT engine (window.GEOINT)
├── csint.js          CSINT engine (window.CSINT)
├── int-ui.js         GEOINT + CSINT tab wiring
├── defense.js        GIDEON DEFENSE GRID arcade + leaderboard
├── license.js        Client-side tier gate + crypto paywall modal
├── LICENSE           Source-available license terms
└── README.md
```

---

## Controls cheat-sheet

**Globe**
| Action | How |
|---|---|
| Rotate / pan | Left-drag |
| Zoom | Scroll wheel |
| Tilt | Middle-drag / right-drag |
| Drop waypoint | Double-click |

**Defense Grid**
| Key | Action |
|---|---|
| `W / S` | Thrust forward / reverse |
| `A / D` | Yaw left / right |
| `SPACE` | Fire auto-targeted laser |
| `CLICK` | Aim-fire at screen point |
| `P` | Pause / resume |
| `ESC` | Exit |

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

## Data providers

All client-side, CORS-friendly, mostly keyless.

**OSINT** · get.geojs.io · ipapi.co · cloudflare-dns.com · dns.google · crt.sh ·
rdap.org · internetdb.shodan.io · api.bgpview.io · urlscan.io · archive.org ·
api.github.com · WhatsMyName · gravatar.com · haveibeenpwned.com ·
nominatim.openstreetmap.org.

**GEOINT** · celestrak.org · api.adsb.lol · earthquake.usgs.gov · Smithsonian GVP ·
firms.modaps.eosdis.nasa.gov · map1.vis.earthdata.nasa.gov · api.open-meteo.com ·
overpass-api.de.

**CSINT** · wss://certstream.calidog.io · services.nvd.nist.gov · cisa.gov ·
check.torproject.org · urlhaus-api.abuse.ch · threatfox-api.abuse.ch ·
blockchain.info · api.ethplorer.io · api.coingecko.com.

---

## Legal & responsible use

**This is a research and educational tool.** It aggregates *only* public
intelligence sources. You are responsible for the lawfulness of every query
you run with it. Do not use it for harassment, stalking, unauthorized access,
or violation of any third-party API's terms of service.

The software is distributed under a **source-available** license. You may
study the source and self-host the FREE tier for personal / educational use.
Redistributing the PRO or ENTERPRISE paywalled features, or operating a
public instance with the paywall removed, is prohibited without a commercial
license. See [`LICENSE`](LICENSE) for the full terms.

---

## Roadmap

- [x] OSINT AOT/SOTA (v3.0 OMNI-INT — 40+ modules)
- [x] GEOINT live feeds · ADS-B, quakes, volcanoes, GIBS imagery
- [x] CSINT — CertStream, CVE, KEV, ThreatFox, typosquat, favicon, Tor
- [x] Chronolocation (sun azimuth/altitude)
- [x] Maltego-style entity graph
- [x] Defense Grid arcade + leaderboard
- [x] Tiered paywall + crypto payment modal
- [ ] On-device LLM dossier summarization (WebLLM / transformers.js)
- [ ] EXIF + reverse-image (PimEyes / TinEye / Yandex pivot)
- [ ] AIS live vessel tracking
- [ ] Real multi-hop traceroute with ASN enrichment
- [ ] WALK-MAN multiplayer sessions

---

**Built for Gideon. Recon grid online.** 🌍🛸☄️🏆
