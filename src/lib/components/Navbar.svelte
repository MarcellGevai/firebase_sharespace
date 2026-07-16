<script lang="ts">
	import { Search, Bell, MessageCircle, Menu, X, Map, LayoutList, Clock } from 'lucide-svelte';
	import type { User } from '$lib/types';
	import { CATEGORIES } from '$lib/categories';
	import NotificationDropdown from './NotificationDropdown.svelte';
	import { logout } from '$lib/auth';

	let { currentUser }: { currentUser: User | undefined } = $props();

	async function handleLogout() {
		await logout();
		window.location.href = '/';
	}

	let isCategoryMenuOpen = $state(false);
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

		<!-- Search Bar -->
		<div class="flex-1 max-w-xs mx-4">
			<div class="relative group">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
				<input
					type="text"
					placeholder="Search items & services..."
					class="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-500 rounded-full py-2 pl-10 pr-4 text-sm outline-none transition-all duration-200"
				/>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<!-- Actions -->
			<div class="hidden md:flex items-center gap-4">
			<a href="/feed" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" aria-label="Hirdetések">
				<LayoutList class="w-5 h-5" />
			</a>
			<a href="/" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" aria-label="Térkép">
				<Map class="w-5 h-5" />
			</a>
			{#if currentUser}
				<NotificationDropdown />
				<a href="/rentals" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" aria-label="Bérléseim">
					<Clock class="w-5 h-5" />
				</a>
				<a href="/inbox" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
					<MessageCircle class="w-5 h-5" />
				</a>
				<div class="h-8 w-px bg-gray-200 mx-2"></div>
				<div class="flex items-center gap-3">
					<img src={currentUser.avatar_url} alt={currentUser.name} class="w-9 h-9 rounded-full ring-2 ring-gray-100 object-cover" />
					<div class="text-sm">
						<p class="font-semibold text-gray-900">{currentUser.name}</p>
						<p class="text-gray-500 text-xs text-left">⭐️ {currentUser.trust_score}</p>
					</div>
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
			<div class="flex items-center gap-3">
				<img src={currentUser.avatar_url} alt={currentUser.name} class="w-8 h-8 rounded-full object-cover" />
				<span class="text-sm font-semibold text-gray-900">{currentUser.name}</span>
			</div>
			<div class="flex items-center gap-3">
				<a href="/feed" class="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" aria-label="Hirdetések">
					<LayoutList class="w-5 h-5" />
				</a>
				<a href="/" class="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" aria-label="Térkép">
					<Map class="w-5 h-5" />
				</a>
				<a href="/rentals" class="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" aria-label="Bérléseim">
					<Clock class="w-5 h-5" />
				</a>
				<button onclick={handleLogout} class="text-xs text-red-600 font-semibold px-2 py-1">Logout</button>
			</div>
		{:else}
			<div class="flex items-center gap-2">
				<a href="/feed" class="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" aria-label="Hirdetések">
					<LayoutList class="w-5 h-5" />
				</a>
				<a href="/" class="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" aria-label="Térkép">
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
