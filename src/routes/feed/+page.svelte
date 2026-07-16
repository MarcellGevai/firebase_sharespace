<script lang="ts">
	import FeedCard from '$lib/components/FeedCard.svelte';
	import WantCard from '$lib/components/WantCard.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { Package, Search } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let mode = $state<'LISTINGS' | 'WANTS'>('LISTINGS');
	let activeFilter = $state('ALL');

	let activeCategory = $derived($page.url.searchParams.get('category'));
	let searchQuery = $derived($page.url.searchParams.get('q')?.toLowerCase() ?? '');

	let filteredItems = $derived(data.items.filter((item: any) => {
		let typeMatch = true;
		if (activeFilter === 'ITEMS') typeMatch = item.listing.type === 'ITEM';
		if (activeFilter === 'SERVICES') typeMatch = item.listing.type === 'SERVICE';

		let categoryMatch = true;
		if (activeCategory) {
			categoryMatch = item.listing.category === activeCategory;
		}

		let queryMatch = true;
		if (searchQuery) {
			queryMatch = item.listing.title.toLowerCase().includes(searchQuery);
		}

		return typeMatch && categoryMatch && queryMatch;
	}));

	let filteredWants = $derived(data.wants.filter((want: any) => {
		let categoryMatch = true;
		if (activeCategory) {
			categoryMatch = want.category === activeCategory;
		}

		let queryMatch = true;
		if (searchQuery) {
			queryMatch = want.title.toLowerCase().includes(searchQuery);
		}

		return categoryMatch && queryMatch;
	}));

	function setFilter(filter: string) {
		activeFilter = filter;
	}
</script>

<svelte:head>
	<title>Sharespace - Local Sharing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Hirdetések / Igények mode switch -->
	<div class="grid grid-cols-2 gap-2 bg-gray-100 rounded-2xl p-1">
		<button
			onclick={() => (mode = 'LISTINGS')}
			class="py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 {mode === 'LISTINGS' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			<Package class="w-4 h-4" /> Hirdetések
		</button>
		<button
			onclick={() => (mode = 'WANTS')}
			class="py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 {mode === 'WANTS' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			<Search class="w-4 h-4" /> Igények
		</button>
	</div>

	{#if mode === 'LISTINGS'}
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
	{:else}
		<!-- Wants -->
		<div class="space-y-6">
			{#if filteredWants.length === 0}
				<div class="text-center py-12 text-gray-500">
					<p>Jelenleg nincs igény ebben a kategóriában.</p>
				</div>
			{:else}
				{#each filteredWants as want (want.id)}
					<WantCard {want} currentUser={data.user} />
				{/each}
			{/if}
		</div>
	{/if}
</div>
