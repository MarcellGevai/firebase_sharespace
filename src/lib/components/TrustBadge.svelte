<script lang="ts">
	import { Star } from 'lucide-svelte';

	let { score }: { score: number } = $props();
</script>

<div
	class="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold"
>
	<Star class="w-3 h-3 fill-yellow-500 text-yellow-500" />
	{score.toFixed(1)}
</div>
