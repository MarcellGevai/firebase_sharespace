<script lang="ts">
	import { onMount, mount, unmount } from 'svelte';
	import { get } from 'svelte/store';
	import { theme } from '$lib/theme';
	import maplibregl from 'maplibre-gl';
	import Supercluster from 'supercluster';
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
		Search,
		SlidersHorizontal,
		Check,
		MessageCircle
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import RequestModal from '$lib/components/RequestModal.svelte';
	import { CATEGORIES } from '$lib/categories';
	import { chatUrl } from '$lib/chat';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type MapItem = PageData['items'][number];
	type MapWant = PageData['wantItems'][number];

	/**
	 * Listings and wants are different shapes but need identical treatment on the
	 * map (filter -> group -> cluster -> pin), so they're normalized to one entry
	 * type here and only pulled apart again in the detail sheet.
	 */
	type Entry = {
		kind: 'LISTING' | 'WANT';
		id: string;
		partyId: string;
		title: string;
		description: string;
		category?: string;
		imageUrl?: string;
		position: { lat: number; lon: number };
		item?: MapItem;
		want?: MapWant;
	};

	type MapTab = 'LISTINGS' | 'WANTS';

	const BUDAPEST_CENTER: [number, number] = [19.0402, 47.4979];
	// Same host, so no extra dependency/attribution. The dark style's background is
	// rgb(12,12,12), near-identical to the zinc-950 canvas around it.
	const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
	const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

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

	/**
	 * Read a theme token as a plain colour string.
	 *
	 * The pins are drawn into markers whose colour MapLibre wants as a value, not
	 * a `var()` it could resolve itself - so unlike everything else in the app,
	 * these can't simply reference the token and let the cascade flip them.
	 */
	function themeColor(name: string, fallback: string): string {
		if (typeof window === 'undefined') return fallback;
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
	}

	// Matches the coral "Igény" FAB, so want pins/clusters read as the same thing.
	// Re-read on every theme flip: the token behind it changes value.
	let WANT_COLOR = $derived.by(() => {
		$theme;
		return themeColor('--color-want', '#d1385a');
	});

	// Cluster radius in px; past CLUSTER_MAX_ZOOM every pin stands on its own.
	const CLUSTER_RADIUS = 60;
	const CLUSTER_MAX_ZOOM = 16;

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map;
	let selfMarker: maplibregl.Marker | null = null;
	let clusterIndex: Supercluster<{ groupIndex: number }> | null = null;
	let listingMarkers: { marker: maplibregl.Marker; iconInstance: Record<string, any> | null }[] = [];
	let watchId: number | null = null;
	let hasCenteredOnSelf = false;
	let mapLoaded = $state(false);

	let selfPosition: [number, number] | null = $state(null);
	let selectedGroup: Entry[] = $state([]);
	let isSheetOpen = $state(false);
	let requestListing: MapItem['listing'] | null = $state(null);
	let requestOwner: MapItem['owner'] | null = $state(null);

	let activeCategory = $state($page.url.searchParams.get('category') ?? '');
	let searchQuery = $state($page.url.searchParams.get('q') ?? '');
	let searchDebounceTimer: ReturnType<typeof setTimeout>;
	let activeTab = $state<MapTab>(
		$page.url.searchParams.get('tab') === 'wants' ? 'WANTS' : 'LISTINGS'
	);
	let isFilterOpen = $state(false);

	function syncUrl() {
		const params = new URLSearchParams();
		if (activeCategory) params.set('category', activeCategory);
		if (searchQuery) params.set('q', searchQuery);
		if (activeTab === 'WANTS') params.set('tab', 'wants');
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

	// The toggle picks the source; everything downstream is kind-agnostic.
	let entries = $derived.by<Entry[]>(() =>
		activeTab === 'LISTINGS'
			? data.items.map((item: MapItem) => ({
					kind: 'LISTING' as const,
					id: item.listing.id,
					partyId: item.owner.id,
					title: item.listing.title,
					description: item.listing.description ?? '',
					category: item.listing.category,
					imageUrl: item.listing.image_url,
					position: item.position,
					item
				}))
			: data.wantItems.map((w: MapWant) => ({
					kind: 'WANT' as const,
					id: w.want.id,
					partyId: w.requester.id,
					title: w.want.title,
					description: w.want.description ?? '',
					category: w.want.category,
					// Wants carry no photo, so their pins always fall back to the
					// category glyph - which is also what visually separates them.
					imageUrl: undefined,
					position: w.position,
					want: w
				}))
	);

	function matchesSearch(e: Entry, query: string): boolean {
		return (
			!query || e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query)
		);
	}

	let filteredItems = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		return entries.filter(
			(e) => (!activeCategory || e.category === activeCategory) && matchesSearch(e, query)
		);
	});

	/**
	 * How many pins each category would show, for the filter menu.
	 *
	 * Counted off the search-filtered set but NOT the category-filtered one: these
	 * have to answer "what would I get if I picked this instead", so narrowing them
	 * by the current pick would zero every other row the moment one is selected.
	 * Follows the active tab, since that decides what's on the map at all.
	 */
	let categoryCounts = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const counts = new Map<string, number>();
		for (const e of entries) {
			if (!e.category || !matchesSearch(e, query)) continue;
			counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
		}
		return counts;
	});

	// Fuzzed positions are identical for everything from the same person, so group
	// by owner/requester and show one marker per location.
	let groups = $derived.by(() => {
		const grouped = new Map<string, Entry[]>();
		for (const entry of filteredItems) {
			if (!grouped.has(entry.partyId)) grouped.set(entry.partyId, []);
			grouped.get(entry.partyId)!.push(entry);
		}
		return Array.from(grouped.values());
	});

	function openGroup(group: Entry[]) {
		selectedGroup = group;
		isSheetOpen = true;
	}

	// The sheet header shows whoever the group belongs to - owner or requester -
	// normalized to one shape. Wants denormalize no locality snapshot the way
	// listings do, so theirs is blank and the line is simply omitted.
	let sheetParty = $derived.by(() => {
		const first = selectedGroup[0];
		if (!first) return null;
		if (first.kind === 'LISTING') {
			const o = first.item!.owner;
			return { name: o.name, avatar_url: o.avatar_url, location: o.location };
		}
		const r = first.want!.requester;
		return { name: r.name, avatar_url: r.avatar_url, location: '' };
	});

	function formatShortDate(d: string | undefined) {
		if (!d) return '';
		return new Date(d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
	}

	function contactWant(entry: Entry) {
		if (!entry.want) return;
		goto(chatUrl(entry.want.want.id, entry.want.requester.id));
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

	function createMarkerElement(group: Entry[]) {
		const primaryCategory = group[0].category ?? '';
		const Icon = CATEGORY_ICONS[primaryCategory] ?? CircleQuestionMark;
		// Wants take the Igény red across the board rather than the category
		// colour, matching the red "Igény" button and keeping the two kinds
		// tellable apart at a glance.
		const color =
			group[0].kind === 'WANT' ? WANT_COLOR : (CATEGORY_COLORS[primaryCategory] ?? DEFAULT_COLOR);
		const imageUrl = group[0].imageUrl;

		const el = document.createElement('button');
		el.type = 'button';
		el.className = 'listing-marker';
		el.style.setProperty('--marker-color', color);
		el.setAttribute('aria-label', group[0].title);

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

	function setTab(tab: MapTab) {
		if (activeTab === tab) return;
		activeTab = tab;
		isSheetOpen = false;
		syncUrl();
	}

	/** A merged pin: circle with the number of groups hidden inside it. */
	function createClusterElement(count: number, onExpand: () => void) {
		const el = document.createElement('button');
		el.type = 'button';
		el.className = 'cluster-marker';
		// Grow the circle with the count so dense areas read as heavier.
		const size = count < 10 ? 38 : count < 50 ? 46 : 54;
		el.style.width = `${size}px`;
		el.style.height = `${size}px`;
		el.style.fontSize = count < 100 ? '13px' : '11px';
		el.textContent = String(count);
		el.setAttribute('aria-label', `${count} hirdető ezen a területen, nagyításhoz kattints`);
		el.addEventListener('click', onExpand);
		return el;
	}

	function buildClusterIndex() {
		const index = new Supercluster<{ groupIndex: number }>({
			radius: CLUSTER_RADIUS,
			maxZoom: CLUSTER_MAX_ZOOM
		});
		index.load(
			groups.map((group, groupIndex) => ({
				type: 'Feature' as const,
				properties: { groupIndex },
				geometry: {
					type: 'Point' as const,
					coordinates: [group[0].position.lon, group[0].position.lat]
				}
			}))
		);
		clusterIndex = index;
	}

	function clearListingMarkers() {
		for (const { marker, iconInstance } of listingMarkers) {
			if (iconInstance) unmount(iconInstance);
			marker.remove();
		}
		listingMarkers = [];
	}

	function renderListingMarkers() {
		if (!map || !clusterIndex) return;
		clearListingMarkers();

		const bounds = map.getBounds();
		const bbox: [number, number, number, number] = [
			bounds.getWest(),
			bounds.getSouth(),
			bounds.getEast(),
			bounds.getNorth()
		];

		for (const feature of clusterIndex.getClusters(bbox, Math.round(map.getZoom()))) {
			const [lon, lat] = feature.geometry.coordinates;
			const props = feature.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; groupIndex?: number };

			if (props.cluster) {
				const clusterId = props.cluster_id!;
				const el = createClusterElement(props.point_count!, () => {
					// Zoom to exactly where supercluster says this cluster breaks apart.
					const target = clusterIndex!.getClusterExpansionZoom(clusterId);
					map.easeTo({ center: [lon, lat], zoom: target, duration: 500 });
				});
				const marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
				listingMarkers.push({ marker, iconInstance: null });
			} else {
				const group = groups[props.groupIndex!];
				if (!group) continue;
				const { el, iconInstance } = createMarkerElement(group);
				const marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
				listingMarkers.push({ marker, iconInstance });
			}
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

	// Rebuild the cluster index and repaint whenever the map finishes loading or
	// the visible group set changes (category filter, search). Reading `groups`
	// via buildClusterIndex is what makes this effect track those filters.
	$effect(() => {
		buildClusterIndex();
		if (mapLoaded) {
			renderListingMarkers();
		}
	});

	// Swap the basemap with the theme. setStyle tears down and rebuilds the style's
	// own layers; DOM markers live in the canvas container rather than the style,
	// so they are expected to survive - verified rather than assumed, see below.
	$effect(() => {
		const next = $theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
		if (map && mapLoaded) {
			map.setStyle(next);
		}
	});

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			// Read once at construction; the $effect below handles later toggles.
			style: get(theme) === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
			center: BUDAPEST_CENTER,
			zoom: 12,
			// Suppressed so it can be re-added compact below. Attribution itself is
			// not optional - see the control's comment.
			attributionControl: false
		});

		/*
		 * Attribution, collapsed to a single (i) that expands on tap.
		 *
		 * It cannot simply be removed. The text comes from OpenFreeMap's TileJSON,
		 * and most of it is a licence condition rather than branding: OSM data is
		 * ODbL, which requires attribution, and OpenFreeMap's terms ask for
		 * "OpenFreeMap (c) OpenMapTiles Data from OpenStreetMap". `compact` is
		 * MapLibre's own answer to the space that takes - the credit stays one tap
		 * away rather than spanning the map.
		 *
		 * customAttribution is passed explicitly because the options object replaces
		 * MapLibre's defaults wholesale, and its default carries the MapLibre link.
		 * Omitting it here would quietly drop that credit as a side effect of asking
		 * for compact.
		 */
		const attribution = new maplibregl.AttributionControl({
			compact: true,
			customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>'
		});
		map.addControl(attribution, 'bottom-right');
		map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
		map.on('load', () => {
			mapLoaded = true;
			// MapLibre renders compact attribution already expanded (it adds
			// `maplibregl-compact-show` itself) and only minimizes it on interactions
			// that panning alone doesn't trigger - so without this it just sits there
			// as a full-width bar, which is the thing compact was meant to solve.
			// There's no "start collapsed" option, hence reaching for the class.
			// The (i) stays, and one tap brings the credit back.
			attribution._container?.classList.remove('maplibregl-compact-show');
		});
		// Clusters depend on the viewport, so they have to be recomputed after every
		// pan/zoom. moveend covers zoom too, and fires once the gesture settles.
		map.on('moveend', renderListingMarkers);
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

	<!-- Click-away for the filter popover. Must sit OUTSIDE the control stack
	     below: inside it, this z-10 would outrank the search bar's z-auto within
	     that container's own stacking context and swallow every click on the
	     input, the filter button and the toggle. Same z as the stack but earlier
	     in the DOM, so the controls stay on top and only the map closes it. -->
	{#if isFilterOpen}
		<button
			class="absolute inset-0 z-10 cursor-default"
			onclick={() => (isFilterOpen = false)}
			aria-label="Szűrők bezárása"
		></button>
	{/if}

	<div class="absolute top-3 left-3 right-16 z-10 flex flex-col gap-2 max-w-xs">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
			<input
				type="text"
				value={searchQuery}
				oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
				placeholder="Keresés (pl. fúrógép)..."
				class="w-full bg-surface/95 backdrop-blur-sm shadow-md border border-line rounded-full py-2.5 pl-10 pr-12 text-sm text-ink placeholder:text-faint outline-none focus:ring-2 focus:ring-primary transition-all"
			/>
			<!-- Filter lives inside the bar's right edge; the category chips that used
			     to sit under it now live in its popover. -->
			<button
				onclick={() => (isFilterOpen = !isFilterOpen)}
				aria-label="Szűrők"
				aria-expanded={isFilterOpen}
				class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors {activeCategory
					? 'bg-primary text-primary-fg'
					: 'text-muted hover:bg-raised'}"
			>
				<SlidersHorizontal class="w-4 h-4" />
			</button>
		</div>

		{#if isFilterOpen}
			<div class="absolute top-12 right-0 z-20 w-56 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden">
				<div class="px-3 py-2 bg-raised border-b border-line flex items-center justify-between">
					<h3 class="text-xs font-semibold text-ink uppercase tracking-wide">Kategóriák</h3>
					{#if activeCategory}
						<button
							onclick={() => { activeCategory = ''; syncUrl(); }}
							class="text-xs font-semibold text-primary hover:underline"
						>
							Törlés
						</button>
					{/if}
				</div>
				<div class="py-1 max-h-64 overflow-y-auto">
					{#each CATEGORIES as category}
						{@const count = categoryCounts.get(category) ?? 0}
						<!-- Empty categories are dimmed but still clickable: one of them can
						     be the current pick (a search can strand it at zero), and
						     disabling it would leave no way to switch off. -->
						<button
							onclick={() => { toggleCategory(category); isFilterOpen = false; }}
							class="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 {activeCategory ===
							category
								? 'bg-primary-soft text-primary font-semibold'
								: count === 0
									? 'text-faint hover:bg-raised'
									: 'text-ink hover:bg-raised'}"
						>
							<span class="truncate">
								{category}
								<span class="font-bold">({count})</span>
							</span>
							{#if activeCategory === category}
								<Check class="w-4 h-4 shrink-0" />
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Hirdetések / Igények: swaps which collection the pins come from. -->
		<div class="flex bg-surface/95 backdrop-blur-sm shadow-md border border-line rounded-full p-1">
			<button
				onclick={() => setTab('LISTINGS')}
				class="flex-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors {activeTab ===
				'LISTINGS'
					? 'bg-primary text-primary-fg shadow-sm'
					: 'text-muted hover:text-ink'}"
			>
				Hirdetések
			</button>
			<button
				onclick={() => setTab('WANTS')}
				class="flex-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors {activeTab === 'WANTS'
					? 'bg-want text-want-fg shadow-sm'
					: 'text-muted hover:text-ink'}"
			>
				Igények
			</button>
		</div>
	</div>

	{#if selfPosition}
		<button
			onclick={recenterOnSelf}
			aria-label="Ugrás a jelenlegi helyemre"
			class="absolute bottom-6 right-4 z-10 bg-surface hover:bg-raised text-primary p-3 rounded-full shadow-lg border border-line transition-colors"
		>
			<LocateFixed class="w-5 h-5" />
		</button>
	{/if}

	{#if !mapLoaded}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-canvas">
			<div
				class="w-8 h-8 border-4 border-line border-t-primary rounded-full animate-spin"
			></div>
		</div>
	{:else if groups.length === 0}
		<div
			class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-surface shadow-lg border border-line rounded-xl px-4 py-3 text-sm text-muted max-w-xs text-center"
		>
			Nincs találat ehhez a szűréshez.
			<!-- Wants predate having a location, so an empty Igények map is expected
			     rather than broken - say so instead of leaving it a mystery. -->
			{#if activeTab === 'WANTS' && data.unplaceableWants > 0}
				<p class="text-xs text-faint mt-1">
					{data.unplaceableWants} igényhez nincs megadva hely, ezért nem kerül a térképre.
					<a href="/feed?tab=wants" class="text-primary font-semibold hover:underline">Listában</a>
					megnézheted.
				</p>
			{/if}
		</div>
	{/if}
</div>

{#if isSheetOpen}
	<button
		class="fixed inset-0 z-40 bg-scrim backdrop-blur-sm cursor-default"
		onclick={closeSheet}
		aria-label="Bezárás"
	></button>
	<div class="fixed bottom-4 right-4 z-50 bg-surface rounded-3xl shadow-2xl max-h-[70vh] overflow-y-auto w-[calc(100%-2rem)] max-w-sm border border-line">
		<div class="sticky top-0 bg-surface border-b border-line p-4 flex items-center justify-between">
			<a
				href={`/profile/${selectedGroup[0]?.partyId}`}
				class="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
			>
				<img
					src={sheetParty?.avatar_url}
					alt={sheetParty?.name}
					class="w-9 h-9 rounded-full object-cover bg-raised shrink-0"
				/>
				<div class="min-w-0">
					<h3 class="font-semibold text-ink text-sm truncate">{sheetParty?.name}</h3>
					{#if sheetParty?.location}
						<p class="text-xs text-muted truncate">{sheetParty.location}</p>
					{/if}
				</div>
			</a>
			<button
				onclick={closeSheet}
				aria-label="Bezárás"
				class="p-2 text-faint hover:text-muted hover:bg-raised rounded-full transition-colors shrink-0"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="p-4 space-y-3">
			{#each selectedGroup as entry (entry.id)}
				<div class="flex gap-3 p-3 bg-raised rounded-xl">
					{#if entry.kind === 'LISTING'}
						<img
							src={entry.imageUrl}
							alt={entry.title}
							class="w-16 h-16 rounded-lg object-cover bg-raised flex-shrink-0"
						/>
					{:else}
						<!-- Wants have no photo; the date window is the useful thing here. -->
						<div class="w-16 h-16 rounded-lg bg-want-soft text-want flex flex-col items-center justify-center flex-shrink-0 px-1">
							<CalendarClock class="w-5 h-5" />
							<span class="text-[9px] font-bold mt-0.5 text-center leading-tight">
								{formatShortDate(entry.want?.want.date_from)}
							</span>
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<h4 class="font-semibold text-ink text-sm truncate">{entry.title}</h4>
						<p class="text-xs text-muted line-clamp-2 mt-0.5">{entry.description}</p>
						{#if entry.kind === 'WANT' && entry.want}
							<p class="text-xs font-semibold text-want mt-1">
								{entry.want.want.price_min} – {entry.want.want.price_max} Ft
							</p>
						{/if}
						{#if entry.category}
							<span
								class="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full {entry.kind ===
								'WANT'
									? 'text-want bg-want-soft'
									: 'text-primary bg-primary-soft'}"
							>
								{entry.category}
							</span>
						{/if}
					</div>
					{#if entry.kind === 'LISTING' && entry.item}
						<button
							onclick={() => openRequest(entry.item!.listing, entry.item!.owner)}
							class="self-center flex-shrink-0 bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
						>
							<CalendarClock class="w-3.5 h-3.5" />
							{entry.item.listing.type === 'ITEM' ? 'Borrow' : 'Book'}
						</button>
					{:else}
						<!-- A want isn't bookable - the only sensible action is to talk. -->
						<button
							onclick={() => contactWant(entry)}
							class="self-center flex-shrink-0 bg-want hover:bg-want-hover text-want-fg text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
						>
							<MessageCircle class="w-3.5 h-3.5" />
							Ajánlom
						</button>
					{/if}
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

	/* MapLibre ships its own light chrome, which stays a white slab on the dark
	   map. Its stylesheet is global and outside our token system, so these are
	   the one place we have to reach in and repaint someone else's component. */
	:global(.maplibregl-ctrl-attrib) {
		background: var(--color-surface) !important;
		color: var(--color-muted);
	}
	:global(.maplibregl-ctrl-attrib a) {
		color: var(--color-muted);
	}
	:global(.maplibregl-ctrl-group) {
		background: var(--color-surface);
		border: 1px solid var(--color-line);
	}
	:global(.maplibregl-ctrl-group button + button) {
		border-top-color: var(--color-line);
	}
	/* The control glyphs are background-image SVGs baked black; invert them on
	   dark so they don't vanish into the button they sit on. */
	:global(.dark .maplibregl-ctrl-group button .maplibregl-ctrl-icon) {
		filter: invert(1);
	}

	:global(.self-location-marker) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-primary);
		border: 3px solid var(--color-surface);
		box-shadow: 0 0 0 2px var(--color-primary-line);
		/* Absolute for the same reason as .listing-marker above. */
		position: absolute;
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
		/* Must stay absolute: MapLibre positions markers with a transform that
		   assumes the element is taken out of flow at the container origin. This
		   rule and .maplibregl-marker have equal specificity and ours is injected
		   last, so `relative` here silently won and offset every pin by its flow
		   position - which read as pins drifting on zoom. Absolute still gives the
		   count badge the containing block it needs. */
		position: absolute;
		padding: 0;
	}

	:global(.cluster-marker) {
		/* Absolute for the same reason as .listing-marker above. */
		position: absolute;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-family: inherit;
		font-weight: 700;
		line-height: 1;
		border: 3px solid white;
		/* Drop shadow plus the soft outer halo that reads as "more underneath". */
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.3),
			0 0 0 6px rgba(37, 99, 235, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		/* Never transition or set `transform` here: MapLibre rewrites the inline
		   transform every frame to keep the marker on its coordinate, so a
		   transition would make it lag the map while panning. Hover uses
		   box-shadow, which MapLibre doesn't touch. */
		transition: box-shadow 0.15s ease-out;
	}

	:global(.cluster-marker:hover) {
		box-shadow:
			0 3px 10px rgba(0, 0, 0, 0.35),
			0 0 0 9px rgba(37, 99, 235, 0.28);
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
