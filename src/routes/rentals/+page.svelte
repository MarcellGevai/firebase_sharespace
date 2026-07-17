<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/auth';
	import { getMyRentals } from '$lib/data/requests';
	import { getUserProfile } from '$lib/data/users';
	import { getListing } from '$lib/data/listings';
	import { chatUrl } from '$lib/chat';
	import { Clock, CheckCircle2, ArrowRight } from 'lucide-svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import type { DealRequest } from '$lib/types';

	type RentalRow = {
		request: DealRequest;
		otherUserName: string;
		listingTitle: string;
		listingImage: string;
		isOwner: boolean;
	};

	let loading = $state(true);
	let activeRentals = $state<RentalRow[]>([]);
	let completedRentals = $state<RentalRow[]>([]);
	let now = $state(Date.now());

	// Both start rolled up. Expanding is the reader's choice to make, and a
	// section that opens on arrival isn't a choice they made.
	let openActive = $state(false);
	let openCompleted = $state(false);

	// Firestore Timestamp -> epoch ms, tolerant of the shapes seen across the app
	// (real Timestamp objects client-side, {seconds,nanoseconds} after a reload).
	function tsToMs(ts: any): number | null {
		if (!ts) return null;
		if (typeof ts.toDate === 'function') return ts.toDate().getTime();
		if (typeof ts.seconds === 'number') return ts.seconds * 1000;
		return null;
	}

	// Under a day, hours alone are too coarse to be useful (a 20-minute rental
	// would read "0 nap 0 óra"), so drop the dead "nap" and show minutes instead.
	// Past 24h the minutes stop earning their place and days/hours read better.
	function formatDuration(ms: number): string {
		const totalMinutes = Math.max(0, Math.floor(ms / 60000));
		const totalHours = Math.floor(totalMinutes / 60);
		if (totalHours < 24) {
			return `${totalHours} óra ${totalMinutes % 60} perc`;
		}
		return `${Math.floor(totalHours / 24)} nap ${totalHours % 24} óra`;
	}

	onMount(() => {
		// Finest unit shown is the minute, so a per-minute tick is exactly enough.
		const tickInterval = setInterval(() => (now = Date.now()), 60000);

		(async () => {
			const me = get(currentUser);
			if (!me) {
				goto('/login');
				return;
			}

			const requests = await getMyRentals(me.id);
			const relevant = requests.filter((r) =>
				['HANDOVER_COMPLETED', 'RETURN_INITIATED', 'RETURN_COMPLETED', 'CLOSED'].includes(
					r.handover_status
				)
			);

			const rows: RentalRow[] = await Promise.all(
				relevant.map(async (request) => {
					const isOwner = request.owner_id === me.id;
					const otherUserId = isOwner ? request.requester_id : request.owner_id;
					const [otherUser, listing] = await Promise.all([
						getUserProfile(otherUserId),
						getListing(request.listing_id)
					]);
					return {
						request,
						otherUserName: otherUser?.name ?? 'Ismeretlen felhasználó',
						// Prefer the snapshot on the deal: listing_id may point at a
						// /wants doc (an offer), and a listing can be deleted after the
						// fact. Deals predating the snapshot fall back to the lookup.
						listingTitle: request.item_title || listing?.title || 'Törölt hirdetés',
						listingImage: request.item_image || listing?.image_url || '',
						isOwner
					};
				})
			);

			activeRentals = rows.filter((r) =>
				['HANDOVER_COMPLETED', 'RETURN_INITIATED'].includes(r.request.handover_status)
			);
			completedRentals = rows.filter((r) =>
				['RETURN_COMPLETED', 'CLOSED'].includes(r.request.handover_status)
			);
			loading = false;
		})();

		return () => clearInterval(tickInterval);
	});
</script>

<svelte:head>
	<title>Bérléseim - Sharespace</title>
</svelte:head>

<!--
	One rental row. Both sections render the same card and differ only in the
	status line, so that line is passed in rather than the whole row duplicated.
-->
{#snippet rentalRow(row: RentalRow, status: Snippet)}
	<a
		href={chatUrl(row.request.listing_id, row.isOwner ? row.request.requester_id : row.request.owner_id)}
		class="flex items-center gap-4 p-4 hover:bg-raised transition-colors"
	>
		<img
			src={row.listingImage}
			alt={row.listingTitle}
			class="w-14 h-14 rounded-xl object-cover bg-raised flex-shrink-0"
		/>
		<div class="flex-1 min-w-0">
			<p class="font-semibold text-ink truncate">{row.listingTitle}</p>
			<p class="text-xs text-muted">
				{row.isOwner ? 'Bérbe adva neki:' : 'Bérelve tőle:'} {row.otherUserName}
			</p>
			{@render status()}
		</div>
		<ArrowRight class="w-4 h-4 text-faint flex-shrink-0" />
	</a>
{/snippet}

<div class="max-w-2xl mx-auto space-y-8">
	<h1 class="text-2xl font-bold text-ink">Bérléseim</h1>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-4 border-line border-t-primary rounded-full animate-spin"></div>
		</div>
	{:else}
		<div class="space-y-3">
			<CollapsibleSection
				label="Aktív bérlések"
				count={activeRentals.length}
				icon={Clock}
				iconClass="text-primary"
				bind:open={openActive}
			>
				{#if activeRentals.length === 0}
					<p class="text-sm text-muted p-4">Jelenleg nincs aktív bérlésed.</p>
				{:else}
					<ul class="divide-y divide-line">
						{#each activeRentals as row (row.request.id)}
							{@const startMs = tsToMs(row.request.actual_rental_start)}
							<li>
								{#snippet activeStatus()}
									{#if row.request.handover_status === 'RETURN_INITIATED'}
										<p class="text-xs font-semibold text-progress mt-1">Visszaadás folyamatban...</p>
									{:else if startMs}
										<p class="text-sm font-bold text-primary mt-1">{formatDuration(now - startMs)} eltelt</p>
									{:else}
										<p class="text-xs text-faint mt-1">Kezdés ideje ismeretlen</p>
									{/if}
								{/snippet}
								{@render rentalRow(row, activeStatus)}
							</li>
						{/each}
					</ul>
				{/if}
			</CollapsibleSection>

			<CollapsibleSection
				label="Lezárt bérlések"
				count={completedRentals.length}
				icon={CheckCircle2}
				iconClass="text-faint"
				bind:open={openCompleted}
			>
				{#if completedRentals.length === 0}
					<p class="text-sm text-muted p-4">Még nincs lezárt bérlésed.</p>
				{:else}
					<ul class="divide-y divide-line">
						{#each completedRentals as row (row.request.id)}
							{@const startMs = tsToMs(row.request.actual_rental_start)}
							{@const endMs = tsToMs(row.request.actual_rental_end)}
							<li>
								{#snippet completedStatus()}
									{#if startMs && endMs}
										<p class="text-sm font-bold text-muted mt-1">
											Teljes időtartam: {formatDuration(endMs - startMs)}
										</p>
									{:else}
										<p class="text-xs text-faint mt-1">Időtartam ismeretlen</p>
									{/if}
								{/snippet}
								{@render rentalRow(row, completedStatus)}
							</li>
						{/each}
					</ul>
				{/if}
			</CollapsibleSection>
		</div>
	{/if}
</div>
