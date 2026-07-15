// A conversation is identified by a (listing, other user) pair encoded into a
// single URL segment. IDs are UUIDs, which already contain '-', so we must use a
// separator that never appears inside a UUID. Underscore is safe (UUIDs are only
// hex digits + '-') and needs no URL-encoding.
export const CHAT_SEP = '_';

/** Build the `/inbox/[id]` route segment for a conversation. */
export function chatId(listingId: string, otherUserId: string): string {
	return `${listingId}${CHAT_SEP}${otherUserId}`;
}

/** Build the full chat URL. */
export function chatUrl(listingId: string, otherUserId: string): string {
	return `/inbox/${chatId(listingId, otherUserId)}`;
}

/**
 * Split an `/inbox/[id]` segment back into its listing and user IDs.
 * Splits on the first separator so UUIDs stay intact.
 * Returns null if the segment is malformed.
 */
export function parseChatId(id: string): { listingId: string; otherUserId: string } | null {
	const idx = id.indexOf(CHAT_SEP);
	if (idx === -1) return null;
	const listingId = id.slice(0, idx);
	const otherUserId = id.slice(idx + 1);
	if (!listingId || !otherUserId) return null;
	return { listingId, otherUserId };
}

/**
 * Stable key for the message thread between two users about a listing. The two
 * user ids are sorted so both directions map to the same conversation, then
 * joined with '__' (Firebase ids never contain underscores). Stored on every
 * message as `conversation_id` so a whole thread is a single indexed query.
 */
export function conversationKey(listingId: string, userA: string, userB: string): string {
	return `${listingId}__${[userA, userB].sort().join('__')}`;
}
