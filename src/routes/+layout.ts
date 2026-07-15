// Static SPA: no SSR, no prerendering of real routes — a single index.html
// fallback boots the client, which then talks to Firebase directly.
import { authReady, currentUserSnapshot } from '$lib/auth';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';

export const load: LayoutLoad = async () => {
	// Block until the first Firebase auth state (and profile) is known so every
	// page can rely on `data.user` being correct on first paint.
	await authReady;
	return { user: currentUserSnapshot() };
};
