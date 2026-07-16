<script lang="ts">
	import { X, Package, Wrench, Briefcase, Tag, Info, LocateFixed, Home, MapPin, Loader2 } from 'lucide-svelte';
	import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { v4 as uuidv4 } from 'uuid';
	import { storage } from '$lib/firebase';
	import { geocodeAddress, searchAddress, reverseGeocode, type AddressSuggestion } from '$lib/geocode';
	import { createListing } from '$lib/data/listings';

	let { isOpen = $bindable(false), onSuccess, currentUser }: { isOpen: boolean; onSuccess?: () => void; currentUser?: any } = $props();

	let type = $state('ITEM');
	let title = $state('');
	let category = $state('');
	let priceRange = $state('');
	let description = $state('');
	let isSubmitting = $state(false);
	let errorMsg = $state('');
	let imageFile = $state<File | null>(null);

	// Location: three ways to set where the listing appears on the map.
	let locationMode = $state<'current' | 'home' | 'custom'>('home');
	let location_address = $state('');
	let location_lat = $state<number | null>(null);
	let location_lon = $state<number | null>(null);
	let locationLoading = $state(false);
	let locationError = $state('');
	let addressSuggestions = $state<AddressSuggestion[]>([]);
	let showSuggestions = $state(false);
	let suggestionsLoading = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;
	// Tracks whether the one-time "default to home address" step has already run
	// for this open of the modal - independent of location_address's current
	// value, so clearing the custom address field never re-triggers it.
	let locationInitialized = $state(false);

	$effect(() => {
		if (isOpen && currentUser && !locationInitialized) {
			locationInitialized = true;
			if (currentUser.address) {
				locationMode = 'home';
				location_address = currentUser.address;
				location_lat = currentUser.latitude ?? null;
				location_lon = currentUser.longitude ?? null;
			} else {
				locationMode = 'custom';
			}
		}
	});

	function selectHome() {
		locationMode = 'home';
		showSuggestions = false;
		locationError = '';
		location_address = currentUser?.address || '';
		location_lat = currentUser?.latitude ?? null;
		location_lon = currentUser?.longitude ?? null;
	}

	function selectCustom() {
		locationMode = 'custom';
		location_address = '';
		location_lat = null;
		location_lon = null;
		addressSuggestions = [];
		showSuggestions = false;
		locationError = '';
	}

	function useCurrentLocation() {
		locationMode = 'current';
		showSuggestions = false;
		locationError = '';

		if (!navigator.geolocation) {
			locationError = 'A böngésző nem támogatja a helymeghatározást.';
			return;
		}

		locationLoading = true;
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				location_lat = pos.coords.latitude;
				location_lon = pos.coords.longitude;
				const address = await reverseGeocode(location_lat, location_lon);
				location_address = address || `${location_lat.toFixed(5)}, ${location_lon.toFixed(5)}`;
				locationLoading = false;
			},
			() => {
				locationError = 'Nem sikerült lekérni a jelenlegi helyzetet.';
				locationLoading = false;
			},
			{ timeout: 10000 }
		);
	}

	function handleLocationInput() {
		location_lat = null;
		location_lon = null;
		if (searchDebounce) clearTimeout(searchDebounce);

		const q = location_address;
		if (q.trim().length < 3) {
			addressSuggestions = [];
			showSuggestions = false;
			return;
		}

		searchDebounce = setTimeout(async () => {
			suggestionsLoading = true;
			addressSuggestions = await searchAddress(q);
			showSuggestions = addressSuggestions.length > 0;
			suggestionsLoading = false;
		}, 400);
	}

	function pickSuggestion(s: AddressSuggestion) {
		location_address = s.display_name;
		location_lat = s.lat;
		location_lon = s.lon;
		addressSuggestions = [];
		showSuggestions = false;
	}

	function handleImageChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			imageFile = target.files[0];
		}
	}

	const categories = ['Szerszámok', 'Háztartás', 'Elektronika', 'Kert', 'Sport', 'Szolgáltatás', 'Egyéb'];
	const priceRanges = ['Ingyenes', '1 000 - 5 000 Ft', '5 000 - 10 000 Ft', '10 000+ Ft', 'Megegyezés szerint'];

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title || !category || !priceRange) {
			errorMsg = 'Kérjük, tölts ki minden kötelező mezőt!';
			return;
		}

		if (!currentUser) {
			errorMsg = 'Bejelentkezés szükséges.';
			return;
		}

		isSubmitting = true;
		errorMsg = '';

		try {
			// 1. Upload image to Firebase Storage (if provided).
			let image_url = '';
			if (imageFile) {
				const ext = imageFile.name.split('.').pop() || 'jpg';
				const path = `listings/${currentUser.id}/${uuidv4()}.${ext}`;
				const r = storageRef(storage, path);
				await uploadBytes(r, imageFile);
				image_url = await getDownloadURL(r);
			}

			// 2. Fallback stock image based on category/type when none uploaded.
			if (!image_url) {
				image_url = 'https://images.unsplash.com/photo-1513506003901-1e6a229e9d15?auto=format&fit=crop&w=600&q=80';
				if (category === 'Szerszámok') image_url = 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80';
				if (category === 'Elektronika') image_url = 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=600&q=80';
				if (category === 'Kert') image_url = 'https://images.unsplash.com/photo-1592424005686-2f085e3474fc?auto=format&fit=crop&w=600&q=80';
				if (category === 'Sport') image_url = 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80';
				if (type === 'SERVICE') image_url = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=600&q=80';
			}

			// 3. Resolve coordinates so the listing can appear on the map: reuse the
			// coordinates already picked (current location / home / chosen suggestion),
			// falling back to a best-effort geocode if the user typed a custom address
			// without selecting a suggestion.
			let coords: { lat: number; lon: number } | null = null;
			if (location_lat != null && location_lon != null) {
				coords = { lat: location_lat, lon: location_lon };
			} else if (location_address) {
				coords = await geocodeAddress(location_address).catch(() => null);
			}

			// 4. Create the Firestore document.
			await createListing(currentUser, {
				title,
				description,
				image_url,
				type: type as 'ITEM' | 'SERVICE',
				category,
				price_range: priceRange,
				location_address,
				latitude: coords?.lat ?? null,
				longitude: coords?.lon ?? null
			});

			// Success
			isOpen = false;
			// Reset form
			title = '';
			category = '';
			priceRange = '';
			description = '';
			location_address = '';
			location_lat = null;
			location_lon = null;
			locationMode = currentUser?.address ? 'home' : 'custom';
			locationInitialized = false;
			imageFile = null;
			type = 'ITEM';
			
			if (onSuccess) onSuccess();
			
		} catch (err: any) {
			errorMsg = err.message;
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		isOpen = false;
		locationInitialized = false;
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onclick={closeModal}></div>
		
		<!-- Modal Box -->
		<div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
			
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
				<h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
					<Package class="w-5 h-5 text-blue-600" />
					Új Hirdetés
				</h2>
				<button onclick={closeModal} class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 overflow-y-auto">
				<form id="create-listing-form" onsubmit={handleSubmit} class="space-y-5">
					
					<!-- Type Selection -->
					<div class="grid grid-cols-2 gap-3">
						<button 
							type="button"
							onclick={() => type = 'ITEM'}
							class={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold transition-all ${type === 'ITEM' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'}`}
						>
							<Wrench class="w-4 h-4" />
							Tárgy
						</button>
						<button 
							type="button"
							onclick={() => type = 'SERVICE'}
							class={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold transition-all ${type === 'SERVICE' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'}`}
						>
							<Briefcase class="w-4 h-4" />
							Szolgáltatás
						</button>
					</div>

					<!-- Title -->
					<div class="space-y-1.5">
						<label for="title" class="block text-sm font-semibold text-gray-700">Mit szeretnél meghirdetni? *</label>
						<input 
							type="text" 
							id="title" 
							bind:value={title}
							class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
							placeholder={type === 'ITEM' ? 'Pl. Fúrógép, Fűnyíró...' : 'Pl. Fűnyírás, Korrepetálás...'}
							required
						/>
					</div>

					<!-- Category & Price -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<label for="category" class="block text-sm font-semibold text-gray-700">Kategória *</label>
							<div class="relative">
								<Tag class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
								<select 
									id="category" 
									bind:value={category}
									class="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
									required
								>
									<option value="" disabled selected>Válassz...</option>
									{#each categories as cat}
										<option value={cat}>{cat}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="space-y-1.5">
							<label for="price" class="block text-sm font-semibold text-gray-700">Árkategória (Kölcsönzés) *</label>
							<select 
								id="price" 
								bind:value={priceRange}
								class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
								required
							>
								<option value="" disabled selected>Válassz...</option>
								{#each priceRanges as price}
									<option value={price}>{price}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Image & Location -->
					<div class="space-y-1.5">
						<label class="block text-sm font-semibold text-gray-700">Kép feltöltése (Opcionális)</label>
						<input type="file" accept="image/*" onchange={handleImageChange} class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors" />
					</div>

					<div class="space-y-1.5">
						<label class="block text-sm font-semibold text-gray-700">Helyszín</label>

						<div class="grid grid-cols-3 gap-2">
							<button
								type="button"
								onclick={useCurrentLocation}
								class={`px-2 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${locationMode === 'current' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'}`}
							>
								<LocateFixed class="w-3.5 h-3.5" />
								Jelenlegi hely
							</button>
							<button
								type="button"
								onclick={selectHome}
								disabled={!currentUser?.address}
								class={`px-2 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${locationMode === 'home' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'}`}
							>
								<Home class="w-3.5 h-3.5" />
								Otthon
							</button>
							<button
								type="button"
								onclick={selectCustom}
								class={`px-2 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${locationMode === 'custom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'}`}
							>
								<MapPin class="w-3.5 h-3.5" />
								Egyéni cím
							</button>
						</div>

						{#if locationMode === 'custom'}
							<div class="relative">
								<input
									type="text"
									id="location"
									bind:value={location_address}
									oninput={handleLocationInput}
									onfocus={() => (showSuggestions = addressSuggestions.length > 0)}
									onblur={() => setTimeout(() => (showSuggestions = false), 150)}
									autocomplete="off"
									class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
									placeholder="Kezdj el gépelni, pl. Batthyány tér..."
									required
								/>
								{#if suggestionsLoading}
									<Loader2 class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
								{/if}
								{#if showSuggestions && addressSuggestions.length > 0}
									<ul class="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
										{#each addressSuggestions as s}
											<li>
												<button
													type="button"
													onmousedown={() => pickSuggestion(s)}
													class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
												>
													{s.display_name}
												</button>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{:else}
							<div class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-sm flex items-center gap-2 min-h-[42px]">
								{#if locationLoading}
									<Loader2 class="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
									<span class="text-gray-400">Helyzet lekérése...</span>
								{:else}
									<MapPin class="w-4 h-4 text-gray-400 flex-shrink-0" />
									<span>{location_address || 'Nincs megadva'}</span>
								{/if}
							</div>
						{/if}

						{#if locationError}
							<p class="text-xs text-red-600">{locationError}</p>
						{/if}
					</div>

					<!-- Description -->
					<div class="space-y-1.5">
						<label for="description" class="block text-sm font-semibold text-gray-700 flex justify-between">
							Leírás
							<span class="text-gray-400 font-normal">Opcionális</span>
						</label>
						<textarea 
							id="description" 
							bind:value={description}
							rows="3"
							class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
							placeholder="Pár szó a hirdetésről, feltételekről..."
						></textarea>
					</div>

					{#if errorMsg}
						<div class="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 flex items-start gap-2">
							<Info class="w-4 h-4 mt-0.5 flex-shrink-0" />
							{errorMsg}
						</div>
					{/if}
				</form>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
				<button 
					type="button" 
					onclick={closeModal}
					class="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
				>
					Mégsem
				</button>
				<button 
					type="submit" 
					form="create-listing-form"
					disabled={isSubmitting}
					class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-blue-200"
				>
					{isSubmitting ? 'Közzététel...' : 'Meghirdetem!'}
				</button>
			</div>
		</div>
	</div>
{/if}
