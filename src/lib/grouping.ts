// Grouping for the feed's "Összes tárgy listája" summary. Pure, so it can be
// exercised without a browser or a signed-in session.

export type TitleGroup = { title: string; count: number; nearestKm: number | null };

export type GroupableItem = {
	listing: { title?: string | null };
	distanceKm: number | null;
};

/**
 * Collapse listings into one row per distinct item name.
 *
 * Titles are free text, so the key is normalized (trimmed, case-folded) to stop
 * "Fúró", "fúró" and " Fúró " becoming three rows. The displayed name keeps the
 * first spelling seen rather than force-casing someone's own listing title.
 * `localeCompare('hu')` because Hungarian sorts accented letters in places a
 * plain codepoint sort gets wrong (á after a, not after z).
 *
 * Ordering is most-available first, with alphabetical as the tie-break so the
 * list is stable instead of insertion-ordered.
 */
export function groupByTitle(items: GroupableItem[]): TitleGroup[] {
	const groups = new Map<string, TitleGroup>();

	for (const item of items) {
		const raw = (item.listing.title ?? '').trim();
		const key = raw.toLowerCase();
		if (!key) continue; // untitled listings would collapse into one meaningless row

		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, { title: raw, count: 1, nearestKm: item.distanceKm });
			continue;
		}
		existing.count++;
		// Keep the closest of the group, so the row says something useful about
		// where the nearest one actually is.
		if (
			item.distanceKm != null &&
			(existing.nearestKm == null || item.distanceKm < existing.nearestKm)
		) {
			existing.nearestKm = item.distanceKm;
		}
	}

	return Array.from(groups.values()).sort(
		(a, b) => b.count - a.count || a.title.localeCompare(b.title, 'hu')
	);
}
