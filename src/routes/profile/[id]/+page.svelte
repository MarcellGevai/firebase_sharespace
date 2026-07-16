<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentUser } from '$lib/auth';
	import { getUserProfile } from '$lib/data/users';
	import { getReviewsForUser } from '$lib/data/reviews';
	import { Star } from 'lucide-svelte';
	import type { User, Review } from '$lib/types';

	let loading = $state(true);
	let notFound = $state(false);
	let profile = $state<User | null>(null);
	let reviews = $state<Review[]>([]);

	function formatDate(ts: unknown): string {
		const t = ts as { toDate?: () => Date; seconds?: number } | null | undefined;
		if (t && typeof t.toDate === 'function') return t.toDate().toLocaleDateString('hu-HU');
		if (t && typeof t.seconds === 'number') return new Date(t.seconds * 1000).toLocaleDateString('hu-HU');
		return '';
	}

	onMount(() => {
		(async () => {
			const me = get(currentUser);
			if (!me) {
				goto('/login');
				return;
			}

			const id = $page.params.id;
			if (!id) {
				notFound = true;
				loading = false;
				return;
			}
			const [userProfile, userReviews] = await Promise.all([getUserProfile(id), getReviewsForUser(id)]);
			if (!userProfile) {
				notFound = true;
				loading = false;
				return;
			}
			profile = userProfile;
			reviews = userReviews;
			loading = false;
		})();
	});
</script>

<svelte:head>
	<title>{profile?.name ?? 'Profil'} - Sharespace</title>
</svelte:head>

<div class="max-w-2xl mx-auto">
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
		</div>
	{:else if notFound}
		<div class="text-center p-8 text-gray-500">Ez a felhasználó nem található.</div>
	{:else if profile}
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
			<img src={profile.avatar_url} alt={profile.name} class="w-24 h-24 rounded-full object-cover bg-gray-100 mb-4" />
			<h1 class="text-2xl font-bold text-gray-900">{profile.name}</h1>
			<p class="text-sm text-gray-500 mt-1">{profile.location}</p>
			<div class="flex items-center gap-1.5 mt-3 text-yellow-500 font-semibold">
				<Star class="w-5 h-5 fill-yellow-400 text-yellow-400" />
				{profile.trust_score ?? 0}
				<span class="text-gray-400 font-normal text-sm">({profile.review_count ?? 0} értékelés)</span>
			</div>
		</div>

		<div class="mt-6 space-y-3">
			<h2 class="text-lg font-bold text-gray-900">Értékelések</h2>
			{#if reviews.length === 0}
				<p class="text-sm text-gray-500">Még nincs értékelése.</p>
			{:else}
				{#each reviews as review (review.id)}
					<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
						<div class="flex items-center justify-between gap-3">
							<a href={`/profile/${review.reviewer_id}`} class="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
								<img
									src={review.reviewer_avatar_url}
									alt={review.reviewer_name}
									class="w-9 h-9 rounded-full object-cover bg-gray-100 flex-shrink-0"
								/>
								<span class="font-semibold text-gray-900 truncate">{review.reviewer_name}</span>
							</a>
							<span class="text-xs text-gray-400 whitespace-nowrap">{formatDate(review.created_at)}</span>
						</div>
						<div class="flex gap-0.5 mt-2">
							{#each Array(5) as _, i}
								<Star class="w-4 h-4 {i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}" />
							{/each}
						</div>
						{#if review.content}
							<p class="text-sm text-gray-600 mt-2">{review.content}</p>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
