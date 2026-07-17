// Grouping for the feed's "Összes tárgy/esemény listája" summary. Pure, so it
// can be exercised without a browser or a signed-in session.

export type CategoryGroup = { category: string; count: number };

export type GroupableItem = {
	listing: { category?: string | null };
};

// Listings predating the CATEGORIES list carry free-text categories, and some
// carry none at all. Both collapse into the existing "other" bucket rather than
// dropping out of the summary - a count that doesn't add up to the feed is worse
// than a vague row.
export const UNCATEGORIZED = 'Egyéb';

/**
 * Collapse listings into one row per category.
 *
 * Categories are near-fixed (see CATEGORIES) but not guaranteed, so the key is
 * normalized (trimmed, case-folded) and the displayed name keeps the first
 * spelling seen. Only non-empty groups come back: a row reading "(0)" tells the
 * reader nothing they can act on.
 *
 * Ordered alphabetically, not by count, so the grid stays put as listings come
 * and go. `localeCompare('hu')` because Hungarian sorts accented letters in
 * places a plain codepoint sort gets wrong (á after a, not after z).
 */
export function groupByCategory(items: GroupableItem[]): CategoryGroup[] {
	const groups = new Map<string, CategoryGroup>();

	for (const item of items) {
		const raw = (item.listing.category ?? '').trim() || UNCATEGORIZED;
		const key = raw.toLowerCase();

		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, { category: raw, count: 1 });
			continue;
		}
		existing.count++;
	}

	return Array.from(groups.values()).sort((a, b) => a.category.localeCompare(b.category, 'hu'));
}
