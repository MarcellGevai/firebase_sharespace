<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/auth';
	import { getMyRentals } from '$lib/data/requests';
	import { getUserProfile } from '$lib/data/users';
	import { getListing } from '$lib/data/listings';
	import { chatUrl } from '$lib/chat';
	import { Clock, CheckCircle2, ArrowRight } from 'lucide-svelte';
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

	// Firestore Timestamp -> epoch ms, tolerant of the shapes seen across the app
	// (real Timestamp objects client-side, {seconds,nanoseconds} after a reload).
	function tsToMs(ts: any): number | null {
		if (!ts) return null;
		if (typeof ts.toDate === 'function') return ts.toDate().getTime();
		if (typeof ts.seconds === 'number') return ts.seconds * 1000;
		return null;
	}

	function formatDuration(ms: number): string {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		if (days > 0) return `${days}n ${hours}ó ${minutes}p`;
		if (hours > 0) return `${hours}ó ${minutes}p`;
		return `${minutes}p ${seconds}mp`;
	}

	onMount(() => {
		const tickInterval = setInterval(() => (now = Date.now()), 1000);

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
						listingTitle: listing?.title ?? 'Törölt hirdetés',
						listingImage: listing?.image_url ?? '',
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

<div class="max-w-2xl mx-auto space-y-8">
	<h1 class="text-2xl font-bold text-gray-900">Bérléseim</h1>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
		</div>
	{:else}
		<section class="space-y-3">
			<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
				<Clock class="w-5 h-5 text-green-600" />
				Aktív bérlések
			</h2>
			{#if activeRentals.length === 0}
				<p class="text-sm text-gray-500">Jelenleg nincs aktív bérlésed.</p>
			{:else}
				{#each activeRentals as row (row.request.id)}
					{@const startMs = tsToMs(row.request.actual_rental_start)}
					<a
						href={chatUrl(row.request.listing_id, row.isOwner ? row.request.requester_id : row.request.owner_id)}
						class="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
					>
						<img src={row.listingImage} alt={row.listingTitle} class="w-14 h-14 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
						<div class="flex-1 min-w-0">
							<p class="font-semibold text-gray-900 truncate">{row.listingTitle}</p>
							<p class="text-xs text-gray-500">
								{row.isOwner ? 'Bérbe adva neki:' : 'Bérelve tőle:'} {row.otherUserName}
							</p>
							{#if row.request.handover_status === 'RETURN_INITIATED'}
								<p class="text-xs font-semibold text-purple-600 mt-1">Visszaadás folyamatban...</p>
							{:else if startMs}
								<p class="text-sm font-bold text-green-600 mt-1">{formatDuration(now - startMs)} eltelt</p>
							{:else}
								<p class="text-xs text-gray-400 mt-1">Kezdés ideje ismeretlen</p>
							{/if}
						</div>
						<ArrowRight class="w-4 h-4 text-gray-300 flex-shrink-0" />
					</a>
				{/each}
			{/if}
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
				<CheckCircle2 class="w-5 h-5 text-gray-400" />
				Lezárt bérlések
			</h2>
			{#if completedRentals.length === 0}
				<p class="text-sm text-gray-500">Még nincs lezárt bérlésed.</p>
			{:else}
				{#each completedRentals as row (row.request.id)}
					{@const startMs = tsToMs(row.request.actual_rental_start)}
					{@const endMs = tsToMs(row.request.actual_rental_end)}
					<a
						href={chatUrl(row.request.listing_id, row.isOwner ? row.request.requester_id : row.request.owner_id)}
						class="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
					>
						<img src={row.listingImage} alt={row.listingTitle} class="w-14 h-14 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
						<div class="flex-1 min-w-0">
							<p class="font-semibold text-gray-900 truncate">{row.listingTitle}</p>
							<p class="text-xs text-gray-500">
								{row.isOwner ? 'Bérbe adva neki:' : 'Bérelve tőle:'} {row.otherUserName}
							</p>
							{#if startMs && endMs}
								<p class="text-sm font-bold text-gray-600 mt-1">Teljes időtartam: {formatDuration(endMs - startMs)}</p>
							{:else}
								<p class="text-xs text-gray-400 mt-1">Időtartam ismeretlen</p>
							{/if}
						</div>
						<ArrowRight class="w-4 h-4 text-gray-300 flex-shrink-0" />
					</a>
				{/each}
			{/if}
		</section>
	{/if}
</div>
