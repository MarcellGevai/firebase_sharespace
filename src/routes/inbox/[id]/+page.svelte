<script lang="ts">
	import { ArrowLeft, Send } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import DealManager from '$lib/components/DealManager.svelte';
	import DefaultImage from '$lib/components/DefaultImage.svelte';
	import { parseChatId, chatUrl } from '$lib/chat';
	import { currentUser } from '$lib/auth';
	import { getUserProfile } from '$lib/data/users';
	import { getListing } from '$lib/data/listings';
	import {
		watchConversation,
		markConversationRead,
		sendMessage,
		type ChatMessage
	} from '$lib/data/messages';
	import { watchRequestForConversation } from '$lib/data/requests';
	import { createNotification } from '$lib/data/notifications';
	import { hasReviewed } from '$lib/data/reviews';

	let me = $state<any>(null);
	let messages = $state<ChatMessage[]>([]);
	let chatContext = $state<any>(null);
	let request = $state<any>(null);
	let sendError = $state('');
	let sending = $state(false);
	let notFound = $state(false);
	let chatContainer: HTMLElement | undefined = $state();
	let content = $state('');

	// Scroll to the newest message whenever the thread updates.
	$effect(() => {
		if (messages && chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	});

	function formatTime(dateStr: string) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
	}

	async function handleSend(e: Event) {
		e.preventDefault();
		const text = content.trim();
		if (!text || !me || !chatContext) return;
		sending = true;
		sendError = '';
		try {
			await sendMessage({
				listing_id: chatContext.listingId,
				// The deal's snapshot covers offers, whose listing_id points at a
				// /wants doc that getListing can't resolve. Falls back to the listing
				// for chats that have no deal yet.
				listing_title: request?.item_title || chatContext.listing?.title || '',
				listing_image: request?.item_image || chatContext.listing?.image_url || '',
				sender_id: me.id,
				receiver_id: chatContext.otherUserId,
				content: text
			});
			await createNotification({
				user_id: chatContext.otherUserId,
				type: 'NEW_MESSAGE',
				title: 'Új üzenet!',
				body: `${me.name} üzenetet küldött neked.`,
				link: chatUrl(chatContext.listingId, me.id)
			});
			content = '';
		} catch (err: any) {
			console.error('send failed', err);
			sendError = 'Az üzenet küldése nem sikerült.';
		} finally {
			sending = false;
		}
	}

	onMount(() => {
		me = get(currentUser);
		if (!me) {
			goto('/login');
			return;
		}
		const idParam = $page.params.id;
		const parsed = idParam ? parseChatId(idParam) : null;
		if (!parsed) {
			goto('/inbox');
			return;
		}
		const { listingId, otherUserId } = parsed;

		let unsubMessages = () => {};
		let unsubRequest = () => {};

		(async () => {
			const [otherUser, listing] = await Promise.all([
				getUserProfile(otherUserId),
				getListing(listingId)
			]);
			if (!otherUser) {
				notFound = true;
				return;
			}
			chatContext = { otherUser, listing, listingId, otherUserId };

			// Live deal/offer state - updates automatically when either party
			// accepts/rejects/initiates handover/etc, no manual refresh needed.
			unsubRequest = watchRequestForConversation(listingId, me.id, otherUserId, async (req) => {
				if (req) {
					req.has_reviewed = await hasReviewed(req.id, me.id);
				}
				request = req;
			});

			// Mark inbound messages read, then subscribe for realtime updates.
			markConversationRead(listingId, me.id, otherUserId).catch(() => {});
			unsubMessages = watchConversation(listingId, me.id, otherUserId, (list) => {
				messages = list;
			});
		})();

		return () => {
			unsubMessages();
			unsubRequest();
		};
	});
</script>

<svelte:head>
	<title>Chat with {chatContext?.otherUser?.name || 'User'} - Sharespace</title>
</svelte:head>

{#if notFound}
	<div class="text-center p-8">Chat not found.</div>
{:else if !chatContext}
	<div class="flex justify-center py-12">
		<div class="w-8 h-8 border-4 border-line border-t-primary rounded-full animate-spin"></div>
	</div>
{:else}
	<div class="max-w-2xl mx-auto h-[calc(100vh-64px)] md:h-[calc(100vh-100px)] flex flex-col bg-surface md:border md:border-line md:rounded-2xl shadow-sm overflow-hidden relative">

		<!-- Header -->
		<header class="flex items-center gap-3 p-4 border-b border-line bg-surface/90 backdrop-blur-md z-10">
			<a href="/inbox" class="p-2 -ml-2 text-muted hover:text-ink hover:bg-raised rounded-full transition-colors">
				<ArrowLeft class="w-5 h-5" />
			</a>
			<a href={`/profile/${chatContext.otherUserId}`} class="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
				<img src={chatContext.otherUser?.avatar_url} alt="Avatar" class="w-10 h-10 rounded-full object-cover bg-raised flex-shrink-0" />
				<div class="flex-1 min-w-0">
					<h2 class="font-bold text-ink truncate">{chatContext.otherUser?.name}</h2>
					<p class="text-xs text-muted truncate flex items-center gap-1">
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span> Active now
					</p>
				</div>
			</a>
		</header>

		<!-- Deal Manager -->
		<DealManager request={request} currentUser={me} otherUser={chatContext.otherUser} />

		<!-- Listing Context Banner -->
		{#if chatContext.listing}
			<a href="/listing/{chatContext.listing.id}" class="flex items-center gap-3 p-3 mx-4 mt-4 bg-raised hover:bg-raised transition-colors rounded-xl border border-line shrink-0">
				{#if chatContext.listing.image_url}
					<img src={chatContext.listing.image_url} alt="Listing" class="w-12 h-12 rounded-lg object-cover bg-raised" />
				{:else}
					<DefaultImage category={chatContext.listing.category} class="w-12 h-12 rounded-lg" />
				{/if}
				<div>
					<p class="text-xs font-bold text-muted uppercase tracking-wide">{chatContext.listing.type}</p>
					<h3 class="font-semibold text-ink">{chatContext.listing.title}</h3>
				</div>
			</a>
		{/if}

		<!-- Chat Area -->
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4">
			{#if messages.length === 0}
				<div class="text-center text-faint py-10 text-sm">
					No messages yet. Send the first message!
				</div>
			{/if}

			{#each messages as msg (msg.id)}
				<div class={`flex flex-col ${msg.is_mine ? 'items-end' : 'items-start'}`}>
					<div
						class={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
							msg.is_mine
								? 'bg-primary text-white rounded-br-sm'
								: 'bg-raised text-ink rounded-bl-sm'
						}`}
					>
						<p class="text-sm">{msg.content}</p>
					</div>
					<div class="flex items-center gap-1 mt-1 px-1">
						<span class="text-[10px] text-faint font-medium">{formatTime(msg.created_at)}</span>
						{#if msg.is_mine}
							<span class="text-[10px] text-faint">
								{msg.is_read ? '✓✓' : '✓'}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Input Area -->
		<div class="p-3 bg-surface border-t border-line shrink-0">
			<form onsubmit={handleSend} class="flex items-end gap-2">
				<div class="flex-1 bg-raised border border-line rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
					<textarea
						name="content"
						bind:value={content}
						rows="1"
						placeholder="Message..."
						class="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-4 max-h-32 text-sm"
						required
						onkeydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								handleSend(e);
							}
						}}
					></textarea>
				</div>
				<button
					type="submit"
					disabled={sending}
					class="p-3 bg-primary hover:bg-primary-hover text-primary-fg rounded-2xl transition-colors shrink-0 disabled:opacity-50"
				>
					<Send class="w-5 h-5 ml-0.5" />
				</button>
			</form>
			{#if sendError}
				<p class="text-xs text-red-500 mt-2 ml-2">{sendError}</p>
			{/if}
		</div>

	</div>
{/if}
