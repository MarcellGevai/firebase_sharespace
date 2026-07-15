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
	updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { avatarUrl } from './avatar';
import { geocodeAddress } from './geocode';
import { getUserProfile, createUserProfile, ensureUserProfile } from './data/users';
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
			currentUser.set(await getUserProfile(fbUser.uid));
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
	currentUser.set(await getUserProfile(fbUser.uid));
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
		location: input.address,
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
