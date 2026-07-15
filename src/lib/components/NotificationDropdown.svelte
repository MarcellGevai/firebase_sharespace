<script lang="ts">
	import { Bell, MessageCircle, CalendarClock } from 'lucide-svelte';
	import { onMount } from 'svelte';
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
		let unsubCount = () => {};
		let unsubList = () => {};
		if (me) {
			// Live badge + live list, straight from Firestore. No polling needed.
			unsubCount = watchUnreadCount(me.id, (n) => (unreadCount = n));
			unsubList = watchNotifications(me.id, (list) => {
				notifications = list;
				loading = false;
			});
		} else {
			loading = false;
		}

		return () => {
			document.removeEventListener('click', handleClickOutside, true);
			unsubCount();
			unsubList();
		};
	});
</script>

<div class="relative" bind:this={dropdownRef}>
	<button
		onclick={toggleDropdown}
		class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors relative"
		aria-label="Értesítések"
	>
		<Bell class="w-5 h-5" />
		{#if unreadCount > 0}
			<span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1">
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	{#if isOpen}
		<div class="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
			<div class="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-gray-900">Értesítések</h3>
				{#if unreadCount > 0}
					<span class="text-xs text-blue-600 font-medium">{unreadCount} olvasatlan</span>
				{/if}
			</div>

			<div class="max-h-80 overflow-y-auto">
				{#if loading}
					<div class="p-6 text-center text-gray-400 text-sm">Betöltés...</div>
				{:else if notifications.length === 0}
					<div class="p-6 text-center text-gray-400 text-sm">Nincsenek értesítések</div>
				{:else}
					{#each notifications as notification (notification.id)}
						{@const IconComponent = getIcon(notification.type)}
						<button
							onclick={() => handleNotificationClick(notification)}
							class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 {notification.is_read ? '' : 'bg-blue-50/50'}"
						>
							<div class="mt-0.5 p-1.5 rounded-lg {notification.is_read ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}">
								<IconComponent class="w-4 h-4" />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm text-gray-900 leading-tight {notification.is_read ? '' : 'font-semibold'}">
									{notification.title}
								</p>
								<p class="text-xs text-gray-500 mt-0.5 truncate">{notification.body}</p>
								<p class="text-xs text-gray-400 mt-1">{formatRelativeTime(notification.created_at)}</p>
							</div>
							{#if !notification.is_read}
								<div class="mt-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
