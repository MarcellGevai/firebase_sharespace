<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Flag, Users, BarChart3, Trash2, Ban, ShieldCheck, ShieldOff,
		CheckCircle, XCircle, AlertTriangle, Package, HandCoins, Star,
		Loader2, RefreshCw, Search
	} from 'lucide-svelte';
	import {
		callGetStats, callListUsers, callBanUser, callUnbanUser,
		callSetAdmin, callRemoveAdmin, callDeleteListing, callDeleteWant,
		callReviewReport, callListListings, callListWants,
		callSearchUserByEmail, callUpdateTrustScore, callListRequests,
		callDeleteAllListings,
		type AdminUser, type PlatformStats
	} from '$lib/admin';
	import { db } from '$lib/firebase';
	import { doc, getDoc, setDoc } from 'firebase/firestore';
	import { getReports } from '$lib/data/reports';
	import { createdMs } from '$lib/timestamps';
	import type { Report, ReportStatus } from '$lib/types';

	type Tab = 'reports' | 'users' | 'stats' | 'content' | 'deals' | 'system';
	let activeTab = $state<Tab>('reports');

	// ── Reports state ────────────────────────────────────────────────────────
	let reports = $state<Report[]>([]);
	let reportsLoading = $state(true);
	let reportFilter = $state<ReportStatus | ''>('PENDING');

	async function loadReports() {
		reportsLoading = true;
		try {
			reports = await getReports(reportFilter || undefined);
		} catch (e) {
			console.error('Failed to load reports:', e);
			reports = [];
		}
		reportsLoading = false;
	}

	async function handleReviewReport(reportId: string, status: 'REVIEWED' | 'ACTIONED', action?: string) {
		try {
			await callReviewReport(reportId, status, action);
			await loadReports();
		} catch (e) {
			alert('Hiba: ' + (e as Error).message);
		}
	}

	async function handleDeleteTarget(report: Report) {
		if (!confirm(`Biztosan törlöd: "${report.target_title ?? report.target_id}"?`)) return;
		try {
			if (report.target_type === 'LISTING') {
				await callDeleteListing(report.target_id);
			} else if (report.target_type === 'WANT') {
				await callDeleteWant(report.target_id);
			}
			await callReviewReport(report.id, 'ACTIONED', `${report.target_type} törölve`);
			await loadReports();
		} catch (e) {
			alert('Hiba: ' + (e as Error).message);
		}
	}

	// ── Users state ──────────────────────────────────────────────────────────
	let users = $state<AdminUser[]>([]);
	let usersLoading = $state(true);
	let usersNextPageToken = $state<string>();

	let searchEmail = $state('');
	let searchResult = $state<any | null>(null);
	let searchLoading = $state(false);
	let searchError = $state('');

	async function loadUsers(pageToken?: string) {
		usersLoading = true;
		try {
			const res = await callListUsers(pageToken);
			if (pageToken) {
				users = [...users, ...res.users];
			} else {
				users = res.users;
			}
			usersNextPageToken = res.pageToken;
		} catch (e) {
			console.error('Failed to load users:', e);
			if (!pageToken) users = [];
		}
		usersLoading = false;
	}

	async function handleSearchUser() {
		if (!searchEmail.trim()) return;
		searchLoading = true;
		searchError = '';
		searchResult = null;
		try {
			const user = await callSearchUserByEmail(searchEmail.trim());
			if (user) {
				searchResult = user;
			} else {
				searchError = 'Nincs felhasználó ezzel az email címmel.';
			}
		} catch (e) {
			searchError = (e as Error).message;
		}
		searchLoading = false;
	}

	async function handleUpdateTrustScore(uid: string, newScore: number) {
		if (!confirm(`Biztosan módosítod a bizalmi pontszámot erre: ${newScore}?`)) return;
		try {
			await callUpdateTrustScore(uid, newScore);
			if (searchResult && searchResult.uid === uid) {
				searchResult.trustScore = newScore;
			}
			alert('Bizalmi pontszám sikeresen frissítve!');
		} catch (e) {
			alert('Hiba: ' + (e as Error).message);
		}
	}

	async function handleBan(uid: string) {
		if (!confirm('Biztosan kitiltod ezt a felhasználót?')) return;
		try {
			await callBanUser(uid);
			await loadUsers();
		} catch (e) { alert('Hiba: ' + (e as Error).message); }
	}

	async function handleUnban(uid: string) {
		try {
			await callUnbanUser(uid);
			await loadUsers();
		} catch (e) { alert('Hiba: ' + (e as Error).message); }
	}

	async function handleToggleAdmin(user: AdminUser) {
		const action = user.isAdmin ? 'eltávolítod az admin jogot' : 'admin jogot adsz';
		if (!confirm(`Biztosan ${action}: ${user.displayName || user.email}?`)) return;
		try {
			if (user.isAdmin) {
				await callRemoveAdmin(user.uid);
			} else {
				await callSetAdmin(user.uid);
			}
			await loadUsers();
		} catch (e) { alert('Hiba: ' + (e as Error).message); }
	}

	// ── Stats state ──────────────────────────────────────────────────────────
	let stats = $state<PlatformStats | null>(null);
	let statsLoading = $state(false);

	async function loadStats() {
		statsLoading = true;
		try {
			stats = await callGetStats();
		} catch (e) {
			console.error('Failed to load stats:', e);
		}
		statsLoading = false;
	}

	// ── Content state ────────────────────────────────────────────────────────
	let adminListings = $state<any[]>([]);
	let adminWants = $state<any[]>([]);
	let contentLoading = $state(false);

	async function loadContent() {
		contentLoading = true;
		try {
			const [lRes, wRes] = await Promise.all([
				callListListings(),
				callListWants()
			]);
			adminListings = lRes;
			adminWants = wRes;
		} catch (e) {
			console.error('Failed to load content:', e);
		}
		contentLoading = false;
	}

	async function handleDeleteListing(id: string) {
		if (!confirm('Biztosan törlöd ezt a hirdetést véglegesen?')) return;
		try {
			await callDeleteListing(id);
			adminListings = adminListings.filter(l => l.id !== id);
		} catch (e) { alert('Hiba: ' + (e as Error).message); }
	}

	async function handleDeleteAllListings() {
		if (!confirm('FIGYELEM: Biztosan törlöd a platform összes hirdetését? Ez a művelet nem vonható vissza!')) return;
		
		const verify = prompt('Kérlek írd be, hogy "TÖRLÉS", ha biztos vagy benne:');
		if (verify !== 'TÖRLÉS') return;

		try {
			contentLoading = true;
			await callDeleteAllListings();
			adminListings = [];
			alert('Minden hirdetés sikeresen törölve.');
		} catch (e) { 
			alert('Hiba: ' + (e as Error).message); 
		} finally {
			contentLoading = false;
		}
	}

	async function handleDeleteWant(id: string) {
		if (!confirm('Biztosan törlöd ezt az igényt véglegesen?')) return;
		try {
			await callDeleteWant(id);
			adminWants = adminWants.filter(w => w.id !== id);
		} catch (e) { alert('Hiba: ' + (e as Error).message); }
	}

	async function handleDeleteAllWants() {
		if (!confirm('FIGYELEM: Biztosan törlöd a platform összes igényét? Ez a művelet nem vonható vissza!')) return;
		
		const verify = prompt('Kérlek írd be, hogy "TÖRLÉS", ha biztos vagy benne:');
		if (verify !== 'TÖRLÉS') return;

		try {
			contentLoading = true;
			await callDeleteAllWants();
			adminWants = [];
			alert('Minden igény sikeresen törölve.');
		} catch (e) { 
			alert('Hiba: ' + (e as Error).message); 
		} finally {
			contentLoading = false;
		}
	}

	// ── Deals state ──────────────────────────────────────────────────────────
	let adminDeals = $state<any[]>([]);
	let dealsLoading = $state(false);

	async function loadDeals() {
		dealsLoading = true;
		try {
			adminDeals = await callListRequests();
		} catch (e) {
			console.error('Failed to load deals:', e);
		}
		dealsLoading = false;
	}

	async function handleDeleteDeal(id: string) {
		if (!confirm('Biztosan törlöd ezt a tranzakciót/beszélgetést? Ezzel az összes hozzá tartozó üzenet is elvész!')) return;
		try {
			await callDeleteRequest(id);
			adminDeals = adminDeals.filter(d => d.id !== id);
		} catch (e) { alert('Hiba: ' + (e as Error).message); }
	}

	// ── System config state ──────────────────────────────────────────────────
	let bannerConfig = $state({ enabled: false, message: '', type: 'info' });
	let bannerLoading = $state(false);

	async function loadSystemConfig() {
		bannerLoading = true;
		try {
			const snap = await getDoc(doc(db, 'system_config', 'banner'));
			if (snap.exists()) {
				const data = snap.data();
				bannerConfig = {
					enabled: !!data.enabled,
					message: data.message || '',
					type: data.type || 'info'
				};
			}
		} catch (e) {
			console.error('Failed to load system config:', e);
		}
		bannerLoading = false;
	}

	async function handleSaveBanner() {
		try {
			await setDoc(doc(db, 'system_config', 'banner'), bannerConfig, { merge: true });
			alert('Rendszerüzenet sikeresen mentve!');
		} catch (e) {
			alert('Hiba: ' + (e as Error).message);
		}
	}

	// ── Tab switching ────────────────────────────────────────────────────────
	function switchTab(tab: Tab) {
		activeTab = tab;
		if (tab === 'reports' && reports.length === 0) loadReports();
		if (tab === 'users' && users.length === 0) loadUsers();
		if (tab === 'stats' && !stats) loadStats();
		if (tab === 'content' && adminListings.length === 0 && adminWants.length === 0) loadContent();
		if (tab === 'deals' && adminDeals.length === 0) loadDeals();
		if (tab === 'system' && !bannerConfig.message && !bannerConfig.enabled) loadSystemConfig();
	}

	onMount(() => { loadReports(); });

	function formatDate(ts: unknown): string {
		const ms = createdMs(ts);
		if (!ms) return '—';
		return new Date(ms).toLocaleDateString('hu-HU', {
			year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}

	const targetTypeLabel: Record<string, string> = {
		LISTING: 'Hirdetés',
		WANT: 'Igény',
		USER: 'Felhasználó'
	};

	const statusColors: Record<string, string> = {
		PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
		REVIEWED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
		ACTIONED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
	};
</script>

<!-- Tab Bar -->
<div class="flex flex-wrap gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-8 max-w-2xl">
	<button
		onclick={() => switchTab('reports')}
		class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all {activeTab === 'reports' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}"
	>
		<Flag class="w-4 h-4" />
		<span class="hidden sm:inline">Jelentések</span>
	</button>
	<button
		onclick={() => switchTab('users')}
		class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all {activeTab === 'users' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}"
	>
		<Users class="w-4 h-4" />
		<span class="hidden sm:inline">Felhasználók</span>
	</button>
	<button
		onclick={() => switchTab('stats')}
		class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all {activeTab === 'stats' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}"
	>
		<BarChart3 class="w-4 h-4" />
		Statisztikák
	</button>
	<button
		onclick={() => switchTab('content')}
		class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all {activeTab === 'content' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}"
	>
		<Package class="w-4 h-4" />
		Tartalmak
	</button>
	<button
		onclick={() => switchTab('deals')}
		class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all {activeTab === 'deals' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}"
	>
		<HandCoins class="w-4 h-4" />
		Tranzakciók
	</button>
</div>

<!-- ═══════════════ REPORTS TAB ═══════════════ -->
{#if activeTab === 'reports'}
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-100">Jelentések</h2>
			<div class="flex items-center gap-3">
				<select
					bind:value={reportFilter}
					onchange={() => loadReports()}
					class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
				>
					<option value="">Mind</option>
					<option value="PENDING">Függőben</option>
					<option value="REVIEWED">Átnézve</option>
					<option value="ACTIONED">Intézkedve</option>
				</select>
				<button onclick={() => loadReports()} class="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
					<RefreshCw class="w-4 h-4" />
				</button>
			</div>
		</div>

		{#if reportsLoading}
			<div class="flex justify-center py-16">
				<Loader2 class="w-8 h-8 text-emerald-400 animate-spin" />
			</div>
		{:else if reports.length === 0}
			<div class="text-center py-16 text-slate-500">
				<Flag class="w-12 h-12 mx-auto mb-3 opacity-30" />
				<p>Nincs jelentés{reportFilter ? ` (${reportFilter})` : ''}.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each reports as report}
					<div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="px-2 py-0.5 text-xs rounded-full border {statusColors[report.status] ?? ''}">{report.status}</span>
									<span class="text-xs text-slate-500">{targetTypeLabel[report.target_type] ?? report.target_type}</span>
									<span class="text-xs text-slate-600">•</span>
									<span class="text-xs text-slate-500">{formatDate(report.created_at)}</span>
								</div>
								<p class="text-sm text-slate-200 font-medium truncate">{report.target_title ?? report.target_id}</p>
								<p class="text-sm text-slate-400 mt-1">{report.reason}</p>
								<p class="text-xs text-slate-600 mt-1">Jelentette: {report.reporter_name ?? report.reporter_id}</p>
							</div>

							{#if report.status === 'PENDING'}
								<div class="flex items-center gap-2 flex-shrink-0">
									{#if report.target_type !== 'USER'}
										<button
											onclick={() => handleDeleteTarget(report)}
											class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
											title="Tartalom törlése"
										>
											<Trash2 class="w-3.5 h-3.5" />
											Törlés
										</button>
									{/if}
									<button
										onclick={() => handleReviewReport(report.id, 'REVIEWED')}
										class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
										title="Elutasítás (nincs teendő)"
									>
										<XCircle class="w-3.5 h-3.5" />
										Elutasít
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- ═══════════════ USERS TAB ═══════════════ -->
{#if activeTab === 'users'}
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-100">Felhasználók</h2>
			<button onclick={() => loadUsers()} class="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
				<RefreshCw class="w-4 h-4" />
			</button>
		</div>

		<!-- User Search -->
		<div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6">
			<h3 class="text-sm font-semibold text-slate-300 mb-3">Felhasználó keresése</h3>
			<form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); handleSearchUser(); }}>
				<input
					type="email"
					bind:value={searchEmail}
					placeholder="pelda@email.com"
					class="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5"
				/>
				<button type="submit" disabled={searchLoading} class="btn btn-primary whitespace-nowrap">
					{#if searchLoading}
						<Loader2 class="w-4 h-4 animate-spin mr-1.5" />
					{:else}
						<Search class="w-4 h-4 mr-1.5" />
					{/if}
					Keresés
				</button>
			</form>
			{#if searchError}
				<p class="text-red-400 text-sm mt-3">{searchError}</p>
			{/if}
			{#if searchResult}
				<div class="mt-4 p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<p class="text-slate-200 font-bold">{searchResult.displayName || 'Névtelen'}</p>
						<p class="text-slate-400 text-sm">{searchResult.email} <span class="text-slate-600 px-2">•</span> UID: <span class="text-xs font-mono text-slate-500">{searchResult.uid}</span></p>
					</div>
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-2">
							<span class="text-sm text-slate-400">Trust Score:</span>
							<input
								type="number"
								bind:value={searchResult.trustScore}
								class="w-20 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
							/>
						</div>
						<button
							onclick={() => handleUpdateTrustScore(searchResult.uid, searchResult.trustScore)}
							class="btn btn-secondary !py-2 !px-3"
						>
							Mentés
						</button>
					</div>
				</div>
			{/if}
		</div>

		{#if usersLoading && users.length === 0}
			<div class="flex justify-center py-16">
				<Loader2 class="w-8 h-8 text-emerald-400 animate-spin" />
			</div>
		{:else if users.length === 0}
			<div class="text-center py-16 text-slate-500">
				<Users class="w-12 h-12 mx-auto mb-3 opacity-30" />
				<p>Nem sikerült betölteni a felhasználókat.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-800 text-left">
							<th class="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Felhasználó</th>
							<th class="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
							<th class="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Regisztrált</th>
							<th class="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Státusz</th>
							<th class="pb-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Műveletek</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/50">
						{#each users as user}
							<tr class="hover:bg-slate-900/40 transition-colors">
								<td class="py-3 pr-4">
									<div class="flex items-center gap-3">
										{#if user.photoURL}
											<img src={user.photoURL} alt="" class="w-8 h-8 rounded-full object-cover bg-slate-800" />
										{:else}
											<div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">
												{(user.displayName || user.email || '?')[0].toUpperCase()}
											</div>
										{/if}
										<div>
											<p class="text-slate-200 font-medium">{user.displayName || '—'}</p>
											{#if user.isAdmin}
												<span class="text-xs text-emerald-400">Admin</span>
											{/if}
										</div>
									</div>
								</td>
								<td class="py-3 pr-4 text-slate-400">{user.email || '—'}</td>
								<td class="py-3 pr-4 text-slate-500 text-xs">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('hu-HU') : '—'}</td>
								<td class="py-3 pr-4">
									{#if user.disabled}
										<span class="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Tiltva</span>
									{:else}
										<span class="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aktív</span>
									{/if}
								</td>
								<td class="py-3 text-right">
									<div class="flex items-center justify-end gap-1.5">
										{#if user.disabled}
											<button
												onclick={() => handleUnban(user.uid)}
												class="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
												title="Tiltás feloldása"
											>
												<CheckCircle class="w-4 h-4" />
											</button>
										{:else}
											<button
												onclick={() => handleBan(user.uid)}
												class="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
												title="Kitiltás"
											>
												<Ban class="w-4 h-4" />
											</button>
										{/if}
										<button
											onclick={() => handleToggleAdmin(user)}
											class="p-1.5 {user.isAdmin ? 'text-amber-400 hover:bg-amber-500/10' : 'text-slate-500 hover:bg-slate-700'} rounded-lg transition-colors"
											title={user.isAdmin ? 'Admin jog elvétele' : 'Admin jog adása'}
										>
											{#if user.isAdmin}
												<ShieldOff class="w-4 h-4" />
											{:else}
												<ShieldCheck class="w-4 h-4" />
											{/if}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if usersNextPage}
				<div class="text-center pt-4">
					<button
						onclick={() => loadUsers(usersNextPage ?? undefined)}
						disabled={usersLoading}
						class="px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
					>
						{usersLoading ? 'Betöltés...' : 'Több felhasználó betöltése'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
{/if}

<!-- ═══════════════ STATS TAB ═══════════════ -->
{#if activeTab === 'stats'}
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-100">Platform statisztikák</h2>
			<button onclick={() => loadStats()} class="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
				<RefreshCw class="w-4 h-4" />
			</button>
		</div>

		{#if statsLoading}
			<div class="flex justify-center py-16">
				<Loader2 class="w-8 h-8 text-emerald-400 animate-spin" />
			</div>
		{:else if stats}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
				<!-- Users -->
				<div class="relative bg-slate-900/60 border border-slate-800 rounded-xl p-5 overflow-hidden group hover:border-emerald-500/20 transition-colors">
					<div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="relative">
						<div class="flex items-center gap-2 mb-2 text-slate-500">
							<Users class="w-4 h-4" />
							<span class="text-xs uppercase tracking-wider">Felhasználók</span>
						</div>
						<p class="text-3xl font-bold text-slate-100">{stats.totalUsers.toLocaleString('hu-HU')}</p>
					</div>
				</div>
				<!-- Listings -->
				<div class="relative bg-slate-900/60 border border-slate-800 rounded-xl p-5 overflow-hidden group hover:border-emerald-500/20 transition-colors">
					<div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="relative">
						<div class="flex items-center gap-2 mb-2 text-slate-500">
							<Package class="w-4 h-4" />
							<span class="text-xs uppercase tracking-wider">Hirdetések</span>
						</div>
						<p class="text-3xl font-bold text-slate-100">{stats.totalListings.toLocaleString('hu-HU')}</p>
					</div>
				</div>
				<!-- Wants -->
				<div class="relative bg-slate-900/60 border border-slate-800 rounded-xl p-5 overflow-hidden group hover:border-emerald-500/20 transition-colors">
					<div class="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="relative">
						<div class="flex items-center gap-2 mb-2 text-slate-500">
							<AlertTriangle class="w-4 h-4" />
							<span class="text-xs uppercase tracking-wider">Igények</span>
						</div>
						<p class="text-3xl font-bold text-slate-100">{stats.totalWants.toLocaleString('hu-HU')}</p>
					</div>
				</div>
				<!-- Deals -->
				<div class="relative bg-slate-900/60 border border-slate-800 rounded-xl p-5 overflow-hidden group hover:border-emerald-500/20 transition-colors">
					<div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="relative">
						<div class="flex items-center gap-2 mb-2 text-slate-500">
							<HandCoins class="w-4 h-4" />
							<span class="text-xs uppercase tracking-wider">Megállapodások</span>
						</div>
						<p class="text-3xl font-bold text-slate-100">{stats.totalDeals.toLocaleString('hu-HU')}</p>
					</div>
				</div>
				<!-- Reviews -->
				<div class="relative bg-slate-900/60 border border-slate-800 rounded-xl p-5 overflow-hidden group hover:border-emerald-500/20 transition-colors">
					<div class="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="relative">
						<div class="flex items-center gap-2 mb-2 text-slate-500">
							<Star class="w-4 h-4" />
							<span class="text-xs uppercase tracking-wider">Értékelések</span>
						</div>
						<p class="text-3xl font-bold text-slate-100">{stats.totalReviews.toLocaleString('hu-HU')}</p>
					</div>
				</div>
				<!-- Pending Reports -->
				<div class="relative bg-slate-900/60 border border-slate-800 rounded-xl p-5 overflow-hidden group hover:border-red-500/20 transition-colors">
					<div class="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="relative">
						<div class="flex items-center gap-2 mb-2 text-slate-500">
							<Flag class="w-4 h-4" />
							<span class="text-xs uppercase tracking-wider">Függő jelentések</span>
						</div>
						<p class="text-3xl font-bold {stats.pendingReports > 0 ? 'text-red-400' : 'text-slate-100'}">{stats.pendingReports.toLocaleString('hu-HU')}</p>
					</div>
				</div>
			</div>
		{:else}
			<div class="text-center py-16 text-slate-500">
				<BarChart3 class="w-12 h-12 mx-auto mb-3 opacity-30" />
				<p>Nem sikerült betölteni a statisztikákat.</p>
			</div>
		{/if}
	</div>
{/if}

<!-- ═══════════════ CONTENT TAB ═══════════════ -->
{#if activeTab === 'content'}
	<div class="space-y-8">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-100">Összes Tartalom</h2>
			<button onclick={loadContent} class="btn btn-secondary !bg-slate-800 !border-slate-700 hover:!bg-slate-700 !text-slate-300">
				<RefreshCw class="w-4 h-4 mr-1.5 {contentLoading ? 'animate-spin' : ''}" /> Frissítés
			</button>
		</div>

		{#if contentLoading && adminListings.length === 0}
			<div class="flex justify-center py-12">
				<Loader2 class="w-8 h-8 text-emerald-500 animate-spin" />
			</div>
		{:else}
			<div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
				<!-- Listings -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-medium text-slate-300">Hirdetések ({adminListings.length})</h3>
						{#if adminListings.length > 0}
							<button onclick={handleDeleteAllListings} class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
								<Trash2 class="w-3.5 h-3.5" />
								Összes törlése
							</button>
						{/if}
					</div>
					{#if adminListings.length === 0}
						<div class="text-center py-8 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
							Nincs hirdetés.
						</div>
					{:else}
						<div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
							<div class="overflow-x-auto">
								<table class="w-full text-left text-sm text-slate-300">
									<thead class="bg-slate-800/50 text-slate-400 uppercase text-xs border-b border-slate-800">
										<tr>
											<th class="px-4 py-3">Cím</th>
											<th class="px-4 py-3">Ár</th>
											<th class="px-4 py-3">Dátum</th>
											<th class="px-4 py-3 text-right">Művelet</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-800">
										{#each adminListings as listing}
											<tr class="hover:bg-slate-800/30 transition-colors">
												<td class="px-4 py-3 max-w-[200px] truncate">
													<a href="/listing/{listing.id}" class="text-emerald-400 hover:underline">{listing.title}</a>
												</td>
												<td class="px-4 py-3">{listing.price_per_day} Ft/nap</td>
												<td class="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(listing.created_at)}</td>
												<td class="px-4 py-3 text-right">
													<button onclick={() => handleDeleteListing(listing.id)} class="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-500/10 rounded-lg transition-colors">
														<Trash2 class="w-4 h-4" />
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>

				<!-- Wants -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-medium text-slate-300">Igények ({adminWants.length})</h3>
						{#if adminWants.length > 0}
							<button onclick={handleDeleteAllWants} class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors border border-red-500/20">
								<Trash2 class="w-3.5 h-3.5" />
								Összes törlése
							</button>
						{/if}
					</div>
					{#if adminWants.length === 0}
						<div class="text-center py-8 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
							Nincs igény.
						</div>
					{:else}
						<div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
							<div class="overflow-x-auto">
								<table class="w-full text-left text-sm text-slate-300">
									<thead class="bg-slate-800/50 text-slate-400 uppercase text-xs border-b border-slate-800">
										<tr>
											<th class="px-4 py-3">Cím</th>
											<th class="px-4 py-3">Költségvetés</th>
											<th class="px-4 py-3">Dátum</th>
											<th class="px-4 py-3 text-right">Művelet</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-800">
										{#each adminWants as want}
											<tr class="hover:bg-slate-800/30 transition-colors">
												<td class="px-4 py-3 max-w-[200px] truncate">
													<a href="/want/{want.id}" class="text-emerald-400 hover:underline">{want.title}</a>
												</td>
												<td class="px-4 py-3">{want.budget ? want.budget + ' Ft/nap' : '—'}</td>
												<td class="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(want.created_at)}</td>
												<td class="px-4 py-3 text-right">
													<button onclick={() => handleDeleteWant(want.id)} class="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-500/10 rounded-lg transition-colors">
														<Trash2 class="w-4 h-4" />
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- ═══════════════ DEALS TAB ═══════════════ -->
{#if activeTab === 'deals'}
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-100">Tranzakciók & Foglalások</h2>
			<button onclick={loadDeals} class="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
				<RefreshCw class="w-4 h-4 {dealsLoading ? 'animate-spin' : ''}" />
			</button>
		</div>

		{#if dealsLoading && adminDeals.length === 0}
			<div class="flex justify-center py-16">
				<Loader2 class="w-8 h-8 text-emerald-400 animate-spin" />
			</div>
		{:else if adminDeals.length === 0}
			<div class="text-center py-16 text-slate-500">
				<HandCoins class="w-12 h-12 mx-auto mb-3 opacity-30" />
				<p>Nem található tranzakció.</p>
			</div>
		{:else}
			<div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm text-slate-300">
						<thead class="bg-slate-800/50 text-slate-400 uppercase text-xs border-b border-slate-800">
							<tr>
								<th class="px-4 py-3">Tárgy / Foglalás ID</th>
								<th class="px-4 py-3">Dátumok</th>
								<th class="px-4 py-3">Ár</th>
								<th class="px-4 py-3">Státusz</th>
								<th class="px-4 py-3 text-right">Létrehozva</th>
								<th class="px-4 py-3 text-right">Művelet</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-800">
							{#each adminDeals as deal}
								<tr class="hover:bg-slate-800/30 transition-colors">
									<td class="px-4 py-3">
										<p class="font-medium text-slate-200 truncate max-w-[200px]">
											{#if deal.listingTitle}
												{deal.listingTitle}
											{:else}
												<span class="text-slate-500 italic">Ismeretlen</span>
											{/if}
										</p>
										<p class="text-xs text-slate-500 font-mono mt-0.5">{deal.id}</p>
									</td>
									<td class="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
										<span class="block">Kezdés: {formatDate(deal.startDate)}</span>
										<span class="block">Vége: {formatDate(deal.endDate)}</span>
									</td>
									<td class="px-4 py-3 font-medium">
										{deal.totalPrice ? deal.totalPrice + ' Ft' : '—'}
									</td>
									<td class="px-4 py-3">
										<span class="px-2 py-0.5 text-xs rounded-full border bg-slate-800 border-slate-700 text-slate-300">
											{deal.status}
										</span>
									</td>
									<td class="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
										{formatDate(deal.created_at)}
									</td>
									<td class="px-4 py-3 text-right">
										<button onclick={() => handleDeleteDeal(deal.id)} class="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-500/10 rounded-lg transition-colors" title="Beszélgetés törlése">
											<Trash2 class="w-4 h-4" />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- ═══════════════ SYSTEM TAB ═══════════════ -->
{#if activeTab === 'system'}
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-100">Rendszer Beállítások</h2>
			<button onclick={loadSystemConfig} class="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
				<RefreshCw class="w-4 h-4 {bannerLoading ? 'animate-spin' : ''}" />
			</button>
		</div>

		<div class="bg-slate-900 rounded-xl border border-slate-800 p-6">
			<h3 class="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
				<AlertTriangle class="w-5 h-5 text-amber-400" />
				Globális Rendszerüzenet (Banner)
			</h3>
			<p class="text-sm text-slate-400 mb-6">
				Ez az üzenet minden felhasználónak megjelenik az oldal legtetején. Használd karbantartás, fontos frissítések vagy közlemények jelzésére.
			</p>

			<div class="space-y-4 max-w-lg">
				<label class="flex items-center gap-3 cursor-pointer">
					<input type="checkbox" bind:checked={bannerConfig.enabled} class="w-5 h-5 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900" />
					<span class="text-slate-200 font-medium">Banner bekapcsolása</span>
				</label>

				<div>
					<label class="block text-sm font-medium text-slate-300 mb-1">Üzenet szövege</label>
					<input
						type="text"
						bind:value={bannerConfig.message}
						placeholder="Pl.: Tervezett karbantartás lesz éjfélkor..."
						class="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-slate-300 mb-1">Üzenet típusa</label>
					<select
						bind:value={bannerConfig.type}
						class="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
					>
						<option value="info">Információ (Kék)</option>
						<option value="warning">Figyelmeztetés (Sárga)</option>
					</select>
				</div>

				<div class="pt-4">
					<button onclick={handleSaveBanner} class="btn btn-primary w-full sm:w-auto px-8">
						Beállítások mentése
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
