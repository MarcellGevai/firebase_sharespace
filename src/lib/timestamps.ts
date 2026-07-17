/**
 * Firestore Timestamp -> epoch ms, tolerant of the shapes seen across the app.
 *
 * A doc read back from the server carries a real Timestamp (toMillis), one
 * still in flight from a local write carries the plain {seconds} shape, and an
 * older doc may carry neither. Sorting must not care which.
 */
export function createdMs(ts: unknown): number {
	const t = ts as { toMillis?: () => number; seconds?: number } | null | undefined;
	if (!t) return 0;
	if (typeof t.toMillis === 'function') return t.toMillis();
	if (typeof t.seconds === 'number') return t.seconds * 1000;
	return 0;
}
