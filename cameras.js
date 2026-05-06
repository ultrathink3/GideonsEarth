/* =========================================================
   GideonsEarth :: cameras.js
   PUBLIC CCTV / WEBCAM OVERLAY — 60+ worldwide cameras
   ---------------------------------------------------------
   Plots camera icons on the Cesium globe.
   Click any camera → floating info card with live-feed link.
   Toggle via 📷 button in the left tool-rail.
   ========================================================= */

(function () {
    "use strict";

    /* ---------- helpers (same pattern as defense.js / geoint.js) ---------- */
    const _viewer = () => window.GideonsEarth && window.GideonsEarth.viewer;
    const _feed   = (k, m) => (window.feed ? window.feed(k, m) : console.log(`[${k}] ${m}`));
    const _CS     = (hex, a) => Cesium.Color.fromCssColorString(hex).withAlpha(a !== undefined ? a : 1);

    /* ---------- category colours ---------- */
    const TYPE_COLORS = {
        traffic:  "#f5c842",   // yellow
        public:   "#00e5ff",   // cyan
        weather:  "#448aff",   // blue
        landmark: "#e040fb",   // magenta
    };

    /* =================================================================
       SEED CAMERAS — 65 worldwide public cameras / webcams / traffic
       Each entry: { name, lat, lon, type, thumb, url }
       ================================================================= */
    const CAMERAS = [
        // ── North America — East ──────────────────────────────────────
        { name: "Times Square NYC",           lat: 40.7580, lon: -73.9855, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/newyork/timessquare/" },
        { name: "Brooklyn Bridge NYC",        lat: 40.7061, lon: -73.9969, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/newyork/brooklynbridge/" },
        { name: "Statue of Liberty NYC",      lat: 40.6892, lon: -74.0445, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/newyork/statueofliberty/" },
        { name: "5th Avenue NYC",             lat: 40.7549, lon: -73.9840, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/newyork/5thavenue/" },
        { name: "Boston Harbor",              lat: 42.3601, lon: -71.0472, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/massachusetts/boston/" },
        { name: "DC National Mall",           lat: 38.8899, lon: -77.0230, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/dc/" },
        { name: "White House",                lat: 38.8977, lon: -77.0365, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=MgQxwRkBRMM" },
        { name: "Miami Beach",                lat: 25.7907, lon: -80.1300, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/florida/miamibeach/" },
        { name: "Key West FL",                lat: 24.5551, lon: -81.7800, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/florida/keywest/" },
        { name: "Atlanta Midtown",            lat: 33.7756, lon: -84.3963, type: "traffic",  thumb: "", url: "https://www.511ga.org/" },
        { name: "Bourbon St New Orleans",     lat: 29.9584, lon: -90.0653, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/" },
        { name: "Niagara Falls",              lat: 43.0896, lon: -79.0849, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/newyork/niagarafalls/" },

        // ── North America — Central / West ────────────────────────────
        { name: "Chicago Skyline",            lat: 41.8827, lon: -87.6233, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/illinois/chicago/" },
        { name: "Houston Downtown",           lat: 29.7604, lon: -95.3698, type: "traffic",  thumb: "", url: "https://www.houstontranstar.org/trafficsnapshots/" },
        { name: "Denver I-25 Corridor",       lat: 39.7392, lon: -104.9903, type: "traffic", thumb: "", url: "https://www.cotrip.org/map" },
        { name: "Phoenix I-10 Traffic",       lat: 33.4484, lon: -112.0740, type: "traffic", thumb: "", url: "https://www.az511.com/map" },
        { name: "Las Vegas Strip",            lat: 36.1147, lon: -115.1728, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/nevada/lasvegas/" },
        { name: "Hollywood Blvd LA",          lat: 34.1016, lon: -118.3267, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/california/losangeles/hollywoodblvd/" },
        { name: "Santa Monica Pier",          lat: 34.0094, lon: -118.4973, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/california/santamonica/" },
        { name: "LA Traffic 101 Freeway",     lat: 34.0522, lon: -118.2437, type: "traffic",  thumb: "", url: "https://cwwp2.dot.ca.gov/vm/streamlist.htm" },
        { name: "San Francisco Embarcadero",  lat: 37.7955, lon: -122.3937, type: "public",   thumb: "", url: "https://www.earthcam.com/usa/california/sanfrancisco/" },
        { name: "Golden Gate Bridge SF",      lat: 37.8199, lon: -122.4783, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=HufrR0sTTKM" },
        { name: "Seattle Space Needle",       lat: 47.6205, lon: -122.3493, type: "landmark", thumb: "", url: "https://www.earthcam.com/usa/washington/seattle/" },
        { name: "Portland OR Morrison Bridge", lat: 45.5152, lon: -122.6700, type: "traffic", thumb: "", url: "https://www.tripcheck.com/Pages/CamerasMap.asp" },

        // ── Canada ────────────────────────────────────────────────────
        { name: "Toronto CN Tower",           lat: 43.6426, lon: -79.3871, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/canada/toronto/" },
        { name: "Vancouver Harbour",          lat: 49.2827, lon: -123.1207, type: "public",  thumb: "", url: "https://www.youtube.com/watch?v=9DHe_d5J3NI" },

        // ── Latin America ─────────────────────────────────────────────
        { name: "Zocalo Mexico City",         lat: 19.4326, lon: -99.1332, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=6fWtmEWeLCw" },
        { name: "Copacabana Beach Rio",       lat: -22.9711, lon: -43.1822, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/brazil/riodejaneiro/" },
        { name: "Christ the Redeemer Rio",    lat: -22.9519, lon: -43.2105, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=FxOSXI0uW6g" },
        { name: "Buenos Aires Obelisco",      lat: -34.6037, lon: -58.3816, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=2FpLKLGxrKI" },

        // ── Europe — UK & Ireland ─────────────────────────────────────
        { name: "Abbey Road London",          lat: 51.5320, lon: -0.1779, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/england/london/abbeyroad/" },
        { name: "Tower Bridge London",        lat: 51.5055, lon: -0.0754, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/england/london/" },
        { name: "Dublin Temple Bar",          lat: 53.3454, lon: -6.2634, type: "public",   thumb: "", url: "https://www.earthcam.com/world/ireland/dublin/" },

        // ── Europe — Western ──────────────────────────────────────────
        { name: "Eiffel Tower Paris",         lat: 48.8584, lon:  2.2945, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=vVEqEFNlHOQ" },
        { name: "Champs-Elysees Paris",       lat: 48.8698, lon:  2.3078, type: "public",   thumb: "", url: "https://www.earthcam.com/world/france/paris/" },
        { name: "Amsterdam Dam Square",       lat: 52.3731, lon:  4.8932, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=y_kMzPnQ2wM" },
        { name: "Brussels Grand Place",       lat: 50.8467, lon:  4.3525, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=RJbUv05eTbc" },

        // ── Europe — Central / South ──────────────────────────────────
        { name: "Berlin Brandenburg Gate",    lat: 52.5163, lon: 13.3777, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=4fOblMqR2MY" },
        { name: "Prague Old Town Square",     lat: 50.0875, lon: 14.4213, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=dDxLt5gOgjY" },
        { name: "Rome Trevi Fountain",        lat: 41.9009, lon: 12.4833, type: "landmark", thumb: "", url: "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/fontana-di-trevi.html" },
        { name: "Rome Colosseum",             lat: 41.8902, lon: 12.4922, type: "landmark", thumb: "", url: "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/colosseo.html" },
        { name: "Venice Grand Canal",         lat: 45.4408, lon: 12.3155, type: "landmark", thumb: "", url: "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/canal-grande-702.html" },
        { name: "Barcelona La Rambla",        lat: 41.3809, lon:  2.1734, type: "public",   thumb: "", url: "https://www.skylinewebcams.com/en/webcam/espana/cataluna/barcelona/playa-de-la-barceloneta.html" },
        { name: "Lisbon Commerce Square",     lat: 38.7075, lon: -9.1364, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=VeTLqiJeLrY" },

        // ── Europe — North / East ─────────────────────────────────────
        { name: "Moscow Red Square",          lat: 55.7539, lon: 37.6208, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=IlBPJGYbXE4" },
        { name: "Stockholm Gamla Stan",       lat: 59.3251, lon: 18.0711, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=6gKP9mQh7mE" },

        // ── Middle East ───────────────────────────────────────────────
        { name: "Dubai Burj Khalifa",         lat: 25.1972, lon: 55.2744, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/uae/dubai/" },
        { name: "Mecca Masjid al-Haram",      lat: 21.4225, lon: 39.8262, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=p5jGrByiqMM" },
        { name: "Istanbul Hagia Sophia",      lat: 41.0086, lon: 28.9802, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=V4FJR1mxiMU" },

        // ── Asia — East ───────────────────────────────────────────────
        { name: "Shibuya Crossing Tokyo",     lat: 35.6595, lon: 139.7004, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=_9MKS0dAaRY" },
        { name: "Shinjuku Tokyo",             lat: 35.6938, lon: 139.7034, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
        { name: "Seoul Gangnam",              lat: 37.4979, lon: 127.0276, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=gCNeDWCI0vo" },
        { name: "Hong Kong Victoria Harbour",  lat: 22.2855, lon: 114.1577, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/china/hongkong/" },
        { name: "Shanghai The Bund",          lat: 31.2400, lon: 121.4900, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=p-LSrV1YoVc" },
        { name: "Beijing Tiananmen",          lat: 39.9042, lon: 116.3974, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=o6LrUb7Ix5Q" },

        // ── Asia — Southeast ──────────────────────────────────────────
        { name: "Singapore Marina Bay",       lat:  1.2814, lon: 103.8585, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=Sjn4W4kE0nk" },
        { name: "Bangkok Khao San Road",      lat: 13.7590, lon: 100.4975, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=SsOoYKf1ts4" },

        // ── South Asia ────────────────────────────────────────────────
        { name: "Mumbai Marine Drive",        lat: 18.9432, lon: 72.8235, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=TyuqFgRczqM" },
        { name: "Varanasi Ganges Ghats",      lat: 25.3176, lon: 83.0068, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=7pNgO8YrKT0" },

        // ── Oceania ───────────────────────────────────────────────────
        { name: "Sydney Opera House",         lat: -33.8568, lon: 151.2153, type: "landmark", thumb: "", url: "https://www.earthcam.com/world/australia/sydney/" },
        { name: "Bondi Beach Sydney",         lat: -33.8915, lon: 151.2767, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=PCNk_HaQjY0" },
        { name: "Auckland Harbour NZ",        lat: -36.8485, lon: 174.7633, type: "public",   thumb: "", url: "https://www.youtube.com/watch?v=5IIk7FZQsCM" },

        // ── Africa ────────────────────────────────────────────────────
        { name: "Cape Town Table Mountain",   lat: -33.9628, lon: 18.4098, type: "landmark", thumb: "", url: "https://www.youtube.com/watch?v=bQvON4nB0WM" },
        { name: "Nairobi CBD",                lat: -1.2864, lon: 36.8172, type: "public",    thumb: "", url: "https://www.youtube.com/watch?v=ydYDqZQpim8" },
    ];

    /* ---------- entity storage ---------- */
    let _entities  = [];   // Cesium entity refs
    let _loaded    = false;
    let _popup     = null; // current popup DOM element

    /* ---------- billboard image (canvas-generated 📷) ---------- */
    function makeCameraIcon(typeColor) {
        const size = 48;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d");
        // outer glow
        ctx.shadowColor = typeColor;
        ctx.shadowBlur  = 10;
        // camera body
        ctx.fillStyle = typeColor;
        ctx.beginPath();
        ctx.roundRect(8, 14, 28, 22, 4);
        ctx.fill();
        // lens
        ctx.fillStyle = "#0a0f0f";
        ctx.beginPath();
        ctx.arc(22, 25, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = typeColor;
        ctx.beginPath();
        ctx.arc(22, 25, 4, 0, Math.PI * 2);
        ctx.fill();
        // flash
        ctx.fillStyle = typeColor;
        ctx.beginPath();
        ctx.moveTo(26, 14);
        ctx.lineTo(32, 6);
        ctx.lineTo(38, 6);
        ctx.lineTo(36, 14);
        ctx.closePath();
        ctx.fill();
        return c.toDataURL();
    }

    /* pre-generate one icon per type */
    const _icons = {};
    for (const [type, hex] of Object.entries(TYPE_COLORS)) {
        _icons[type] = makeCameraIcon(hex);
    }

    /* ---------- close any open popup ---------- */
    function closePopup() {
        if (_popup && _popup.parentNode) _popup.parentNode.removeChild(_popup);
        _popup = null;
    }

    /* ---------- show camera info card ---------- */
    function showCameraCard(cam) {
        closePopup();

        const color = TYPE_COLORS[cam.type] || TYPE_COLORS.public;
        const el = document.createElement("div");
        el.className = "cam-popup";
        el.innerHTML = [
            '<div class="cam-popup-head">',
            '  <span class="cam-popup-title">\uD83D\uDCF7 ' + escHtml(cam.name) + '</span>',
            '  <button class="cam-popup-close">\u2715</button>',
            '</div>',
            '<div class="cam-popup-body">',
            '  <span class="cam-badge" style="background:' + color + '">' + cam.type.toUpperCase() + '</span>',
            cam.thumb
                ? '  <img class="cam-thumb" src="' + escHtml(cam.thumb) + '" alt="preview" />'
                : '  <div class="cam-thumb-placeholder">\uD83D\uDCF9 no preview</div>',
            '  <div class="cam-coords">' + cam.lat.toFixed(4) + ', ' + cam.lon.toFixed(4) + '</div>',
            '  <button class="cam-open-feed">OPEN FEED \u27A4</button>',
            '</div>',
        ].join("\n");

        document.body.appendChild(el);
        _popup = el;

        /* close button */
        el.querySelector(".cam-popup-close").addEventListener("click", closePopup);

        /* open feed button */
        el.querySelector(".cam-open-feed").addEventListener("click", () => {
            window.open(cam.url, "_blank", "noopener");
        });

        /* clicking anywhere outside closes */
        setTimeout(() => {
            document.addEventListener("mousedown", function handler(e) {
                if (_popup && !_popup.contains(e.target)) {
                    closePopup();
                    document.removeEventListener("mousedown", handler);
                }
            });
        }, 100);
    }

    function escHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* ---------- inject CSS for the popup ---------- */
    function injectStyles() {
        if (document.getElementById("cam-popup-styles")) return;
        const style = document.createElement("style");
        style.id = "cam-popup-styles";
        style.textContent = [
            ".cam-popup {",
            "  position: fixed; top: 50%; left: 50%;",
            "  transform: translate(-50%, -50%);",
            "  z-index: 9999;",
            "  width: 340px;",
            "  background: rgba(5,12,12,0.96);",
            "  border: 1px solid rgba(18,255,198,0.35);",
            "  border-radius: 8px;",
            "  box-shadow: 0 0 30px rgba(18,255,198,0.15), 0 8px 32px rgba(0,0,0,0.6);",
            "  backdrop-filter: blur(10px);",
            "  font-family: 'Roboto Mono', monospace;",
            "  color: #d4ece8;",
            "  overflow: hidden;",
            "  animation: cam-fadein .2s ease;",
            "}",
            "@keyframes cam-fadein { from { opacity:0; transform:translate(-50%,-50%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }",
            ".cam-popup-head {",
            "  display: flex; justify-content: space-between; align-items: center;",
            "  padding: 10px 14px;",
            "  border-bottom: 1px solid rgba(18,255,198,0.15);",
            "  background: rgba(18,255,198,0.06);",
            "}",
            ".cam-popup-title {",
            "  font-size: 13px; font-weight: 600;",
            "  color: #12ffc6; white-space: nowrap;",
            "  overflow: hidden; text-overflow: ellipsis;",
            "}",
            ".cam-popup-close {",
            "  background: none; border: none; color: #d4ece8;",
            "  font-size: 16px; cursor: pointer; padding: 0 4px;",
            "  opacity: 0.6; transition: .15s;",
            "}",
            ".cam-popup-close:hover { opacity: 1; color: #ff2e6e; }",
            ".cam-popup-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }",
            ".cam-badge {",
            "  display: inline-block; padding: 2px 10px;",
            "  border-radius: 3px; font-size: 10px; font-weight: 700;",
            "  color: #0a0f0f; letter-spacing: 1px; align-self: flex-start;",
            "}",
            ".cam-thumb {",
            "  width: 100%; height: 140px; object-fit: cover;",
            "  border-radius: 4px; border: 1px solid rgba(18,255,198,0.12);",
            "}",
            ".cam-thumb-placeholder {",
            "  width: 100%; height: 80px; display: flex; align-items: center; justify-content: center;",
            "  border-radius: 4px; border: 1px dashed rgba(18,255,198,0.2);",
            "  color: rgba(212,236,232,0.4); font-size: 13px;",
            "}",
            ".cam-coords { font-size: 11px; color: rgba(212,236,232,0.5); letter-spacing: 0.5px; }",
            ".cam-open-feed {",
            "  width: 100%; padding: 8px 0; border: none;",
            "  border-radius: 4px; cursor: pointer;",
            "  background: #12ffc6; color: #0a0f0f;",
            "  font-family: 'Roboto Mono', monospace;",
            "  font-size: 12px; font-weight: 700; letter-spacing: 1.5px;",
            "  transition: .15s;",
            "}",
            ".cam-open-feed:hover { background: #0dccaa; box-shadow: 0 0 16px rgba(18,255,198,0.35); }",
        ].join("\n");
        document.head.appendChild(style);
    }

    /* ---------- click handler for entities ---------- */
    let _clickHandler = null;

    function wireClickHandler() {
        const viewer = _viewer();
        if (!viewer || _clickHandler) return;
        _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        _clickHandler.setInputAction(function (click) {
            const picked = viewer.scene.pick(click.position);
            if (!picked || !picked.id) return;
            const eid = picked.id;
            /* find matching camera data stashed on the entity */
            if (eid._cameraData) {
                showCameraCard(eid._cameraData);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    /* ---------- load / spawn cameras ---------- */
    function load() {
        const viewer = _viewer();
        if (!viewer) { _feed("err", "CCTV :: viewer not ready"); return; }

        if (_loaded) { _feed("warn", "CCTV :: already loaded"); return; }

        injectStyles();
        wireClickHandler();

        let count = 0;
        for (const cam of CAMERAS) {
            const color = TYPE_COLORS[cam.type] || TYPE_COLORS.public;
            const icon  = _icons[cam.type] || _icons.public;

            const entity = viewer.entities.add({
                name: cam.name,
                position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 0),
                billboard: {
                    image: icon,
                    width: 28,
                    height: 28,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1e3, 1.4, 8e6, 0.4),
                },
                label: {
                    text: cam.name,
                    font: "11px 'Roboto Mono', monospace",
                    fillColor: Cesium.Color.fromCssColorString(color),
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -30),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1e3, 1.0, 5e6, 0.0),
                    translucencyByDistance: new Cesium.NearFarScalar(1e3, 1.0, 5e6, 0.0),
                },
            });

            /* stash camera data on the entity for the click handler */
            entity._cameraData = cam;
            _entities.push(entity);
            count++;
        }

        _loaded = true;
        _feed("warn", "CCTV :: loaded " + count + " cameras worldwide");
    }

    /* ---------- clear / remove cameras ---------- */
    function clear() {
        const viewer = _viewer();
        if (!viewer) return;
        for (const e of _entities) {
            try { viewer.entities.remove(e); } catch (_) { /* noop */ }
        }
        _entities = [];
        _loaded = false;
        closePopup();

        if (_clickHandler) {
            _clickHandler.destroy();
            _clickHandler = null;
        }
    }

    /* ---------- expose on window.GideonsEarth ---------- */
    window.GideonsEarth = window.GideonsEarth || {};
    window.GideonsEarth.cameras = {
        load:    load,
        clear:   clear,
        list:    function () { return CAMERAS; },
        count:   function () { return _entities.length; },
        visible: function () { return _loaded; },
    };

    console.log("%cCCTV module ready — " + CAMERAS.length + " cameras in seed list", "color:#00e5ff");
})();
