// Admin utilities: role check (via Custom Claims) and Cloud Function wrappers.
// The isAdmin() result is cached per session so the check doesn't hit the
// network on every navigation into /admin sub-routes.
import { auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { authReady } from './auth';
import type { Report } from './types';

let _adminCache: boolean | null = null;

/** Check whether the current user has the `admin` custom claim. */
export async function isAdmin(): Promise<boolean> {
	await authReady; // wait for Firebase Auth to initialize before checking currentUser
	const user = auth.currentUser;
	if (!user) return false;
	if (_adminCache !== null) return _adminCache;

	try {
		const result = await user.getIdTokenResult();
		_adminCache = result.claims.admin === true;
	} catch {
		_adminCache = false;
	}
	return _adminCache;
}

/** Force-refresh the token (e.g. after someone grants you admin). */
export async function refreshAdminStatus(): Promise<boolean> {
	_adminCache = null;
	const user = auth.currentUser;
	if (!user) return false;
	await user.getIdToken(true); // force refresh
	return isAdmin();
}

/** Clear cache on logout. */
export function clearAdminCache(): void {
	_adminCache = null;
}

// ── Cloud Function wrappers ──────────────────────────────────────────────────

export async function callSetAdmin(uid: string): Promise<void> {
	await httpsCallable(functions, 'setAdminClaim')({ uid });
}

export async function callRemoveAdmin(uid: string): Promise<void> {
	await httpsCallable(functions, 'removeAdminClaim')({ uid });
}

export type AdminUser = {
	uid: string;
	email: string;
	displayName: string;
	photoURL: string;
	disabled: boolean;
	isAdmin: boolean;
	createdAt: string;
	lastSignIn: string;
	providerIds: string[];
};

export async function callListUsers(pageToken?: string): Promise<{ users: AdminUser[]; nextPageToken: string | null }> {
	const result = await httpsCallable(functions, 'adminListUsers')({ pageToken, maxResults: 50 });
	return result.data as { users: AdminUser[]; nextPageToken: string | null };
}

export async function callBanUser(uid: string): Promise<void> {
	await httpsCallable(functions, 'banUser')({ uid });
}

export async function callUnbanUser(uid: string): Promise<void> {
	await httpsCallable(functions, 'unbanUser')({ uid });
}

export async function callDeleteListing(listingId: string): Promise<void> {
	await httpsCallable(functions, 'adminDeleteListing')({ listingId });
}

export async function callDeleteWant(wantId: string): Promise<void> {
	await httpsCallable(functions, 'adminDeleteWant')({ wantId });
}

export async function callReviewReport(reportId: string, status: 'REVIEWED' | 'ACTIONED', actionTaken?: string): Promise<void> {
	await httpsCallable(functions, 'adminReviewReport')({ reportId, status, actionTaken });
}

export type PlatformStats = {
	totalUsers: number;
	totalListings: number;
	totalWants: number;
	totalDeals: number;
	totalReviews: number;
	pendingReports: number;
};

export async function callGetStats(): Promise<PlatformStats> {
	const result = await httpsCallable(functions, 'adminGetStats')({});
	return result.data as PlatformStats;
}
