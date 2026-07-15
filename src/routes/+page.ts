import { getAvailableListings } from '$lib/data/listings';
import { fuzzCoordinate } from '$lib/geoFuzz';
import type { PageLoad } from './$types';

// Map landing page. Only listings that carry coordinates (geocoded at creation)
// can be placed; the pin is fuzzed so the exact address is never revealed.
export const load: PageLoad = async () => {
	const listings = await getAvailableListings();
	const items = listings
		.filter((l) => l.latitude != null && l.longitude != null)
		.map((l) => ({
			listing: l,
			owner: {
				id: l.owner_id,
				name: l.owner_name ?? '',
				avatar_url: l.owner_avatar_url ?? '',
				location: l.owner_location ?? '',
				trust_score: l.owner_trust_score ?? 0
			},
			position: fuzzCoordinate(l.latitude as number, l.longitude as number, l.id)
		}));
	return { items };
};
