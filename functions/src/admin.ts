// Admin-only Cloud Functions. Every callable here checks that the caller has
// the `admin: true` custom claim before doing anything — the frontend route
// guard is just UX, these are the real enforcement.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
const auth = getAuth();

// ── helpers ──────────────────────────────────────────────────────────────────

function assertAdmin(request: { auth?: { uid: string; token: Record<string, unknown> } }): void {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Bejelentkezés szükséges.');
	if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Nincs admin jogosultságod.');
}

// ── Custom Claims ────────────────────────────────────────────────────────────

/** Grant admin role to a user. Only callable by an existing admin. */
export const setAdminClaim = onCall(async (request) => {
	assertAdmin(request);
	const { uid } = request.data;
	if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid megadása kötelező.');

	await auth.setCustomUserClaims(uid, { admin: true });
	return { success: true, message: `Admin jogosultság beállítva: ${uid}` };
});

/** Revoke admin role from a user. Only callable by an existing admin. */
export const removeAdminClaim = onCall(async (request) => {
	assertAdmin(request);
	const { uid } = request.data;
	if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid megadása kötelező.');

	// Don't let an admin remove their own claim
	if (uid === request.auth!.uid) throw new HttpsError('failed-precondition', 'Nem vonhatod meg a saját admin jogodat.');

	await auth.setCustomUserClaims(uid, { admin: false });
	return { success: true, message: `Admin jogosultság eltávolítva: ${uid}` };
});

// ── User Management ──────────────────────────────────────────────────────────

/** List users from Firebase Auth (paginated). */
export const adminListUsers = onCall(async (request) => {
	assertAdmin(request);
	const { pageToken, maxResults = 50 } = request.data ?? {};

	const result = await auth.listUsers(maxResults, pageToken || undefined);
	const users = result.users.map((u) => ({
		uid: u.uid,
		email: u.email ?? '',
		displayName: u.displayName ?? '',
		photoURL: u.photoURL ?? '',
		disabled: u.disabled,
		isAdmin: u.customClaims?.admin === true,
		createdAt: u.metadata.creationTime,
		lastSignIn: u.metadata.lastSignInTime,
		providerIds: u.providerData.map((p) => p.providerId)
	}));

	return { users, nextPageToken: result.pageToken ?? null };
});

/** Ban a user: disable their Auth account + set banned flag in Firestore. */
export const banUser = onCall(async (request) => {
	assertAdmin(request);
	const { uid } = request.data;
	if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid megadása kötelező.');
	if (uid === request.auth!.uid) throw new HttpsError('failed-precondition', 'Nem tilthatod ki saját magadat.');

	await auth.updateUser(uid, { disabled: true });

	// Also mark in Firestore so UI can show banned status without an Auth lookup.
	const userRef = db.collection('users').doc(uid);
	const snap = await userRef.get();
	if (snap.exists) {
		await userRef.update({ banned: true, bannedAt: FieldValue.serverTimestamp(), bannedBy: request.auth!.uid });
	}

	return { success: true };
});

/** Unban a user: re-enable their Auth account + clear banned flag. */
export const unbanUser = onCall(async (request) => {
	assertAdmin(request);
	const { uid } = request.data;
	if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid megadása kötelező.');

	await auth.updateUser(uid, { disabled: false });

	const userRef = db.collection('users').doc(uid);
	const snap = await userRef.get();
	if (snap.exists) {
		await userRef.update({ banned: false, bannedAt: FieldValue.delete(), bannedBy: FieldValue.delete() });
	}

	return { success: true };
});

// ── Content Moderation ───────────────────────────────────────────────────────

/** Admin-delete a listing (bypasses the owner_id == uid() rule). */
export const adminDeleteListing = onCall(async (request) => {
	assertAdmin(request);
	const { listingId } = request.data;
	if (!listingId || typeof listingId !== 'string') throw new HttpsError('invalid-argument', 'listingId megadása kötelező.');

	const ref = db.collection('listings').doc(listingId);
	const snap = await ref.get();
	if (!snap.exists) throw new HttpsError('not-found', 'A hirdetés nem található.');

	await ref.delete();
	return { success: true };
});

/** Admin-delete a want (bypasses the requester_id == uid() rule). */
export const adminDeleteWant = onCall(async (request) => {
	assertAdmin(request);
	const { wantId } = request.data;
	if (!wantId || typeof wantId !== 'string') throw new HttpsError('invalid-argument', 'wantId megadása kötelező.');

	const ref = db.collection('wants').doc(wantId);
	const snap = await ref.get();
	if (!snap.exists) throw new HttpsError('not-found', 'Az igény nem található.');

	await ref.delete();
	return { success: true };
});

/** Update a report's status (admin review). */
export const adminReviewReport = onCall(async (request) => {
	assertAdmin(request);
	const { reportId, status, actionTaken } = request.data;
	if (!reportId || typeof reportId !== 'string') throw new HttpsError('invalid-argument', 'reportId megadása kötelező.');
	if (!['REVIEWED', 'ACTIONED'].includes(status)) throw new HttpsError('invalid-argument', 'Érvénytelen státusz.');

	const ref = db.collection('reports').doc(reportId);
	const snap = await ref.get();
	if (!snap.exists) throw new HttpsError('not-found', 'A jelentés nem található.');

	await ref.update({
		status,
		action_taken: actionTaken ?? null,
		reviewed_by: request.auth!.uid,
		reviewed_at: FieldValue.serverTimestamp()
	});

	return { success: true };
});

/** Get platform statistics (counts). */
export const adminGetStats = onCall(async (request) => {
	assertAdmin(request);

	const [users, listings, wants, requests, reviews, reports] = await Promise.all([
		db.collection('users').count().get(),
		db.collection('listings').count().get(),
		db.collection('wants').count().get(),
		db.collection('requests').count().get(),
		db.collection('reviews').count().get(),
		db.collection('reports').where('status', '==', 'PENDING').count().get()
	]);

	return {
		totalUsers: users.data().count,
		totalListings: listings.data().count,
		totalWants: wants.data().count,
		totalDeals: requests.data().count,
		totalReviews: reviews.data().count,
		pendingReports: reports.data().count
	};
});

// ── Content Management (Listings & Wants) ────────────────────────────────────

/** Get all listings (paginated) for admin content management */
export const adminListListings = onCall(async (request) => {
	assertAdmin(request);
	// In a real app with 10k+ items, you'd use startAfter(pageToken), but for this
	// scale we can fetch recent 100 items. 
	const snap = await db.collection('listings').orderBy('created_at', 'desc').limit(100).get();
	const listings = snap.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
		created_at: doc.data().created_at?.toDate?.()?.toISOString() || null
	}));
	return { listings };
});

/** Get all wants (paginated) for admin content management */
export const adminListWants = onCall(async (request) => {
	assertAdmin(request);
	const snap = await db.collection('wants').orderBy('created_at', 'desc').limit(100).get();
	const wants = snap.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
		created_at: doc.data().created_at?.toDate?.()?.toISOString() || null
	}));
	return { wants };
});

// ── User Management & Trust Score ────────────────────────────────────────────

/** Find a user by exact email */
export const adminSearchUserByEmail = onCall(async (request) => {
	assertAdmin(request);
	const { email } = request.data;
	if (!email || typeof email !== 'string') {
		throw new HttpsError('invalid-argument', 'Kérlek adj meg egy érvényes email címet.');
	}

	try {
		const userRecord = await auth.getUserByEmail(email);
		
		// Get Firestore profile for additional metadata (like trust score)
		const profileDoc = await db.collection('users').doc(userRecord.uid).get();
		let trustScore = 0;
		if (profileDoc.exists) {
			trustScore = profileDoc.data()?.trust_score || 0;
		}

		return {
			user: {
				uid: userRecord.uid,
				email: userRecord.email,
				displayName: userRecord.displayName || profileDoc.data()?.display_name || '',
				isAdmin: userRecord.customClaims?.admin === true,
				isDisabled: userRecord.disabled,
				creationTime: userRecord.metadata.creationTime,
				lastSignInTime: userRecord.metadata.lastSignInTime,
				trustScore
			}
		};
	} catch (error: any) {
		if (error.code === 'auth/user-not-found') {
			return { user: null };
		}
		throw new HttpsError('internal', 'Hiba történt a keresés során: ' + error.message);
	}
});

/** Manually update a user's trust score */
export const adminUpdateTrustScore = onCall(async (request) => {
	assertAdmin(request);
	const { uid, score } = request.data;
	if (!uid || typeof score !== 'number') {
		throw new HttpsError('invalid-argument', 'Érvénytelen paraméterek.');
	}

	await db.collection('users').doc(uid).set({ trust_score: score }, { merge: true });
	return { success: true, message: `Bizalmi pontszám frissítve: ${score}` };
});

// ── Deals / Requests ─────────────────────────────────────────────────────────

/** Get all requests/deals (paginated) for admin transaction monitoring */
export const adminListRequests = onCall(async (request) => {
	assertAdmin(request);
	// We order by created_at desc to show newest deals first.
	const snap = await db.collection('requests').orderBy('created_at', 'desc').limit(100).get();
	const requests = snap.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
		created_at: doc.data().created_at?.toDate?.()?.toISOString() || null,
		startDate: doc.data().startDate?.toDate?.()?.toISOString() || null,
		endDate: doc.data().endDate?.toDate?.()?.toISOString() || null,
	}));
	return { requests };
});

/** Delete all listings on the platform */
export const adminDeleteAllListings = onCall(async (request) => {
	assertAdmin(request);
	const listingsRef = db.collection('listings');
	
	async function deleteQueryBatch(query: any, resolve: any, reject: any) {
		const snapshot = await query.get();
		const batchSize = snapshot.size;
		if (batchSize === 0) {
			resolve();
			return;
		}

		const batch = db.batch();
		snapshot.docs.forEach((doc: any) => {
			batch.delete(doc.ref);
		});
		await batch.commit();

		process.nextTick(() => {
			deleteQueryBatch(query, resolve, reject);
		});
	}

	const query = listingsRef.limit(400);
	await new Promise((resolve, reject) => {
		deleteQueryBatch(query, resolve, reject);
	});

	return { success: true };
});

