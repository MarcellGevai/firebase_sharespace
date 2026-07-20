import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getListing } from '$lib/data/listings';
import { getUserProfile } from '$lib/data/users';

export const load: PageLoad = async ({ params }) => {
	const id = params.id;
	const listing = await getListing(id);
	
	if (!listing) {
		error(404, { message: 'Listing not found' });
	}

	const owner = await getUserProfile(listing.owner_id);

	return {
		listing,
		owner
	};
};
