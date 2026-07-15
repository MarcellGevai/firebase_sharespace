<script lang="ts">
	import { X, Handshake, CalendarClock } from 'lucide-svelte';

	let {
		request,
		otherUser,
		submitting = false,
		onConfirm,
		onClose
	}: {
		request: any;
		otherUser: any;
		submitting?: boolean;
		onConfirm: (terms: { start_date: string; end_date: string; price_offer: number }) => void;
		onClose: () => void;
	} = $props();

	function toDateInput(v: any): string {
		if (!v) return '';
		const d = new Date(v);
		if (isNaN(d.getTime())) return '';
		return d.toISOString().slice(0, 10);
	}

	let startDate = $state(toDateInput(request?.start_date));
	let endDate = $state(toDateInput(request?.end_date));
	let priceOffer = $state<number>(Number(request?.price_offer) || 0);
	let errorMsg = $state('');

	function confirm() {
		if (!startDate || !endDate) {
			errorMsg = 'Kérlek add meg a kezdő és vég dátumot.';
			return;
		}
		if (new Date(startDate) > new Date(endDate)) {
			errorMsg = 'A kezdő dátum nem lehet a vég dátum után.';
			return;
		}
		if (priceOffer == null || priceOffer < 0) {
			errorMsg = 'Kérlek adj meg egy érvényes árat.';
			return;
		}
		errorMsg = '';
		onConfirm({ start_date: startDate, end_date: endDate, price_offer: priceOffer });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
	<div class="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" role="dialog" aria-modal="true">
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-gray-100">
			<h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
				<Handshake class="w-5 h-5 text-blue-600" />
				Csere megerősítése
			</h2>
			<button onclick={onClose} aria-label="Bezárás" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Body -->
		<div class="p-4 space-y-4">
			<p class="text-sm text-gray-500">
				Ellenőrizd a bérlés részleteit <span class="font-semibold text-gray-700">{otherUser?.name ?? 'a másik féllel'}</span> között.
				Ha szükséges, most módosíthatsz rajtuk, majd indítsd el az átadást.
			</p>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<label for="ho_start" class="block text-sm font-semibold text-gray-700">Kezdő dátum</label>
					<input
						type="date"
						id="ho_start"
						bind:value={startDate}
						class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
					/>
				</div>
				<div class="space-y-1.5">
					<label for="ho_end" class="block text-sm font-semibold text-gray-700">Vég dátum</label>
					<input
						type="date"
						id="ho_end"
						bind:value={endDate}
						class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
					/>
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="ho_price" class="block text-sm font-semibold text-gray-700">Ár (HUF)</label>
				<input
					type="number"
					id="ho_price"
					bind:value={priceOffer}
					min="0"
					class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
				/>
			</div>

			{#if errorMsg}
				<p class="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errorMsg}</p>
			{/if}

			<div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
				<CalendarClock class="w-4 h-4 mt-0.5 flex-shrink-0" />
				Az átadás indítása után a másik félnek <strong>5 percen belül</strong> meg kell erősítenie, hogy a csere zöld jelzést kapjon.
			</div>
		</div>

		<!-- Footer -->
		<div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
			<button
				onclick={onClose}
				class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
			>
				Mégsem
			</button>
			<button
				onclick={confirm}
				disabled={submitting}
				class="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if submitting}
					<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
					Indítás...
				{:else}
					<Handshake class="w-4 h-4" />
					Átadás indítása
				{/if}
			</button>
		</div>
	</div>
</div>
