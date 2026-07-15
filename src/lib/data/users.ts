// User profiles live in /users/{uid} where uid is the Firebase Auth uid.
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
