<script lang="ts">
	import type { Want } from '$lib/types';
	import { formatDistance } from '$lib/distance';
	import RequestModal from './RequestModal.svelte';
	import { Search, Calendar, MapPin, HandCoins } from 'lucide-svelte';

	// null when the want predates carrying a location, or the viewer has no
	// baseline to measure from.
	let {
		want,
		currentUser,
		distanceKm = null
	}: { want: Want; currentUser?: any; distanceKm?: number | null } = $props();

	let isOfferOpen = $state(false);

	// Offering opens the same deal flow a listing uses, rather than a bare chat:
	// it creates the transaction, so the conversation opens with the deal panel
	// already on top of the message wall.
	function handleOffer() {
		if (!currentUser) {
			window.location.href = '/login';
			return;
		}
		isOfferOpen = true;
	}

	function formatDate(d: string) {
		return new Date(d).toLocaleDateString('hu-HU');
	}
</script>

<article class="bg-surface rounded-2xl shadow-sm border-2 border-want-line overflow-hidden hover:shadow-md transition-shadow duration-300">
	<!-- Header / Requester Info -->
	<div class="p-4 flex items-center justify-between">
		<a href={`/profile/${want.requester_id}`} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
			<img src={want.requester_avatar_url} alt={want.requester_name} class="w-10 h-10 rounded-full object-cover bg-raised" />
			<div>
				<h3 class="font-semibold text-ink leading-tight">{want.requester_name}</h3>
				<!-- Same slot and styling as FeedCard's, so distance reads the same on
				     both sides of the feed. A want carries no coarse town field to sit
				     next to it, so the pin and the distance travel together. -->
				{#if distanceKm != null}
					<div class="flex items-center gap-1.5 text-xs text-muted mt-0.5">
						<MapPin class="w-3 h-3 shrink-0" />
						<span class="font-semibold text-primary">{formatDistance(distanceKm)}</span>
					</div>
				{/if}
			</div>
		</a>
		<span class="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-want bg-want-soft px-2.5 py-1 rounded-full flex-shrink-0">
			<Search class="w-3 h-3" /> Igény
		</span>
	</div>

	<!-- Content -->
	<div class="px-4 pb-4">
		<h2 class="text-xl font-bold text-ink mb-1">{want.title}</h2>
		{#if want.category}
			<span class="inline-block text-[10px] font-semibold uppercase tracking-wide text-want bg-want-soft px-2 py-0.5 rounded-full mb-2">
				{want.category}
			</span>
		{/if}
		{#if want.description}
			<p class="text-muted text-sm leading-relaxed mb-3 line-clamp-2">{want.description}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mb-4">
			<span class="flex items-center gap-1">
				<Calendar class="w-3.5 h-3.5" />
				{formatDate(want.date_from)} - {formatDate(want.date_to)}
			</span>
			<span class="font-bold text-want">{want.price_min} - {want.price_max} Ft</span>
		</div>

		<!-- Actions -->
		{#if !currentUser || currentUser.id !== want.requester_id}
			<button
				onclick={handleOffer}
				class="w-full bg-want hover:bg-want-hover text-want-fg font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
			>
				<HandCoins class="w-4 h-4" />
				Ajánlat tétel
			</button>
		{:else}
			<div class="w-full text-center text-sm font-semibold text-faint py-2.5">
				Saját igényed
			</div>
		{/if}
	</div>
</article>

<RequestModal isOpen={isOfferOpen} {want} onClose={() => (isOfferOpen = false)} />
