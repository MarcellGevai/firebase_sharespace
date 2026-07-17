<script lang="ts">
	import { onMount } from 'svelte';
	import FeedCard from '$lib/components/FeedCard.svelte';
	import WantCard from '$lib/components/WantCard.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { Package, Search } from 'lucide-svelte';
	import { distanceKmTo, byDistance, type Coords } from '$lib/distance';
	import { groupByCategory } from '$lib/grouping';
	import { categoryIcon } from '$lib/categories';

	let { data }: { data: PageData } = $props();

	let mode = $state<'LISTINGS' | 'WANTS'>('LISTINGS');
	// Under Hirdetések, the listing type is the top-level split (it used to be a
	// filter pill alongside an "All"), and each side offers the same two views.
	let category = $state<'ITEMS' | 'SERVICES'>('ITEMS');
	let view = $state<'ALL' | 'GROUPED'>('ALL');

	let activeCategory = $derived($page.url.searchParams.get('category'));
	let searchQuery = $derived($page.url.searchParams.get('q')?.toLowerCase() ?? '');

	// Distance baseline: where the user actually is, falling back to the home
	// address geocoded at registration. GPS is async and may be denied, so the
	// first paint uses home (or no distances at all) and re-sorts once it lands.
	let gpsCoords = $state<Coords | null>(null);
	let homeCoords = $derived<Coords | null>(
		data.user?.latitude != null && data.user?.longitude != null
			? { lat: data.user.latitude, lon: data.user.longitude }
			: null
	);
	let baseline = $derived<Coords | null>(gpsCoords ?? homeCoords);
	// Signed-out users, Google signups (latitude: null) and failed geocodes have
	// no baseline at all - the feed then keeps its existing order and shows no
	// distances, rather than inventing them.
	let hasDistances = $derived(baseline !== null);

	onMount(() => {
		if (!('geolocation' in navigator)) return;
		navigator.geolocation.getCurrentPosition(
			(pos) => (gpsCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }),
			// Denied or unavailable is not an error here: homeCoords already covers it.
			() => {},
			{ enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
		);
	});

	let filteredItems = $derived(
		data.items
			.filter((item: any) => {
				// Every listing is one or the other, so the two tabs partition the feed
				// with nothing stranded between them.
				const typeMatch =
					category === 'ITEMS' ? item.listing.type === 'ITEM' : item.listing.type === 'SERVICE';

				let categoryMatch = true;
				if (activeCategory) {
					categoryMatch = item.listing.category === activeCategory;
				}

				let queryMatch = true;
				if (searchQuery) {
					queryMatch = item.listing.title.toLowerCase().includes(searchQuery);
				}

				return typeMatch && categoryMatch && queryMatch;
			})
			.map((item: any) => ({
				...item,
				distanceKm: distanceKmTo(baseline, item.listing.latitude, item.listing.longitude)
			}))
			.sort(byDistance)
	);

	let filteredWants = $derived(
		data.wants
			.filter((want: any) => {
				let categoryMatch = true;
				if (activeCategory) {
					categoryMatch = want.category === activeCategory;
				}

				let queryMatch = true;
				if (searchQuery) {
					queryMatch = want.title.toLowerCase().includes(searchQuery);
				}

				return categoryMatch && queryMatch;
			})
			.map((want: any) => ({
				want,
				distanceKm: distanceKmTo(baseline, want.latitude, want.longitude)
			}))
			.sort(byDistance)
	);

	// Derives from filteredItems, so the type/category/search filters carry
	// through for free and the counts always match what the All view lists.
	let groupedItems = $derived(groupByCategory(filteredItems));

	// The grouped view is a summary of one type, so its noun follows the tab.
	let groupedLabel = $derived(
		category === 'ITEMS' ? 'Összes tárgy listája' : 'Összes esemény listája'
	);
	let emptyLabel = $derived(
		category === 'ITEMS'
			? 'Jelenleg nincs tárgy ebben a kategóriában.'
			: 'Jelenleg nincs szolgáltatás ebben a kategóriában.'
	);
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
		<!-- Tárgyak / Szolgáltatások-Események. Only meaningful under Hirdetések,
		     so it lives inside this branch. -->
		<div class="flex gap-2">
			<button
				onclick={() => (category = 'ITEMS')}
				class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors border {category === 'ITEMS'
					? 'bg-blue-600 text-white border-blue-600'
					: 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}"
			>
				Tárgyak
			</button>
			<button
				onclick={() => (category = 'SERVICES')}
				class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors border {category === 'SERVICES'
					? 'bg-blue-600 text-white border-blue-600'
					: 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}"
			>
				Szolgáltatások/Események
			</button>
		</div>

		<!-- Összes / grouped list. Both tabs offer the same pair of views, so this
		     row is shared rather than duplicated per tab. -->
		<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
			<button
				onclick={() => (view = 'ALL')}
				class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors {view === 'ALL' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
			>
				Összes
			</button>
			<button
				onclick={() => (view = 'GROUPED')}
				class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors {view === 'GROUPED' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
			>
				{groupedLabel}
			</button>
		</div>

		{#if view === 'GROUPED'}
			<!-- Summarized: one cell per category, with how many are up. -->
			{#if groupedItems.length === 0}
				<div class="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 text-gray-500">
					<p>{emptyLabel}</p>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-x-3 gap-y-1">
					{#each groupedItems as group (group.category.toLowerCase())}
						{@const Icon = categoryIcon(group.category)}
						<div class="flex items-center gap-3 py-2.5">
							<!-- Hexagon outline behind the glyph. An SVG rather than a
							     clip-path: clipping can't render a border, only a filled
							     silhouette. aria-hidden - the label beside it already says
							     which category this is. -->
							<div class="relative w-11 h-11 shrink-0 flex items-center justify-center">
								<svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full text-gray-300" aria-hidden="true">
									<polygon
										points="50,3 93,27 93,73 50,97 7,73 7,27"
										fill="none"
										stroke="currentColor"
										stroke-width="5"
									/>
								</svg>
								<Icon class="relative w-5 h-5 text-gray-500" />
							</div>
							<p class="min-w-0 text-gray-800 leading-snug">
								<span class="break-words">{group.category}</span>
								<span class="font-bold text-gray-900 whitespace-nowrap">({group.count})</span>
							</p>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Feed -->
			<div class="space-y-6">
				{#if filteredItems.length === 0}
					<div class="text-center py-12 text-gray-500">
						<p>{emptyLabel}</p>
					</div>
				{:else}
					{#each filteredItems as item (item.listing.id)}
						<FeedCard
							listing={item.listing}
							owner={item.owner}
							currentUser={data.user}
							distanceKm={item.distanceKm}
						/>
					{/each}
				{/if}
			</div>
		{/if}
	{:else}
		<!-- Wants -->
		<div class="space-y-6">
			{#if filteredWants.length === 0}
				<div class="text-center py-12 text-gray-500">
					<p>Jelenleg nincs igény ebben a kategóriában.</p>
				</div>
			{:else}
				{#each filteredWants as row (row.want.id)}
					<WantCard want={row.want} currentUser={data.user} distanceKm={row.distanceKm} />
				{/each}
			{/if}
		</div>
	{/if}
</div>
