# AR.js Location-Based AR Sample

A small AR.js sample that places a 3D signboard at a GPS location (latitude / longitude) and shows it through the camera.

## Structure

- `index.html` — the AR scene
  - **Signboard-style object**, placed dynamically about **10 m north of the user's current location**
    - White panel + blue frame
    - "Welcome!" title text
    - Subtext showing the placed coordinates
    - Brown pole
  - `look-at="[gps-new-camera]"` keeps the signboard facing the camera
- `redirect.html` — helper page that redirects to the GitHub Pages URL

## Requirements

Location-based AR requires **HTTPS** to access the camera and GPS. Test on a real mobile device for the best results.

### Serving the page over HTTPS locally

#### 1. Using ngrok

```bash
# Start any static file server
npx http-server -p 8080

# In another terminal
ngrok http 8080
```

Open the `https://xxxx.ngrok-free.app` URL ngrok prints on your phone.

#### 2. Deploy to GitHub Pages

Push to the repository and enable GitHub Pages — it will be served over HTTPS automatically.

## Customizing the placement

By default `index.html` places the signboard ~10 m north of the user. Change the offset in the script:

```js
// northMeters, eastMeters
const target = offsetLatLon(lat, lon, 10, 0);
```

To pin the signboard to a fixed location instead, replace the dynamic placement with a static attribute:

```html
<a-entity
    gps-new-entity-place="latitude: 35.717672; longitude: 139.987239"
    look-at="[gps-new-camera]"
    scale="30 30 30">
    <!-- signboard parts -->
</a-entity>
```

You can copy coordinates from Google Maps by right-clicking a point on the map.

## Changing the signboard appearance

- Text: edit the `value` of `<a-text value="...">`
- Colors: change `<a-plane color="#FFFFFF">` or `<a-text color="#0066CC">`
- Overall size: adjust the parent `<a-entity scale="30 30 30">`
- Use an image as the sign: replace the panel with
  ```html
  <a-plane width="4" height="2.4" src="sign.png"
           material="side: double; shader: flat"
           position="0 3 0"></a-plane>
  ```
  and add `sign.png` to the repository.

## Testing tips

- Test outdoors with a clear view of the sky (GPS accuracy drops indoors)
- On iOS Safari, allow both **Camera** and **Location** permissions on first load
- The top-left overlay shows your current position and GPS accuracy (`±N m`); objects may jitter while accuracy is poor
- On a PC the webcam is fixed, so the signboard appears toward the north — use Chrome DevTools → **Sensors** to fake the device orientation
- If you don't see anything, try shrinking the offset (e.g. `offsetLatLon(lat, lon, 5, 0)`)

## References

- AR.js: https://github.com/AR-js-org/AR.js
- A-Frame: https://aframe.io/
