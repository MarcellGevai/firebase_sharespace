<script lang="ts">
	import FeedCard from '$lib/components/FeedCard.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	let activeFilter = $state('ALL');

	let activeCategory = $derived($page.url.searchParams.get('category'));

	let filteredItems = $derived(data.items.filter((item: any) => {
		let typeMatch = true;
		if (activeFilter === 'ITEMS') typeMatch = item.listing.type === 'ITEM';
		if (activeFilter === 'SERVICES') typeMatch = item.listing.type === 'SERVICE';

		let categoryMatch = true;
		if (activeCategory) {
			categoryMatch = item.listing.category === activeCategory;
		}

		return typeMatch && categoryMatch;
	}));

	function setFilter(filter: string) {
		activeFilter = filter;
	}
</script>

<svelte:head>
	<title>Sharespace - Local Sharing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Filter/Tabs -->
	<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
		<button 
			onclick={() => setFilter('ALL')}
			class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors {activeFilter === 'ALL' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
		>
			All
		</button>
		<button 
			onclick={() => setFilter('ITEMS')}
			class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors {activeFilter === 'ITEMS' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
		>
			Items
		</button>
		<button 
			onclick={() => setFilter('SERVICES')}
			class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors {activeFilter === 'SERVICES' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
		>
			Services
		</button>
	</div>

	<!-- Feed -->
	<div class="space-y-6">
		{#if filteredItems.length === 0}
			<div class="text-center py-12 text-gray-500">
				<p>No listings found in this category.</p>
			</div>
		{:else}
			{#each filteredItems as item (item.listing.id)}
				<FeedCard listing={item.listing} owner={item.owner} currentUser={data.user} />
			{/each}
		{/if}
	</div>
</div>
