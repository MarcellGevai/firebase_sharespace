<script lang="ts">
	import { goto } from '$app/navigation';
	import { chatUrl } from '$lib/chat';
	import { X, CalendarClock, Search, CreditCard, ChevronLeft } from 'lucide-svelte';
	import { currentUser } from '$lib/auth';
	import { createRequest } from '$lib/data/requests';
	import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
	import { PUBLIC_STRIPE_KEY } from '$env/static/public';
	import { functions } from '$lib/firebase';
	import { httpsCallable } from 'firebase/functions';
	import { sendMessage } from '$lib/data/messages';
	import { createNotification } from '$lib/data/notifications';

	/**
	 * Two directions through the same deal:
	 *  - listing mode (`listing` + `owner`): I want your item. I'm the borrower.
	 *  - want mode (`want`): you asked for an item, I have one. I'm the lender.
	 *
	 * Roles on the deal are by function, never by who clicked: owner_id always
	 * provides the item, requester_id always receives it. The handover handshake
	 * depends on that (the owner initiates, the requester confirms receipt), so
	 * an offer on a want makes ME the owner and the want's author the requester.
	 */
	let {
		isOpen,
		listing = null,
		owner = null,
		want = null,
		onClose
	}: {
		isOpen: boolean;
		listing?: any;
		owner?: any;
		want?: any;
		onClose: () => void;
	} = $props();

	let startDate = $state('');
	let endDate = $state('');
	let message = $state('');
	
	// Stripe states
	let step = $state<'form' | 'payment'>('form');
	let stripe = $state<Stripe | null>(null);
	let elements = $state<StripeElements | null>(null);
	let paymentElementContainer: HTMLElement;
	let clientSecret = $state('');
	let paymentIntentId = $state('');
	
	let requiresPayment = $derived(!isOffer && owner?.stripeAccountId && listing?.price_per_day);
	let priceOffer = $state<number | ''>('');
	let recommendedPrice = $state(0);
	let isSubmitting = $state(false);
	let errorMsg = $state('');

	let isOffer = $derived(!!want);
	// What's being transacted, and who the other side is.
	let subjectId = $derived(isOffer ? want.id : listing?.id);
	let subjectTitle = $derived(isOffer ? want.title : (listing?.title ?? ''));
	let subjectImage = $derived(isOffer ? '' : (listing?.image_url ?? ''));
	let counterpartyId = $derived(isOffer ? want.requester_id : owner?.id);

	// A want already states the window it needs, so an offer is constrained by it
	// exactly the way a listing's FIXED availability constrains a request.
	let isFixedAvailability = $derived(isOffer ? true : listing?.availability_type === 'FIXED');
	let availabilityMin = $derived(
		isOffer ? want.date_from : isFixedAvailability ? listing?.available_from : undefined
	);
	let availabilityMax = $derived(
		isOffer ? want.date_to : isFixedAvailability ? listing?.available_until : undefined
	);

	$effect(() => {
		if (isOpen) {
			if (recommendedPrice === 0) {
				if (isOffer) {
					startDate = want.date_from ?? '';
					endDate = want.date_to ?? '';
				}
			}

			let newRec = 0;
			if (isOffer) {
				newRec = Math.round(((Number(want.price_min) || 0) + (Number(want.price_max) || 0)) / 2);
			} else if (listing?.price_per_day) {
				let days = 1;
				if (startDate && endDate) {
					const sDate = new Date(startDate);
					const eDate = new Date(endDate);
					if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
						days = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24)));
					}
				}
				newRec = days * listing.price_per_day;
			} else {
				newRec = recommendedPrice === 0 ? Math.floor(Math.random() * 5000) + 1000 : recommendedPrice;
			}

			if (newRec !== recommendedPrice) {
				if (priceOffer === recommendedPrice || priceOffer === '' || priceOffer === 0) {
					priceOffer = newRec;
				}
				recommendedPrice = newRec;
			}
		}
		if (!isOpen && recommendedPrice !== 0) {
			recommendedPrice = 0; // reset
			priceOffer = '';
			startDate = '';
			endDate = '';
			step = 'form';
			elements = null;
			clientSecret = '';
			paymentIntentId = '';
		}
	});

	async function handleContinueToPayment() {
		if (!requiresPayment) return handleSubmit();

		const me = $currentUser;
		if (!me) { goto('/login'); return; }
		if (!startDate || !endDate) { errorMsg = 'Kérlek válassz kezdő és végdátumot.'; return; }
		if (new Date(startDate) > new Date(endDate)) { errorMsg = 'A kezdő dátum nem lehet a vég dátum után.'; return; }
		
		isSubmitting = true;
		errorMsg = '';

		try {
			const sDate = new Date(startDate);
			const eDate = new Date(endDate);
			const rentalDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24)));

			const createRentHold = httpsCallable(functions, 'createRentHold');
			const result = await createRentHold({
				listingId: subjectId,
				rentalDays
			});
			const data = result.data as any;
			clientSecret = data.client_secret;
			paymentIntentId = data.id;

			if (!stripe) {
				stripe = await loadStripe(PUBLIC_STRIPE_KEY);
			}

			if (stripe && clientSecret) {
				elements = stripe.elements({
					clientSecret,
					appearance: { theme: 'flat' }
				});
				step = 'payment';
				
				setTimeout(() => {
					if (paymentElementContainer) {
						const paymentElement = elements!.create('payment');
						paymentElement.mount(paymentElementContainer);
					}
				}, 50);
			}
		} catch (err: any) {
			console.error('Stripe init error:', err);
			errorMsg = err?.message ?? 'Nem sikerült előkészíteni a fizetést.';
		} finally {
			isSubmitting = false;
		}
	}

	async function handlePaymentSubmit() {
		if (!stripe || !elements) return;
		isSubmitting = true;
		errorMsg = '';

		try {
			const { error, paymentIntent } = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: window.location.href,
				},
				redirect: 'if_required'
			});

			if (error) {
				errorMsg = error.message ?? 'Fizetési hiba történt.';
				isSubmitting = false;
				return;
			}

			if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
				const statusStr = paymentIntent.status === 'requires_capture' ? 'held' : 'captured';
				await handleSubmit(paymentIntent.id, statusStr);
			} else {
				errorMsg = 'Fizetés még feldolgozás alatt... (Kérjük próbáld újra)';
				isSubmitting = false;
			}
		} catch (err: any) {
			console.error('Stripe payment error:', err);
			errorMsg = err?.message ?? 'Fizetési hiba történt.';
			isSubmitting = false;
		}
	}

	async function handleSubmit(pIntentId?: string, pStatus?: 'held' | 'captured' | 'refunded') {
		const me = $currentUser;
		if (!me) {
			goto('/login');
			return;
		}
		if (!startDate || !endDate) {
			errorMsg = 'Kérlek válassz kezdő és végdátumot.';
			return;
		}
		if (new Date(startDate) > new Date(endDate)) {
			errorMsg = 'A kezdő dátum nem lehet a vég dátum után.';
			return;
		}
		if (isFixedAvailability) {
			if (availabilityMin && startDate < availabilityMin) {
				errorMsg = isOffer
					? `Az igény csak ${availabilityMin}-től szól.`
					: `A hirdetés csak ${availabilityMin}-től érhető el.`;
				return;
			}
			if (availabilityMax && endDate > availabilityMax) {
				errorMsg = isOffer
					? `Az igény csak ${availabilityMax}-ig szól.`
					: `A hirdetés csak ${availabilityMax}-ig érhető el.`;
				return;
			}
		}
		if (!priceOffer) {
			errorMsg = 'Kérlek adj meg egy ajánlott árat.';
			return;
		}

		isSubmitting = true;
		errorMsg = '';

		try {
			// 1. Create the deal. Whoever provides the item is owner_id regardless of
			//    who opened it, and the other party owes the first response.
			await createRequest({
				listing_id: subjectId,
				owner_id: isOffer ? me.id : owner.id,
				requester_id: isOffer ? want.requester_id : me.id,
				awaiting_response_from: counterpartyId,
				start_date: startDate,
				end_date: endDate,
				price_offer: Number(priceOffer),
				item_title: subjectTitle,
				item_image: subjectImage,
				paymentIntentId: pIntentId,
				paymentStatus: pStatus
			});

			// 2. Optional opening message to the other party.
			if (message && message.trim().length > 0) {
				await sendMessage({
					listing_id: subjectId,
					listing_title: subjectTitle,
					listing_image: subjectImage,
					sender_id: me.id,
					receiver_id: counterpartyId,
					content: message.trim()
				});
			}

			// 3. Notify them (links to their view of this conversation).
			await createNotification({
				user_id: counterpartyId,
				type: 'NEW_REQUEST',
				title: isOffer ? 'Új ajánlat érkezett!' : 'Új érdeklődés érkezett!',
				body: isOffer
					? `${me.name} ajánlatot tett a(z) "${subjectTitle}" igényedre.`
					: `${me.name} érdeklődik a(z) "${subjectTitle}" hirdetésed iránt.`,
				link: chatUrl(subjectId, me.id)
			});

			// Success! Close modal and reset
			startDate = '';
			endDate = '';
			message = '';
			onClose();

			// Redirect to the shared conversation, where DealManager now has a deal.
			goto(chatUrl(subjectId, counterpartyId));
		} catch (err: any) {
			console.error('Request submit failed:', err);
			errorMsg = err?.message ?? 'Hiba történt a kérés elküldésekor.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isOpen && (listing || want)}
	<!-- Backdrop -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-sm transition-opacity">

		<!-- Modal Content -->
		<div class="bg-surface rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative" role="dialog" aria-modal="true">

			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-line">
				<h2 class="text-lg font-bold text-ink">
					{#if isOffer}
						Ajánlat tétel
					{:else}
						Request {listing.type === 'ITEM' ? 'Item' : 'Service'}
					{/if}
				</h2>
				<button onclick={onClose} class="p-2 text-faint hover:text-muted hover:bg-raised rounded-full transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-4 space-y-4">

				<!-- Subject preview. Wants carry no photo, so they get a glyph tile. -->
				<div class="flex items-center gap-4 p-3 bg-raised rounded-xl">
					{#if isOffer}
						<div class="w-16 h-16 rounded-lg bg-want-soft text-want flex items-center justify-center flex-shrink-0">
							<Search class="w-6 h-6" />
						</div>
						<div class="min-w-0">
							<h3 class="font-semibold text-ink truncate">{want.title}</h3>
							<p class="text-xs text-want uppercase font-semibold tracking-wide">Igény</p>
							{#if want.price_min != null && want.price_max != null}
								<p class="text-xs text-muted mt-0.5">Elképzelt ár: {want.price_min} – {want.price_max} Ft</p>
							{/if}
						</div>
					{:else}
						<img src={listing.image_url} alt={listing.title} class="w-16 h-16 rounded-lg object-cover bg-raised" />
						<div>
							<h3 class="font-semibold text-ink">{listing.title}</h3>
							<p class="text-xs text-muted uppercase font-semibold tracking-wide">{listing.type}</p>
						</div>
					{/if}
				</div>

				{#if isFixedAvailability && step === 'form'}
					<p class="text-xs text-primary bg-primary-soft border border-primary-line rounded-lg px-3 py-2">
						{#if isOffer}
							Erre az igényre {availabilityMin} és {availabilityMax} között lehet ajánlatot tenni.
						{:else}
							Ez a hirdetés csak {availabilityMin} és {availabilityMax} között érhető el.
						{/if}
					</p>
				{/if}

				{#if step === 'payment'}
					<div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900 mb-4">
						<p class="font-semibold mb-1 flex items-center gap-1.5"><CreditCard class="w-4 h-4"/> Biztonságos Fizetés</p>
						<p class="text-indigo-700">Az összeg most csak <strong class="font-bold">zárolásra</strong> kerül a kártyádon. Csak akkor vonjuk le, ha a tulajdonos elfogadja a kérést.</p>
					</div>
					<div bind:this={paymentElementContainer} class="min-h-[200px]"></div>
				{:else}
				<!-- Form -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<label for="start_date" class="block text-sm font-semibold text-ink">Start Date</label>
						<input
							type="date"
							id="start_date"
							bind:value={startDate}
							min={availabilityMin}
							max={availabilityMax}
							class="w-full px-3 py-2 bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
						/>
					</div>
					<div class="space-y-1.5">
						<label for="end_date" class="block text-sm font-semibold text-ink">End Date</label>
						<input
							type="date"
							id="end_date"
							bind:value={endDate}
							min={availabilityMin}
							max={availabilityMax}
							class="w-full px-3 py-2 bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
						/>
					</div>
				</div>

				<!-- Price Offer -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<label for="price_offer" class="block text-sm font-semibold text-ink">Ajánlott ár (HUF)</label>
						<span class="text-xs font-medium text-primary bg-primary-soft px-2 py-0.5 rounded-full">Ajánlott: {recommendedPrice} Ft</span>
					</div>
					<input 
						type="number" 
						id="price_offer" 
						bind:value={priceOffer}
						disabled={requiresPayment}
						placeholder="Add meg az összeget..."
						class="w-full px-3 py-2 bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-semibold disabled:opacity-50 disabled:bg-raised disabled:cursor-not-allowed"
					/>
					{#if requiresPayment}
						<p class="text-xs text-muted mt-1">Stripe fizetés esetén az ár nem módosítható, automatikusan a napi árból kalkulálódik.</p>
					{/if}
				</div>

				<!-- Message -->
				<div class="space-y-1.5">
					<label for="message" class="block text-sm font-semibold text-ink">
						{isOffer ? 'Üzenet (opcionális)' : 'Message to Owner (Optional)'}
					</label>
					<textarea 
						id="message" 
						bind:value={message}
						rows="3" 
						placeholder="Hi! I'd love to borrow this..."
						class="w-full px-3 py-2 bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
					></textarea>
				</div>
				{/if} <!-- close step === form -->

				{#if errorMsg}
					<p class="text-sm text-want bg-want-soft p-3 rounded-lg">{errorMsg}</p>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-4 bg-raised border-t border-line flex justify-end gap-3">
				{#if step === 'payment'}
					<button 
						onclick={() => step = 'form'} 
						disabled={isSubmitting}
						class="px-4 py-2.5 text-sm font-semibold text-muted hover:bg-surface rounded-xl transition-colors flex items-center gap-1.5"
					>
						<ChevronLeft class="w-4 h-4" /> Vissza
					</button>
					<div class="flex-1"></div>
					<button 
						onclick={handlePaymentSubmit} 
						disabled={isSubmitting}
						class="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if isSubmitting}
							<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Feldolgozás...
						{:else}
							<CreditCard class="w-4 h-4" />
							Fizetés és Foglalás
						{/if}
					</button>
				{:else}
					<button 
						onclick={onClose} 
						class="px-5 py-2.5 text-sm font-semibold text-muted hover:bg-raised rounded-xl transition-colors"
					>
						Mégsem
					</button>
					<button 
						onclick={handleContinueToPayment} 
						disabled={isSubmitting}
						class="px-5 py-2.5 text-sm font-semibold text-primary-fg bg-primary hover:bg-primary-hover rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if isSubmitting}
							<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Kérjük várjon...
						{:else if requiresPayment}
							Tovább a fizetéshez
						{:else}
							<CalendarClock class="w-4 h-4" />
							{isOffer ? 'Ajánlat elküldése' : 'Igény leadása'}
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
