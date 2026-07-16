<script lang="ts">
	import { Handshake, Undo2, Check, Star, Pencil } from 'lucide-svelte';
	import HandoverModal from './HandoverModal.svelte';
	import { handoverAction, updateDealTerms } from '$lib/data/requests';

	let { request, currentUser, otherUser }: { request: any, currentUser: any, otherUser: any } = $props();

	let showHandoverModal = $state(false);
	let actionInFlight = $state(false);

	let showEditTerms = $state(false);
	let editStartDate = $state('');
	let editEndDate = $state('');
	let editPrice = $state(0);
	let editSubmitting = $state(false);
	let editError = $state('');

	// Computed properties for the deal state
	let isRequester = $derived(request?.requester_id === currentUser.id);
	let isPending = $derived(request?.status === 'PENDING');
	let isAccepted = $derived(request?.status === 'ACCEPTED');
	let isRejected = $derived(request?.status === 'REJECTED');

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
		actionType:
			| 'init_handover'
			| 'accept_handover'
			| 'init_return'
			| 'accept_return'
			| 'accept_deal'
			| 'reject_deal'
	) {
		actionInFlight = true;
		try {
			await handoverAction(request.id, actionType);
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

	function confirmHandover() {
		handleAction('init_handover');
	}

	function openEditTerms() {
		showHandoverModal = false;
		editStartDate = request.start_date;
		editEndDate = request.end_date;
		editPrice = Number(request.price_offer) || 0;
		editError = '';
		showEditTerms = true;
	}

	async function saveTerms() {
		if (!editStartDate || !editEndDate) {
			editError = 'Kérlek add meg a kezdő és vég dátumot.';
			return;
		}
		if (new Date(editStartDate) > new Date(editEndDate)) {
			editError = 'A kezdő dátum nem lehet a vég dátum után.';
			return;
		}
		if (editPrice == null || editPrice < 0) {
			editError = 'Kérlek adj meg egy érvényes árat.';
			return;
		}
		editSubmitting = true;
		editError = '';
		try {
			await updateDealTerms(request.id, {
				start_date: editStartDate,
				end_date: editEndDate,
				price_offer: editPrice
			});
			window.location.reload();
		} catch (error) {
			console.error(error);
			editError = 'A módosítás nem sikerült.';
			editSubmitting = false;
		}
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
					{isRejected ? 'bg-red-100 text-red-700' : isClosed ? 'bg-gray-100 text-gray-600' : (isHandoverCompleted && !isReturnCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}">
					{#if isRejected}Elutasítva
					{:else if isClosed}Lezárva
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
			{#if isRejected}
				<span class="text-sm text-gray-500 italic">Az ajánlatot elutasították.</span>
			{:else if isPending}
				{#if !isRequester}
					<button onclick={() => handleAction('reject_deal')} class="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
						Visszautasít
					</button>
					<button onclick={() => handleAction('accept_deal')} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
						Ajánlat Elfogadása
					</button>
				{:else}
					<span class="text-sm text-gray-500 italic">Várakozás a tulajdonosra...</span>
				{/if}
			{:else if isAccepted && handoverStatus === 'PENDING'}
				<button onclick={openEditTerms} class="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1">
					<Pencil class="w-4 h-4" /> Részletek módosítása
				</button>
				{#if !isRequester}
					<button onclick={() => showHandoverModal = true} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1">
						<Handshake class="w-4 h-4" /> Csere / Átadás
					</button>
				{:else}
					<span class="text-sm text-gray-500 italic self-center">Várakozás a tulajdonosra az átadás indításához...</span>
				{/if}
			{:else if isHandoverInitiated}
				{#if isRequester}
					<button onclick={() => handleAction('accept_handover')} class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-1 animate-pulse shadow-[0_0_15px_rgba(22,163,74,0.5)]">
						<Check class="w-4 h-4" /> Átadás megerősítése!
					</button>
				{:else}
					<span class="text-sm text-gray-500 italic self-center">Várakozás a másik fél megerősítésére (5 percen belül)...</span>
				{/if}
			{:else if isHandoverCompleted}
				{#if isRequester}
					<button onclick={() => handleAction('init_return')} class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-1">
						<Undo2 class="w-4 h-4" /> Visszaadás indítása
					</button>
				{:else}
					<span class="text-sm text-gray-500 italic self-center">Bérlés alatt - a bérlő indítja a visszaadást.</span>
				{/if}
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

		{#if showEditTerms}
			<div class="border-t border-gray-100 pt-3 space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label for="edit_start" class="block text-xs font-semibold text-gray-700">Kezdő dátum</label>
						<input
							type="date"
							id="edit_start"
							bind:value={editStartDate}
							class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div class="space-y-1">
						<label for="edit_end" class="block text-xs font-semibold text-gray-700">Vég dátum</label>
						<input
							type="date"
							id="edit_end"
							bind:value={editEndDate}
							class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label for="edit_price" class="block text-xs font-semibold text-gray-700">Ár (HUF)</label>
					<input
						type="number"
						id="edit_price"
						bind:value={editPrice}
						min="0"
						class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				{#if editError}
					<p class="text-sm text-red-600">{editError}</p>
				{/if}
				<div class="flex justify-end gap-2">
					<button
						onclick={() => (showEditTerms = false)}
						class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
					>
						Mégsem
					</button>
					<button
						onclick={saveTerms}
						disabled={editSubmitting}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
					>
						{editSubmitting ? 'Mentés...' : 'Mentés'}
					</button>
				</div>
			</div>
		{/if}
	</div>

	{#if showHandoverModal}
		<HandoverModal
			{request}
			{otherUser}
			submitting={actionInFlight}
			onConfirm={confirmHandover}
			onModify={openEditTerms}
			onClose={() => (showHandoverModal = false)}
		/>
	{/if}
{/if}
