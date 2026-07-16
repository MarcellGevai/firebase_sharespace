<script lang="ts">
	import { onMount, mount, unmount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		LocateFixed,
		Wrench,
		Zap,
		House,
		Trees,
		Dumbbell,
		Users,
		CircleQuestionMark,
		X,
		CalendarClock,
		Search
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import RequestModal from '$lib/components/RequestModal.svelte';
	import { CATEGORIES } from '$lib/categories';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type MapItem = PageData['items'][number];

	const BUDAPEST_CENTER: [number, number] = [19.0402, 47.4979];
	const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

	const CATEGORY_ICONS: Record<string, typeof Wrench> = {
		Szerszámok: Wrench,
		Elektronika: Zap,
		Háztartás: House,
		Kert: Trees,
		Sport: Dumbbell,
		Tevékenységek: Users
	};

	const CATEGORY_COLORS: Record<string, string> = {
		Szerszámok: '#f97316',
		Elektronika: '#eab308',
		Háztartás: '#0ea5e9',
		Kert: '#22c55e',
		Sport: '#ec4899',
		Tevékenységek: '#8b5cf6'
	};

	const DEFAULT_COLOR = '#64748b';

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map;
	let selfMarker: maplibregl.Marker | null = null;
	let listingMarkers: { marker: maplibregl.Marker; iconInstance: Record<string, any> | null }[] = [];
	let watchId: number | null = null;
	let hasCenteredOnSelf = false;
	let mapLoaded = $state(false);

	let selfPosition: [number, number] | null = $state(null);
	let selectedGroup: MapItem[] = $state([]);
	let isSheetOpen = $state(false);
	let requestListing: MapItem['listing'] | null = $state(null);
	let requestOwner: MapItem['owner'] | null = $state(null);

	let activeCategory = $state($page.url.searchParams.get('category') ?? '');
	let searchQuery = $state($page.url.searchParams.get('q') ?? '');
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	function syncUrl() {
		const params = new URLSearchParams();
		if (activeCategory) params.set('category', activeCategory);
		if (searchQuery) params.set('q', searchQuery);
		const qs = params.toString();
		goto(qs ? `?${qs}` : '?', { replaceState: true, noScroll: true, keepFocus: true });
	}

	function toggleCategory(category: string) {
		activeCategory = activeCategory === category ? '' : category;
		syncUrl();
	}

	function onSearchInput(value: string) {
		searchQuery = value;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(syncUrl, 300);
	}

	let filteredItems = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		return data.items.filter((item: MapItem) => {
			const categoryMatch = !activeCategory || item.listing.category === activeCategory;
			const searchMatch =
				!query ||
				item.listing.title.toLowerCase().includes(query) ||
				(item.listing.description ?? '').toLowerCase().includes(query);
			return categoryMatch && searchMatch;
		});
	});

	// Fuzzed positions are identical for every listing from the same owner,
	// so group by owner and show one marker per location.
	let groups = $derived.by(() => {
		const grouped = new Map<string, MapItem[]>();
		for (const item of filteredItems) {
			const key = item.owner.id;
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(item);
		}
		return Array.from(grouped.values());
	});

	function openGroup(group: MapItem[]) {
		selectedGroup = group;
		isSheetOpen = true;
	}

	function closeSheet() {
		isSheetOpen = false;
	}

	function openRequest(listing: MapItem['listing'], owner: MapItem['owner']) {
		requestListing = listing;
		requestOwner = owner;
	}

	function closeRequest() {
		requestListing = null;
		requestOwner = null;
	}

	function createMarkerElement(group: MapItem[]) {
		const primaryCategory = group[0].listing.category ?? '';
		const Icon = CATEGORY_ICONS[primaryCategory] ?? CircleQuestionMark;
		const color = CATEGORY_COLORS[primaryCategory] ?? DEFAULT_COLOR;
		const imageUrl = group[0].listing.image_url;

		const el = document.createElement('button');
		el.type = 'button';
		el.className = 'listing-marker';
		el.style.setProperty('--marker-color', color);
		el.setAttribute('aria-label', group[0].listing.title);

		let iconInstance = null;
		if (imageUrl) {
			const img = document.createElement('img');
			img.src = imageUrl;
			img.className = 'w-full h-full object-cover rounded-full';
			el.appendChild(img);
		} else {
			iconInstance = mount(Icon, {
				target: el,
				props: { class: 'w-4 h-4 text-white' }
			});
		}

		if (group.length > 1) {
			const badge = document.createElement('span');
			badge.className = 'listing-marker-badge';
			badge.textContent = group.length.toString();
			el.appendChild(badge);
		}

		el.addEventListener('click', () => openGroup(group));

		return { el, iconInstance };
	}

	function renderListingMarkers() {
		for (const { marker, iconInstance } of listingMarkers) {
			if (iconInstance) unmount(iconInstance);
			marker.remove();
		}
		listingMarkers = [];

		for (const group of groups) {
			const { lat, lon } = group[0].position;
			const { el, iconInstance } = createMarkerElement(group);
			const marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
			listingMarkers.push({ marker, iconInstance });
		}
	}

	function updateSelfMarker(lon: number, lat: number) {
		selfPosition = [lon, lat];

		if (!selfMarker) {
			const el = document.createElement('div');
			el.className = 'self-location-marker';
			selfMarker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
		} else {
			selfMarker.setLngLat([lon, lat]);
		}

		if (!hasCenteredOnSelf) {
			map.flyTo({ center: [lon, lat], zoom: 14 });
			hasCenteredOnSelf = true;
		}
	}

	function recenterOnSelf() {
		if (selfPosition) {
			map.flyTo({ center: selfPosition, zoom: 14 });
		}
	}

	// Re-render markers whenever the map finishes loading or the visible
	// group set changes (e.g. once filtering is added).
	$effect(() => {
		if (mapLoaded) {
			renderListingMarkers();
		}
	});

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style: MAP_STYLE,
			center: BUDAPEST_CENTER,
			zoom: 12
		});

		map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
		map.on('load', () => {
			mapLoaded = true;
		});
		// MapLibre's internal ResizeObserver discards its first callback (assumes
		// the constructor's synchronous measurement was already correct), so a
		// container that settles into its final full-bleed size only after mount
		// (e.g. returning here via client-side navigation) never gets picked up.
		// Force one real measurement a frame after mount to correct that.
		requestAnimationFrame(() => map.resize());

		if ('geolocation' in navigator) {
			watchId = navigator.geolocation.watchPosition(
				(pos) => updateSelfMarker(pos.coords.longitude, pos.coords.latitude),
				(err) => {
					console.warn('Geolocation unavailable, staying on Budapest default view.', err);
				},
				{ enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
			);
		}

		return () => {
			if (watchId !== null && 'geolocation' in navigator) {
				navigator.geolocation.clearWatch(watchId);
			}
			for (const { marker, iconInstance } of listingMarkers) {
				if (iconInstance) unmount(iconInstance);
				marker.remove();
			}
			map?.remove();
		};
	});
</script>

<svelte:head>
	<title>Térkép - Sharespace</title>
</svelte:head>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>

	<div class="absolute top-3 left-3 right-16 z-10 flex flex-col gap-2 max-w-xs">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
			<input
				type="text"
				value={searchQuery}
				oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
				placeholder="Keresés (pl. fúrógép)..."
				class="w-full bg-white/95 backdrop-blur-sm shadow-md border border-gray-200 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
			/>
		</div>
		<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
			{#each CATEGORIES as category}
				<button
					onclick={() => toggleCategory(category)}
					class="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md transition-colors {activeCategory ===
					category
						? 'bg-gray-900 text-white'
						: 'bg-white/95 backdrop-blur-sm text-gray-600 hover:bg-gray-100 border border-gray-200'}"
				>
					{category}
				</button>
			{/each}
		</div>
	</div>

	{#if selfPosition}
		<button
			onclick={recenterOnSelf}
			aria-label="Ugrás a jelenlegi helyemre"
			class="absolute bottom-6 right-4 z-10 bg-white hover:bg-gray-50 text-blue-600 p-3 rounded-full shadow-lg border border-gray-100 transition-colors"
		>
			<LocateFixed class="w-5 h-5" />
		</button>
	{/if}

	{#if !mapLoaded}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-[#FFFFF0]">
			<div
				class="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"
			></div>
		</div>
	{:else if groups.length === 0}
		<div
			class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white shadow-lg border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600 max-w-xs text-center"
		>
			Nincs találat ehhez a szűréshez.
		</div>
	{/if}
</div>

{#if isSheetOpen}
	<button
		class="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm cursor-default"
		onclick={closeSheet}
		aria-label="Bezárás"
	></button>
	<div class="fixed bottom-4 right-4 z-50 bg-white rounded-3xl shadow-2xl max-h-[70vh] overflow-y-auto w-[calc(100%-2rem)] max-w-sm border border-gray-100">
		<div class="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<img
					src={selectedGroup[0]?.owner.avatar_url}
					alt={selectedGroup[0]?.owner.name}
					class="w-9 h-9 rounded-full object-cover bg-gray-100"
				/>
				<div>
					<h3 class="font-semibold text-gray-900 text-sm">{selectedGroup[0]?.owner.name}</h3>
					<p class="text-xs text-gray-500">{selectedGroup[0]?.owner.location}</p>
				</div>
			</div>
			<button
				onclick={closeSheet}
				aria-label="Bezárás"
				class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="p-4 space-y-3">
			{#each selectedGroup as item (item.listing.id)}
				<div class="flex gap-3 p-3 bg-gray-50 rounded-xl">
					<img
						src={item.listing.image_url}
						alt={item.listing.title}
						class="w-16 h-16 rounded-lg object-cover bg-gray-200 flex-shrink-0"
					/>
					<div class="flex-1 min-w-0">
						<h4 class="font-semibold text-gray-900 text-sm truncate">{item.listing.title}</h4>
						<p class="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.listing.description}</p>
						{#if item.listing.category}
							<span
								class="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"
							>
								{item.listing.category}
							</span>
						{/if}
					</div>
					<button
						onclick={() => openRequest(item.listing, item.owner)}
						class="self-center flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
					>
						<CalendarClock class="w-3.5 h-3.5" />
						{item.listing.type === 'ITEM' ? 'Borrow' : 'Book'}
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}

<RequestModal isOpen={!!requestListing} listing={requestListing} owner={requestOwner} onClose={closeRequest} />

<style>
	/* Stack the zoom/compass control above the "My Location" button
	   (bottom-6 right-4, ~44px) instead of overlapping it. */
	:global(.maplibregl-ctrl-bottom-right) {
		margin: 0 16px 84px 0;
	}

	:global(.self-location-marker) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #3b82f6;
		border: 3px solid white;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
		position: relative;
	}

	:global(.self-location-marker::after) {
		content: '';
		position: absolute;
		inset: -10px;
		border-radius: 50%;
		background: rgba(59, 130, 246, 0.25);
		animation: self-location-pulse 2s ease-out infinite;
	}

	@keyframes self-location-pulse {
		0% {
			transform: scale(0.6);
			opacity: 0.8;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}

	:global(.listing-marker) {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--marker-color, #64748b);
		border: 2px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		padding: 0;
	}

	:global(.listing-marker-badge) {
		position: absolute;
		top: -4px;
		right: -4px;
		background: #111827;
		color: white;
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
		min-width: 16px;
		height: 16px;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid white;
		padding: 0 3px;
	}
</style>
