<script lang="ts">
	import { ArrowLeft, Star, Send } from 'lucide-svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/auth';
	import { createReview } from '$lib/data/reviews';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rating = $state(0);
	let hoverRating = $state(0);
	let content = $state('');
	let isSubmitting = $state(false);
	let errorMsg = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const me = get(currentUser);
		if (!me || !data.reviewee) return;
		if (rating < 1 || rating > 5) {
			errorMsg = 'Érvénytelen értékelés (1-5 csillag szükséges).';
			return;
		}
		isSubmitting = true;
		errorMsg = '';
		try {
			await createReview({
				request_id: data.request_id,
				reviewer_id: me.id,
				reviewer_name: me.name,
				reviewer_avatar_url: me.avatar_url,
				reviewee_id: data.reviewee_id,
				rating,
				content
			});
			goto('/inbox');
		} catch (err) {
			console.error(err);
			errorMsg = 'Szerverhiba történt az értékelés mentésekor.';
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Értékelés - Sharespace</title>
</svelte:head>

<div class="flex flex-col min-h-full bg-gray-50 pb-20">
	<!-- Header -->
	<header class="bg-white border-b border-gray-100 sticky top-0 z-30">
		<div class="flex items-center justify-between p-4 max-w-lg mx-auto">
			<a href="/inbox" class="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">
				<ArrowLeft class="w-5 h-5" />
			</a>
			<h1 class="text-lg font-bold text-gray-900">Értékelés leadása</h1>
			<div class="w-9"></div>
		</div>
	</header>

	<main class="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col items-center">
		{#if data.alreadyReviewed}
			<div class="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm w-full mt-8">
				<Star class="w-12 h-12 text-yellow-400 mx-auto mb-4" />
				<h2 class="text-xl font-bold text-gray-900 mb-2">Már értékeltél!</h2>
				<p class="text-gray-500 mb-6">Ezt a tranzakciót ({data.listing_title}) már sikeresen értékelted.</p>
				<a href="/inbox" class="inline-flex px-6 py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors">
					Vissza az üzenetekhez
				</a>
			</div>
		{:else if data.reviewee}
			<div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm w-full mt-4">
				<div class="flex flex-col items-center text-center mb-8">
					<a href={`/profile/${data.reviewee.id}`}>
						<img
							src={data.reviewee.avatar_url || `https://i.pravatar.cc/150?u=${data.reviewee.id}`}
							alt={data.reviewee.name}
							class="w-20 h-20 rounded-full object-cover shadow-sm mb-4 bg-gray-100 hover:opacity-80 transition-opacity"
						/>
					</a>
					<h2 class="text-xl font-bold text-gray-900">Hogyan ment a bérlés?</h2>
					<p class="text-sm text-gray-500 mt-1">
						Értékeld <a href={`/profile/${data.reviewee.id}`} class="font-semibold text-gray-700 hover:text-blue-600 transition-colors">{data.reviewee.name}</a> felhasználót a "{data.listing_title}" kapcsán.
					</p>
				</div>

				<form onsubmit={handleSubmit} class="space-y-6 flex flex-col items-center">
					<!-- Stars -->
					<div class="flex gap-2 justify-center">
						{#each Array(5) as _, i}
							{@const starValue = i + 1}
							<button
								type="button"
								class="p-2 transition-transform hover:scale-110 focus:outline-none"
								onmouseenter={() => hoverRating = starValue}
								onmouseleave={() => hoverRating = 0}
								onclick={() => rating = starValue}
							>
								<Star
									class="w-10 h-10 transition-colors {starValue <= (hoverRating || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}"
								/>
							</button>
						{/each}
					</div>

					{#if rating > 0}
						<div class="text-center font-bold text-yellow-500">
							{#if rating === 1}Borzasztó
							{:else if rating === 2}Rossz
							{:else if rating === 3}Elmegy
							{:else if rating === 4}Jó
							{:else if rating === 5}Tökéletes!{/if}
						</div>
					{:else}
						<div class="text-center font-medium text-gray-400">
							Válassz egy csillagot
						</div>
					{/if}

					<!-- Content -->
					<div class="w-full space-y-1.5 mt-4">
						<label for="content" class="block text-sm font-semibold text-gray-700">Szöveges értékelés (opcionális)</label>
						<textarea
							id="content"
							bind:value={content}
							rows="4"
							placeholder="Írd le a tapasztalataidat..."
							class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
						></textarea>
					</div>

					{#if errorMsg}
						<p class="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl w-full text-center">{errorMsg}</p>
					{/if}

					<button
						type="submit"
						disabled={isSubmitting || rating === 0}
						class="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
					>
						{#if isSubmitting}
							<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Küldés...
						{:else}
							<Send class="w-5 h-5" />
							Értékelés leadása
						{/if}
					</button>
				</form>
			</div>
		{/if}
	</main>
</div>
