// OPTIONAL Cloud Functions. The app runs fully on the free Spark plan without
// these — everything they do has a client-side equivalent guarded by security
// rules. Deploy them only after upgrading to the Blaze plan (they need billing
// enabled) when you want server-authoritative hardening. They are *additive*:
// they don't duplicate anything the client already does.
//
//   firebase deploy --only functions
//
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

/**
 * Keep the denormalized `owner_trust_score` on every listing in sync when a
 * user's trust score changes. The client can't do this (it can only write its
 * own listings / the reviewee's rating fields), so this genuinely adds value.
 */
export const syncOwnerTrust = onDocumentUpdated('users/{uid}', async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	if (before.trust_score === after.trust_score) return;

	const uid = event.params.uid;
	const listings = await db.collection('listings').where('owner_id', '==', uid).get();
	if (listings.empty) return;

	const batch = db.batch();
	listings.forEach((d) => batch.update(d.ref, { owner_trust_score: after.trust_score }));
	await batch.commit();
});

/**
 * Hardened geocoding via Nominatim with a proper identifying User-Agent (which a
 * browser can't set). The client falls back to calling Nominatim directly, so
 * this is optional — call it from the client with httpsCallable('geocode') if
 * you'd rather route geocoding through the server.
 */
export const geocode = onCall(async (request) => {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Bejelentkezés szükséges.');
	const address = String(request.data?.address ?? '').trim();
	if (!address) throw new HttpsError('invalid-argument', 'A cím megadása kötelező.');

	const params = new URLSearchParams({ q: address, format: 'json', limit: '1', countrycodes: 'hu' });
	const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
		headers: { 'User-Agent': 'Firebase-Sharespace/1.0 (contact: you@email.hu)' }
	});
	if (!res.ok) return null;
	const results = (await res.json()) as Array<{ lat: string; lon: string }>;
	if (!results.length) return null;
	return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
});

export const sendRentalStartEmail = onDocumentUpdated('requests/{id}', async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	
	// Transition: HANDOVER_INITIATED -> HANDOVER_COMPLETED
	if (before.handover_status === 'HANDOVER_INITIATED' && after.handover_status === 'HANDOVER_COMPLETED') {
		// Import resend dynamically or at the top
		const { Resend } = await import('resend');
		
		// In a real prod setup we would use defineSecret, but for prototype we can use process.env
		const RESEND_API_KEY = process.env.RESEND_API_KEY;
		if (!RESEND_API_KEY) {
			console.error('RESEND_API_KEY is not defined in the environment.');
			return;
		}

		const resend = new Resend(RESEND_API_KEY);
		
		const ownerSnap = await db.collection('users').doc(after.owner_id).get();
		const renterSnap = await db.collection('users').doc(after.requester_id).get();
		
		const owner = ownerSnap.data();
		const renter = renterSnap.data();
		
		if (!owner?.email || !renter?.email) {
			console.log('Owner or Renter email missing.');
			return;
		}

		const itemName = after.item_title || 'Tárgy / Szolgáltatás';
		const expectedPrice = after.price_offer || 0;
		// Use Firestore timestamp or current date for the start date
		const startDate = after.actual_rental_start ? after.actual_rental_start.toDate() : new Date();
		const startStr = startDate.toLocaleString('hu-HU');
		
		const subject = `Bérlés megkezdődött: ${itemName}`;
		const html = `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #4CAF50;">A bérlés sikeresen megkezdődött!</h2>
				<p>A(z) <strong>${itemName}</strong> nevű tárgy/szolgáltatás bérlése hivatalosan elindult.</p>
				<ul>
					<li><strong>Kezdés ideje:</strong> ${startStr}</li>
					<li><strong>Várható napi/alkalmi díj:</strong> ${expectedPrice} Ft</li>
				</ul>
				<p>Jó használatot kíván a ShareSpace csapata!</p>
			</div>
		`;

		try {
			const { data, error } = await resend.emails.send({
				from: 'ShareSpace <onboarding@resend.dev>',
				to: [owner.email, renter.email],
				subject,
				html
			});

			if (error) {
				console.error('Failed to send rental start email:', error);
			} else {
				console.log('Rental start email sent successfully:', data?.id);
			}
		} catch (err) {
			console.error('Unexpected error sending email:', err);
		}
	}
});
