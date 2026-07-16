// Distance helpers for the feed. Pure math - no dependency needed for this.
//
// Note the coordinates these run on are the *raw* ones stored on each listing/
// want, not the fuzzed pins the map draws. That's not a new leak: the raw values
// already live in the world-readable /listings doc, so geoFuzz only ever hid
// them from the map's rendering, never from the data.

export type Coords = { lat: number; lon: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two coordinates (Haversine). */
export function haversineKm(a: Coords, b: Coords): number {
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance from `from` to a possibly-unpositioned item. Returns null when either
 * side lacks coordinates - the caller shows nothing rather than a misleading 0.
 */
export function distanceKmTo(
	from: Coords | null,
	lat: number | null | undefined,
	lon: number | null | undefined
): number | null {
	if (!from || lat == null || lon == null) return null;
	return haversineKm(from, { lat, lon });
}

/**
 * Precision deliberately drops as distance grows: "850 m" is useful, "12,3 km"
 * is false precision on a straight-line estimate. Hungarian locale, so the
 * decimal separator is a comma, matching the rest of the UI.
 */
export function formatDistance(km: number): string {
	if (km < 1) return `${Math.round(km * 1000)} m`;
	if (km < 10) return `${km.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} km`;
	return `${Math.round(km).toLocaleString('hu-HU')} km`;
}

/**
 * Ascending by distance, with unpositioned items sinking to the bottom instead
 * of sorting as 0. When nothing has a distance (signed out, or no baseline) every
 * comparison ties, and Array#sort's stability leaves the original order intact.
 */
export function byDistance(a: { distanceKm: number | null }, b: { distanceKm: number | null }): number {
	if (a.distanceKm == null && b.distanceKm == null) return 0;
	if (a.distanceKm == null) return 1;
	if (b.distanceKm == null) return -1;
	return a.distanceKm - b.distanceKm;
}
