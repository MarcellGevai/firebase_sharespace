<script lang="ts">
	import { ChevronDown, type Icon as IconType } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	// One rolled-up section: a clickable bar with an icon, a title, a count and a
	// chevron. Shared by the profile and the rentals page so the hit area and the
	// open/closed affordance can't drift apart as either is edited.
	//
	// Deliberately imposes no padding on the body - callers render dividered
	// lists, grids and card stacks in here, and each wants its own spacing.
	let {
		label,
		count,
		icon: Icon,
		iconClass = 'text-primary',
		open = $bindable(false),
		children
	}: {
		label: string;
		count: number;
		icon: typeof IconType;
		iconClass?: string;
		open?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
	<!-- aria-expanded is what tells a screen reader this toggles rather than
	     navigates; the chevron alone says nothing. -->
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		class="w-full flex items-center gap-2 p-4 text-left hover:bg-raised transition-colors"
	>
		<Icon class="w-5 h-5 shrink-0 {iconClass}" />
		<h2 class="text-lg font-bold text-ink">{label}</h2>
		<span class="text-sm font-semibold text-faint">({count})</span>
		<ChevronDown
			class="w-5 h-5 text-faint ml-auto shrink-0 transition-transform duration-200 {open
				? 'rotate-180'
				: ''}"
		/>
	</button>
	{#if open}
		<div class="border-t border-line">
			{@render children()}
		</div>
	{/if}
</div>
