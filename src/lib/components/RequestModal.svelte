<script lang="ts">
	import { goto } from '$app/navigation';
	import { chatUrl } from '$lib/chat';
	import { X, CalendarClock } from 'lucide-svelte';
	import { currentUser } from '$lib/auth';
	import { createRequest } from '$lib/data/requests';
	import { sendMessage } from '$lib/data/messages';
	import { createNotification } from '$lib/data/notifications';

	let {
		isOpen, 
		listing, 
		owner,
		onClose 
	}: { 
		isOpen: boolean; 
		listing: any; 
		owner: any;
		onClose: () => void; 
	} = $props();

	let startDate = $state('');
	let endDate = $state('');
	let message = $state('');
	let priceOffer = $state<number | ''>('');
	let recommendedPrice = $state(0);
	let isSubmitting = $state(false);
	let errorMsg = $state('');

	$effect(() => {
		if (isOpen && recommendedPrice === 0) {
			recommendedPrice = Math.floor(Math.random() * 5000) + 1000;
			priceOffer = recommendedPrice;
		}
		if (!isOpen) {
			recommendedPrice = 0; // reset
		}
	});

	async function handleSubmit() {
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
		if (!priceOffer) {
			errorMsg = 'Kérlek adj meg egy ajánlott árat.';
			return;
		}

		isSubmitting = true;
		errorMsg = '';

		try {
			// 1. Create the deal request.
			await createRequest({
				listing_id: listing.id,
				owner_id: owner.id,
				requester_id: me.id,
				start_date: startDate,
				end_date: endDate,
				price_offer: Number(priceOffer)
			});

			// 2. Optional opening message to the owner.
			if (message && message.trim().length > 0) {
				await sendMessage({
					listing_id: listing.id,
					listing_title: listing.title,
					listing_image: listing.image_url,
					sender_id: me.id,
					receiver_id: owner.id,
					content: message.trim()
				});
			}

			// 3. Notify the owner (links to their view of this conversation).
			await createNotification({
				user_id: owner.id,
				type: 'NEW_REQUEST',
				title: 'Új érdeklődés érkezett!',
				body: `${me.name} érdeklődik a(z) "${listing.title}" hirdetésed iránt.`,
				link: chatUrl(listing.id, me.id)
			});

			// Success! Close modal and reset
			startDate = '';
			endDate = '';
			message = '';
			onClose();

			// Redirect to chat with the owner
			goto(chatUrl(listing.id, owner.id));
		} catch (err: any) {
			console.error('Request submit failed:', err);
			errorMsg = err?.message ?? 'Hiba történt a kérés elküldésekor.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isOpen && listing}
	<!-- Backdrop -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity">
		
		<!-- Modal Content -->
		<div class="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative" role="dialog" aria-modal="true">
			
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-100">
				<h2 class="text-lg font-bold text-gray-900">Request {listing.type === 'ITEM' ? 'Item' : 'Service'}</h2>
				<button onclick={onClose} class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-4 space-y-4">
				
				<!-- Listing Preview -->
				<div class="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
					<img src={listing.image_url} alt={listing.title} class="w-16 h-16 rounded-lg object-cover bg-gray-200" />
					<div>
						<h3 class="font-semibold text-gray-900">{listing.title}</h3>
						<p class="text-xs text-gray-500 uppercase font-semibold tracking-wide">{listing.type}</p>
					</div>
				</div>

				<!-- Form -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1.5">
						<label for="start_date" class="block text-sm font-semibold text-gray-700">Start Date</label>
						<input 
							type="date" 
							id="start_date" 
							bind:value={startDate}
							class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
						/>
					</div>
					<div class="space-y-1.5">
						<label for="end_date" class="block text-sm font-semibold text-gray-700">End Date</label>
						<input 
							type="date" 
							id="end_date" 
							bind:value={endDate}
							class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
						/>
					</div>
				</div>

				<!-- Price Offer -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<label for="price_offer" class="block text-sm font-semibold text-gray-700">Ajánlott ár (HUF)</label>
						<span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Ajánlott: {recommendedPrice} Ft</span>
					</div>
					<input 
						type="number" 
						id="price_offer" 
						bind:value={priceOffer}
						placeholder="Add meg az összeget..."
						class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-semibold"
					/>
				</div>

				<!-- Message -->
				<div class="space-y-1.5">
					<label for="message" class="block text-sm font-semibold text-gray-700">Message to Owner (Optional)</label>
					<textarea 
						id="message" 
						bind:value={message}
						rows="3" 
						placeholder="Hi! I'd love to borrow this..."
						class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
					></textarea>
				</div>

				{#if errorMsg}
					<p class="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errorMsg}</p>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
				<button 
					onclick={onClose} 
					class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
				>
					Cancel
				</button>
				<button 
					onclick={handleSubmit} 
					disabled={isSubmitting}
					class="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if isSubmitting}
						<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
						Sending...
					{:else}
						<CalendarClock class="w-4 h-4" />
						Submit Request
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
