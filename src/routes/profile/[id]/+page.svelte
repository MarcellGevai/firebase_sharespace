<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentUser } from '$lib/auth';
	import { getUserProfile } from '$lib/data/users';
	import { getReviewsForUser } from '$lib/data/reviews';
	import { getListingsByOwner } from '$lib/data/listings';
	import { getWantsByRequester } from '$lib/data/wants';
	import { Star, Pencil, Home, Package, Search } from 'lucide-svelte';
	import EditProfileModal from '$lib/components/EditProfileModal.svelte';
	import RequestModal from '$lib/components/RequestModal.svelte';
	import WantCard from '$lib/components/WantCard.svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import type { User, Review, Listing, Want } from '$lib/types';

	let loading = $state(true);
	let notFound = $state(false);
	let profile = $state<User | null>(null);
	let reviews = $state<Review[]>([]);
	let listings = $state<Listing[]>([]);
	let wants = $state<Want[]>([]);
	let isEditOpen = $state(false);
	let requestListing = $state<Listing | null>(null);

	// Which of the three sections are rolled down. Reviews starts open so the
	// page never lands on three collapsed bars with nothing to read.
	let open = $state({ reviews: true, listings: false, wants: false });

	// Only the owner ever sees the precise address. Everything rendered outside
	// this guard is fair game for strangers, so keep address inside it.
	let isOwnProfile = $derived(!!profile && $currentUser?.id === profile.id);

	async function reloadProfile() {
		if (!profile) return;
		profile = await getUserProfile(profile.id);
	}

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
			const [userProfile, userReviews, userListings, userWants] = await Promise.all([
				getUserProfile(id),
				getReviewsForUser(id),
				getListingsByOwner(id),
				getWantsByRequester(id)
			]);
			if (!userProfile) {
				notFound = true;
				loading = false;
				return;
			}
			profile = userProfile;
			reviews = userReviews;
			listings = userListings;
			wants = userWants;
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
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
			{#if isOwnProfile}
				<button
					onclick={() => (isEditOpen = true)}
					class="absolute top-4 right-4 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
				>
					<Pencil class="w-4 h-4" /> Szerkesztés
				</button>
			{/if}

			<div class="flex flex-col items-center text-center">
				<img src={profile.avatar_url} alt={profile.name} class="w-24 h-24 rounded-full object-cover bg-gray-100 mb-4" />
				<h1 class="text-2xl font-bold text-gray-900">{profile.name}</h1>
				{#if profile.location}
					<p class="text-sm text-gray-500 mt-1">{profile.location}</p>
				{/if}
				<div class="flex items-center gap-1.5 mt-3 text-yellow-500 font-semibold">
					<Star class="w-5 h-5 fill-yellow-400 text-yellow-400" />
					{profile.trust_score ?? 0}
					<span class="text-gray-400 font-normal text-sm">({profile.review_count ?? 0} értékelés)</span>
				</div>

				<!-- Owner-only. The precise address must never render on a public view. -->
				{#if isOwnProfile && profile.address}
					<div class="mt-4 w-full border-t border-gray-100 pt-4 flex items-start gap-2 text-left">
						<Home class="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
						<div class="min-w-0">
							<p class="text-sm text-gray-700 break-words">{profile.address}</p>
							<p class="text-xs text-gray-400 mt-0.5">Csak te látod – másoknak csak a település jelenik meg.</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-6 space-y-3">
			<CollapsibleSection label="Értékelések" count={reviews.length} icon={Star} bind:open={open.reviews}>
				{#if reviews.length === 0}
					<p class="text-sm text-gray-500 p-4">Még nincs értékelése.</p>
				{:else}
					<!-- Divided rows rather than nested cards: these already sit inside
					     the section's own white card. -->
					<ul class="divide-y divide-gray-100">
						{#each reviews as review (review.id)}
							<li class="p-4">
								<div class="flex items-center justify-between gap-3">
									<a
										href={`/profile/${review.reviewer_id}`}
										class="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
									>
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
							</li>
						{/each}
					</ul>
				{/if}
			</CollapsibleSection>

			<!-- What this person currently has up. Only AVAILABLE listings: an
			     UNAVAILABLE one isn't something a visitor can act on. -->
			<CollapsibleSection
				label={isOwnProfile ? 'Hirdetéseid' : 'Hirdetései'}
				count={listings.length}
				icon={Package}
				bind:open={open.listings}
			>
				<div class="p-4">
						{#if listings.length === 0}
							<p class="text-sm text-gray-500">
								{isOwnProfile ? 'Még nincs aktív hirdetésed.' : 'Jelenleg nincs aktív hirdetése.'}
							</p>
						{:else}
							<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
								{#each listings as listing (listing.id)}
									<!-- There's no listing detail route, so the card opens the same
									     RequestModal the feed uses. On your own profile there's
									     nothing to request, so it stays a plain tile. -->
									<!-- role is redundant on a real <button>, but svelte:element is
									     dynamic so static analysis can't tell what `this` resolves to. -->
									<svelte:element
										this={isOwnProfile ? 'div' : 'button'}
										role={isOwnProfile ? undefined : 'button'}
										onclick={isOwnProfile ? undefined : () => (requestListing = listing)}
										class="text-left bg-white rounded-2xl border border-gray-100 overflow-hidden {isOwnProfile
											? ''
											: 'hover:shadow-md hover:border-blue-200 transition-all'}"
									>
										<div class="aspect-square w-full bg-gray-100 overflow-hidden">
											<img
												src={listing.image_url}
												alt={listing.title}
												class="w-full h-full object-cover"
												loading="lazy"
											/>
										</div>
										<div class="p-2.5">
											<p class="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
											<div class="flex items-center justify-between gap-1 mt-1">
												{#if listing.category}
													<span class="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full truncate">
														{listing.category}
													</span>
												{/if}
												{#if listing.price_range}
													<span class="text-[10px] font-bold text-green-700 whitespace-nowrap">{listing.price_range}</span>
												{/if}
											</div>
										</div>
									</svelte:element>
								{/each}
							</div>
						{/if}
				</div>
			</CollapsibleSection>

			<!-- Igények: the inverse of the listings above - what this person is
			     looking for. Reuses the feed's WantCard so the offer flow, the
			     "Saját igényed" guard and the styling stay in one place. -->
			<CollapsibleSection
				label={isOwnProfile ? 'Igényeid' : 'Igényei'}
				count={wants.length}
				icon={Search}
				bind:open={open.wants}
			>
				<div class="p-4 space-y-3">
					{#if wants.length === 0}
						<p class="text-sm text-gray-500">
							{isOwnProfile ? 'Még nincs igényed.' : 'Jelenleg nincs igénye.'}
						</p>
					{:else}
						{#each wants as want (want.id)}
							<WantCard {want} currentUser={$currentUser} />
						{/each}
					{/if}
				</div>
			</CollapsibleSection>
		</div>

		<!-- Mounted only while open, so the form re-seeds from the current profile
		     each time rather than keeping the values it captured on first mount. -->
		{#if isOwnProfile && isEditOpen}
			<EditProfileModal bind:isOpen={isEditOpen} {profile} onSaved={reloadProfile} />
		{/if}

		<RequestModal
			isOpen={!!requestListing}
			listing={requestListing}
			owner={profile}
			onClose={() => (requestListing = null)}
		/>
	{/if}
</div>
