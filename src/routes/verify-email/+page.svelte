<script lang="ts">
	import { Mail, RefreshCw, Send } from 'lucide-svelte';
	import { auth } from '$lib/firebase';
	import { sendEmailVerification } from 'firebase/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authErrorMessage } from '$lib/auth';

	let isResending = $state(false);
	let isChecking = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');

	onMount(() => {
		// Wait for Firebase auth to initialize
		const unsubscribe = auth.onAuthStateChanged((user) => {
			if (!user) {
				goto('/login');
			} else if (user.emailVerified) {
				goto('/');
			}
			unsubscribe();
		});
	});

	async function handleResend() {
		if (!auth.currentUser) return;
		
		isResending = true;
		errorMsg = '';
		successMsg = '';

		try {
			await sendEmailVerification(auth.currentUser);
			successMsg = 'Az ellenőrző e-mailt sikeresen újraküldtük. Kérjük, ellenőrizd a fiókodat (a Spam mappát is)!';
		} catch (err) {
			// Firebase applies a rate limit on sending verification emails
			if ((err as any)?.code === 'auth/too-many-requests') {
				errorMsg = 'Túl sok próbálkozás. Kérjük, várj egy kicsit, és próbáld újra!';
			} else {
				errorMsg = authErrorMessage(err);
			}
		} finally {
			isResending = false;
		}
	}

	async function handleCheck() {
		if (!auth.currentUser) return;

		isChecking = true;
		errorMsg = '';
		successMsg = '';

		try {
			await auth.currentUser.reload();
			if (auth.currentUser.emailVerified) {
				// Full reload to clear out any auth state cache issues
				window.location.href = '/'; 
			} else {
				errorMsg = 'Még nem erősítetted meg az e-mail címedet. Kérjük, kattints az e-mailben kapott linkre!';
			}
		} catch (err) {
			errorMsg = authErrorMessage(err);
		} finally {
			isChecking = false;
		}
	}
</script>

<svelte:head>
	<title>E-mail megerősítése - Sharespace</title>
</svelte:head>

<div class="max-w-md mx-auto mt-12 bg-surface p-8 rounded-2xl shadow-sm border border-line text-center">
	<div class="w-16 h-16 bg-primary-soft text-primary rounded-full flex items-center justify-center mx-auto mb-6">
		<Mail class="w-8 h-8" />
	</div>
	
	<h1 class="text-2xl font-bold text-ink mb-2">Erősítsd meg az e-mail címed!</h1>
	<p class="text-muted mb-6">
		A Sharespace használatához kérjük, erősítsd meg az e-mail címedet. Kattints az e-mailben található linkre!
	</p>

	<div class="space-y-4">
		{#if errorMsg}
			<p class="text-sm text-want bg-want-soft p-3 rounded-lg text-center font-medium border border-want-line">{errorMsg}</p>
		{/if}

		{#if successMsg}
			<p class="text-sm text-primary bg-primary-soft p-3 rounded-lg text-center font-medium border border-primary-line">{successMsg}</p>
		{/if}

		<button 
			onclick={handleCheck} 
			disabled={isChecking}
			class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover text-primary-fg font-bold rounded-xl transition-colors disabled:opacity-50"
		>
			{#if isChecking}
				<RefreshCw class="w-5 h-5 animate-spin" />
				Ellenőrzés folyamatban...
			{:else}
				<RefreshCw class="w-5 h-5" />
				Már megerősítettem
			{/if}
		</button>

		<button 
			onclick={handleResend} 
			disabled={isResending}
			class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-surface hover:bg-raised text-ink border border-line font-bold rounded-xl transition-colors disabled:opacity-50"
		>
			<Send class="w-5 h-5" />
			{isResending ? 'Küldés...' : 'E-mail újraküldése'}
		</button>
	</div>
</div>
