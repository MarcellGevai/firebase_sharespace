import {
	collection,
	addDoc,
	getDocs,
	query,
	where,
	orderBy,
	onSnapshot,
	writeBatch,
	serverTimestamp,
	type Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { conversationKey } from '../chat';

// Firestore Timestamp -> ISO string the UI's `new Date(...)` formatters expect.
// A just-written doc briefly has a null serverTimestamp; fall back to "now".
function tsToIso(ts: unknown): string {
	const t = ts as Timestamp | null | undefined;
	if (t && typeof t.toDate === 'function') return t.toDate().toISOString();
	return new Date().toISOString();
}

export type SendMessageInput = {
	listing_id: string;
	listing_title: string;
	listing_image: string;
	sender_id: string;
	receiver_id: string;
	content: string;
};

export async function sendMessage(input: SendMessageInput): Promise<void> {
	const { listing_id, sender_id, receiver_id, content } = input;
	await addDoc(collection(db, 'messages'), {
		conversation_id: conversationKey(listing_id, sender_id, receiver_id),
		participants: [sender_id, receiver_id].sort(),
		sender_id,
		receiver_id,
		listing_id,
		listing_title: input.listing_title,
		listing_image: input.listing_image,
		content,
		is_read: false,
		created_at: serverTimestamp()
	});
}

export type ChatMessage = {
	id: string;
	content: string;
	created_at: string;
	is_read: boolean;
	is_mine: boolean;
};

/** Live message thread for one conversation. Returns the unsubscribe fn. */
export function watchConversation(
	listingId: string,
	me: string,
	other: string,
	cb: (messages: ChatMessage[]) => void
): () => void {
	const convId = conversationKey(listingId, me, other);
	// The `participants` filter is redundant with `conversation_id` (which already
	// encodes both user ids) but is required for the security rules engine to
	// statically prove `uid() in resource.data.participants` holds for a list
	// query — without it Firestore rejects the whole query as permission-denied.
	const q = query(
		collection(db, 'messages'),
		where('conversation_id', '==', convId),
		where('participants', 'array-contains', me),
		orderBy('created_at', 'asc')
	);
	return onSnapshot(
		q,
		(snap) =>
			cb(
				snap.docs.map((d) => {
					const m = d.data();
					return {
						id: d.id,
						content: m.content,
						created_at: tsToIso(m.created_at),
						is_read: m.is_read === true,
						is_mine: m.sender_id === me
					};
				})
			),
		(err) => {
			console.error('watchConversation error', err);
			cb([]);
		}
	);
}

export type InboxConversation = {
	listing_id: string;
	listing_title: string;
	listing_image: string;
	other_user_id: string;
	last_message: string;
	created_at: string;
	is_read: boolean;
	is_mine: boolean;
};

/** Live inbox: latest message per conversation the user takes part in. */
export function watchInbox(uid: string, cb: (list: InboxConversation[]) => void): () => void {
	const q = query(
		collection(db, 'messages'),
		where('participants', 'array-contains', uid),
		orderBy('created_at', 'desc')
	);
	return onSnapshot(
		q,
		(snap) => {
			const seen = new Set<string>();
			const conversations: InboxConversation[] = [];
			for (const d of snap.docs) {
				const m = d.data();
				if (seen.has(m.conversation_id)) continue; // first hit == newest (desc order)
				seen.add(m.conversation_id);
				conversations.push({
					listing_id: m.listing_id,
					listing_title: m.listing_title ?? '',
					listing_image: m.listing_image ?? '',
					other_user_id: m.sender_id === uid ? m.receiver_id : m.sender_id,
					last_message: m.content,
					created_at: tsToIso(m.created_at),
					is_read: m.is_read === true,
					is_mine: m.sender_id === uid
				});
			}
			cb(conversations);
		},
		(err) => {
			console.error('watchInbox error', err);
			cb([]);
		}
	);
}

/** Mark every unread message the user received in this conversation as read. */
export async function markConversationRead(
	listingId: string,
	me: string,
	other: string
): Promise<void> {
	const convId = conversationKey(listingId, me, other);
	// See the comment in watchConversation: the security rule needs `participants`
	// in the query's own filters to allow the list, not just `conversation_id`.
	const q = query(
		collection(db, 'messages'),
		where('conversation_id', '==', convId),
		where('participants', 'array-contains', me),
		where('receiver_id', '==', me),
		where('is_read', '==', false)
	);
	const snap = await getDocs(q);
	if (snap.empty) return;
	const batch = writeBatch(db);
	snap.docs.forEach((d) => batch.update(d.ref, { is_read: true }));
	await batch.commit();
}
