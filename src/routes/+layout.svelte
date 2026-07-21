<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import SplashScreen from '$lib/components/SplashScreen.svelte';
	import CreateListingModal from '$lib/components/CreateListingModal.svelte';
	import CreateRequestModal from '$lib/components/CreateRequestModal.svelte';
	import { Plus } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let appReady = $state(false);

	onMount(() => {
		let splashTimeout: number;

		const removeSplash = () => {
			if (appReady) return;
			// A timeout can be added here if we want a smooth fade in Phase 3
			// but for now we just toggle the boolean to unmount the Svelte component.
			appReady = true;
			clearTimeout(splashTimeout);
		};

		// Fail-safe timeout
		splashTimeout = window.setTimeout(() => {
			removeSplash();
		}, 3500);

		// Resolve on auth state
		const unsubscribe = onAuthStateChanged(auth, () => {
			removeSplash();
		});

		return () => {
			unsubscribe();
			clearTimeout(splashTimeout);
		};
	});

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

{#if appReady}
	<!-- bg-canvas / text-ink are the themed tokens: the variables behind them flip
		 under .dark, so this needs no dark: variant. -->
	<div class={isFullBleed
		? 'h-screen overflow-hidden flex flex-col bg-canvas font-sans text-ink relative'
		: 'min-h-screen bg-canvas font-sans text-ink relative'}>
		<Navbar {currentUser} />
		<main class={isFullBleed ? 'flex-1 min-h-0' : 'max-w-2xl mx-auto px-4 py-6 sm:py-8 pb-24'}>
			{@render children()}
		</main>

		<!-- Floating Action Buttons -->
		{#if currentUser && auth.currentUser?.emailVerified}
			<div class="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3">
				<!-- "Igény" (request). Labels expand on hover; the buttons themselves are
					 always tappable so touch devices, which never hover, can reach both. -->
				<button
					onclick={() => isRequestModalOpen = true}
					class="group/red bg-want hover:bg-want-hover text-want-fg h-14 rounded-full flex items-center shadow-lg shadow-want-line transition-all duration-300 active:scale-95 overflow-hidden"
					aria-label="Új Igény"
				>
					<div class="w-14 h-14 flex items-center justify-center flex-shrink-0">
						<Plus class="w-7 h-7 group-hover/red:rotate-90 transition-transform duration-300" />
					</div>
					<div class="overflow-hidden transition-all duration-300 w-0 group-hover/red:w-20 flex items-center opacity-0 group-hover/red:opacity-100">
						<span class="whitespace-nowrap font-bold pr-5">Igény</span>
					</div>
				</button>

				<button
					onclick={() => isModalOpen = true}
					class="group/blue bg-primary hover:bg-primary-hover text-primary-fg h-14 rounded-full flex items-center shadow-lg shadow-primary-line transition-all duration-300 active:scale-95 overflow-hidden"
					aria-label="Új Hirdetés"
				>
					<div class="w-14 h-14 flex items-center justify-center flex-shrink-0">
						<Plus class="w-7 h-7 group-hover/blue:rotate-90 transition-transform duration-300" />
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
{:else}
	<SplashScreen />
{/if}
