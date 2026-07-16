<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import CreateListingModal from '$lib/components/CreateListingModal.svelte';
	import CreateRequestModal from '$lib/components/CreateRequestModal.svelte';
	import { Plus } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { initAuth } from '$lib/auth';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Keep the auth store live for the rest of the session (token refresh, sign-out
	// in another tab, etc.). The initial value already came from the layout load.
	onMount(() => initAuth());

	let currentUser = $derived(data.user ?? undefined);
	let isModalOpen = $state(false);
	let isRequestModalOpen = $state(false);
	// The map needs the full viewport instead of the app's centered column
	let isFullBleed = $derived($page.url.pathname === '/');

	function handleSuccess() {
		// Just reload the page for now to fetch new data
		window.location.reload();
	}
</script>

<div class={isFullBleed
	? 'h-screen overflow-hidden flex flex-col bg-[#FFFFF0] font-sans text-gray-900 relative'
	: 'min-h-screen bg-[#FFFFF0] font-sans text-gray-900 relative'}>
	<Navbar {currentUser} />
	<main class={isFullBleed ? 'flex-1 min-h-0' : 'max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-24'}>
		{@render children()}
	</main>

	<!-- Floating Action Button -->
	{#if currentUser}
		<div class="fixed bottom-6 left-6 z-40 group/fab">
			<!-- "Igény" mini-FAB: pops out above the main button when the FAB area is hovered/tapped. -->
			<button
				onclick={() => isRequestModalOpen = true}
				class="group/red absolute bottom-[4.5rem] left-0 bg-red-600 hover:bg-red-700 text-white h-14 rounded-full flex items-center shadow-lg shadow-red-200 transition-all duration-300 overflow-hidden opacity-0 scale-50 rotate-180 -translate-y-2 pointer-events-none group-hover/fab:opacity-100 group-hover/fab:scale-100 group-hover/fab:rotate-0 group-hover/fab:translate-y-0 group-hover/fab:pointer-events-auto"
				aria-label="Új Igény"
			>
				<div class="w-14 h-14 flex items-center justify-center flex-shrink-0">
					<Plus class="w-7 h-7" />
				</div>
				<div class="overflow-hidden transition-all duration-300 w-0 group-hover/red:w-20 flex items-center opacity-0 group-hover/red:opacity-100">
					<span class="whitespace-nowrap font-bold pr-5">Igény</span>
				</div>
			</button>

			<button
				onclick={() => isModalOpen = true}
				class="group/blue relative bg-blue-600 hover:bg-blue-700 text-white h-14 rounded-full flex items-center shadow-lg shadow-blue-200 transition-all duration-300 active:scale-95 overflow-hidden"
				aria-label="Új Hirdetés"
			>
				<div class="w-14 h-14 flex items-center justify-center flex-shrink-0">
					<Plus class="w-7 h-7 group-hover/fab:rotate-90 transition-transform duration-300" />
				</div>
				<div class="overflow-hidden transition-all duration-300 w-0 group-hover/blue:w-24 flex items-center opacity-0 group-hover/blue:opacity-100">
					<span class="whitespace-nowrap font-bold pr-5">Hirdetés</span>
				</div>
			</button>
		</div>

		<CreateListingModal bind:isOpen={isModalOpen} onSuccess={handleSuccess} {currentUser} />
		<CreateRequestModal bind:isOpen={isRequestModalOpen} onSuccess={handleSuccess} {currentUser} />
	{/if}
</div>
