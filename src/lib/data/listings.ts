// Listings live in /listings/{autoId}. Owner display fields are denormalized so
// the public feed/map never has to read the (auth-gated) /users collection.
import {
	collection,
	doc,
	getDoc,
	addDoc,
	getDocs,
	query,
	where,
	orderBy,
	serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Listing, ListingType } from '../types';
import type { User } from '../types';

export type FeedItem = {
	listing: Listing;
	owner: {
		id: string;
		name: string;
		avatar_url: string;
		location: string;
		trust_score: number;
	};
};

export type NewListing = {
	title: string;
	description?: string;
	image_url: string;
	type: ListingType;
	category: string;
	price_range: string;
	location_address?: string;
	latitude?: number | null;
	longitude?: number | null;
};

export async function createListing(owner: User, data: NewListing): Promise<string> {
	const ref = await addDoc(collection(db, 'listings'), {
		owner_id: owner.id,
		title: data.title,
		description: data.description ?? '',
		image_url: data.image_url,
		type: data.type,
		status: 'AVAILABLE',
		category: data.category,
		price_range: data.price_range,
		location_address: data.location_address ?? null,
		latitude: data.latitude ?? null,
		longitude: data.longitude ?? null,
		// Denormalized owner snapshot.
		owner_name: owner.name,
		owner_avatar_url: owner.avatar_url,
		owner_location: owner.location,
		owner_trust_score: owner.trust_score ?? 0,
		created_at: serverTimestamp()
	});
	return ref.id;
}

function toListing(id: string, d: Record<string, unknown>): Listing {
	return { id, ...(d as Omit<Listing, 'id'>) };
}

/** Map a listing doc into the { listing, owner } shape the feed/map components expect. */
export function toFeedItem(listing: Listing): FeedItem {
	return {
		listing,
		owner: {
			id: listing.owner_id,
			name: listing.owner_name ?? 'Ismeretlen',
			avatar_url: listing.owner_avatar_url ?? '',
			location: listing.owner_location ?? '',
			trust_score: listing.owner_trust_score ?? 0
		}
	};
}

export async function getListing(id: string): Promise<Listing | null> {
	const snap = await getDoc(doc(db, 'listings', id));
	if (!snap.exists()) return null;
	return toListing(snap.id, snap.data());
}

export async function getAvailableListings(): Promise<Listing[]> {
	const q = query(
		collection(db, 'listings'),
		where('status', '==', 'AVAILABLE'),
		orderBy('created_at', 'desc')
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => toListing(d.id, d.data()));
}
