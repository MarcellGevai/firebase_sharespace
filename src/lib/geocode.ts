// Client-side geocoding via Nominatim (OpenStreetMap). The old app did this
// on the server so it could set a User-Agent; browsers can't set that header,
// but Nominatim also accepts a Referer, which the browser supplies, so a light
// prototype-level lookup works from the client.
//
// If you move to the Blaze plan, prefer the `geocode` Cloud Function in
// functions/src (it sends a proper User-Agent and avoids CORS/rate concerns).
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// Nominatim's /search only matches on essentially-complete, correctly-accented
// words (typing "Batt" or "Batthyan" returns nothing until you reach the full
// "Batthyány"), so it can't power type-ahead. Photon (also OSM data, run by
// komoot, no API key) does real prefix matching and is what we use while the
// user is still typing. Biased towards Budapest since that's where the app's
// listings live.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const BUDAPEST_BIAS = { lat: 47.4979, lon: 19.0402 };

export type AddressSuggestion = { display_name: string; lat: number; lon: number };

export type GeocodeResult = {
	lat: number;
	lon: number;
	/**
	 * Coarse, publicly-showable place name ("Budapest, XI. kerület") derived from
	 * the same lookup. Never contains the street or house number - it is what gets
	 * denormalized onto listings, which anyone can read.
	 */
	locality: string;
};

/**
 * Collapse Nominatim's address breakdown into something safe to show strangers.
 * Returns '' rather than guessing when nothing coarse is available: an empty
 * locality is a cosmetic gap, whereas falling back to the raw input would put a
 * home address back on a public listing.
 */
function localityFrom(addr: Record<string, string | undefined> | undefined): string {
	if (!addr) return '';
	const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? '';
	// Budapest districts come back as `borough` ("XI. kerület"); `suburb` is the
	// finer neighbourhood ("Lágymányos") and is only a fallback. Other Hungarian
	// towns generally have neither, leaving just the city name.
	const district = addr.city_district ?? addr.borough ?? addr.district ?? addr.suburb ?? '';
	if (city && district && district !== city) return `${city}, ${district}`;
	return city || district || '';
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
	if (!address.trim()) return null;
	const params = new URLSearchParams({
		q: address,
		format: 'json',
		limit: '1',
		countrycodes: 'hu',
		// Comes back in the same response, so the coarse locality costs no extra call.
		addressdetails: '1'
	});

	try {
		const res = await fetch(`${NOMINATIM_URL}?${params}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const results = await res.json();
		if (!results.length) return null;
		return {
			lat: parseFloat(results[0].lat),
			lon: parseFloat(results[0].lon),
			locality: localityFrom(results[0].address)
		};
	} catch (err) {
		console.error('Geocoding request failed:', err);
		return null;
	}
}

/** Address-autocomplete lookup (Photon): returns up to `limit` candidate places for a partial query. */
export async function searchAddress(query: string, limit = 5): Promise<AddressSuggestion[]> {
	if (!query.trim()) return [];
	const params = new URLSearchParams({
		q: query,
		limit: String(limit),
		lat: String(BUDAPEST_BIAS.lat),
		lon: String(BUDAPEST_BIAS.lon)
	});

	try {
		const res = await fetch(`${PHOTON_URL}?${params}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return [];
		const { features } = await res.json();
		return (features ?? []).map((f: any) => ({
			display_name: formatPhotonName(f.properties),
			lat: f.geometry.coordinates[1],
			lon: f.geometry.coordinates[0]
		}));
	} catch (err) {
		console.error('Address search failed:', err);
		return [];
	}
}

function formatPhotonName(props: Record<string, string | undefined>): string {
	const parts = [props.name];
	if (props.street && props.street !== props.name) parts.push(props.street);
	parts.push(props.city ?? props.district ?? props.county);
	return parts.filter(Boolean).join(', ');
}

/** Reverse-geocode a coordinate pair (e.g. from browser geolocation) into a human-readable address. */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
	const params = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'json' });

	try {
		const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const result = await res.json();
		return result.display_name ?? null;
	} catch (err) {
		console.error('Reverse geocoding failed:', err);
		return null;
	}
}
