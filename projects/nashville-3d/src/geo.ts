// The model's frame, as OpenGeoWorld built it: metres, X east, -Z north, origin at the picked point.
// Same flat projection as OpenGeoWorld's makeProjection, so lat/lon land where the model put them.
export const ORIGIN = { lat: 36.1625, lon: -86.776 } as const;
export const RADIUS_M = 1000;

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON_EQ = 111320;
const KX = M_PER_DEG_LON_EQ * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function toLocal(lat: number, lon: number): { x: number; z: number } {
  return { x: (lon - ORIGIN.lon) * KX, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}

export function toLatLon(x: number, z: number): { lat: number; lon: number } {
  return { lat: ORIGIN.lat - z / M_PER_DEG_LAT, lon: ORIGIN.lon + x / KX };
}
