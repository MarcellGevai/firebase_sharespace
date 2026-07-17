// Username rules and the public-name fallback. Pure, so it can be exercised
// without a browser or a signed-in session.

/**
 * The reservation key for a username. Case-folded, because "Peter" and "peter"
 * must not be two different people - the key is what /usernames is keyed on,
 * while the user's own casing is kept for display.
 */
export function usernameKey(raw: string): string {
	return raw.trim().toLowerCase();
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Letters, digits, dot, underscore, hyphen. No spaces or '@': the UI renders
// usernames as @name, and a space would make the handle ambiguous to read.
const ALLOWED = /^[a-z0-9._-]+$/;

/**
 * Why `raw` is not a usable username, or null if it is. Returns a Hungarian
 * message because it is rendered straight into the form.
 */
export function validateUsername(raw: string): string | null {
	const key = usernameKey(raw);
	if (!key) return 'A felhasználónév megadása kötelező.';
	if (key.length < USERNAME_MIN) return `A felhasználónév legalább ${USERNAME_MIN} karakter legyen.`;
	if (key.length > USERNAME_MAX) return `A felhasználónév legfeljebb ${USERNAME_MAX} karakter lehet.`;
	if (!ALLOWED.test(key))
		return 'A felhasználónév csak betűt, számot, valamint . _ - jelet tartalmazhat.';
	return null;
}

/**
 * What strangers are shown for a person.
 *
 * Accounts created before usernames existed have none, and their docs can't be
 * backfilled (the rules let only each user write their own), so they fall back
 * to the full name they signed up with - which is what those accounts already
 * displayed publicly. New accounts always have a username, so the fallback
 * shrinks to nothing over time rather than becoming load-bearing.
 */
export function displayName(user: { username?: string; name?: string } | null | undefined): string {
	return user?.username?.trim() || user?.name?.trim() || 'Ismeretlen';
}
