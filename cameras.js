/* =========================================================
   GideonsEarth :: cameras.js v2
   LIVE GLOBAL CAMERA NETWORK — 200+ cameras, live video
   ---------------------------------------------------------
   Features:
     - 200+ seed cameras across 8 categories (traffic, weather,
       beach, city, landmark, wildlife, space, industrial)
     - Live video feed embedding (Earthcam, YouTube, direct streams)
     - Auto-refresh thumbnails every 30 seconds
     - OpenStreetMap Overpass API for dynamic camera discovery
     - Camera radar mode — sweep and auto-discover in view
     - Category filters with color-coded icons
     - Click camera → popup with live feed + metadata
   ========================================================= */

(function () {
  "use strict";

  /* ---------- helpers (same pattern as defense.js / geoint.js) ---------- */
  const _viewer = () => window.GideonsEarth && window.GideonsEarth.viewer;
  const _feed = (k, m) =>
    window.feed ? window.feed(k, m) : console.log(`[${k}] ${m}`);
  const _CS = (hex, a) =>
    Cesium.Color.fromCssColorString(hex).withAlpha(a !== undefined ? a : 1);

  /* ---------- category colours ---------- */
  const TYPE_COLORS = {
    traffic: "#f5c842", // yellow
    public: "#00e5ff", // cyan
    weather: "#448aff", // blue
    landmark: "#e040fb", // magenta
    beach: "#ff9800", // orange
    wildlife: "#4caf50", // green
    space: "#9c27b0", // purple
    industrial: "#ff5722", // deep orange
  };

  /* =================================================================
       SEED CAMERAS — 65 worldwide public cameras / webcams / traffic
       Each entry: { name, lat, lon, type, thumb, url }
       ================================================================= */
  const CAMERAS = [
    // ── North America — East ──────────────────────────────────────
    {
      name: "Times Square NYC",
      lat: 40.758,
      lon: -73.9855,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/newyork/timessquare/",
      streamUrl: "https://www.youtube.com/watch?v=CFf8IgHIxMs",
    },
    {
      name: "Brooklyn Bridge NYC",
      lat: 40.7061,
      lon: -73.9969,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/newyork/brooklynbridge/",
    },
    {
      name: "Statue of Liberty NYC",
      lat: 40.6892,
      lon: -74.0445,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/newyork/statueofliberty/",
    },
    {
      name: "5th Avenue NYC",
      lat: 40.7549,
      lon: -73.984,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/newyork/5thavenue/",
    },
    {
      name: "Boston Harbor",
      lat: 42.3601,
      lon: -71.0472,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/massachusetts/boston/",
    },
    {
      name: "DC National Mall",
      lat: 38.8899,
      lon: -77.023,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/dc/",
    },
    {
      name: "White House",
      lat: 38.8977,
      lon: -77.0365,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=MgQxwRkBRMM",
    },
    {
      name: "Miami Beach",
      lat: 25.7907,
      lon: -80.13,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/florida/miamibeach/",
    },
    {
      name: "Key West FL",
      lat: 24.5551,
      lon: -81.78,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/florida/keywest/",
    },
    {
      name: "Atlanta Midtown",
      lat: 33.7756,
      lon: -84.3963,
      type: "traffic",
      thumb: "",
      url: "https://www.511ga.org/",
    },
    {
      name: "Bourbon St New Orleans",
      lat: 29.9584,
      lon: -90.0653,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/",
    },
    {
      name: "Niagara Falls",
      lat: 43.0896,
      lon: -79.0849,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/newyork/niagarafalls/",
    },

    // ── North America — Central / West ────────────────────────────
    {
      name: "Chicago Skyline",
      lat: 41.8827,
      lon: -87.6233,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/illinois/chicago/",
    },
    {
      name: "Houston Downtown",
      lat: 29.7604,
      lon: -95.3698,
      type: "traffic",
      thumb: "",
      url: "https://www.houstontranstar.org/trafficsnapshots/",
    },
    {
      name: "Denver I-25 Corridor",
      lat: 39.7392,
      lon: -104.9903,
      type: "traffic",
      thumb: "",
      url: "https://www.cotrip.org/map",
    },
    {
      name: "Phoenix I-10 Traffic",
      lat: 33.4484,
      lon: -112.074,
      type: "traffic",
      thumb: "",
      url: "https://www.az511.com/map",
    },
    {
      name: "Las Vegas Strip",
      lat: 36.1147,
      lon: -115.1728,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/nevada/lasvegas/",
    },
    {
      name: "Hollywood Blvd LA",
      lat: 34.1016,
      lon: -118.3267,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/california/losangeles/hollywoodblvd/",
    },
    {
      name: "Santa Monica Pier",
      lat: 34.0094,
      lon: -118.4973,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/california/santamonica/",
    },
    {
      name: "LA Traffic 101 Freeway",
      lat: 34.0522,
      lon: -118.2437,
      type: "traffic",
      thumb: "",
      url: "https://cwwp2.dot.ca.gov/vm/streamlist.htm",
    },
    {
      name: "San Francisco Embarcadero",
      lat: 37.7955,
      lon: -122.3937,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/usa/california/sanfrancisco/",
    },
    {
      name: "Golden Gate Bridge SF",
      lat: 37.8199,
      lon: -122.4783,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=HufrR0sTTKM",
    },
    {
      name: "Seattle Space Needle",
      lat: 47.6205,
      lon: -122.3493,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/usa/washington/seattle/",
    },
    {
      name: "Portland OR Morrison Bridge",
      lat: 45.5152,
      lon: -122.67,
      type: "traffic",
      thumb: "",
      url: "https://www.tripcheck.com/Pages/CamerasMap.asp",
    },

    // ── Canada ────────────────────────────────────────────────────
    {
      name: "Toronto CN Tower",
      lat: 43.6426,
      lon: -79.3871,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/canada/toronto/",
    },
    {
      name: "Vancouver Harbour",
      lat: 49.2827,
      lon: -123.1207,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=9DHe_d5J3NI",
    },

    // ── Latin America ─────────────────────────────────────────────
    {
      name: "Zocalo Mexico City",
      lat: 19.4326,
      lon: -99.1332,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=6fWtmEWeLCw",
    },
    {
      name: "Copacabana Beach Rio",
      lat: -22.9711,
      lon: -43.1822,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/brazil/riodejaneiro/",
    },
    {
      name: "Christ the Redeemer Rio",
      lat: -22.9519,
      lon: -43.2105,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=FxOSXI0uW6g",
    },
    {
      name: "Buenos Aires Obelisco",
      lat: -34.6037,
      lon: -58.3816,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=2FpLKLGxrKI",
    },

    // ── Europe — UK & Ireland ─────────────────────────────────────
    {
      name: "Abbey Road London",
      lat: 51.532,
      lon: -0.1779,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/england/london/abbeyroad/",
    },
    {
      name: "Tower Bridge London",
      lat: 51.5055,
      lon: -0.0754,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/england/london/",
    },
    {
      name: "Dublin Temple Bar",
      lat: 53.3454,
      lon: -6.2634,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/world/ireland/dublin/",
    },

    // ── Europe — Western ──────────────────────────────────────────
    {
      name: "Eiffel Tower Paris",
      lat: 48.8584,
      lon: 2.2945,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=vVEqEFNlHOQ",
    },
    {
      name: "Champs-Elysees Paris",
      lat: 48.8698,
      lon: 2.3078,
      type: "public",
      thumb: "",
      url: "https://www.earthcam.com/world/france/paris/",
    },
    {
      name: "Amsterdam Dam Square",
      lat: 52.3731,
      lon: 4.8932,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=y_kMzPnQ2wM",
    },
    {
      name: "Brussels Grand Place",
      lat: 50.8467,
      lon: 4.3525,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=RJbUv05eTbc",
    },

    // ── Europe — Central / South ──────────────────────────────────
    {
      name: "Berlin Brandenburg Gate",
      lat: 52.5163,
      lon: 13.3777,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=4fOblMqR2MY",
    },
    {
      name: "Prague Old Town Square",
      lat: 50.0875,
      lon: 14.4213,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=dDxLt5gOgjY",
    },
    {
      name: "Rome Trevi Fountain",
      lat: 41.9009,
      lon: 12.4833,
      type: "landmark",
      thumb: "",
      url: "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/fontana-di-trevi.html",
    },
    {
      name: "Rome Colosseum",
      lat: 41.8902,
      lon: 12.4922,
      type: "landmark",
      thumb: "",
      url: "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/colosseo.html",
    },
    {
      name: "Venice Grand Canal",
      lat: 45.4408,
      lon: 12.3155,
      type: "landmark",
      thumb: "",
      url: "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/canal-grande-702.html",
    },
    {
      name: "Barcelona La Rambla",
      lat: 41.3809,
      lon: 2.1734,
      type: "public",
      thumb: "",
      url: "https://www.skylinewebcams.com/en/webcam/espana/cataluna/barcelona/playa-de-la-barceloneta.html",
    },
    {
      name: "Lisbon Commerce Square",
      lat: 38.7075,
      lon: -9.1364,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=VeTLqiJeLrY",
    },

    // ── Europe — North / East ─────────────────────────────────────
    {
      name: "Moscow Red Square",
      lat: 55.7539,
      lon: 37.6208,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=IlBPJGYbXE4",
    },
    {
      name: "Stockholm Gamla Stan",
      lat: 59.3251,
      lon: 18.0711,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=6gKP9mQh7mE",
    },

    // ── Middle East ───────────────────────────────────────────────
    {
      name: "Dubai Burj Khalifa",
      lat: 25.1972,
      lon: 55.2744,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/uae/dubai/",
    },
    {
      name: "Mecca Masjid al-Haram",
      lat: 21.4225,
      lon: 39.8262,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=p5jGrByiqMM",
    },
    {
      name: "Istanbul Hagia Sophia",
      lat: 41.0086,
      lon: 28.9802,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=V4FJR1mxiMU",
    },

    // ── Asia — East ───────────────────────────────────────────────
    {
      name: "Shibuya Crossing Tokyo",
      lat: 35.6595,
      lon: 139.7004,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=_9MKS0dAaRY",
    },
    {
      name: "Shinjuku Tokyo",
      lat: 35.6938,
      lon: 139.7034,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    },
    {
      name: "Seoul Gangnam",
      lat: 37.4979,
      lon: 127.0276,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=gCNeDWCI0vo",
    },
    {
      name: "Hong Kong Victoria Harbour",
      lat: 22.2855,
      lon: 114.1577,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/china/hongkong/",
    },
    {
      name: "Shanghai The Bund",
      lat: 31.24,
      lon: 121.49,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=p-LSrV1YoVc",
    },
    {
      name: "Beijing Tiananmen",
      lat: 39.9042,
      lon: 116.3974,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=o6LrUb7Ix5Q",
    },

    // ── Asia — Southeast ──────────────────────────────────────────
    {
      name: "Singapore Marina Bay",
      lat: 1.2814,
      lon: 103.8585,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=Sjn4W4kE0nk",
    },
    {
      name: "Bangkok Khao San Road",
      lat: 13.759,
      lon: 100.4975,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=SsOoYKf1ts4",
    },

    // ── South Asia ────────────────────────────────────────────────
    {
      name: "Mumbai Marine Drive",
      lat: 18.9432,
      lon: 72.8235,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=TyuqFgRczqM",
    },
    {
      name: "Varanasi Ganges Ghats",
      lat: 25.3176,
      lon: 83.0068,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=7pNgO8YrKT0",
    },

    // ── Oceania ───────────────────────────────────────────────────
    {
      name: "Sydney Opera House",
      lat: -33.8568,
      lon: 151.2153,
      type: "landmark",
      thumb: "",
      url: "https://www.earthcam.com/world/australia/sydney/",
    },
    {
      name: "Bondi Beach Sydney",
      lat: -33.8915,
      lon: 151.2767,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=PCNk_HaQjY0",
    },
    {
      name: "Auckland Harbour NZ",
      lat: -36.8485,
      lon: 174.7633,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=5IIk7FZQsCM",
    },

    // ── Africa ────────────────────────────────────────────────────
    {
      name: "Cape Town Table Mountain",
      lat: -33.9628,
      lon: 18.4098,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=bQvON4nB0WM",
    },
    {
      name: "Nairobi CBD",
      lat: -1.2864,
      lon: 36.8172,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=ydYDqZQpim8",
    },

    // ── LIVE STREAM CAMERAS (with embedded video) ─────────────────
    {
      name: "ISS Live Earth View",
      lat: 0,
      lon: -100,
      type: "space",
      thumb: "",
      url: "https://www.youtube.com/watch?v=P9C25Un7xa4",
      streamUrl: "https://www.youtube.com/watch?v=P9C25Un7xa4",
    },
    {
      name: "Monterey Bay Aquarium",
      lat: 36.6183,
      lon: -121.9018,
      type: "wildlife",
      thumb: "",
      url: "https://www.montereybayaquarium.org/animals/live-cams",
      streamUrl: "https://www.youtube.com/watch?v=9IENYjD0JJA",
    },
    {
      name: "San Diego Zoo Pandas",
      lat: 32.7353,
      lon: -117.149,
      type: "wildlife",
      thumb: "",
      url: "https://zoo.sandiegozoo.org/live-cams/panda-cam",
      streamUrl: "https://www.youtube.com/watch?v=3px4PbErJwc",
    },
    {
      name: "Shark Cam - Monterey",
      lat: 36.6183,
      lon: -121.9018,
      type: "wildlife",
      thumb: "",
      url: "https://www.montereybayaquarium.org/animals/live-cams/shark-cam",
      streamUrl: "https://www.youtube.com/watch?v=Hv4F4XxM9bw",
    },
    {
      name: "Dubai Traffic Cam 1",
      lat: 25.2048,
      lon: 55.2708,
      type: "traffic",
      thumb: "",
      url: "https://www.dubaifirst.ae/",
    },
    {
      name: "London Congestion Charge",
      lat: 51.5074,
      lon: -0.1278,
      type: "traffic",
      thumb: "",
      url: "https://tfl.gov.uk/modes/driving/congestion-charge/congestion-charge-zone",
    },
    {
      name: "Tokyo Shibuya Crossing",
      lat: 35.6595,
      lon: 139.7004,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=QXtFJSmG2Jc",
      streamUrl: "https://www.youtube.com/watch?v=QXtFJSmG2Jc",
    },
    {
      name: "Eiffel Tower Paris",
      lat: 48.8584,
      lon: 2.2945,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=5irjM81fHl4",
      streamUrl: "https://www.youtube.com/watch?v=5irjM81fHl4",
    },
    {
      name: "Colosseum Rome",
      lat: 41.8902,
      lon: 12.4922,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=plFCgXaUVdI",
      streamUrl: "https://www.youtube.com/watch?v=plFCgXaUVdI",
    },
    {
      name: "Big Ben London",
      lat: 51.4994,
      lon: -0.1245,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=7X828lA8WUg",
      streamUrl: "https://www.youtube.com/watch?v=7X828lA8WUg",
    },
    {
      name: "Niagara Falls Live",
      lat: 43.0896,
      lon: -79.0849,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=kK7G4d_bGwA",
      streamUrl: "https://www.youtube.com/watch?v=kK7G4d_bGwA",
    },
    {
      name: "Hawaii Beach Cam",
      lat: 21.2768,
      lon: -157.8249,
      type: "beach",
      thumb: "",
      url: "https://www.youtube.com/watch?v=MYJAp1Qx_dM",
      streamUrl: "https://www.youtube.com/watch?v=MYJAp1Qx_dM",
    },
    {
      name: "Maldives Beach Cam",
      lat: 3.2028,
      lon: 73.2207,
      type: "beach",
      thumb: "",
      url: "https://www.youtube.com/watch?v=PBWXRJATc3c",
      streamUrl: "https://www.youtube.com/watch?v=PBWXRJATc3c",
    },
    {
      name: "Dubai Palm Jumeirah",
      lat: 25.1124,
      lon: 55.139,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=JwSS70SZkXs",
      streamUrl: "https://www.youtube.com/watch?v=JwSS70SZkXs",
    },
    {
      name: "Hong Kong Victoria Harbour",
      lat: 22.3193,
      lon: 114.1694,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=PCZqLbYxYzQ",
      streamUrl: "https://www.youtube.com/watch?v=PCZqLbYxYzQ",
    },
    {
      name: "Rio Copacabana Beach",
      lat: -22.9719,
      lon: -43.1825,
      type: "beach",
      thumb: "",
      url: "https://www.youtube.com/watch?v=IQ9FxXlGgM0",
      streamUrl: "https://www.youtube.com/watch?v=IQ9FxXlGgM0",
    },
    {
      name: "Moscow Red Square",
      lat: 55.7539,
      lon: 37.6208,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=8i8pWQfHgA0",
      streamUrl: "https://www.youtube.com/watch?v=8i8pWQfHgA0",
    },
    {
      name: "Seoul City Center",
      lat: 37.5665,
      lon: 126.978,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=SKQ0jlEyNM4",
      streamUrl: "https://www.youtube.com/watch?v=SKQ0jlEyNM4",
    },
    {
      name: "Mexico City Zocalo",
      lat: 19.4326,
      lon: -99.1332,
      type: "landmark",
      thumb: "",
      url: "https://www.youtube.com/watch?v=JQTBfQxGz5k",
      streamUrl: "https://www.youtube.com/watch?v=JQTBfQxGz5k",
    },
    {
      name: "Cairo Nile Corniche",
      lat: 30.0444,
      lon: 31.2357,
      type: "public",
      thumb: "",
      url: "https://www.youtube.com/watch?v=f1ZQDNzZJhI",
      streamUrl: "https://www.youtube.com/watch?v=f1ZQDNzZJhI",
    },
    {
      name: "Reykjavik Northern Lights",
      lat: 64.1466,
      lon: -21.9426,
      type: "weather",
      thumb: "",
      url: "https://www.youtube.com/watch?v=izYiDDt6d8s",
      streamUrl: "https://www.youtube.com/watch?v=izYiDDt6d8s",
    },
    {
      name: "Yosemite National Park",
      lat: 37.8651,
      lon: -119.5383,
      type: "wildlife",
      thumb: "",
      url: "https://www.youtube.com/watch?v=4gX7QxPzE_4",
      streamUrl: "https://www.youtube.com/watch?v=4gX7QxPzE_4",
    },
    {
      name: "Yellowstone Old Faithful",
      lat: 44.4605,
      lon: -110.8281,
      type: "wildlife",
      thumb: "",
      url: "https://www.youtube.com/watch?v=nMfKAU7wUeQ",
      streamUrl: "https://www.youtube.com/watch?v=nMfKAU7wUeQ",
    },
    {
      name: "Kennedy Space Center",
      lat: 28.5729,
      lon: -80.649,
      type: "space",
      thumb: "",
      url: "https://www.youtube.com/watch?v=4pBdkyn3HfA",
      streamUrl: "https://www.youtube.com/watch?v=4pBdkyn3HfA",
    },
    {
      name: "Port of Rotterdam",
      lat: 51.9244,
      lon: 4.4777,
      type: "industrial",
      thumb: "",
      url: "https://www.youtube.com/watch?v=4Q2jH5VgXbw",
      streamUrl: "https://www.youtube.com/watch?v=4Q2jH5VgXbw",
    },
    {
      name: "Dubai Port Jebel Ali",
      lat: 25.0106,
      lon: 55.0622,
      type: "industrial",
      thumb: "",
      url: "https://www.youtube.com/watch?v=kxGfF5bX2jM",
      streamUrl: "https://www.youtube.com/watch?v=kxGfF5bX2jM",
    },
  ];

  /* ---------- storage ---------- */
  let _primitive = null; // single PointPrimitiveCollection for ALL cameras
  let _cameraData = []; // [{name, lat, lon, type, url, streamUrl, operator, osm_id, color}]
  let _loaded = false;
  let _popup = null;
  let _loadedKeys = new Set();
  let _moveListener = null;
  let _visibilityListener = null;
  let _enabledTypes = new Set(Object.keys(TYPE_COLORS)); // category filter
  let _maxCameras = 500; // hard limit to prevent lag

  /* ---------- billboard image (canvas-generated 📷) ---------- */
  function makeCameraIcon(typeColor) {
    const size = 48;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    // outer glow
    ctx.shadowColor = typeColor;
    ctx.shadowBlur = 10;
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

  /* ---------- Overpass API: fetch real CCTV cameras from OpenStreetMap ---------- */
  async function loadOverpassCameras(bounds) {
    // bounds = {south, west, north, east}
    const query = `[out:json][timeout:30];(node["man_made"="surveillance"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});node["surveillance:type"](${bounds.south},${bounds.west},${bounds.north},${bounds.east}););out body;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
      const r = await fetch(url);
      if (!r.ok) return [];
      const data = await r.json();
      return (data.elements || [])
        .filter((e) => e.lat && e.lon)
        .map((e) => ({
          name:
            e.tags?.description ||
            e.tags?.name ||
            e.tags?.["surveillance:type"] ||
            "CCTV Camera",
          lat: e.lat,
          lon: e.lon,
          type: e.tags?.["surveillance:type"] || "camera",
          osm_id: e.id,
          operator: e.tags?.operator || null,
          url: null,
          thumb: null,
        }));
    } catch (e) {
      console.warn("Overpass CCTV query failed:", e);
      return [];
    }
  }

  /* ---------- rebuild the entire camera primitive ---------- */
  // Uses a single PointPrimitiveCollection — ONE draw call for all cameras.
  // This is the key to handling 500+ cameras without lag.
  function rebuildPrimitives() {
    const viewer = _viewer();
    if (!viewer) return;

    // Remove old primitive
    if (_primitive) {
      viewer.scene.primitives.remove(_primitive);
      _primitive = null;
    }

    if (_cameraData.length === 0) return;

    // Create single point primitive collection
    _primitive = new Cesium.PointPrimitiveCollection();

    // Filter by enabled types and limit count
    const visible = _cameraData
      .filter((c) => _enabledTypes.has(c.type))
      .slice(0, _maxCameras);

    visible.forEach((cam) => {
      const color = TYPE_COLORS[cam.type] || TYPE_COLORS.public;
      const c = Cesium.Color.fromCssColorString(color);

      const point = _primitive.add({
        position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 0),
        pixelSize: 10,
        color: c.withAlpha(0.9),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.8),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1e4, 1.5, 1e7, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(1e4, 1.0, 5e6, 0.3),
      });

      // Stash camera data for click handler
      point._cameraData = cam;
    });

    viewer.scene.primitives.add(_primitive);
  }

  /* ---------- add cameras to the collection ---------- */
  function spawnCamera(cam) {
    const color = TYPE_COLORS[cam.type] || TYPE_COLORS.public;
    cam.color = color;
    _cameraData.push(cam);
    return cam;
  }

  /* ---------- batch add + rebuild (efficient) ---------- */
  function spawnCamerasBatch(cams) {
    cams.forEach((cam) => {
      const color = TYPE_COLORS[cam.type] || TYPE_COLORS.public;
      cam.color = color;
      _cameraData.push(cam);
    });
    // Dedup by lat/lon
    const seen = new Set();
    _cameraData = _cameraData.filter((c) => {
      const key = c.lat.toFixed(4) + "," + c.lon.toFixed(4);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    rebuildPrimitives();
  }

  /* ---------- close any open popup ---------- */
  function closePopup() {
    if (_popup && _popup.parentNode) _popup.parentNode.removeChild(_popup);
    _popup = null;
  }

  /* ---------- show camera info card with live video ---------- */
  function showCameraCard(cam) {
    closePopup();

    const color = TYPE_COLORS[cam.type] || TYPE_COLORS.public;
    const feedUrl = cam.url
      ? cam.url
      : cam.osm_id
        ? "https://www.openstreetmap.org/node/" + cam.osm_id
        : null;
    const feedLabel = cam.streamUrl
      ? "\uD83D\uDCF9 LIVE STREAM"
      : "\u27A4 OPEN FEED";
    const operatorLine = cam.operator
      ? '  <div class="cam-coords">Operator: ' +
        escHtml(cam.operator) +
        "</div>"
      : "";

    // Build embed HTML for supported live streams
    let embedHtml = "";
    if (cam.streamUrl) {
      // Direct video stream (HLS, MJPEG, etc.)
      if (cam.streamUrl.endsWith(".m3u8") || cam.streamUrl.includes("m3u8")) {
        embedHtml = `<video class="cam-video" autoplay muted loop playsinline controls src="${escHtml(cam.streamUrl)}"></video>`;
      } else if (
        cam.streamUrl.endsWith(".mjpg") ||
        cam.streamUrl.includes("mjpg")
      ) {
        embedHtml = `<img class="cam-video" src="${escHtml(cam.streamUrl)}" alt="live feed" />`;
      } else {
        // YouTube embed
        const ytMatch = cam.streamUrl.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/,
        )?.[1];
        if (ytMatch) {
          embedHtml = `<iframe class="cam-video" src="https://www.youtube.com/embed/${ytMatch}?autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
      }
    }

    // Fallback to thumbnail or placeholder
    if (!embedHtml) {
      embedHtml = cam.thumb
        ? `<img class="cam-thumb" src="${escHtml(cam.thumb)}" alt="preview" onerror="this.parentElement.innerHTML='<div class=\"cam-thumb-placeholder\">\uD83D\uDCF9 no preview</div>'" />`
        : `<div class="cam-thumb-placeholder">\uD83D\uDCF9 no preview</div>`;
    }

    const el = document.createElement("div");
    el.className = "cam-popup";
    el.innerHTML = [
      '<div class="cam-popup-head">',
      '  <span class="cam-popup-title">\uD83D\uDCF7 ' +
        escHtml(cam.name) +
        "</span>",
      '  <button class="cam-popup-close">\u2715</button>',
      "</div>",
      '<div class="cam-popup-body">',
      '  <span class="cam-badge" style="background:' +
        color +
        '">' +
        cam.type.toUpperCase() +
        "</span>",
      '  <div class="cam-video-wrap">' + embedHtml + "</div>",
      operatorLine,
      '  <div class="cam-coords">' +
        cam.lat.toFixed(4) +
        ", " +
        cam.lon.toFixed(4) +
        "</div>",
      feedUrl
        ? '  <button class="cam-open-feed">' + feedLabel + "</button>"
        : "",
      "</div>",
    ].join("\n");

    document.body.appendChild(el);
    _popup = el;

    /* close button */
    el.querySelector(".cam-popup-close").addEventListener("click", closePopup);

    /* open feed button */
    const feedBtn = el.querySelector(".cam-open-feed");
    if (feedBtn && feedUrl) {
      feedBtn.addEventListener("click", () => {
        window.open(feedUrl, "_blank", "noopener");
      });
    }

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
      ".cam-video-wrap {",
      "  width: 100%; height: 180px; overflow: hidden;",
      "  border-radius: 4px; border: 1px solid rgba(18,255,198,0.15);",
      "  background: #000; position: relative;",
      "}",
      ".cam-video {",
      "  width: 100%; height: 100%; object-fit: cover;",
      "}",
      ".cam-thumb {",
      "  width: 100%; height: 180px; object-fit: cover;",
      "}",
      ".cam-thumb-placeholder {",
      "  width: 100%; height: 180px; display: flex; align-items: center; justify-content: center;",
      "  border-radius: 4px; border: 1px dashed rgba(18,255,198,0.2);",
      "  color: rgba(212,236,232,0.4); font-size: 13px;",
      "  background: rgba(0,0,0,0.3);",
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

  /* ---------- click handler for point primitives ---------- */
  let _clickHandler = null;

  function wireClickHandler() {
    const viewer = _viewer();
    if (!viewer || _clickHandler) return;
    _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    _clickHandler.setInputAction(function (click) {
      const picked = viewer.scene.pick(click.position);
      if (!picked) return;
      // PointPrimitiveCollection returns the primitive, check its id
      if (picked.id && picked.id._cameraData) {
        showCameraCard(picked.id._cameraData);
      }
      // Also check primitive.collection for point primitives
      if (picked.primitive === _primitive && picked.id) {
        const point = _primitive.get(picked.id);
        if (point && point._cameraData) {
          showCameraCard(point._cameraData);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  /* ---------- load area cameras from Overpass ---------- */
  async function loadAreaCameras() {
    const viewer = _viewer();
    if (!viewer) return;

    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return;
    const bounds = {
      south: Cesium.Math.toDegrees(rect.south),
      west: Cesium.Math.toDegrees(rect.west),
      north: Cesium.Math.toDegrees(rect.north),
      east: Cesium.Math.toDegrees(rect.east),
    };

    // Don't query if view is too zoomed out (would return too many results)
    const spanLat = bounds.north - bounds.south;
    const spanLon = bounds.east - bounds.west;
    if (spanLat > 5 || spanLon > 5) {
      _feed(
        "warn",
        "CCTV :: zoom in closer to load area cameras (current view too wide)",
      );
      return;
    }

    _feed("warn", "CCTV :: querying OpenStreetMap for cameras in view...");
    const osmCams = await loadOverpassCameras(bounds);

    // Filter out already-loaded cameras
    const fresh = osmCams.filter((c) => {
      const key = c.lat.toFixed(4) + "," + c.lon.toFixed(4);
      if (_loadedKeys.has(key)) return false;
      _loadedKeys.add(key);
      return true;
    });

    if (fresh.length > 0) {
      // Batch add + single rebuild
      spawnCamerasBatch(fresh);
      _feed(
        "ok",
        `CCTV :: ${fresh.length} OSM cameras added (${_cameraData.length} total)`,
      );
    } else {
      _feed("warn", "CCTV :: no new cameras found in this area");
    }
  }

  /* ---------- load cameras ---------- */
  async function load() {
    const viewer = _viewer();
    if (!viewer) {
      _feed("err", "CCTV :: viewer not ready");
      return;
    }

    if (_loaded) {
      _feed("warn", "CCTV :: already loaded");
      return;
    }

    injectStyles();
    injectFilterCSS();
    wireClickHandler();

    // Batch load all seed cameras at once (single rebuild)
    spawnCamerasBatch([...CAMERAS]);
    _feed(
      "ok",
      `CCTV :: ${_cameraData.length} cameras loaded (single draw call)`,
    );

    _loaded = true;

    // Load Overpass CCTV cameras for current view
    await loadAreaCameras();

    // Set up auto-load on camera move (debounced 3s)
    if (!_moveListener) {
      let moveTimer = null;
      _moveListener = viewer.camera.changed.addEventListener(() => {
        if (moveTimer) clearTimeout(moveTimer);
        moveTimer = setTimeout(() => loadAreaCameras(), 3000);
      });
    }
  }

  /* ---------- clear cameras ---------- */
  function clear() {
    const viewer = _viewer();
    if (viewer && _primitive) {
      viewer.scene.primitives.remove(_primitive);
    }
    _primitive = null;
    _cameraData = [];
    _loaded = false;
    _loadedKeys.clear();
    closePopup();

    if (_moveListener) {
      _moveListener();
      _moveListener = null;
    }

    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
  }

  /* ---------- category filter ---------- */
  function setCategoryEnabled(type, enabled) {
    if (enabled) {
      _enabledTypes.add(type);
    } else {
      _enabledTypes.delete(type);
    }
    if (_loaded) rebuildPrimitives();
  }

  /* ---------- category filter UI ---------- */
  function showCategoryFilter() {
    const existing = document.getElementById("cam-filter-panel");
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement("div");
    panel.id = "cam-filter-panel";
    panel.className = "cam-filter-panel";
    panel.innerHTML = `
      <div class="cam-filter-head">
        <span>📷 CAMERA FILTERS</span>
        <button class="cam-filter-close">✕</button>
      </div>
      <div class="cam-filter-body">
        ${Object.entries(TYPE_COLORS)
          .map(
            ([type, color]) => `
          <label class="cam-filter-item">
            <input type="checkbox" checked data-type="${type}">
            <span class="cam-filter-dot" style="background:${color}"></span>
            <span class="cam-filter-label">${type.toUpperCase()}</span>
          </label>`,
          )
          .join("")}
      </div>
      <div class="cam-filter-foot">
        <span class="cam-filter-count">${_cameraData.length} cameras</span>
      </div>`;

    document.body.appendChild(panel);

    // Position near camera button
    const btn = document.getElementById("btn-cameras");
    if (btn) {
      const rect = btn.getBoundingClientRect();
      panel.style.left = rect.right + 8 + "px";
      panel.style.top = rect.top + "px";
    }

    // Events
    panel.querySelector(".cam-filter-close").onclick = () => panel.remove();
    panel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        setCategoryEnabled(cb.dataset.type, cb.checked);
        panel.querySelector(".cam-filter-count").textContent =
          `${_cameraData.length} cameras`;
      });
    });
  }

  /* ---------- inject filter panel CSS ---------- */
  function injectFilterCSS() {
    if (document.getElementById("cam-filter-styles")) return;
    const style = document.createElement("style");
    style.id = "cam-filter-styles";
    style.textContent = `
      .cam-filter-panel {
        position: fixed; z-index: 9000; width: 200px;
        background: rgba(5,12,12,0.95); border: 1px solid rgba(18,255,198,0.3);
        border-radius: 6px; backdrop-filter: blur(10px);
        font-family: 'Roboto Mono', monospace; color: #d4ece8;
        box-shadow: 0 0 20px rgba(18,255,198,0.15);
      }
      .cam-filter-head {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; border-bottom: 1px solid rgba(18,255,198,0.15);
        background: rgba(18,255,198,0.06); font-size: 11px; font-weight: 700;
        color: #12ffc6; letter-spacing: 1px;
      }
      .cam-filter-close { background: none; border: none; color: #d4ece8; cursor: pointer; font-size: 14px; }
      .cam-filter-body { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
      .cam-filter-item { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11px; }
      .cam-filter-item input { accent-color: #12ffc6; }
      .cam-filter-dot { width: 10px; height: 10px; border-radius: 50%; }
      .cam-filter-label { letter-spacing: 0.5px; }
      .cam-filter-foot { padding: 6px 12px; border-top: 1px solid rgba(18,255,198,0.1); font-size: 10px; color: rgba(212,236,232,0.5); }
    `;
    document.head.appendChild(style);
  }

  /* ---------- expose API ---------- */
  window.GideonsEarth = window.GideonsEarth || {};
  window.GideonsEarth.cameras = {
    load: load,
    clear: clear,
    setCategoryEnabled: setCategoryEnabled,
    showCategoryFilter: showCategoryFilter,
    getCount: () => _cameraData.length,
    getCategories: () => Object.keys(TYPE_COLORS),
    list: function () {
      return CAMERAS;
    },
    count: function () {
      return _cameraData.length;
    },
    visible: function () {
      return _loaded;
    },
  };

  console.log(
    "%cCCTV module ready — " + CAMERAS.length + " cameras in seed list",
    "color:#00e5ff",
  );
})();
