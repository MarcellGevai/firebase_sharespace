import { Wrench, Smartphone, Home, Sprout, Dumbbell, Handshake, Sparkles, Package } from 'lucide-svelte';

export const CATEGORIES = [
    'Szerszámok',
    'Elektronika',
    'Háztartás',
    'Kert',
    'Sport',
    'Szolgáltatás',
    'Egyéb'
];

// Glyph per category for the feed's grouped list. Keyed case-folded: categories
// on older listings are free text ('Tevékenységek' predates CATEGORIES), so the
// lookup can't assume an exact match and falls back to a neutral box rather
// than punching a hole in the grid.
const ICONS: Record<string, typeof Package> = {
    'szerszámok': Wrench,
    'elektronika': Smartphone,
    'háztartás': Home,
    'kert': Sprout,
    'sport': Dumbbell,
    'szolgáltatás': Handshake,
    'tevékenységek': Sparkles,
    'egyéb': Package
};

export function categoryIcon(category: string): typeof Package {
    return ICONS[category.trim().toLowerCase()] ?? Package;
}

/**
 * The second level: what a category expands into in the grouped list.
 *
 * A fixed taxonomy rather than free text on purpose - the point of this level is
 * that things pile up on the same row, and typed values drift ("fúró" / "furo" /
 * "fúrógép") until every row reads (1), which is exactly what grouping by the
 * free-text title already did.
 *
 * Keyed case-folded for the same reason ICONS is: `category` on older listings
 * is free text and need not match CATEGORIES exactly.
 *
 * 'Egyéb' has none deliberately: it's already the bucket for things that don't
 * fit, and a taxonomy under it would just be a second guess at the same thing.
 */
const SUBCATEGORIES: Record<string, string[]> = {
    'szerszámok': ['Fúró', 'Csavarhúzó', 'Fűrész', 'Kalapács', 'Csiszoló', 'Létra', 'Mérőeszköz', 'Egyéb szerszám'],
    'elektronika': ['Laptop', 'Telefon', 'Kamera', 'Hangfal', 'Projektor', 'Konzol', 'Egyéb elektronika'],
    'háztartás': ['Konyhai gép', 'Porszívó', 'Mosógép', 'Bútor', 'Edény', 'Egyéb háztartási'],
    'kert': ['Fűnyíró', 'Sövényvágó', 'Kerti szerszám', 'Grill', 'Sátor', 'Egyéb kerti'],
    'sport': ['Kerékpár', 'Sí / Snowboard', 'Kempingfelszerelés', 'Labda', 'Fitnesz', 'Egyéb sport'],
    'szolgáltatás': ['Oktatás', 'Szerelés', 'Szállítás', 'Kertészet', 'Takarítás', 'Rendezvény', 'Egyéb szolgáltatás'],
    'tevékenységek': ['Oktatás', 'Szerelés', 'Szállítás', 'Kertészet', 'Takarítás', 'Rendezvény', 'Egyéb szolgáltatás']
};

export function subcategoriesFor(category: string | null | undefined): string[] {
    return SUBCATEGORIES[(category ?? '').trim().toLowerCase()] ?? [];
}

/** Row label for listings predating the field, or in a category with no taxonomy. */
export const NO_SUBCATEGORY = 'Nincs megadva';
