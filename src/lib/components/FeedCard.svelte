<script lang="ts">
	import type { Listing, User } from '$lib/types';
	import TrustBadge from './TrustBadge.svelte';
	import RequestModal from './RequestModal.svelte';
	import { chatUrl } from '$lib/chat';
	import { MapPin, CalendarClock, MessageCircle } from 'lucide-svelte';

	let { listing, owner, currentUser }: { listing: any; owner: any; currentUser?: any } = $props();

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

<article class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
	<!-- Header / Owner Info -->
	<div class="p-4 flex items-center justify-between">
		<a href={`/profile/${owner.id}`} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
			<img src={owner.avatar_url} alt={owner.name} class="w-10 h-10 rounded-full object-cover bg-gray-100" />
			<div>
				<h3 class="font-semibold text-gray-900 leading-tight">{owner.name}</h3>
				<div class="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
					<MapPin class="w-3 h-3" />
					<span>{owner.location}</span>
				</div>
			</div>
		</a>
		<TrustBadge score={owner.trust_score} />
	</div>

	<!-- Image -->
	<div class="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 group">
		<img 
			src={listing.image_url} 
			alt={listing.title} 
			class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
		/>
		<div class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-gray-700 uppercase tracking-wide">
			{listing.type}
		</div>
		{#if listing.category}
			<div class="absolute bottom-3 left-3 bg-blue-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-white tracking-wide">
				{listing.category}
			</div>
		{/if}
		{#if listing.price_range}
			<div class="absolute bottom-3 right-3 bg-green-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-white tracking-wide">
				{listing.price_range}
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="p-4">
		<h2 class="text-xl font-bold text-gray-900 mb-2">{listing.title}</h2>
		<p class="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2">
			{listing.description}
		</p>
		
		<!-- Actions -->
		<div class="flex items-center gap-3 pt-4 border-t border-gray-100">
			{#if !currentUser || currentUser.id !== owner.id}
				<button 
					onclick={openModal}
					class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
				>
					<CalendarClock class="w-4 h-4" />
					Request to {listing.type === 'ITEM' ? 'Borrow' : 'Book'}
				</button>
				<button 
					onclick={handleMessage}
					class="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-gray-200 hover:border-blue-200"
				>
					<MessageCircle class="w-5 h-5" />
				</button>
			{:else}
				<div class="w-full text-center text-sm font-semibold text-gray-400 py-2.5">
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
