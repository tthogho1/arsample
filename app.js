(() => {
    'use strict';

    // ---- Configuration ---------------------------------------------------
    const SIGNBOARD_DISTANCE_M = 50;           // GPS mode: distance from the user
    const FRONT_DISTANCE_M = 5;                // Front mode: distance in front of camera
    const GPS_TIMEOUT_MS = 27000;              // watchPosition timeout
    const FALLBACK_TIMEOUT_MS = 30000;         // Use fallback location if no fix in this time
    const FALLBACK_LAT = 35.681236;            // Tokyo Station
    const FALLBACK_LON = 139.767125;
    const METERS_PER_DEG_LAT = 111320;         // 1 degree of latitude in meters

    // Direction code -> { north, east } offset multipliers (unit vector)
    const DIRECTION_VECTORS = {
        N: { north:  1, east:  0 },
        E: { north:  0, east:  1 },
        S: { north: -1, east:  0 },
        W: { north:  0, east: -1 },
    };

    // ---- DOM references --------------------------------------------------
    const info = document.getElementById('info');
    const signboardGps = document.getElementById('signboard');
    const signboardFront = document.getElementById('signboard-front');
    const coordText = document.getElementById('signboard-coord');
    const modeBtn = document.getElementById('mode-toggle');
    const orientBtn = document.getElementById('orient-permission');
    const dirButtons = document.querySelectorAll('.dir-btn');
    const arrowWrap = document.getElementById('arrow-wrap');
    const arrowEl = document.getElementById('arrow');
    const arrowLabel = document.getElementById('arrow-label');

    // ---- State -----------------------------------------------------------
    let placed = false;     // Has the GPS signboard been placed yet?
    let arReady = false;    // Has AR.js reported a camera position update?
    let mode = 'gps';       // 'gps' | 'front'
    let direction = 'N';    // 'N' | 'E' | 'S' | 'W'
    let lastLat = null;     // Most recent known coordinates (for re-placing)
    let lastLon = null;
    let heading = null;     // Latest compass heading (degrees)

    // ---- Helpers ---------------------------------------------------------

    /** Return a new lat/lon offset by the given meters from the source. */
    function offsetLatLon(lat, lon, northMeters, eastMeters) {
        const dLat = northMeters / METERS_PER_DEG_LAT;
        const dLon = eastMeters / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));
        return { lat: lat + dLat, lon: lon + dLon };
    }

    /** Verify A-Frame and AR.js loaded correctly. */
    function checkLibraries() {
        const missing = [];
        if (typeof AFRAME === 'undefined') {
            missing.push('A-Frame');
        } else if (!AFRAME.components['gps-new-camera']) {
            missing.push('AR.js (gps-new-camera)');
        }
        if (missing.length) {
            info.innerHTML = 'Failed to load: ' + missing.join(', ') +
                '<br>Check the network tab / CDN URLs.';
            console.error('Missing libraries:', missing);
        }
    }

    /** Update the top-left info banner. */
    function updateInfo(lat, lon, accuracy) {
        const headingTxt = (heading !== null)
            ? `<br>Heading: ${heading.toFixed(0)}° (${headingToCompass(heading)})`
            : '<br>Heading: N/A (tap "Enable Compass")';
        info.innerHTML =
            `Current: ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>` +
            `Accuracy: ±${accuracy.toFixed(1)}m` +
            headingTxt +
            `<br>Target: ${direction} ${SIGNBOARD_DISTANCE_M}m` +
            (arReady ? '<br>AR ready' : '');
    }

    /** Convert compass degrees to N/NE/E/... label. */
    function headingToCompass(deg) {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return dirs[Math.round(((deg % 360) / 45)) % 8];
    }

    /** Bearing from (lat1,lon1) to (lat2,lon2) in degrees (0=N, clockwise). */
    function bearingDeg(lat1, lon1, lat2, lon2) {
        const toRad = (d) => d * Math.PI / 180;
        const toDeg = (r) => r * 180 / Math.PI;
        const dLon = toRad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                  Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    /** Coordinates the signboard is currently pinned to. */
    let signLat = null;
    let signLon = null;

    /** Update the on-screen arrow to point toward the signboard. */
    function updateArrow() {
        if (signLat === null || lastLat === null || mode !== 'gps') {
            arrowWrap.style.display = 'none';
            return;
        }
        const bearing = bearingDeg(lastLat, lastLon, signLat, signLon);
        if (heading === null) {
            // No compass yet: just show the absolute compass direction
            arrowWrap.style.display = 'block';
            arrowEl.style.transform = `rotate(${bearing}deg)`;
            arrowLabel.textContent = `Bearing ${bearing.toFixed(0)}° (${headingToCompass(bearing)})`;
            return;
        }
        // Relative angle: how much to turn right from current facing
        const relative = ((bearing - heading) + 540) % 360 - 180; // [-180, 180]
        arrowWrap.style.display = 'block';
        arrowEl.style.transform = `rotate(${relative}deg)`;
        const absDeg = Math.abs(relative);
        arrowLabel.textContent = absDeg < 15
            ? 'Straight ahead'
            : `Turn ${relative > 0 ? 'right' : 'left'} ${absDeg.toFixed(0)}°`;
    }

    // ---- Device orientation (iOS permission handling) -------------------

    function onDeviceOrientation(e) {
        // iOS provides true heading via webkitCompassHeading (0=N, clockwise)
        if (typeof e.webkitCompassHeading === 'number') {
            heading = e.webkitCompassHeading;
        } else if (typeof e.alpha === 'number') {
            // Android: alpha is 0=North in many devices but not guaranteed
            heading = 360 - e.alpha;
        }
        if (lastLat !== null && lastLon !== null) {
            // Refresh info text only (no relocation)
            updateInfo(lastLat, lastLon, 0);
        }
        updateArrow();
    }

    function setupOrientation() {
        const needsPermission = (
            typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function'
        );

        const enable = () => {
            window.addEventListener('deviceorientation', onDeviceOrientation, true);
            window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
            orientBtn.style.display = 'none';
        };

        if (needsPermission) {
            // iOS 13+: must be triggered by user gesture
            orientBtn.style.display = 'block';
            orientBtn.addEventListener('click', async () => {
                try {
                    const res = await DeviceOrientationEvent.requestPermission();
                    if (res === 'granted') {
                        enable();
                    } else {
                        info.innerHTML += '<br>Compass permission denied.';
                    }
                } catch (err) {
                    info.innerHTML += '<br>Compass error: ' + err.message;
                }
            });
        } else {
            enable();
        }
    }

    /**
     * Place (or re-place) the GPS signboard at SIGNBOARD_DISTANCE_M in the
     * currently selected compass direction from the given coordinates.
     */
    function placeSignboard(lat, lon, sourceLabel) {
        lastLat = lat;
        lastLon = lon;

        const vec = DIRECTION_VECTORS[direction];
        const target = offsetLatLon(
            lat, lon,
            vec.north * SIGNBOARD_DISTANCE_M,
            vec.east * SIGNBOARD_DISTANCE_M
        );

        signboardGps.setAttribute(
            'gps-new-entity-place',
            `latitude: ${target.lat}; longitude: ${target.lon}`
        );
        coordText.setAttribute(
            'value',
            `${direction} ${SIGNBOARD_DISTANCE_M}m\n${target.lat.toFixed(6)}, ${target.lon.toFixed(6)}`
        );
        signLat = target.lat;
        signLon = target.lon;
        placed = true;
        applyMode();
        updateArrow();
        console.log(`Signboard placed (${sourceLabel}, dir=${direction}) at`, target);
    }

    /** Show the signboard appropriate for the current mode. */
    function applyMode() {
        if (mode === 'gps') {
            signboardGps.setAttribute('visible', placed ? 'true' : 'false');
            signboardFront.setAttribute('visible', 'false');
            modeBtn.textContent = `Mode: GPS (${SIGNBOARD_DISTANCE_M}m ${direction})`;
        } else {
            signboardGps.setAttribute('visible', 'false');
            signboardFront.setAttribute('visible', 'true');
            modeBtn.textContent = `Mode: Front (${FRONT_DISTANCE_M}m)`;
        }
    }

    function toggleMode() {
        mode = (mode === 'gps') ? 'front' : 'gps';
        applyMode();
        updateArrow();
    }

    /** Update the active state highlight on direction buttons. */
    function refreshDirectionButtons() {
        dirButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.dir === direction);
        });
    }

    function setDirection(newDir) {
        if (!DIRECTION_VECTORS[newDir] || newDir === direction) return;
        direction = newDir;
        refreshDirectionButtons();
        // Re-place the signboard using the last known coordinates
        if (lastLat !== null && lastLon !== null) {
            placed = false; // allow re-placement
            placeSignboard(lastLat, lastLon, 'direction-change');
        } else {
            applyMode();
        }
    }

    // ---- Geolocation -----------------------------------------------------

    function startGeolocation() {
        if (!('geolocation' in navigator)) {
            info.innerText = 'This browser does not support the Geolocation API.';
            placeSignboard(FALLBACK_LAT, FALLBACK_LON, 'no-geolocation');
            return;
        }

        navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                updateInfo(latitude, longitude, accuracy);
                if (!placed) {
                    placeSignboard(latitude, longitude, 'GPS');
                } else {
                    // Remember current coords so a direction change can re-place
                    lastLat = latitude;
                    lastLon = longitude;
                    updateArrow();
                }
            },
            (err) => {
                info.innerText = `GPS error: ${err.message} — falling back to Tokyo Station for demo.`;
                placeSignboard(FALLBACK_LAT, FALLBACK_LON, 'fallback');
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_TIMEOUT_MS }
        );

        // Safety net: if no fix arrives in time, use the fallback location
        setTimeout(() => {
            if (!placed) {
                info.innerHTML += '<br>No GPS fix in time — using fallback location.';
                placeSignboard(FALLBACK_LAT, FALLBACK_LON, 'timeout-fallback');
            }
        }, FALLBACK_TIMEOUT_MS);
    }

    // ---- Wiring ----------------------------------------------------------

    modeBtn.addEventListener('click', toggleMode);
    dirButtons.forEach((btn) => {
        btn.addEventListener('click', () => setDirection(btn.dataset.dir));
    });

    window.addEventListener('load', checkLibraries);
    window.addEventListener('gps-camera-update-position', (e) => {
        arReady = true;
        console.log('Camera position:', e.detail.position);
    });

    // Configure front-mode signboard distance from constant
    signboardFront.setAttribute('position', `0 0 ${-FRONT_DISTANCE_M}`);

    refreshDirectionButtons();
    applyMode();
    setupOrientation();
    startGeolocation();
})();
