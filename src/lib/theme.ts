// Theme state. The `.dark` class on <html> is the single source of truth - it's
// already been set by the inline script in app.html before first paint, so this
// reads it back rather than re-deriving it and risking a disagreement.
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function current(): Theme {
	if (!browser) return 'light';
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export const theme = writable<Theme>(current());

export function setTheme(next: Theme): void {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', next === 'dark');
	try {
		// Storing is what pins the choice; until then app.html follows the OS.
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Private mode / storage blocked: the toggle still works for this session.
	}
	theme.set(next);
}

export function toggleTheme(): void {
	setTheme(current() === 'dark' ? 'light' : 'dark');
}
