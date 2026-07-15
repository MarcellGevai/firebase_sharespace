// Deterministic, per-user avatars grouped by gender.
// Each gender uses a visually distinct DiceBear collection, and the seed is
// unique per user so no two people share the same face.
//   - male   -> "adventurer" (Ken theme)
//   - female -> "lorelei"    (Barbie theme)
//   - other  -> "bottts"     (robot)
// `gender` is matched case-insensitively because the register form submits
// uppercase values (MALE/FEMALE/OTHER).
export function avatarUrl(gender: string | null | undefined, seedKey: string): string {
	const seed = encodeURIComponent(seedKey || 'anon');
	const g = (gender || '').trim().toLowerCase();

	if (g === 'male') {
		return `https://api.dicebear.com/7.x/adventurer/svg?seed=Ken-${seed}`;
	}
	if (g === 'female') {
		return `https://api.dicebear.com/7.x/lorelei/svg?seed=Barbie-${seed}`;
	}
	return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
}
