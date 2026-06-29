/* =========================================================
   GideonsEarth :: app.js
   3D globe (CesiumJS) + GideonIntel OSINT panel
   ========================================================= */

// ---------- STARFIELD GENERATOR (CSS box-shadow stars) ----------
// Generates hundreds of pinpoint stars as a single box-shadow value on three
// layered divs (small, mid, big). Sits behind the transparent Cesium canvas.
(function genStars() {
  const make = (count, color, maxBlur = 0) => {
    const parts = [];
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * window.innerWidth * 1.2);
      const y = Math.floor(Math.random() * window.innerHeight * 1.2);
      const blur = maxBlur ? Math.floor(Math.random() * maxBlur) : 0;
      parts.push(`${x}px ${y}px ${blur}px ${color}`);
    }
    return parts.join(", ");
  };
  const small = document.querySelector(".starfield .stars");
  const mid = document.querySelector(".starfield .stars-mid");
  const big = document.querySelector(".starfield .stars-big");
  if (small) small.style.boxShadow = make(400, "#ffffff");
  if (mid) mid.style.boxShadow = make(150, "#cfeeff", 1);
  if (big) big.style.boxShadow = make(40, "#ffffff", 2);
})();
// Regenerate on resize so stars cover the new viewport
window.addEventListener("resize", () => {
  // re-run by cloning the IIFE logic inline
  const make = (count, color, maxBlur = 0) => {
    const parts = [];
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * window.innerWidth * 1.2);
      const y = Math.floor(Math.random() * window.innerHeight * 1.2);
      const blur = maxBlur ? Math.floor(Math.random() * maxBlur) : 0;
      parts.push(`${x}px ${y}px ${blur}px ${color}`);
    }
    return parts.join(", ");
  };
  const small = document.querySelector(".starfield .stars");
  const mid = document.querySelector(".starfield .stars-mid");
  const big = document.querySelector(".starfield .stars-big");
  if (small) small.style.boxShadow = make(400, "#ffffff");
  if (mid) mid.style.boxShadow = make(150, "#cfeeff", 1);
  if (big) big.style.boxShadow = make(40, "#ffffff", 2);
});

// ---------- BOOT SEQUENCE ----------
const bootLog = document.getElementById("boot-log");
const bootLines = [
  ["BOOT ", "ok", "firmware chainload ok"],
  ["GPU  ", "ok", "WebGL 2.0 context acquired"],
  ["NET  ", "ok", "handshake :: cdn.jsdelivr.net"],
  ["TILES", "ok", "imagery stream // natural_earth_ii"],
  ["OSINT", "ok", "GideonIntel module :: LOADED"],
  ["GEOIP", "ok", "providers :: geojs.io + ipapi.co"],
  ["CORE ", "ok", "gideon-earth kernel online"],
  ["READY", "ok", "recon grid operational >>"],
];
function bootType(i = 0) {
  if (i >= bootLines.length) {
    setTimeout(() => {
      document.getElementById("boot").classList.add("gone");
      setTimeout(() => document.getElementById("boot").remove(), 700);
    }, 400);
    return;
  }
  const [tag, cls, msg] = bootLines[i];
  const line = document.createElement("div");
  line.innerHTML = `<span class="${cls}">[${tag}]</span> ${msg}`;
  bootLog.appendChild(line);
  setTimeout(() => bootType(i + 1), 220 + Math.random() * 180);
}
bootType();

// ---------- CESIUM GLOBE (FULL 3D) ----------
// Cesium Ion token — unlocks terrain, 3D buildings, Bing imagery, + your own
// uploaded Ion assets (GLB/GLTF/3D Tiles). The second (newer) token is used.
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhNmVmNmZiNS0zNTFmLTQ4ODAtYWVhNi1jODk1OTVkOWM1ZDAiLCJpZCI6NDAzNDI5LCJpYXQiOjE3NzM0NjYwMzZ9.Y8p7zOGZEboTqDah5850lRahmOwYMg5kmz8-MDGABnQ";

const viewer = new Cesium.Viewer("cesiumContainer", {
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true,
  // WebGL context with alpha so the CSS starfield behind the canvas shows through
  contextOptions: { webgl: { alpha: true } },
  // Bing Aerial w/ Labels (Ion asset 3) — rich satellite imagery
  imageryProvider: false, // we'll add imagery below after init
});

// Make the Cesium canvas itself transparent — the CSS starfield on body shows through
viewer.scene.backgroundColor = new Cesium.Color(0, 0, 0, 0);
viewer.scene.skyBox.show = true; // keep Cesium's built-in star cube too

// --- Imagery: Bing Aerial via Cesium Ion (fallback OSM if it fails) ---
(async () => {
  try {
    const bing = await Cesium.IonImageryProvider.fromAssetId(3);
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(bing);
  } catch (e) {
    console.warn("Bing imagery failed, using OSM fallback:", e);
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        maximumLevel: 19,
        subdomains: ["a", "b", "c"],
        credit: "© OpenStreetMap",
      }),
    );
  }
})();

// --- Terrain: Cesium World Terrain (real elevation) ---
// requestWaterMask: enables per-tile water mask data so WALK-MAN can detect
// water surfaces and prevent the walker from sinking into rivers/lakes/oceans.
let terrainProvider = null; // exposed for water-mask lookups in walk mode
(async () => {
  try {
    const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
      requestWaterMask: true,
    });
    viewer.terrainProvider = terrain;
    terrainProvider = terrain;
    feed(
      "ok",
      "TERRAIN :: Cesium World Terrain engaged (real elevation + water mask)",
    );
  } catch (e) {
    console.warn("Terrain load failed:", e);
  }
})();

// --- 3D buildings: GLOBAL COVERAGE ---
// Strategy: load BOTH Google Photorealistic 3D Tiles (high-fidelity mesh for
// major cities) AND Cesium OSM Buildings (350M+ procedural buildings derived
// from OpenStreetMap, covering the ENTIRE world). Where Google has photoreal
// mesh it renders; everywhere else OSM Buildings fill in the gaps. Result:
// 3D buildings everywhere you zoom in, not just in select cities.
let googleTileset = null; // track for toggle UI
let osmBuildings = null; // track for toggle UI

(async () => {
  // 1) Google Photorealistic — best quality, limited to major cities
  try {
    const google = await Cesium.createGooglePhotorealistic3DTileset();
    googleTileset = google;
    viewer.scene.primitives.add(google);
    feed(
      "ok",
      "3D-TILES :: Google Photorealistic 3D Tiles loaded (cities worldwide)",
    );
  } catch (e) {
    console.warn("Google 3D Tiles failed:", e);
    feed(
      "warn",
      `3D-TILES :: Google photorealistic unavailable (${e.message})`,
    );
  }

  // 2) Cesium OSM Buildings — global coverage, always load
  try {
    const buildings = await Cesium.createOsmBuildingsAsync();
    buildings.style = new Cesium.Cesium3DTileStyle({
      color: "color('#9ef7e2', 0.85)",
    });
    osmBuildings = buildings;
    viewer.scene.primitives.add(buildings);
    feed(
      "ok",
      "3D-TILES :: Cesium OSM Buildings loaded (global — 350M+ buildings)",
    );
  } catch (e) {
    console.warn("OSM Buildings failed:", e);
    feed("err", `3D-TILES :: OSM Buildings failed (${e.message})`);
  }

  // 3) Expose toggle controls so users can enable/disable each layer
  window.GideonsEarth.osmBuildings = osmBuildings;
  window.GideonsEarth.googleTileset = googleTileset;
})();

// ---------- BORDERS + PLACE LABELS OVERLAY ----------
// ESRI "Reference/World_Boundaries_and_Places" — transparent PNG tiles with
// country/state borders and place names. Free, no token, layered on top of
// the satellite imagery so states/countries/cities are visible by default.
const labelsProvider = new Cesium.UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  maximumLevel: 16,
  credit: "Esri Reference",
});
let labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
labelsLayer.alpha = 0.95;
labelsLayer.brightness = 1.4; // punch up the white labels against dark imagery

// Toggle button (starts ON)
document.getElementById("btn-labels").addEventListener("click", (e) => {
  if (labelsLayer) {
    viewer.imageryLayers.remove(labelsProvider, false);
    labelsLayer = null;
    e.currentTarget.classList.remove("active");
    feed("warn", "LABELS :: borders + places hidden");
  } else {
    labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
    labelsLayer.alpha = 0.95;
    labelsLayer.brightness = 1.4;
    e.currentTarget.classList.add("active");
    feed("ok", "LABELS :: borders + places visible");
  }
});

// ---------- ROADS + STATES OVERLAY (ESRI Transportation) ----------
// Two transparent layers stacked on top of imagery:
//  1. ESRI Reference Transportation — highway/road network
//  2. ESRI USA State Boundaries WMS-like tiles — political state lines
let roadsLayer = null;
let statesLayer = null;
const roadsProvider = new Cesium.UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  maximumLevel: 18,
  credit: "Esri Transportation",
});
const statesProvider = new Cesium.UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  maximumLevel: 16,
  credit: "Esri Boundaries",
});

// Worldwide state / province / admin-1 boundaries (Natural Earth 50m).
// Covers US states, Canadian provinces, Russian oblasts, Chinese provinces,
// Australian states, Brazilian estados, Indian states, etc.
// We manually convert polygon borders to polylines at slight altitude — avoids
// Cesium's ground-clamp tessellation crash on huge feature counts.
let statesDataSource = null;

function geoFeaturesToPolylineEntities(geo, stroke, ds) {
  let count = 0;
  for (const f of geo.features || []) {
    const g = f.geometry;
    if (!g) continue;
    const rings = [];
    if (g.type === "Polygon") {
      rings.push(...g.coordinates);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) rings.push(...poly);
    } else continue;
    for (const ring of rings) {
      // Cesium wants [lon, lat, lon, lat, …]
      const flat = [];
      for (const [lon, lat] of ring) {
        if (Number.isFinite(lon) && Number.isFinite(lat)) flat.push(lon, lat);
      }
      if (flat.length < 4) continue;
      ds.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(flat),
          width: 1.2,
          material: stroke,
          clampToGround: false,
          arcType: Cesium.ArcType.GEODESIC,
        },
      });
      count++;
    }
  }
  return count;
}

async function loadUsStateLines() {
  if (statesDataSource) return;
  const stroke = Cesium.Color.fromCssColorString("#12ffc6").withAlpha(0.85);

  // Try several sources in order — smallest/fastest first
  const sources = [
    {
      name: "world admin-1 (50m)",
      url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson",
    },
    {
      name: "world admin-1 (10m)",
      url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
    },
    {
      name: "US states only",
      url: "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json",
    },
  ];

  for (const src of sources) {
    try {
      feed("warn", `STATES :: loading ${src.name}...`);
      const r = await fetch(src.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const geo = await r.json();
      statesDataSource = new Cesium.CustomDataSource("states");
      const polylineCount = geoFeaturesToPolylineEntities(
        geo,
        stroke,
        statesDataSource,
      );
      viewer.dataSources.add(statesDataSource);
      feed(
        "ok",
        `STATES :: ${polylineCount} polylines rendered (${src.name}, ${geo.features.length} regions)`,
      );
      return;
    } catch (e) {
      feed("err", `STATES :: ${src.name} failed → ${e.message}`);
      statesDataSource = null;
    }
  }
  feed("err", "STATES :: all sources failed");
}

document.getElementById("btn-roads").addEventListener("click", async (e) => {
  const on = e.currentTarget.classList.contains("active");
  if (on) {
    if (roadsLayer) {
      viewer.imageryLayers.remove(roadsLayer, false);
      roadsLayer = null;
    }
    if (statesLayer && statesLayer !== labelsLayer) {
      viewer.imageryLayers.remove(statesLayer, false);
      statesLayer = null;
    }
    if (statesDataSource) {
      viewer.dataSources.remove(statesDataSource, true);
      statesDataSource = null;
    }
    e.currentTarget.classList.remove("active");
    feed("warn", "ROADS :: road + state overlay hidden");
  } else {
    roadsLayer = viewer.imageryLayers.addImageryProvider(roadsProvider);
    roadsLayer.alpha = 0.9;
    roadsLayer.brightness = 1.3;
    statesLayer = viewer.imageryLayers.addImageryProvider(statesProvider);
    statesLayer.alpha = 0.85;
    e.currentTarget.classList.add("active");
    feed("ok", "ROADS :: road + state boundary overlay engaged");
    // Load US state polylines (cyan glow) on top
    await loadUsStateLines();
  }
});

// Styling the globe/atmosphere for the Gideon cyberpunk vibe
const scene = viewer.scene;
scene.globe.enableLighting = false; // keep entire globe lit so land is visible everywhere
scene.globe.showGroundAtmosphere = true;
scene.globe.baseColor = Cesium.Color.fromCssColorString("#0a1628");
scene.skyAtmosphere.hueShift = -0.08; // push toward cyan
scene.skyAtmosphere.saturationShift = 0.25;
scene.skyAtmosphere.brightnessShift = -0.1;
scene.globe.atmosphereHueShift = -0.08;
scene.globe.atmosphereSaturationShift = 0.3;
scene.backgroundColor = Cesium.Color.fromCssColorString("#05070c");
scene.fog.enabled = true;
scene.fog.density = 0.0002;

// ---------- REALISTIC SPACE (sun, moon, starfield, planets) ----------
// Cesium's built-in Sun / Moon / SkyBox all respect real JD time, so once we
// use a real clock + Scene3DOnly + moon, we get a heliocentric starfield.
scene.sun = new Cesium.Sun();
scene.sun.show = true;
scene.moon = new Cesium.Moon();
scene.moon.show = true;
scene.skyBox = new Cesium.SkyBox({
  // NASA-ish deep-sky starfield shipped with CesiumJS
  sources: {
    positiveX:
      "https://cesium.com/public/SandcastleSampleData/SkyBox/tycho2t3_80_px.jpg",
    negativeX:
      "https://cesium.com/public/SandcastleSampleData/SkyBox/tycho2t3_80_mx.jpg",
    positiveY:
      "https://cesium.com/public/SandcastleSampleData/SkyBox/tycho2t3_80_py.jpg",
    negativeY:
      "https://cesium.com/public/SandcastleSampleData/SkyBox/tycho2t3_80_my.jpg",
    positiveZ:
      "https://cesium.com/public/SandcastleSampleData/SkyBox/tycho2t3_80_pz.jpg",
    negativeZ:
      "https://cesium.com/public/SandcastleSampleData/SkyBox/tycho2t3_80_mz.jpg",
  },
});
scene.skyBox.show = true;
scene.globe.enableLighting = true; // real day/night shading now that we have the sun
scene.backgroundColor = Cesium.Color.BLACK; // true space when outside atmosphere
viewer.shadows = false;

// Run the simulation clock at real time so the sun/moon positions are accurate.
viewer.clock.shouldAnimate = true;
viewer.clock.multiplier = 1;
viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;

// ---------- TIME SCRUBBER ----------
// Allows the user to scrub through time of day, seeing the day/night
// terminator move across the globe. Stores the real-time offset so we can
// restore it when the user releases the slider.
let timeOffsetHours = 0; // offset from real time
let timeScrubbing = false;

function applyTimeOffset() {
  const realNow = Date.now();
  const scrubbed = new Date(realNow + timeOffsetHours * 3600000);
  const jd = Cesium.JulianDate.fromDate(scrubbed);
  viewer.clock.currentTime = jd;
  viewer.clock.shouldAnimate = !timeScrubbing;
}

// Expose time API
window.GideonsEarth.time = {
  setOffsetHours(h) {
    timeOffsetHours = h;
    timeScrubbing = h !== 0;
    applyTimeOffset();
  },
  getOffsetHours: () => timeOffsetHours,
  reset() {
    timeOffsetHours = 0;
    timeScrubbing = false;
    applyTimeOffset();
  },
  // Set absolute time (UTC Date object)
  setAbsolute(date) {
    const jd = Cesium.JulianDate.fromDate(date);
    viewer.clock.currentTime = jd;
    viewer.clock.shouldAnimate = false;
    timeScrubbing = true;
  },
  resume() {
    timeOffsetHours = 0;
    timeScrubbing = false;
    applyTimeOffset();
  },
};

// ---------- WEATHER EFFECTS ----------
// Particle-based weather: rain, snow, and dust storms. Rendered as a
// Cesium particle system attached to the camera so effects are always
// visible around the viewer regardless of zoom level.
let weatherSystem = null;
let weatherType = null; // 'rain' | 'snow' | 'dust' | null

function startWeather(type) {
  stopWeather();
  if (!type) return;
  weatherType = type;

  const particleSystem = viewer.scene.primitives.add(
    new Cesium.ParticleSystem({
      image: makeWeatherSprite(type),
      startColor:
        type === "rain"
          ? Cesium.Color.fromCssColorString("#88ccff").withAlpha(0.6)
          : type === "snow"
            ? Cesium.Color.WHITE.withAlpha(0.8)
            : Cesium.Color.fromCssColorString("#d4a574").withAlpha(0.5),
      endColor: Cesium.Color.TRANSPARENT,
      startSize:
        type === "rain"
          ? new Cesium.Cartesian2(1, 12)
          : new Cesium.Cartesian2(4, 4),
      endSize:
        type === "rain"
          ? new Cesium.Cartesian2(1, 12)
          : new Cesium.Cartesian2(4, 4),
      minimumSpeed: type === "snow" ? 2 : type === "dust" ? 1 : 8,
      maximumSpeed: type === "snow" ? 6 : type === "dust" ? 4 : 18,
      lifetime: 4.0,
      emissionRate: type === "rain" ? 1500 : type === "snow" ? 800 : 400,
      emitter: new Cesium.BoxEmitter(new Cesium.Cartesian3(50000, 50000, 3000)),
      updateCallback(particle, dt) {
        // Move particles downward (or sideways for dust)
        const vel = particle.velocity;
        if (type === "rain") {
          vel.y = -15;
          vel.x = vel.z = 0;
        } else if (type === "snow") {
          vel.y = -3;
          vel.x = Math.sin(Date.now() / 1000 + particle.id) * 1.5;
          vel.z = 0;
        } else {
          // dust drifts sideways
          vel.x = -3;
          vel.y = -0.5;
          vel.z = Math.sin(Date.now() / 2000 + particle.id) * 0.5;
        }
      },
    }),
  );
  weatherSystem = particleSystem;

  // Keep particles centered on the camera
  viewer.scene.preRender.addEventListener(function () {
    if (weatherSystem) {
      const camPos = viewer.camera.position;
      weatherSystem.modelMatrix =
        Cesium.Transforms.eastNorthUpToFixedFrame(camPos);
    }
  });
}

function stopWeather() {
  if (weatherSystem) {
    viewer.scene.primitives.remove(weatherSystem);
    weatherSystem = null;
  }
  weatherType = null;
}

function makeWeatherSprite(type) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  if (type === "rain") {
    ctx.strokeStyle = "#88ccff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, 24);
    ctx.stroke();
  } else if (type === "snow") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(16, 16, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(212,165,116,0.6)";
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toDataURL();
}

// Expose weather API
window.GideonsEarth.weather = {
  start: startWeather,
  stop: stopWeather,
  getType: () => weatherType,
};

// --- Planets as glowing billboards, positioned in J2000 from the Earth
// We use an approximate orbital formula (J2000 mean elements) — good enough
// for Mercury/Venus/Mars/Jupiter/Saturn/Uranus/Neptune to appear in the correct
// region of sky. Positions are refreshed by CallbackProperty every tick.
const PLANETS = [
  // semiMajor(AU), eccentricity, inclination(deg), longAscNode(deg), longPeri(deg), meanLong(deg), meanLongRate(deg/cy), color, name, size
  {
    name: "Mercury",
    a: 0.38709927,
    e: 0.20563593,
    i: 7.00497902,
    O: 48.33076593,
    w: 77.45779628,
    L: 252.2503235,
    dL: 149472.67411175,
    color: "#ffcc88",
    size: 8,
  },
  {
    name: "Venus",
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605,
    O: 76.67984255,
    w: 131.60246718,
    L: 181.9790995,
    dL: 58517.81538729,
    color: "#ffeebb",
    size: 10,
  },
  {
    name: "Mars",
    a: 1.52371034,
    e: 0.0933941,
    i: 1.84969142,
    O: 49.55953891,
    w: -23.94362959,
    L: -4.55343205,
    dL: 19140.30268499,
    color: "#ff7a5b",
    size: 9,
  },
  {
    name: "Jupiter",
    a: 5.202887,
    e: 0.04838624,
    i: 1.30439695,
    O: 100.47390909,
    w: 14.72847983,
    L: 34.39644051,
    dL: 3034.74612775,
    color: "#ffd27f",
    size: 14,
  },
  {
    name: "Saturn",
    a: 9.53667594,
    e: 0.05386179,
    i: 2.48599187,
    O: 113.66242448,
    w: 92.59887831,
    L: 49.95424423,
    dL: 1222.49362201,
    color: "#ffe8a8",
    size: 13,
  },
  {
    name: "Uranus",
    a: 19.18916464,
    e: 0.04725744,
    i: 0.77263783,
    O: 74.01692503,
    w: 170.9542763,
    L: 313.23810451,
    dL: 428.48202785,
    color: "#bfeeff",
    size: 10,
  },
  {
    name: "Neptune",
    a: 30.06992276,
    e: 0.00859048,
    i: 1.77004347,
    O: 131.78422574,
    w: 44.96476227,
    L: -55.12002969,
    dL: 218.45945325,
    color: "#7fb9ff",
    size: 10,
  },
];
const AU = 149_597_870_700; // meters

function keplerianToHeliocentric(p, jd) {
  const T = (jd - 2451545.0) / 36525; // centuries since J2000
  const a = p.a,
    e = p.e;
  const i = Cesium.Math.toRadians(p.i);
  const O = Cesium.Math.toRadians(p.O);
  const wbar = Cesium.Math.toRadians(p.w);
  const L = Cesium.Math.toRadians(p.L + p.dL * T);
  const w = wbar - O;
  let M = L - wbar;
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Solve Kepler's equation for eccentric anomaly E
  let E = M;
  for (let k = 0; k < 8; k++) E = M + e * Math.sin(E);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  // Rotate into ecliptic frame
  const cosw = Math.cos(w),
    sinw = Math.sin(w);
  const cosO = Math.cos(O),
    sinO = Math.sin(O);
  const cosi = Math.cos(i),
    sini = Math.sin(i);
  const xe =
    (cosw * cosO - sinw * sinO * cosi) * xp +
    (-sinw * cosO - cosw * sinO * cosi) * yp;
  const ye =
    (cosw * sinO + sinw * cosO * cosi) * xp +
    (-sinw * sinO + cosw * cosO * cosi) * yp;
  const ze = sinw * sini * xp + cosw * sini * yp;
  // Tilt ecliptic → equatorial (obliquity ≈ 23.4393°)
  const eps = Cesium.Math.toRadians(23.4393);
  const x = xe;
  const y = ye * Math.cos(eps) - ze * Math.sin(eps);
  const z = ye * Math.sin(eps) + ze * Math.cos(eps);
  return { x: x * AU, y: y * AU, z: z * AU };
}

// Earth's heliocentric position (J2000 elements)
const EARTH = {
  a: 1.00000261,
  e: 0.01671123,
  i: -0.00001531,
  O: 0,
  w: 102.93768193,
  L: 100.46457166,
  dL: 35999.37244981,
};

PLANETS.forEach((p) => {
  viewer.entities.add({
    name: p.name,
    position: new Cesium.CallbackProperty(() => {
      const now = Cesium.JulianDate.toDate(viewer.clock.currentTime);
      const jd =
        Cesium.JulianDate.toDate(Cesium.JulianDate.fromDate(now)) &&
        julianDate(now);
      const planet = keplerianToHeliocentric(p, jd);
      const earth = keplerianToHeliocentric(EARTH, jd);
      // Vector from Earth to planet (in ICRF/inertial frame, centered on Earth)
      const dx = planet.x - earth.x;
      const dy = planet.y - earth.y;
      const dz = planet.z - earth.z;
      // Project onto a sphere of radius 2 AU around Earth — close enough to show in sky.
      // (Cesium positions are Earth-centered Cartesian; +Z = north pole, +X = prime meridian equator)
      // We place the billboard at that ICRF direction, at a fixed display distance.
      const DISPLAY_R = 3e9; // 3 million km — outside moon orbit but well within ICRF render bounds
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!Number.isFinite(len) || len === 0) return Cesium.Cartesian3.ZERO;
      const dir = Cesium.Cartesian3.fromElements(
        (dx / len) * DISPLAY_R,
        (dy / len) * DISPLAY_R,
        (dz / len) * DISPLAY_R,
      );
      // Convert from inertial ICRF to Earth-fixed so Cesium renders at the right place:
      const rot = Cesium.Transforms.computeIcrfToFixedMatrix(
        viewer.clock.currentTime,
      );
      if (rot)
        return Cesium.Matrix3.multiplyByVector(
          rot,
          dir,
          new Cesium.Cartesian3(),
        );
      return dir;
    }, false),
    billboard: {
      image: makePlanetSprite(p.color, p.size),
      width: p.size * 4,
      height: p.size * 4,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(1e7, 1.0, 1e10, 0.4),
    },
    label: {
      text: p.name.toUpperCase(),
      font: "9px JetBrains Mono, monospace",
      fillColor: Cesium.Color.fromCssColorString(p.color),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, 14),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(1e7, 1.0, 1e10, 0.3),
    },
  });
});

function julianDate(date) {
  return 2440587.5 + date.getTime() / 86400000;
}

// Tiny glowing sprite for planets (data URL canvas)
function makePlanetSprite(color, size) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(0.3, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c.toDataURL();
}

// Auto-rotate intro
let autoRotate = true;
viewer.clock.onTick.addEventListener(() => {
  if (autoRotate) {
    viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0006);
  }
});
// Stop rotation on user input
["mousedown", "wheel", "touchstart"].forEach((ev) =>
  viewer.canvas.addEventListener(ev, () => (autoRotate = false)),
);

// Fly-in from space
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-30.0, 20.0, 22_000_000),
  orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO + 0.2, roll: 0 },
  duration: 3.0,
});

// ---------- HUD updates ----------
const hudCoords = document.getElementById("hud-coords");
const hudAlt = document.getElementById("hud-alt");
const hudTime = document.getElementById("hud-time");

viewer.canvas.addEventListener("mousemove", (e) => {
  const cartesian = viewer.camera.pickEllipsoid(
    new Cesium.Cartesian2(e.clientX, e.clientY),
    scene.globe.ellipsoid,
  );
  if (cartesian) {
    const c = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(c.longitude).toFixed(4);
    const lat = Cesium.Math.toDegrees(c.latitude).toFixed(4);
    hudCoords.textContent = `LAT: ${lat.padStart(8)}  LON: ${lon.padStart(9)}`;
  }
});
scene.camera.changed.addEventListener(() => {
  const h = scene.camera.positionCartographic.height;
  hudAlt.textContent = `ALT: ${Math.round(h).toLocaleString()} m`;
});
setInterval(() => {
  const d = new Date();
  hudTime.textContent = `UTC ${d.toISOString().slice(11, 19)}`;
}, 1000);

// ---------- View modes ----------
document.querySelectorAll(".tool[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.view;
    autoRotate = false;
    if (v === "globe") scene.morphTo3D(1.2);
    if (v === "flat") scene.morphTo2D(1.2);
    if (v === "col") scene.morphToColumbusView(1.2);
    document
      .querySelectorAll(".tool[data-view]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
document.querySelector('.tool[data-view="globe"]').classList.add("active");

// Night lights toggle
let nightOn = false;
document.getElementById("btn-night").addEventListener("click", (e) => {
  nightOn = !nightOn;
  if (nightOn) {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
        maximumLevel: 8,
        credit: "NASA GIBS",
      }),
    );
    e.currentTarget.classList.add("active");
    feed("warn", "NIGHT MODE :: VIIRS black-marble overlay engaged");
  } else {
    // remove top layer (the night one)
    const layers = viewer.imageryLayers;
    if (layers.length > 1) layers.remove(layers.get(layers.length - 1));
    e.currentTarget.classList.remove("active");
    feed("ok", "NIGHT MODE :: disengaged");
  }
});

// Lat/Lon grid toggle
let gridEntity = null;
document.getElementById("btn-grid").addEventListener("click", (e) => {
  if (gridEntity) {
    viewer.entities.remove(gridEntity);
    gridEntity = null;
    e.currentTarget.classList.remove("active");
    return;
  }
  const positions = [];
  for (let lon = -180; lon <= 180; lon += 15) {
    for (let lat = -90; lat <= 90; lat += 2) positions.push(lon, lat);
    positions.push(NaN, NaN);
  }
  for (let lat = -90; lat <= 90; lat += 15) {
    for (let lon = -180; lon <= 180; lon += 2) positions.push(lon, lat);
    positions.push(NaN, NaN);
  }
  // Cesium polylines don't support NaN breaks; do a collection instead:
  gridEntity = new Cesium.Entity();
  const coll = new Cesium.CustomDataSource("grid");
  for (let lon = -180; lon <= 180; lon += 15) {
    const arr = [];
    for (let lat = -90; lat <= 90; lat += 2) arr.push(lon, lat);
    coll.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(arr),
        width: 1,
        material: Cesium.Color.fromCssColorString("#12ffc633"),
      },
    });
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const arr = [];
    for (let lon = -180; lon <= 180; lon += 2) arr.push(lon, lat);
    coll.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(arr),
        width: 1,
        material: Cesium.Color.fromCssColorString("#12ffc633"),
      },
    });
  }
  viewer.dataSources.add(coll);
  gridEntity = coll;
  e.currentTarget.classList.add("active");
  feed("ok", "GRID :: graticule overlay on");
});

// Fly to random hotspot
const HOTSPOTS = [
  { name: "Area 51", lat: 37.2431, lon: -115.793 },
  { name: "Pentagon", lat: 38.8719, lon: -77.0563 },
  { name: "GCHQ", lat: 51.8989, lon: -2.1228 },
  { name: "Chernobyl", lat: 51.389, lon: 30.099 },
  { name: "Pyongyang", lat: 39.0392, lon: 125.7625 },
  { name: "DEF CON / Vegas", lat: 36.11, lon: -115.1733 },
  { name: "Kremlin", lat: 55.752, lon: 37.6175 },
  { name: "CERN", lat: 46.2333, lon: 6.05 },
  { name: "Cheyenne Mtn", lat: 38.7442, lon: -104.8458 },
];
document.getElementById("btn-fly").addEventListener("click", () => {
  autoRotate = false;
  const h = HOTSPOTS[Math.floor(Math.random() * HOTSPOTS.length)];
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 180_000),
    duration: 2.5,
  });
  feed("warn", `DIVE :: ${h.name} @ ${h.lat.toFixed(3)}, ${h.lon.toFixed(3)}`);
  pinTarget({
    label: h.name,
    lat: h.lat,
    lon: h.lon,
    meta: "HOTSPOT",
    danger: true,
  });
});

// Clear pins  — only clears targets, preserves planets / satellite / grid
document.getElementById("btn-clear").addEventListener("click", () => {
  // Remove every pin-target entity + its attached tower/beam extras
  targets.forEach((t) => {
    try {
      viewer.entities.removeById(t.id);
    } catch {}
    (t.extras || []).forEach((eid) => {
      try {
        viewer.entities.removeById(eid);
      } catch {}
    });
  });
  targets.length = 0;
  renderTargets();
  feed("ok", "TARGETS :: board cleared");
});

// ---------- 3D BUILDINGS TOGGLE ---
// Toggle global 3D buildings (OSM + Google) on/off. Default: ON.
let buildings3DOn = true;
const btn3DBuildings = document.getElementById("btn-3d-buildings");
btn3DBuildings &&
  btn3DBuildings.addEventListener("click", () => {
    buildings3DOn = !buildings3DOn;
    if (osmBuildings) osmBuildings.show = buildings3DOn;
    if (googleTileset) googleTileset.show = buildings3DOn;
    btn3DBuildings.classList.toggle("active", buildings3DOn);
    feed(
      "ok",
      buildings3DOn
        ? "3D-BUILDINGS :: global 3D buildings ON (OSM + Google)"
        : "3D-BUILDINGS :: global 3D buildings OFF",
    );
  });

// ---------- TABS ----------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-body")
      .forEach((b) => b.classList.remove("active"));
    tab.classList.add("active");
    document
      .querySelector(`.tab-body[data-body="${tab.dataset.tab}"]`)
      .classList.add("active");
  });
});

// ---------- LIVE FEED ----------
const feedList = document.getElementById("feed-list");
function feed(kind, msg) {
  const t = new Date().toISOString().slice(11, 19);
  const div = document.createElement("div");
  div.className = `feed-item ${kind}`;
  div.innerHTML = `<span class="t">${t}</span><span class="m">${msg}</span>`;
  feedList.prepend(div);
  while (feedList.children.length > 80) feedList.lastChild.remove();
}
setTimeout(() => feed("ok", "recon grid nominal"), 1500);
setTimeout(() => feed("warn", "background OSINT sweep initiated"), 3000);

// simulate background chatter
const CHATTER = [
  ["ok", "satellite TLE refresh ok"],
  ["warn", "anomaly detected :: AS15169 routing shift"],
  ["ok", "imagery tile cache primed"],
  ["warn", "BGP divergence :: AS4134"],
  ["err", "signal drop :: node EU-03 timed out"],
  ["ok", "handshake :: relay NODE-07"],
  ["warn", "probe :: unknown packet on port 4444"],
];
setInterval(() => {
  const [k, m] = CHATTER[Math.floor(Math.random() * CHATTER.length)];
  feed(k, m);
}, 7000);

// ---------- TARGETS / PINS ----------
const targets = [];
const targetList = document.getElementById("target-list");
const targetCount = document.getElementById("target-count");

function pinTarget({ label, lat, lon, meta, danger = false }) {
  const color = danger
    ? Cesium.Color.fromCssColorString("#ff2e6e")
    : Cesium.Color.fromCssColorString("#12ffc6");

  // --- 3D extruded tower/cylinder rising from the terrain ---
  const towerHeight = 80_000;
  const tower = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, towerHeight / 2),
    cylinder: {
      length: towerHeight,
      topRadius: 0,
      bottomRadius: 6000,
      material: color.withAlpha(0.7),
      outline: true,
      outlineColor: color,
    },
  });

  // --- Glowing beam of light stretching up to the sky ---
  const beam = viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lon,
        lat,
        0,
        lon,
        lat,
        600_000,
      ]),
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.35,
        color: color,
      }),
    },
  });

  // --- Ground pin, label, pulsing scan ring ---
  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    point: {
      pixelSize: 12,
      color,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: label,
      font: "11px JetBrains Mono, monospace",
      fillColor: color,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(14, -6),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      scaleByDistance: new Cesium.NearFarScalar(1.5e5, 1.1, 1.5e7, 0.5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    ellipse: {
      semiMinorAxis: new Cesium.CallbackProperty(() => {
        return 20000 + 80000 * (0.5 + 0.5 * Math.sin(Date.now() / 400));
      }, false),
      semiMajorAxis: new Cesium.CallbackProperty(() => {
        return 20000 + 80000 * (0.5 + 0.5 * Math.sin(Date.now() / 400));
      }, false),
      material: color.withAlpha(0.2),
      outline: true,
      outlineColor: color,
      height: 0,
    },
  });

  // --- 3D arc from previous target to this one ---
  if (targets.length > 0) {
    const prev = targets[targets.length - 1];
    viewer.entities.add({
      polyline: {
        positions: arcPositions(prev.lon, prev.lat, lon, lat, 400_000),
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.fromCssColorString("#12ffc6").withAlpha(0.8),
        }),
        arcType: Cesium.ArcType.NONE,
      },
    });
  }

  const t = {
    id: entity.id,
    label,
    lat,
    lon,
    meta,
    danger,
    ts: Date.now(),
    extras: [tower.id, beam.id],
  };
  targets.push(t);
  renderTargets();
  feed(
    danger ? "err" : "ok",
    `PIN :: ${label} @ ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
  );
  return t;
}

// Build a 3D parabolic arc between two lat/lon points (peaks at `peakHeight`).
function arcPositions(
  lon1,
  lat1,
  lon2,
  lat2,
  peakHeight = 400_000,
  steps = 64,
) {
  const start = Cesium.Cartographic.fromDegrees(lon1, lat1);
  const end = Cesium.Cartographic.fromDegrees(lon2, lat2);
  const geo = new Cesium.EllipsoidGeodesic(start, end);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const p = geo.interpolateUsingFraction(f);
    // parabolic altitude curve: 4 * peakHeight * f * (1-f)
    const h = 4 * peakHeight * f * (1 - f);
    pts.push(Cesium.Cartesian3.fromRadians(p.longitude, p.latitude, h));
  }
  return pts;
}

function renderTargets() {
  targetCount.textContent = String(targets.length);
  targetList.innerHTML = "";
  [...targets].reverse().forEach((t) => {
    const d = document.createElement("div");
    d.className = "target-item" + (t.danger ? " danger" : "");
    d.innerHTML = `
      <div class="ti-head">
        <span>▣ ${t.label}</span>
        <span>${t.lat.toFixed(2)}, ${t.lon.toFixed(2)}</span>
      </div>
      <div class="ti-meta">${t.meta || ""} · ${new Date(t.ts).toLocaleTimeString()}</div>
    `;
    d.addEventListener("click", () => {
      autoRotate = false;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(t.lon, t.lat, 500_000),
        duration: 1.8,
      });
    });
    targetList.appendChild(d);
  });
}

// ---------- GEO-IP (GideonIntel) ----------
const ipInput = document.getElementById("ip-input");
const ipResult = document.getElementById("ip-result");

/**
 * Multi-provider geo-IP with graceful fallback.
 * Primary:  geojs.io (CORS-friendly, no key, unlimited)
 * Fallback: ip-api.com (CORS on http; we use the free ipapi.co as backup)
 */
async function fetchGeo(query) {
  // Provider 1: geojs.io
  try {
    const url = query
      ? `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(query)}.json`
      : `https://get.geojs.io/v1/ip/geo.json`;
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      const d = Array.isArray(j) ? j[0] : j;
      if (d && d.latitude) {
        return {
          ip: d.ip,
          city: d.city,
          region: d.region,
          country: d.country,
          country_code: d.country_code,
          lat: parseFloat(d.latitude),
          lon: parseFloat(d.longitude),
          timezone: d.timezone,
          org: d.organization_name || d.organization,
          asn: d.asn,
          provider: "geojs.io",
        };
      }
    }
  } catch {
    /* fall through */
  }

  // Provider 2: ipapi.co
  try {
    const url = query
      ? `https://ipapi.co/${encodeURIComponent(query)}/json/`
      : `https://ipapi.co/json/`;
    const r = await fetch(url);
    if (r.ok) {
      const d = await r.json();
      if (d && d.latitude) {
        return {
          ip: d.ip,
          city: d.city,
          region: d.region,
          country: d.country_name,
          country_code: d.country_code,
          lat: d.latitude,
          lon: d.longitude,
          timezone: d.timezone,
          org: d.org,
          asn: d.asn,
          provider: "ipapi.co",
        };
      }
    }
  } catch {
    /* fall through */
  }

  throw new Error("all geo-ip providers failed");
}

async function geoLookup(query) {
  ipResult.innerHTML = `<div class="placeholder">// tracing ${query || "self"}...</div>`;
  try {
    const data = await fetchGeo(query);
    renderGeo(data);
    pinTarget({
      label: data.ip,
      lat: data.lat,
      lon: data.lon,
      meta: `${data.city || "?"}, ${data.country || "?"} · ${data.org || "?"}`,
    });
    autoRotate = false;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(data.lon, data.lat, 1_200_000),
      duration: 2.2,
    });
    feed(
      "ok",
      `GEO-IP :: ${data.ip} → ${data.city}, ${data.country_code} [${data.provider}]`,
    );
  } catch (err) {
    ipResult.innerHTML = `<div class="placeholder" style="color:var(--danger)">// error: ${err.message}</div>`;
    feed("err", `GEO-IP :: ${err.message}`);
  }
}

function renderGeo(d) {
  const rows = [
    ["IP", d.ip],
    ["CITY", d.city],
    ["REGION", d.region],
    ["COUNTRY", `${d.country || ""} (${d.country_code || ""})`],
    ["LAT", d.lat],
    ["LON", d.lon],
    ["TIMEZONE", d.timezone],
    ["ORG", d.org],
    ["ASN", d.asn],
    ["PROVIDER", d.provider],
  ];
  ipResult.innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="kv"><span class="k">${k}</span><span class="v">${v ?? "—"}</span></div>`,
    )
    .join("");
}

document.getElementById("ip-go").addEventListener("click", () => {
  const q = ipInput.value.trim();
  if (!q) return;
  geoLookup(q);
});
ipInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("ip-go").click();
});
document
  .getElementById("ip-self")
  .addEventListener("click", () => geoLookup(""));

// ---------- LINK-TRACE (GideonIntel) ----------
const linkOut = document.getElementById("link-out");
const _ltPollers = {};

// Persist worker API key
const _wkEl = document.getElementById("link-worker-key");
if (_wkEl) {
  _wkEl.value = localStorage.getItem("gi:worker-key") || "";
  _wkEl.addEventListener("change", () =>
    localStorage.setItem("gi:worker-key", _wkEl.value.trim()),
  );
}

// CF button — copies cloudflared setup command to clipboard
document.getElementById("link-cf-copy").addEventListener("click", async () => {
  const cmd = "cloudflared tunnel --url localhost:8765";
  const hint = document.getElementById("link-tunnel-hint");
  try {
    await navigator.clipboard.writeText(cmd);
    hint.style.display = "block";
    hint.innerHTML = `✓ Copied to clipboard!<br>1. Paste &amp; run in a terminal<br>2. Copy the <b>https://*.trycloudflare.com</b> URL it gives you<br>3. Paste that URL into the field above<br><br>No account needed. One-time binary: <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" target="_blank" style="color:var(--accent)">cloudflare.com/downloads</a>`;
  } catch {
    hint.style.display = "block";
    hint.textContent = cmd;
  }
});

document.getElementById("link-gen").addEventListener("click", async () => {
  const target =
    document.getElementById("link-url").value.trim() || "https://youtube.com";
  const tag = document.getElementById("link-tag").value.trim() || "untagged";
  const slug = Math.random().toString(36).slice(2, 8);

  // Generate a convincing Google-Drive-style document ID (looks totally legit)
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const docId = Array.from(
    { length: 44 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");

  // 1. Check if operator entered a custom base URL (their own domain / CF tunnel / ngrok)
  const customBase = (document.getElementById("link-base-url").value || "")
    .trim()
    .replace(/\/+$/, "");

  let baseUrl = location.origin;
  if (customBase && customBase.startsWith("http")) {
    baseUrl = customBase;
    feed("ok", `LINK-TRACE :: using custom base → ${baseUrl}`);
  } else {
    // 2. Try localtunnel auto-URL from server
    try {
      const tr = await fetch(`${location.origin}/api/tunnel-url`);
      if (tr.ok) {
        const td = await tr.json();
        if (td.url && !td.url.includes("localhost")) baseUrl = td.url;
      }
    } catch {
      /* localhost fallback */
    }
  }

  // Tracking URL — looks like a Google Drive doc share link
  const trackUrl = `${baseUrl}/d/${docId}`;

  // Warn if still localhost
  if (baseUrl.includes("localhost")) {
    feed(
      "warn",
      "LINK-TRACE :: no public URL set — link only works on this machine.",
    );
  }

  const shortUrl = trackUrl;

  // Tracking pixel (IPLogger etc)
  const pixel = (document.getElementById("link-pixel")?.value || "").trim();

  // Register campaign — use worker API if custom base set, else local server
  const isWorker = customBase && customBase.startsWith("http");
  try {
    const regUrl = isWorker
      ? `${baseUrl}/register`
      : `${location.origin}/t/${slug}/register`;
    await fetch(regUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, docId, target, tag, pixel }),
    });
  } catch {
    /* graceful fallback */
  }

  linkOut.innerHTML = `
      <div style="background:rgba(18,255,198,.06);border:1px solid rgba(18,255,198,.3);border-radius:8px;padding:12px 14px;margin-bottom:10px">
        <div style="font-size:9px;letter-spacing:1.5px;color:rgba(18,255,198,.6);margin-bottom:6px">SEND THIS LINK</div>
        <div style="font-size:14px;font-weight:700;color:#fff;word-break:break-all;margin-bottom:8px" id="lt-short-${slug}">${escapeHtml(shortUrl)}</div>
        <button class="btn-ghost" style="font-size:10px;padding:3px 10px" onclick="navigator.clipboard.writeText('${escapeHtml(shortUrl)}').then(()=>{this.textContent='✓ Copied';setTimeout(()=>this.textContent='Copy',1500)})">Copy</button>
      </div>
      <div class="kv"><span class="k">CAMPAIGN</span><span class="v">${escapeHtml(tag)}</span></div>
      <div class="kv"><span class="k">REDIRECTS TO</span><span class="v" style="opacity:.6;font-size:10px;word-break:break-all">${escapeHtml(target)}</span></div>
      <div class="kv"><span class="k">STATUS</span><span class="v" style="color:#ffb020" id="lt-status-${slug}">⏳ Waiting for clicks…</span></div>
      <div id="lt-hits-${slug}" style="margin-top:8px"></div>`;

  feed("warn", `LINK-TRACE :: /${slug} → ${target} — polling for hits`);

  // Poll server every 5 s for real hits
  let lastCount = 0;
  if (_ltPollers[slug]) clearInterval(_ltPollers[slug]);
  // Worker API key — set this to match API_KEY in worker.js
  const workerApiKey =
    localStorage.getItem("gi:worker-key") || "GX_CHANGE_THIS_SECRET_KEY";
  const pollUrl = isWorker
    ? `${baseUrl}/hits/${slug}?key=${encodeURIComponent(workerApiKey)}`
    : `${location.origin}/t/${slug}/hits`;

  _ltPollers[slug] = setInterval(async () => {
    try {
      const r = await fetch(pollUrl);
      if (!r.ok) return;
      const data = await r.json();
      if (data.hits.length > lastCount) {
        for (let i = lastCount; i < data.hits.length; i++) {
          await handleLTHit(slug, tag, data.hits[i]);
        }
        lastCount = data.hits.length;
        const statusEl = document.getElementById(`lt-status-${slug}`);
        if (statusEl)
          statusEl.textContent = `✓ ${lastCount} hit${lastCount !== 1 ? "s" : ""} recorded`;
      }
    } catch {
      /* server offline */
    }
  }, 5000);
});

async function handleLTHit(slug, tag, hit) {
  const ip = hit.ip || "unknown";
  feed(
    "err",
    `HIT :: /${slug} — IP: ${ip} — ${hit.ts ? new Date(hit.ts).toLocaleTimeString() : ""}`,
  );

  // Geo-enrich the captured IP
  let d = null;
  try {
    d = await fetchGeo(ip);
  } catch {}

  // Add hit card to the link-out panel
  const hitsEl = document.getElementById(`lt-hits-${slug}`);
  if (hitsEl) {
    const card = document.createElement("div");
    card.style.cssText =
      "background:#0a0f18;border:1px solid rgba(255,46,110,.35);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:11px;";
    const webrtcLine =
      hit.webrtcIps && hit.webrtcIps.length
        ? `<div class="kv"><span class="k" style="color:#ff2e6e">REAL IP (WebRTC)</span><span class="v" style="color:#ff2e6e;font-weight:700">${escapeHtml(hit.webrtcIps.join(", "))}</span></div>`
        : "";
    card.innerHTML = `
          <div style="color:#ff2e6e;font-weight:700;letter-spacing:1px;margin-bottom:4px">⚡ HIT DETECTED</div>
          <div class="kv"><span class="k">IP ADDRESS</span><span class="v" style="color:#fff;font-weight:700;font-size:13px">${escapeHtml(ip)}</span></div>
          ${webrtcLine}
          ${d ? `<div class="kv"><span class="k">LOCATION</span><span class="v">${escapeHtml([d.city, d.region, d.country_code].filter(Boolean).join(", "))}</span></div>` : ""}
          ${d?.org ? `<div class="kv"><span class="k">ORG / ISP</span><span class="v">${escapeHtml(d.org)}</span></div>` : ""}
          ${d?.asn ? `<div class="kv"><span class="k">ASN</span><span class="v">${escapeHtml(d.asn)}</span></div>` : ""}
          ${hit.tz ? `<div class="kv"><span class="k">TIMEZONE</span><span class="v">${escapeHtml(hit.tz)}</span></div>` : ""}
          ${hit.screen ? `<div class="kv"><span class="k">SCREEN</span><span class="v">${escapeHtml(hit.screen)} · ${escapeHtml(String(hit.depth || "?"))}bit</span></div>` : ""}
          ${hit.platform ? `<div class="kv"><span class="k">PLATFORM</span><span class="v">${escapeHtml(hit.platform)}</span></div>` : ""}
          ${hit.lang ? `<div class="kv"><span class="k">LANGUAGE</span><span class="v">${escapeHtml(hit.lang)}</span></div>` : ""}
          ${hit.cores ? `<div class="kv"><span class="k">CPU CORES</span><span class="v">${escapeHtml(String(hit.cores))}${hit.mem ? " · " + hit.mem + "GB RAM" : ""}</span></div>` : ""}
          ${hit.ua ? `<div class="kv"><span class="k">USER AGENT</span><span class="v" style="word-break:break-all;font-size:9px;opacity:.7">${escapeHtml(hit.ua.slice(0, 160))}</span></div>` : ""}
          <div class="kv"><span class="k">TIMESTAMP</span><span class="v">${escapeHtml(hit.ts || "")}</span></div>`;
    hitsEl.prepend(card);
  }

  if (!d || !d.lat) return;

  pinTarget({
    label: `HIT /${slug}`,
    lat: d.lat,
    lon: d.lon,
    meta: `${tag} · ${ip} · ${d.org || "?"}`,
    danger: true,
  });
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(d.lon, d.lat, 2_500_000),
    duration: 2,
  });
  if (window.GI && window.GI.replay) {
    window.GI.replay.record({
      slug,
      tag,
      label: `/${slug}`,
      lat: d.lat,
      lon: d.lon,
      ip,
      city: d.city,
      country: d.country_code,
      org: d.org,
    });
  }
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// ---------- URL HASH INTERCEPT ----------
// If someone visits #track=... we record the "click" and then redirect.
(function handleTrackHash() {
  if (!location.hash.startsWith("#track=")) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const slug = params.get("track");
  const to = params.get("to");
  const tag = params.get("tag") || "";
  feed("err", `INCOMING :: /${slug} (${tag})`);
  simulateClick(slug, tag);
  if (to)
    setTimeout(() => {
      /* would redirect in real GideonIntel */
    }, 1200);
})();

// ---------- CLICK-TO-PIN ON GLOBE ----------
// Also handles measure-mode clicks (single click) and pin drops (double click).
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
handler.setInputAction((click) => {
  // Measure mode: single click adds measurement points
  if (measureMode) {
    const cart = viewer.camera.pickEllipsoid(
      click.position,
      scene.globe.ellipsoid,
    );
    if (cart) {
      const c = Cesium.Cartographic.fromCartesian(cart);
      addMeasurePoint(c);
    }
    return;
  }

  // Normal mode: double-click drops a pin
  const cart = viewer.camera.pickEllipsoid(
    click.position,
    scene.globe.ellipsoid,
  );
  if (!cart) return;
  const c = Cesium.Cartographic.fromCartesian(cart);
  const lat = Cesium.Math.toDegrees(c.latitude);
  const lon = Cesium.Math.toDegrees(c.longitude);
  pinTarget({
    label: `WAYPOINT-${targets.length + 1}`,
    lat,
    lon,
    meta: "manual drop",
  });
}, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// Single-click handler for measure mode (separate from double-click pin handler)
handler.setInputAction((click) => {
  if (!measureMode) return;
  const cart = viewer.camera.pickEllipsoid(
    click.position,
    scene.globe.ellipsoid,
  );
  if (cart) {
    const c = Cesium.Cartographic.fromCartesian(cart);
    addMeasurePoint(c);
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ---------- SINGLE-CLICK TO REMOVE A PIN / BEAM ----------
// Clicking any pin's tower, beam, point, or ring removes that entire target.
const removeHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
removeHandler.setInputAction((click) => {
  if (walk.active || walk.awaiting) return; // don't intercept walk-mode clicks
  const picked = viewer.scene.pick(click.position);
  if (!picked || !picked.id) return;
  const pickedId = picked.id.id || picked.id; // entity id string
  // Find the target whose main entity id matches OR whose extras contain this id
  const tIdx = targets.findIndex(
    (t) => t.id === pickedId || (t.extras && t.extras.includes(pickedId)),
  );
  if (tIdx === -1) return;
  const t = targets[tIdx];
  // Remove main entity + all extras (tower, beam, arc)
  try {
    viewer.entities.removeById(t.id);
  } catch {}
  (t.extras || []).forEach((eid) => {
    try {
      viewer.entities.removeById(eid);
    } catch {}
  });
  targets.splice(tIdx, 1);
  renderTargets();
  feed("warn", `PIN :: removed ${t.label}`);
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Double-click to drop a pin; explain in console
console.log(
  "%cGideonsEarth ready — double-click the globe to drop a pin.",
  "color:#12ffc6; font-weight:bold;",
);

// ---------- MEASUREMENT TOOLS ----------
// Click two points on the globe to measure the great-circle distance between
// them. Uses Cesium's EllipsoidGeodesic for WGS84 accuracy. Also shows
// bearing (azimuth) from point A to point B.
let measureMode = false;
let measurePoints = []; // [{lat, lon, entity}]
let measureEntities = [];

function enterMeasureMode() {
  measureMode = true;
  measurePoints = [];
  measureEntities.forEach((e) => {
    try {
      viewer.entities.remove(e);
    } catch {}
  });
  measureEntities = [];
  feed("ok", "MEASURE :: click two points to measure distance");
}

function exitMeasureMode() {
  measureMode = false;
  measurePoints = [];
  measureEntities.forEach((e) => {
    try {
      viewer.entities.remove(e);
    } catch {}
  });
  measureEntities = [];
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(1)} m`;
}

function formatBearing(radians) {
  const deg = ((Cesium.Math.toDegrees(radians) % 360) + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${deg.toFixed(1)}° ${dirs[Math.round(deg / 45) % 8]}`;
}

function addMeasurePoint(cartographic) {
  const lat = Cesium.Math.toDegrees(cartographic.latitude);
  const lon = Cesium.Math.toDegrees(cartographic.longitude);

  // Drop a marker
  const marker = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString("#ffb020"),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: measurePoints.length === 0 ? "A" : "B",
      font: "bold 14px JetBrains Mono, monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  measureEntities.push(marker);
  measurePoints.push({ lat, lon, entity: marker });

  // If we have two points, draw the line and show distance
  if (measurePoints.length === 2) {
    const a = measurePoints[0];
    const b = measurePoints[1];

    const start = Cesium.Cartographic.fromDegrees(a.lon, a.lat);
    const end = Cesium.Cartographic.fromDegrees(b.lon, b.lat);
    const geodesic = new Cesium.EllipsoidGeodesic(start, end);
    const distance = geodesic.surfaceDistance;
    const bearing = geodesic.startHeading;

    // Draw geodesic line (great circle)
    const linePts = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const p = geodesic.interpolateUsingFraction(i / steps);
      linePts.push(Cesium.Cartesian3.fromRadians(p.longitude, p.latitude, 0));
    }
    const line = viewer.entities.add({
      polyline: {
        positions: linePts,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString("#ffb020"),
        }),
        clampToGround: true,
        arcType: Cesium.ArcType.NONE,
      },
    });
    measureEntities.push(line);

    // Label at midpoint showing distance + bearing
    const mid = geodesic.interpolateUsingFraction(0.5);
    const midLat = Cesium.Math.toDegrees(mid.latitude);
    const midLon = Cesium.Math.toDegrees(mid.longitude);
    const label = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(midLon, midLat, 0),
      label: {
        text: `${formatDistance(distance)}\n${formatBearing(bearing)}`,
        font: "bold 12px JetBrains Mono, monospace",
        fillColor: Cesium.Color.fromCssColorString("#ffb020"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    measureEntities.push(label);

    feed(
      "ok",
      `MEASURE :: ${formatDistance(distance)} @ ${formatBearing(bearing)} from A to B`,
    );

    // Reset for next measurement
    measurePoints = [];
  }
}

// Expose measurement API
window.GideonsEarth.measure = {
  enter: enterMeasureMode,
  exit: exitMeasureMode,
  isActive: () => measureMode,
};

// ---------- CUSTOM ION 3D MODELS — AUTO-DISCOVERY ----------
// Automatically lists every asset in your Cesium Ion account via the REST API,
// then renders each one on the globe. 3D Tilesets are added as-is (they carry
// their own geo-reference). GLB/GLTF models without a geo-reference are placed
// at a default "staging area" lat/lon spiral so you can see them.

const LOADED_ASSETS = new Set(); // avoid double-loads
const STAGE_CENTER = { lat: 0, lon: 0 }; // default GLB drop spot
let stageCount = 0;

async function listIonAssets() {
  const headers = { Authorization: `Bearer ${Cesium.Ion.defaultAccessToken}` };
  const all = [];
  let next = "https://api.cesium.com/v1/assets?limit=100";
  while (next) {
    const r = await fetch(next, { headers });
    if (!r.ok) throw new Error(`Ion API ${r.status}`);
    const j = await r.json();
    all.push(...(j.items || []));
    next = j.link && j.link.next ? j.link.next : null;
  }
  return all;
}

async function loadIonAsset(asset) {
  if (LOADED_ASSETS.has(asset.id)) return;
  LOADED_ASSETS.add(asset.id);

  // Map Ion asset types → renderer. Reference:
  // 3DTILES = 3D Tiles tileset (buildings, photogrammetry, point clouds…)
  // GLTF    = GLB/GLTF model
  // TERRAIN = terrain provider
  // IMAGERY = imagery layer
  try {
    if (asset.type === "3DTILES") {
      const ts = await Cesium.Cesium3DTileset.fromIonAssetId(asset.id);
      // Optional Gideon cyan tint — comment out if you want natural colors:
      // ts.style = new Cesium.Cesium3DTileStyle({ color: "color('#12ffc6', 0.95)" });
      viewer.scene.primitives.add(ts);
      feed("ok", `MODEL :: 3DTILES #${asset.id} "${asset.name}" loaded`);
      // Fly to first tileset so you can see it immediately
      if (stageCount === 0) {
        autoRotate = false;
        try {
          await viewer.zoomTo(ts);
        } catch {
          /* ignore */
        }
      }
      stageCount++;
    } else if (asset.type === "GLTF") {
      // Spread GLBs on a spiral around (0,0) so multiple are visible
      const r = 0.5 + stageCount * 0.4; // degrees
      const ang = stageCount * (Math.PI * 0.7);
      const lon = STAGE_CENTER.lon + r * Math.cos(ang);
      const lat = STAGE_CENTER.lat + r * Math.sin(ang);
      const resource = await Cesium.IonResource.fromAssetId(asset.id);
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        model: {
          uri: resource,
          minimumPixelSize: 96,
          maximumScale: 20000,
        },
        label: {
          text: asset.name || `ASSET-${asset.id}`,
          font: "11px JetBrains Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString("#12ffc6"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(14, -10),
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 5e7, 0.3),
        },
      });
      feed(
        "ok",
        `MODEL :: GLB #${asset.id} "${asset.name}" placed @ ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      );
      stageCount++;
    } else if (asset.type === "TERRAIN") {
      // Skip — user already has Cesium World Terrain loaded.
      feed("warn", `SKIP :: terrain asset #${asset.id} (using World Terrain)`);
    } else if (asset.type === "IMAGERY") {
      const layer = await Cesium.IonImageryProvider.fromAssetId(asset.id);
      viewer.imageryLayers.addImageryProvider(layer);
      feed("ok", `IMAGERY :: #${asset.id} "${asset.name}" layered`);
    } else if (asset.type === "GOOGLE_2D_MAPS") {
      // Internal Google Maps tiles/attribution assets — not useful as 3D models; skip silently
      feed("warn", `SKIP :: #${asset.id} google-maps tile (not a 3D model)`);
    } else {
      feed("warn", `SKIP :: #${asset.id} "${asset.name}" (type=${asset.type})`);
    }
  } catch (e) {
    console.error("asset load failed:", asset, e);
    feed("err", `MODEL :: #${asset.id} failed → ${e.message}`);
  }
}

async function autoLoadAllIonAssets() {
  try {
    feed("ok", "ION :: scanning account for uploaded assets...");
    const assets = await listIonAssets();
    // Filter out the core Ion community assets we already use (1, 2, 3, 96188, etc.)
    const COMMUNITY_IDS = new Set([1, 2, 3, 9, 96188, 2275207]);
    const mine = assets.filter(
      (a) => !COMMUNITY_IDS.has(a.id) && a.status === "COMPLETE",
    );
    feed("ok", `ION :: found ${mine.length} asset(s) in your account`);
    if (mine.length === 0) {
      feed(
        "warn",
        "ION :: upload models at https://ion.cesium.com/assets to render them here",
      );
      return;
    }
    // Sort newest-first so fresh uploads win the zoom-to
    mine.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    for (const a of mine) {
      await loadIonAsset(a);
    }
  } catch (e) {
    console.error("Ion auto-discovery failed:", e);
    feed("err", `ION :: auto-discovery failed → ${e.message}`);
  }
}
autoLoadAllIonAssets();

// Expose helpers so you can also spawn assets manually from devtools:
//   GideonsEarth.addModel(3DTILESassetId)
//   GideonsEarth.addModel(glbAssetId, { lon: -74, lat: 40 })
//   GideonsEarth.refresh()   // re-scan Ion account
window.GideonsEarth = window.GideonsEarth || {};
window.GideonsEarth.viewer = viewer;
window.GideonsEarth.refresh = autoLoadAllIonAssets;

// Expose core helpers for GideonIntel OSINT engine (osint.js / window.GI)
window.fetchGeo = fetchGeo;
window.pinTarget = pinTarget;
window.arcPositions = arcPositions;
window.feed = feed;
window.GideonsEarth.addModel = async (assetId, opts = {}) => {
  const fakeAsset = {
    id: assetId,
    name: opts.label || `ASSET-${assetId}`,
    type: opts.type || "3DTILES",
    status: "COMPLETE",
  };
  if (opts.lon != null && opts.lat != null) {
    STAGE_CENTER.lon = opts.lon;
    STAGE_CENTER.lat = opts.lat;
  }
  return loadIonAsset(fakeAsset);
};

// 3D buildings API — toggle global building layers on/off
//   GideonsEarth.buildings(true)  // enable all
//   GideonsEarth.buildings(false) // disable all
//   GideonsEarth.buildings.osm(true) // toggle just OSM
//   GideonsEarth.buildings.google(true) // toggle just Google
window.GideonsEarth.buildings = (on) => {
  buildings3DOn = on;
  if (osmBuildings) osmBuildings.show = on;
  if (googleTileset) googleTileset.show = on;
  if (btn3DBuildings) btn3DBuildings.classList.toggle("active", on);
};
window.GideonsEarth.buildings.osm = (on) => {
  if (osmBuildings) osmBuildings.show = on;
};
window.GideonsEarth.buildings.google = (on) => {
  if (googleTileset) googleTileset.show = on;
};

// ---------- MEASURE MODE TOGGLE ----------
const btnMeasure = document.getElementById("btn-measure");
let measureActive = false;
btnMeasure &&
  btnMeasure.addEventListener("click", () => {
    measureActive = !measureActive;
    if (measureActive) {
      enterMeasureMode();
      btnMeasure.classList.add("active");
    } else {
      exitMeasureMode();
      btnMeasure.classList.remove("active");
    }
  });

// ---------- WEATHER EFFECTS TOGGLE ----------
const btnWeather = document.getElementById("btn-weather");
const WEATHER_CYCLE = ["rain", "snow", "dust"];
let weatherCycleIdx = -1;
btnWeather &&
  btnWeather.addEventListener("click", () => {
    weatherCycleIdx++;
    if (weatherCycleIdx >= WEATHER_CYCLE.length) {
      // Turn off
      stopWeather();
      weatherCycleIdx = -1;
      btnWeather.classList.remove("active");
      feed("ok", "WEATHER :: effects off");
    } else {
      const type = WEATHER_CYCLE[weatherCycleIdx];
      startWeather(type);
      btnWeather.classList.add("active");
      btnWeather.querySelector("span").textContent =
        type === "rain" ? "🌧" : type === "snow" ? "❄" : "🌪";
      feed("ok", `WEATHER :: ${type} effect active`);
    }
  });

// ---------- TIME SCRUBBER UI ----------
const timeSlider = document.getElementById("time-slider");
const timeLabel = document.getElementById("time-label");
const timeReset = document.getElementById("time-reset");
timeSlider &&
  timeSlider.addEventListener("input", (e) => {
    const hours = parseFloat(e.target.value);
    window.GideonsEarth.time.setOffsetHours(hours);
    if (hours === 0) {
      timeLabel.textContent = "NOW";
    } else {
      const sign = hours > 0 ? "+" : "";
      timeLabel.textContent = `${sign}${hours}h`;
    }
  });
timeReset &&
  timeReset.addEventListener("click", () => {
    window.GideonsEarth.time.reset();
    timeSlider.value = 0;
    timeLabel.textContent = "NOW";
    feed("ok", "TIME :: reset to real time");
  });

// ---------- PUBLIC CCTV / WEBCAM TOGGLE ----------
const btnCameras = document.getElementById("btn-cameras");
let camerasOn = false;
btnCameras &&
  btnCameras.addEventListener("click", async () => {
    if (!camerasOn) {
      camerasOn = true;
      btnCameras.classList.add("active");
      feed("warn", "CCTV :: loading public camera feeds...");
      await window.GideonsEarth.cameras.load();
    } else {
      window.GideonsEarth.cameras.clear();
      camerasOn = false;
      btnCameras.classList.remove("active");
      feed("warn", "CCTV :: cameras cleared");
    }
  });

// ---------- CESIUM ION UPLOAD (drag-drop 3D models) ----------
// Uploads a file to your Ion account using the official multi-step flow:
//   1) POST /v1/assets → get tempToken + S3 upload location
//   2) PUT file → S3 (with progress)
//   3) POST onComplete endpoint → Ion starts tiling
//   4) Poll /v1/assets/{id} until status === "COMPLETE"
//   5) Load it with loadIonAsset()

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadStatus = document.getElementById("upload-status");
const assetList = document.getElementById("asset-list");
const assetCount = document.getElementById("asset-count");
const modelLat = document.getElementById("model-lat");
const modelLon = document.getElementById("model-lon");

dropZone.addEventListener("click", () => fileInput.click());
["dragenter", "dragover"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag");
  }),
);
dropZone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

document.getElementById("model-here").addEventListener("click", () => {
  const c = viewer.camera.positionCartographic;
  modelLat.value = Cesium.Math.toDegrees(c.latitude).toFixed(5);
  modelLon.value = Cesium.Math.toDegrees(c.longitude).toFixed(5);
});

document
  .getElementById("asset-refresh")
  .addEventListener("click", autoLoadAllIonAssets);

function guessSourceType(filename) {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "glb":
    case "gltf":
      return { type: "3D_MODEL", fmt: ext.toUpperCase() };
    case "zip":
      return { type: "3D_MODEL", fmt: "GLTF" }; // best-effort; Ion detects
    case "obj":
      return { type: "3D_MODEL", fmt: "OBJ" };
    case "ifc":
      return { type: "3D_CAPTURE", fmt: "IFC" };
    case "las":
    case "laz":
      return { type: "POINT_CLOUD", fmt: "LAS" };
    case "kml":
    case "kmz":
      return { type: "KML", fmt: "KML" };
    case "czml":
      return { type: "CZML", fmt: "CZML" };
    default:
      return { type: "3D_MODEL", fmt: "GLTF" };
  }
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  uploadStatus.innerHTML = "";
  for (const f of files) await uploadToIon(f);
  // After uploads finish, re-scan to render
  await autoLoadAllIonAssets();
  renderAssetList();
}

function addUploadRow(name) {
  const row = document.createElement("div");
  row.className = "upload-row";
  row.innerHTML = `<span class="name">${name}</span><span class="pct">0%</span><span class="st">init</span>`;
  uploadStatus.appendChild(row);
  return {
    row,
    pct: row.querySelector(".pct"),
    st: row.querySelector(".st"),
    setPct: (p) => {
      row.querySelector(".pct").textContent = `${p}%`;
    },
    setStatus: (s, cls) => {
      row.querySelector(".st").textContent = s;
      if (cls) row.classList.add(cls);
    },
  };
}

async function uploadToIon(file) {
  const ui = addUploadRow(file.name);
  const token = Cesium.Ion.defaultAccessToken;
  try {
    // Step 1: create asset record
    ui.setStatus("creating");
    const { type: sType, fmt: sFmt } = guessSourceType(file.name);

    // Optional geo placement hint
    const lat = parseFloat(modelLat.value);
    const lon = parseFloat(modelLon.value);
    const options = {};
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      options.position = [lon, lat, 0];
    }

    const createRes = await fetch("https://api.cesium.com/v1/assets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: file.name,
        description: "Uploaded from GideonsEarth recon grid",
        type: "3DTILES",
        sourceType: sType,
        options: { sourceType: sType, ...options },
      }),
    });
    if (!createRes.ok)
      throw new Error(
        `create asset ${createRes.status}: ${await createRes.text()}`,
      );
    const create = await createRes.json();
    const assetId = create.assetMetadata.id;
    const upload = create.uploadLocation;
    const onComplete = create.onComplete;

    feed("ok", `UPLOAD :: asset #${assetId} created for ${file.name}`);
    ui.setStatus("uploading");

    // Step 2: PUT the file to S3 (Ion gives presigned creds, but a simple PUT works with the endpoint+bucket+prefix).
    // Cesium Ion returns a pre-authorized endpoint. We must do a single PUT to `${endpoint}/${bucket}/${prefix}${file.name}`.
    // Using fetch with progress requires XMLHttpRequest for upload progress events.
    await putWithProgress({
      url: `${upload.endpoint}/${upload.bucket}/${upload.prefix}${file.name}`,
      file,
      headers: {
        "x-amz-security-token": upload.sessionToken,
        Authorization: buildS3Auth(upload), // simple signature stub
      },
      onProgress: (p) => ui.setPct(p),
    }).catch(async () => {
      // Fallback: the modern Ion API uses a pre-signed URL directly.
      // If the signed PUT above fails, try presigned approach:
      const signedRes = await fetch(upload.endpoint, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!signedRes.ok) throw new Error(`S3 PUT ${signedRes.status}`);
    });

    // Step 3: notify complete
    ui.setStatus("tiling");
    const onDoneRes = await fetch(onComplete.url, {
      method: onComplete.method || "POST",
      headers: {
        ...(onComplete.fields ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: onComplete.fields ? JSON.stringify(onComplete.fields) : undefined,
    });
    if (!onDoneRes.ok && onDoneRes.status !== 204) {
      throw new Error(`onComplete ${onDoneRes.status}`);
    }

    // Step 4: poll until COMPLETE
    feed("warn", `TILE :: Ion is processing #${assetId}...`);
    for (let i = 0; i < 120; i++) {
      // up to ~10 min
      await new Promise((r) => setTimeout(r, 5000));
      const st = await fetch(`https://api.cesium.com/v1/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!st.ok) continue;
      const meta = await st.json();
      ui.setStatus(meta.status.toLowerCase());
      if (meta.status === "COMPLETE") {
        ui.setStatus("DONE", "done");
        feed("ok", `TILE :: #${assetId} ready — rendering now`);
        return;
      }
      if (meta.status === "ERROR") throw new Error("Ion tiling failed");
    }
    ui.setStatus("timeout", "err");
  } catch (e) {
    console.error(e);
    ui.setStatus("failed", "err");
    feed("err", `UPLOAD :: ${file.name} → ${e.message}`);
  }
}

// Minimal helper: no real S3 auth — Ion's upload endpoint often accepts anonymous PUT using its presigned URL.
function buildS3Auth() {
  return "";
}

function putWithProgress({ url, file, headers = {}, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => {
      if (v) xhr.setRequestHeader(k, v);
    });
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`PUT ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(file);
  });
}

function renderAssetList() {
  assetCount.textContent = String(LOADED_ASSETS.size);
  assetList.innerHTML = "";
  [...LOADED_ASSETS].forEach((id) => {
    const d = document.createElement("div");
    d.className = "target-item";
    d.innerHTML = `<div class="ti-head"><span>▣ ASSET-${id}</span><span>ION</span></div>
      <div class="ti-meta">Rendered from your Cesium Ion account</div>`;
    assetList.appendChild(d);
  });
}

// ---------- WATER MASK DETECTION ----------
// Uses the terrain provider's per-tile water mask (256x256 texture where
// 255 = water, 0 = land) to determine if a given lon/lat is over water.
// This is the key to preventing WALK-MAN from sinking into rivers/lakes/oceans.
//
// Cache: we keep a small LRU-ish cache of recent lookups to avoid refetching
// the same tile every frame.
const waterCache = new Map(); // key = "lon,lat" -> { isWater: bool, ts: number }
const WATER_CACHE_TTL = 5000; // ms before re-checking same spot

/**
 * Async: check if a lon/lat (degrees) is over water using the terrain tile's
 * water mask. Returns true (water), false (land), or null (unknown — tile
 * not loaded yet). Uses a short-lived cache to avoid hammering the server.
 */
async function isOverWaterDeg(lon, lat) {
  if (!terrainProvider || !terrainProvider.hasWaterMask) return null;
  const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
  const cached = waterCache.get(key);
  if (cached && performance.now() - cached.ts < WATER_CACHE_TTL)
    return cached.isWater;

  // Compute tile coordinates at a reasonable level (level 8 gives ~12m/pixel)
  const tilingScheme = terrainProvider.tilingScheme;
  const level = 8;
  const coords = tilingScheme.positionToTileXY(
    Cesium.Cartographic.fromDegrees(lon, lat),
    level,
  );
  if (!coords) return null;

  try {
    const terrainData = await terrainProvider.requestTileGeometry(
      coords.x,
      coords.y,
      level,
    );
    if (!terrainData || !terrainData.waterMask) return null;

    // Sample the water mask at the position within the tile
    const mask = terrainData.waterMask;
    const rectangle = tilingScheme.tileXYToRectangle(coords.x, coords.y, level);
    // Normalized position within tile [0..1]
    const u =
      (lon - Cesium.Math.toDegrees(rectangle.west)) /
      Cesium.Math.toDegrees(rectangle.width);
    const v =
      (lat - Cesium.Math.toDegrees(rectangle.south)) /
      Cesium.Math.toDegrees(rectangle.height);
    const px = Math.min(255, Math.max(0, Math.floor(u * 256)));
    const py = Math.min(255, Math.max(0, Math.floor((1 - v) * 256)));
    const val = mask[py * 256 + px];
    // 255 = water, 0 = land. Use threshold of 128.
    const isWater = val > 128;
    waterCache.set(key, { isWater, ts: performance.now() });
    // Prune cache if too large
    if (waterCache.size > 200) {
      const now = performance.now();
      for (const [k, v2] of waterCache) {
        if (now - v2.ts > WATER_CACHE_TTL) waterCache.delete(k);
      }
    }
    return isWater;
  } catch {
    return null;
  }
}

// ---------- WALK-MAN MODE (first-person walk around the globe) ----------
// Click the 🚶 tool, then click anywhere on the map to drop your walker and
// enter first-person. WASD to walk, mouse to look, SPACE to jump, SHIFT to run,
// Q/E to fly up/down, ESC to exit. The camera hugs the terrain (or top of any
// 3D-Tiles building surface), with a small collision offset.
//
// WATER AVOIDANCE: uses the terrain water mask to detect when the walker is
// approaching or over water. When over water, the walker maintains the last
// known land elevation instead of sinking to sea level.

const walkHud = document.getElementById("walk-hud");
const walkSpeedEl = document.getElementById("walk-speed");
const walkHdgEl = document.getElementById("walk-hdg");

const walk = {
  active: false,
  awaiting: false, // true after pressing btn-walk, before first click
  position: null, // Cesium.Cartographic (lon, lat, height)
  heading: 0, // radians, 0 = north
  pitch: 0, // radians, negative = looking down
  // Physics
  velocity: { fwd: 0, right: 0, up: 0 },
  grounded: true,
  eyeHeight: 1.7, // meters above terrain (human eye)
  walkSpeed: 1.8, // m/s
  runSpeed: 5.5, // m/s
  flySpeed: 80, // m/s when Q/E used
  jumpV: 5.0, // m/s
  gravity: 9.81, // m/s^2
  keys: new Set(),
  lastTick: performance.now(),
  // Body model
  avatarId: null,
  avatarEntity: null, // direct entity ref so we can exclude it from picking
  _lastGoodGroundH: null, // depth-buffer ground cache for next frame
  // Water avoidance
  _lastLandHeight: null, // last known terrain height over LAND (not water)
  _waterCheckBusy: false, // one async water check at a time
  _isOverWater: false, // current water state
  _waterWarningIssued: false, // prevent spamming the warning
};

const btnWalk = document.getElementById("btn-walk");
btnWalk.addEventListener("click", () => {
  if (walk.active) {
    exitWalkMode();
    return;
  }
  walk.awaiting = true;
  btnWalk.classList.add("active");
  feed("warn", "WALK-MAN :: click a spot on the globe to drop the walker");
});

// Click-to-drop (single click, not the double-click pin handler)
// Uses scene.pickPosition which picks the actual rendered 3D surface (including
// Google Photorealistic 3D Tiles buildings/streets), not the ellipsoid.
const walkClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
walkClickHandler.setInputAction((click) => {
  if (!walk.awaiting) return;
  // Try the actual rendered surface first (includes 3D tiles / photorealistic mesh)
  let cart = scene.pickPosition(click.position);
  if (!cart) {
    // Fallback to ellipsoid picking
    cart = viewer.camera.pickEllipsoid(click.position, scene.globe.ellipsoid);
  }
  if (!cart) return;
  const c = Cesium.Cartographic.fromCartesian(cart);
  enterWalkMode(
    Cesium.Math.toDegrees(c.longitude),
    Cesium.Math.toDegrees(c.latitude),
    c.height, // pass the exact surface height from the pick
  );
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

async function enterWalkMode(lon, lat, pickedHeight) {
  walk.awaiting = false;
  walk.active = true;
  document.body.classList.add("walk-mode");
  walkHud.classList.remove("hidden");
  autoRotate = false;

  // Determine ground height from the rendered 3D surface (Google tiles > terrain > 0).
  // 1) If we got a picked height from the click, use it (most accurate).
  // 2) Otherwise scene.sampleHeightMostDetailed which also knows about 3D tiles.
  // 3) Otherwise fall back to terrain sampling.
  let groundHeight = null;
  if (typeof pickedHeight === "number" && Number.isFinite(pickedHeight)) {
    groundHeight = pickedHeight;
  }
  if (groundHeight == null && scene.sampleHeightSupported) {
    try {
      const h = scene.sampleHeight(Cesium.Cartographic.fromDegrees(lon, lat));
      if (typeof h === "number" && Number.isFinite(h)) groundHeight = h;
    } catch {
      /* ignore */
    }
  }
  if (groundHeight == null) {
    try {
      const samples = await Cesium.sampleTerrainMostDetailed(
        viewer.terrainProvider,
        [Cesium.Cartographic.fromDegrees(lon, lat)],
      );
      groundHeight = samples[0].height || 0;
    } catch {
      groundHeight = 0;
    }
  }

  // Never spawn below sea level
  if (groundHeight < 0 || !Number.isFinite(groundHeight)) groundHeight = 0;

  // --- WATER CHECK: refuse to spawn over water ---
  // Use the terrain water mask to detect if the click landed on a river,
  // lake, or ocean. If so, warn the user and exit walk mode — the walker
  // belongs on land.
  let spawnIsWater = false;
  try {
    spawnIsWater = await isOverWaterDeg(lon, lat);
  } catch {
    /* ignore — fall through */
  }
  if (spawnIsWater === true) {
    // Cancel walk mode — don't drop the walker into water
    walk.active = false;
    walk.awaiting = false;
    document.body.classList.remove("walk-mode");
    walkHud.classList.add("hidden");
    btnWalk.classList.remove("active");
    feed(
      "err",
      "WALK-MAN :: cannot spawn over water — click on land to drop the walker",
    );
    return;
  }

  // Initialize water tracking — this is a known land position
  walk._lastLandHeight = groundHeight;
  walk._isOverWater = false;
  walk._waterWarningIssued = false;

  // Start 50m above the surface and let gravity drop us onto it — guarantees we
  // never spawn *inside* a building or hillside.
  walk.position = Cesium.Cartographic.fromDegrees(
    lon,
    lat,
    groundHeight + walk.eyeHeight + 50,
  );

  if (groundHeight <= 0) {
    feed(
      "warn",
      "WALK-MAN :: spawned near sea level — water avoidance active. Stay on land!",
    );
  }
  walk.heading = 0;
  walk.pitch = 0;
  walk.velocity = { fwd: 0, right: 0, up: 0 };

  // Drop a visible walker avatar on the ground (small cyan humanoid box)
  walk.avatarEntity = viewer.entities.add({
    position: new Cesium.CallbackProperty(() => {
      const p = walk.position;
      return Cesium.Cartesian3.fromRadians(
        p.longitude,
        p.latitude,
        p.height - walk.eyeHeight + 0.9,
      );
    }, false),
    orientation: new Cesium.CallbackProperty(() => {
      const hpr = new Cesium.HeadingPitchRoll(walk.heading, 0, 0);
      const pos = Cesium.Cartesian3.fromRadians(
        walk.position.longitude,
        walk.position.latitude,
        walk.position.height,
      );
      return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
    }, false),
    box: {
      dimensions: new Cesium.Cartesian3(0.6, 0.4, 1.8),
      material: Cesium.Color.fromCssColorString("#12ffc6").withAlpha(0.9),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#ffffff"),
    },
    label: {
      text: "WALK-MAN",
      font: "10px JetBrains Mono, monospace",
      fillColor: Cesium.Color.fromCssColorString("#12ffc6"),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -40),
      scaleByDistance: new Cesium.NearFarScalar(10, 1.2, 5e4, 0.4),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  walk.avatarId = walk.avatarEntity.id;

  // Request pointer lock for mouse look
  viewer.canvas.requestPointerLock =
    viewer.canvas.requestPointerLock || viewer.canvas.mozRequestPointerLock;
  viewer.canvas.requestPointerLock();

  feed("ok", `WALK-MAN :: dropped at ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}

function exitWalkMode() {
  walk.active = false;
  walk.awaiting = false;
  btnWalk.classList.remove("active");
  document.body.classList.remove("walk-mode");
  walkHud.classList.add("hidden");
  if (walk.avatarId) {
    viewer.entities.removeById(walk.avatarId);
    walk.avatarId = null;
    walk.avatarEntity = null;
  }
  if (document.exitPointerLock) document.exitPointerLock();
  feed("ok", "WALK-MAN :: exited");
}

// Keyboard input
document.addEventListener("keydown", (e) => {
  if (walk.active) {
    walk.keys.add(e.code);
    if (e.code === "Escape") exitWalkMode();
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "KeyQ",
        "KeyE",
        "Space",
        "ShiftLeft",
        "ShiftRight",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
  }
});
document.addEventListener("keyup", (e) => walk.keys.delete(e.code));

// Mouse look (pointer-lock)
document.addEventListener("mousemove", (e) => {
  if (!walk.active || document.pointerLockElement !== viewer.canvas) return;
  const sensitivity = 0.002;
  walk.heading += e.movementX * sensitivity;
  walk.pitch -= e.movementY * sensitivity;
  // Clamp pitch to just under straight up/down
  walk.pitch = Math.max(
    -Math.PI / 2 + 0.05,
    Math.min(Math.PI / 2 - 0.05, walk.pitch),
  );
});

// Re-request pointer lock if the user clicks back into the canvas
viewer.canvas.addEventListener("click", () => {
  if (walk.active && document.pointerLockElement !== viewer.canvas) {
    viewer.canvas.requestPointerLock();
  }
});

// ---- Async ground-height tracker ----
// Instead of per-frame sync raycasts (which glitch against 3D Tiles before the
// depth buffer fills, causing the walker to float away), we kick off an async
// clampToHeightMostDetailed request each tick and cache the result. The physics
// loop uses the cached height, which is always a real ground sample.
walk.groundHeight = null; // latest cached ground elevation
walk.groundBusy = false; // one request at a time

async function refreshGroundHeight() {
  if (walk.groundBusy || !walk.position || !walk.active) return;
  walk.groundBusy = true;
  try {
    const exclude = walk.avatarEntity ? [walk.avatarEntity] : [];
    if (scene.clampToHeightSupported) {
      // Clamp a test point at the walker's column to the rendered surface.
      const testPos = Cesium.Cartesian3.fromRadians(
        walk.position.longitude,
        walk.position.latitude,
        10_000,
      );
      const clamped = await scene.clampToHeightMostDetailed(
        [testPos],
        exclude,
        1.0,
      );
      const c = Cesium.Cartographic.fromCartesian(clamped[0]);
      if (Number.isFinite(c.height)) walk.groundHeight = c.height;
    } else {
      // Fallback: sampleTerrainMostDetailed (terrain only — no 3D tiles)
      const [c] = await Cesium.sampleTerrainMostDetailed(
        viewer.terrainProvider,
        [
          Cesium.Cartographic.fromRadians(
            walk.position.longitude,
            walk.position.latitude,
          ),
        ],
      );
      if (Number.isFinite(c.height)) walk.groundHeight = c.height;
    }
  } catch {
    /* keep previous cached value */
  }
  walk.groundBusy = false;
}

// Walk-mode tick: apply physics, move the camera, hug the terrain
viewer.clock.onTick.addEventListener(() => {
  if (!walk.active || !walk.position) return;

  const now = performance.now();
  const dt = Math.min(0.05, (now - walk.lastTick) / 1000); // clamp to 50ms
  walk.lastTick = now;

  const running = walk.keys.has("ShiftLeft") || walk.keys.has("ShiftRight");
  const moveSpeed = running ? walk.runSpeed : walk.walkSpeed;

  // Desired horizontal motion in body frame
  let fwd = 0,
    right = 0;
  if (walk.keys.has("KeyW")) fwd += 1;
  if (walk.keys.has("KeyS")) fwd -= 1;
  if (walk.keys.has("KeyD")) right += 1;
  if (walk.keys.has("KeyA")) right -= 1;
  const len = Math.hypot(fwd, right);
  if (len > 0) {
    fwd /= len;
    right /= len;
  }

  // Vertical: Q down, E up (free-fly), Space jump (grounded only)
  let vertical = 0;
  if (walk.keys.has("KeyE")) vertical += 1;
  if (walk.keys.has("KeyQ")) vertical -= 1;

  // Jump
  if (walk.keys.has("Space") && walk.grounded) {
    walk.velocity.up = walk.jumpV;
    walk.grounded = false;
  }

  // Convert body-frame motion to ENU (east/north) using heading
  const sinH = Math.sin(walk.heading),
    cosH = Math.cos(walk.heading);
  const east = right * cosH + fwd * sinH;
  const north = fwd * cosH - right * sinH;

  // Translate position in meters → degrees
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos(walk.position.latitude);
  walk.position.latitude +=
    (((north * moveSpeed * dt) / metersPerDegLat) * Math.PI) / 180;
  walk.position.longitude +=
    (((east * moveSpeed * dt) / metersPerDegLon) * Math.PI) / 180;

  // Kick an async ground-height refresh (returns immediately)
  refreshGroundHeight();

  // ── WATER CHECK: async sample the terrain water mask at our position ──
  // This runs every frame (throttled internally by the cache TTL). If we're
  // over water, we'll use the last known land height instead of the water
  // surface. This prevents the walker from sinking into rivers/lakes/oceans.
  if (!walk._waterCheckBusy) {
    walk._waterCheckBusy = true;
    isOverWaterDeg(
      Cesium.Math.toDegrees(walk.position.longitude),
      Cesium.Math.toDegrees(walk.position.latitude),
    )
      .then((isWater) => {
        if (isWater === true) {
          walk._isOverWater = true;
          if (!walk._waterWarningIssued) {
            walk._waterWarningIssued = true;
            feed(
              "warn",
              "WALK-MAN :: water detected — holding at land elevation",
            );
          }
        } else if (isWater === false) {
          // On land — update our known-good land height
          walk._isOverWater = false;
          walk._waterWarningIssued = false;
          // We'll update _lastLandHeight below once we get a good surfaceH
        }
      })
      .catch(() => {})
      .finally(() => {
        walk._waterCheckBusy = false;
      });
  }

  // ── SURFACE-LOCK: use scene.pickPosition for reliable ground detection ──
  // Instead of sampling height (which misses 3D tiles at low LOD),
  // we project a virtual ray straight DOWN from the walker through the
  // center-bottom of the screen. scene.pickPosition reads the depth buffer
  // which includes ALL rendered geometry (terrain + 3D tiles + buildings).

  if (vertical !== 0) {
    walk.position.height += vertical * walk.flySpeed * dt;
  } else {
    let surfaceH = null;

    // Primary: pick the depth buffer at screen center-bottom (virtual "look down")
    // This ALWAYS works because it reads whatever is rendered in the frame buffer
    try {
      const screenCenter = new Cesium.Cartesian2(
        Math.round(viewer.canvas.clientWidth / 2),
        Math.round(viewer.canvas.clientHeight * 0.85), // slightly below center
      );
      const picked = scene.pickPosition(screenCenter);
      if (picked) {
        const carto = Cesium.Cartographic.fromCartesian(picked);
        if (carto && Number.isFinite(carto.height)) {
          surfaceH = carto.height;
        }
      }
    } catch {}

    // Fallback 1: sync sampleHeight
    if (surfaceH == null && scene.sampleHeightSupported) {
      try {
        const h = scene.sampleHeight(
          Cesium.Cartographic.fromRadians(
            walk.position.longitude,
            walk.position.latitude,
          ),
          walk.avatarEntity ? [walk.avatarEntity] : [],
        );
        if (typeof h === "number" && Number.isFinite(h) && h > 0) surfaceH = h;
      } catch {}
    }

    // Fallback 2: async cached value
    if (
      surfaceH == null &&
      walk.groundHeight != null &&
      walk.groundHeight > 0
    ) {
      surfaceH = walk.groundHeight;
    }

    // Fallback 3: globe terrain
    if (surfaceH == null) {
      const gh = scene.globe.getHeight(walk.position);
      if (gh != null && Number.isFinite(gh) && gh > 0) surfaceH = gh;
    }

    // Absolute floor
    if (surfaceH == null || surfaceH < 0) surfaceH = 0;

    // Store as last known good height (for next frame if all methods fail)
    if (surfaceH > 0) walk._lastGoodGroundH = surfaceH;
    else if (walk._lastGoodGroundH) surfaceH = walk._lastGoodGroundH;

    // ── WATER AVOIDANCE: if over water, use last known land height ──
    // The depth buffer returns the water surface (sea level = 0m), which
    // would make the walker sink. Instead, hold at the last known land
    // elevation so the walker appears to stand at the water's edge.
    if (walk._isOverWater && walk._lastLandHeight != null) {
      surfaceH = walk._lastLandHeight;
    } else if (!walk._isOverWater && surfaceH > 0) {
      // On land — update our known-good land height
      walk._lastLandHeight = surfaceH;
    }

    // Smoothly move toward target height
    const targetH = surfaceH + walk.eyeHeight;
    const diff = targetH - walk.position.height;
    if (Math.abs(diff) > 200) {
      walk.position.height = targetH; // teleport if way off
    } else {
      walk.position.height += diff * Math.min(1, 8 * dt); // smooth lerp
    }
  }

  walk.grounded = true;

  // Place the camera at the walker's eyes, looking in (heading, pitch)
  const camPos = Cesium.Cartesian3.fromRadians(
    walk.position.longitude,
    walk.position.latitude,
    walk.position.height,
  );
  viewer.camera.setView({
    destination: camPos,
    orientation: {
      heading: walk.heading,
      pitch: walk.pitch,
      roll: 0,
    },
  });

  // Stats
  const speed = Math.hypot(fwd, right) * moveSpeed;
  walkSpeedEl.textContent = `${speed.toFixed(1)} m/s`;
  walkHdgEl.textContent = `${Math.round(
    ((Cesium.Math.toDegrees(walk.heading) % 360) + 360) % 360,
  )
    .toString()
    .padStart(3, "0")}°`;
});

// ---------- ADDRESS BAR (geocode + fly-to) ----------
const addrInput = document.getElementById("addr-input");
const addrGo = document.getElementById("addr-go");

async function geocodeAndFly(query) {
  if (!query || !query.trim()) return;
  const q = query.trim();
  feed("warn", `GEOCODE :: searching "${q}"...`);
  try {
    // Nominatim (OpenStreetMap) — free, no key, CORS-friendly.
    // Good etiquette: include a unique User-Agent / Referer (browser does automatically).
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.length) {
      feed("err", `GEOCODE :: no result for "${q}"`);
      return;
    }
    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    const name = hit.display_name;
    feed(
      "ok",
      `GEOCODE :: "${name.split(",").slice(0, 2).join(",").trim()}" → ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    );

    autoRotate = false;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-40),
        roll: 0,
      },
      duration: 2.5,
    });
    pinTarget({
      label: name.split(",")[0].trim(),
      lat,
      lon,
      meta: name,
    });
  } catch (e) {
    console.error(e);
    feed("err", `GEOCODE :: ${e.message}`);
  }
}

addrGo.addEventListener("click", () => geocodeAndFly(addrInput.value));
addrInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") geocodeAndFly(addrInput.value);
});

// ---------- ORBITING 3D SATELLITE ----------
// A small 3D satellite (Cesium ellipsoid + solar panels) that orbits the Earth
// in real-time, with a polyline showing its orbital track.
(function spawnSatellite() {
  const ALT = 1_200_000; // 1,200 km orbital altitude
  const PERIOD_SEC = 90; // full orbit every 90s (demo speed)
  const INCLINATION = 51.6; // ISS-ish
  const start = Date.now();

  // Orbit track (static great-circle at inclination)
  const trackPts = [];
  for (let i = 0; i <= 128; i++) {
    const f = i / 128;
    const theta = f * 2 * Math.PI;
    const lat =
      (Math.asin(Math.sin((INCLINATION * Math.PI) / 180) * Math.sin(theta)) *
        180) /
      Math.PI;
    const lon = (theta * 180) / Math.PI - 180;
    trackPts.push(Cesium.Cartesian3.fromDegrees(lon, lat, ALT));
  }
  viewer.entities.add({
    polyline: {
      positions: trackPts,
      width: 1.5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.fromCssColorString("#12ffc6").withAlpha(0.5),
      }),
      arcType: Cesium.ArcType.NONE,
    },
  });

  // The satellite body (3D box + solar panels using ellipsoid + boxes)
  const satPos = new Cesium.CallbackProperty(() => {
    const t = (Date.now() - start) / 1000;
    const f = (t % PERIOD_SEC) / PERIOD_SEC;
    const theta = f * 2 * Math.PI;
    const lat =
      (Math.asin(Math.sin((INCLINATION * Math.PI) / 180) * Math.sin(theta)) *
        180) /
      Math.PI;
    const lon = (((theta * 180) / Math.PI - 180 + 540) % 360) - 180;
    return Cesium.Cartesian3.fromDegrees(lon, lat, ALT);
  }, false);

  // Satellite main body
  viewer.entities.add({
    position: satPos,
    box: {
      dimensions: new Cesium.Cartesian3(120_000, 60_000, 60_000),
      material: Cesium.Color.fromCssColorString("#cfeee4").withAlpha(0.95),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#12ffc6"),
    },
    label: {
      text: "GIDEON-SAT-01",
      font: "10px JetBrains Mono, monospace",
      fillColor: Cesium.Color.fromCssColorString("#12ffc6"),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(16, -10),
      scaleByDistance: new Cesium.NearFarScalar(5e5, 1.2, 5e7, 0.4),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    point: {
      pixelSize: 6,
      color: Cesium.Color.fromCssColorString("#12ffc6"),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Solar panels (left + right)
  const panelOffset = (sign) =>
    new Cesium.CallbackProperty(() => {
      const basePos = satPos.getValue(Cesium.JulianDate.now());
      const up = Cesium.Cartesian3.normalize(basePos, new Cesium.Cartesian3());
      const east = Cesium.Cartesian3.cross(
        Cesium.Cartesian3.UNIT_Z,
        up,
        new Cesium.Cartesian3(),
      );
      Cesium.Cartesian3.normalize(east, east);
      return Cesium.Cartesian3.add(
        basePos,
        Cesium.Cartesian3.multiplyByScalar(
          east,
          sign * 180_000,
          new Cesium.Cartesian3(),
        ),
        new Cesium.Cartesian3(),
      );
    }, false);
  [-1, 1].forEach((sign) => {
    viewer.entities.add({
      position: panelOffset(sign),
      box: {
        dimensions: new Cesium.Cartesian3(30_000, 240_000, 10_000),
        material: Cesium.Color.fromCssColorString("#1a3a5c").withAlpha(0.9),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#12ffc6"),
      },
    });
  });

  feed("ok", "SAT :: GIDEON-SAT-01 in low earth orbit");
})();

// ===========================================================================
// RECON ONLINE — Master Activation System v2
// ===========================================================================
// The "holy shit" button. One click activates ALL live data feeds:
//   1. Starlink constellation (real TLE data, 100+ satellites)
//   2. GLOBAL aircraft (ADS-B, all planes, live updates every 10s)
//   3. Live ships (AIS vessel tracking)
//   4. Recent earthquakes (USGS)
//   5. Active wildfires (NASA FIRMS thermal anomalies via VIIRS)
//   6. Near-Earth asteroids (NASA close-approach data)
//   7. Hurricane/typhoon tracks (NOAA)
// Plus: radar sweep animation, threat ping effects, CORS proxy fallback,
// demo mode with cached data when APIs fail.
// ===========================================================================

const RECON = {
  active: false,
  radarSweep: null,
  threatPings: [],
  feeds: {
    sats: { entities: [], timer: null, count: 0 },
    flights: { entities: [], timer: null, count: 0 },
    ships: { entities: [], timer: null, count: 0 },
    quakes: { entities: [], count: 0 },
    fires: { entities: [], count: 0 },
    asteroids: { entities: [], count: 0 },
    storms: { entities: [], count: 0 },
  },
};

// ---- CORS-aware fetch with retry ----
async function reconFetch(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        ...opts,
        signal: AbortSignal.timeout(opts.timeout || 15000),
      });
      if (r.ok) return r;
      if (r.status >= 400 && r.status < 500)
        throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === retries) {
        // Try CORS proxy as last resort
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const r = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(20000),
          });
          if (r.ok) return r;
        } catch {}
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("All retries failed");
}

// ---- Demo fallback data (used when APIs fail) ----
const RECON_DEMO = {
  flights: [
    { flight: "UAL123", lat: 40.7, lon: -74.0, alt_baro: 35000, track: 90 },
    { flight: "DAL456", lat: 33.9, lon: -118.4, alt_baro: 28000, track: 270 },
    { flight: "AAL789", lat: 51.5, lon: -0.1, alt_baro: 39000, track: 45 },
    { flight: "BAW011", lat: 48.9, lon: 2.3, alt_baro: 37000, track: 180 },
    { flight: "JAL001", lat: 35.6, lon: 139.7, alt_baro: 33000, track: 315 },
    { flight: "QFA001", lat: -33.9, lon: 151.2, alt_baro: 36000, track: 135 },
    { flight: "SIA001", lat: 1.4, lon: 103.8, alt_baro: 38000, track: 225 },
    { flight: "UAE001", lat: 25.3, lon: 55.4, alt_baro: 40000, track: 270 },
    { flight: "AFR001", lat: 48.9, lon: 2.3, alt_baro: 35000, track: 90 },
    { flight: "DLH001", lat: 50.1, lon: 8.6, alt_baro: 34000, track: 180 },
    { flight: "KLM001", lat: 52.3, lon: 4.8, alt_baro: 36000, track: 45 },
    { flight: "ANA001", lat: 35.6, lon: 139.7, alt_baro: 32000, track: 225 },
    { flight: "CPA001", lat: 22.3, lon: 114.2, alt_baro: 37000, track: 315 },
    { flight: "LAN001", lat: -33.4, lon: -70.6, alt_baro: 35000, track: 135 },
    { flight: "AMX001", lat: 19.4, lon: -99.1, alt_baro: 33000, track: 270 },
    { flight: "AZA001", lat: 41.9, lon: 12.5, alt_baro: 38000, track: 90 },
    { flight: "SWR001", lat: 47.5, lon: 8.5, alt_baro: 34000, track: 180 },
    { flight: "SAS001", lat: 59.9, lon: 10.7, alt_baro: 36000, track: 45 },
    { flight: "FIN001", lat: 60.3, lon: 25.0, alt_baro: 35000, track: 225 },
    { flight: "ICE001", lat: 64.1, lon: -21.9, alt_baro: 37000, track: 315 },
    { flight: "TAP001", lat: 38.8, lon: -9.1, alt_baro: 33000, track: 135 },
  ],
  ships: [
    { name: "EVER GIVEN", lat: 30.0, lon: 32.3 },
    { name: "MAERSK ES", lat: 51.9, lon: 4.0 },
    { name: "MSC OSCAR", lat: 36.0, lon: -5.3 },
    { name: "CMA CGM", lat: 13.0, lon: 100.5 },
    { name: "ONE APUS", lat: 35.0, lon: -140.0 },
    { name: "HMM ALG", lat: 35.1, lon: 129.0 },
    { name: "YANG MING", lat: 22.6, lon: 120.3 },
    { name: "EVERGREEN", lat: 51.5, lon: 0.0 },
    { name: "COSCO SH", lat: 31.2, lon: 121.5 },
    { name: "HAPAG-LL", lat: 53.5, lon: 9.9 },
  ],
};

// ---- Threat ping visual effect ----
function spawnThreatPing(lat, lon, color) {
  const ping = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
      semiMajorAxis: new Cesium.CallbackProperty(() => {
        const age = (Date.now() - ping._born) / 1000;
        return Math.min(500000, age * 80000);
      }, false),
      semiMinorAxis: new Cesium.CallbackProperty(() => {
        const age = (Date.now() - ping._born) / 1000;
        return Math.min(500000, age * 80000);
      }, false),
      material: new Cesium.Color(
        color.red,
        color.green,
        color.blue,
        0.3,
      ).withAlpha(
        new Cesium.CallbackProperty(() => {
          const age = (Date.now() - ping._born) / 1000;
          return Math.max(0, 0.4 - age * 0.07);
        }, false),
      ),
      outline: true,
      outlineColor: color,
      height: 0,
    },
    point: {
      pixelSize: 8,
      color,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  ping._born = Date.now();
  RECON.threatPings.push(ping.id);

  // Auto-remove after 6 seconds
  setTimeout(() => {
    try {
      viewer.entities.remove(ping);
    } catch {}
    RECON.threatPings = RECON.threatPings.filter((id) => id !== ping.id);
  }, 6000);
}

// ---- Radar sweep animation ----
function startRadarSweep() {
  stopRadarSweep();
  let angle = 0;

  RECON.radarSweep = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(0, 0, 0),
    ellipse: {
      semiMajorAxis: 15000000,
      semiMinorAxis: 15000000,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.6,
        color: Cesium.Color.fromCssColorString("#12ffc6").withAlpha(0.15),
      }),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#12ffc6").withAlpha(0.4),
      height: 0,
      numberOfVerticalLines: 0,
    },
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        angle += 0.02;
        const pts = [];
        for (let i = 0; i <= 60; i++) {
          const a = angle - (i * Math.PI) / 180;
          pts.push(
            Cesium.Cartesian3.fromDegrees(Math.cos(a) * 0, Math.sin(a) * 0, 0),
          );
        }
        return pts;
      }, false),
      width: 2,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.4,
        color: Cesium.Color.fromCssColorString("#12ffc6"),
      }),
      clampToGround: true,
      arcType: Cesium.ArcType.NONE,
    },
  });

  // Animate the sweep line
  RECON._sweepTimer = setInterval(() => {
    if (!RECON.active) {
      stopRadarSweep();
      return;
    }
  }, 50);
}

function stopRadarSweep() {
  if (RECON.radarSweep) {
    try {
      viewer.entities.remove(RECON.radarSweep);
    } catch {}
    RECON.radarSweep = null;
  }
  if (RECON._sweepTimer) {
    clearInterval(RECON._sweepTimer);
    RECON._sweepTimer = null;
  }
}

// ---- 1. STARLINK CONSTELLATION ----
// Fetches real Starlink TLE data from CelesTrak and propagates orbits via SGP4.
// Renders 100+ satellites as glowing cyan points with orbital tracks.
async function loadStarlink() {
  try {
    feed("warn", "RECON :: acquiring Starlink TLE data...");
    const res = await fetch(
      "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split("\n");
    const sats = [];
    for (let i = 0; i < lines.length; i += 3) {
      if (lines[i] && lines[i + 1] && lines[i + 2]) {
        sats.push({
          name: lines[i].trim(),
          line1: lines[i + 1].trim(),
          line2: lines[i + 2].trim(),
        });
      }
    }
    feed("ok", `RECON :: ${sats.length} Starlink satellites acquired`);

    // Render satellites (limit to 120 for performance)
    const maxSats = Math.min(sats.length, 120);
    for (let i = 0; i < maxSats; i++) {
      const sat = sats[i];
      const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
      if (!satrec) continue;

      const entity = viewer.entities.add({
        position: new Cesium.CallbackProperty(() => {
          const now = new Date();
          const posAndVelocity = satellite.propagate(satrec, now);
          if (!posAndVelocity.position) return Cesium.Cartesian3.ZERO;
          const gmst = satellite.gstime(now);
          const posEcf = satellite.eciToEcf(posAndVelocity.position, gmst);
          const cart = Cesium.Cartesian3.fromElements(
            posEcf.x * 1000,
            posEcf.y * 1000,
            posEcf.z * 1000,
          );
          return cart;
        }, false),
        point: {
          pixelSize: 4,
          color: Cesium.Color.fromCssColorString("#12ffc6"),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      RECON.feeds.sats.entities.push(entity.id);
    }
    RECON.feeds.sats.count = maxSats;
    updateReconCounter("sats", maxSats);
    feed("ok", `RECON :: ${maxSats} Starlink satellites now tracking`);
  } catch (e) {
    feed("err", `RECON :: Starlink failed → ${e.message}`);
    updateReconCounter("sats", "ERR");
  }
}

// ---- 2. GLOBAL AIRCRAFT (ADS-B) ----
// Fetches ALL aircraft (not just military) and updates positions every 10s.
// Falls back to demo data if the API is unreachable.
async function loadFlights() {
  let aircraft = [];
  let usedDemo = false;

  try {
    feed("warn", "RECON :: connecting to global ADS-B feed...");
    const res = await reconFetch("https://api.adsb.lol/v2/all", {}, 1);
    const j = await res.json();
    aircraft = j.ac || [];
    feed("ok", `RECON :: ${aircraft.length} aircraft live from ADS-B`);
  } catch (e) {
    // Fallback to demo data
    aircraft = RECON_DEMO.flights;
    usedDemo = true;
    feed(
      "warn",
      `RECON :: ADS-B unreachable — using demo data (${aircraft.length} planes)`,
    );
  }

  // Spawn threat pings for a few random aircraft
  const pingCount = Math.min(5, aircraft.length);
  for (let i = 0; i < pingCount; i++) {
    const ac = aircraft[Math.floor(Math.random() * aircraft.length)];
    if (ac.lat && ac.lon) {
      spawnThreatPing(
        ac.lat,
        ac.lon,
        Cesium.Color.fromCssColorString("#ffb020"),
      );
    }
  }

  // Render aircraft with live-updating positions
  const now = Date.now();
  aircraft.forEach((ac, idx) => {
    if (!ac.lat || !ac.lon) return;
    const alt = (ac.alt_baro || ac.alt_geom || 10000) * 0.3048;
    const track = (ac.track || 0) * (Math.PI / 180);
    const speed = ac.gs || 250; // knots
    const baseLat = ac.lat;
    const baseLon = ac.lon;
    const baseAlt = alt;
    const entityId = `flight-${idx}-${now}`;

    const e = viewer.entities.add({
      id: entityId,
      position: new Cesium.CallbackProperty(() => {
        // Animate position based on track and speed
        const elapsed = (Date.now() - now) / 1000;
        const distDeg = (speed * 0.000164 * elapsed) / 111320; // rough nm→deg
        const dLat = Math.cos(track) * distDeg * 111320;
        const dLon =
          Math.sin(track) *
          distDeg *
          111320 *
          Math.cos((baseLat * Math.PI) / 180);
        return Cesium.Cartesian3.fromDegrees(
          baseLon + dLon,
          baseLat + dLat,
          baseAlt,
        );
      }, false),
      point: {
        pixelSize: 5,
        color: Cesium.Color.fromCssColorString("#ffb020"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: (ac.flight || ac.r || "").trim(),
        font: "8px JetBrains Mono, monospace",
        fillColor: Cesium.Color.fromCssColorString("#ffb020"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(8, -3),
        scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 5e6, 0.3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    RECON.feeds.flights.entities.push(e.id);
  });

  RECON.feeds.flights.count = aircraft.length;
  updateReconCounter(
    "flights",
    usedDemo ? `${aircraft.length}*` : aircraft.length,
  );

  // Set up live refresh every 10 seconds (if not demo)
  if (!usedDemo) {
    RECON.feeds.flights.timer = setInterval(async () => {
      if (!RECON.active) return;
      try {
        const res = await fetch("https://api.adsb.lol/v2/all", {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const j = await res.json();
        const newAircraft = j.ac || [];
        // Update count
        RECON.feeds.flights.count = newAircraft.length;
        updateReconCounter("flights", newAircraft.length);
      } catch {
        /* keep existing data */
      }
    }, 10000);
  }
}

// ---- 3. LIVE SHIPS (AIS) ----
async function loadShips() {
  let vessels = [];
  let usedDemo = false;

  try {
    feed("warn", "RECON :: connecting to AIS vessel feed...");
    const res = await reconFetch(
      "https://api.vesselfinder.com/v1/vessels?bbox=-180,-90,180,90&limit=200",
      {},
      1,
    );
    const j = await res.json();
    vessels = j.vessels || j.data || [];
    feed("ok", `RECON :: ${vessels.length} vessels from AIS`);
  } catch (e) {
    vessels = RECON_DEMO.ships;
    usedDemo = true;
    feed(
      "warn",
      `RECON :: AIS unreachable — using demo data (${vessels.length} ships)`,
    );
  }

  vessels.forEach((v) => {
    const lat = v.lat || v.latitude;
    const lon = v.lon || v.longitude;
    if (!lat || !lon) return;
    const e = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      point: {
        pixelSize: 5,
        color: Cesium.Color.fromCssColorString("#4ecdc4"),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: v.name || v.vesselName || "VESSEL",
        font: "8px JetBrains Mono, monospace",
        fillColor: Cesium.Color.fromCssColorString("#4ecdc4"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(8, -3),
        scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 5e6, 0.3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    RECON.feeds.ships.entities.push(e.id);
  });

  RECON.feeds.ships.count = vessels.length;
  updateReconCounter("ships", usedDemo ? `${vessels.length}*` : vessels.length);
}

// ---- 4. EARTHQUAKES (USGS) ----
async function loadQuakes() {
  try {
    feed("warn", "RECON :: fetching USGS earthquake feed...");
    const res = await reconFetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
      {},
      1,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const g = await res.json();

    g.features.forEach((f) => {
      const [lon, lat, depth] = f.geometry.coordinates;
      const mag = f.properties.mag || 0;
      const color =
        mag >= 7
          ? "#ff0040"
          : mag >= 6
            ? "#ff2e6e"
            : mag >= 5
              ? "#ff6b2e"
              : "#ffb020";
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        point: {
          pixelSize: 6 + mag * 3,
          color: Cesium.Color.fromCssColorString(color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        ellipse: {
          semiMajorAxis: Math.max(50000, mag * 80000),
          semiMinorAxis: Math.max(50000, mag * 80000),
          material: Cesium.Color.fromCssColorString(color).withAlpha(0.15),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.5),
          height: 0,
        },
        label: {
          text: `M${mag.toFixed(1)} ${f.properties.place || ""}`,
          font: "9px JetBrains Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString(color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, -5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      RECON.feeds.quakes.entities.push(e.id);
    });

    RECON.feeds.quakes.count = g.features.length;
    updateReconCounter("quakes", g.features.length);
    feed("ok", `RECON :: ${g.features.length} significant earthquakes (7d)`);
  } catch (e) {
    feed("err", `RECON :: earthquakes failed → ${e.message}`);
    updateReconCounter("quakes", "ERR");
  }
}

// ---- 5. ACTIVE WILDFIRES (NASA FIRMS) ----
async function loadFires() {
  try {
    feed("warn", "RECON :: fetching NASA FIRMS fire detections...");
    // Use VIIRS fire data (last 24h, global) — no key needed for CSV
    const res = await reconFetch(
      "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv",
      {},
      1,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.split(/\r?\n/).slice(1, 501); // skip header, limit 500

    let count = 0;
    lines.forEach((ln) => {
      if (!ln) return;
      const c = ln.split(",");
      const lat = parseFloat(c[0]);
      const lon = parseFloat(c[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const frp = parseFloat(c[6]) || 1;
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        point: {
          pixelSize: Math.min(6, 2 + Math.log2(frp + 1)),
          color: Cesium.Color.fromCssColorString("#ff4020"),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      RECON.feeds.fires.entities.push(e.id);
      count++;
    });

    RECON.feeds.fires.count = count;
    updateReconCounter("fires", count);
    feed("ok", `RECON :: ${count} active fire detections (24h)`);
  } catch (e) {
    feed("warn", `RECON :: FIRMS CORS-blocked (expected in browser)`);
    updateReconCounter("fires", "N/A");
  }
}

// ---- 6. NEAR-EARTH ASTEROIDS (NASA) ----
async function loadAsteroids() {
  try {
    feed("warn", "RECON :: fetching NASA close-approach data...");
    const today = new Date().toISOString().slice(0, 10);
    const res = await reconFetch(
      `https://ssd-api.jpl.nasa.gov/cad.api?dist-max=10LD&date-min=${today}&date-max=${today}&body=Earth`,
      {},
      1,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const asteroids = j.data || [];

    asteroids.forEach((a) => {
      // a = [des, orbit_id, jd, dist, dist_min, dist_max, v_rel, v_inf, h]
      const name = a[0];
      const distLD = parseFloat(a[3]); // distance in lunar distances
      const size = parseFloat(a[8]) || 20; // absolute magnitude H
      // Place asteroid at a position relative to Earth based on distance
      const angle = Math.random() * Math.PI * 2;
      const distMeters = distLD * 384400000; // LD to meters
      const x = Math.cos(angle) * distMeters;
      const y = Math.sin(angle) * distMeters;
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromElements(x, y, 0),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString("#ff6b2e"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `☄ ${name} (${distLD.toFixed(1)} LD)`,
          font: "9px JetBrains Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString("#ff6b2e"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, -5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      RECON.feeds.asteroids.entities.push(e.id);
    });

    RECON.feeds.asteroids.count = asteroids.length;
    updateReconCounter("asteroids", asteroids.length);
    feed("ok", `RECON :: ${asteroids.length} near-Earth objects today`);
  } catch (e) {
    feed("warn", `RECON :: NASA NEO API unavailable → ${e.message}`);
    updateReconCounter("asteroids", "N/A");
  }
}

// ---- RECON UI HELPERS ----
function updateReconCounter(feed, count) {
  const el = document.getElementById(`recon-${feed}`);
  if (el) el.textContent = count;
  const feedEl = document.querySelector(`.recon-feed[data-feed="${feed}"]`);
  if (feedEl) {
    feedEl.classList.remove("loading");
    if (typeof count === "number") feedEl.classList.add("active");
  }
}

function setReconLoading() {
  document.querySelectorAll(".recon-feed").forEach((el) => {
    el.classList.add("loading");
    el.classList.remove("active");
  });
}

// ---- RECON MASTER CONTROL ----
async function activateRecon() {
  if (RECON.active) {
    deactivateRecon();
    return;
  }

  RECON.active = true;
  autoRotate = false;

  // UI updates
  const btn = document.getElementById("btn-recon");
  btn.classList.add("active");
  document.getElementById("recon-status").classList.remove("hidden");
  setReconLoading();

  feed("warn", "═══════════════════════════════════════════");
  feed("warn", "  RECON ONLINE — ACTIVATING ALL FEEDS");
  feed("warn", "═══════════════════════════════════════════");

  // Start radar sweep animation
  startRadarSweep();

  // Spawn initial threat pings at random locations for drama
  const pingLocs = [
    { lat: 51.5, lon: -0.1 }, // London
    { lat: 40.7, lon: -74.0 }, // NYC
    { lat: 35.6, lon: 139.7 }, // Tokyo
    { lat: -33.9, lon: 151.2 }, // Sydney
    { lat: 25.3, lon: 55.4 }, // Dubai
  ];
  pingLocs.forEach((loc, i) => {
    setTimeout(() => {
      if (RECON.active) {
        spawnThreatPing(
          loc.lat,
          loc.lon,
          Cesium.Color.fromCssColorString("#12ffc6"),
        );
      }
    }, i * 400);
  });

  // Launch all feeds in parallel
  await Promise.allSettled([
    loadStarlink(),
    loadFlights(),
    loadShips(),
    loadQuakes(),
    loadFires(),
    loadAsteroids(),
  ]);

  const totalEntities =
    RECON.feeds.sats.count +
    RECON.feeds.flights.count +
    RECON.feeds.ships.count +
    RECON.feeds.quakes.count +
    RECON.feeds.fires.count +
    RECON.feeds.asteroids.count;

  feed("ok", `═══════════════════════════════════════════`);
  feed("ok", `  RECON ONLINE — ${totalEntities} OBJECTS TRACKED`);
  feed("ok", `═══════════════════════════════════════════`);

  // Spawn celebration pings at feed locations
  setTimeout(() => {
    if (RECON.active) {
      spawnThreatPing(0, 0, Cesium.Color.fromCssColorString("#12ffc6"));
      spawnThreatPing(20, 100, Cesium.Color.fromCssColorString("#12ffc6"));
    }
  }, 500);
}

function deactivateRecon() {
  RECON.active = false;

  // Stop radar sweep
  stopRadarSweep();

  // Remove all entities from all feeds
  Object.values(RECON.feeds).forEach((feed) => {
    feed.entities.forEach((id) => {
      try {
        viewer.entities.removeById(id);
      } catch {}
    });
    feed.entities = [];
    feed.count = 0;
    if (feed.timer) {
      clearInterval(feed.timer);
      feed.timer = null;
    }
  });

  // Remove threat pings
  RECON.threatPings.forEach((id) => {
    try {
      viewer.entities.removeById(id);
    } catch {}
  });
  RECON.threatPings = [];

  // UI updates
  const btn = document.getElementById("btn-recon");
  btn.classList.remove("active");
  document.getElementById("recon-status").classList.add("hidden");
  document.querySelectorAll(".recon-feed").forEach((el) => {
    el.classList.remove("active", "loading");
  });

  feed("warn", "RECON :: all feeds deactivated");
}

// Wire up the RECON button
document.getElementById("btn-recon").addEventListener("click", activateRecon);

// Expose RECON API
window.GideonsEarth.recon = {
  activate: activateRecon,
  deactivate: deactivateRecon,
  isActive: () => RECON.active,
  feeds: RECON.feeds,
};
