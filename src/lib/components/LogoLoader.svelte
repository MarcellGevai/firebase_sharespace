<script lang="ts">
	let { fullScreen = false }: { fullScreen?: boolean } = $props();
</script>

{#if fullScreen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-emerald-900/80 backdrop-blur-sm transition-opacity">
		<img src="/gemini-icon.svg" alt="Loading" class="w-24 h-24 animate-pulse drop-shadow-xl" />
	</div>
{:else}
	<img src="/gemini-icon.svg" alt="Loading" class="w-16 h-16 animate-pulse" />
{/if}
