# NovelIdeas Project Map (repo-grounded replacement)

This map replaces the previous `PROJECT_MAP.md` and is based on the uploaded `NovelIdeas.zip` repo snapshot, not on older assumptions.

---

## Canonical source

Use the uploaded repo zip as the source of truth for this map.

- `NovelIdeas.zip` — current repo snapshot
- `PROJECT_MAP.md` — previous map, now partially stale

The prior map had two important accuracy problems:

1. it referenced files that are no longer present (for example `screens/swipe/defaultCards.ts` and `screens/recommenders/googleBooks/googleBooksRecommenderCanonical.ts`)
2. it did not include the newer teen visual-side recommenders and hosted-library routes

---

## What this repo is now

NovelIdeas is an **Expo Router / React Native** app with a **web deployment layer that also uses Next/Vercel-style wiring**.

Signals that matter:

- `package.json`
  - `main: "expo-router/entry"`
  - both Expo scripts (`expo:start`, `android`, `ios`, `web`) and Next scripts (`dev`, `build`, `start`)
- `vercel.json`
  - SPA-style rewrite to `index.html`
- `api/gcd.ts`
  - Vercel serverless handler for the GCD recommender bridge
- `app/api/**`
  - Expo Router API routes for config + Hardcover

Practical mental model:

- **mobile/native shell:** Expo + React Native + Expo Router
- **web shell:** Expo Router on web, with Next/Vercel deployment glue
- **core product:** swipe cards -> tag/taste signals -> multi-engine recommendation router -> final reranker

---

## Actual top-level structure

```text
api/
  gcd.ts

app/
  (tabs)/
    _layout.tsx
    explore.tsx
    index.tsx
    swipe.tsx
  api/
    config/[libraryId]/+api.ts
    hardcover/+api.ts
  c/
    [libraryId].tsx
    test-library.tsx
  _layout.tsx
  admin-collection.tsx
  app_admin-web.tsx
  modal.tsx
  swipe.tsx

assets/
  book_logo.png
  images/*

components/
  ui/*
  external-link.tsx
  haptic-tab.tsx
  hello-wave.tsx
  parallax-scroll-view.tsx
  themed-text.tsx
  themed-view.tsx

constants/
  brandTheme.ts
  deckLabels.ts
  runtimeConfig.ts
  theme.ts

data/
  swipeDecks/
    k2.ts
    36.ts
    ms_hs.ts
    adult.ts
    *.json mirrors
    types.ts
  tagNormalizationMap.ts

hooks/
  use-color-scheme.ts
  use-color-scheme.web.ts
  use-theme-color.ts

screens/
  AdminCollectionUploadScreen.tsx
  SwipeDeckScreen.tsx
  recommenders/
    dev/
    gcd/
    googleBooks/
    kitsu/
    openLibrary/
    taste/
    finalRecommender.ts
    normalizeCandidate.ts
    recommenderProfiles.ts
    recommenderRouter.ts
    types.ts
  swipe/
    openLibraryAdult.ts
    openLibraryCore.ts
    openLibraryFromTags.ts
    openLibraryKids.ts
    openLibraryPreTeen.ts
    openLibraryTeen.ts
    recommendationsByBand.ts
    swipeHelpers.ts

scripts/
  reset-project.js

services/
  hardcover/
    hardcoverRatings.ts

NovelIdeas.json
README.md
app.json
package.json
vercel.json
manga-slider-integration-notes.md
```

---

## High-signal architecture

### 1) App shell and routing

- `app/_layout.tsx`
  - root Expo Router stack
  - mounts `(tabs)` as the main shell
  - explicitly exposes `app_admin-web` and `modal`

- `app/(tabs)/_layout.tsx`
  - top-level stack layout for the branded user shell
  - header title is driven by `constants/runtimeConfig.ts`
  - `swipe` is the default route
  - contains a 7-tap hidden admin gesture

- `app/swipe.tsx`
  - thin route wrapper that loads config and renders `SwipeDeckScreen`

- `app/(tabs)/swipe.tsx`
  - also renders the main swipe/home experience from within the tab shell

- `app/(tabs)/index.tsx`
  - large home/admin/search shell
  - this is effectively the main control center for student-facing search plus admin toggles

- `app/(tabs)/explore.tsx`
  - leftover Expo starter/example screen
  - not part of the main NovelIdeas product flow

### 2) Main product orchestrator

- `screens/SwipeDeckScreen.tsx`
  - the main product orchestrator
  - resolves the active deck from `data/swipeDecks/*`
  - filters cards by enabled media categories
  - accumulates tag counts from swipes
  - builds taste state and feedback state
  - calls `screens/recommenders/recommenderRouter.ts` for recommendation fetch + merge
  - shows the dev equalizer/tuning UI

If you only keep one runtime file in your head, keep this one.

### 3) Deck source of truth

These are the actual canonical swipe decks now:

- `data/swipeDecks/k2.ts`
  - kids deck
- `data/swipeDecks/36.ts`
  - pre-teen deck
- `data/swipeDecks/ms_hs.ts`
  - middle/high school deck
  - this is where the teen media-signal content lives now
- `data/swipeDecks/adult.ts`
  - adult deck
- `data/swipeDecks/types.ts`
  - shared deck/card typing
  - separates **display-only** metadata from **recommendation-output** metadata
  - defines optional weighted-tag types and defaults

Important stale correction:

- `screens/swipe/defaultCards.ts` is **not in the repo**
- the deck content lives in `data/swipeDecks/*`

### 4) Recommendation router = the main engine switchboard

- `screens/recommenders/recommenderRouter.ts`
  - central orchestration boundary for recommendation engines
  - always fetches Google Books and Open Library
  - conditionally adds **Kitsu** and **GCD** for teen visual/graphic signals
  - normalizes engine results
  - sends merged candidates into `finalRecommenderForDeck(...)`

Current behavior in plain English:

- preferred/default engine choice:
  - `k2` -> `openLibrary`
  - everything else -> `googleBooks`
- actual fetch path:
  - Google Books + Open Library are both queried
  - teen manga / anime / graphic-novel / superhero signals can also pull in:
    - `screens/recommenders/kitsu/kitsuMangaRecommender.ts`
    - `screens/recommenders/gcd/gcdGraphicNovelRecommender.ts` via `api/gcd.ts`

So the current system is **not** just “kids use Open Library, everyone else uses Google Books.”
It is now a **multi-source merge-and-rerank pipeline**.

### 5) Active recommender engines

#### Google Books

- `screens/recommenders/googleBooks/googleBooksRecommender.ts`
  - main Google Books engine
  - used heavily for non-kids decks
  - enriches results with Hardcover ratings

#### Open Library

- `screens/recommenders/openLibrary/openLibraryRecommender.ts`
  - Open Library engine
  - still important, especially for kids/default `k2`

- `screens/recommenders/openLibrary/openLibraryKidsQueryBuilder.ts`
  - kids-specific query shaping
  - supports domain modes such as picture / earlyReader / chapterMiddle

#### Kitsu (new vs prior map)

- `screens/recommenders/kitsu/kitsuMangaRecommender.ts`
  - teen-only auxiliary manga engine
  - activates when teen sessions show manga/anime/graphic signals
  - thin fetcher that projects Kitsu responses into shared recommendation docs

#### GCD / Grand Comics Database (new vs prior map)

- `screens/recommenders/gcd/gcdGraphicNovelRecommender.ts`
  - teen-only auxiliary comics / graphic novel / superhero recommender

- `api/gcd.ts`
  - Vercel serverless bridge used by the app/router to call GCD logic

### 6) Shared ranking, normalization, and taste system

- `screens/recommenders/types.ts`
  - canonical engine contracts
  - `EngineId` now includes:
    - `googleBooks`
    - `openLibrary`
    - `kitsu`
    - `gcd`

- `screens/recommenders/normalizeCandidate.ts`
  - converts source-specific docs into one candidate shape

- `screens/recommenders/finalRecommender.ts`
  - main post-fetch choke point
  - dedupes candidates
  - scores metadata quality + trust signals
  - applies lane-aware ranking, penalties, diversity, repeat suppression, etc.

- `screens/recommenders/recommenderProfiles.ts`
  - lane-level tuning defaults for:
    - `kids`
    - `preTeen`
    - `teen`
    - `adult`
  - now includes manga-specific knobs such as:
    - `kitsuSourceBoost`
    - `minMangaResults`

#### Taste layer

- `screens/recommenders/taste/tasteProfileBuilder.ts`
- `screens/recommenders/taste/personalityProfile.ts`
- `screens/recommenders/taste/sessionMood.ts`
- `screens/recommenders/taste/tasteBlender.ts`
- `screens/recommenders/taste/tasteSimilarity.ts`
- `screens/recommenders/taste/recommendationPipeline.ts`
- `screens/recommenders/taste/types.ts`

This is the personalization layer on top of raw tag counts.

### 7) The older swipe/query layer is still active

These files are older, but still materially used:

- `screens/swipe/openLibraryFromTags.ts`
- `screens/swipe/openLibraryCore.ts`
- `screens/swipe/openLibraryKids.ts`
- `screens/swipe/openLibraryPreTeen.ts`
- `screens/swipe/openLibraryTeen.ts`
- `screens/swipe/openLibraryAdult.ts`
- `screens/swipe/recommendationsByBand.ts`
- `screens/swipe/swipeHelpers.ts`

Practical meaning:

The repo still has **two overlapping recommendation layers**:

1. the newer `screens/recommenders/**` multi-engine + reranking layer
2. the older `screens/swipe/openLibrary*` tag-query helpers

They are connected, not fully retired. If recommendation behavior changes, check both layers.

### 8) Admin, config, and branding

- `app/(tabs)/index.tsx`
  - student UI + admin toggles + QR flow + config editing behavior

- `app/app_admin-web.tsx`
  - dedicated web admin/config editor
  - reads/writes config draft to localStorage

- `NovelIdeas.json`
  - shipped baseline config
  - still defaults `recommendations.source` to `open_library`

- `constants/brandTheme.ts`
  - theme/highlight presets and title-text styling

- `constants/runtimeConfig.ts`
  - runtime library-name store used by the header

- `constants/deckLabels.ts`
  - deck-name labeling helper

- `data/tagNormalizationMap.ts`
  - canonical raw-tag normalization layer
  - this is still the right place to contain vocabulary drift

### 9) Hosted library proof-of-concept

This did not appear in the older map and now matters:

- `app/api/config/[libraryId]/+api.ts`
  - config API route for hosted library IDs
  - currently contains a test response for `test-library`

- `app/c/[libraryId].tsx`
  - hosted-library loader route
  - fetches `/api/config/:libraryId`

- `app/c/test-library.tsx`
  - hard-wired test page for the hosted library flow

This is an early hosted-library path, not a full production-backed multi-tenant config system yet.

### 10) Collection import / external services

- `screens/AdminCollectionUploadScreen.tsx`
  - MVP upload screen for a library collection import
  - designed around Supabase storage + Edge Function `import-collection`
  - still placeholder-configured

- `app/admin-collection.tsx`
  - route wrapper for the upload screen

- `services/hardcover/hardcoverRatings.ts`
  - client wrapper for Hardcover ratings

- `app/api/hardcover/+api.ts`
  - server proxy to Hardcover GraphQL

---

## Files that are present but mostly infrastructure / starter leftovers

These exist, but they are not where product logic primarily lives:

- `components/**`
  - mostly generic starter/UI utilities
- `hooks/**`
  - theme/color helpers
- `assets/**`
  - icons, splash, branding image
- `android/**`
  - generated native Android project
- `scripts/reset-project.js`
  - Expo starter reset helper
- `README.md`
  - still mostly stock Expo starter text, not an accurate project guide

---

## Important mismatches / watchouts

### 1) Hidden admin route mismatch

- `app/(tabs)/_layout.tsx` still tries `router.push("/admin")` on the 7-tap header gesture
- there is **no** `app/admin.tsx` route in this repo snapshot
- the working admin surface appears to be `/app_admin-web`

So the gesture path looks stale or incomplete.

### 2) Swipe category schema drift

There is a small category-shape mismatch across files:

- `app/(tabs)/index.tsx` and `app/app_admin-web.tsx`
  - model categories as `books`, `movies`, `tv`, `games`, `youtube`, `anime`, `podcasts`
- `screens/SwipeDeckScreen.tsx`
  - supports both `podcasts` **and** `albums`
- `NovelIdeas.json`
  - currently ships `albums`, not `podcasts`

So category config is not perfectly normalized yet.

### 3) README is not trustworthy as architecture documentation

- `README.md` is still default Expo template copy
- do not use it as the current architecture guide

### 4) Hardcover API route logs the token value

- `app/api/hardcover/+api.ts` currently contains `console.log("TOKEN:", process.env.HARDCOVER_API_TOKEN)`

That is a cleanup/security footgun worth removing.

---

## What changed vs the previous map

### Remove these assumptions

- `screens/swipe/defaultCards.ts` is part of the app
- `screens/recommenders/googleBooks/googleBooksRecommenderCanonical.ts` exists
- recommendation routing is only Google Books vs Open Library
- there is no hosted-library path

### Add this reality instead

- `screens/SwipeDeckScreen.tsx` is the main runtime orchestrator
- `data/swipeDecks/*` is the real deck source of truth
- `screens/recommenders/recommenderRouter.ts` is the engine switchboard
- `finalRecommender.ts` is the main ranking choke point
- teen visual sessions can pull in **Kitsu** and **GCD**
- `app/c/*` + `app/api/config/*` form an early hosted-library flow
- the repo is a hybrid Expo/web deployment setup, not just a simple Expo starter app

---

## Best “where do I change X?” guide now

### Change which engine(s) a deck can use
Start here:

- `screens/recommenders/recommenderRouter.ts`

### Change actual swipe cards / prompts / media signals
Start here:

- `data/swipeDecks/k2.ts`
- `data/swipeDecks/36.ts`
- `data/swipeDecks/ms_hs.ts`
- `data/swipeDecks/adult.ts`

### Change tag normalization / vocabulary control
Start here:

- `data/tagNormalizationMap.ts`

### Change final ranking quality, source weighting, repeat suppression, manga floor, etc.
Start here:

- `screens/recommenders/finalRecommender.ts`
- `screens/recommenders/recommenderProfiles.ts`

### Change manga / anime / graphic-session behavior
Start here:

- `screens/recommenders/kitsu/kitsuMangaRecommender.ts`
- `screens/recommenders/gcd/gcdGraphicNovelRecommender.ts`
- `screens/recommenders/recommenderRouter.ts`
- `api/gcd.ts`

### Change Open Library query shaping
Start here:

- `screens/recommenders/openLibrary/openLibraryRecommender.ts`
- `screens/recommenders/openLibrary/openLibraryKidsQueryBuilder.ts`
- `screens/swipe/openLibraryFromTags.ts`
- `screens/swipe/openLibraryCore.ts`
- age-band wrappers in `screens/swipe/openLibrary*.ts`

### Change admin/config UX
Start here:

- `app/(tabs)/index.tsx`
- `app/app_admin-web.tsx`
- `NovelIdeas.json`
- `constants/brandTheme.ts`
- `constants/runtimeConfig.ts`

### Change hosted-library config loading
Start here:

- `app/api/config/[libraryId]/+api.ts`
- `app/c/[libraryId].tsx`
- `app/c/test-library.tsx`

### Change collection upload/import flow
Start here:

- `screens/AdminCollectionUploadScreen.tsx`
- `app/admin-collection.tsx`

---

## Short version

If I had to reduce the repo to the files that matter most right now, I would keep this mental model:

1. `screens/SwipeDeckScreen.tsx` — main runtime orchestrator
2. `data/swipeDecks/*` — real swipe deck source
3. `screens/recommenders/recommenderRouter.ts` — engine merge/router boundary
4. `screens/recommenders/googleBooks/googleBooksRecommender.ts` / `openLibraryRecommender.ts` / `kitsuMangaRecommender.ts` / `gcdGraphicNovelRecommender.ts` — source fetchers
5. `screens/recommenders/finalRecommender.ts` — final ranking choke point
6. `screens/recommenders/taste/*` — personalization layer
7. `app/(tabs)/index.tsx` and `app/app_admin-web.tsx` — config/admin surfaces
8. `app/api/config/[libraryId]/+api.ts` + `app/c/[libraryId].tsx` — hosted-library proof of concept
9. `data/tagNormalizationMap.ts` — vocabulary control

