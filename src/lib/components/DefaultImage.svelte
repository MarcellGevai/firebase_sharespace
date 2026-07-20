<script lang="ts">
	import { categoryIcon } from '$lib/categories';
	
	let { category = '', type = 'listing', class: className = '' }: { 
		category?: string | null; 
		type?: 'listing' | 'request'; 
		class?: string;
	} = $props();

	// Resolve the exact Icon component
	let Icon = $derived(categoryIcon(category || ''));

	// Gradient classes based on type
	let gradientClass = $derived(
		type === 'listing' 
			? 'bg-gradient-to-br from-teal-500 to-emerald-700' 
			: 'bg-gradient-to-br from-amber-400 to-orange-600'
	);
</script>

<div class={`flex items-center justify-center overflow-hidden ${gradientClass} ${className}`}>
	<Icon class="w-1/3 h-1/3 min-w-6 min-h-6 text-white/80" />
</div>
