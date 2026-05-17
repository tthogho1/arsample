(() => {
    'use strict';

    // ---- Configuration ---------------------------------------------------
    const SIGNBOARD_DISTANCE_M = 10;           // GPS mode: how far north of the user
    const FRONT_DISTANCE_M = 5;                // Front mode: distance in front of camera
    const GPS_TIMEOUT_MS = 27000;              // watchPosition timeout
    const FALLBACK_TIMEOUT_MS = 30000;         // Use fallback location if no fix in this time
    const FALLBACK_LAT = 35.681236;            // Tokyo Station
    const FALLBACK_LON = 139.767125;
    const METERS_PER_DEG_LAT = 111320;         // 1 degree of latitude in meters

    // ---- DOM references --------------------------------------------------
    const info = document.getElementById('info');
    const signboardGps = document.getElementById('signboard');
    const signboardFront = document.getElementById('signboard-front');
    const coordText = document.getElementById('signboard-coord');
    const modeBtn = document.getElementById('mode-toggle');

    // ---- State -----------------------------------------------------------
    let placed = false;     // Has the GPS signboard been placed yet?
    let arReady = false;    // Has AR.js reported a camera position update?
    let mode = 'gps';       // 'gps' | 'front'

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
        info.innerHTML =
            `Current: ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>` +
            `Accuracy: ±${accuracy.toFixed(1)}m` +
            (arReady ? '<br>AR ready' : '');
    }

    /** Place the GPS signboard ~N meters north of the given coordinates. */
    function placeSignboard(lat, lon, sourceLabel) {
        if (placed) return;
        const target = offsetLatLon(lat, lon, SIGNBOARD_DISTANCE_M, 0);
        signboardGps.setAttribute(
            'gps-new-entity-place',
            `latitude: ${target.lat}; longitude: ${target.lon}`
        );
        coordText.setAttribute(
            'value',
            `${target.lat.toFixed(6)}, ${target.lon.toFixed(6)}`
        );
        placed = true;
        applyMode();
        console.log(`Signboard placed (${sourceLabel}) at`, target);
    }

    /** Show the signboard appropriate for the current mode. */
    function applyMode() {
        if (mode === 'gps') {
            signboardGps.setAttribute('visible', placed ? 'true' : 'false');
            signboardFront.setAttribute('visible', 'false');
            modeBtn.textContent = `Mode: GPS (${SIGNBOARD_DISTANCE_M}m N)`;
        } else {
            signboardGps.setAttribute('visible', 'false');
            signboardFront.setAttribute('visible', 'true');
            modeBtn.textContent = `Mode: Front (${FRONT_DISTANCE_M}m)`;
        }
    }

    function toggleMode() {
        mode = (mode === 'gps') ? 'front' : 'gps';
        applyMode();
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
                placeSignboard(latitude, longitude, 'GPS');
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
    window.addEventListener('load', checkLibraries);
    window.addEventListener('gps-camera-update-position', (e) => {
        arReady = true;
        console.log('Camera position:', e.detail.position);
    });

    // Configure front-mode signboard distance from constant
    signboardFront.setAttribute('position', `0 0 ${-FRONT_DISTANCE_M}`);

    applyMode();
    startGeolocation();
})();
