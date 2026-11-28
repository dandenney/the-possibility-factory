# Nashville in 3D

Downtown Nashville as a 3D model you can spin around in your browser. It was built from open data with [OpenGeoWorld](https://github.com/perezjoan/opengeoworld): lidar terrain from the USGS, an aerial photo, and 569 buildings from OpenStreetMap. Fly to the Ryman, Lower Broadway, the Batman Building or Nissan Stadium, take the tour, and send someone a link to the exact view you're looking at.

Live: https://nashville-3d.netlify.app

- Drag to move, right-drag or two fingers to turn, pinch or scroll to zoom.
- Pick a landmark in the list (or tap a pin) to fly there. "Take the tour" visits all 13.
- "Share this view" makes a link that opens on the same spot, angle and zoom.
- Building heights come from OpenStreetMap tags, and the wall textures are generic, so it's Nashville's shape rather than a photo-real copy.
- To rebuild the model or make one for another city, run OpenGeoWorld (see `AGENTS.md`).
