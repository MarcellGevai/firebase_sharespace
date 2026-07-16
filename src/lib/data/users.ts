// User profiles live in /users/{uid} where uid is the Firebase Auth uid.
import { doc, getDoc, setDoc, runTransaction, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';

export type NewUserProfile = {
	name: string;
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
		if (typeof data.name === 'string' && data.name.toLowerCase().includes(q)) {
			results.push({
				id: d.id,
				name: data.name,
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
