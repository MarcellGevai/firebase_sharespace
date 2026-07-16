<script lang="ts">
	import { onMount } from 'svelte';
	import FeedCard from '$lib/components/FeedCard.svelte';
	import WantCard from '$lib/components/WantCard.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { Package, Search, MapPin } from 'lucide-svelte';
	import { distanceKmTo, byDistance, formatDistance, type Coords } from '$lib/distance';
	import { groupByTitle } from '$lib/grouping';

	let { data }: { data: PageData } = $props();

	let mode = $state<'LISTINGS' | 'WANTS'>('LISTINGS');
	let subView = $state<'ITEMS' | 'GROUPED'>('ITEMS');
	let activeFilter = $state('ALL');

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

	// Derives from filteredItems, so the type/category/search filters and the
	// distances computed for the sort all carry through for free.
	let groupedItems = $derived(groupByTitle(filteredItems));

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
		<!-- Tárgyak / Összes tárgy listája sub-view. Only meaningful under
		     Hirdetések, so it lives inside this branch. -->
		<div class="flex gap-2">
			<button
				onclick={() => (subView = 'ITEMS')}
				class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors border {subView === 'ITEMS'
					? 'bg-blue-600 text-white border-blue-600'
					: 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}"
			>
				Tárgyak
			</button>
			<button
				onclick={() => (subView = 'GROUPED')}
				class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors border {subView === 'GROUPED'
					? 'bg-blue-600 text-white border-blue-600'
					: 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}"
			>
				Összes tárgy listája
			</button>
		</div>

		<!-- Filter/Tabs. Shown for both sub-views: it filters the same underlying
		     set the grouped summary is built from. -->
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

		{#if subView === 'GROUPED'}
			<!-- Summarized: one row per distinct item name, with how many are up. -->
			<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
				{#if groupedItems.length === 0}
					<div class="text-center py-12 text-gray-500">
						<p>No listings found in this category.</p>
					</div>
				{:else}
					<div class="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
						<h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tárgy</h2>
						<h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Elérhető</h2>
					</div>
					<ul class="divide-y divide-gray-100">
						{#each groupedItems as group (group.title.toLowerCase())}
							<li class="px-4 py-3 flex items-center justify-between gap-3">
								<div class="min-w-0">
									<p class="font-semibold text-gray-900 truncate">{group.title}</p>
									{#if group.nearestKm != null}
										<p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
											<MapPin class="w-3 h-3 shrink-0" />
											<span>legközelebbi: <span class="font-semibold text-blue-600">{formatDistance(group.nearestKm)}</span></span>
										</p>
									{/if}
								</div>
								<span
									class="shrink-0 min-w-[2.25rem] text-center text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full"
								>
									({group.count})
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<!-- Feed -->
			<div class="space-y-6">
				{#if filteredItems.length === 0}
					<div class="text-center py-12 text-gray-500">
						<p>No listings found in this category.</p>
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
