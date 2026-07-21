<script lang="ts">
	import { Bell, MessageCircle, CalendarClock } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/auth';
	import { watchUnreadCount, watchNotifications, markNotificationRead } from '$lib/data/notifications';
	import type { Timestamp } from 'firebase/firestore';

	let isOpen = $state(false);
	let unreadCount = $state(0);
	let notifications = $state<any[]>([]);
	let loading = $state(true);
	let dropdownRef: HTMLDivElement | undefined = $state();

	let unsubscribeCount: (() => void) | null = null;
	let unsubscribeList: (() => void) | null = null;

	onDestroy(() => {
		if (unsubscribeCount) unsubscribeCount();
		if (unsubscribeList) unsubscribeList();
	});

	function formatRelativeTime(value: unknown): string {
		let ms: number;
		const ts = value as Timestamp | null | undefined;
		if (ts && typeof ts.toDate === 'function') ms = ts.toDate().getTime();
		else ms = new Date(value as string).getTime();
		if (isNaN(ms)) return '';

		const diffMin = Math.floor((Date.now() - ms) / 60000);
		const diffHour = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHour / 24);

		if (diffMin < 1) return 'most';
		if (diffMin < 60) return `${diffMin} perce`;
		if (diffHour < 24) return `${diffHour} órája`;
		if (diffDay === 1) return 'tegnap';
		if (diffDay < 7) return `${diffDay} napja`;
		return `${Math.floor(diffDay / 7)} hete`;
	}

	function getIcon(type: string) {
		switch (type) {
			case 'NEW_MESSAGE':
				return MessageCircle;
			case 'NEW_REQUEST':
				return CalendarClock;
			default:
				return Bell;
		}
	}

	async function handleNotificationClick(notification: any) {
		if (!notification.is_read) {
			try {
				await markNotificationRead(notification.id);
				notification.is_read = true;
			} catch {
				// silently fail
			}
		}
		isOpen = false;
		if (notification.link) goto(notification.link);
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside, true);

		const me = get(currentUser);
		if (me) {
			// Live badge + live list, straight from Firestore. No polling needed.
			unsubscribeCount = watchUnreadCount(me.id, (n) => (unreadCount = n));
			unsubscribeList = watchNotifications(me.id, (list) => {
				notifications = list;
				loading = false;
			});
		} else {
			loading = false;
		}

		return () => {
			document.removeEventListener('click', handleClickOutside, true);
		};
	});
</script>

<div class="relative group/nav" bind:this={dropdownRef}>
	<button
		onclick={toggleDropdown}
		class="p-2 md:p-3 text-muted hover:text-primary hover:bg-primary-soft rounded-xl transition-colors relative"
		aria-label="Értesítések"
		aria-expanded={isOpen}
	>
		<Bell class="w-5 h-5 md:w-6 md:h-6" />
		{#if unreadCount > 0}
			<span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1">
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	<!-- Matches the Navbar's other icon tooltips; suppressed while the panel is
	     open so the label isn't left hovering over it. -->
	{#if !isOpen}
		<span
			class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-md bg-primary text-primary-fg text-xs font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-50"
			aria-hidden="true"
		>
			Értesítések
		</span>
	{/if}

	{#if isOpen}
		<div class="absolute right-0 mt-2 w-80 bg-surface rounded-xl shadow-xl border border-line overflow-hidden z-50">
			<div class="p-3 bg-raised border-b border-line flex items-center justify-between">
				<h3 class="text-sm font-semibold text-ink">Értesítések</h3>
				{#if unreadCount > 0}
					<span class="text-xs text-primary font-medium">{unreadCount} olvasatlan</span>
				{/if}
			</div>

			<div class="max-h-80 overflow-y-auto">
				{#if loading}
					<div class="p-6 text-center text-faint text-sm">Betöltés...</div>
				{:else if notifications.length === 0}
					<div class="p-6 text-center text-faint text-sm">Nincsenek értesítések</div>
				{:else}
					{#each notifications as notification (notification.id)}
						{@const IconComponent = getIcon(notification.type)}
						<button
							onclick={() => handleNotificationClick(notification)}
							class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-raised transition-colors border-b border-line last:border-b-0 {notification.is_read ? '' : 'bg-primary-soft/50'}"
						>
							<div class="mt-0.5 p-1.5 rounded-lg {notification.is_read ? 'bg-raised text-faint' : 'bg-primary-soft text-primary'}">
								<IconComponent class="w-4 h-4" />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm text-ink leading-tight {notification.is_read ? '' : 'font-semibold'}">
									{notification.title}
								</p>
								<p class="text-xs text-muted mt-0.5 truncate">{notification.body}</p>
								<p class="text-xs text-faint mt-1">{formatRelativeTime(notification.created_at)}</p>
							</div>
							{#if !notification.is_read}
								<div class="mt-2 w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
