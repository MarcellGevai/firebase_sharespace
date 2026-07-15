# Sharespace (Firebase) — Fejlesztői Útmutató 🚀

Ez a dokumentum a `Sharespace_prototype` → **Firebase** migráció architektúráját írja le,
hogy egy új fejlesztő (vagy Claude Code) azonnal produktív legyen.

---

## 1. Architektúra dióhéjban

```
Böngésző (statikus SvelteKit SPA)
   │  Firebase JS SDK (kliens)
   ├──────────────► Firebase Auth        (email/jelszó + Google)
   ├──────────────► Cloud Firestore      (realtime adat, onSnapshot)
   ├──────────────► Firebase Storage     (hirdetés-képek)
   └──────────────► Firebase Hosting     (a statikus build kiszolgálása)

   (opcionális, Blaze)  Cloud Functions   ← additív szerver-logika
```

**Nincs alkalmazásszerver.** A régi `+server.ts` / `+page.server.ts` / `hooks.server.ts`
réteg eltűnt; a jogosultságokat a **`firestore.rules`** és a **`storage.rules`** kényszeríti ki.

---

## 2. Mappastruktúra

```
firebase_sharespace/
├── firebase.json            # Hosting (public: build) + Firestore + Storage + Functions
├── .firebaserc              # projekt id (töltsd ki!)
├── firestore.rules          # A "backend": jogosultságok + átadás state-gép + 5 perces ablak
├── firestore.indexes.json   # Composite indexek (feed, inbox, chat, notifs, requests)
├── storage.rules            # Képfeltöltés szabályai (saját mappa, kép, max 5MB)
├── svelte.config.js         # adapter-static, fallback: index.html (SPA)
├── .env(.example)           # VITE_FIREBASE_* config
├── functions/               # OPCIONÁLIS Cloud Functions (Blaze)
└── src/
    ├── routes/
    │   ├── +layout.ts       # ssr=false, prerender=false; betölti a bejelentkezett usert
    │   ├── +layout.svelte   # Navbar + FAB + CreateListingModal
    │   ├── +page.ts/.svelte # Térkép (landing)
    │   ├── feed/            # Hirdetéslista
    │   ├── login, register/ # Firebase Auth UI
    │   ├── inbox/, inbox/[id]/ # Beszélgetéslista + realtime chat
    │   └── review/[id]/     # Értékelés
    └── lib/
        ├── firebase.ts      # SDK init (app, auth, db, storage)
        ├── auth.ts          # currentUser store + register/login/google/logout
        ├── geocode.ts       # Nominatim (kliens)
        ├── geoFuzz.ts       # koordináta-fuzzolás (adatvédelem a térképen)
        ├── chat.ts          # chatId / conversationKey helperek
        ├── data/            # ← Firestore adatréteg (ide jön minden lekérdezés/írás)
        │   ├── users.ts, listings.ts, requests.ts,
        │   └── messages.ts, notifications.ts, reviews.ts
        └── components/      # Svelte komponensek (nagyrészt változatlanok)
```

---

## 3. Oracle → Firestore megfeleltetés

| Régi (Oracle / SvelteKit SSR) | Új (Firebase) |
|---|---|
| `users` tábla | `users/{uid}` (uid = Firebase Auth uid) |
| `listings` JOIN `users` | `listings/{id}` **denormalizált** owner mezőkkel |
| `requests` (+ handover oszlopok) | `requests/{id}` |
| `messages` | `messages/{id}` (`conversation_id`, `participants[]`) |
| `notifications` | `notifications/{id}` |
| `reviews` | `reviews/{requestId_reviewerId}` (determinisztikus id = 1 review/fél) |
| JWT + bcrypt + cookie | Firebase Auth |
| `hooks.server.ts` session | `currentUser` store (`src/lib/auth.ts`) |
| `+page.server.ts` load | `+page.ts` load / `onMount` + Firestore |
| `/api/upload` (filesystem) | Firebase Storage |
| `geocodeAddress` (szerver) | `src/lib/geocode.ts` (kliens) vagy `geocode` Function |

**Fontos:** Firestore-ban denormalizálunk. A `listings` doc tartalmazza a tulajdonos
nevét/avatarját/helyét/trust-scoreját, így a publikus feed/térkép **nem olvassa** a
(bejelentkezéshez kötött) `users` kollekciót → a személyes adat (email, cím, szül. dátum) védve marad.

---

## 4. A biztonsági szabályok = a backend

`firestore.rules` a lényeg. A leg­trükkösebb rész az **átadás/visszavétel state-gép**,
amit a régi `/api/requests/handover` végpont intézett. Most a szabályok engedik/tiltják
a `requests/{id}` státuszátmeneteit, és az **5 perces időablakot** így kényszerítik ki:

```
// init lépéskor a kliens serverTimestamp()-et ír → ez a rules-ban == request.time
function acceptHandover() {
  return resource.data.handover_status == 'HANDOVER_INITIATED'
    && request.resource.data.handover_status == 'HANDOVER_COMPLETED'
    && request.time < resource.data.handover_initiated_at + duration.value(5, 'm');
}
```

A kliens **nem tud hamis (későbbi) időbélyeget** írni, mert az init lépésnél a tárolt érték
kötelezően `request.time`. Ha a megerősítés az 5 percen túl érkezik, a szabály **elutasítja**;
a `DealManager` elkapja a hibát, visszaállítja az állapotot és jelez.

Állapotgép (`requests.handover_status`):
```
PENDING → HANDOVER_INITIATED → HANDOVER_COMPLETED → RETURN_INITIATED → RETURN_COMPLETED → CLOSED
          (5 perc a megerősítésre)                   (5 perc a megerősítésre)     (2 review után)
```

---

## 5. Adatréteg (`src/lib/data/`)

Minden Firestore-művelet ide van kiszervezve; a komponensek ezeket hívják.

- **users.ts** — `getUserProfile`, `createUserProfile`, `ensureUserProfile`, `updateRatingAggregate` (tranzakció)
- **listings.ts** — `createListing`, `getAvailableListings`, `getListing`, `toFeedItem`
- **requests.ts** — `createRequest`, `getRequest`, `getRequestForConversation`, `handoverAction`
- **messages.ts** — `sendMessage`, `watchConversation` (realtime), `watchInbox` (realtime), `markConversationRead`
- **notifications.ts** — `createNotification`, `watchUnreadCount`, `watchNotifications`, `markNotificationRead`
- **reviews.ts** — `hasReviewed`, `createReview` (+ trust-score aggregálás + deal lezárás)

A `watch*` függvények `onSnapshot`-ra épülnek és egy **unsubscribe** függvényt adnak vissza
(mindig hívd meg `onMount` cleanupban).

---

## 6. Auth folyamat

1. **Regisztráció** (`register`): `createUserWithEmailAndPassword` → cím geokódolás →
   `users/{uid}` doc létrehozás → `sendEmailVerification` (opcionális megerősítés).
2. **Bejelentkezés** (`login` / `loginWithGoogle`): Firebase Auth; Google-nél első
   alkalommal `ensureUserProfile` létrehozza a minimál profilt.
3. **Session**: `onAuthStateChanged` frissíti a `currentUser` store-t. A `+layout.ts` a
   `authReady` promise-t megvárja, így minden oldal `data.user`-e helyes az első pillanattól.
4. Auth-váltás után az oldal **teljes reloaddal** frissül (egyszerű és megbízható).

---

## 7. Indexek

Az összetett lekérdezésekhez composite indexek kellenek (`firestore.indexes.json`):
feed (`status`+`created_at`), inbox (`participants`+`created_at`), chat
(`conversation_id`+`created_at`), notifs (`user_id`+`created_at`), requests
(`listing_id`+`requester_id`+`created_at`). Deploy:
```bash
firebase deploy --only firestore:indexes
```
Ha futásidőben index-hiányra futsz, a konzol ad egy kattintható linket a hiányzó index létrehozásához.

---

## 8. Ismert prototípus-kompromisszumok

- **`notifications` create**: bármely bejelentkezett user létrehozhat értesítést más usernek
  (a request/message flow miatt). A `from` mező kötelezően a hívó uid-ja. Éles rendszerben
  ezt egy Cloud Function trigger váltaná ki.
- **Denormalizált `owner_trust_score`** a hirdetéseken elavulhat, amíg a `syncOwnerTrust`
  Function (Blaze) nincs bekapcsolva.
- **Kliens-oldali geokódolás**: a Nominatim böngészőből Referer alapján válaszol; nagy
  forgalomnál a `geocode` Function a megbízhatóbb.

---

## 9. Gyors parancsok

```bash
npm run dev            # fejlesztés
npm run check          # svelte-check (típusok)
npm run build          # statikus build → build/
npm run deploy         # build + firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes,storage
```
