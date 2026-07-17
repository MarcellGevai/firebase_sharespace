<script lang="ts">
	import { Star } from 'lucide-svelte';

	let { score }: { score: number } = $props();
</script>

<div
	class="flex items-center gap-1 px-2 py-1 bg-warn-soft text-star-ink rounded-full text-xs font-semibold"
>
	<Star class="w-3 h-3 fill-star text-star" />
	{score.toFixed(1)}
</div>
