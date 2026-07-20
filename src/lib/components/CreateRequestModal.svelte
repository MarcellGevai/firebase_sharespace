<script lang="ts">
	import { goto } from '$app/navigation';
	import { X, Search, Tag, Info, MapPin, House, Loader2 } from 'lucide-svelte';
	import { createWant } from '$lib/data/wants';
	import { CATEGORIES } from '$lib/categories';
	import { searchAddress, geocodeAddress, type AddressSuggestion } from '$lib/geocode';

	let { isOpen = $bindable(false), onSuccess, currentUser }: { isOpen: boolean; onSuccess?: () => void; currentUser?: any } = $props();

	let title = $state('');
	let category = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let priceMin = $state<number | ''>('');
	let priceMax = $state<number | ''>('');
	let description = $state('');
	let isSubmitting = $state(false);
	let errorMsg = $state('');

	// Where the request applies. Defaults to the user's home so the common case
	// ("looking for a drill near me") needs no typing, but stays overridable.
	// NOTE: mirrors the picker in CreateListingModal; worth extracting into one
	// shared component once both can be exercised together.
	let locationMode = $state<'home' | 'custom'>('home');
	let locationAddress = $state('');
	let locationLat = $state<number | null>(null);
	let locationLon = $state<number | null>(null);
	let addressSuggestions = $state<AddressSuggestion[]>([]);
	let showSuggestions = $state(false);
	let suggestionsLoading = $state(false);
	let suggestDebounce: ReturnType<typeof setTimeout> | undefined;
	let locationInitialized = false;

	// Seed from the profile once per open; a user with no address on file has
	// nothing to default to, so they start on the custom field.
	$effect(() => {
		if (isOpen && currentUser && !locationInitialized) {
			locationInitialized = true;
			if (currentUser.address) {
				locationMode = 'home';
				locationAddress = currentUser.address;
				locationLat = currentUser.latitude ?? null;
				locationLon = currentUser.longitude ?? null;
			} else {
				locationMode = 'custom';
			}
		}
		if (!isOpen) locationInitialized = false;
	});

	function selectHome() {
		locationMode = 'home';
		locationAddress = currentUser?.address || '';
		locationLat = currentUser?.latitude ?? null;
		locationLon = currentUser?.longitude ?? null;
		showSuggestions = false;
	}

	function selectCustom() {
		locationMode = 'custom';
		locationAddress = '';
		locationLat = null;
		locationLon = null;
	}

	function handleLocationInput() {
		locationLat = null;
		locationLon = null;
		if (suggestDebounce) clearTimeout(suggestDebounce);
		const q = locationAddress;
		if (q.trim().length < 3) {
			addressSuggestions = [];
			showSuggestions = false;
			return;
		}
		suggestDebounce = setTimeout(async () => {
			suggestionsLoading = true;
			addressSuggestions = await searchAddress(q).catch(() => []);
			showSuggestions = addressSuggestions.length > 0;
			suggestionsLoading = false;
		}, 300);
	}

	function pickSuggestion(s: AddressSuggestion) {
		locationAddress = s.display_name;
		locationLat = s.lat;
		locationLon = s.lon;
		showSuggestions = false;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title || !category || !dateFrom || !dateTo) {
			errorMsg = 'Kérjük, tölts ki minden kötelező mezőt!';
			return;
		}
		if (new Date(dateFrom) > new Date(dateTo)) {
			errorMsg = 'A kezdő dátum nem lehet a vég dátum után.';
			return;
		}
		if (priceMin === '' || priceMax === '') {
			errorMsg = 'Kérjük, add meg a várható árintervallumot.';
			return;
		}
		if (Number(priceMin) > Number(priceMax)) {
			errorMsg = 'A minimum ár nem lehet nagyobb a maximumnál.';
			return;
		}

		if (!currentUser) {
			errorMsg = 'Bejelentkezés szükséges.';
			return;
		}

		if (!locationAddress.trim()) {
			errorMsg = 'Kérjük, add meg, hol keresed.';
			return;
		}

		isSubmitting = true;
		errorMsg = '';

		try {
			// Coordinates are what put the pin on the map. Picking a suggestion or
			// using the home address already supplies them; a typed-over address
			// still needs resolving.
			let lat = locationLat;
			let lon = locationLon;
			if (lat == null || lon == null) {
				const coords = await geocodeAddress(locationAddress).catch(() => null);
				lat = coords?.lat ?? null;
				lon = coords?.lon ?? null;
			}
			if (lat == null || lon == null) {
				errorMsg = 'Ezt a címet nem sikerült megtalálni – enélkül nem kerül fel a térképre.';
				isSubmitting = false;
				return;
			}

			await createWant(currentUser, {
				title,
				description,
				category,
				date_from: dateFrom,
				date_to: dateTo,
				price_min: Number(priceMin),
				price_max: Number(priceMax),
				location_address: locationAddress,
				latitude: lat,
				longitude: lon
			});

			// Success
			isOpen = false;
			// Reset form
			title = '';
			category = '';
			dateFrom = '';
			dateTo = '';
			priceMin = '';
			priceMax = '';
			description = '';
			locationAddress = '';
			locationLat = null;
			locationLon = null;

			if (onSuccess) onSuccess();
			goto('/feed');
		} catch (err: any) {
			errorMsg = err.message;
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onclick={closeModal}></div>

		<!-- Modal Box -->
		<div class="relative bg-surface rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

			<!-- Header -->
			<div class="px-6 py-4 border-b border-line flex items-center justify-between bg-surface sticky top-0 z-10">
				<h2 class="text-xl font-bold text-ink flex items-center gap-2">
					<Search class="w-5 h-5 text-want" />
					Új Igény
				</h2>
				<button onclick={closeModal} class="p-2 text-faint hover:text-muted hover:bg-raised rounded-full transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 overflow-y-auto">
				<form id="create-request-form" onsubmit={handleSubmit} class="space-y-5">

					<!-- Title -->
					<div class="space-y-1.5">
						<label for="req_title" class="block text-sm font-semibold text-ink">Mit keresel? *</label>
						<input
							type="text"
							id="req_title"
							bind:value={title}
							class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all"
							placeholder="Pl. Fúrógép, Fűnyírás..."
							required
						/>
					</div>

					<!-- Category -->
					<div class="space-y-1.5">
						<label for="req_category" class="block text-sm font-semibold text-ink">Kategória *</label>
						<div class="relative">
							<Tag class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
							<select
								id="req_category"
								bind:value={category}
								class="w-full pl-9 pr-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all appearance-none"
								required
							>
								<option value="" disabled selected>Válassz...</option>
								{#each CATEGORIES as cat}
									<option value={cat}>{cat}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Location: what puts the request on the map -->
					<div class="space-y-1.5">
						<span class="block text-sm font-semibold text-ink">Hol keresed? *</span>
						<div class="grid grid-cols-2 gap-2">
							<button
								type="button"
								onclick={selectHome}
								disabled={!currentUser?.address}
								class={`px-2 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${locationMode === 'home' ? 'border-want bg-want-soft text-want' : 'border-line bg-surface text-muted hover:border-line hover:bg-raised'}`}
							>
								<House class="w-3.5 h-3.5" />
								Otthoni címem
							</button>
							<button
								type="button"
								onclick={selectCustom}
								class={`px-2 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${locationMode === 'custom' ? 'border-want bg-want-soft text-want' : 'border-line bg-surface text-muted hover:border-line hover:bg-raised'}`}
							>
								<MapPin class="w-3.5 h-3.5" />
								Egyéni cím
							</button>
						</div>

						{#if locationMode === 'custom'}
							<div class="relative">
								<input
									type="text"
									id="req_location"
									bind:value={locationAddress}
									oninput={handleLocationInput}
									onfocus={() => (showSuggestions = addressSuggestions.length > 0)}
									onblur={() => setTimeout(() => (showSuggestions = false), 150)}
									autocomplete="off"
									class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all"
									placeholder="Kezdj el gépelni, pl. Batthyány tér..."
								/>
								{#if suggestionsLoading}
									<Loader2 class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint animate-spin" />
								{/if}
								{#if showSuggestions && addressSuggestions.length > 0}
									<ul class="absolute z-20 mt-1 w-full bg-surface border border-line rounded-xl shadow-lg max-h-48 overflow-y-auto">
										{#each addressSuggestions as s}
											<li>
												<button
													type="button"
													onmousedown={() => pickSuggestion(s)}
													class="w-full text-left px-4 py-2 text-sm text-ink hover:bg-primary-soft transition-colors"
												>
													{s.display_name}
												</button>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{:else}
							<div class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl text-ink text-sm flex items-center gap-2 min-h-[42px]">
								<House class="w-4 h-4 text-faint flex-shrink-0" />
								<span class="truncate">{locationAddress || 'Nincs cím a profilodban'}</span>
							</div>
						{/if}
						<p class="text-xs text-muted">A pin a térképen elmosva jelenik meg – a pontos cím nem látszik.</p>
					</div>

					<!-- Date Interval -->
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<label for="req_date_from" class="block text-sm font-semibold text-ink">Mikortól? *</label>
							<input
								type="date"
								id="req_date_from"
								bind:value={dateFrom}
								class="w-full px-3 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all"
								required
							/>
						</div>
						<div class="space-y-1.5">
							<label for="req_date_to" class="block text-sm font-semibold text-ink">Meddig? *</label>
							<input
								type="date"
								id="req_date_to"
								bind:value={dateTo}
								class="w-full px-3 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all"
								required
							/>
						</div>
					</div>

					<!-- Expected Price Range -->
					<div class="space-y-1.5">
						<label class="block text-sm font-semibold text-ink">Várható árintervallum (HUF) *</label>
						<div class="grid grid-cols-2 gap-4">
							<input
								type="number"
								id="req_price_min"
								bind:value={priceMin}
								min="0"
								placeholder="Min"
								class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all font-semibold"
								required
							/>
							<input
								type="number"
								id="req_price_max"
								bind:value={priceMax}
								min="0"
								placeholder="Max"
								class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all font-semibold"
								required
							/>
						</div>
					</div>

					<!-- Description -->
					<div class="space-y-1.5">
						<label for="req_description" class="block text-sm font-semibold text-ink flex justify-between">
							Leírás
							<span class="text-faint font-normal">Opcionális</span>
						</label>
						<textarea
							id="req_description"
							bind:value={description}
							rows="3"
							class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-want focus:bg-surface transition-all resize-none"
							placeholder="Pár szó arról, mire van szükséged..."
						></textarea>
					</div>

					{#if errorMsg}
						<div class="p-3 bg-want-soft text-want text-sm font-medium rounded-xl border border-want-line flex items-start gap-2">
							<Info class="w-4 h-4 mt-0.5 flex-shrink-0" />
							{errorMsg}
						</div>
					{/if}
				</form>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-line bg-raised flex justify-end gap-3 rounded-b-2xl">
				<button
					type="button"
					onclick={closeModal}
					class="px-5 py-2.5 text-muted font-semibold hover:bg-raised rounded-xl transition-colors"
				>
					Mégsem
				</button>
				<button
					type="submit"
					form="create-request-form"
					disabled={isSubmitting}
					class="px-6 py-2.5 bg-want hover:bg-want-hover text-want-fg font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-want-line"
				>
					{isSubmitting ? 'Közzététel...' : 'Igény Feladása!'}
				</button>
			</div>
		</div>
	</div>
{/if}
