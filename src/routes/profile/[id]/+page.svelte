<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentUser } from '$lib/auth';
	import { getUserProfile, setProfileAvatar } from '$lib/data/users';
	import { getReviewsForUser } from '$lib/data/reviews';
	import { getListingsByOwner } from '$lib/data/listings';
	import { getWantsByRequester, syncRequesterSnapshotToWants } from '$lib/data/wants';
	import { syncOwnerSnapshotToListings } from '$lib/data/listings';
	import { refreshProfile } from '$lib/auth';
	import { Star, Pencil, Home, Package, Search, Dices, Check, X } from 'lucide-svelte';
	import EditProfileModal from '$lib/components/EditProfileModal.svelte';
	import RequestModal from '$lib/components/RequestModal.svelte';
	import WantCard from '$lib/components/WantCard.svelte';
	import CollapsibleSection from '$lib/components/CollapsibleSection.svelte';
	import { displayName } from '$lib/username';
	import {
		AVATAR_STYLES,
		avatarUrlFor,
		avatarStyleOf,
		randomAvatarSeed,
		type AvatarStyle
	} from '$lib/avatar';
	import type { User, Review, Listing, Want } from '$lib/types';

	let loading = $state(true);
	let notFound = $state(false);
	let profile = $state<User | null>(null);
	let reviews = $state<Review[]>([]);
	let listings = $state<Listing[]>([]);
	let wants = $state<Want[]>([]);
	let isEditOpen = $state(false);
	let requestListing = $state<Listing | null>(null);

	// Avatar picker. `draft` is a local preview only - nothing is written until
	// the user confirms, because saving fans out to every listing and want they
	// own, and re-rolling the dice is meant to be free.
	let avatarOpen = $state(false);
	let avatarDraft = $state<string | null>(null);
	let avatarStyle = $state<AvatarStyle>('bottts');
	let avatarSaving = $state(false);
	let avatarError = $state('');

	function openAvatarPicker() {
		avatarStyle = avatarStyleOf(profile?.avatar_url);
		avatarDraft = null;
		avatarError = '';
		avatarOpen = true;
	}

	/** New face, same collection. */
	function rollAvatar() {
		avatarDraft = avatarUrlFor(avatarStyle, randomAvatarSeed());
	}

	/** Switching collection re-rolls too: an unchanged face under a new style
	 *  would look like the button did nothing. */
	function pickStyle(style: AvatarStyle) {
		avatarStyle = style;
		rollAvatar();
	}

	async function saveAvatar() {
		if (!profile || !avatarDraft) return;
		avatarSaving = true;
		avatarError = '';
		try {
			await setProfileAvatar(profile.id, avatarDraft);
			// Listings and wants each hold their own copy of the face, and both are
			// world-readable - skipping this leaves the old avatar across the feed.
			// Best-effort, matching how the profile edit handles the same problem.
			await Promise.all([
				syncOwnerSnapshotToListings(profile.id, { owner_avatar_url: avatarDraft }).catch((e) =>
					console.error('owner avatar sync failed', e)
				),
				syncRequesterSnapshotToWants(profile.id, { requester_avatar_url: avatarDraft }).catch((e) =>
					console.error('requester avatar sync failed', e)
				)
			]);
			profile = { ...profile, avatar_url: avatarDraft };
			await refreshProfile();
			avatarOpen = false;
			avatarDraft = null;
		} catch (e) {
			console.error(e);
			avatarError = 'Az avatar mentése nem sikerült.';
		} finally {
			avatarSaving = false;
		}
	}

	// Which of the three sections are rolled down. All start closed: opening one
	// is the reader's choice, and a section that expands on arrival isn't a
	// choice they made.
	let open = $state({ reviews: false, listings: false, wants: false });

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
	<title>{profile ? displayName(profile) : 'Profil'} - Sharespace</title>
</svelte:head>


<div class="max-w-2xl mx-auto">
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-4 border-line border-t-primary rounded-full animate-spin"></div>
		</div>
	{:else if notFound}
		<div class="text-center p-8 text-muted">Ez a felhasználó nem található.</div>
	{:else if profile}
		<div class="bg-surface rounded-2xl border border-line shadow-sm p-6 relative">
			{#if isOwnProfile}
				<button
					onclick={() => (isEditOpen = true)}
					class="absolute top-4 right-4 px-3 py-1.5 bg-surface border border-line text-muted rounded-lg text-sm font-semibold hover:bg-raised transition-colors flex items-center gap-1.5"
				>
					<Pencil class="w-4 h-4" /> Szerkesztés
				</button>
			{/if}

			<div class="flex flex-col items-center text-center">
				<!-- The draft face replaces the real one while the picker is open, so
				     you judge it at the size it will actually be worn. -->
				<img
					src={avatarDraft ?? profile.avatar_url}
					alt={displayName(profile)}
					class="w-24 h-24 rounded-full object-cover bg-raised mb-4"
				/>

				{#if isOwnProfile}
					{#if !avatarOpen}
						<button onclick={openAvatarPicker} class="btn btn-secondary mb-4 !py-1.5 !px-3 text-xs">
							<Dices class="w-4 h-4" /> Új avatar generálása
						</button>
					{:else}
						<div class="w-full mb-4 p-3 rounded-2xl border border-line bg-raised">
							<div class="flex flex-wrap justify-center gap-1.5">
								{#each AVATAR_STYLES as style (style.id)}
									<button
										onclick={() => pickStyle(style.id)}
										aria-pressed={avatarStyle === style.id}
										class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors {avatarStyle ===
										style.id
											? 'bg-primary-soft text-primary border-primary'
											: 'bg-surface text-muted border-line hover:bg-raised'}"
									>
										{style.label}
									</button>
								{/each}
							</div>

							<div class="flex items-center justify-center gap-2 mt-3">
								<button onclick={rollAvatar} class="btn btn-secondary !py-1.5 !px-3 text-xs">
									<Dices class="w-4 h-4" /> Dobj egyet
								</button>
								<button
									onclick={saveAvatar}
									disabled={!avatarDraft || avatarSaving}
									class="btn btn-primary !py-1.5 !px-3 text-xs"
								>
									<Check class="w-4 h-4" />
									{avatarSaving ? 'Mentés...' : 'Mentés'}
								</button>
								<button
									onclick={() => {
										avatarOpen = false;
										avatarDraft = null;
									}}
									class="btn btn-ghost !py-1.5 !px-3 text-xs"
								>
									<X class="w-4 h-4" /> Mégsem
								</button>
							</div>

							{#if avatarError}
								<p class="text-xs text-danger mt-2">{avatarError}</p>
							{:else if !avatarDraft}
								<p class="text-xs text-faint mt-2">
									Válassz stílust, vagy dobj egyet – a mentésig semmi nem változik.
								</p>
							{/if}
						</div>
					{/if}
				{/if}

				<h1 class="text-2xl font-bold text-ink">{displayName(profile)}</h1>
				<!-- Owner-only, like the address below: the legal name is not public. -->
				{#if isOwnProfile && profile.name}
					<p class="text-sm text-faint mt-0.5">{profile.name}</p>
				{/if}
				{#if profile.location}
					<p class="text-sm text-muted mt-1">{profile.location}</p>
				{/if}
				<div class="flex items-center gap-1.5 mt-3 text-star-ink font-semibold">
					<Star class="w-5 h-5 fill-star text-star" />
					{profile.trust_score ?? 0}
					<span class="text-faint font-normal text-sm">({profile.review_count ?? 0} értékelés)</span>
				</div>

				<!-- Owner-only. The precise address must never render on a public view. -->
				{#if isOwnProfile && profile.address}
					<div class="mt-4 w-full border-t border-line pt-4 flex items-start gap-2 text-left">
						<Home class="w-4 h-4 text-faint mt-0.5 shrink-0" />
						<div class="min-w-0">
							<p class="text-sm text-ink break-words">{profile.address}</p>
							<p class="text-xs text-faint mt-0.5">Csak te látod – másoknak csak a település jelenik meg.</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-6 space-y-3">
			<CollapsibleSection label="Értékelések" count={reviews.length} icon={Star} bind:open={open.reviews}>
				{#if reviews.length === 0}
					<p class="text-sm text-muted p-4">Még nincs értékelése.</p>
				{:else}
					<!-- Divided rows rather than nested cards: these already sit inside
					     the section's own white card. -->
					<ul class="divide-y divide-line">
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
											class="w-9 h-9 rounded-full object-cover bg-raised flex-shrink-0"
										/>
										<span class="font-semibold text-ink truncate">{review.reviewer_name}</span>
									</a>
									<span class="text-xs text-faint whitespace-nowrap">{formatDate(review.created_at)}</span>
								</div>
								<div class="flex gap-0.5 mt-2">
									{#each Array(5) as _, i}
										<Star class="w-4 h-4 {i < review.rating ? 'fill-star text-star' : 'text-faint'}" />
									{/each}
								</div>
								{#if review.content}
									<p class="text-sm text-muted mt-2">{review.content}</p>
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
							<p class="text-sm text-muted">
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
										class="text-left bg-surface rounded-2xl border border-line overflow-hidden {isOwnProfile
											? ''
											: 'hover:shadow-md hover:border-primary-line transition-all'}"
									>
										<div class="aspect-square w-full bg-raised overflow-hidden">
											<img
												src={listing.image_url}
												alt={listing.title}
												class="w-full h-full object-cover"
												loading="lazy"
											/>
										</div>
										<div class="p-2.5">
											<p class="text-sm font-semibold text-ink truncate">{listing.title}</p>
											<div class="flex items-center justify-between gap-1 mt-1">
												{#if listing.category}
													<span class="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary-soft px-1.5 py-0.5 rounded-full truncate">
														{listing.category}
													</span>
												{/if}
												{#if listing.price_range}
													<span class="text-[10px] font-bold text-primary whitespace-nowrap">{listing.price_range}</span>
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
						<p class="text-sm text-muted">
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
