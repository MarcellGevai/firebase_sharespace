<script lang="ts">
	import { LogIn, CheckCircle2 } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { login, loginWithGoogle, authErrorMessage } from '$lib/auth';

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let isSubmitting = $state(false);

	let isVerified = $derived($page.url.searchParams.get('verified') === 'true');

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) {
			errorMsg = 'Please enter both email and password.';
			return;
		}

		isSubmitting = true;
		errorMsg = '';

		try {
			await login(email, password);
			window.location.href = '/';
		} catch (err) {
			errorMsg = authErrorMessage(err);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleGoogle() {
		isSubmitting = true;
		errorMsg = '';
		try {
			await loginWithGoogle();
			window.location.href = '/';
		} catch (err) {
			errorMsg = authErrorMessage(err);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Bejelentkezés - Sharespace</title>
</svelte:head>

<div class="max-w-md mx-auto mt-12 bg-surface p-8 rounded-2xl shadow-sm border border-line">
	<div class="text-center mb-8">
		<div class="w-12 h-12 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
			<LogIn class="w-6 h-6" />
		</div>
		<h1 class="text-2xl font-bold text-ink">Üdv újra!</h1>
		<p class="text-muted mt-2">Jelentkezz be a fiókodba.</p>
	</div>

	{#if isVerified}
		<div class="mb-6 p-4 bg-primary-soft border border-primary-line rounded-xl flex items-start space-x-3">
			<CheckCircle2 class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
			<div>
				<h3 class="text-sm font-bold text-primary">Sikeres hitelesítés!</h3>
				<p class="text-sm text-primary mt-1">Az e-mail címedet sikeresen megerősítetted. Most már bejelentkezhetsz.</p>
			</div>
		</div>
	{/if}

	<form onsubmit={handleLogin} class="space-y-4">
		<div class="space-y-1.5">
			<label for="email" class="block text-sm font-semibold text-ink">E-mail cím</label>
			<input
				type="email"
				id="email"
				bind:value={email}
				class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all"
				placeholder="te@email.hu"
			/>
		</div>

		<div class="space-y-1.5">
			<label for="password" class="block text-sm font-semibold text-ink">Jelszó</label>
			<input
				type="password"
				id="password"
				bind:value={password}
				class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all"
				placeholder="••••••••"
			/>
		</div>

		{#if errorMsg}
			<p class="text-sm text-want bg-want-soft p-3 rounded-lg text-center font-medium border border-want-line">{errorMsg}</p>
		{/if}

		<button
			type="submit"
			disabled={isSubmitting}
			class="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-primary-fg font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
		>
			{isSubmitting ? 'Bejelentkezés folyamatban...' : 'Bejelentkezés'}
		</button>
	</form>

	<div class="flex items-center gap-3 my-6">
		<div class="flex-1 h-px bg-raised"></div>
		<span class="text-xs text-faint font-medium">VAGY</span>
		<div class="flex-1 h-px bg-raised"></div>
	</div>

	<button
		type="button"
		onclick={handleGoogle}
		disabled={isSubmitting}
		class="w-full py-3 px-4 bg-surface border border-line hover:bg-raised text-ink font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
	>
		<svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
			<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/>
			<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
			<path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
			<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
		</svg>
		Bejelentkezés Google-lel
	</button>

	<p class="text-center text-muted text-sm mt-8">
		Még nincs fiókod?
		<a href="/register" class="text-primary hover:underline font-semibold">Regisztrálj egyet!</a>
	</p>
</div>
