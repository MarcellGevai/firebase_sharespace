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

export function timeAgoHU(ts: unknown): string {
	const ms = createdMs(ts);
	if (!ms) return '';
	
	const diff = Math.max(0, Date.now() - ms);
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return 'épp most';
	if (minutes < 60) return `${minutes} perce`;
	
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} órája`;
	
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} napja`;
	
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} hónapja`;
	
	const years = Math.floor(days / 365);
	return `${years} éve`;
}
