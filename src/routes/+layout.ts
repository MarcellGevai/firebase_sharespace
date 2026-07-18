// Static SPA: no SSR, no prerendering of real routes — a single index.html
// fallback boots the client, which then talks to Firebase directly.
import { authReady, currentUserSnapshot } from '$lib/auth';
import { auth } from '$lib/firebase';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';

export const load: LayoutLoad = async ({ url }) => {
	// Block until the first Firebase auth state (and profile) is known so every
	// page can rely on `data.user` being correct on first paint.
	await authReady;

	const fbUser = auth.currentUser;
	if (fbUser && !fbUser.emailVerified) {
		const isAllowed = url.pathname === '/verify-email' || url.pathname === '/login' || url.pathname === '/register';
		if (!isAllowed) {
			throw redirect(303, '/verify-email');
		}
	}

	return { user: currentUserSnapshot() };
};
