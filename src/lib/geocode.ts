// Client-side geocoding via Nominatim (OpenStreetMap). The old app did this
// on the server so it could set a User-Agent; browsers can't set that header,
// but Nominatim also accepts a Referer, which the browser supplies, so a light
// prototype-level lookup works from the client.
//
// If you move to the Blaze plan, prefer the `geocode` Cloud Function in
// functions/src (it sends a proper User-Agent and avoids CORS/rate concerns).
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
	const params = new URLSearchParams({
		q: address,
		format: 'json',
		limit: '1',
		countrycodes: 'hu'
	});

	try {
		const res = await fetch(`${NOMINATIM_URL}?${params}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const results = await res.json();
		if (!results.length) return null;
		return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
	} catch (err) {
		console.error('Geocoding request failed:', err);
		return null;
	}
}
