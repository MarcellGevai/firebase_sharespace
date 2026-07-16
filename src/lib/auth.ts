// Auth: Firebase Auth (email/password + Google) plus a Svelte store that mirrors
// the signed-in user's /users profile so components can read it reactively.
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut,
	onAuthStateChanged,
	sendEmailVerification,
	updateProfile,
	verifyBeforeUpdateEmail,
	reauthenticateWithCredential,
	EmailAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { avatarUrl } from './avatar';
import { geocodeAddress } from './geocode';
import {
	getUserProfile,
	createUserProfile,
	ensureUserProfile,
	setProfileEmail,
	setProfileLocation
} from './data/users';
import { syncOwnerLocationToListings } from './data/listings';
import type { User } from './types';

export const currentUser = writable<User | null>(null);
export const authLoading = writable<boolean>(true);

let started = false;

/** Resolves once the first auth state (and profile, if any) has been resolved. */
export const authReady: Promise<void> = new Promise((resolve) => {
	if (!browser) {
		resolve();
		return;
	}
	const unsub = onAuthStateChanged(auth, async (fbUser) => {
		if (fbUser) {
			currentUser.set(await getUserProfile(fbUser.uid));
		} else {
			currentUser.set(null);
		}
		authLoading.set(false);
		resolve();
		unsub();
	});
});

/** Keep the store in sync for the rest of the session (login/logout elsewhere). */
export function initAuth(): void {
	if (!browser || started) return;
	started = true;
	onAuthStateChanged(auth, async (fbUser) => {
		if (fbUser) {
			// Via refreshProfile rather than getUserProfile directly, so a restored
			// session (page reload) still gets the email reconcile and the one-off
			// locality repair - not just fresh logins.
			await refreshProfile();
		} else {
			currentUser.set(null);
		}
		authLoading.set(false);
	});
}

/** Re-fetch the current user's profile into the store (after profile writes). */
export async function refreshProfile(): Promise<void> {
	const fbUser = auth.currentUser;
	if (!fbUser) {
		currentUser.set(null);
		return;
	}
	const profile = await getUserProfile(fbUser.uid);
	// The /users doc only carries a display copy of the email. An address change
	// lands in Firebase Auth only once the user clicks the verification link, so
	// this is where the two get reconciled - there is no callback for that click.
	if (profile && fbUser.email && profile.email !== fbUser.email) {
		await setProfileEmail(fbUser.uid, fbUser.email).catch(() => {});
		profile.email = fbUser.email;
	}
	currentUser.set(profile);
	// Deliberately not awaited: this makes a geocoding round-trip, and sign-in
	// shouldn't block on it. It updates the store itself once done.
	if (profile) healLeakedLocation(profile).catch((e) => console.error('location heal failed', e));
}

/**
 * One-off repair for accounts registered before `location` became a coarse
 * locality. Back then registration wrote the full street address into BOTH
 * `location` and `address`, and `location` is denormalized onto /listings, which
 * anyone can read - so those accounts are publishing their home address until
 * this runs. Nothing server-side can fix it (no admin credentials here, and the
 * rules only let a user write their own docs), so each account heals itself on
 * next sign-in.
 *
 * `location === address` is the tell-tale of unrepaired data; it stops matching
 * after the first success, so this is effectively once per account. On a
 * geocoding failure it writes nothing and retries next time - better a retry
 * than silently blanking someone's locality forever.
 */
async function healLeakedLocation(profile: User): Promise<void> {
	if (!profile.address || profile.location !== profile.address) return;
	const coords = await geocodeAddress(profile.address).catch(() => null);
	if (!coords?.locality) return;
	await setProfileLocation(profile.id, coords.locality);
	await syncOwnerLocationToListings(profile.id, coords.locality).catch((e) =>
		console.error('owner_location heal failed', e)
	);
	profile.location = coords.locality;
	currentUser.set({ ...profile });
}

/** True when the account can reauthenticate with a password (i.e. not Google-only). */
export function hasPasswordProvider(): boolean {
	return (auth.currentUser?.providerData ?? []).some((p) => p.providerId === 'password');
}

/**
 * Start a login-email change. Firebase will not swap the address on the spot:
 * `verifyBeforeUpdateEmail` mails a link to the NEW address and only applies the
 * change once it's clicked, which is also why the /users copy isn't written here
 * (refreshProfile reconciles it afterwards). Requires a recent sign-in, hence
 * the password re-prompt.
 */
export async function updateAccountEmail(newEmail: string, currentPassword: string): Promise<void> {
	const user = auth.currentUser;
	if (!user) throw new Error('Nincs bejelentkezett felhasználó.');
	const cred = EmailAuthProvider.credential(user.email ?? '', currentPassword);
	await reauthenticateWithCredential(user, cred);
	await verifyBeforeUpdateEmail(user, newEmail);
}

export type RegisterInput = {
	name: string;
	email: string;
	password: string;
	address: string;
	date_of_birth: string;
	gender: string;
};

export async function register(input: RegisterInput): Promise<void> {
	const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
	const uid = cred.user.uid;

	// Best-effort geocode; registration must still succeed if Nominatim fails.
	const coords = await geocodeAddress(input.address).catch(() => null);

	await createUserProfile(uid, {
		name: input.name,
		email: input.email,
		avatar_url: avatarUrl(input.gender, uid),
		// `location` is the public face of the account - it is denormalized onto
		// listings, which anyone can read, so it must never carry the street.
		// Falls back to empty rather than the raw address when geocoding fails.
		location: coords?.locality ?? '',
		address: input.address,
		date_of_birth: input.date_of_birth,
		gender: input.gender,
		latitude: coords?.lat ?? null,
		longitude: coords?.lon ?? null
	});

	await updateProfile(cred.user, { displayName: input.name }).catch(() => {});
	await sendEmailVerification(cred.user).catch(() => {});
	await refreshProfile();
}

export async function login(email: string, password: string): Promise<void> {
	await signInWithEmailAndPassword(auth, email, password);
	await refreshProfile();
}

export async function loginWithGoogle(): Promise<void> {
	const cred = await signInWithPopup(auth, googleProvider);
	const u = cred.user;
	// First Google sign-in has no profile yet — create a minimal one.
	await ensureUserProfile(u.uid, {
		name: u.displayName ?? 'Felhasználó',
		email: u.email ?? '',
		avatar_url: u.photoURL ?? avatarUrl('OTHER', u.uid),
		location: '',
		address: '',
		gender: 'OTHER',
		latitude: null,
		longitude: null
	});
	await refreshProfile();
}

export async function logout(): Promise<void> {
	await signOut(auth);
	currentUser.set(null);
}

/** Map common Firebase Auth error codes to Hungarian UI messages. */
export function authErrorMessage(err: unknown): string {
	const code = (err as { code?: string })?.code ?? '';
	switch (code) {
		case 'auth/email-already-in-use':
			return 'Ezzel az e-mail címmel már regisztráltak.';
		case 'auth/invalid-email':
			return 'Érvénytelen e-mail cím.';
		case 'auth/weak-password':
			return 'A jelszó túl gyenge (legalább 6 karakter).';
		case 'auth/invalid-credential':
		case 'auth/wrong-password':
		case 'auth/user-not-found':
			return 'Hibás e-mail cím vagy jelszó.';
		case 'auth/too-many-requests':
			return 'Túl sok próbálkozás. Kérjük, próbáld később.';
		case 'auth/popup-closed-by-user':
			return 'A Google bejelentkezés megszakadt.';
		default:
			return (err as { message?: string })?.message ?? 'Ismeretlen hiba történt.';
	}
}

// Touch `get` so tree-shaking keeps it available for callers that need a snapshot.
export const currentUserSnapshot = () => get(currentUser);
