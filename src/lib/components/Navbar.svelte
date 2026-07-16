<script lang="ts">
	import { Search, Bell, MessageCircle, Menu, X, Map, LayoutList, Clock } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { User, Listing } from '$lib/types';
	import { CATEGORIES } from '$lib/categories';
	import NotificationDropdown from './NotificationDropdown.svelte';
	import { logout } from '$lib/auth';
	import { getAvailableListings } from '$lib/data/listings';
	import { searchUsers, type UserSearchResult } from '$lib/data/users';

	let { currentUser }: { currentUser: User | undefined } = $props();

	async function handleLogout() {
		await logout();
		window.location.href = '/';
	}

	let isCategoryMenuOpen = $state(false);

	// "/" (the map) needs an exact match - every route "starts with" "/".
	function isActive(path: string): boolean {
		return path === '/' ? $page.url.pathname === '/' : $page.url.pathname.startsWith(path);
	}

	// Global search: users (new) + listings by title, in a dropdown below the bar.
	let searchQuery = $state('');
	let showResults = $state(false);
	let searching = $state(false);
	let isSearchFocused = $state(false);
	let userResults = $state<UserSearchResult[]>([]);
	let listingResults = $state<Listing[]>([]);
	let allListingsCache: Listing[] | null = null;
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;
	// Guards against a slow earlier request overwriting a newer query's results.
	let searchSeq = 0;

	async function runSearch(q: string, seq: number) {
		searching = true;
		showResults = true;

		// Listings and users are fetched independently so one failing can't discard
		// the other's hits or leave the dropdown stuck on the "searching" state.
		let listings: Listing[] = [];
		try {
			if (!allListingsCache) allListingsCache = await getAvailableListings();
			const qLower = q.toLowerCase();
			listings = allListingsCache.filter((l) => l.title.toLowerCase().includes(qLower)).slice(0, 5);
		} catch {
			listings = [];
		}

		// /users is readable only to signed-in visitors (the docs carry email and
		// address), so for a signed-out one the query would always be denied - skip
		// it and tell them why rather than showing a misleading "no results".
		let users: UserSearchResult[] = [];
		if (currentUser) {
			try {
				users = await searchUsers(q);
			} catch {
				users = [];
			}
		}

		if (seq !== searchSeq) return;
		listingResults = listings;
		userResults = users;
		searching = false;
	}

	function handleSearchInput(value: string) {
		searchQuery = value;
		if (searchDebounce) clearTimeout(searchDebounce);
		const q = value.trim();
		searchSeq++;
		if (q.length < 2) {
			userResults = [];
			listingResults = [];
			searching = false;
			showResults = false;
			return;
		}
		const seq = searchSeq;
		searchDebounce = setTimeout(() => runSearch(q, seq), 300);
	}

	function goToProfile(id: string) {
		showResults = false;
		searchQuery = '';
		goto(`/profile/${id}`);
	}

	function goToListing(listing: Listing) {
		showResults = false;
		searchQuery = '';
		goto(`/feed?q=${encodeURIComponent(listing.title)}`);
	}
</script>

<nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
	<div class="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
		<!-- Logo -->
		<a href="/" class="flex items-center gap-2 hover:opacity-90 transition-opacity">
			<div class="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
				<span class="text-white font-bold text-lg leading-none">S</span>
			</div>
			<span class="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hidden sm:block">Sharespace</span>
		</a>

		<!-- Search Bar. The outer div only reserves the navbar slot; the inner one is
		     absolutely positioned so focusing can widen it out over the action icons
		     without reflowing the logo or the rest of the bar. -->
		<div class="relative mx-4 h-10 flex-1 max-w-xs md:flex-none md:w-40">
			<div
				class={`absolute left-0 top-1/2 -translate-y-1/2 transition-[width] duration-300 ease-out ${
					isSearchFocused ? 'z-50 w-full md:w-[26rem]' : 'z-10 w-full'
				}`}
			>
				<div class="relative group">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
					<input
						type="text"
						value={searchQuery}
						oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
						onfocus={() => { isSearchFocused = true; if (searchQuery.trim().length >= 2) showResults = true; }}
						onblur={() => setTimeout(() => { showResults = false; isSearchFocused = false; }, 150)}
						autocomplete="off"
						placeholder="Search items & services..."
						class="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white focus:shadow-lg border border-transparent focus:border-blue-500 rounded-full py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors duration-200"
					/>
				</div>

			{#if showResults}
				<div class="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-96 overflow-y-auto">
					{#if searching}
						<div class="p-4 text-sm text-gray-400 text-center">Keresés...</div>
					{:else if userResults.length === 0 && listingResults.length === 0}
						<div class="p-4 text-sm text-gray-400 text-center">Nincs találat.</div>
						{#if !currentUser}
							<div class="px-3 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100 text-center">
								<a href="/login" class="text-blue-600 font-semibold hover:underline">Jelentkezz be</a> a profilok kereséséhez.
							</div>
						{/if}
					{:else}
						{#if userResults.length > 0}
							<div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Felhasználók</div>
							{#each userResults as u (u.id)}
								<button
									type="button"
									onmousedown={() => goToProfile(u.id)}
									class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
								>
									<img src={u.avatar_url} alt={u.name} class="w-8 h-8 rounded-full object-cover bg-gray-100 flex-shrink-0" />
									<span class="text-sm font-medium text-gray-900 truncate">{u.name}</span>
								</button>
							{/each}
						{/if}
						{#if listingResults.length > 0}
							<div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Hirdetések</div>
							{#each listingResults as l (l.id)}
								<button
									type="button"
									onmousedown={() => goToListing(l)}
									class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
								>
									<img src={l.image_url} alt={l.title} class="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
									<span class="text-sm font-medium text-gray-900 truncate">{l.title}</span>
								</button>
							{/each}
						{/if}
					{/if}
				</div>
			{/if}
			</div>
		</div>

		<div class="flex items-center gap-2">
			<!-- Actions -->
			<div class="hidden md:flex items-center gap-4">
			<a href="/feed" class={`p-2 rounded-xl transition-colors ${isActive('/feed') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} aria-label="Hirdetések">
				<LayoutList class="w-5 h-5" />
			</a>
			<a href="/" class={`p-2 rounded-xl transition-colors ${isActive('/') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} aria-label="Térkép">
				<Map class="w-5 h-5" />
			</a>
			{#if currentUser}
				<NotificationDropdown />
				<a href="/rentals" class={`p-2 rounded-xl transition-colors ${isActive('/rentals') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} aria-label="Bérléseim">
					<Clock class="w-5 h-5" />
				</a>
				<a href="/inbox" class={`p-2 rounded-xl transition-colors ${isActive('/inbox') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} aria-label="Üzenetek">
					<MessageCircle class="w-5 h-5" />
				</a>
				<div class="h-8 w-px bg-gray-200 mx-2"></div>
				<div class="flex items-center gap-3">
					<a href={`/profile/${currentUser.id}`} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
						<img src={currentUser.avatar_url} alt={currentUser.name} class="w-9 h-9 rounded-full ring-2 ring-gray-100 object-cover" />
						<div class="text-sm">
							<p class="font-semibold text-gray-900">{currentUser.name}</p>
							<p class="text-gray-500 text-xs text-left">⭐️ {currentUser.trust_score}</p>
						</div>
					</a>
					<button onclick={handleLogout} class="ml-2 text-xs text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded-md">Logout</button>
				</div>
			{:else}
				<a href="/login" class="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">Log in</a>
				<a href="/register" class="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors">Sign up</a>
			{/if}
		</div>

		<!-- Category Menu -->
		<div class="relative ml-2">
			<button 
				aria-label="Open categories menu" 
				onclick={() => isCategoryMenuOpen = !isCategoryMenuOpen}
				class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center justify-center"
			>
				{#if isCategoryMenuOpen}
					<X class="w-6 h-6" />
				{:else}
					<Menu class="w-6 h-6" />
				{/if}
			</button>

			{#if isCategoryMenuOpen}
				<div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
					<div class="p-3 bg-gray-50 border-b border-gray-100">
						<h3 class="text-sm font-semibold text-gray-900">Kategóriák</h3>
					</div>
					<div class="py-1 max-h-64 overflow-y-auto">
						{#each CATEGORIES as category}
							<a 
								href="/feed?category={category}" 
								onclick={() => isCategoryMenuOpen = false}
								class="block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
							>
								{category}
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		</div>
	</div>
	
	<!-- Mobile Profile Bar (simplified) -->
	<div class="md:hidden border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-white">
		{#if currentUser}
			<a href={`/profile/${currentUser.id}`} class="flex items-center gap-3">
				<img src={currentUser.avatar_url} alt={currentUser.name} class="w-8 h-8 rounded-full object-cover" />
				<span class="text-sm font-semibold text-gray-900">{currentUser.name}</span>
			</a>
			<div class="flex items-center gap-3">
				<a href="/feed" class={`p-1.5 rounded-lg transition-colors ${isActive('/feed') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`} aria-label="Hirdetések">
					<LayoutList class="w-5 h-5" />
				</a>
				<a href="/" class={`p-1.5 rounded-lg transition-colors ${isActive('/') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`} aria-label="Térkép">
					<Map class="w-5 h-5" />
				</a>
				<a href="/rentals" class={`p-1.5 rounded-lg transition-colors ${isActive('/rentals') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`} aria-label="Bérléseim">
					<Clock class="w-5 h-5" />
				</a>
				<button onclick={handleLogout} class="text-xs text-red-600 font-semibold px-2 py-1">Logout</button>
			</div>
		{:else}
			<div class="flex items-center gap-2">
				<a href="/feed" class={`p-1.5 rounded-lg transition-colors ${isActive('/feed') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`} aria-label="Hirdetések">
					<LayoutList class="w-5 h-5" />
				</a>
				<a href="/" class={`p-1.5 rounded-lg transition-colors ${isActive('/') ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`} aria-label="Térkép">
					<Map class="w-5 h-5" />
				</a>
			</div>
			<div class="flex items-center gap-3">
				<a href="/login" class="text-sm font-semibold text-gray-700">Log in</a>
				<a href="/register" class="text-sm font-semibold text-blue-600">Sign up</a>
			</div>
		{/if}
	</div>
</nav>
