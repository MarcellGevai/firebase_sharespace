<script lang="ts">
	import { SlidersHorizontal, Check, ChevronDown } from 'lucide-svelte';
	import { SORT_OPTIONS, type SortKey } from '$lib/sorting';

	// One control for all three "Összes" lists (Tárgyak, Szolgáltatások, Igények),
	// so the choices and their wording can't drift apart between them.
	let { value = $bindable<SortKey>() }: { value: SortKey } = $props();

	let isOpen = $state(false);

	let activeLabel = $derived(SORT_OPTIONS.find((o) => o.id === value)?.label ?? '');

	function pick(id: SortKey) {
		value = id;
		isOpen = false;
	}
</script>

<div class="relative">
	<!-- The trigger names the current sort rather than just saying "Filter": the
	     list is always sorted by something, and a label that never changes can't
	     tell you which. -->
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		aria-expanded={isOpen}
		class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border border-line bg-surface text-muted hover:bg-raised transition-colors"
	>
		<SlidersHorizontal class="w-3.5 h-3.5" />
		<span class="text-ink">{activeLabel}</span>
		<ChevronDown class="w-3.5 h-3.5 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
	</button>

	{#if isOpen}
		<!-- Click-away catcher. A plain button rather than a window listener: it
		     can't fire before the trigger's own click and immediately reopen. -->
		<button
			type="button"
			class="fixed inset-0 z-10 cursor-default"
			onclick={() => (isOpen = false)}
			aria-label="Bezárás"
		></button>
		<div
			class="absolute left-0 top-full mt-1 z-20 w-44 bg-surface rounded-2xl border border-line shadow-[var(--shadow-pop)] overflow-hidden"
		>
			{#each SORT_OPTIONS as option (option.id)}
				<button
					type="button"
					onclick={() => pick(option.id)}
					class="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 {value ===
					option.id
						? 'bg-primary-soft text-primary font-semibold'
						: 'text-ink hover:bg-raised'}"
				>
					{option.label}
					{#if value === option.id}
						<Check class="w-4 h-4 shrink-0" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
