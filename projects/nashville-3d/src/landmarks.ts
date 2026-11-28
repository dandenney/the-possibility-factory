import { toLocal } from "./geo.ts";

export interface Landmark {
  id: string;
  name: string;
  note: string;
  lat: number;
  lon: number;
  /** framing when flown to: compass heading the camera faces, distance and pitch */
  heading: number;
  dist: number;
  pitch: number;
}

// Positions from OpenStreetMap (Nominatim). Ordered as a walking tour, Broadway first.
export const LANDMARKS: readonly Landmark[] = [
  { id: "broadway", name: "Lower Broadway", note: "Honky-tonk row: neon, open windows and live bands from late morning on.", lat: 36.16098, lon: -86.77807, heading: 120, dist: 320, pitch: 28 },
  { id: "ryman", name: "Ryman Auditorium", note: "The Mother Church of Country Music, built in 1892 as a tabernacle.", lat: 36.16125, lon: -86.7785, heading: 320, dist: 260, pitch: 32 },
  { id: "batman", name: "The Batman Building", note: "The AT&T Building, whose two spires gave it the nickname.", lat: 36.16208, lon: -86.77711, heading: 20, dist: 420, pitch: 22 },
  { id: "bridgestone", name: "Bridgestone Arena", note: "Home of the Predators, at the foot of Broadway.", lat: 36.15898, lon: -86.77838, heading: 340, dist: 330, pitch: 34 },
  { id: "hall-of-fame", name: "Country Music Hall of Fame", note: "Its windows are drawn like piano keys.", lat: 36.15817, lon: -86.77609, heading: 300, dist: 300, pitch: 32 },
  { id: "schermerhorn", name: "Schermerhorn Symphony Center", note: "The Nashville Symphony's hall.", lat: 36.15976, lon: -86.7755, heading: 250, dist: 260, pitch: 30 },
  { id: "music-city-center", name: "Music City Center", note: "The convention center under a long, wavy green roof.", lat: 36.15684, lon: -86.77845, heading: 20, dist: 480, pitch: 38 },
  { id: "fort-nashborough", name: "Fort Nashborough", note: "A replica of the 1780 stockade where the city started, on the riverbank.", lat: 36.16419, lon: -86.77536, heading: 250, dist: 260, pitch: 30 },
  { id: "pedestrian-bridge", name: "Pedestrian Bridge", note: "The John Seigenthaler bridge: an old truss bridge, now for walking only.", lat: 36.16207, lon: -86.77224, heading: 290, dist: 520, pitch: 24 },
  { id: "ascend", name: "Ascend Amphitheater", note: "The riverfront amphitheater in Riverfront Park.", lat: 36.15988, lon: -86.77185, heading: 330, dist: 300, pitch: 36 },
  { id: "nissan", name: "Nissan Stadium", note: "The Titans' stadium, across the Cumberland in East Nashville.", lat: 36.16652, lon: -86.77131, heading: 70, dist: 560, pitch: 32 },
  { id: "capitol", name: "Tennessee State Capitol", note: "On the hill at the top of downtown, finished in 1859.", lat: 36.16583, lon: -86.78424, heading: 300, dist: 380, pitch: 26 },
  { id: "frist", name: "Frist Art Museum", note: "An art museum in the 1934 Art Deco post office.", lat: 36.1576, lon: -86.78361, heading: 330, dist: 300, pitch: 30 },
];

export const LANDMARK_IDS = LANDMARKS.map((l) => l.id);

export function landmarkView(l: Landmark) {
  const { x, z } = toLocal(l.lat, l.lon);
  return { x, z, dist: l.dist, heading: l.heading, pitch: l.pitch };
}
