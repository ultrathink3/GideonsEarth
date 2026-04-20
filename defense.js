/* =========================================================
   GideonsEarth :: defense.js
   GIDEON DEFENSE GRID — Asteroid defense arcade, cinematic.
   ---------------------------------------------------------
   PLAYER SHIP (cyan gunship, orbit, WASD/arrows + SPACE to fire)
     - WASD / ARROWS  ➜  strafe E/W + N/S in orbital plane
     - SPACE / CLICK  ➜  dual-laser burst → nearest meteor in view
     - P              ➜  pause    · ESC ➜ exit
     - Engine glow trail + chase-cam
   CINEMATIC FX
     - Fullscreen wave-banner ("WAVE 2 — INCOMING")
     - Particle shower on every meteor kill (glowing shards)
     - Energy-shield bubble around Earth (flashes on impact)
     - WebAudio beeps : laser / explosion / power-up / wave / game-over
   GAMEPLAY
     - Waves (speed + spawn rate ramp)
     - BOSS meteors (3 HP, 500 pts)
     - Combo ×1 → ×10 (resets on miss or impact)
     - Power-ups : 🛡 SHIELD · ⏱ SLOW-MO · 💥 NUKE
     - Earth HP 10 → 0 = EARTH DESTROYED
     - Top-10 leaderboard with name sign-in, persistent
   ========================================================= */

(function () {
    window.DEFENSE = window.DEFENSE || {};
    const D = window.DEFENSE;

    const _viewer = () => window.GideonsEarth && window.GideonsEarth.viewer;
    const _feed = (k, m) => (window.feed ? window.feed(k, m) : console.log(`[${k}] ${m}`));
    const _CS = (hex, a = 1) => Cesium.Color.fromCssColorString(hex).withAlpha(a);

    const EARTH_R = 6378137;
    const SPAWN_R = 28_000_000;
    const IMPACT_R = EARTH_R + 80_000;
    const SHIP_ORBIT_R = EARTH_R + 2_500_000;   // 2,500 km orbit
    const MAX_HP = 10;
    const AIM_ASSIST_PX = 50;

    // ---------- WebAudio engine ----------
    // Single shared AudioContext, unlocked on first user gesture.
    let _ac = null;
    function ac() {
        if (!_ac) {
            try { _ac = new (window.AudioContext || window.webkitAudioContext)(); }
            catch { _ac = null; }
        }
        return _ac;
    }
    function beep(freq, dur = 0.12, type = "square", vol = 0.08, slideTo = null) {
        const c = ac(); if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime);
        if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
        gain.gain.setValueAtTime(vol, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(); osc.stop(c.currentTime + dur);
    }
    function sfxLaser() { beep(1400, 0.08, "sawtooth", 0.06, 500); }
    function sfxExplode() { beep(90, 0.28, "square", 0.12, 30); beep(180, 0.12, "triangle", 0.06, 40); }
    function sfxPower() { beep(520, 0.09, "triangle", 0.08, 880); beep(880, 0.1, "triangle", 0.06, 1320); }
    function sfxWave() { beep(330, 0.18, "square", 0.08, 220); setTimeout(() => beep(440, 0.18, "square", 0.08, 330), 180); }
    function sfxGameOver() { beep(220, 0.4, "sawtooth", 0.14, 55); setTimeout(() => beep(110, 0.6, "sawtooth", 0.14, 40), 350); }
    function sfxShipHit() { beep(120, 0.12, "square", 0.1, 60); }

    // ---------- State ----------
    D.state = {
        running: false,
        paused: false,
        score: 0,
        hp: MAX_HP,
        combo: 1,
        comboMax: 1,
        waves: 0,
        meteors: [],
        shield: 0,
        slowUntil: 0,
        spawnTimer: null,
        best: +(localStorage.getItem("gi:defense:best") || 0),
        // Ship
        ship: null,           // { lat, lon, head, vLat, vLon, entity, engineTrail, ... }
    };

    // ---------- DOM HUD ----------
    let hud;
    function buildHUD() {
        if (hud) return;
        hud = document.createElement("div");
        hud.id = "def-hud";
        hud.innerHTML = `
      <div class="def-title">GIDEON <span class="accent">DEFENSE</span> GRID</div>
      <div class="def-row"><span>SCORE</span><span id="def-score">0</span></div>
      <div class="def-row"><span>COMBO</span><span id="def-combo">×1</span></div>
      <div class="def-row"><span>BEST</span><span id="def-best">${D.state.best}</span></div>
      <div class="def-row"><span>WAVE</span><span id="def-wave">0</span></div>
      <div class="def-hp-wrap">
        <div class="def-hp-label">EARTH INTEGRITY</div>
        <div class="def-hp-bar"><div class="def-hp-fill" id="def-hp"></div></div>
      </div>
      <div class="def-power" id="def-power"></div>
      <div class="def-help">
        <b>W / S</b> thrust · <b>A / D</b> yaw (turn) · <b>SPACE</b> fire<br>
        CLICK to aim-fire · <b>P</b> pause · <b>ESC</b> exit
      </div>
      <div class="def-crosshair" id="def-cross">+</div>
      <div class="def-flash" id="def-flash"></div>
      <div class="def-wave-banner" id="def-wave-banner"></div>
    `;
        document.body.appendChild(hud);
        hud.classList.add("hidden");
    }

    function setHUD() {
        document.getElementById("def-score").textContent = D.state.score.toLocaleString();
        document.getElementById("def-combo").textContent = `×${D.state.combo}`;
        document.getElementById("def-best").textContent = D.state.best.toLocaleString();
        document.getElementById("def-wave").textContent = D.state.waves;
        const pct = Math.max(0, (D.state.hp / MAX_HP) * 100);
        const hpEl = document.getElementById("def-hp");
        hpEl.style.width = pct + "%";
        hpEl.style.background = pct > 60 ? "var(--accent)" : pct > 30 ? "var(--amber)" : "var(--danger)";
        const pwr = document.getElementById("def-power");
        const parts = [];
        if (D.state.shield > 0) parts.push(`🛡 SHIELD×${D.state.shield}`);
        if (D.state.slowUntil > Date.now()) parts.push("⏱ SLOW-MO");
        pwr.textContent = parts.join(" · ");
    }

    function flash(color = "rgba(255,46,110,.25)", ms = 160) {
        const f = document.getElementById("def-flash");
        if (!f) return;
        f.style.background = color;
        f.classList.add("on");
        setTimeout(() => f.classList.remove("on"), ms);
    }

    function waveBanner(text, subtitle = "") {
        const b = document.getElementById("def-wave-banner");
        if (!b) return;
        b.innerHTML = `<div class="def-wave-text">${text}</div>${subtitle ? `<div class="def-wave-sub">${subtitle}</div>` : ""}`;
        b.classList.remove("on");
        // Force reflow then animate
        void b.offsetWidth;
        b.classList.add("on");
        setTimeout(() => b.classList.remove("on"), 1800);
    }

    // ---------- Meteor spawning ----------
    let meteorId = 0;
    function spawnMeteor(big = false) {
        const viewer = _viewer();
        if (!viewer) return;
        const id = ++meteorId;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const sx = SPAWN_R * Math.sin(phi) * Math.cos(theta);
        const sy = SPAWN_R * Math.sin(phi) * Math.sin(theta);
        const sz = SPAWN_R * Math.cos(phi);
        const pos = new Cesium.Cartesian3(sx, sy, sz);

        const jitter = EARTH_R * 0.7;
        const target = new Cesium.Cartesian3(
            (Math.random() - 0.5) * jitter * 2,
            (Math.random() - 0.5) * jitter * 2,
            (Math.random() - 0.5) * jitter * 2);

        const dir = Cesium.Cartesian3.subtract(target, pos, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(dir, dir);
        const baseSpeed = 400_000 + D.state.waves * 50_000;
        const speed = big ? baseSpeed * 0.75 : baseSpeed * (0.9 + Math.random() * 0.4);
        const vel = Cesium.Cartesian3.multiplyByScalar(dir, speed, new Cesium.Cartesian3());

        const color = big ? _CS("#ff2e6e") : _CS("#ff7a2e");
        const entity = viewer.entities.add({
            position: pos.clone(),
            ellipsoid: {
                radii: big ? new Cesium.Cartesian3(400_000, 350_000, 380_000) : new Cesium.Cartesian3(180_000, 150_000, 160_000),
                material: color.withAlpha(0.85),
                outline: true,
                outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
            },
            point: { pixelSize: big ? 14 : 8, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
            label: big ? {
                text: "☄ BOSS",
                font: "bold 11px JetBrains Mono, monospace",
                fillColor: _CS("#ff2e6e"),
                outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(14, -8),
            } : undefined,
        });

        const trailPts = [pos.clone()];
        const trail = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => trailPts, false),
                width: big ? 4 : 2,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.5, color: color.withAlpha(0.85),
                }),
                arcType: Cesium.ArcType.NONE,
            },
        });

        const meteor = { id, entity, trail, trailPts, pos, vel, big, hp: big ? 3 : 1, score: big ? 500 : 100 };
        D.state.meteors.push(meteor);
        return meteor;
    }

    function removeMeteor(meteor) {
        const viewer = _viewer();
        try { viewer.entities.remove(meteor.entity); } catch { }
        try { viewer.entities.remove(meteor.trail); } catch { }
        const idx = D.state.meteors.indexOf(meteor);
        if (idx >= 0) D.state.meteors.splice(idx, 1);
    }

    // ---------- VFX ----------
    function explode(position, color = "#ffb020", scale = 1) {
        const viewer = _viewer();
        const start = Date.now();
        const dur = 700;
        const e = viewer.entities.add({
            position,
            ellipsoid: {
                radii: new Cesium.CallbackProperty(() => {
                    const t = (Date.now() - start) / dur;
                    const r = (1 + t * 4) * 200_000 * scale;
                    return new Cesium.Cartesian3(r, r, r);
                }, false),
                material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
                    const t = Math.min(1, (Date.now() - start) / dur);
                    return _CS(color, 0.8 * (1 - t));
                }, false)),
            },
        });
        setTimeout(() => { try { viewer.entities.remove(e); } catch { } }, dur + 50);
    }

    // Shrapnel burst: spawn 12 fast-moving sparks around `position`
    function particleBurst(position, color = "#ffb020", count = 14) {
        const viewer = _viewer();
        const start = Date.now();
        const dur = 900;
        const baseSpeed = 180_000;
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const vx = Math.sin(phi) * Math.cos(theta) * baseSpeed;
            const vy = Math.sin(phi) * Math.sin(theta) * baseSpeed;
            const vz = Math.cos(phi) * baseSpeed;
            const ent = viewer.entities.add({
                position: new Cesium.CallbackProperty(() => {
                    const t = (Date.now() - start) / 1000;
                    return new Cesium.Cartesian3(
                        position.x + vx * t,
                        position.y + vy * t,
                        position.z + vz * t
                    );
                }, false),
                point: {
                    pixelSize: 4,
                    color: _CS(color),
                },
            });
            setTimeout(() => { try { viewer.entities.remove(ent); } catch { } }, dur);
        }
    }

    // Fire a laser from the ship (or sat) to a target
    function laserTo(targetPos, fromPos) {
        const viewer = _viewer();
        const from = fromPos || shipWorldPos() || viewer.camera.positionWC.clone();
        const beam = viewer.entities.add({
            polyline: {
                positions: [from, targetPos],
                width: 5,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.7, color: _CS("#12ffc6", 1.0),
                }),
                arcType: Cesium.ArcType.NONE,
            },
        });
        setTimeout(() => { try { viewer.entities.remove(beam); } catch { } }, 220);
    }

    // Earth energy shield bubble — toggled "flash" on impact
    let shieldEntity = null;
    let shieldFlashUntil = 0;
    function buildShield() {
        const viewer = _viewer();
        if (shieldEntity) return;
        shieldEntity = viewer.entities.add({
            position: Cesium.Cartesian3.ZERO,
            ellipsoid: {
                radii: new Cesium.Cartesian3(EARTH_R + 200_000, EARTH_R + 200_000, EARTH_R + 200_000),
                material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
                    const base = D.state.shield > 0 ? 0.12 : 0.05;
                    const flashBoost = Date.now() < shieldFlashUntil ? 0.25 : 0;
                    return _CS("#12ffc6", base + flashBoost);
                }, false)),
                outline: true,
                outlineColor: _CS("#12ffc6", 0.7),
            },
        });
    }
    function destroyShield() {
        const viewer = _viewer();
        if (!shieldEntity) return;
        try { viewer.entities.remove(shieldEntity); } catch { }
        shieldEntity = null;
    }

    // ---------- PLAYER SHIP ----------
    // The ship orbits Earth at a fixed altitude. We track (lat, lon, heading)
    // and let the player move lat/lon via WASD/arrows. Camera is chase-attached.
    function shipWorldPos() {
        const s = D.state.ship;
        if (!s) return null;
        return Cesium.Cartesian3.fromDegrees(s.lon, s.lat, SHIP_ORBIT_R - EARTH_R);
    }

    function buildShip() {
        const viewer = _viewer();
        const s = {
            lat: 20, lon: -30, head: 0,
            vLat: 0, vLon: 0,
            entities: [],
            trailPts: [],
        };
        D.state.ship = s;

        // Orientation callback — align ship with heading + local ENU at its pos
        const orientProp = new Cesium.CallbackProperty(() => {
            const pos = shipWorldPos();
            const hpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(s.head),
                0,
                0
            );
            return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
        }, false);

        // Main body (cyan sleek triangular-ish box)
        const body = viewer.entities.add({
            position: new Cesium.CallbackProperty(() => shipWorldPos(), false),
            orientation: orientProp,
            box: {
                dimensions: new Cesium.Cartesian3(240_000, 100_000, 80_000),
                material: _CS("#12ffc6", 0.95),
                outline: true, outlineColor: Cesium.Color.WHITE,
            },
            label: {
                text: "GIDEON-1",
                font: "bold 11px JetBrains Mono, monospace",
                fillColor: _CS("#12ffc6"),
                outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -24),
                scaleByDistance: new Cesium.NearFarScalar(1e5, 1.2, 5e7, 0.3),
            },
        });
        s.entities.push(body);

        // Wings (two flat side boxes)
        const wingOffset = (sign) => new Cesium.CallbackProperty(() => {
            const pos = shipWorldPos();
            const head = Cesium.Math.toRadians(s.head);
            const hpr = new Cesium.HeadingPitchRoll(head, 0, 0);
            const m = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
            // offset right (positive east) in body frame = (sin(head), cos(head), 0)
            const offset = new Cesium.Cartesian3(
                Math.sin(head) * sign * 180_000,
                Math.cos(head) * sign * 180_000,
                0
            );
            const world = Cesium.Matrix4.multiplyByPoint(m, offset, new Cesium.Cartesian3());
            return world;
        }, false);

        [-1, 1].forEach(sign => {
            const wing = viewer.entities.add({
                position: wingOffset(sign),
                orientation: orientProp,
                box: {
                    dimensions: new Cesium.Cartesian3(160_000, 40_000, 30_000),
                    material: _CS("#7fffe4", 0.92),
                    outline: true, outlineColor: _CS("#12ffc6"),
                },
            });
            s.entities.push(wing);
        });

        // Cockpit dome
        const cockpit = viewer.entities.add({
            position: new Cesium.CallbackProperty(() => {
                const pos = shipWorldPos();
                return new Cesium.Cartesian3(pos.x, pos.y, pos.z + 50_000);
            }, false),
            orientation: orientProp,
            ellipsoid: {
                radii: new Cesium.Cartesian3(60_000, 50_000, 40_000),
                material: _CS("#ff2e6e", 0.7),
                outline: true, outlineColor: _CS("#ffffff"),
            },
        });
        s.entities.push(cockpit);

        // Engine glow trail
        const trail = viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => s.trailPts, false),
                width: 6,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.65, color: _CS("#12ffc6", 0.9),
                }),
                arcType: Cesium.ArcType.NONE,
            },
        });
        s.entities.push(trail);

        _feed("ok", "SHIP :: GIDEON-1 online");
    }

    function destroyShip() {
        const viewer = _viewer();
        const s = D.state.ship;
        if (!s) return;
        s.entities.forEach(e => { try { viewer.entities.remove(e); } catch { } });
        D.state.ship = null;
    }

    // Chase-cam: orbit camera looking at ship from a distance behind/above
    function updateChaseCam() {
        const viewer = _viewer();
        const s = D.state.ship;
        if (!s) return;
        const shipPos = shipWorldPos();
        if (!shipPos) return;
        // Camera sits behind and above the ship, looking at Earth center through ship
        const camAlt = SHIP_ORBIT_R + 1_500_000;
        const backOff = 30;   // degrees behind
        const headRad = Cesium.Math.toRadians(s.head);
        const camLat = s.lat - Math.cos(headRad) * (backOff / 8);
        const camLon = s.lon - Math.sin(headRad) * (backOff / 8);
        const camPos = Cesium.Cartesian3.fromDegrees(camLon, camLat, camAlt - EARTH_R + 500_000);
        viewer.camera.lookAt(
            shipPos,
            new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(s.head),
                Cesium.Math.toRadians(-30),
                4_500_000
            )
        );
    }

    // ---------- Controls ----------
    const keys = new Set();

    function onKeyDown(e) {
        if (!D.state.running) return;
        keys.add(e.code);
        if (e.code === "Escape") D.stop();
        else if (e.code === "KeyP") D.togglePause();
        else if (e.code === "Space") { e.preventDefault(); fireFromShip(); }
        if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
            e.preventDefault();
        }
    }
    function onKeyUp(e) { keys.delete(e.code); }

    // Ship-local steering:  W/S = thrust forward/reverse (in ship's heading),
    // A/D = yaw (rotate heading left/right).  This is what any space game
    // expects.  We also smooth yaw and thrust for nicer feel.
    function applyInput(dt) {
        const s = D.state.ship;
        if (!s || D.state.paused) return;

        const FWD_SPEED = 35;    // degrees of arc per second at full thrust
        const YAW_SPEED = 90;    // degrees per second yaw rate

        let yaw = 0, thrust = 0;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) yaw -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) yaw += 1;
        if (keys.has("KeyW") || keys.has("ArrowUp")) thrust += 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) thrust -= 1;

        // Rotate heading first so thrust is applied along the NEW facing
        s.head = (s.head + yaw * YAW_SPEED * dt + 360) % 360;

        if (thrust !== 0) {
            // "Forward" in the ship's local frame means +north at heading=0,
            // +east at heading=90, etc.  Step over the sphere in that direction.
            const headRad = Cesium.Math.toRadians(s.head);
            const stepDeg = thrust * FWD_SPEED * dt;
            const dLat = Math.cos(headRad) * stepDeg;
            // Wider step in longitude at higher latitudes to keep velocity feel
            // constant (cosmetic arcade — not true great-circle).
            const lonScale = 1 / Math.max(0.2, Math.cos(Cesium.Math.toRadians(s.lat)));
            const dLon = Math.sin(headRad) * stepDeg * lonScale;
            s.lat = Math.max(-85, Math.min(85, s.lat + dLat));
            s.lon += dLon;
            if (s.lon > 180) s.lon -= 360;
            if (s.lon < -180) s.lon += 360;
        }

        // Engine trail only while thrusting — cleaner visuals
        const pos = shipWorldPos();
        if (pos && thrust !== 0) {
            s.trailPts.push(pos);
            if (s.trailPts.length > 40) s.trailPts.shift();
        } else if (s.trailPts.length > 0) {
            // Fade trail when idle
            s.trailPts.shift();
        }
    }

    // Find closest meteor to a screen point (default = center of screen)
    function pickTargetMeteor(screenX, screenY) {
        const viewer = _viewer();
        const sx = screenX != null ? screenX : viewer.canvas.clientWidth / 2;
        const sy = screenY != null ? screenY : viewer.canvas.clientHeight / 2;
        let best = null, bestDist = Infinity;
        for (const m of D.state.meteors) {
            const scr = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, m.pos);
            if (!scr) continue;
            const dx = scr.x - sx, dy = scr.y - sy;
            const d = Math.hypot(dx, dy);
            if (d < bestDist) { bestDist = d; best = m; }
        }
        return best;
    }

    // Fire the ship's twin-laser — auto-target the meteor nearest to screen center
    let shipFireCooldown = 0;
    function fireFromShip() {
        if (!D.state.running || D.state.paused) return;
        const now = performance.now();
        if (now - shipFireCooldown < 120) return;
        shipFireCooldown = now;
        sfxLaser();
        const target = pickTargetMeteor();
        const shipPos = shipWorldPos();
        if (!target || !shipPos) {
            // fire a blank laser straight ahead for feedback
            return;
        }
        laserTo(target.pos, shipPos);
        hitMeteor(target);
    }

    // ---------- Hit detection (also supports click-shoot as fallback) ----------
    D.shoot = function shoot(clickScreen) {
        if (!D.state.running || D.state.paused) return;
        const viewer = _viewer();
        sfxLaser();
        const picked = viewer.scene.pick(clickScreen);
        if (picked && picked.id) {
            const meteor = D.state.meteors.find(m => m.entity === picked.id || m.trail === picked.id);
            if (meteor) return hitMeteor(meteor, clickScreen);
        }
        const m = pickTargetMeteor(clickScreen.x, clickScreen.y);
        if (m && Math.hypot(
            (Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, m.pos) || { x: 1e9, y: 1e9 }).x - clickScreen.x,
            (Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, m.pos) || { x: 1e9, y: 1e9 }).y - clickScreen.y
        ) < AIM_ASSIST_PX) {
            laserTo(m.pos);
            return hitMeteor(m);
        }
        D.state.combo = 1;
        setHUD();
    };

    function hitMeteor(meteor) {
        meteor.hp -= 1;
        if (meteor.hp > 0) {
            flash("rgba(18,255,198,.12)", 80);
            return;
        }
        explode(meteor.pos, meteor.big ? "#ff2e6e" : "#ffb020", meteor.big ? 1.8 : 1);
        particleBurst(meteor.pos, meteor.big ? "#ff2e6e" : "#ffb020", meteor.big ? 22 : 14);
        sfxExplode();
        D.state.score += meteor.score * D.state.combo;
        D.state.combo = Math.min(10, D.state.combo + 1);
        D.state.comboMax = Math.max(D.state.comboMax, D.state.combo);
        removeMeteor(meteor);
        flash("rgba(18,255,198,.18)", 120);
        const threshold = meteor.big ? 0.15 : 0.05;
        if (Math.random() < threshold) dropPowerUp();
        setHUD();
    }

    function dropPowerUp() {
        sfxPower();
        const r = Math.random();
        if (r < 0.4) {
            D.state.shield += 1;
            _feed("ok", "DEFENSE :: 🛡 SHIELD acquired");
        } else if (r < 0.75) {
            D.state.slowUntil = Date.now() + 5000;
            _feed("ok", "DEFENSE :: ⏱ SLOW-MO engaged");
        } else {
            _feed("err", "DEFENSE :: 💥 NUKE — all meteors cleared");
            [...D.state.meteors].forEach(m => {
                explode(m.pos, "#ffffff", 0.9);
                particleBurst(m.pos, "#ffffff", 20);
                D.state.score += m.score;
                removeMeteor(m);
            });
            flash("rgba(255,255,255,.35)", 300);
        }
        setHUD();
    }

    function impact(meteor) {
        explode(meteor.pos, "#ff2e6e", 2.5);
        particleBurst(meteor.pos, "#ff2e6e", 18);
        sfxShipHit();
        shieldFlashUntil = Date.now() + 250;
        removeMeteor(meteor);
        if (D.state.shield > 0) {
            D.state.shield -= 1;
            flash("rgba(18,255,198,.25)", 300);
            _feed("warn", "DEFENSE :: 🛡 Shield absorbed an impact");
        } else {
            D.state.hp -= meteor.big ? 3 : 1;
            D.state.combo = 1;
            flash("rgba(255,46,110,.4)", 500);
        }
        setHUD();
        if (D.state.hp <= 0) gameOver();
    }

    // ---------- Leaderboard ----------
    const LB_KEY = "gi:defense:board";
    const LB_MAX = 10;
    function loadBoard() { try { return JSON.parse(localStorage.getItem(LB_KEY) || "[]"); } catch { return []; } }
    function saveBoard(b) { localStorage.setItem(LB_KEY, JSON.stringify(b.slice(0, LB_MAX))); }
    function qualifies(score) {
        if (score <= 0) return false;
        const b = loadBoard();
        if (b.length < LB_MAX) return true;
        return score > b[b.length - 1].score;
    }
    function addEntry(entry) {
        const b = loadBoard();
        b.push(entry);
        b.sort((a, b) => b.score - a.score);
        saveBoard(b);
        return b;
    }
    function renderBoard(board, highlightIdx = -1) {
        if (!board.length) return `<div class="def-lb-empty">No scores yet — be the first to sign in.</div>`;
        return `<table class="def-lb">
        <thead><tr><th>#</th><th>NAME</th><th>SCORE</th><th>WAVE</th><th>×COMBO</th><th>DATE</th></tr></thead>
        <tbody>${board.map((e, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            const cls = i === highlightIdx ? ' class="def-lb-new"' : "";
            const date = new Date(e.at).toISOString().slice(0, 10);
            return `<tr${cls}><td>${medal}</td><td>${esc(e.name)}</td><td><b>${e.score.toLocaleString()}</b></td><td>${e.wave}</td><td>×${e.combo}</td><td>${date}</td></tr>`;
        }).join("")}</tbody></table>`;
    }
    function esc(s) {
        return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    D.showLeaderboard = function showLeaderboard() {
        const ov = document.createElement("div");
        ov.className = "def-gameover def-lb-only";
        ov.innerHTML = `
      <pre style="font-size:12px;letter-spacing:1px">
  ██╗     ███████╗ █████╗ ██████╗ ███████╗██████╗ ██████╗  ██████╗  █████╗ ██████╗ ██████╗
  ██║     ██╔════╝██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
  ██║     █████╗  ███████║██║  ██║█████╗  ██████╔╝██████╔╝██║   ██║███████║██████╔╝██║  ██║
  ██║     ██╔══╝  ██╔══██║██║  ██║██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║
  ███████╗███████╗██║  ██║██████╔╝███████╗██║  ██║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
  ╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ </pre>
      <div class="def-lb-wrap">${renderBoard(loadBoard())}</div>
      <div style="margin-top:16px">
        <button class="btn-primary" id="def-lb-play">▶ PLAY</button>
        <button class="btn-ghost" id="def-lb-clear">🗑 CLEAR BOARD</button>
        <button class="btn-ghost" id="def-lb-close">✕ CLOSE</button>
      </div>`;
        document.body.appendChild(ov);
        document.getElementById("def-lb-play").onclick = () => { ov.remove(); D.start(); };
        document.getElementById("def-lb-close").onclick = () => ov.remove();
        document.getElementById("def-lb-clear").onclick = () => {
            if (confirm("Clear the entire leaderboard?")) {
                localStorage.removeItem(LB_KEY);
                ov.querySelector(".def-lb-wrap").innerHTML = renderBoard([]);
            }
        };
    };

    // ---------- Game over ----------
    function gameOver() {
        if (!D.state.running) return;
        D.state.running = false;
        stopSpawnLoop();
        cesiumTickHandle && cesiumTickHandle.remove && cesiumTickHandle.remove();
        sfxGameOver();
        if (D.state.score > D.state.best) {
            D.state.best = D.state.score;
            localStorage.setItem("gi:defense:best", String(D.state.best));
        }
        const viewer = _viewer();
        explode(Cesium.Cartesian3.ZERO, "#ff2e6e", 45);
        particleBurst(Cesium.Cartesian3.ZERO, "#ff2e6e", 60);
        flash("rgba(255,46,110,.85)", 2200);
        [...D.state.meteors].forEach(m => {
            explode(m.pos, "#ff2e6e", 1);
            particleBurst(m.pos, "#ff2e6e", 10);
            removeMeteor(m);
        });
        D.state.meteors = [];
        destroyShield();

        const didQualify = qualifies(D.state.score);
        const lastName = localStorage.getItem("gi:defense:lastname") || "";
        const ov = document.createElement("div");
        ov.className = "def-gameover";
        ov.innerHTML = `
      <pre>
  ███████╗ █████╗ ██████╗ ████████╗██╗  ██╗
  ██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██║  ██║
  █████╗  ███████║██████╔╝   ██║   ███████║
  ██╔══╝  ██╔══██║██╔══██╗   ██║   ██╔══██║
  ███████╗██║  ██║██║  ██║   ██║   ██║  ██║
  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
              D E S T R O Y E D</pre>
      <div class="def-go-score">FINAL SCORE :: <b>${D.state.score.toLocaleString()}</b></div>
      <div class="def-go-score">BEST :: <b>${D.state.best.toLocaleString()}</b></div>
      <div class="def-go-score">MAX COMBO :: <b>×${D.state.comboMax}</b></div>
      <div class="def-go-score">WAVES SURVIVED :: <b>${D.state.waves}</b></div>
      ${didQualify ? `
        <div class="def-lb-new-banner">🏆 NEW HIGH SCORE — SIGN THE BOARD</div>
        <div class="def-lb-signrow">
          <input id="def-lb-name" type="text" maxlength="12" placeholder="YOUR HANDLE"
                 value="${esc(lastName)}" autocomplete="off" />
          <button id="def-lb-submit" class="btn-primary">✓ SUBMIT</button>
        </div>` : ""}
      <div class="def-lb-wrap" id="def-lb-table">${renderBoard(loadBoard())}</div>
      <div style="margin-top:20px">
        <button class="btn-primary" id="def-retry">▶ RETRY</button>
        <button class="btn-ghost" id="def-exit">✕ EXIT</button>
      </div>`;
        document.body.appendChild(ov);
        document.getElementById("def-retry").onclick = () => { ov.remove(); D.stop(true); D.start(); };
        document.getElementById("def-exit").onclick = () => { ov.remove(); D.stop(true); };
        if (didQualify) {
            const nameEl = document.getElementById("def-lb-name");
            const submitEl = document.getElementById("def-lb-submit");
            const submit = () => {
                const name = (nameEl.value || "ANON").trim().toUpperCase().slice(0, 12);
                localStorage.setItem("gi:defense:lastname", name);
                const entry = { name, score: D.state.score, wave: D.state.waves, combo: D.state.comboMax, at: Date.now() };
                const newBoard = addEntry(entry);
                const highlightIdx = newBoard.findIndex(e => e.name === entry.name && e.at === entry.at);
                document.getElementById("def-lb-table").innerHTML = renderBoard(newBoard, highlightIdx);
                nameEl.disabled = true; submitEl.disabled = true; submitEl.textContent = "✓ SIGNED";
                _feed("ok", `DEFENSE :: ${name} signed the board at rank ${highlightIdx + 1}`);
            };
            submitEl.onclick = submit;
            nameEl.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
            setTimeout(() => { nameEl.focus(); nameEl.select(); }, 50);
        }
        _feed("err", `DEFENSE :: GAME OVER · ${D.state.score.toLocaleString()} pts · wave ${D.state.waves}`);
    }

    // ---------- Main tick ----------
    let lastFrame = performance.now();
    let cesiumTickHandle = null;
    function tick() {
        if (!D.state.running || D.state.paused) { lastFrame = performance.now(); return; }
        const now = performance.now();
        let dt = Math.min(0.1, (now - lastFrame) / 1000);
        lastFrame = now;
        const gameDt = D.state.slowUntil > Date.now() ? dt * 0.3 : dt;

        applyInput(dt);   // ship input uses real-time dt
        updateChaseCam();

        // Meteors (use game-speed dt for slow-mo effect).
        // Snapshot the array first — impact() inside this loop calls
        // removeMeteor() which splices the live array, and power-ups (NUKE)
        // from other paths can clear ALL meteors, leaving stale indices.
        const snapshot = D.state.meteors.slice();
        for (let i = snapshot.length - 1; i >= 0; i--) {
            const m = snapshot[i];
            if (!m || !m.pos || !m.entity) continue;
            // Skip if this meteor was already removed from the live array
            if (D.state.meteors.indexOf(m) === -1) continue;
            Cesium.Cartesian3.add(m.pos, Cesium.Cartesian3.multiplyByScalar(m.vel, gameDt, new Cesium.Cartesian3()), m.pos);
            m.entity.position = m.pos.clone();
            m.trailPts.push(m.pos.clone());
            if (m.trailPts.length > 20) m.trailPts.shift();
            const dist = Cesium.Cartesian3.magnitude(m.pos);
            if (dist <= IMPACT_R) impact(m);
        }
    }

    // ---------- Spawn loop ----------
    function startSpawnLoop() {
        let nextWaveAt = Date.now() + 15000;
        D.state.spawnTimer = setInterval(() => {
            if (!D.state.running || D.state.paused) return;
            spawnMeteor(false);
            if (Math.random() < 0.35 + D.state.waves * 0.05) spawnMeteor(false);
            if (Math.random() < 0.08 + D.state.waves * 0.01) spawnMeteor(true);
            if (Date.now() >= nextWaveAt) {
                D.state.waves += 1;
                nextWaveAt = Date.now() + 15000;
                sfxWave();
                waveBanner(`WAVE ${D.state.waves}`, "INCOMING");
                _feed("warn", `DEFENSE :: WAVE ${D.state.waves} incoming`);
                setHUD();
            }
        }, 900);
    }
    function stopSpawnLoop() {
        if (D.state.spawnTimer) clearInterval(D.state.spawnTimer);
        D.state.spawnTimer = null;
    }

    // ---------- Public controls ----------
    D.start = function start() {
        const viewer = _viewer();
        if (!viewer) { _feed("err", "DEFENSE :: viewer not ready"); return; }
        ac(); // unlock audio
        buildHUD();
        // Reset
        [...D.state.meteors].forEach(m => removeMeteor(m));
        destroyShip();
        destroyShield();
        D.state = {
            ...D.state,
            running: true, paused: false,
            score: 0, hp: MAX_HP, combo: 1, comboMax: 1, waves: 1,
            meteors: [], shield: 0, slowUntil: 0,
        };
        hud.classList.remove("hidden");
        document.body.classList.add("defense-mode");

        // Cinematic flyin then chase-cam
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(-30, 20, 35_000_000),
            orientation: { heading: 0, pitch: -Math.PI / 2 + 0.25, roll: 0 },
            duration: 1.6,
        });
        setTimeout(() => {
            buildShip();
            buildShield();
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(-30, 15, 8_000_000),
                duration: 1.4,
                complete: () => {
                    // switch to chase cam (handled each tick)
                }
            });
            waveBanner("WAVE 1", "DEFEND EARTH");
            sfxWave();
        }, 1600);

        // Keyboard + mouse
        D.clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        D.clickHandler.setInputAction((c) => D.shoot(c.position), Cesium.ScreenSpaceEventType.LEFT_CLICK);
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);

        cesiumTickHandle = viewer.clock.onTick.addEventListener(tick);
        startSpawnLoop();
        setHUD();
        _feed("ok", "DEFENSE :: grid online — DEFEND EARTH");
        flash("rgba(18,255,198,.25)", 400);

        const btn = document.getElementById("btn-defense");
        if (btn) btn.classList.add("active");
    };

    D.stop = function stop(silent = false) {
        D.state.running = false;
        D.state.paused = false;
        stopSpawnLoop();
        if (cesiumTickHandle) { try { cesiumTickHandle(); } catch { } cesiumTickHandle = null; }
        if (D.clickHandler) { try { D.clickHandler.destroy(); } catch { } D.clickHandler = null; }
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
        keys.clear();
        D.state.meteors.slice().forEach(removeMeteor);
        D.state.meteors.length = 0;
        destroyShip();
        destroyShield();
        if (hud) hud.classList.add("hidden");
        document.body.classList.remove("defense-mode");
        const btn = document.getElementById("btn-defense");
        if (btn) btn.classList.remove("active");
        // Restore free camera
        try { _viewer().camera.lookAtTransform(Cesium.Matrix4.IDENTITY); } catch { }
        if (!silent) _feed("warn", "DEFENSE :: grid offline — board cleared");
    };

    D.togglePause = function togglePause() {
        D.state.paused = !D.state.paused;
        _feed(D.state.paused ? "warn" : "ok", `DEFENSE :: ${D.state.paused ? "PAUSED" : "RESUMED"}`);
    };

    // ---------- Wire buttons ----------
    function wireBtn() {
        const btn = document.getElementById("btn-defense");
        if (!btn) return setTimeout(wireBtn, 500);
        btn.addEventListener("click", () => { if (D.state.running) D.stop(); else D.start(); });
        const lbBtn = document.getElementById("btn-leaderboard");
        if (lbBtn) lbBtn.addEventListener("click", () => D.showLeaderboard());
    }
    wireBtn();

    console.log("%cDEFENSE grid armed — window.DEFENSE.start()", "color:#ff2e6e; font-weight:bold");
    _feed && _feed("ok", "DEFENSE :: grid armed — SHIP mode enabled");
})();
