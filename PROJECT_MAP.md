# NovelIdeas Project Map

Built directly from the uploaded repo snapshot (`NovelIdeas.zip`) on March 23, 2026.

## 1) What this project is

NovelIdeas is an **Expo / React Native / Expo Router** app that runs on web and mobile. Its core product flow is a **swipe-driven taste capture experience** that converts card interactions into tag counts and taste signals, then routes those signals through one or more recommendation engines to return books.

At a high level:

1. The app boots through Expo Router.
2. The main user-facing shell lives in `app/(tabs)`.
3. The swipe experience is orchestrated by `screens/SwipeDeckScreen.tsx`.
4. Swipe cards come from canonical deck files in `data/swipeDecks/`.
5. Recommendation requests go through `screens/recommenders/recommenderRouter.ts`.
6. The router can combine **Google Books**, **Open Library**, **Kitsu Manga**, and **Grand Comics Database** results.
7. Final ranking happens in `screens/recommenders/finalRecommender.ts`.

---

## 2) Canonical top-level structure

```text
NovelIdeas/
  app/                       Expo Router routes and route wrappers
  assets/                    logos, icons, splash assets
  components/                shared UI primitives
  constants/                 theme, labels, runtime header config
  data/                      canonical swipe decks and tag normalization
  screens/                   main screens and recommender system
  services/                  service wrappers (currently Hardcover)
  android/                   Android native project
  scripts/                   utility/reset script
  NovelIdeas.json            default app/admin config
  PROJECT_MAP.md             older map in repo
  PROJECT_MAP_ACCURATE.md    rebuilt accurate map from this repo snapshot
  manga-slider-integration-notes.md
  package.json
  tsconfig.json
```

### Important exclusions from this map

- `node_modules/` exists in the zip but is just installed dependency output.
- `.expo/` is environment/generated Expo state.
- `android/` is mostly native build scaffolding, not core product logic.

---

## 3) Route map

### Root router

`app/_layout.tsx`
- wraps app in the navigation theme provider
- defines the root stack
- mounts:
  - `("tabs")`
  - `app_admin-web`
  - `modal`

### Main app shell

`app/(tabs)/_layout.tsx`
- uses a `Stack`, not a true bottom-tab UI
- sets `swipe` as the initial route
- custom branded header title comes from `constants/runtimeConfig.ts`
- on web, header styling partially follows the admin draft saved in localStorage
- contains a **7-tap hidden admin gesture** on the title

### Actual route files

```text
app/
  _layout.tsx
  app_admin-web.tsx          web admin editor
  admin-collection.tsx       collection upload screen
  modal.tsx                  Expo starter modal
  swipe.tsx                  direct SwipeDeckScreen route

app/(tabs)/
  _layout.tsx
  index.tsx                  home/admin shell + embedded swipe/search UI
  swipe.tsx                  renders index.tsx as a swipe shortcut
  explore.tsx                leftover Expo example screen
```

### Route behavior notes

- `app/swipe.tsx` renders `SwipeDeckScreen` directly.
- `app/(tabs)/swipe.tsx` renders `app/(tabs)/index.tsx`, not `SwipeDeckScreen` directly.
- `app/(tabs)/index.tsx` imports and renders `../../screens/SwipeDeckScreen` inside the broader home/admin shell.
- The hidden gesture calls `router.push("/admin")`, but **there is no `app/admin.tsx` route in this repo snapshot**. That means the gesture target appears stale or broken.
- The actual existing admin-related routes are:
  - `/app_admin-web`
  - `/admin-collection`

---

## 4) Core architecture map

```text
Expo Router
  -> app/_layout.tsx
  -> app/(tabs)/_layout.tsx
  -> app/(tabs)/index.tsx or app/swipe.tsx
  -> screens/SwipeDeckScreen.tsx
      -> data/swipeDecks/*.ts
      -> data/tagNormalizationMap.ts
      -> screens/recommenders/recommenderRouter.ts
          -> googleBooks/googleBooksRecommender.ts
          -> openLibrary/openLibraryRecommender.ts
          -> kitsu/kitsuMangaRecommender.ts
          -> gcd/gcdGraphicNovelRecommender.ts
          -> normalizeCandidate.ts
          -> finalRecommender.ts
              -> recommenderProfiles.ts
              -> taste/*
      -> services/hardcover/hardcoverRatings.ts
          -> app/api/hardcover/+api.ts
```

---

## 5) Main functional areas

## A. App shell and admin/config UI

### `app/(tabs)/index.tsx`
This is one of the most important files in the repo.

It acts as a combined:
- student-facing home screen
- configuration surface
- admin-access shell
- search UI
- wrapper around `SwipeDeckScreen`

Key responsibilities:
- imports default config from `NovelIdeas.json`
- normalizes old and new config shapes via `syncSchema()`
- manages enabled decks
- manages recommendation source selection
- manages swipe category toggles
- handles local web draft state through localStorage
- contains Open Library search helpers and cover URL helpers
- can navigate to web admin
- embeds `SwipeDeckScreen`

### `app/app_admin-web.tsx`
Dedicated web admin editor.

Responsibilities:
- reads/writes admin draft config in localStorage
- edits branding and theme settings
- builds QR codes
- normalizes legacy and canonical config schemas
- manipulates the same config domain as `NovelIdeas.json`

### `constants/runtimeConfig.ts`
A tiny runtime state store for the library name shown in the header.

Responsibilities:
- store current runtime library name
- publish updates to header subscribers

### `NovelIdeas.json`
Default configuration seed.

Current config includes:
- `library`
- `branding`
- `theme`
- `decks.enabled`
- `recommendations.source`
- `swipe.categoriesEnabled`

Notable mismatch:
- `NovelIdeas.json` still uses `swipe.categoriesEnabled` with values like `albums`
- `app/(tabs)/index.tsx` defines `DEFAULT_SWIPE_CATEGORIES` with `youtube`, `anime`, and `podcasts`
- that suggests schema drift between config and UI expectations

---

## B. Swipe experience

### `screens/SwipeDeckScreen.tsx`
This is the **central orchestration file** for the product.

Responsibilities include:
- loading the active deck module
- resolving fallback deck shapes
- tracking swipe state and recommendation triggers
- converting card interactions into tag counts
- building recommendation inputs
- maintaining recommendation session state
- handling cover lookups and image helpers
- interacting with taste-profile utilities
- calling `getRecommendations()` from the recommender router
- rendering debug/tuning UI hooks

It is the main bridge between:
- deck content
- user swipes
- taste modeling
- recommendation engines
- recommendation rendering

### Canonical deck files

```text
data/swipeDecks/
  k2.ts
  36.ts
  ms_hs.ts
  adult.ts
  k2.json
  36.json
  ms_hs.json
  adult.json
  types.ts
```

These `.ts` files are the active source code deck modules.
The `.json` files are mirrored static deck representations.

#### Deck roles
- `k2.ts` -> kids deck
- `36.ts` -> grades 3–6 / pre-teen deck
- `ms_hs.ts` -> middle/high school deck
- `adult.ts` -> adult deck
- `types.ts` -> shared deck schema and tag weighting types

### `data/tagNormalizationMap.ts`
Normalization table for tag cleanup / canonicalization before recommendation use.

---

## C. Recommendation system

All recommendation fetching should flow through:

### `screens/recommenders/recommenderRouter.ts`
This is the **single routing point** for engine selection and result merging.

Confirmed behavior in this snapshot:
- default engine selection:
  - `k2` -> `openLibrary`
  - all other decks -> `googleBooks`
- but the router can still fetch **both Google Books and Open Library in parallel**
- for teen visual/comics/manga intent, it may additionally include:
  - `kitsu`
  - `gcd`
- results are normalized, deduped, capped, and passed into final ranking

### Engine files

```text
screens/recommenders/googleBooks/googleBooksRecommender.ts
screens/recommenders/openLibrary/openLibraryRecommender.ts
screens/recommenders/kitsu/kitsuMangaRecommender.ts
screens/recommenders/gcd/gcdGraphicNovelRecommender.ts
```

#### Engine roles
- `googleBooksRecommender.ts`
  - dominant recommender for non-kids lanes
  - integrates external Google Books search logic
  - enriched by Hardcover ratings

- `openLibraryRecommender.ts`
  - Open Library engine
  - default engine for `k2`

- `kitsuMangaRecommender.ts`
  - manga-focused auxiliary engine
  - only relevant for teen visual/manga signals

- `gcdGraphicNovelRecommender.ts`
  - graphic novel / comics auxiliary engine using Grand Comics Database
  - also teen visual/comics oriented

### Shared ranking and normalization

```text
screens/recommenders/normalizeCandidate.ts
screens/recommenders/finalRecommender.ts
screens/recommenders/recommenderProfiles.ts
screens/recommenders/types.ts
```

Responsibilities:
- normalize engine-specific responses into one comparable candidate shape
- apply dedupe and quality filtering
- rerank by lane/profile
- define the shared contracts used by all engines

### Taste system

```text
screens/recommenders/taste/
  personalityProfile.ts
  recommendationPipeline.ts
  sessionMood.ts
  tasteBlender.ts
  tasteProfileBuilder.ts
  tasteSimilarity.ts
  types.ts
```

Responsibilities:
- persistent-ish personality model
- session mood model
- taste blending
- taste similarity/ranking
- pipeline abstractions for recommendation lifecycle

Important nuance:
- this taste system is real code and influences ranking concepts
- but the app still also uses more direct tag-count driven recommendation flow
- so this repo contains a **hybrid architecture** rather than a fully unified single recommendation pipeline

### Dev tuning UI

```text
screens/recommenders/dev/
  RecommenderEqualizerPanel.tsx
  recommenderProfileOverrides.ts
  recommenderTuningStorage.ts
```

Purpose:
- developer tuning and override controls for ranking weights and recommender behavior

---

## D. Legacy / compatibility recommendation helpers

```text
screens/swipe/
  openLibraryAdult.ts
  openLibraryCore.ts
  openLibraryFromTags.ts
  openLibraryKids.ts
  openLibraryPreTeen.ts
  openLibraryTeen.ts
  recommendationsByBand.ts
  swipeHelpers.ts
```

These files are still present and still matter.
They appear to be the older swipe/recommendation layer that some newer code still imports from.

Most important consequence:
- the project has **not fully migrated** to a clean single recommender architecture yet
- some query-building and helper logic still lives in `screens/swipe/*`
- some newer engine code depends on those older helpers

---

## E. Hardcover integration

### `services/hardcover/hardcoverRatings.ts`
Client-side service wrapper that calls the internal proxy route.

### `app/api/hardcover/+api.ts`
Server/API route that proxies Hardcover GraphQL requests.

Confirmed role:
- uses `HARDCOVER_API_TOKEN`
- looks up rating data for titles/authors
- feeds those ratings back into recommendation quality signals

This means Hardcover is **not** a primary recommendation engine; it is an **enrichment layer**.

---

## F. Collection upload path

### `screens/AdminCollectionUploadScreen.tsx`
This screen is an MVP scaffold for collection upload.

Dependencies are loaded lazily:
- `@supabase/supabase-js`
- `expo-document-picker`

Intended flow:
1. pick a file
2. upload to Supabase storage bucket `collections`
3. invoke Supabase Edge Function `import-collection`

Current state is clearly incomplete:
- `SUPABASE_URL` is placeholder text
- `SUPABASE_ANON_KEY` is placeholder text
- `libraryId` is hard-coded to `yvhs`

So this feature exists as a scaffold, not a finished production integration.

---

## 6) Shared UI and support files

### `components/`
Shared reusable UI pieces, mostly from Expo starter structure plus light customization.

```text
components/
  external-link.tsx
  haptic-tab.tsx
  hello-wave.tsx
  parallax-scroll-view.tsx
  themed-text.tsx
  themed-view.tsx
  ui/
    collapsible.tsx
    icon-symbol.ios.tsx
    icon-symbol.tsx
```

### `constants/`
```text
constants/
  brandTheme.ts
  deckLabels.ts
  runtimeConfig.ts
  theme.ts
```

Roles:
- theme construction
- deck labeling
- runtime header state
- generic color/theme helpers

### `hooks/`
Color scheme and theme helpers for Expo/React Native.

---

## 7) Current recommendation flow

```text
User opens app
  -> route shell loads
  -> home/admin shell or swipe screen renders
  -> active deck chosen (k2 / 36 / ms_hs / adult)
  -> cards loaded from data/swipeDecks/*.ts
  -> swipes accumulate tag counts and taste signals
  -> SwipeDeckScreen builds RecommenderInput
  -> recommenderRouter fetches engine results
      -> googleBooks
      -> openLibrary
      -> optionally kitsu + gcd
  -> normalizeCandidate converts disparate docs to common candidate shape
  -> finalRecommender reranks results for lane/profile
  -> UI displays recommendations
  -> Hardcover ratings may enrich quality scoring
```

---

## 8) Important mismatches, stale points, and risks

### Confirmed stale / broken points

1. **Hidden admin gesture target appears invalid**
   - `app/(tabs)/_layout.tsx` pushes to `/admin`
   - there is no `app/admin.tsx`

2. **Project contains old and new recommendation layers at once**
   - `screens/recommenders/*` is the newer engine architecture
   - `screens/swipe/*` still contains active helper logic
   - this increases maintenance complexity

3. **Schema drift in swipe categories**
   - config JSON and UI defaults do not match perfectly

4. **Collection upload is scaffold-only**
   - depends on missing real Supabase config and backend function

5. **Repo includes generated / installed content in canonical zip**
   - `node_modules/` being included makes the repo snapshot heavy and noisy

### High-confidence architectural reading

This repo is best understood as:
- a live Expo app
- centered around swipe-based preference capture
- with a **partially modernized recommendation stack**
- plus some unfinished admin and collection-management surfaces

---

## 9) Directory-by-directory quick reference

```text
app/
  Routing layer and route wrappers

assets/
  Static images, icons, logos

components/
  Shared UI building blocks

constants/
  Themes, labels, runtime header settings

data/
  Canonical swipe decks + tag normalization

screens/
  Main screens, recommendation engines, taste system, legacy swipe helpers

services/
  External-service wrappers

android/
  Native Android build project

scripts/
  Utility script(s)
```

---

## 10) Most important files in the repo

If someone needed the shortest path to understanding the project, start here:

1. `package.json`
2. `app/_layout.tsx`
3. `app/(tabs)/_layout.tsx`
4. `app/(tabs)/index.tsx`
5. `screens/SwipeDeckScreen.tsx`
6. `data/swipeDecks/types.ts`
7. `data/swipeDecks/k2.ts`
8. `data/swipeDecks/36.ts`
9. `data/swipeDecks/ms_hs.ts`
10. `data/swipeDecks/adult.ts`
11. `screens/recommenders/recommenderRouter.ts`
12. `screens/recommenders/googleBooks/googleBooksRecommender.ts`
13. `screens/recommenders/openLibrary/openLibraryRecommender.ts`
14. `screens/recommenders/finalRecommender.ts`
15. `services/hardcover/hardcoverRatings.ts`
16. `app/api/hardcover/+api.ts`
17. `screens/AdminCollectionUploadScreen.tsx`
18. `NovelIdeas.json`

---

## 11) Bottom-line summary

NovelIdeas is a swipe-first recommendation app built in Expo. The repo’s real center of gravity is:

- `app/(tabs)/index.tsx` for the shell/admin surface
- `screens/SwipeDeckScreen.tsx` for swipe orchestration
- `data/swipeDecks/*.ts` for canonical input cards
- `screens/recommenders/recommenderRouter.ts` and friends for recommendation generation

The recommendation layer is more advanced than a simple single-engine app: it can merge results across multiple sources, apply lane-aware reranking, and enrich quality with Hardcover ratings. At the same time, the project still contains some schema drift, legacy helper overlap, and a few unfinished admin/collection pieces.
