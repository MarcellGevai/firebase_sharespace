// Reviews live in /reviews/{requestId_reviewerId}. The deterministic id caps it
// at one review per reviewer per deal (a second write is an update, denied by
// rules). Submitting a review folds the rating into the reviewee's trust score
// and closes the deal once both parties have reviewed.
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	collection,
	query,
	where,
	getDocs,
	serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { updateRatingAggregate } from './users';

export function reviewId(requestId: string, reviewerId: string): string {
	return `${requestId}_${reviewerId}`;
}

export async function hasReviewed(requestId: string, reviewerId: string): Promise<boolean> {
	const snap = await getDoc(doc(db, 'reviews', reviewId(requestId, reviewerId)));
	return snap.exists();
}

async function countReviews(requestId: string): Promise<number> {
	const q = query(collection(db, 'reviews'), where('request_id', '==', requestId));
	const snap = await getDocs(q);
	return snap.size;
}

export type NewReview = {
	request_id: string;
	reviewer_id: string;
	reviewee_id: string;
	rating: number;
	content?: string;
};

export async function createReview(r: NewReview): Promise<void> {
	await setDoc(doc(db, 'reviews', reviewId(r.request_id, r.reviewer_id)), {
		request_id: r.request_id,
		reviewer_id: r.reviewer_id,
		reviewee_id: r.reviewee_id,
		rating: r.rating,
		content: r.content ?? '',
		created_at: serverTimestamp()
	});

	// Fold the rating into the reviewee's aggregate trust score.
	await updateRatingAggregate(r.reviewee_id, r.rating);

	// Close the deal once BOTH parties have reviewed.
	if ((await countReviews(r.request_id)) >= 2) {
		try {
			await updateDoc(doc(db, 'requests', r.request_id), { handover_status: 'CLOSED' });
		} catch (e) {
			console.warn('Could not close deal after second review:', e);
		}
	}
}
