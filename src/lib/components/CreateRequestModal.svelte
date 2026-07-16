<script lang="ts">
	import { X, Search, Tag, Info } from 'lucide-svelte';
	import { createWant } from '$lib/data/wants';
	import { CATEGORIES } from '$lib/categories';

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

		isSubmitting = true;
		errorMsg = '';

		try {
			await createWant(currentUser, {
				title,
				description,
				category,
				date_from: dateFrom,
				date_to: dateTo,
				price_min: Number(priceMin),
				price_max: Number(priceMax)
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

			if (onSuccess) onSuccess();
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
		<div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onclick={closeModal}></div>

		<!-- Modal Box -->
		<div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
				<h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
					<Search class="w-5 h-5 text-red-600" />
					Új Igény
				</h2>
				<button onclick={closeModal} class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 overflow-y-auto">
				<form id="create-request-form" onsubmit={handleSubmit} class="space-y-5">

					<!-- Title -->
					<div class="space-y-1.5">
						<label for="req_title" class="block text-sm font-semibold text-gray-700">Mit keresel? *</label>
						<input
							type="text"
							id="req_title"
							bind:value={title}
							class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
							placeholder="Pl. Fúrógép, Fűnyírás..."
							required
						/>
					</div>

					<!-- Category -->
					<div class="space-y-1.5">
						<label for="req_category" class="block text-sm font-semibold text-gray-700">Kategória *</label>
						<div class="relative">
							<Tag class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<select
								id="req_category"
								bind:value={category}
								class="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all appearance-none"
								required
							>
								<option value="" disabled selected>Válassz...</option>
								{#each CATEGORIES as cat}
									<option value={cat}>{cat}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Date Interval -->
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<label for="req_date_from" class="block text-sm font-semibold text-gray-700">Mikortól? *</label>
							<input
								type="date"
								id="req_date_from"
								bind:value={dateFrom}
								class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
								required
							/>
						</div>
						<div class="space-y-1.5">
							<label for="req_date_to" class="block text-sm font-semibold text-gray-700">Meddig? *</label>
							<input
								type="date"
								id="req_date_to"
								bind:value={dateTo}
								class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
								required
							/>
						</div>
					</div>

					<!-- Expected Price Range -->
					<div class="space-y-1.5">
						<label class="block text-sm font-semibold text-gray-700">Várható árintervallum (HUF) *</label>
						<div class="grid grid-cols-2 gap-4">
							<input
								type="number"
								id="req_price_min"
								bind:value={priceMin}
								min="0"
								placeholder="Min"
								class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all font-semibold"
								required
							/>
							<input
								type="number"
								id="req_price_max"
								bind:value={priceMax}
								min="0"
								placeholder="Max"
								class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all font-semibold"
								required
							/>
						</div>
					</div>

					<!-- Description -->
					<div class="space-y-1.5">
						<label for="req_description" class="block text-sm font-semibold text-gray-700 flex justify-between">
							Leírás
							<span class="text-gray-400 font-normal">Opcionális</span>
						</label>
						<textarea
							id="req_description"
							bind:value={description}
							rows="3"
							class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all resize-none"
							placeholder="Pár szó arról, mire van szükséged..."
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
					form="create-request-form"
					disabled={isSubmitting}
					class="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-red-200"
				>
					{isSubmitting ? 'Közzététel...' : 'Igény Feladása!'}
				</button>
			</div>
		</div>
	</div>
{/if}
