<script lang="ts">
	import type { PageData } from './$types';
	import { ArrowLeft, MapPin, CalendarClock, MessageCircle, HandCoins } from 'lucide-svelte';
	import DefaultImage from '$lib/components/DefaultImage.svelte';
	import RequestModal from '$lib/components/RequestModal.svelte';
	import { chatUrl } from '$lib/chat';
	import { currentUser } from '$lib/auth';

	let { data }: { data: PageData } = $props();
	const { want, requester } = data;

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
	<title>{want.title} - Sharespace</title>
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
	<div class="relative w-full aspect-[4/3] sm:aspect-video bg-raised overflow-hidden border-b-4 border-want">
		{#if want.image_urls && want.image_urls.length > 0 && !want.image_urls[0].includes('unsplash.com')}
			<div class="flex overflow-x-auto snap-x snap-mandatory h-full w-full pointer-events-auto" style="scrollbar-width: none;">
				{#each want.image_urls as imgUrl}
					{#if imgUrl && !imgUrl.includes('unsplash.com')}
						<div class="snap-center min-w-full h-full shrink-0">
							<img src={imgUrl} alt={want.title} class="w-full h-full object-cover" />
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<DefaultImage category={want.category} type="request" class="w-full h-full" />
		{/if}
		
		<!-- Badges -->
		<div class="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
			<HandCoins class="w-4 h-4" />
			Igény
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-2xl mx-auto px-4 py-6">
		<div class="mb-6">
			{#if want.category}
				<p class="text-want font-semibold text-sm mb-2">{want.category}</p>
			{/if}
			<h1 class="text-2xl sm:text-3xl font-bold text-ink mb-3">{want.title}</h1>
			
			<div class="flex items-center gap-4 text-sm font-medium text-ink/80 mb-6 bg-want-soft p-4 rounded-xl border border-want-line">
				<div class="flex flex-col">
					<span class="text-xs text-want/80 uppercase font-bold tracking-wide">Költségvetés</span>
					<span class="text-lg font-bold text-want">{want.price_min} - {want.price_max} Ft</span>
				</div>
				<div class="w-px h-10 bg-want-line mx-2"></div>
				<div class="flex flex-col">
					<span class="text-xs text-want/80 uppercase font-bold tracking-wide">Tervezett idő</span>
					<span class="font-semibold text-ink">{want.date_from} — {want.date_to}</span>
				</div>
			</div>
		</div>

		<!-- Requester Mini-Profile -->
		<a href={`/profile/${requester.id}`} class="flex items-center gap-4 p-4 bg-raised rounded-2xl border border-line mb-8 hover:border-want-line transition-colors group">
			<img src={requester.avatar_url} alt={requester.name} class="w-14 h-14 rounded-full object-cover bg-surface" />
			<div class="flex-1 min-w-0">
				<p class="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Kereső</p>
				<h3 class="font-bold text-ink group-hover:text-want transition-colors truncate">{requester.name}</h3>
				<div class="flex items-center gap-3 mt-1 text-sm text-muted">
					{#if want.location_address}
						<div class="flex items-center gap-1.5">
							<MapPin class="w-4 h-4" />
							<span class="truncate max-w-[120px]">{want.location_address.split(',')[0]}</span>
						</div>
					{/if}
				</div>
			</div>
		</a>

		<!-- Description -->
		<div class="mb-8">
			<h2 class="text-lg font-bold text-ink mb-3">Részletek</h2>
			<p class="text-ink/80 leading-relaxed whitespace-pre-wrap">{want.description}</p>
		</div>
	</div>
</div>

<!-- Sticky Bottom CTA -->
<div class="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-t border-line p-4">
	<div class="max-w-2xl mx-auto flex items-center gap-3">
		{#if !$currentUser || $currentUser.id !== requester.id}
			<button 
				onclick={() => isModalOpen = true}
				class="flex-1 bg-want hover:bg-want-hover text-want-fg font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
			>
				<CalendarClock class="w-5 h-5" />
				Ajánlat küldése
			</button>
			<a 
				href={chatUrl(want.id, requester.id)}
				class="p-3.5 text-muted hover:text-want hover:bg-want-soft rounded-2xl transition-colors border border-line hover:border-want-line bg-surface"
			>
				<MessageCircle class="w-6 h-6" />
			</a>
		{:else}
			<div class="w-full text-center font-bold text-muted bg-raised py-3.5 rounded-2xl border border-line">
				Ez a te igényed
			</div>
		{/if}
	</div>
</div>

<RequestModal
	isOpen={isModalOpen}
	{want}
	onClose={() => isModalOpen = false}
/>
