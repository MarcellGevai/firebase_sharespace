// "Wants" (Igények) live in /wants/{autoId} - the inverse of a listing: someone
// posting that they're looking for an item/service, rather than offering one.
// A separate collection from /requests (the deal/handover state machine).
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
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
		requester_name: requester.name,
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
