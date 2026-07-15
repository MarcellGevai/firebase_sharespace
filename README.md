# Firebase Sharespace 🤝

A **Sharespace** közösségi megosztó / marketplace platform **Firebase-es** változata: az
adat (**Firestore**), a fájlok (**Storage**), a bejelentkezés (**Auth**) és a **hosting**
is a Google Firebase-en fut. A `HTML_R-piapp` mintája alapján — statikus SPA + Firebase,
**szerver nélkül**.

> Ez a `Sharespace_prototype` (SvelteKit SSR + Oracle DB + saját JWT auth + Oracle Cloud VM)
> migrációja. A UI/komponensek nagyrészt változatlanok; az **adat- és hostingréteg** cserélődött ki.

## Tech stack

| Réteg | Technológia |
|---|---|
| Frontend | **SvelteKit 2 / Svelte 5** (runes), `@sveltejs/adapter-static` → statikus SPA |
| Stílus | TailwindCSS 4 |
| Térkép | `maplibre-gl` (OpenStreetMap) |
| Adatbázis | **Cloud Firestore** (kliens SDK, realtime) |
| Auth | **Firebase Auth** — email/jelszó **+ Google** |
| Fájlok | **Firebase Storage** (hirdetés-képek) |
| Hosting | **Firebase Hosting** (statikus CDN) |
| Backend (opcionális) | **Cloud Functions** (csak Blaze csomagon) |

## Miért nincs szerver?

A teljes alkalmazás a böngészőben fut, és közvetlenül a Firestore-ral / Auth-tal / Storage-dzsal
beszél. A régi `+server.ts` végpontok logikáját a **Firestore biztonsági szabályok**
(`firestore.rules`) veszik át — beleértve a legkényesebb részt, az **átadás 5 perces
megerősítési ablakát**, amit szerver-időbélyeg (`serverTimestamp` / `request.time`)
véd. Így **Cloud Functions nélkül, az ingyenes Spark csomagon is** működik.

Ha később a Blaze (pay-as-you-go, bőséges ingyenes kerettel) csomagra váltasz, a
`functions/` mappában készen áll néhány *opcionális, additív* Cloud Function (lásd lent).

## Beállítás

### 1. Firebase projekt létrehozása
1. [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. **Build → Authentication → Get started** → engedélyezd az **Email/Password** és a **Google** providert.
3. **Build → Firestore Database → Create database** (production mode, europe régió pl. `eur3`).
4. **Build → Storage → Get started**.
5. **Project settings → General → Your apps → Web app (</>)** → másold ki a config értékeket.

### 2. Környezeti változók
```bash
cp .env.example .env
# töltsd ki a VITE_FIREBASE_* értékeket a webapp configból
```
Írd be a projekt azonosítót a `.firebaserc`-be is (`REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` helyére).

### 3. Futtatás lokálisan
```bash
npm install
npm run dev        # http://localhost:5173
```

## Deploy

```bash
npm install -g firebase-tools     # ha még nincs
firebase login
firebase use <projekt-id>

# Szabályok és indexek (egyszer, majd változáskor):
firebase deploy --only firestore:rules,firestore:indexes,storage

# A weboldal:
npm run build                     # → build/ mappa
firebase deploy --only hosting

# Vagy minden egyben (functions is, CSAK Blaze-en):
npm run deploy:all
```

Az `npm run deploy` parancs egyben buildel és felteszi a hostingot.

## Adatmodell (Firestore kollekciók)

```
users/{uid}            name, email, avatar_url, location, address, date_of_birth,
                       gender, latitude, longitude, trust_score, review_count, rating_sum
listings/{id}          owner_id, title, description, image_url, type, status, category,
                       price_range, latitude, longitude, location_address,
                       owner_name, owner_avatar_url, owner_location, owner_trust_score  (denormalizált)
requests/{id}          listing_id, owner_id, requester_id, start_date, end_date, status,
                       price_offer, handover_status, handover_initiated_at, return_initiated_at
messages/{id}          conversation_id, participants[2], sender_id, receiver_id, listing_id,
                       listing_title, listing_image, content, is_read, created_at
notifications/{id}     user_id, from, type, title, body, link, is_read, created_at
reviews/{reqId_uid}    request_id, reviewer_id, reviewee_id, rating, content, created_at
```

## Opcionális Cloud Functions (Blaze)

A `functions/` mappa tartalma **nem szükséges** az ingyenes működéshez. Ha bekapcsolod:
- `syncOwnerTrust` — ha egy user `trust_score`-ja változik, frissíti az összes hirdetésén
  a denormalizált `owner_trust_score`-t (ezt a kliens nem tudja megtenni).
- `geocode` — server-oldali Nominatim geokódolás megfelelő User-Agenttel.

```bash
cd functions && npm install && cd ..
firebase deploy --only functions      # Blaze csomag kell hozzá
```

## Funkciók

- 🗺️ **Térkép** — hirdetések fuzzolt koordinátákkal (adatvédelem), kategória-szűrés, keresés
- 📋 **Feed** — hirdetéslista tárgy/szolgáltatás szűréssel
- ➕ **Hirdetésfeladás** — kép feltöltés Storage-ba, cím geokódolás
- 🔐 **Auth** — email/jelszó + Google, email-megerősítés
- 🤝 **Deal flow** — request → elfogadás → átadás → visszavétel (**5 perces** megerősítés)
- 💬 **Chat** — valós idejű üzenetváltás (Firestore `onSnapshot`)
- 🔔 **Értesítések** — valós idejű, olvasatlan-számláló
- ⭐ **Értékelés** — kétoldalú review, automatikus trust-score számítás

Részletek: [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md).
