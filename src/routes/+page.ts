import { getAvailableListings } from '$lib/data/listings';
import { getAvailableWants } from '$lib/data/wants';
import { fuzzCoordinate } from '$lib/geoFuzz';
import type { PageLoad } from './$types';

// Map landing page. Only entries that carry coordinates (geocoded at creation)
// can be placed; the pin is fuzzed so the exact address is never revealed.
// Listings and wants are loaded separately - the map shows one or the other,
// chosen by the Hirdetések/Igények toggle.
export const load: PageLoad = async () => {
	const [listings, wants] = await Promise.all([getAvailableListings(), getAvailableWants()]);

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

	// Wants created before they carried a location have no coordinates and simply
	// can't be placed - they stay in the /feed list only.
	const wantItems = wants
		.filter((w) => w.latitude != null && w.longitude != null)
		.map((w) => ({
			want: w,
			requester: {
				id: w.requester_id,
				name: w.requester_name ?? '',
				avatar_url: w.requester_avatar_url ?? ''
			},
			position: fuzzCoordinate(w.latitude as number, w.longitude as number, w.id)
		}));

	return { items, wantItems, unplaceableWants: wants.length - wantItems.length };
};
