// Firestore document shapes. IDs are the Firestore document ids.

export type User = {
	id: string;
	name: string;
	avatar_url: string;
	location: string;
	trust_score: number;
	review_count?: number;
	rating_sum?: number;
	address?: string;
	email?: string;
	date_of_birth?: string;
	gender?: string;
	latitude?: number | null;
	longitude?: number | null;
};

export type ListingType = 'ITEM' | 'SERVICE';
export type ListingStatus = 'AVAILABLE' | 'UNAVAILABLE';

export type Listing = {
	id: string;
	owner_id: string;
	title: string;
	description: string;
	image_url: string;
	type: ListingType;
	status: ListingStatus;
	category?: string;
	price_range?: string;
	latitude?: number | null;
	longitude?: number | null;
	location_address?: string;
	// Denormalized owner snapshot so public browsing never needs to read /users.
	owner_name?: string;
	owner_avatar_url?: string;
	owner_location?: string;
	owner_trust_score?: number;
};

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type HandoverStatus =
	| 'PENDING'
	| 'HANDOVER_INITIATED'
	| 'HANDOVER_COMPLETED'
	| 'RETURN_INITIATED'
	| 'RETURN_COMPLETED'
	| 'CLOSED';

export type DealRequest = {
	id: string;
	listing_id: string;
	owner_id: string;
	requester_id: string;
	participants: string[];
	start_date: string;
	end_date: string;
	status: RequestStatus;
	price_offer: number;
	handover_status: HandoverStatus;
	handover_initiated_at?: unknown;
	return_initiated_at?: unknown;
	has_reviewed?: boolean;
};

export type Message = {
	id: string;
	conversation_id: string;
	participants: string[];
	sender_id: string;
	receiver_id: string;
	listing_id: string;
	content: string;
	is_read: boolean;
	created_at?: unknown;
	is_mine?: boolean;
};

export type Notification = {
	id: string;
	user_id: string;
	from?: string;
	type: 'NEW_REQUEST' | 'NEW_MESSAGE' | string;
	title: string;
	body: string;
	link: string;
	is_read: boolean;
	created_at?: unknown;
};

export type Review = {
	id: string;
	request_id: string;
	reviewer_id: string;
	reviewee_id: string;
	rating: number;
	content: string;
	created_at?: unknown;
};
