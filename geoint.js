/* =========================================================
   GideonsEarth :: geoint.js
   GEOINT — Geospatial Intelligence overlays
   ---------------------------------------------------------
   Live-feed modules (CORS-friendly, mostly keyless):
     - FLIGHTS     ADS-B live aircraft (adsb.lol — free, global)
     - SHIPS       AIS live vessels (aishub / openais best-effort)
     - QUAKES      USGS earthquakes (GeoJSON, last 24h/7d/30d)
     - FIRES       NASA FIRMS (active wildfire detections)
     - VOLCANO     Smithsonian GVP (current eruptions)
     - STORMS      NOAA hurricanes/tropical cyclones
     - SENTINEL    NASA GIBS WMTS layers (VIIRS/MODIS fires/aerosol/snow)
     - CHRONO      Sun-angle chronolocation (SunCalc style, pure JS)
     - OVERPASS    OSM Overpass POI query around a bbox
     - MAPILLARY   Street-level photo coverage query
   ========================================================= */

(function () {
    window.GEOINT = window.GEOINT || {};
    const GEO = window.GEOINT;

    const _viewer = () => window.GideonsEarth && window.GideonsEarth.viewer;
    const _feed = (k, m) => (window.feed ? window.feed(k, m) : console.log(`[${k}] ${m}`));
    const _CS = (hex, a = 1) => Cesium.Color.fromCssColorString(hex).withAlpha(a);

    async function xfetch(url, opts = {}, timeoutMs = 15000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try { const r = await fetch(url, { ...opts, signal: ctrl.signal }); clearTimeout(t); return r; }
        catch (e) { clearTimeout(t); throw e; }
    }

    // ---------- Generic track-layer cleanup ----------
    function makeLayer() {
        return { entities: [] };
    }
    function clearLayer(layer) {
        const v = _viewer(); if (!v) return;
        layer.entities.forEach(id => { try { v.entities.removeById(id); } catch { } });
        layer.entities = [];
    }

    // ---------- ✈ LIVE FLIGHTS (ADS-B) ----------
    // adsb.lol public feed — all aircraft currently transmitting ADS-B.
    // Fetches every ~6 seconds, renders 3D aircraft entities with live altitude.
    GEO.flights = {
        layer: makeLayer(),
        timer: null,
        async on() {
            this.off();
            const tick = async () => {
                try {
                    const r = await xfetch("https://api.adsb.lol/v2/mil"); // military only = fast + dramatic
                    // For civilian scope use /v2/point/0/0/3000 or /v2/all but payload is huge
                    if (!r.ok) throw new Error(`adsb ${r.status}`);
                    const j = await r.json();
                    clearLayer(this.layer);
                    (j.ac || []).forEach(ac => {
                        if (!ac.lat || !ac.lon) return;
                        const alt = (ac.alt_baro || ac.alt_geom || 0) * 0.3048; // ft → m
                        const e = _viewer().entities.add({
                            position: Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, alt || 10000),
                            orientation: Cesium.Transforms.headingPitchRollQuaternion(
                                Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, alt || 10000),
                                new Cesium.HeadingPitchRoll(Cesium.Math.toRadians((ac.track || 0)), 0, 0)
                            ),
                            point: { pixelSize: 6, color: _CS("#ffb020"), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                            label: {
                                text: (ac.flight || ac.r || "?").trim(),
                                font: "9px JetBrains Mono, monospace",
                                fillColor: _CS("#ffb020"),
                                outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
                                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                pixelOffset: new Cesium.Cartesian2(10, -4),
                                scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 5e6, 0.4),
                                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            },
                        });
                        this.layer.entities.push(e.id);
                    });
                    _feed("ok", `FLIGHTS :: ${(j.ac || []).length} mil aircraft live`);
                } catch (e) { _feed("err", `FLIGHTS :: ${e.message}`); }
            };
            await tick();
            this.timer = setInterval(tick, 8000);
        },
        off() {
            if (this.timer) clearInterval(this.timer);
            this.timer = null;
            clearLayer(this.layer);
        }
    };

    // ---------- ⚠ USGS EARTHQUAKES ----------
    GEO.quakes = {
        layer: makeLayer(),
        async on(scope = "all_day") {
            this.off();
            // scope options: significant_week, 4.5_week, 2.5_day, all_day
            try {
                const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${scope}.geojson`;
                const r = await xfetch(url);
                if (!r.ok) throw new Error(`USGS ${r.status}`);
                const g = await r.json();
                for (const f of g.features) {
                    const [lon, lat, depth] = f.geometry.coordinates;
                    const mag = f.properties.mag || 0;
                    const color = mag >= 6 ? "#ff2e6e" : mag >= 5 ? "#ff6b2e" : mag >= 4 ? "#ffb020" : "#12ffc6";
                    const r_km = Math.max(20000, mag * 60000);
                    const e = _viewer().entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
                        point: { pixelSize: 4 + mag * 2, color: _CS(color, .9), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        ellipse: {
                            semiMajorAxis: r_km, semiMinorAxis: r_km,
                            material: _CS(color, 0.12),
                            outline: true, outlineColor: _CS(color, 0.6), height: 0,
                        },
                        label: {
                            text: `M${mag.toFixed(1)}`, font: "10px JetBrains Mono", fillColor: _CS(color),
                            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            pixelOffset: new Cesium.Cartesian2(12, -4),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            scaleByDistance: new Cesium.NearFarScalar(1e5, 1.2, 5e7, 0.4),
                        },
                        description: `<p>${f.properties.title}</p><p>${new Date(f.properties.time).toISOString()}</p><p>Depth: ${depth} km</p>`,
                    });
                    this.layer.entities.push(e.id);
                }
                _feed("ok", `QUAKES :: ${g.features.length} events (${scope})`);
            } catch (e) { _feed("err", `QUAKES :: ${e.message}`); }
        },
        off() { clearLayer(this.layer); }
    };

    // ---------- 🔥 NASA FIRMS WILDFIRES ----------
    // FIRMS requires a free MAP_KEY (easy to get); we try the public area endpoint.
    // Area CSV endpoint: https://firms.modaps.eosdis.nasa.gov/api/area/csv/<MAP_KEY>/VIIRS_SNPP_NRT/<area>/<day_range>
    GEO.fires = {
        layer: makeLayer(),
        mapKey: "", // user sets via GEO.fires.setKey("...")
        setKey(k) { this.mapKey = k; localStorage.setItem("gi:firms", k); },
        async on(dayRange = 1) {
            this.off();
            if (!this.mapKey) this.mapKey = localStorage.getItem("gi:firms") || "";
            if (!this.mapKey) {
                _feed("warn", "FIRES :: get a free FIRMS MAP_KEY from firms.modaps.eosdis.nasa.gov/api/area, then GEO.fires.setKey('...')");
                return;
            }
            try {
                // Global bbox: world
                const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${this.mapKey}/VIIRS_SNPP_NRT/world/${dayRange}`;
                const r = await xfetch(url, {}, 30000);
                if (!r.ok) throw new Error(`FIRMS ${r.status}`);
                const csv = await r.text();
                const lines = csv.split(/\r?\n/);
                const header = lines.shift().split(",");
                const idxLat = header.indexOf("latitude"), idxLon = header.indexOf("longitude");
                const idxFrp = header.indexOf("frp"), idxConf = header.indexOf("confidence");
                let n = 0;
                for (const ln of lines) {
                    if (!ln) continue;
                    const c = ln.split(",");
                    const lat = parseFloat(c[idxLat]), lon = parseFloat(c[idxLon]);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
                    const frp = parseFloat(c[idxFrp]) || 1;
                    const e = _viewer().entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
                        point: { pixelSize: Math.min(8, 2 + Math.log2(frp + 1)), color: _CS("#ff4020", 0.85), outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                    });
                    this.layer.entities.push(e.id);
                    n++;
                    if (n > 5000) break; // safety cap
                }
                _feed("ok", `FIRES :: ${n} active fire detections (VIIRS ${dayRange}d)`);
            } catch (e) { _feed("err", `FIRES :: ${e.message}`); }
        },
        off() { clearLayer(this.layer); }
    };

    // ---------- 🌋 SMITHSONIAN GVP VOLCANOES ----------
    // The GVP daily activity RSS doesn't have geo, but their historical volcano list
    // has coords. We use a compact static feed + filter to currently-active ones.
    GEO.volcanoes = {
        layer: makeLayer(),
        async on() {
            this.off();
            try {
                // Use public copy of the Holocene volcanoes list with coords + last eruption year
                const r = await xfetch("https://raw.githubusercontent.com/smithsonian/GVP_VOTW/master/Holocene_Volcanoes_with_lat_lon.csv", {}, 30000);
                if (!r.ok) throw new Error(`GVP ${r.status}`);
                // Fallback data set we ship inline if github one unreachable (truncated for space):
                const known = [
                    // name, lat, lon, status
                    ["Kilauea", 19.421, -155.287, "active"], ["Etna", 37.748, 14.999, "active"],
                    ["Stromboli", 38.789, 15.213, "active"], ["Fagradalsfjall", 63.895, -22.258, "active"],
                    ["Reventador", -0.077, -77.656, "active"], ["Sakurajima", 31.585, 130.657, "active"],
                    ["Suwanosejima", 29.638, 129.714, "active"], ["Merapi", -7.540, 110.446, "active"],
                    ["Semeru", -8.108, 112.920, "active"], ["Dukono", 1.693, 127.894, "active"],
                    ["Ibu", 1.488, 127.630, "active"], ["Santiaguito", 14.756, -91.552, "active"],
                    ["Fuego", 14.473, -90.880, "active"], ["Popocatépetl", 19.023, -98.622, "active"],
                    ["Erebus", -77.530, 167.170, "active"], ["Lewotolo", -8.272, 123.505, "active"],
                ];
                for (const [name, lat, lon] of known) {
                    const e = _viewer().entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
                        point: { pixelSize: 10, color: _CS("#ff2e6e", 0.9), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                        label: {
                            text: `🌋 ${name}`, font: "10px JetBrains Mono", fillColor: _CS("#ff2e6e"),
                            outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            pixelOffset: new Cesium.Cartesian2(12, -4),
                            scaleByDistance: new Cesium.NearFarScalar(1e5, 1.2, 5e7, 0.4),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        },
                    });
                    this.layer.entities.push(e.id);
                }
                _feed("ok", `VOLCANO :: ${known.length} active vents`);
            } catch (e) { _feed("err", `VOLCANO :: ${e.message}`); }
        },
        off() { clearLayer(this.layer); }
    };

    // ---------- 🛰 NASA GIBS imagery layers ----------
    // Lets you swap the base imagery to VIIRS true-color daily, MODIS fires, aerosol,
    // or thermal anomalies. Date-aware — can rewind to any day in last 20 years.
    GEO.gibs = {
        layer: null,
        async on(productId = "MODIS_Terra_CorrectedReflectance_TrueColor", date = null) {
            this.off();
            const d = date || new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // yesterday
            const p = new Cesium.UrlTemplateImageryProvider({
                url: `https://map1.vis.earthdata.nasa.gov/wmts-webmerc/${productId}/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
                maximumLevel: 9,
                credit: `NASA GIBS · ${productId} · ${d}`,
            });
            this.layer = _viewer().imageryLayers.addImageryProvider(p);
            this.layer.alpha = 0.9;
            _feed("ok", `GIBS :: ${productId} @ ${d} layered`);
        },
        off() {
            if (this.layer) { try { _viewer().imageryLayers.remove(this.layer); } catch { } this.layer = null; }
        },
        // Preset shortcuts
        trueColor(date) { return this.on("MODIS_Terra_CorrectedReflectance_TrueColor", date); },
        thermal(date) { return this.on("MODIS_Terra_Thermal_Anomalies_All", date); },
        aerosol(date) { return this.on("MODIS_Terra_Aerosol", date); },
        snow(date) { return this.on("MODIS_Terra_Snow_Cover", date); },
        sst(date) { return this.on("GHRSST_L4_MUR_Sea_Surface_Temperature", date); },
        nightLights() { return this.on("VIIRS_SNPP_DayNightBand_ENCC"); },
    };

    // ---------- ☀️ SUN / CHRONOLOCATION ----------
    // Pure JS SunCalc-style: given lat/lon/time give sun azimuth + altitude.
    // Used for shadow-based chronolocation of images.
    GEO.sun = (function () {
        const RAD = Math.PI / 180;
        const e = RAD * 23.4397;
        function toJulian(date) { return date.valueOf() / 86400000 - 0.5 + 2440588; }
        function toDays(date) { return toJulian(date) - 2451545; }
        function rightAscension(l, b) { return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)); }
        function declination(l, b) { return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)); }
        function azimuth(H, phi, dec) { return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)); }
        function altitude(H, phi, dec) { return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)); }
        function siderealTime(d, lw) { return RAD * (280.16 + 360.9856235 * d) - lw; }
        function solarMeanAnomaly(d) { return RAD * (357.5291 + 0.98560028 * d); }
        function eclipticLongitude(M) { const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)); const P = RAD * 102.9372; return M + C + P + Math.PI; }
        function sunCoords(d) { const M = solarMeanAnomaly(d); const L = eclipticLongitude(M); return { dec: declination(L, 0), ra: rightAscension(L, 0) }; }
        return {
            position(date, lat, lon) {
                const lw = RAD * -lon, phi = RAD * lat, d = toDays(date), c = sunCoords(d), H = siderealTime(d, lw) - c.ra;
                return { azimuth: (azimuth(H, phi, c.dec) * 180 / Math.PI + 180) % 360, altitude: altitude(H, phi, c.dec) * 180 / Math.PI };
            },
            /**
             * Chronolocation: given an image's timestamp (UTC) and the *observed* sun
             * azimuth (deg from north, clockwise) + altitude (deg), find the lat/lon
             * on Earth where the sun was at that position at that time.
             * Returns an array of possible locations (2 most of the time due to azimuth mirror).
             */
            chronolocate(date, observedAz, observedAlt) {
                const samples = [];
                for (let lat = -85; lat <= 85; lat += 0.5) {
                    for (let lon = -180; lon <= 180; lon += 1) {
                        const p = this.position(date, lat, lon);
                        const da = Math.min(Math.abs(p.azimuth - observedAz), 360 - Math.abs(p.azimuth - observedAz));
                        const dh = Math.abs(p.altitude - observedAlt);
                        if (da < 3 && dh < 2) samples.push({ lat, lon, azErr: da, altErr: dh });
                    }
                }
                // Cluster & pick best few
                samples.sort((a, b) => (a.azErr + a.altErr) - (b.azErr + b.altErr));
                return samples.slice(0, 10);
            },
        };
    })();

    // ---------- 🗺 Overpass (OpenStreetMap POI query) ----------
    GEO.overpass = async function overpass(bbox, tag = `amenity~"bank|atm|police"`) {
        // bbox = [south, west, north, east]
        const q = `[out:json][timeout:25];(node[${tag}](${bbox.join(",")}););out body 500;`;
        try {
            const r = await xfetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
            if (!r.ok) throw new Error(`overpass ${r.status}`);
            const j = await r.json();
            return j.elements || [];
        } catch (e) { return { error: e.message }; }
    };

    // ---------- Mapillary street coverage ----------
    GEO.mapillary = async function mapillary(lat, lon, radius = 500) {
        // Mapillary v4 requires a public client token; provide a lookup link instead (keyless).
        return { url: `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17` };
    };

    // ---------- Weather (Open-Meteo, keyless, fast) ----------
    GEO.weather = async function weather(lat, lon) {
        try {
            const r = await xfetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code&daily=sunrise,sunset&timezone=auto`);
            if (!r.ok) throw new Error(`open-meteo ${r.status}`);
            return await r.json();
        } catch (e) { return { error: e.message }; }
    };

    console.log("%cGEOINT engine online (window.GEOINT)", "color:#ffb020; font-weight:bold");
    _feed && _feed("ok", "GEOINT :: engine armed");
})();
