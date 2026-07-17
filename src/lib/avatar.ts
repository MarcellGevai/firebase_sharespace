// Per-user avatars, drawn by DiceBear from a seed. No image is stored: the URL
// *is* the avatar, which is why changing one is only changing a string.

/**
 * Collections offered in the profile picker. A curated subset of DiceBear's:
 * each reads well at 24px (the smallest the app draws an avatar) and none needs
 * a meaningful seed the way `initials` does, since our seeds are random.
 */
export const AVATAR_STYLES = [
	{ id: 'bottts', label: 'Robot' },
	{ id: 'adventurer', label: 'Kalandor' },
	{ id: 'lorelei', label: 'Portré' },
	{ id: 'pixel-art', label: 'Pixel' },
	{ id: 'fun-emoji', label: 'Emoji' },
	{ id: 'thumbs', label: 'Hüvelyk' }
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]['id'];

const DEFAULT_STYLE: AvatarStyle = 'bottts';

export function avatarUrlFor(style: AvatarStyle, seed: string): string {
	return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed || 'anon')}`;
}

/** A fresh seed, so "generate" gives a genuinely different face each press. */
export function randomAvatarSeed(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Which collection an existing avatar came from, so the picker can show what
 * you're currently wearing.
 *
 * The style lives in the URL and nowhere else - deliberately not a field on
 * /users, since the URL already carries it and two copies could disagree.
 * Anything unrecognized (a Google photoURL, an avatar predating the picker)
 * falls back to the default rather than throwing: the picker only needs a
 * starting point, and the next press overwrites it anyway.
 */
export function avatarStyleOf(url: string | null | undefined): AvatarStyle {
	const m = /api\.dicebear\.com\/[^/]+\/([^/]+)\//.exec(url ?? '');
	const found = AVATAR_STYLES.find((s) => s.id === m?.[1]);
	return found?.id ?? DEFAULT_STYLE;
}

/**
 * The avatar a brand-new account starts with. Deterministic from the uid, and
 * still grouped by gender - but that is only the *starting* face now, because
 * the profile picker lets anyone move to any collection afterwards.
 *
 * `gender` is matched case-insensitively because the register form submits
 * uppercase values (MALE/FEMALE/OTHER).
 */
export function avatarUrl(gender: string | null | undefined, seedKey: string): string {
	const seed = seedKey || 'anon';
	const g = (gender || '').trim().toLowerCase();

	if (g === 'male') return avatarUrlFor('adventurer', `Ken-${seed}`);
	if (g === 'female') return avatarUrlFor('lorelei', `Barbie-${seed}`);
	return avatarUrlFor('bottts', seed);
}
