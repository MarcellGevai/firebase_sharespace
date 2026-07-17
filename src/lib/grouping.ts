// Grouping for the feed's "Összes tárgy/esemény listája" summary. Pure, so it
// can be exercised without a browser or a signed-in session.
import { NO_SUBCATEGORY } from './categories';

export type SubGroup = { subcategory: string; count: number };
export type CategoryGroup = { category: string; count: number; subgroups: SubGroup[] };

export type GroupableItem = {
	listing: { category?: string | null; subcategory?: string | null };
};

// Listings predating the CATEGORIES list carry free-text categories, and some
// carry none at all. Both collapse into the existing "other" bucket rather than
// dropping out of the summary - a count that doesn't add up to the feed is worse
// than a vague row.
export const UNCATEGORIZED = 'Egyéb';

/**
 * Collapse listings into one row per category, each carrying its own breakdown
 * by subcategory.
 *
 * Categories are near-fixed (see CATEGORIES) but not guaranteed, so keys are
 * normalized (trimmed, case-folded) and the displayed name keeps the first
 * spelling seen. Only non-empty groups come back: a row reading "(0)" tells the
 * reader nothing they can act on.
 *
 * Both levels are ordered alphabetically, not by count, so the grid stays put as
 * listings come and go. `localeCompare('hu')` because Hungarian sorts accented
 * letters in places a plain codepoint sort gets wrong (á after a, not after z).
 * The one exception is NO_SUBCATEGORY, pinned last: it's a leftovers bucket, not
 * a peer of the real rows, and it disappears as listings acquire the field.
 */
export function groupByCategory(items: GroupableItem[]): CategoryGroup[] {
	const groups = new Map<string, { category: string; count: number; subs: Map<string, SubGroup> }>();

	for (const item of items) {
		const rawCategory = (item.listing.category ?? '').trim() || UNCATEGORIZED;
		const categoryKey = rawCategory.toLowerCase();

		let group = groups.get(categoryKey);
		if (!group) {
			group = { category: rawCategory, count: 0, subs: new Map() };
			groups.set(categoryKey, group);
		}
		group.count++;

		const rawSub = (item.listing.subcategory ?? '').trim() || NO_SUBCATEGORY;
		const subKey = rawSub.toLowerCase();
		const sub = group.subs.get(subKey);
		if (sub) {
			sub.count++;
		} else {
			group.subs.set(subKey, { subcategory: rawSub, count: 1 });
		}
	}

	return Array.from(groups.values())
		.map((g) => ({
			category: g.category,
			count: g.count,
			subgroups: Array.from(g.subs.values()).sort(sortSubgroups)
		}))
		.sort((a, b) => a.category.localeCompare(b.category, 'hu'));
}

function sortSubgroups(a: SubGroup, b: SubGroup): number {
	if (a.subcategory === NO_SUBCATEGORY) return 1;
	if (b.subcategory === NO_SUBCATEGORY) return -1;
	return a.subcategory.localeCompare(b.subcategory, 'hu');
}
