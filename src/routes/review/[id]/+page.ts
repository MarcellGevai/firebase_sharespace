import { redirect } from '@sveltejs/kit';
import { authReady, currentUserSnapshot } from '$lib/auth';
import { getRequest } from '$lib/data/requests';
import { getListing } from '$lib/data/listings';
import { getUserProfile } from '$lib/data/users';
import { hasReviewed } from '$lib/data/reviews';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	await authReady;
	const me = currentUserSnapshot();
	if (!me) throw redirect(302, '/login');

	const req = await getRequest(params.id);
	if (!req) throw redirect(302, '/inbox');

	// Take the owner from the deal, not the listing. The listing may not exist at
	// all - listing_id points at a /wants doc for an offer, and owners can delete
	// a listing out from under a finished deal - in which case this used to
	// resolve to undefined, bouncing the owner out of their own review and
	// pointing the requester's review at `undefined`.
	const owner_id = req.owner_id;
	const listing = await getListing(req.listing_id);
	const listing_title = req.item_title || listing?.title || '';

	// Only the two parties, and only after the item was returned, may review.
	if (me.id !== req.requester_id && me.id !== owner_id) throw redirect(302, '/inbox');
	if (req.handover_status !== 'RETURN_COMPLETED' && req.handover_status !== 'CLOSED') {
		throw redirect(302, '/inbox');
	}

	const reviewee_id = me.id === req.requester_id ? owner_id : req.requester_id;

	if (await hasReviewed(req.id, me.id)) {
		return { alreadyReviewed: true, listing_title, request_id: req.id, reviewee_id, reviewee: null };
	}

	const rp = await getUserProfile(reviewee_id);
	return {
		alreadyReviewed: false,
		listing_title,
		request_id: req.id,
		reviewee_id,
		reviewee: rp ? { id: rp.id, name: rp.name, avatar_url: rp.avatar_url } : null
	};
};
