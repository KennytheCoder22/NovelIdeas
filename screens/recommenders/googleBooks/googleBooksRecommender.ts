import type { RecommenderInput, RecommendationResult, RecommendationDoc, DeckKey } from "../types";
import { openLibrarySearch as googleBooksSearch } from "../../swipe/openLibraryFromTags";
import { buildFinalQueryForDeck } from "../../swipe/recommendationsByBand";

function normalizePublisherText(value: any): string {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

const HARD_SELF_PUBLISH_PAT = /(independently published|self[- ]published|createspace|kindle direct publishing|\bkdp\b|amazon digital services|amazon kdp|lulu\.com|lulu press|blurb|smashwords|draft2digital|authorhouse|xlibris|iuniverse|bookbaby|notion press|balboa press|trafford|whitmore publishing)/i;

function isHardSelfPublished(publisher: any): boolean {
  const p = normalizePublisherText(publisher);
  return !!p && HARD_SELF_PUBLISH_PAT.test(p);
}

function buildFallbackQueries(baseQuery: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (q: string) => {
    const trimmed = String(q || "").trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  add(baseQuery);
  const primaryTokens = String(baseQuery || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (let i = primaryTokens.length - 1; i >= Math.max(2, primaryTokens.length - 4); i -= 1) {
    add(primaryTokens.slice(0, i).join(" "));
  }

  add("subject:fiction");
  return out;
}
function deckKeyToDomainMode(deckKey: DeckKey): RecommendationResult["domainMode"] {
  return deckKey === "k2" ? "chapterMiddle" : "default";
}

export async function getGoogleBooksRecommendations(input: RecommenderInput): Promise<RecommendationResult> {
  const deckKey = input.deckKey;
  const finalLimit = Math.max(1, Math.min(40, input.limit ?? 12));
  const fetchLimit = Math.max(20, Math.min(120, Math.max(finalLimit * 4, input.limit ?? 12)));
  const timeoutMs = Math.max(1000, Math.min(30000, input.timeoutMs ?? 15000));

  const baseQuery = buildFinalQueryForDeck({
    deckKey,
    tagCounts: input.tagCounts,
    tasteProfile: input.tasteProfile,
  });

  const mangaWeight =
    Number((input.tagCounts as any)?.["topic:manga"] || 0) +
    Number((input.tagCounts as any)?.["format:graphic_novel"] || 0) +
    Number((input.tagCounts as any)?.["format:graphic novel"] || 0) +
    Number((input.tagCounts as any)?.["media:anime"] || 0);

  const isVisualDominant = mangaWeight >= 4;
  const queriesToTry = isVisualDominant
    ? Array.from(new Set([
        ...buildFallbackQueries('subject:manga subject:"graphic novel" subject:comics'),
        ...buildFallbackQueries(baseQuery),
      ]))
    : buildFallbackQueries(baseQuery);

  const builtFromQuery = queriesToTry[0] || baseQuery;
  const domainMode = deckKeyToDomainMode(deckKey);
  const minCandidateFloor = Math.max(0, Math.min(fetchLimit, Number((input as any)?.minCandidateFloor ?? 0) || 0));

  const collectedDocsRaw: any[] = [];
  const seenKeys = new Set<string>();
  let primaryDocsRaw: any[] = [];

  for (let queryIndex = 0; queryIndex < queriesToTry.length; queryIndex += 1) {
    const q = queriesToTry[queryIndex];
    const rawDocs = await googleBooksSearch(q, fetchLimit, { orderBy: "relevance", langRestrict: "en", timeoutMs });
    const admittedDocsRaw = (Array.isArray(rawDocs) ? rawDocs : []).filter((doc: any) => {
      const publisher = doc?.publisher ?? doc?.volumeInfo?.publisher;
      return !isHardSelfPublished(publisher);
    });

    if (queryIndex === 0) primaryDocsRaw = admittedDocsRaw;
    const shouldBackfill = queryIndex === 0 || collectedDocsRaw.length < Math.max(minCandidateFloor, finalLimit * 2);

    if (shouldBackfill) {
      for (const doc of admittedDocsRaw) {
        const key = String(doc?.key || doc?.id || `${doc?.title || "unknown"}|${queryIndex}`);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        collectedDocsRaw.push({ ...doc, queryRung: queryIndex, queryText: q, source: "googleBooks" });
      }
    }

    if (queryIndex === 0 && primaryDocsRaw.length >= Math.max(1, minCandidateFloor)) break;
    if (collectedDocsRaw.length >= Math.max(fetchLimit, minCandidateFloor)) break;
  }

  const docsRaw =
    primaryDocsRaw.length >= Math.max(1, minCandidateFloor)
      ? primaryDocsRaw.map((doc: any) => ({ ...doc, queryRung: 0, queryText: builtFromQuery, source: "googleBooks" }))
      : collectedDocsRaw.length
        ? collectedDocsRaw
        : primaryDocsRaw.map((doc: any) => ({ ...doc, queryRung: 0, queryText: builtFromQuery, source: "googleBooks" }));

  const docs: RecommendationDoc[] = docsRaw
    .filter((doc: any) => doc && doc.title)
    .map((doc: any) => ({
      key: doc.key ?? doc.id,
      title: doc.title,
      author_name: Array.isArray(doc.author_name) ? doc.author_name : undefined,
      first_publish_year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : undefined,
      cover_i: doc.cover_i,
      subject: Array.isArray(doc.subject)
        ? doc.subject
        : Array.isArray(doc.subjects)
          ? doc.subjects
          : Array.isArray(doc.categories)
            ? doc.categories
            : Array.isArray(doc.volumeInfo?.categories)
              ? doc.volumeInfo.categories
              : undefined,
      edition_count: typeof doc.edition_count === "number" ? doc.edition_count : typeof doc.editionCount === "number" ? doc.editionCount : undefined,
      publisher: doc.publisher,
      language: Array.isArray(doc.language) ? doc.language : typeof doc.volumeInfo?.language === "string" ? [doc.volumeInfo.language] : undefined,
      ebook_access: typeof doc.ebook_access === "string" ? doc.ebook_access : undefined,
      source: "googleBooks",
      queryRung: Number.isFinite(Number(doc.queryRung)) ? Number(doc.queryRung) : undefined,
      queryText: typeof doc.queryText === "string" ? doc.queryText : undefined,
      subtitle: typeof doc.subtitle === "string" ? doc.subtitle : undefined,
      description: typeof doc.description === "string" ? doc.description : undefined,
      averageRating: typeof doc.averageRating === "number" ? doc.averageRating : undefined,
      ratingsCount: typeof doc.ratingsCount === "number" ? doc.ratingsCount : undefined,
      volumeInfo: doc.volumeInfo,
    } as any));

  return {
    engineId: "googleBooks",
    engineLabel: "Google Books",
    deckKey,
    domainMode,
    builtFromQuery,
    items: docs.map((doc) => ({ kind: "open_library", doc })),
  };
}
