<script lang="ts">
	import type { Listing, User } from '$lib/types';
	import TrustBadge from './TrustBadge.svelte';
	import RequestModal from './RequestModal.svelte';
	import { chatUrl } from '$lib/chat';
	import { formatDistance } from '$lib/distance';
	import { timeAgoHU } from '$lib/timestamps';
	import { MapPin, CalendarClock, MessageCircle } from 'lucide-svelte';

	// distanceKm is null when either side has no coordinates, or when the viewer
	// has no baseline (signed out / no home coords) - render nothing then.
	let {
		listing,
		owner,
		currentUser,
		distanceKm = null
	}: { listing: any; owner: any; currentUser?: any; distanceKm?: number | null } = $props();

	let isModalOpen = $state(false);

	function openModal() {
		isModalOpen = true;
	}

	function closeModal() {
		isModalOpen = false;
	}

	function handleMessage() {
		if (!currentUser) {
			window.location.href = '/login';
			return;
		}
		window.location.href = chatUrl(listing.id, owner.id);
	}
</script>

<article class="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden hover:shadow-md transition-shadow duration-300">
	<!-- Header / Owner Info -->
	<div class="p-4 flex items-center justify-between">
		<a href={`/profile/${owner.id}`} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
			<img src={owner.avatar_url} alt={owner.name} class="w-10 h-10 rounded-full object-cover bg-raised" />
			<div>
				<h3 class="font-semibold text-ink leading-tight">{owner.name}</h3>
				<div class="flex items-center gap-1.5 text-xs text-muted mt-0.5">
					<MapPin class="w-3 h-3 shrink-0" />
					{#if owner.location}
						<span>{owner.location}</span>
					{/if}
					{#if distanceKm != null}
						{#if owner.location}
							<span class="text-faint" aria-hidden="true">·</span>
						{/if}
						<span class="font-semibold text-primary">{formatDistance(distanceKm)}</span>
					{/if}
					{#if listing.created_at}
						<span class="text-faint" aria-hidden="true">·</span>
						<span>{timeAgoHU(listing.created_at)}</span>
					{/if}
				</div>
			</div>
		</a>
		<TrustBadge score={owner.trust_score} />
	</div>

	<!-- Image -->
	<div class="relative aspect-[4/3] w-full overflow-hidden bg-raised group">
		<img 
			src={listing.image_url} 
			alt={listing.title} 
			class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
		/>
		<!-- Chips over the photo are dark glass, not brand green. They're labels,
		     not actions: filling them with the same green as the card's one real
		     button leaves nothing on the card looking more important than anything
		     else. Black glass also survives whatever colours the photo brings,
		     which a light chip does not. -->
		<div class="absolute top-3 right-3 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
			{listing.type}
		</div>
		{#if listing.category}
			<div class="absolute bottom-3 left-3 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-white tracking-wide">
				{listing.category}
			</div>
		{/if}
		{#if listing.price_range}
			<div class="absolute bottom-3 right-3 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-white tracking-wide">
				{listing.price_range}
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="p-4">
		<h2 class="text-xl font-bold text-ink mb-2">{listing.title}</h2>
		<p class="text-muted text-sm leading-relaxed mb-4 line-clamp-2">
			{listing.description}
		</p>
		
		<!-- Actions -->
		<div class="flex items-center gap-3 pt-4 border-t border-line">
			{#if !currentUser || currentUser.id !== owner.id}
				<button 
					onclick={openModal}
					class="flex-1 bg-primary hover:bg-primary-hover text-primary-fg font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
				>
					<CalendarClock class="w-4 h-4" />
					Request to {listing.type === 'ITEM' ? 'Borrow' : 'Book'}
				</button>
				<button 
					onclick={handleMessage}
					class="p-2.5 text-muted hover:text-primary hover:bg-primary-soft rounded-xl transition-colors border border-line hover:border-primary-line"
				>
					<MessageCircle class="w-5 h-5" />
				</button>
			{:else}
				<div class="w-full text-center text-sm font-semibold text-faint py-2.5">
					Saját hirdetés
				</div>
			{/if}
		</div>
	</div>
</article>

<RequestModal
	isOpen={isModalOpen}
	{listing}
	{owner}
	onClose={closeModal}
/>
