// "Wants" (Igények) live in /wants/{autoId} - the inverse of a listing: someone
// posting that they're looking for an item/service, rather than offering one.
// A separate collection from /requests (the deal/handover state machine).
import {
	collection,
	addDoc,
	getDocs,
	query,
	where,
	orderBy,
	serverTimestamp,
	writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { createdMs } from '../timestamps';
import { displayName } from '../username';
import type { User, Want } from '../types';

export type NewWant = {
	title: string;
	description?: string;
	category: string;
	date_from: string;
	date_to: string;
	price_min: number;
	price_max: number;
	location_address?: string;
	latitude?: number | null;
	longitude?: number | null;
};

export async function createWant(requester: User, data: NewWant): Promise<string> {
	const ref = await addDoc(collection(db, 'wants'), {
		requester_id: requester.id,
		title: data.title,
		description: data.description ?? '',
		category: data.category,
		date_from: data.date_from,
		date_to: data.date_to,
		price_min: data.price_min,
		price_max: data.price_max,
		location_address: data.location_address ?? '',
		latitude: data.latitude ?? null,
		longitude: data.longitude ?? null,
		// Denormalized requester snapshot, same reasoning as listings' owner fields.
		// The public handle, never the legal name: anyone can read a want.
		requester_name: displayName(requester),
		requester_avatar_url: requester.avatar_url,
		created_at: serverTimestamp()
	});
	return ref.id;
}

export async function getAvailableWants(): Promise<Want[]> {
	const q = query(collection(db, 'wants'), orderBy('created_at', 'desc'));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Want, 'id'>) }));
}

/** The requester fields /wants keeps its own copy of. */
export type RequesterSnapshot = Partial<Pick<Want, 'requester_name' | 'requester_avatar_url'>>;

/**
 * Refresh changed requester fields on their own wants. /wants carries a snapshot
 * of them and is world-readable, so without this the old handle or face stays on
 * show. Mirrors syncOwnerSnapshotToListings, including being best-effort.
 */
export async function syncRequesterSnapshotToWants(
	requesterId: string,
	fields: RequesterSnapshot
): Promise<number> {
	const entries = Object.entries(fields);
	if (entries.length === 0) return 0;

	const snap = await getDocs(query(collection(db, 'wants'), where('requester_id', '==', requesterId)));
	const stale = snap.docs.filter((d) => {
		const data = d.data();
		return entries.some(([k, v]) => data[k] !== v);
	});
	if (stale.length === 0) return 0;

	const batch = writeBatch(db);
	for (const d of stale) batch.update(d.ref, fields);
	await batch.commit();
	return stale.length;
}

/**
 * Every want posted by one person, newest first.
 *
 * Sorted client-side rather than with orderBy: pairing it with the where()
 * would demand a composite index for what is only ever a handful of docs.
 * getListingsByOwner does the same for the same reason.
 */
export async function getWantsByRequester(requesterId: string): Promise<Want[]> {
	const snap = await getDocs(query(collection(db, 'wants'), where('requester_id', '==', requesterId)));
	return snap.docs
		.sort((a, b) => createdMs(b.data().created_at) - createdMs(a.data().created_at))
		.map((d) => ({ id: d.id, ...(d.data() as Omit<Want, 'id'>) }));
}
