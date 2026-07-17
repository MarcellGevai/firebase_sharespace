<script lang="ts">
	import { untrack } from 'svelte';
	import { X, MapPin, TriangleAlert } from 'lucide-svelte';
	import { geocodeAddress } from '$lib/geocode';
	import { updateUserProfile } from '$lib/data/users';
	import { syncOwnerLocationToListings, syncOwnerNameToListings } from '$lib/data/listings';
	import { syncRequesterNameToWants } from '$lib/data/wants';
	import { changeUsername } from '$lib/data/usernames';
	import { validateUsername, displayName } from '$lib/username';
	import { updateAccountEmail, hasPasswordProvider, refreshProfile, authErrorMessage } from '$lib/auth';
	import type { User } from '$lib/types';

	let {
		isOpen = $bindable(),
		profile,
		onSaved
	}: { isOpen: boolean; profile: User; onSaved: () => void } = $props();

	// Seeded once, deliberately: these are form drafts, and re-syncing them from
	// `profile` mid-edit would wipe what the user is typing. The parent only
	// mounts this while it's open, so every open starts from a fresh profile.
	let name = $state(untrack(() => profile.name ?? ''));
	let username = $state(untrack(() => profile.username ?? ''));
	let email = $state(untrack(() => profile.email ?? ''));
	let address = $state(untrack(() => profile.address ?? ''));
	let dateOfBirth = $state(untrack(() => profile.date_of_birth ?? ''));
	let gender = $state(untrack(() => profile.gender ?? 'OTHER'));
	let currentPassword = $state('');

	let submitting = $state(false);
	let error = $state('');
	let notice = $state('');

	const canChangeEmail = hasPasswordProvider();
	let emailChanged = $derived(canChangeEmail && email.trim() !== (profile.email ?? '').trim());
	let usernameChanged = $derived(username.trim() !== (profile.username ?? '').trim());

	async function save() {
		if (!name.trim()) {
			error = 'A név nem lehet üres.';
			return;
		}
		if (!address.trim()) {
			error = 'A lakcím nem lehet üres.';
			return;
		}
		const usernameError = validateUsername(username);
		if (usernameError) {
			error = usernameError;
			return;
		}
		if (emailChanged && !currentPassword) {
			error = 'Az e-mail cím módosításához add meg a jelenlegi jelszavad.';
			return;
		}

		submitting = true;
		error = '';
		notice = '';

		// Re-geocode so the map pin follows the move, and so `location` (the public
		// copy, denormalized onto listings) is re-derived as a coarse locality
		// rather than keeping a stale one from the old address.
		const addressChanged = address.trim() !== (profile.address ?? '').trim();
		let coords = null;
		if (addressChanged) {
			coords = await geocodeAddress(address).catch(() => null);
			if (!coords) {
				error = 'Ezt a címet nem sikerült megtalálni. Ellenőrizd, vagy próbáld pontosabban.';
				submitting = false;
				return;
			}
		}

		try {
			// Reserved before the profile doc is touched: if the handle is taken,
			// the save must fail whole rather than leave the doc claiming a name
			// this user doesn't hold.
			if (usernameChanged) {
				await changeUsername(profile.id, profile.username, username.trim());
			}

			// The login address is changed via Firebase Auth, not by writing the
			// profile doc - and only after the user clicks the link sent to the new
			// address, so the /users copy is deliberately left alone here.
			if (emailChanged) {
				await updateAccountEmail(email.trim(), currentPassword);
				notice = `Megerősítő linket küldtünk a(z) ${email.trim()} címre. A belépési e-mail cím csak a link megnyitása után változik meg.`;
			}

			const nextLocation = coords ? coords.locality : (profile.location ?? '');
			await updateUserProfile(profile.id, {
				name: name.trim(),
				username: username.trim(),
				address: address.trim(),
				location: nextLocation,
				date_of_birth: dateOfBirth,
				gender,
				...(coords ? { latitude: coords.lat, longitude: coords.lon } : {})
			});

			// Listings carry a snapshot of the owner's public locality, and /listings
			// is world-readable - a stale snapshot would keep the old value visible.
			// Best-effort: a failure must not lose the profile save above.
			if (nextLocation !== (profile.location ?? '')) {
				await syncOwnerLocationToListings(profile.id, nextLocation).catch((e) =>
					console.error('owner_location sync failed', e)
				);
			}

			// Listings and wants both snapshot the owner's handle, and both are
			// world-readable - a rename that skipped this would leave the old handle
			// on show across the feed. Best-effort, same as the locality sync.
			if (usernameChanged) {
				const shown = displayName({ username: username.trim(), name: name.trim() });
				await Promise.all([
					syncOwnerNameToListings(profile.id, shown).catch((e) =>
						console.error('owner_name sync failed', e)
					),
					syncRequesterNameToWants(profile.id, shown).catch((e) =>
						console.error('requester_name sync failed', e)
					)
				]);
			}

			await refreshProfile();
			submitting = false;
			if (!notice) {
				isOpen = false;
				onSaved();
				return;
			}
			onSaved();
		} catch (err) {
			console.error(err);
			error = authErrorMessage(err) || 'A mentés nem sikerült.';
			submitting = false;
		}
	}
</script>

{#if isOpen}
	<button
		class="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm cursor-default"
		onclick={() => (isOpen = false)}
		aria-label="Bezárás"
	></button>
	<div
		class="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto"
	>
		<div class="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
			<h2 class="font-bold text-gray-900">Profil szerkesztése</h2>
			<button
				onclick={() => (isOpen = false)}
				aria-label="Bezárás"
				class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="p-4 space-y-4">
			<div class="space-y-1">
				<label for="ep_name" class="block text-sm font-semibold text-gray-700">Teljes név</label>
				<input
					id="ep_name"
					type="text"
					bind:value={name}
					class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
				/>
				<p class="text-xs text-gray-400">Csak te látod.</p>
			</div>

			<div class="space-y-1">
				<label for="ep_username" class="block text-sm font-semibold text-gray-700">Felhasználónév *</label>
				<div class="relative">
					<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">@</span>
					<input
						id="ep_username"
						type="text"
						bind:value={username}
						autocomplete="username"
						class="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
					/>
				</div>
				<p class="text-xs text-gray-400">Ez jelenik meg a nyilvános profilodon.</p>
			</div>

			<div class="space-y-1">
				<label for="ep_email" class="block text-sm font-semibold text-gray-700">E-mail cím</label>
				<input
					id="ep_email"
					type="email"
					bind:value={email}
					disabled={!canChangeEmail}
					class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
				/>
				{#if !canChangeEmail}
					<p class="text-xs text-gray-500">A belépési e-mail címet a Google-fiókod kezeli.</p>
				{/if}
			</div>

			{#if emailChanged}
				<div class="space-y-1">
					<label for="ep_pw" class="block text-sm font-semibold text-gray-700">Jelenlegi jelszó</label>
					<input
						id="ep_pw"
						type="password"
						bind:value={currentPassword}
						placeholder="••••••••"
						class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
					/>
					<p class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
						<TriangleAlert class="w-3.5 h-3.5 mt-0.5 shrink-0" />
						<span>Biztonsági okból a jelszavad kell hozzá, és az új címre küldött linket is meg kell nyitnod.</span>
					</p>
				</div>
			{/if}

			<div class="space-y-1">
				<label for="ep_address" class="block text-sm font-semibold text-gray-700">Lakcím</label>
				<input
					id="ep_address"
					type="text"
					bind:value={address}
					placeholder="Pl. 1111 Budapest, Fő utca 1."
					class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
				/>
				<p class="text-xs text-gray-500 flex items-start gap-1.5">
					<MapPin class="w-3.5 h-3.5 mt-0.5 shrink-0" />
					<span>A pontos címedet soha nem látják mások – nyilvánosan csak a településed/kerületed jelenik meg.</span>
				</p>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<label for="ep_dob" class="block text-sm font-semibold text-gray-700">Születési dátum</label>
					<input
						id="ep_dob"
						type="date"
						bind:value={dateOfBirth}
						class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
					/>
				</div>
				<div class="space-y-1">
					<label for="ep_gender" class="block text-sm font-semibold text-gray-700">Nem</label>
					<select
						id="ep_gender"
						bind:value={gender}
						class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
					>
						<option value="MALE">Férfi</option>
						<option value="FEMALE">Nő</option>
						<option value="OTHER">Egyéb</option>
					</select>
				</div>
			</div>

			{#if error}
				<p class="text-sm text-red-600">{error}</p>
			{/if}
			{#if notice}
				<p class="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>
			{/if}
		</div>

		<div class="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex justify-end gap-2">
			<button
				onclick={() => (isOpen = false)}
				class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
			>
				Mégsem
			</button>
			<button
				onclick={save}
				disabled={submitting}
				class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
			>
				{submitting ? 'Mentés...' : 'Mentés'}
			</button>
		</div>
	</div>
{/if}
