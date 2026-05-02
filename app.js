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
(async () => {
  try {
    const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
    viewer.terrainProvider = terrain;
    feed("ok", "TERRAIN :: Cesium World Terrain engaged (real elevation)");
  } catch (e) {
    console.warn("Terrain load failed:", e);
  }
})();

// --- 3D buildings: Google Photorealistic 3D Tiles (the REAL Google-Earth-style tileset) ---
// This is the photorealistic mesh of entire cities that Google Earth Pro shows.
// Requires a Cesium Ion token (which we have) — Ion proxies the Google Maps API.
(async () => {
  try {
    const google = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(google);
    feed(
      "ok",
      "3D-TILES :: Google Photorealistic 3D Tiles loaded (cities worldwide)",
    );
  } catch (e) {
    console.warn("Google 3D Tiles failed, falling back to OSM Buildings:", e);
    feed(
      "warn",
      `3D-TILES :: Google photorealistic failed (${e.message}), using OSM Buildings`,
    );
    try {
      const buildings = await Cesium.createOsmBuildingsAsync();
      buildings.style = new Cesium.Cesium3DTileStyle({
        color: "color('#9ef7e2', 0.9)",
      });
      viewer.scene.primitives.add(buildings);
      feed("ok", "3D-TILES :: OSM Buildings loaded (fallback)");
    } catch (e2) {
      console.warn("OSM Buildings also failed:", e2);
    }
  }
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
const _ltPollers = {}; // active poll timers per slug

document.getElementById("link-gen").addEventListener("click", async () => {
  const target =
    document.getElementById("link-url").value.trim() || "https://youtube.com";
  const tag = document.getElementById("link-tag").value.trim() || "untagged";
  const slug = Math.random().toString(36).slice(2, 8);

  // Tracking URL — points to local server which captures real visitor IP
  const trackUrl = `${location.origin}/t/${slug}`;

  // Register campaign with server so it knows where to redirect
  try {
    await fetch(`${location.origin}/t/${slug}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, tag }),
    });
  } catch {
    /* server may not be running — graceful fallback */
  }

  linkOut.innerHTML = `
      <div class="kv"><span class="k">TRACKING LINK</span><span class="v" style="color:var(--accent);word-break:break-all">${trackUrl}</span></div>
      <div class="kv"><span class="k">CAMPAIGN</span><span class="v">${escapeHtml(tag)}</span></div>
      <div class="kv"><span class="k">REDIRECT TO</span><span class="v">${escapeHtml(target)}</span></div>
      <div class="kv"><span class="k">STATUS</span><span class="v" style="color:#ffb020" id="lt-status-${slug}">⟳ Waiting for clicks…</span></div>
      <div id="lt-hits-${slug}" style="margin-top:6px"></div>`;

  feed("warn", `LINK-TRACE :: /${slug} → ${target} — polling for hits`);

  // Poll server every 5 s for real hits
  let lastCount = 0;
  if (_ltPollers[slug]) clearInterval(_ltPollers[slug]);
  _ltPollers[slug] = setInterval(async () => {
    try {
      const r = await fetch(`${location.origin}/t/${slug}/hits`);
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
    card.innerHTML = `
          <div style="color:#ff2e6e;font-weight:700;letter-spacing:1px;margin-bottom:4px">⚡ HIT DETECTED</div>
          <div class="kv"><span class="k">IP ADDRESS</span><span class="v" style="color:#fff;font-weight:700;font-size:13px">${escapeHtml(ip)}</span></div>
          ${d ? `<div class="kv"><span class="k">LOCATION</span><span class="v">${escapeHtml([d.city, d.region, d.country_code].filter(Boolean).join(", "))}</span></div>` : ""}
          ${d?.org ? `<div class="kv"><span class="k">ORG / ISP</span><span class="v">${escapeHtml(d.org)}</span></div>` : ""}
          ${d?.asn ? `<div class="kv"><span class="k">ASN</span><span class="v">${escapeHtml(d.asn)}</span></div>` : ""}
          ${hit.ua ? `<div class="kv"><span class="k">USER AGENT</span><span class="v" style="word-break:break-all;font-size:9px;opacity:.7">${escapeHtml(hit.ua.slice(0, 120))}</span></div>` : ""}
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
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
handler.setInputAction((click) => {
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

// ---------- WALK-MAN MODE (first-person walk around the globe) ----------
// Click the 🚶 tool, then click anywhere on the map to drop your walker and
// enter first-person. WASD to walk, mouse to look, SPACE to jump, SHIFT to run,
// Q/E to fly up/down, ESC to exit. The camera hugs the terrain (or top of any
// 3D-Tiles building surface), with a small collision offset.

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

  // Start 50m above the surface and let gravity drop us onto it — guarantees we
  // never spawn *inside* a building or hillside.
  walk.position = Cesium.Cartographic.fromDegrees(
    lon,
    lat,
    groundHeight + walk.eyeHeight + 50,
  );
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

  // Use the cached async ground height. If we don't have one yet, fall back
  // to globe.getHeight (terrain-only) — never to 0, which would teleport
  // the walker down to sea level.
  let groundH = walk.groundHeight;
  if (groundH == null) {
    const gh = scene.globe.getHeight(walk.position);
    groundH = gh != null ? gh : walk.position.height - walk.eyeHeight;
  }

  // Free vertical movement (Q/E) overrides gravity
  if (vertical !== 0) {
    walk.position.height += vertical * walk.flySpeed * dt;
    walk.velocity.up = 0;
  } else {
    // Apply gravity, but never let feet drop below ground surface.
    walk.velocity.up -= walk.gravity * dt;
    let newHeight = walk.position.height + walk.velocity.up * dt;
    const minHeight = groundH + walk.eyeHeight;
    if (newHeight <= minHeight) {
      newHeight = minHeight; // stick to surface
      walk.velocity.up = 0;
      walk.grounded = true;
    } else {
      walk.grounded = false;
    }
    walk.position.height = newHeight;
  }

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
