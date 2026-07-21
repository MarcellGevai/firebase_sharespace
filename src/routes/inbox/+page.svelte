<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { chatUrl } from '$lib/chat';
	import { currentUser } from '$lib/auth';
	import { watchInbox, type InboxConversation } from '$lib/data/messages';
	import { getUserProfile } from '$lib/data/users';
	import { getListing } from '$lib/data/listings';

	let raw = $state<InboxConversation[]>([]);
	let profiles = $state<Record<string, { name: string; avatar_url: string }>>({});
	let listingDetails = $state<Record<string, { category: string }>>({});
	let loaded = $state(false);

	let unsubscribeInbox: (() => void) | null = null;

	onDestroy(() => {
		if (unsubscribeInbox) unsubscribeInbox();
	});

	let conversations = $derived(
		raw.map((c) => ({
			...c,
			other_user_name: profiles[c.other_user_id]?.name ?? '…',
			other_user_avatar: profiles[c.other_user_id]?.avatar_url ?? '',
			listing_category: listingDetails[c.listing_id]?.category ?? ''
		}))
	);

	async function ensureProfiles(list: InboxConversation[]) {
		const missing = [...new Set(list.map((c) => c.other_user_id))].filter((id) => !profiles[id]);
		for (const id of missing) {
			const u = await getUserProfile(id);
			if (u) profiles = { ...profiles, [id]: { name: u.name, avatar_url: u.avatar_url } };
		}
	}

	async function ensureListings(list: InboxConversation[]) {
		const missing = [...new Set(list.map((c) => c.listing_id))].filter((id) => !listingDetails[id]);
		for (const id of missing) {
			const l = await getListing(id);
			if (l) listingDetails = { ...listingDetails, [id]: { category: l.category } };
		}
	}

	onMount(() => {
		const me = get(currentUser);
		if (!me) {
			goto('/login');
			return;
		}
		unsubscribeInbox = watchInbox(me.id, (list) => {
			raw = list;
			loaded = true;
			ensureProfiles(list);
			ensureListings(list);
		});
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
	<h1 class="text-2xl font-bold text-ink px-2">Messages</h1>

	{#if !loaded}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-4 border-line border-t-primary rounded-full animate-spin"></div>
		</div>
	{:else if conversations.length === 0}
		<div class="text-center py-12 bg-surface rounded-2xl shadow-sm border border-line">
			<div class="text-4xl mb-4">📭</div>
			<h2 class="text-lg font-semibold text-ink">No messages yet</h2>
			<p class="text-muted mt-1">When you request an item or someone requests yours, messages will appear here.</p>
		</div>
	{:else}
		<div class="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden divide-y divide-line">
			{#each conversations as conv (conv.listing_id + conv.other_user_id)}
				<a
					href={chatUrl(conv.listing_id, conv.other_user_id)}
					class="flex gap-4 p-4 hover:bg-raised transition-colors group relative"
				>
					<!-- Unread Indicator -->
					{#if !conv.is_read && !conv.is_mine}
						<div class="absolute top-1/2 -translate-y-1/2 left-2 w-2 h-2 bg-primary rounded-full"></div>
					{/if}

					<!-- Avatar -->
					<div class="relative shrink-0 ml-2">
						<img src={conv.other_user_avatar} alt={conv.other_user_name} class="w-12 h-12 rounded-full object-cover bg-raised" />
						<img src={conv.listing_image} alt="Listing" class="w-5 h-5 rounded-full object-cover absolute -bottom-1 -right-1 border-2 border-white bg-surface" />
					</div>

					<!-- Content -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center justify-between gap-2 mb-0.5">
							<h3 class="font-bold text-ink truncate group-hover:text-primary transition-colors">
								{conv.other_user_name}
							</h3>
							<span class="text-xs text-faint whitespace-nowrap">{formatDate(conv.created_at)}</span>
						</div>
						<div class="mb-1.5 flex">
							<div class="inline-flex items-center min-w-0 text-[11px] bg-slate-100/70 dark:bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50">
								{#if conv.listing_category}
									<span class="text-slate-500 dark:text-slate-400 whitespace-nowrap mr-1">{conv.listing_category}:</span>
								{/if}
								<span class="text-slate-700 dark:text-slate-300 font-medium truncate">{conv.listing_title}</span>
							</div>
						</div>
						<p class="text-sm truncate {(!conv.is_read && !conv.is_mine) ? 'font-semibold text-ink' : 'text-muted'}">
							{#if conv.is_mine}
								<span class="text-faint font-normal">You: </span>
							{/if}
							{conv.last_message}
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
