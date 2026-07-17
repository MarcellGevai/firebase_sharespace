<script lang="ts">
	import { UserPlus, Mail, CheckCircle2 } from 'lucide-svelte';
	import { register, loginWithGoogle, authErrorMessage } from '$lib/auth';
	import { validateUsername } from '$lib/username';

	let name = $state('');
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let address = $state('');
	let date_of_birth = $state('');
	let gender = $state('');

	let errorMsg = $state('');
	let isSubmitting = $state(false);
	let registrationSuccess = $state(false);

	// Password strength calculation
	let passwordStrength = $derived.by(() => {
		if (!password) return 0;
		let score = 0;
		if (password.length >= 8) score += 25;
		if (/[A-Z]/.test(password)) score += 25;
		if (/[a-z]/.test(password)) score += 25;
		if (/[0-9]/.test(password)) score += 15;
		if (/[^A-Za-z0-9]/.test(password)) score += 10;
		return Math.min(100, score);
	});

	let strengthColor = $derived.by(() => {
		if (passwordStrength < 30) return 'bg-red-500';
		if (passwordStrength < 60) return 'bg-orange-500';
		if (passwordStrength < 90) return 'bg-yellow-400';
		return 'bg-green-500';
	});

	let strengthLabel = $derived.by(() => {
		if (!password) return '';
		if (passwordStrength < 30) return 'Gyenge';
		if (passwordStrength < 60) return 'Közepes';
		if (passwordStrength < 90) return 'Jó';
		return 'Erős';
	});

	async function handleRegister(e: Event) {
		e.preventDefault();
		if (!name || !username || !email || !password || !address || !date_of_birth || !gender) {
			errorMsg = 'Kérjük, tölts ki minden kötelező mezőt!';
			return;
		}

		// Surfaced before the network round-trip, so a malformed handle doesn't
		// cost an account-creation attempt to find out.
		const usernameError = validateUsername(username);
		if (usernameError) {
			errorMsg = usernameError;
			return;
		}

		if (passwordStrength < 60) {
			errorMsg = 'A jelszavad túl gyenge. Kérjük, válassz egy erősebbet!';
			return;
		}

		isSubmitting = true;
		errorMsg = '';

		try {
			await register({ name, username, email, password, address, date_of_birth, gender });
			registrationSuccess = true;
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
	<title>Regisztráció - Sharespace</title>
</svelte:head>

<div class="max-w-md mx-auto mt-12 bg-surface p-8 rounded-2xl shadow-sm border border-line">
	{#if registrationSuccess}
		<div class="text-center py-8">
			<div class="w-16 h-16 bg-primary-soft text-primary rounded-full flex items-center justify-center mx-auto mb-6">
				<Mail class="w-8 h-8" />
			</div>
			<h2 class="text-2xl font-bold text-ink mb-2">Erősítsd meg az e-mail címed!</h2>
			<p class="text-muted mb-6">
				Elküldtünk egy hitelesítő linket a(z) <span class="font-semibold text-ink">{email}</span> címre.
				A megerősítés opcionális — már most be tudsz jelentkezni.
			</p>
			<a href="/" class="inline-flex items-center justify-center px-6 py-3 bg-primary hover:bg-primary-hover text-primary-fg font-semibold rounded-xl transition-colors">
				Tovább az alkalmazáshoz
			</a>
		</div>
	{:else}
		<div class="text-center mb-8">
			<div class="w-12 h-12 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
				<UserPlus class="w-6 h-6" />
			</div>
			<h1 class="text-2xl font-bold text-ink">Fiók Létrehozása</h1>
			<p class="text-muted mt-2">Csatlakozz a helyi közösségi megosztó hálózathoz.</p>
		</div>

		<form onsubmit={handleRegister} class="space-y-4">
			<div class="space-y-1.5">
				<label for="name" class="block text-sm font-semibold text-ink">Teljes Név *</label>
				<input type="text" id="name" bind:value={name} class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all" />
				<p class="text-xs text-faint">Csak te látod – nyilvánosan a felhasználóneved jelenik meg.</p>
			</div>

			<div class="space-y-1.5">
				<label for="username" class="block text-sm font-semibold text-ink">Felhasználónév *</label>
				<div class="relative">
					<span class="absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none">@</span>
					<input
						type="text"
						id="username"
						bind:value={username}
						autocomplete="username"
						class="w-full pl-8 pr-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all"
					/>
				</div>
				<p class="text-xs text-faint">Ez jelenik meg a nyilvános profilodon.</p>
			</div>

			<div class="space-y-1.5">
				<label for="email" class="block text-sm font-semibold text-ink">E-mail cím *</label>
				<input type="email" id="email" bind:value={email} class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all" placeholder="te@email.hu" />
			</div>

			<div class="space-y-1.5">
				<label for="address" class="block text-sm font-semibold text-ink">Lakcím *</label>
				<input type="text" id="address" bind:value={address} class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all" placeholder="Pl. 1111 Budapest, Fő utca 1." />
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<label for="dob" class="block text-sm font-semibold text-ink">Születési idő *</label>
					<input type="date" id="dob" bind:value={date_of_birth} class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all" />
				</div>
				<div class="space-y-1.5">
					<label for="gender" class="block text-sm font-semibold text-ink">Nem *</label>
					<select id="gender" bind:value={gender} class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all appearance-none">
						<option value="" disabled selected>Válassz...</option>
						<option value="MALE">Férfi</option>
						<option value="FEMALE">Nő</option>
						<option value="OTHER">Egyéb</option>
					</select>
				</div>
			</div>

			<div class="space-y-1.5 pt-2">
				<label for="password" class="block text-sm font-semibold text-ink">Jelszó *</label>
				<input type="password" id="password" bind:value={password} class="w-full px-4 py-2.5 bg-raised border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all" placeholder="••••••••" />

				<!-- Password Strength Indicator -->
				{#if password}
					<div class="mt-2">
						<div class="flex justify-between items-center mb-1">
							<span class="text-xs font-medium text-muted">Jelszó erőssége:</span>
							<span class="text-xs font-bold {strengthLabel === 'Gyenge' ? 'text-red-500' : strengthLabel === 'Közepes' ? 'text-orange-500' : strengthLabel === 'Jó' ? 'text-star' : 'text-green-500'}">{strengthLabel}</span>
						</div>
						<div class="w-full h-1.5 bg-raised rounded-full overflow-hidden">
							<div class="h-full {strengthColor} transition-all duration-300 ease-out" style="width: {passwordStrength}%"></div>
						</div>
					</div>
				{/if}

				<div class="bg-primary-soft border border-primary-line p-3 rounded-lg mt-2 flex items-start space-x-2">
					<CheckCircle2 class="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
					<p class="text-xs text-primary leading-snug">
						Egy erős jelszó legalább 8 karakter hosszú, tartalmaz kis- és nagybetűket, számokat, valamint speciális karaktereket (pl. !@#$%).
					</p>
				</div>
			</div>

			{#if errorMsg}
				<p class="text-sm text-want bg-want-soft p-3 rounded-lg text-center font-medium border border-want-line mt-4">{errorMsg}</p>
			{/if}

			<button type="submit" disabled={isSubmitting} class="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-primary-fg font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6">
				{isSubmitting ? 'Regisztráció folyamatban...' : 'Regisztráció'}
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
			Folytatás Google-lel
		</button>

		<p class="text-center text-muted text-sm mt-8">
			Van már fiókod?
			<a href="/login" class="text-primary hover:underline font-semibold">Jelentkezz be</a>
		</p>
	{/if}
</div>
