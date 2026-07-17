// Username reservations live in /usernames/{key} -> { uid }.
//
// Firestore has no unique index, so uniqueness is enforced by the security
// rules rather than by anything in here: /usernames allows `create` but never
// `update`, and a create only applies when the doc doesn't exist. Two people
// racing for the same handle therefore cannot both win - the loser's write is
// an update, and is denied. The checks below are for a useful error message,
// not for correctness.
import { doc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { usernameKey } from '../username';

export class UsernameTakenError extends Error {
	constructor(username: string) {
		super(`A "${username}" felhasználónév már foglalt.`);
		this.name = 'UsernameTakenError';
	}
}

/** Free to claim right now. Racy by nature - claimUsername is the real gate. */
export async function isUsernameAvailable(raw: string, forUid?: string): Promise<boolean> {
	const snap = await getDoc(doc(db, 'usernames', usernameKey(raw)));
	if (!snap.exists()) return true;
	// Your own reservation doesn't make your own username unavailable to you.
	return forUid != null && snap.data().uid === forUid;
}

/**
 * Reserve `raw` for `uid`, throwing UsernameTakenError if someone else holds it.
 * Re-claiming one you already hold is a no-op rather than an error.
 */
export async function claimUsername(uid: string, raw: string): Promise<void> {
	const key = usernameKey(raw);
	const ref = doc(db, 'usernames', key);
	await runTransaction(db, async (tx) => {
		const snap = await tx.get(ref);
		if (snap.exists()) {
			if (snap.data().uid === uid) return;
			throw new UsernameTakenError(raw);
		}
		tx.set(ref, { uid });
	});
}

/**
 * Move a reservation. The new key is claimed before the old is released, so a
 * failure leaves the user holding their current handle rather than none: the
 * reverse order could strand them with no username if the claim then failed.
 * A leaked old reservation is recoverable; a lost identity is not.
 */
export async function changeUsername(uid: string, from: string | undefined, to: string): Promise<void> {
	await claimUsername(uid, to);
	const oldKey = from ? usernameKey(from) : '';
	if (oldKey && oldKey !== usernameKey(to)) {
		await deleteDoc(doc(db, 'usernames', oldKey)).catch(() => {});
	}
}
