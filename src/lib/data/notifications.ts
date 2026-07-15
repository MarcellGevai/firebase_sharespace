import {
	collection,
	addDoc,
	doc,
	updateDoc,
	query,
	where,
	orderBy,
	limit,
	onSnapshot,
	serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Notification } from '../types';

export type NewNotification = {
	user_id: string;
	type: string;
	title: string;
	body: string;
	link: string;
};

export async function createNotification(n: NewNotification): Promise<void> {
	await addDoc(collection(db, 'notifications'), {
		...n,
		from: auth.currentUser?.uid ?? null,
		is_read: false,
		created_at: serverTimestamp()
	});
}

/** Live unread badge count. Returns the unsubscribe fn. */
export function watchUnreadCount(uid: string, cb: (n: number) => void): () => void {
	const q = query(
		collection(db, 'notifications'),
		where('user_id', '==', uid),
		where('is_read', '==', false)
	);
	return onSnapshot(
		q,
		(snap) => cb(snap.size),
		() => cb(0)
	);
}

/** Live list of the 20 most recent notifications. Returns the unsubscribe fn. */
export function watchNotifications(uid: string, cb: (list: Notification[]) => void): () => void {
	const q = query(
		collection(db, 'notifications'),
		where('user_id', '==', uid),
		orderBy('created_at', 'desc'),
		limit(20)
	);
	return onSnapshot(
		q,
		(snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notification, 'id'>) }))),
		() => cb([])
	);
}

export async function markNotificationRead(id: string): Promise<void> {
	await updateDoc(doc(db, 'notifications', id), { is_read: true });
}
