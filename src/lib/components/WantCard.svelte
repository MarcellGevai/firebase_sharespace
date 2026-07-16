<script lang="ts">
	import type { Want } from '$lib/types';
	import { chatUrl } from '$lib/chat';
	import { Search, MessageCircle, Calendar } from 'lucide-svelte';

	let { want, currentUser }: { want: Want; currentUser?: any } = $props();

	function handleMessage() {
		if (!currentUser) {
			window.location.href = '/login';
			return;
		}
		window.location.href = chatUrl(want.id, want.requester_id);
	}

	function formatDate(d: string) {
		return new Date(d).toLocaleDateString('hu-HU');
	}
</script>

<article class="bg-white rounded-2xl shadow-sm border-2 border-red-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
	<!-- Header / Requester Info -->
	<div class="p-4 flex items-center justify-between">
		<a href={`/profile/${want.requester_id}`} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
			<img src={want.requester_avatar_url} alt={want.requester_name} class="w-10 h-10 rounded-full object-cover bg-gray-100" />
			<h3 class="font-semibold text-gray-900 leading-tight">{want.requester_name}</h3>
		</a>
		<span class="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-red-600 bg-red-50 px-2.5 py-1 rounded-full flex-shrink-0">
			<Search class="w-3 h-3" /> Igény
		</span>
	</div>

	<!-- Content -->
	<div class="px-4 pb-4">
		<h2 class="text-xl font-bold text-gray-900 mb-1">{want.title}</h2>
		{#if want.category}
			<span class="inline-block text-[10px] font-semibold uppercase tracking-wide text-red-700 bg-red-50 px-2 py-0.5 rounded-full mb-2">
				{want.category}
			</span>
		{/if}
		{#if want.description}
			<p class="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-2">{want.description}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
			<span class="flex items-center gap-1">
				<Calendar class="w-3.5 h-3.5" />
				{formatDate(want.date_from)} - {formatDate(want.date_to)}
			</span>
			<span class="font-bold text-red-600">{want.price_min} - {want.price_max} Ft</span>
		</div>

		<!-- Actions -->
		{#if !currentUser || currentUser.id !== want.requester_id}
			<button
				onclick={handleMessage}
				class="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
			>
				<MessageCircle class="w-4 h-4" />
				Üzenet küldése
			</button>
		{:else}
			<div class="w-full text-center text-sm font-semibold text-gray-400 py-2.5">
				Saját igényed
			</div>
		{/if}
	</div>
</article>
