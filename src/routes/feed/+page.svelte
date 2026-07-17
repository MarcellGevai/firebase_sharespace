<script lang="ts">
	import { onMount } from 'svelte';
	// $state proxies plain objects and arrays, but not Set - mutating a plain one
	// wouldn't re-render the rows. SvelteSet is the reactive equivalent.
	import { SvelteSet } from 'svelte/reactivity';
	import FeedCard from '$lib/components/FeedCard.svelte';
	import WantCard from '$lib/components/WantCard.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { Package, Search, ChevronDown } from 'lucide-svelte';
	import { distanceKmTo, byDistance, type Coords } from '$lib/distance';
	import { groupByCategory } from '$lib/grouping';
	import { categoryIcon, NO_SUBCATEGORY } from '$lib/categories';

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

	// Which category rows are rolled down, keyed case-folded to match the group
	// key. A Set rather than a flag per row: the rows are data-driven, so there's
	// no fixed list of them to declare up front. Several may be open at once -
	// closing one to read another would make comparing two categories a chore.
	let openCategories = $state(new SvelteSet<string>());

	function toggleCategory(key: string) {
		if (openCategories.has(key)) openCategories.delete(key);
		else openCategories.add(key);
	}

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
	<div class="grid grid-cols-2 gap-2 bg-raised rounded-2xl p-1">
		<button
			onclick={() => (mode = 'LISTINGS')}
			class="py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 {mode === 'LISTINGS' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}"
		>
			<Package class="w-4 h-4" /> Hirdetések
		</button>
		<button
			onclick={() => (mode = 'WANTS')}
			class="py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 {mode === 'WANTS' ? 'bg-surface text-want shadow-sm' : 'text-muted hover:text-ink'}"
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
					? 'bg-primary-soft text-primary border-primary'
					: 'bg-surface text-muted border-line hover:bg-raised'}"
			>
				Tárgyak
			</button>
			<button
				onclick={() => (category = 'SERVICES')}
				class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors border {category === 'SERVICES'
					? 'bg-primary-soft text-primary border-primary'
					: 'bg-surface text-muted border-line hover:bg-raised'}"
			>
				Szolgáltatások/Események
			</button>
		</div>

		<!-- Összes / grouped list. Both tabs offer the same pair of views, so this
		     row is shared rather than duplicated per tab. -->
		<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
			<button
				onclick={() => (view = 'ALL')}
				class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border {view === 'ALL' ? 'bg-primary-soft text-primary border-primary' : 'bg-surface text-muted hover:bg-raised border-line'}"
			>
				Összes
			</button>
			<button
				onclick={() => (view = 'GROUPED')}
				class="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border {view === 'GROUPED' ? 'bg-primary-soft text-primary border-primary' : 'bg-surface text-muted hover:bg-raised border-line'}"
			>
				{groupedLabel}
			</button>
		</div>

		{#if view === 'GROUPED'}
			<!-- Summarized: one cell per category, with how many are up. -->
			{#if groupedItems.length === 0}
				<div class="bg-surface rounded-2xl border border-line shadow-sm text-center py-12 text-muted">
					<p>{emptyLabel}</p>
				</div>
			{:else}
				<!-- Cells grow in place when opened rather than pushing their neighbour
				     around: the grid rows auto-size, so an open cell leaves its partner
				     where it was instead of reflowing the whole grid. -->
				<div class="grid grid-cols-2 gap-x-3 gap-y-1 items-start">
					{#each groupedItems as group (group.category.toLowerCase())}
						{@const Icon = categoryIcon(group.category)}
						{@const key = group.category.toLowerCase()}
						{@const isOpen = openCategories.has(key)}
						<div>
							<button
								type="button"
								onclick={() => toggleCategory(key)}
								aria-expanded={isOpen}
								class="w-full flex items-center gap-3 py-2.5 text-left rounded-xl transition-colors hover:bg-raised"
							>
								<!-- Hexagon outline behind the glyph. An SVG rather than a
								     clip-path: clipping can't render a border, only a filled
								     silhouette. aria-hidden - the label beside it already says
								     which category this is. -->
								<div class="relative w-11 h-11 shrink-0 flex items-center justify-center">
									<svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full {isOpen ? 'text-primary' : 'text-faint'}" aria-hidden="true">
										<polygon
											points="50,3 93,27 93,73 50,97 7,73 7,27"
											fill="none"
											stroke="currentColor"
											stroke-width="5"
										/>
									</svg>
									<Icon class="relative w-5 h-5 {isOpen ? 'text-primary' : 'text-muted'}" />
								</div>
								<p class="min-w-0 flex-1 text-ink leading-snug">
									<span class="break-words">{group.category}</span>
									<span class="font-bold text-ink whitespace-nowrap">({group.count})</span>
								</p>
								<ChevronDown
									class="w-4 h-4 shrink-0 text-faint transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
								/>
							</button>

							{#if isOpen}
								<!-- Indented under the hexagon's width, so the second level reads
								     as belonging to the row above it rather than as a new one. -->
								<ul class="ml-6 pl-5 border-l border-line space-y-1 pb-2">
									{#each group.subgroups as sub (sub.subcategory.toLowerCase())}
										<li class="flex items-baseline justify-between gap-2 text-sm">
											<span class="min-w-0 break-words {sub.subcategory === NO_SUBCATEGORY ? 'text-faint italic' : 'text-muted'}">
												{sub.subcategory}
											</span>
											<span class="font-bold text-ink shrink-0">({sub.count})</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Feed -->
			<div class="space-y-6">
				{#if filteredItems.length === 0}
					<div class="text-center py-12 text-muted">
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
				<div class="text-center py-12 text-muted">
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
