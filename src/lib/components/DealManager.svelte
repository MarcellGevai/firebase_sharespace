<script lang="ts">
	import { Handshake, Undo2, Check, Star } from 'lucide-svelte';
	import HandoverModal from './HandoverModal.svelte';
	import { handoverAction, type HandoverTerms } from '$lib/data/requests';

	let { request, currentUser, otherUser }: { request: any, currentUser: any, otherUser: any } = $props();

	let showHandoverModal = $state(false);
	let actionInFlight = $state(false);

	// Computed properties for the deal state
	let isRequester = $derived(request?.requester_id === currentUser.id);
	let isPending = $derived(request?.status === 'PENDING');
	let isAccepted = $derived(request?.status === 'ACCEPTED');
	
	let handoverStatus = $derived(request?.handover_status || 'PENDING');
	
	let isHandoverInitiated = $derived(handoverStatus === 'HANDOVER_INITIATED');
	let isHandoverCompleted = $derived(handoverStatus === 'HANDOVER_COMPLETED');
	let isReturnInitiated = $derived(handoverStatus === 'RETURN_INITIATED');
	let isReturnCompleted = $derived(handoverStatus === 'RETURN_COMPLETED');
	let isClosed = $derived(handoverStatus === 'CLOSED');

	// Both parties must review; the CTA stays until THIS user has submitted theirs.
	let hasReviewed = $derived(request?.has_reviewed === true);
	let needsReview = $derived((isReturnCompleted || isClosed) && !hasReviewed);

	async function handleAction(
		actionType: 'init_handover' | 'accept_handover' | 'init_return' | 'accept_return' | 'accept_deal',
		extra: { terms?: HandoverTerms } = {}
	) {
		actionInFlight = true;
		try {
			await handoverAction(request.id, actionType, extra.terms);
			window.location.reload();
		} catch (error) {
			console.error(error);
			// A denied "accept" almost always means the 5-minute confirmation
			// window (enforced by the security rules) has elapsed. Roll the step
			// back so the parties can restart it.
			if (actionType === 'accept_handover' || actionType === 'accept_return') {
				try {
					await handoverAction(
						request.id,
						actionType === 'accept_handover' ? 'reset_handover' : 'reset_return'
					);
				} catch (e) {
					console.error('reset failed', e);
				}
				alert('Az 5 perces időablak lejárt, indítsd újra!');
			} else {
				alert('Hiba történt a művelet során.');
			}
			actionInFlight = false;
		}
	}

	function confirmHandover(terms: HandoverTerms) {
		handleAction('init_handover', { terms });
	}
	
	function formatDate(dStr: string) {
		return new Date(dStr).toLocaleDateString('hu-HU');
	}
</script>

{#if request}
	<div class="bg-white border-b border-gray-100 p-4 shrink-0 flex flex-col gap-3 shadow-sm z-10">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-bold text-gray-900 flex items-center gap-2">
					<Handshake class="w-5 h-5 text-blue-600" />
					Bérlési tranzakció
				</h3>
				<p class="text-sm text-gray-500">
					{formatDate(request.start_date)} - {formatDate(request.end_date)}
				</p>
			</div>
			<div class="text-right">
				<span class="block text-lg font-bold text-blue-600">{request.price_offer} Ft</span>
				<span class="text-xs font-semibold px-2 py-1 rounded-full 
					{isClosed ? 'bg-gray-100 text-gray-600' : (isHandoverCompleted && !isReturnCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}">
					{#if isClosed}Lezárva
					{:else if isReturnCompleted}Visszaadva, Értékelésre vár
					{:else if isReturnInitiated}Visszaadás folyamatban...
					{:else if isHandoverCompleted}Bérlés alatt (Zöld)
					{:else if isHandoverInitiated}Átadás folyamatban (5 perc)...
					{:else if isAccepted}Elfogadva, Átadásra vár
					{:else}Függőben{/if}
				</span>
			</div>
		</div>

		<div class="flex gap-2 justify-end mt-2">
			{#if isPending}
				{#if !isRequester}
					<button onclick={() => handleAction('accept_deal')} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
						Ajánlat Elfogadása
					</button>
				{:else}
					<span class="text-sm text-gray-500 italic">Várakozás a tulajdonosra...</span>
				{/if}
			{:else if isAccepted && handoverStatus === 'PENDING'}
				<button onclick={() => showHandoverModal = true} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1">
					<Handshake class="w-4 h-4" /> Csere / Átadás
				</button>
			{:else if isHandoverInitiated}
				<button onclick={() => handleAction('accept_handover')} class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-1 animate-pulse shadow-[0_0_15px_rgba(22,163,74,0.5)]">
					<Check class="w-4 h-4" /> Átadás megerősítése!
				</button>
			{:else if isHandoverCompleted}
				<button onclick={() => handleAction('init_return')} class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-1">
					<Undo2 class="w-4 h-4" /> Visszaadás indítása
				</button>
			{:else if isReturnInitiated}
				<button onclick={() => handleAction('accept_return')} class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-1 animate-pulse shadow-[0_0_15px_rgba(22,163,74,0.5)]">
					<Check class="w-4 h-4" /> Visszaadás megerősítése!
				</button>
			{:else if needsReview}
				<a href={`/review/${request.id}`} class="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors flex items-center gap-1 animate-pulse">
					<Star class="w-4 h-4" /> Értékelés leadása
				</a>
			{:else if hasReviewed && !isClosed}
				<span class="text-sm text-gray-500 italic flex items-center gap-1">
					<Check class="w-4 h-4 text-green-600" /> Értékelésed leadva – várakozás a másik félre...
				</span>
			{/if}
		</div>
	</div>

	{#if showHandoverModal}
		<HandoverModal
			{request}
			{otherUser}
			submitting={actionInFlight}
			onConfirm={confirmHandover}
			onClose={() => (showHandoverModal = false)}
		/>
	{/if}
{/if}
