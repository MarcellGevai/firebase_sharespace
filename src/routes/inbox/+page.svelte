<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { chatUrl } from '$lib/chat';
	import { currentUser } from '$lib/auth';
	import { watchInbox, type InboxConversation } from '$lib/data/messages';
	import { getUserProfile } from '$lib/data/users';

	let raw = $state<InboxConversation[]>([]);
	let profiles = $state<Record<string, { name: string; avatar_url: string }>>({});
	let loaded = $state(false);

	let conversations = $derived(
		raw.map((c) => ({
			...c,
			other_user_name: profiles[c.other_user_id]?.name ?? '…',
			other_user_avatar: profiles[c.other_user_id]?.avatar_url ?? ''
		}))
	);

	async function ensureProfiles(list: InboxConversation[]) {
		const missing = [...new Set(list.map((c) => c.other_user_id))].filter((id) => !profiles[id]);
		for (const id of missing) {
			const u = await getUserProfile(id);
			if (u) profiles = { ...profiles, [id]: { name: u.name, avatar_url: u.avatar_url } };
		}
	}

	onMount(() => {
		const me = get(currentUser);
		if (!me) {
			goto('/login');
			return;
		}
		const unsub = watchInbox(me.id, (list) => {
			raw = list;
			loaded = true;
			ensureProfiles(list);
		});
		return () => unsub();
	});

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}
</script>

<svelte:head>
	<title>Inbox - Sharespace</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
	<h1 class="text-2xl font-bold text-gray-900 px-2">Messages</h1>

	{#if !loaded}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
		</div>
	{:else if conversations.length === 0}
		<div class="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
			<div class="text-4xl mb-4">📭</div>
			<h2 class="text-lg font-semibold text-gray-900">No messages yet</h2>
			<p class="text-gray-500 mt-1">When you request an item or someone requests yours, messages will appear here.</p>
		</div>
	{:else}
		<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
			{#each conversations as conv (conv.listing_id + conv.other_user_id)}
				<a
					href={chatUrl(conv.listing_id, conv.other_user_id)}
					class="flex gap-4 p-4 hover:bg-gray-50 transition-colors group relative"
				>
					<!-- Unread Indicator -->
					{#if !conv.is_read && !conv.is_mine}
						<div class="absolute top-1/2 -translate-y-1/2 left-2 w-2 h-2 bg-blue-500 rounded-full"></div>
					{/if}

					<!-- Avatar -->
					<div class="relative shrink-0 ml-2">
						<img src={conv.other_user_avatar} alt={conv.other_user_name} class="w-12 h-12 rounded-full object-cover bg-gray-100" />
						<img src={conv.listing_image} alt="Listing" class="w-5 h-5 rounded-full object-cover absolute -bottom-1 -right-1 border-2 border-white bg-white" />
					</div>

					<!-- Content -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center justify-between gap-2 mb-0.5">
							<h3 class="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
								{conv.other_user_name}
							</h3>
							<span class="text-xs text-gray-400 whitespace-nowrap">{formatDate(conv.created_at)}</span>
						</div>
						<p class="text-xs font-medium text-blue-600 mb-1 truncate">{conv.listing_title}</p>
						<p class="text-sm text-gray-500 truncate {(!conv.is_read && !conv.is_mine) ? 'font-semibold text-gray-800' : ''}">
							{#if conv.is_mine}
								<span class="text-gray-400">You: </span>
							{/if}
							{conv.last_message}
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
