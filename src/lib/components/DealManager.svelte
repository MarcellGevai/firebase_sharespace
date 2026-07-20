<script lang="ts">
	import { Handshake, Undo2, Check, Star, Pencil } from 'lucide-svelte';
	import HandoverModal from './HandoverModal.svelte';
	import { handoverAction, reviseAcceptedDeal, modifyOffer } from '$lib/data/requests';

	let { request, currentUser, otherUser }: { request: any, currentUser: any, otherUser: any } = $props();

	let showHandoverModal = $state(false);
	let actionInFlight = $state(false);

	let showEditTerms = $state(false);
	let editStartDate = $state('');
	let editEndDate = $state('');
	let editPrice = $state(0);
	let editSubmitting = $state(false);
	let editError = $state('');

	let showModifyOffer = $state(false);
	let modifyStartDate = $state('');
	let modifyEndDate = $state('');
	let modifyPrice = $state(0);
	let modifySubmitting = $state(false);
	let modifyError = $state('');

	// Computed properties for the deal state
	let isRequester = $derived(request?.requester_id === currentUser.id);
	let isPending = $derived(request?.status === 'PENDING');
	let isAccepted = $derived(request?.status === 'ACCEPTED');
	let isRejected = $derived(request?.status === 'REJECTED');
	// Pre-acceptance ping-pong negotiation: whoever awaiting_response_from
	// points to may accept/reject/counter-offer. Missing on old requests -
	// default to "owner's turn", matching the security rules' own fallback.
	let isMyTurn = $derived(
		request?.awaiting_response_from ? request.awaiting_response_from === currentUser.id : !isRequester
	);

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
			// The parent page's live listener (watchRequestForConversation) picks up
			// this write and updates `request` automatically - no reload needed.
			showHandoverModal = false;
			actionInFlight = false;
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
		// Revising sends the deal back to PENDING for the other party to accept,
		// so the turn passes to whoever isn't making the change.
		const nextResponder = isRequester ? request.owner_id : request.requester_id;
		try {
			await reviseAcceptedDeal(request.id, nextResponder, {
				start_date: editStartDate,
				end_date: editEndDate,
				price_offer: editPrice
			});
			showEditTerms = false;
			editSubmitting = false;
		} catch (error) {
			console.error(error);
			editError = 'A módosítás nem sikerült.';
			editSubmitting = false;
		}
	}

	function openModifyOffer() {
		modifyStartDate = request.start_date;
		modifyEndDate = request.end_date;
		modifyPrice = Number(request.price_offer) || 0;
		modifyError = '';
		showModifyOffer = true;
	}

	async function submitModifyOffer() {
		if (!modifyStartDate || !modifyEndDate) {
			modifyError = 'Kérlek add meg a kezdő és vég dátumot.';
			return;
		}
		if (new Date(modifyStartDate) > new Date(modifyEndDate)) {
			modifyError = 'A kezdő dátum nem lehet a vég dátum után.';
			return;
		}
		if (modifyPrice == null || modifyPrice < 0) {
			modifyError = 'Kérlek adj meg egy érvényes árat.';
			return;
		}
		modifySubmitting = true;
		modifyError = '';
		const nextResponder = isRequester ? request.owner_id : request.requester_id;
		try {
			await modifyOffer(request.id, nextResponder, {
				start_date: modifyStartDate,
				end_date: modifyEndDate,
				price_offer: modifyPrice
			});
			showModifyOffer = false;
			modifySubmitting = false;
		} catch (error) {
			console.error(error);
			modifyError = 'Az ajánlat módosítása nem sikerült.';
			modifySubmitting = false;
		}
	}

	function formatDate(dStr: string) {
		return new Date(dStr).toLocaleDateString('hu-HU');
	}
</script>

{#if request}
	<div class="bg-surface border-b border-line p-4 shrink-0 flex flex-col gap-3 shadow-sm z-10">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-bold text-ink flex items-center gap-2">
					<Handshake class="w-5 h-5 text-primary" />
					Bérlési tranzakció
				</h3>
				<p class="text-sm text-muted">
					{formatDate(request.start_date)} - {formatDate(request.end_date)}
				</p>
			</div>
			<div class="text-right">
				<span class="block text-lg font-bold text-primary">{request.price_offer} Ft</span>
				<span class="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
					{isRejected ? 'bg-want-soft text-want' : isClosed ? 'bg-raised text-muted' : (isHandoverCompleted && !isReturnCompleted ? 'bg-primary-soft text-primary' : 'bg-primary-soft text-primary')}">
					{#if isRejected}Elutasítva
					{:else if isClosed}Lezárva
					{:else if isReturnCompleted}Visszaadva
					{:else if isHandoverCompleted}Bérlés alatt
					{:else if isHandoverInitiated}Átadás folyamatban (5 perc)...
					{:else if isReturnInitiated}Visszaadás folyamatban (5 perc)...
					{:else if handoverStatus === 'PENDING'}Még nem indult el
					{:else if isAccepted}Elfogadva, Átadásra vár
					{:else}Függőben{/if}
				</span>
			</div>
		</div>

		<div class="flex gap-2 justify-end mt-2">
			{#if isRejected}
				<span class="text-sm text-muted italic">Az ajánlatot elutasították.</span>
			{:else if isPending}
				{#if isMyTurn}
					<button onclick={() => handleAction('reject_deal')} class="px-4 py-2 bg-surface border border-line text-muted rounded-lg text-sm font-semibold hover:bg-raised transition-colors">
						Visszautasít
					</button>
					<button onclick={openModifyOffer} class="px-4 py-2 bg-surface border border-line text-muted rounded-lg text-sm font-semibold hover:bg-raised transition-colors flex items-center gap-1">
						<Pencil class="w-4 h-4" /> Ajánlat módosítása
					</button>
					<button onclick={() => handleAction('accept_deal')} class="px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors">
						Ajánlat Elfogadása
					</button>
				{:else}
					<span class="text-sm text-muted italic">Várakozás a másik fél válaszára...</span>
				{/if}
			{:else if isAccepted && handoverStatus === 'PENDING'}
				<button onclick={openEditTerms} class="px-4 py-2 bg-surface border border-line text-muted rounded-lg text-sm font-semibold hover:bg-raised transition-colors flex items-center gap-1">
					<Pencil class="w-4 h-4" /> Részletek módosítása
				</button>
				{#if !isRequester}
					<button onclick={() => showHandoverModal = true} class="px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1">
						<Handshake class="w-4 h-4" /> Csere / Átadás
					</button>
				{:else}
					<span class="text-sm text-muted italic self-center">Várakozás a tulajdonosra az átadás indításához...</span>
				{/if}
			{:else if isHandoverInitiated}
				{#if isRequester}
					<button onclick={() => handleAction('accept_handover')} class="px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1 animate-pulse shadow-[0_0_15px_rgba(22,163,74,0.5)]">
						<Check class="w-4 h-4" /> Átadás megerősítése!
					</button>
				{:else}
					<span class="text-sm text-muted italic self-center">Várakozás a másik fél megerősítésére (5 percen belül)...</span>
				{/if}
			{:else if isHandoverCompleted}
				{#if isRequester}
					<button onclick={() => handleAction('init_return')} class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-progress transition-colors flex items-center gap-1">
						<Undo2 class="w-4 h-4" /> Visszaadás indítása
					</button>
				{:else}
					<span class="text-sm text-muted italic self-center">Bérlés alatt - a bérlő indítja a visszaadást.</span>
				{/if}
			{:else if isReturnInitiated}
				{#if !isRequester}
					<button onclick={() => handleAction('accept_return')} class="px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1 animate-pulse shadow-[0_0_15px_rgba(22,163,74,0.5)]">
						<Check class="w-4 h-4" /> Visszaadás megerősítése!
					</button>
				{:else}
					<span class="text-sm text-muted italic self-center">Várakozás a tulajdonos jóváhagyására (5 perc)...</span>
				{/if}
			{:else if needsReview}
				<a href={`/review/${request.id}`} class="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors flex items-center gap-1 animate-pulse">
					<Star class="w-4 h-4" /> Értékelés leadása
				</a>
			{:else if hasReviewed && !isClosed}
				<span class="text-sm text-muted italic flex items-center gap-1">
					<Check class="w-4 h-4 text-primary" /> Értékelésed leadva – várakozás a másik félre...
				</span>
			{/if}
		</div>

		{#if showEditTerms}
			<div class="border-t border-line pt-3 space-y-3">
				<p class="text-xs text-warn bg-warn-soft border border-warn rounded-lg px-3 py-2 flex items-start gap-1.5">
					<Pencil class="w-3.5 h-3.5 mt-0.5 shrink-0" />
					<span>A módosítást a másik félnek újra el kell fogadnia, és az átadás csak ezután indítható.</span>
				</p>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label for="edit_start" class="block text-xs font-semibold text-ink">Kezdő dátum</label>
						<input
							type="date"
							id="edit_start"
							bind:value={editStartDate}
							class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
					<div class="space-y-1">
						<label for="edit_end" class="block text-xs font-semibold text-ink">Vég dátum</label>
						<input
							type="date"
							id="edit_end"
							bind:value={editEndDate}
							class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label for="edit_price" class="block text-xs font-semibold text-ink">Ár (HUF)</label>
					<input
						type="number"
						id="edit_price"
						bind:value={editPrice}
						min="0"
						class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
				{#if editError}
					<p class="text-sm text-want">{editError}</p>
				{/if}
				<div class="flex justify-end gap-2">
					<button
						onclick={() => (showEditTerms = false)}
						class="px-4 py-2 text-sm font-semibold text-muted hover:bg-raised rounded-lg transition-colors"
					>
						Mégsem
					</button>
					<button
						onclick={saveTerms}
						disabled={editSubmitting}
						class="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
					>
						{editSubmitting ? 'Mentés...' : 'Mentés'}
					</button>
				</div>
			</div>
		{/if}

		{#if showModifyOffer}
			<div class="border-t border-line pt-3 space-y-3">
				<p class="text-xs text-muted flex items-center gap-1">
					<Pencil class="w-3.5 h-3.5" /> Új ajánlat küldése - a másik félnek kell rá válaszolnia.
				</p>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label for="mod_start" class="block text-xs font-semibold text-ink">Kezdő dátum</label>
						<input
							type="date"
							id="mod_start"
							bind:value={modifyStartDate}
							class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
					<div class="space-y-1">
						<label for="mod_end" class="block text-xs font-semibold text-ink">Vég dátum</label>
						<input
							type="date"
							id="mod_end"
							bind:value={modifyEndDate}
							class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label for="mod_price" class="block text-xs font-semibold text-ink">Ár (HUF)</label>
					<input
						type="number"
						id="mod_price"
						bind:value={modifyPrice}
						min="0"
						class="w-full px-3 py-2 bg-surface border border-line rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
				{#if modifyError}
					<p class="text-sm text-want">{modifyError}</p>
				{/if}
				<div class="flex justify-end gap-2">
					<button
						onclick={() => (showModifyOffer = false)}
						class="px-4 py-2 text-sm font-semibold text-muted hover:bg-raised rounded-lg transition-colors"
					>
						Mégsem
					</button>
					<button
						onclick={submitModifyOffer}
						disabled={modifySubmitting}
						class="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
					>
						{modifySubmitting ? 'Küldés...' : 'Ajánlat küldése'}
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
