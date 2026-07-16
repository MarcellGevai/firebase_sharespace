<script lang="ts">
	import { X, Handshake, CalendarClock, Pencil } from 'lucide-svelte';

	let {
		request,
		otherUser,
		submitting = false,
		onConfirm,
		onModify,
		onClose
	}: {
		request: any;
		otherUser: any;
		submitting?: boolean;
		onConfirm: () => void;
		onModify: () => void;
		onClose: () => void;
	} = $props();

	function formatDate(dStr: string) {
		return new Date(dStr).toLocaleDateString('hu-HU');
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
			<p class="text-sm text-gray-600">
				Megerősíted az átadást <span class="font-semibold text-gray-900">{otherUser?.name ?? 'a másik féllel'}</span>?
			</p>

			<div class="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700 flex items-center justify-between">
				<span>{formatDate(request.start_date)} - {formatDate(request.end_date)}</span>
				<span class="font-semibold">{request.price_offer} Ft</span>
			</div>

			<button
				type="button"
				onclick={onModify}
				class="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
			>
				<Pencil class="w-3.5 h-3.5" />
				Részletek módosítása
			</button>

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
				onclick={onConfirm}
				disabled={submitting}
				class="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if submitting}
					<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
					Indítás...
				{:else}
					<Handshake class="w-4 h-4" />
					Átadás megerősítése
				{/if}
			</button>
		</div>
	</div>
</div>
