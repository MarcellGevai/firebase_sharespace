<script lang="ts">
	import type { PageData } from './$types';
	import { ArrowLeft, MapPin, CalendarClock, MessageCircle, ShieldCheck } from 'lucide-svelte';
	import DefaultImage from '$lib/components/DefaultImage.svelte';
	import RequestModal from '$lib/components/RequestModal.svelte';
	import { chatUrl } from '$lib/chat';
	import { currentUser } from '$lib/auth';

	export let data: PageData;
	const { listing, owner } = data;

	let isModalOpen = $state(false);

	function goBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	}
</script>

<svelte:head>
	<title>{listing.title} - Sharespace</title>
</svelte:head>

<!-- Top Bar -->
<div class="fixed top-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-md border-b border-line flex items-center px-4 h-14">
	<button onclick={goBack} class="p-2 -ml-2 rounded-full hover:bg-raised transition-colors flex items-center gap-1 text-ink font-semibold">
		<ArrowLeft class="w-5 h-5" />
		<span>Vissza</span>
	</button>
</div>

<div class="min-h-screen bg-surface pb-28 pt-14">
	<!-- Hero Image -->
	<div class="relative w-full aspect-[4/3] sm:aspect-video bg-raised overflow-hidden">
		{#if listing.image_urls && listing.image_urls.length > 0}
			<div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full pointer-events-auto" style="scrollbar-width: none;">
				{#each listing.image_urls as imgUrl}
					{#if imgUrl && !imgUrl.includes('unsplash.com')}
						<div class="snap-center min-w-full h-full shrink-0">
							<img src={imgUrl} alt={listing.title} class="w-full h-full object-cover" />
						</div>
					{/if}
				{/each}
			</div>
		{:else if listing.image_url && !listing.image_url.includes('unsplash.com')}
			<img src={listing.image_url} alt={listing.title} class="w-full h-full object-cover" />
		{:else}
			<DefaultImage category={listing.category} class="w-full h-full" />
		{/if}
		
		<!-- Badges -->
		<div class="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-wider">
			{listing.type}
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-2xl mx-auto px-4 py-6">
		<div class="mb-6">
			{#if listing.category}
				<p class="text-primary font-semibold text-sm mb-2">{listing.category}{#if listing.subcategory} <span class="text-muted">›</span> {listing.subcategory}{/if}</p>
			{/if}
			<h1 class="text-2xl sm:text-3xl font-bold text-ink mb-3">{listing.title}</h1>
			
			<div class="flex items-center gap-4 text-sm font-medium text-ink/80 mb-6">
				{#if listing.price_per_day}
					<span class="text-lg font-bold text-primary">{listing.price_per_day} Ft/nap</span>
				{:else if listing.price_range}
					<span class="text-lg font-bold text-primary">{listing.price_range}</span>
				{/if}
				{#if listing.deposit}
					<span class="text-muted">·</span>
					<span class="text-muted">Kaució: {listing.deposit} Ft</span>
				{/if}
			</div>
		</div>

		<!-- Owner Mini-Profile -->
		<a href={`/profile/${owner.id}`} class="flex items-center gap-4 p-4 bg-raised rounded-2xl border border-line mb-8 hover:border-primary-line transition-colors group">
			<img src={owner.avatar_url} alt={owner.name} class="w-14 h-14 rounded-full object-cover bg-surface" />
			<div class="flex-1 min-w-0">
				<p class="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Hirdető</p>
				<h3 class="font-bold text-ink group-hover:text-primary transition-colors truncate">{owner.name}</h3>
				<div class="flex items-center gap-3 mt-1 text-sm text-muted">
					{#if owner.location_name}
						<div class="flex items-center gap-1.5">
							<MapPin class="w-4 h-4" />
							<span class="truncate max-w-[120px]">{owner.location_name.split(',')[0]}</span>
						</div>
					{/if}
					<div class="flex items-center gap-1.5 text-star">
						<ShieldCheck class="w-4 h-4" />
						<span>{owner.rating ? owner.rating.toFixed(1) : 'Új'}</span>
					</div>
				</div>
			</div>
		</a>

		<!-- Description -->
		<div class="mb-8">
			<h2 class="text-lg font-bold text-ink mb-3">Leírás</h2>
			<p class="text-ink/80 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
		</div>

		<!-- Location (if any) -->
		{#if listing.location}
			<div class="mb-8">
				<h2 class="text-lg font-bold text-ink mb-3">Helyszín</h2>
				<div class="flex items-center gap-2 text-ink/80 p-4 bg-raised rounded-xl border border-line">
					<MapPin class="w-5 h-5 text-primary" />
					<span class="font-medium">{listing.location}</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Sticky Bottom CTA -->
<div class="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-t border-line p-4">
	<div class="max-w-2xl mx-auto flex items-center gap-3">
		{#if !$currentUser || $currentUser.id !== owner.id}
			<button 
				onclick={() => isModalOpen = true}
				class="flex-1 bg-primary hover:bg-primary-hover text-primary-fg font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
			>
				<CalendarClock class="w-5 h-5" />
				{listing.type === 'ITEM' ? 'Kölcsönzés kérése' : 'Szolgáltatás foglalása'}
			</button>
			<a 
				href={chatUrl(listing.id, owner.id)}
				class="p-3.5 text-muted hover:text-primary hover:bg-primary-soft rounded-2xl transition-colors border border-line hover:border-primary-line bg-surface"
			>
				<MessageCircle class="w-6 h-6" />
			</a>
		{:else}
			<div class="w-full text-center font-bold text-muted bg-raised py-3.5 rounded-2xl border border-line">
				Ez a te hirdetésed
			</div>
		{/if}
	</div>
</div>

<RequestModal
	isOpen={isModalOpen}
	{listing}
	{owner}
	onClose={() => isModalOpen = false}
/>
