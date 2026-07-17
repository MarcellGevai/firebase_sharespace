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
	serverTimestamp,
	writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { createdMs } from '../timestamps';
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
	availability_type?: 'ONGOING' | 'FIXED' | null;
	available_from?: string | null;
	available_until?: string | null;
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
		availability_type: data.availability_type ?? null,
		available_from: data.available_from ?? null,
		available_until: data.available_until ?? null,
		// Denormalized owner snapshot.
		owner_name: owner.name,
		owner_avatar_url: owner.avatar_url,
		owner_location: owner.location,
		owner_trust_score: owner.trust_score ?? 0,
		created_at: serverTimestamp()
	});
	return ref.id;
}

/**
 * Push the owner's current public locality onto every listing they own.
 *
 * `owner_location` is a snapshot taken at creation time, and /listings is world
 * readable - so a stale copy of an old, address-shaped `location` would stay
 * publicly visible no matter what the /users doc says. Callers run this whenever
 * the owner's location changes. Rules permit it: each write targets a doc whose
 * owner_id is the caller.
 *
 * Best-effort by design: a failure here must not fail the profile save, but it
 * does mean the listings keep the old value until the next attempt.
 */
export async function syncOwnerLocationToListings(
	ownerId: string,
	location: string
): Promise<number> {
	const snap = await getDocs(query(collection(db, 'listings'), where('owner_id', '==', ownerId)));
	const stale = snap.docs.filter((d) => d.data().owner_location !== location);
	if (stale.length === 0) return 0;

	const batch = writeBatch(db);
	for (const d of stale) batch.update(d.ref, { owner_location: location });
	await batch.commit();
	return stale.length;
}

function toListing(id: string, d: Record<string, unknown>): Listing {
	return { id, ...(d as Omit<Listing, 'id'>) };
}

/**
 * Everything this owner currently has up, newest first - what their public
 * profile advertises.
 *
 * One equality filter only, so Firestore's automatic single-field index covers
 * it. Adding `status`/`orderBy` to the query would demand a composite index on
 * (owner_id, status, created_at) that doesn't exist, and the query would throw
 * until that index finished building. At a few listings per user, filtering and
 * sorting here is cheaper than that trade.
 */
export async function getListingsByOwner(ownerId: string): Promise<Listing[]> {
	const snap = await getDocs(query(collection(db, 'listings'), where('owner_id', '==', ownerId)));
	return snap.docs
		.filter((d) => d.data().status === 'AVAILABLE')
		.sort((a, b) => createdMs(b.data().created_at) - createdMs(a.data().created_at))
		.map((d) => toListing(d.id, d.data()));
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
