import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// Static SPA: everything is prerendered to a single index.html fallback and
		// hydrated on the client. Firestore/Auth/Storage do all the data work from
		// the browser, so there is no server runtime to deploy — perfect for Firebase
		// Hosting (a pure static CDN). This mirrors the HTML_R-piapp model.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		})
	}
};

export default config;
