// /screens/recommenders/recommenderRouter.ts
//
// Single routing point for recommendation engine selection.
// UI must call ONLY this module (never call engines directly).

import type {
  EngineId,
  RecommenderInput,
  RecommendationResult,
  DomainMode,
  RecommendationDoc,
} from "./types";

import { getGoogleBooksRecommendations } from "./googleBooks/googleBooksRecommender";
import { getOpenLibraryRecommendations } from "./openLibrary/openLibraryRecommender";
import { getKitsuMangaRecommendations } from "./kitsu/kitsuMangaRecommender";
import { normalizeCandidates, type CandidateSource } from "./normalizeCandidate";
import { finalRecommenderForDeck } from "./finalRecommender";

export type EngineOverride = EngineId | "auto";

function chooseEngine(input: RecommenderInput, override?: EngineOverride): EngineId {
  if (override && override !== "auto") return override;
  if (input.deckKey === "k2") return "openLibrary";
  return "googleBooks";
}

function teenVisualSignalWeight(tagCounts: RecommenderInput["tagCounts"] | undefined): number {
  return Number(tagCounts?.["topic:manga"] || 0) +
    Number(tagCounts?.["media:anime"] || 0) +
    Number(tagCounts?.["format:graphic_novel"] || 0) +
    Number(tagCounts?.["format:graphic novel"] || 0) +
    Number(tagCounts?.["genre:superheroes"] || 0);
}

function shouldUseKitsu(input: RecommenderInput): boolean {
  return input.deckKey === "ms_hs" && teenVisualSignalWeight(input.tagCounts) >= 1;
}

function shouldUseGcd(input: RecommenderInput): boolean {
  return input.deckKey === "ms_hs" && teenVisualSignalWeight(input.tagCounts) >= 1;
}

function buildEngineLabel(input: RecommenderInput): string {
  const parts = ["Google Books", "Open Library"];
  if (shouldUseKitsu(input)) parts.push("Kitsu");
  if (shouldUseGcd(input)) parts.push("GCD");
  return parts.join(" + " );
}

function extractDocs(result: RecommendationResult | null | undefined): RecommendationDoc[] {
  if (!result) return [];

  const itemDocs = Array.isArray((result as any).items)
    ? (result as any).items.map((item: any) => item?.doc).filter(Boolean)
    : [];

  const recommendations = Array.isArray((result as any).recommendations)
    ? (result as any).recommendations.filter(Boolean)
    : [];

  const docs = Array.isArray((result as any).docs)
    ? (result as any).docs.filter(Boolean)
    : [];

  return [...itemDocs, ...recommendations, ...docs].filter(
    (doc: any) => doc && typeof doc === "object" && typeof doc.title === "string" && doc.title.trim()
  );
}

function sourceForDoc(doc: any, fallbackSource: CandidateSource): CandidateSource {
  return doc?.source === "googleBooks" || doc?.source === "openLibrary" || doc?.source === "kitsu" || doc?.source === "gcd" ? doc.source : fallbackSource;
}

function dedupeDocs(docs: RecommendationDoc[]): RecommendationDoc[] {
  const seen = new Set<string>();
  const out: RecommendationDoc[] = [];

  for (const doc of docs) {
    const title = String((doc as any)?.title || "").trim().toLowerCase();
    const author =
      Array.isArray((doc as any)?.author_name) && (doc as any).author_name.length > 0
        ? String((doc as any).author_name[0] || "").trim().toLowerCase()
        : String((doc as any)?.author || "").trim().toLowerCase();
    const key =
      String((doc as any)?.key || (doc as any)?.id || "").trim().toLowerCase() ||
      `${title}|${author}`;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }

  return out;
}

async function fetchGcdFromApi(input: RecommenderInput): Promise<RecommendationResult | null> {
  try {
    const res = await fetch("/api/gcd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) throw new Error(`GCD API failed: ${res.status}`);

    const data = await res.json();
    return data?.result ?? null;
  } catch (err) {
    console.warn("[NovelIdeas][recommenderRouter] GCD API error", err);
    return null;
  }
}

async function runEngine(engine: EngineId, input: RecommenderInput): Promise<RecommendationResult> {
  if (engine === "googleBooks") return getGoogleBooksRecommendations(input);

  const domainModeOverride: DomainMode | undefined =
    input.deckKey === "k2" ? (input.domainModeOverride ?? "chapterMiddle") : input.domainModeOverride;

  const routedInput: RecommenderInput =
    domainModeOverride === input.domainModeOverride ? input : { ...input, domainModeOverride };

  return getOpenLibraryRecommendations(routedInput);
}

async function fetchBothEngines(
  input: RecommenderInput
): Promise<{
  google: RecommendationResult | null;
  openLibrary: RecommendationResult | null;
  kitsu: RecommendationResult | null;
  gcd: RecommendationResult | null;
  mergedDocs: RecommendationDoc[];
}> {
  const requests: Array<Promise<RecommendationResult>> = [
    runEngine("googleBooks", input),
    runEngine("openLibrary", input),
  ];

  const includeKitsu = shouldUseKitsu(input);
  const includeGcd = shouldUseGcd(input);

  if (includeKitsu) requests.push(getKitsuMangaRecommendations(input));
  if (includeGcd) requests.push(fetchGcdFromApi(input) as Promise<RecommendationResult>);

  const results = await Promise.allSettled(requests);

  const google = results[0]?.status === "fulfilled" ? results[0].value : null;
  const openLibrary = results[1]?.status === "fulfilled" ? results[1].value : null;
  const kitsuIndex = includeKitsu ? 2 : -1;
  const gcdIndex = includeGcd ? (includeKitsu ? 3 : 2) : -1;
  const kitsu = kitsuIndex >= 0 && results[kitsuIndex]?.status === "fulfilled" ? results[kitsuIndex].value : null;
  const gcd = gcdIndex >= 0 && results[gcdIndex]?.status === "fulfilled" ? results[gcdIndex].value : null;

  const googleDocs = dedupeDocs(extractDocs(google));
  const openLibraryDocs = dedupeDocs(extractDocs(openLibrary));
  const kitsuDocs = dedupeDocs(extractDocs(kitsu));
  const gcdDocs = dedupeDocs(extractDocs(gcd));
  const mergedDocs = dedupeDocs([...googleDocs, ...openLibraryDocs, ...kitsuDocs, ...gcdDocs]);

  return { google, openLibrary, kitsu, gcd, mergedDocs };
}

export async function getRecommendations(
  input: RecommenderInput,
  override?: EngineOverride
): Promise<RecommendationResult> {
  const preferredEngine = chooseEngine(input, override);
  const { google, openLibrary, kitsu, gcd, mergedDocs } = await fetchBothEngines(input);

  const googleDocs = mergedDocs.filter((doc: any) => sourceForDoc(doc, "googleBooks") === "googleBooks");
  const openLibraryDocs = mergedDocs.filter((doc: any) => sourceForDoc(doc, "openLibrary") === "openLibrary");
  const kitsuDocs = mergedDocs.filter((doc: any) => sourceForDoc(doc, "kitsu") === "kitsu");
  const gcdDocs = mergedDocs.filter((doc: any) => sourceForDoc(doc, "gcd") === "gcd");

const googleCandidates = normalizeCandidates(googleDocs, "googleBooks");
const openLibraryCandidates = normalizeCandidates(openLibraryDocs, "openLibrary");
const kitsuCandidatesRaw = normalizeCandidates(kitsuDocs, "kitsu");
const gcdCandidates = normalizeCandidates(gcdDocs, "gcd");

// Deduplicate Kitsu by title to avoid franchise spam, but do not cap early.
const seenTitles = new Set<string>();
const kitsuCandidates = kitsuCandidatesRaw.filter((candidate) => {
  const title = (candidate.title || "").toLowerCase().trim();
  if (!title || seenTitles.has(title)) return false;
  seenTitles.add(title);
  return true;
});

const normalizedCandidates = [
  ...googleCandidates,
  ...openLibraryCandidates,
  ...(shouldUseKitsu(input) ? kitsuCandidates : []),
  ...(shouldUseGcd(input) ? gcdCandidates : []),
];

  console.log("[NovelIdeas][recommenderRouter] finalRecommender", {
    deckKey: input.deckKey,
    preferredEngine,
    googleCount: extractDocs(google).length,
    openLibraryCount: extractDocs(openLibrary).length,
    mergedCount: mergedDocs.length,
    normalizedCount: normalizedCandidates.length,
    googleCandidateCount: googleCandidates.length,
    openLibraryCandidateCount: openLibraryCandidates.length,
    kitsuCandidateCount: kitsuCandidates.length,
    gcdCandidateCount: gcdCandidates.length,
    profileOverrideKeys: input.profileOverride ? Object.keys(input.profileOverride) : [],
  });

  const rankedDocs = finalRecommenderForDeck(normalizedCandidates, input.deckKey, {
    tasteProfile: input.tasteProfile,
    profileOverride: input.profileOverride,
    priorRecommendedIds: input.priorRecommendedIds,
    priorRecommendedKeys: input.priorRecommendedKeys,
    priorAuthors: input.priorAuthors,
    priorSeriesKeys: input.priorSeriesKeys,
    priorRejectedIds: input.priorRejectedIds,
    priorRejectedKeys: input.priorRejectedKeys,
  });

  const base = google || openLibrary;
  if (!base) {
    return {
      engineId: preferredEngine,
      engineLabel: buildEngineLabel(input),
      deckKey: input.deckKey,
      domainMode:
        input.deckKey === "k2"
          ? (input.domainModeOverride ?? "chapterMiddle")
          : (input.domainModeOverride ?? "default"),
      builtFromQuery: "",
      items: [],
    } as RecommendationResult;
  }

  const queryParts = [
    google?.builtFromQuery?.trim(),
    openLibrary?.builtFromQuery?.trim(),
    kitsu?.builtFromQuery?.trim(),
    gcd?.builtFromQuery?.trim(),
  ].filter(Boolean);

  return {
    ...base,
    engineId: preferredEngine,
    engineLabel: buildEngineLabel(input),
    builtFromQuery: queryParts.join(" || "),
    items: rankedDocs.map((doc) => ({ kind: "open_library", doc })),
  } as RecommendationResult;
}
