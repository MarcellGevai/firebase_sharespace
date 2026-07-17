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
