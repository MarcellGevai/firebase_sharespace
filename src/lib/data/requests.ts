// Rental "deals" live in /requests/{autoId}. The handover/return state machine
// is enforced by security rules (including the 5-minute confirmation window);
// the client just writes the intended next state and lets the rules validate it.
import {
	collection,
	doc,
	addDoc,
	getDoc,
	getDocs,
	updateDoc,
	query,
	where,
	orderBy,
	limit,
	onSnapshot,
	serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import type { DealRequest, HandoverStatus } from '../types';

export type NewRequest = {
	/** A /listings id, or a /wants id when offering on a request. */
	listing_id: string;
	owner_id: string;
	requester_id: string;
	start_date: string;
	end_date: string;
	price_offer: number;
	/**
	 * Who owes the first reply - always the party who did NOT open the deal.
	 * A borrower requesting a listing hands the turn to the owner; a lender
	 * offering on a want hands it to the want's author. Passed in rather than
	 * assumed, since either side can now open a deal.
	 */
	awaiting_response_from: string;
	item_title?: string;
	item_image?: string;
	paymentIntentId?: string;
	paymentStatus?: 'held' | 'captured' | 'refunded';
};

export async function createRequest(data: NewRequest): Promise<string> {
	const ref = await addDoc(collection(db, 'requests'), {
		listing_id: data.listing_id,
		owner_id: data.owner_id,
		requester_id: data.requester_id,
		start_date: data.start_date,
		end_date: data.end_date,
		price_offer: data.price_offer,
		awaiting_response_from: data.awaiting_response_from,
		// Firestore rejects undefined outright, so these must be real strings.
		item_title: data.item_title ?? '',
		item_image: data.item_image ?? '',
		paymentIntentId: data.paymentIntentId ?? null,
		paymentStatus: data.paymentStatus ?? null,
		participants: [data.owner_id, data.requester_id],
		status: 'PENDING',
		handover_status: 'PENDING',
		handover_initiated_at: null,
		return_initiated_at: null,
		created_at: serverTimestamp()
	});
	return ref.id;
}

export async function getRequest(id: string): Promise<DealRequest | null> {
	const snap = await getDoc(doc(db, 'requests', id));
	if (!snap.exists()) return null;
	return { id: snap.id, ...(snap.data() as Omit<DealRequest, 'id'>) };
}

/** The most recent deal for this listing between the two users, or null. */
export async function getRequestForConversation(
	listingId: string,
	userA: string,
	userB: string
): Promise<DealRequest | null> {
	// Filtering on `participants` (rather than requester_id) is what lets the
	// security rules engine prove `isParty()` for this list query; userB is then
	// matched client-side since Firestore only allows one array-contains per query.
	const q = query(
		collection(db, 'requests'),
		where('listing_id', '==', listingId),
		where('participants', 'array-contains', userA),
		orderBy('created_at', 'desc'),
		limit(20)
	);
	const snap = await getDocs(q);
	const match = snap.docs.find((d) => (d.data().participants ?? []).includes(userB));
	if (!match) return null;
	return { id: match.id, ...(match.data() as Omit<DealRequest, 'id'>) };
}

/**
 * Live version of getRequestForConversation: the deal updates automatically
 * when either party accepts/rejects/initiates handover/etc, no manual
 * refresh needed. Returns the unsubscribe fn.
 */
export function watchRequestForConversation(
	listingId: string,
	userA: string,
	userB: string,
	cb: (request: DealRequest | null) => void
): () => void {
	const q = query(
		collection(db, 'requests'),
		where('listing_id', '==', listingId),
		where('participants', 'array-contains', userA),
		orderBy('created_at', 'desc'),
		limit(20)
	);
	return onSnapshot(
		q,
		(snap) => {
			const match = snap.docs.find((d) => (d.data().participants ?? []).includes(userB));
			cb(match ? { id: match.id, ...(match.data() as Omit<DealRequest, 'id'>) } : null);
		},
		(err) => {
			console.error('watchRequestForConversation error', err);
			cb(null);
		}
	);
}

/** Every deal (any status) the user is a party to, newest first. */
export async function getMyRentals(uid: string): Promise<DealRequest[]> {
	const q = query(
		collection(db, 'requests'),
		where('participants', 'array-contains', uid),
		orderBy('created_at', 'desc')
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DealRequest, 'id'>) }));
}

export type HandoverAction =
	| 'accept_deal'
	| 'reject_deal'
	| 'init_handover'
	| 'accept_handover'
	| 'reset_handover'
	| 'init_return'
	| 'accept_return'
	| 'reset_return'
	| 'close';

export type HandoverTerms = { start_date: string; end_date: string; price_offer: number };

/**
 * Revise an already-accepted deal's dates/price. This is NOT a silent edit: the
 * deal drops back to PENDING and `nextResponder` must accept the new terms
 * before anything (including the handover handshake) can proceed - initHandover
 * requires status ACCEPTED. Only allowed before the handshake starts; the
 * matching `reviseAcceptedDeal()` security rule enforces all of this server-side.
 */
export async function reviseAcceptedDeal(
	requestId: string,
	nextResponder: string,
	terms: HandoverTerms
): Promise<void> {
	const ref = doc(db, 'requests', requestId);
	await updateDoc(ref, {
		start_date: terms.start_date,
		end_date: terms.end_date,
		price_offer: terms.price_offer,
		status: 'PENDING',
		awaiting_response_from: nextResponder
	});
}

/**
 * Counter-offer during the pre-acceptance ping-pong negotiation: updates the
 * proposed dates/price and hands the turn to the other party. `nextResponder`
 * is whichever of owner_id/requester_id isn't the caller - the caller already
 * has both on hand from the request they're viewing.
 */
export async function modifyOffer(
	requestId: string,
	nextResponder: string,
	terms: HandoverTerms
): Promise<void> {
	const ref = doc(db, 'requests', requestId);
	await updateDoc(ref, {
		start_date: terms.start_date,
		end_date: terms.end_date,
		price_offer: terms.price_offer,
		awaiting_response_from: nextResponder
	});
}

/**
 * Apply one state-machine transition. Each branch writes only the fields the
 * matching security-rule transition allows. Timestamps use serverTimestamp() so
 * the 5-minute window is anchored to trusted server time.
 */
export async function handoverAction(requestId: string, action: HandoverAction): Promise<void> {
	const ref = doc(db, 'requests', requestId);
	switch (action) {
		case 'accept_deal':
			await updateDoc(ref, { status: 'ACCEPTED' });
			return;
		case 'reject_deal':
			await updateDoc(ref, { status: 'REJECTED' });
			return;
		case 'init_handover':
			await updateDoc(ref, {
				handover_status: 'HANDOVER_INITIATED' as HandoverStatus,
				handover_initiated_at: serverTimestamp()
			});
			return;
		case 'accept_handover':
			await updateDoc(ref, {
				handover_status: 'HANDOVER_COMPLETED' as HandoverStatus,
				actual_rental_start: serverTimestamp()
			});
			return;
		case 'reset_handover':
			await updateDoc(ref, { handover_status: 'PENDING' as HandoverStatus });
			return;
		case 'init_return':
			await updateDoc(ref, {
				handover_status: 'RETURN_INITIATED' as HandoverStatus,
				return_initiated_at: serverTimestamp()
			});
			return;
		case 'accept_return':
			await updateDoc(ref, {
				handover_status: 'RETURN_COMPLETED' as HandoverStatus,
				actual_rental_end: serverTimestamp()
			});
			return;
		case 'reset_return':
			await updateDoc(ref, { handover_status: 'HANDOVER_COMPLETED' as HandoverStatus });
			return;
		case 'close':
			await updateDoc(ref, { handover_status: 'CLOSED' as HandoverStatus });
			return;
	}
}
