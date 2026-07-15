// Deterministic pseudo-random offset (within `radiusMeters`) derived from a seed
// string. The same seed always produces the same offset, so a fuzzed pin stays
// put across page loads instead of jumping around, while the real coordinate is
// never exposed. Pure math — moved from the old server module to the client.

function hashSeed(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function fuzzCoordinate(lat: number, lon: number, seed: string, radiusMeters = 200) {
	const rand = mulberry32(hashSeed(seed));
	const angle = rand() * 2 * Math.PI;
	const distance = Math.sqrt(rand()) * radiusMeters; // sqrt keeps the distribution uniform over the circle's area

	const dLat = (distance * Math.cos(angle)) / 111320;
	const dLon = (distance * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));

	return {
		lat: lat + dLat,
		lon: lon + dLon
	};
}
