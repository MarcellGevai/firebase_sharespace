// Sort options shared by the three "Összes" lists (Tárgyak, Szolgáltatások,
// Igények). Pure, so the ordering can be exercised without a browser.

export type SortKey = 'NEAREST' | 'NEWEST' | 'CHEAPEST';

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
	{ id: 'NEWEST', label: 'Legújabb' },
	{ id: 'NEAREST', label: 'Legközelebbi' },
	{ id: 'CHEAPEST', label: 'Legolcsóbb' }
];

/** Default: what the feed already did before there was a choice. */
export const DEFAULT_SORT: SortKey = 'NEAREST';

/**
 * A listing's price for ordering purposes.
 *
 * `price_range` is a label, not a number - the create form offers a fixed set of
 * buckets - so cheapest means ordering those buckets, using the bottom of each
 * range. Two of them name no price at all: "Megegyezés szerint" (by agreement)
 * and anything unrecognized from before the set settled. Those sort last rather
 * than as free, because sorting an unknown price as 0 would park it above every
 * genuinely free item and make the cheapest-first list lie.
 */
export function listingPriceRank(priceRange: string | null | undefined): number {
	const p = (priceRange ?? '').trim().toLowerCase();
	if (p === 'ingyenes') return 0;
	if (p === '1 000 - 5 000 ft') return 1000;
	if (p === '5 000 - 10 000 ft') return 5000;
	if (p === '10 000+ ft') return 10000;
	return Number.POSITIVE_INFINITY;
}

export type Sortable = {
	/** null when unpositioned, or the viewer has no baseline to measure from. */
	distanceKm: number | null;
	/** Epoch ms; 0 when the doc carries no usable timestamp. */
	createdMs: number;
	/** Comparable price; Infinity when there isn't one. */
	priceRank: number;
};

/**
 * The comparator for one sort choice.
 *
 * Every one of these tie-breaks on newest, so equal rows (same price bucket, no
 * distance) still come back in a stable, meaningful order rather than whatever
 * order the query happened to return.
 */
export function compareBy(sort: SortKey): (a: Sortable, b: Sortable) => number {
	if (sort === 'NEWEST') return (a, b) => b.createdMs - a.createdMs;

	if (sort === 'CHEAPEST') {
		return (a, b) => a.priceRank - b.priceRank || b.createdMs - a.createdMs;
	}

	// NEAREST. Unpositioned rows sink instead of sorting as 0 - the same rule the
	// feed used before this was a choice. With no baseline at all every row is
	// null, so this degrades to newest-first rather than to a random order.
	return (a, b) => {
		if (a.distanceKm == null && b.distanceKm == null) return b.createdMs - a.createdMs;
		if (a.distanceKm == null) return 1;
		if (b.distanceKm == null) return -1;
		return a.distanceKm - b.distanceKm || b.createdMs - a.createdMs;
	};
}
