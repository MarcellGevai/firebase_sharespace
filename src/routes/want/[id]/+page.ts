import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getWant } from '$lib/data/wants';
import { getUserProfile } from '$lib/data/users';

export const load: PageLoad = async ({ params }) => {
	const id = params.id;
	const want = await getWant(id);
	
	if (!want) {
		error(404, { message: 'Request not found' });
	}

	const requester = await getUserProfile(want.requester_id);

	return {
		want,
		requester
	};
};
