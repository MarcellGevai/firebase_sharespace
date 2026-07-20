<script lang="ts">
	import { Search, MessageCircle, Map, LayoutList, Clock, Sun, Moon, LogOut } from 'lucide-svelte';
	import { theme, toggleTheme } from '$lib/theme';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { User, Listing } from '$lib/types';
	import { displayName } from '$lib/username';
	import NotificationDropdown from './NotificationDropdown.svelte';
	import { logout } from '$lib/auth';
	import { getAvailableListings } from '$lib/data/listings';
	import { searchUsers, type UserSearchResult } from '$lib/data/users';

	let { currentUser }: { currentUser: User | undefined } = $props();

	// Desktop gets a noticeably bigger hit area than the cramped mobile default.
	// Shared so the icons can't drift apart as they're edited individually.
	const navIconClass = 'p-2 md:p-3 rounded-xl transition-colors flex items-center justify-center';
	const navGlyphClass = 'w-5 h-5 md:w-6 md:h-6';
	// pointer-events-none so the label can never swallow a click meant for the
	// icon underneath it.
	const tooltipClass =
		'pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-md bg-primary text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-50';

	async function handleLogout() {
		await logout();
		window.location.href = '/';
	}

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

<!--
	One icon + hover label. Kept as a snippet so every nav icon shares the same
	sizing, active state and tooltip rather than drifting as they're edited.
	The label is aria-hidden: the <a>'s aria-label already announces it, and a
	screen reader shouldn't hear the name twice.
-->
{#snippet navItem(href: string, label: string, Icon: typeof LayoutList)}
	<div class="relative group/nav">
		<a
			{href}
			class={`${navIconClass} ${isActive(href) ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary hover:bg-primary-soft'}`}
			aria-label={label}
		>
			<Icon class={navGlyphClass} />
		</a>
		<span class={tooltipClass} aria-hidden="true">{label}</span>
	</div>
{/snippet}

<nav class="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-line shadow-sm">
	<!-- Wider than the app's max-w-2xl content column from md up: the bar is packed
	     to the pixel at 2xl (logo + search + actions exactly fill it), so the
	     roomier desktop icons below need somewhere to come from. -->
	<div class="max-w-2xl md:max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
		<!-- Logo -->
		<a href="/" class="flex items-center gap-2 hover:opacity-90 transition-opacity">
			<div class="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
				<span class="text-white font-bold text-lg leading-none">S</span>
			</div>
			<span class="text-xl font-bold bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent hidden sm:block">Sharespace</span>
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
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint group-focus-within:text-primary transition-colors pointer-events-none" />
					<input
						type="text"
						value={searchQuery}
						oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
						onfocus={() => { isSearchFocused = true; if (searchQuery.trim().length >= 2) showResults = true; }}
						onblur={() => setTimeout(() => { showResults = false; isSearchFocused = false; }, 150)}
						autocomplete="off"
						placeholder="Search items & services..."
						class="w-full bg-raised hover:bg-raised focus:bg-surface focus:shadow-lg border border-transparent focus:border-primary rounded-full py-2 pl-10 pr-4 text-sm text-ink placeholder:text-faint outline-none transition-colors duration-200"
					/>
				</div>

			{#if showResults}
				<div class="absolute left-0 right-0 mt-2 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden z-50 max-h-96 overflow-y-auto">
					{#if searching}
						<div class="p-4 text-sm text-faint text-center">Keresés...</div>
					{:else if userResults.length === 0 && listingResults.length === 0}
						<div class="p-4 text-sm text-faint text-center">Nincs találat.</div>
						{#if !currentUser}
							<div class="px-3 py-2.5 text-xs text-muted bg-raised border-t border-line text-center">
								<a href="/login" class="text-primary font-semibold hover:underline">Jelentkezz be</a> a profilok kereséséhez.
							</div>
						{/if}
					{:else}
						{#if userResults.length > 0}
							<div class="px-3 py-2 text-xs font-semibold text-faint uppercase tracking-wide bg-raised">Felhasználók</div>
							{#each userResults as u (u.id)}
								<button
									type="button"
									onmousedown={() => goToProfile(u.id)}
									class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary-soft transition-colors text-left"
								>
									<img src={u.avatar_url} alt={u.name} class="w-8 h-8 rounded-full object-cover bg-raised flex-shrink-0" />
									<span class="text-sm font-medium text-ink truncate">{u.name}</span>
								</button>
							{/each}
						{/if}
						{#if listingResults.length > 0}
							<div class="px-3 py-2 text-xs font-semibold text-faint uppercase tracking-wide bg-raised">Hirdetések</div>
							{#each listingResults as l (l.id)}
								<button
									type="button"
									onmousedown={() => goToListing(l)}
									class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary-soft transition-colors text-left"
								>
									<img src={l.image_url} alt={l.title} class="w-8 h-8 rounded-lg object-cover bg-raised flex-shrink-0" />
									<span class="text-sm font-medium text-ink truncate">{l.title}</span>
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
			<div class="hidden md:flex items-center gap-2 lg:gap-3">
			{@render navItem('/feed', 'Hirdetések/Igények', LayoutList)}
			{@render navItem('/', 'Térkép', Map)}
			{#if currentUser}
				<NotificationDropdown />
				{@render navItem('/rentals', 'Bérléseim', Clock)}
				{@render navItem('/inbox', 'Üzenetek', MessageCircle)}
				<div class="h-8 w-px bg-raised mx-2"></div>
				<div class="flex items-center gap-3">
					<a href={`/profile/${currentUser.id}`} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
						<img src={currentUser.avatar_url} alt={displayName(currentUser)} class="w-9 h-9 rounded-full ring-2 ring-line object-cover" />
						<div class="text-sm">
							<p class="font-semibold text-ink">{displayName(currentUser)}</p>
							<p class="text-muted text-xs text-left">⭐️ {currentUser.trust_score}</p>
						</div>
					</a>
				</div>
			{:else}
				<a href="/login" class="text-sm font-semibold text-ink hover:text-primary transition-colors">Log in</a>
				<a href="/register" class="text-sm font-semibold text-primary-fg bg-primary hover:bg-primary-hover px-4 py-2 rounded-xl transition-colors">Sign up</a>
			{/if}
		</div>

		<!-- Theme toggle. Outside the `hidden md:flex` actions block on purpose: the
		     theme isn't auth-gated and shouldn't be desktop-only. -->
		<div class="relative group/nav">
			<button
				onclick={toggleTheme}
				aria-label={$theme === 'dark' ? 'Világos mód' : 'Sötét mód'}
				class="p-2 md:p-3 text-muted hover:text-primary hover:bg-primary-soft rounded-xl transition-colors flex items-center justify-center"
			>
				{#if $theme === 'dark'}
					<Sun class={navGlyphClass} />
				{:else}
					<Moon class={navGlyphClass} />
				{/if}
			</button>
			<span class={tooltipClass} aria-hidden="true">
				{$theme === 'dark' ? 'Világos mód' : 'Sötét mód'}
			</span>
		</div>

		<!-- Logout takes the slot the Kategóriák menu used to hold. That menu only
		     ever linked to /feed?category=..., which the feed's grouped list and the
		     map's own filter both cover - a third way to do the same thing. Outside
		     the `hidden md:flex` actions block, so signing out doesn't need a
		     desktop, which is also why the mobile bar no longer carries its own. -->
		{#if currentUser}
			<div class="relative ml-2 group/nav">
				<button
					onclick={handleLogout}
					aria-label="Kijelentkezés"
					class="p-2 md:p-3 text-muted hover:text-want hover:bg-want-soft rounded-xl transition-colors flex items-center justify-center"
				>
					<LogOut class={navGlyphClass} />
				</button>
				<span class={tooltipClass} aria-hidden="true">Kijelentkezés</span>
			</div>
		{/if}
		</div>
	</div>
	
	<!-- Mobile Profile Bar (simplified) -->
	<div class="md:hidden border-t border-line px-2 py-2 flex items-center justify-between bg-surface">
		{#if currentUser}
			<a href={`/profile/${currentUser.id}`} class="flex items-center gap-2">
				<img src={currentUser.avatar_url} alt={displayName(currentUser)} class="w-8 h-8 rounded-full object-cover" />
				<span class="text-sm font-semibold text-ink hidden sm:inline">{displayName(currentUser)}</span>
			</a>
			<div class="flex items-center gap-1">
				<a href="/feed" class={`p-1.5 rounded-lg transition-colors ${isActive('/feed') ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary'}`} aria-label="Hirdetések/Igények">
					<LayoutList class="w-5 h-5" />
				</a>
				<a href="/" class={`p-1.5 rounded-lg transition-colors ${isActive('/') ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary'}`} aria-label="Térkép">
					<Map class="w-5 h-5" />
				</a>
				<a href="/inbox" class={`p-1.5 rounded-lg transition-colors ${isActive('/inbox') ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary'}`} aria-label="Üzenetek">
					<MessageCircle class="w-5 h-5" />
				</a>
				<div class="p-1.5">
					<NotificationDropdown />
				</div>
				<a href="/rentals" class={`p-1.5 rounded-lg transition-colors ${isActive('/rentals') ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary'}`} aria-label="Bérléseim">
					<Clock class="w-5 h-5" />
				</a>
			</div>
		{:else}
			<div class="flex items-center gap-2">
				<a href="/feed" class={`p-1.5 rounded-lg transition-colors ${isActive('/feed') ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary'}`} aria-label="Hirdetések/Igények">
					<LayoutList class="w-5 h-5" />
				</a>
				<a href="/" class={`p-1.5 rounded-lg transition-colors ${isActive('/') ? 'bg-primary-soft text-primary' : 'text-muted hover:text-primary'}`} aria-label="Térkép">
					<Map class="w-5 h-5" />
				</a>
			</div>
			<div class="flex items-center gap-3">
				<a href="/login" class="text-sm font-semibold text-ink">Log in</a>
				<a href="/register" class="text-sm font-semibold text-primary">Sign up</a>
			</div>
		{/if}
	</div>
</nav>
