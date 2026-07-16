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
	// Owner-declared availability window. Unset means "always available" (today's
	// default behavior); ONGOING has a start but no end; FIXED has both.
	availability_type?: 'ONGOING' | 'FIXED' | null;
	available_from?: string | null;
	available_until?: string | null;
	// Denormalized owner snapshot so public browsing never needs to read /users.
	owner_name?: string;
	owner_avatar_url?: string;
	owner_location?: string;
	owner_trust_score?: number;
};

// A "want" (Igény): someone posting that they're looking for an item/service,
// the inverse of a Listing. Lives in its own /wants collection - kept entirely
// separate from /requests, which is the unrelated deal/handover state machine.
export type Want = {
	id: string;
	requester_id: string;
	title: string;
	description: string;
	category?: string;
	date_from: string;
	date_to: string;
	price_min: number;
	price_max: number;
	// Where the requester wants the item/service. Geocoded at creation like a
	// listing's; wants created before this existed have none and can't be mapped.
	location_address?: string;
	latitude?: number | null;
	longitude?: number | null;
	requester_name?: string;
	requester_avatar_url?: string;
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
	/**
	 * The thing being transacted: a /listings id for a normal rental, or a /wants
	 * id when someone offered on a request. The name is historical - it also keys
	 * the conversation (see chat.ts).
	 */
	listing_id: string;
	/** Provides the item (lender). For an offer on a want, that's the offerer. */
	owner_id: string;
	/** Receives the item (borrower). For an offer on a want, that's its author. */
	requester_id: string;
	participants: string[];
	start_date: string;
	end_date: string;
	status: RequestStatus;
	price_offer: number;
	// Pre-acceptance ping-pong negotiation: whoever this points to may currently
	// accept/reject/modify the offer above. Absent on requests created before
	// this field existed - treat missing as "owner_id" (today's default).
	awaiting_response_from?: string;
	// Snapshot of what's being transacted, taken at creation. Denormalized because
	// listing_id may point at a /wants doc, and because owners can delete a
	// listing out from under a finished deal.
	item_title?: string;
	item_image?: string;
	handover_status: HandoverStatus;
	handover_initiated_at?: unknown;
	return_initiated_at?: unknown;
	// Set exactly when both parties confirm handover/return - the real rental
	// window, as opposed to the originally requested start_date/end_date.
	actual_rental_start?: unknown;
	actual_rental_end?: unknown;
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
	// Denormalized so a profile's review list never needs a /users read per review.
	reviewer_name?: string;
	reviewer_avatar_url?: string;
	created_at?: unknown;
};
