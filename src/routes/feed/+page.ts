import { getAvailableListings, toFeedItem } from '$lib/data/listings';
import { getAvailableWants } from '$lib/data/wants';
import type { PageLoad } from './$types';

// Replaces the old +page.server.ts SQL JOIN. Owner fields are denormalized on
// each listing, so one Firestore query is enough.
export const load: PageLoad = async () => {
	const [listings, wants] = await Promise.all([getAvailableListings(), getAvailableWants()]);
	return { items: listings.map(toFeedItem), wants };
};
