// User profiles live in /users/{uid} where uid is the Firebase Auth uid.
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	runTransaction,
	serverTimestamp,
	collection,
	getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { displayName } from '../username';
import type { User } from '../types';

export type NewUserProfile = {
	name: string;
	username?: string;
	email: string;
	avatar_url: string;
	location: string;
	address?: string;
	date_of_birth?: string;
	gender?: string;
	latitude?: number | null;
	longitude?: number | null;
};

export async function getUserProfile(uid: string): Promise<User | null> {
	const snap = await getDoc(doc(db, 'users', uid));
	if (!snap.exists()) return null;
	return { id: snap.id, ...(snap.data() as Omit<User, 'id'>) };
}

/** Create the profile document for a freshly registered user. */
export async function createUserProfile(uid: string, data: NewUserProfile): Promise<void> {
	await setDoc(doc(db, 'users', uid), {
		...data,
		trust_score: 0,
		review_count: 0,
		rating_sum: 0,
		created_at: serverTimestamp()
	});
}

/** Create the profile only if it does not exist yet (used by Google sign-in). */
export async function ensureUserProfile(uid: string, data: NewUserProfile): Promise<void> {
	const ref = doc(db, 'users', uid);
	const snap = await getDoc(ref);
	if (snap.exists()) return;
	await setDoc(ref, {
		...data,
		trust_score: 0,
		review_count: 0,
		rating_sum: 0,
		created_at: serverTimestamp()
	});
}

export type EditableProfile = {
	name: string;
	username?: string;
	address: string;
	location: string;
	date_of_birth?: string;
	gender?: string;
	avatar_url?: string;
	latitude?: number | null;
	longitude?: number | null;
	email?: string;
};

/**
 * Update the signed-in user's own profile. The security rules already restrict
 * this to `userId == uid()` with the rating aggregate untouched, so nothing here
 * needs to re-check ownership - but note `email` is only the display copy; the
 * Firebase Auth login address is changed separately (see updateAccountEmail).
 */
export async function updateUserProfile(uid: string, data: EditableProfile): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { ...data });
}

/** Sync the display copy of the email after Firebase Auth's own address changes. */
export async function setProfileEmail(uid: string, email: string): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { email });
}

/** Narrow write used by the one-off locality repair (see healLeakedLocation). */
export async function setProfileLocation(uid: string, location: string): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { location });
}

/**
 * Fold a new star rating into the reviewee's aggregate. Runs in a transaction so
 * concurrent reviews can't clobber each other. Only the three rating fields are
 * touched, which is exactly what the security rules permit a non-owner to write.
 */
export type UserSearchResult = { id: string; name: string; avatar_url: string; trust_score: number };

/**
 * Name search across all users. Firestore has no case-insensitive substring
 * search, so this reads the collection and filters client-side - fine at
 * prototype scale. Only ever returns safe, public-facing fields (never
 * email/address/date_of_birth), regardless of what the underlying docs hold.
 */
export async function searchUsers(queryText: string): Promise<UserSearchResult[]> {
	const q = queryText.trim().toLowerCase();
	if (!q) return [];
	const snap = await getDocs(collection(db, 'users'));
	const results: UserSearchResult[] = [];
	for (const d of snap.docs) {
		const data = d.data();
		// Matched on the public handle, never the legal name: searching the private
		// field would let anyone confirm a full name by brute force, and the hit
		// would render it. Legacy accounts have no username, and displayName falls
		// back to their name - which is what they already showed publicly.
		const shown = displayName(data as { username?: string; name?: string });
		if (shown.toLowerCase().includes(q)) {
			results.push({
				id: d.id,
				name: shown,
				avatar_url: data.avatar_url ?? '',
				trust_score: data.trust_score ?? 0
			});
		}
	}
	return results.slice(0, 10);
}

export async function updateRatingAggregate(userId: string, rating: number): Promise<void> {
	await runTransaction(db, async (tx) => {
		const ref = doc(db, 'users', userId);
		const snap = await tx.get(ref);
		if (!snap.exists()) return;
		const data = snap.data();
		const review_count = (data.review_count ?? 0) + 1;
		const rating_sum = (data.rating_sum ?? 0) + rating;
		const trust_score = Math.round((rating_sum / review_count) * 10) / 10;
		tx.update(ref, { review_count, rating_sum, trust_score });
	});
}
