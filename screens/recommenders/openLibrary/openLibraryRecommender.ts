import type { RecommenderInput, RecommendationResult, RecommendationDoc, DeckKey } from "../types";
import { buildOpenLibraryKidsQ } from "./openLibraryKidsQueryBuilder";
import { buildFinalQueryForDeck } from "../../swipe/recommendationsByBand";

function normalizePublisherText(value: any): string {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

const HARD_SELF_PUBLISH_PAT = /(independently published|self[- ]published|createspace|kindle direct publishing|\bkdp\b|amazon digital services|amazon kdp|lulu\.com|lulu press|blurb|smashwords|draft2digital|authorhouse|xlibris|iuniverse|bookbaby|notion press|balboa press|trafford|whitmore publishing)/i;

function isHardSelfPublished(publisher: any): boolean {
  const p = normalizePublisherText(publisher);
  return !!p && HARD_SELF_PUBLISH_PAT.test(p);
}

function buildFallbackQueries(query: string): string[] {
  const trimmed = String(query || "").trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  if (trimmed) out.add(trimmed);
  for (let i = tokens.length - 1; i >= Math.max(2, tokens.length - 4); i -= 1) {
    out.add(tokens.slice(0, i).join(" "));
  }
  if (!out.size) out.add('subject:fiction');
  return Array.from(out);
}

function deckKeyToBand(deckKey: DeckKey): "kids" | "preteen" | "teens" | "adult" {
  if (deckKey === "k2") return "kids";
  if (deckKey === "36") return "preteen";
  if (deckKey === "ms_hs") return "teens";
  return "adult";
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`Open Library error: ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getOpenLibraryRecommendations(input: RecommenderInput): Promise<RecommendationResult> {
  const deckKey = input.deckKey;
  const finalLimit = Math.max(1, Math.min(40, input.limit ?? 12));
  const fetchLimit = Math.max(40, Math.min(160, Math.max(finalLimit * 6, (input.limit ?? 12) * 4)));
  const timeoutMs = Math.max(2500, Math.min(20000, input.timeoutMs ?? 12000));
  const band = deckKeyToBand(deckKey);

  let builtFromQuery = "";
  let domainMode: any = "default";
  const queriesToTry: string[] = [];

  if (band === "kids") {
    const built = buildOpenLibraryKidsQ(input.tagCounts, input.domainModeOverride);
    domainMode = built.mode;
    queriesToTry.push(...buildFallbackQueries(built.q));
    builtFromQuery = queriesToTry[0] || built.q;
  } else {
    const briefQuery = buildFinalQueryForDeck({
      deckKey,
      tagCounts: input.tagCounts,
      tasteProfile: input.tasteProfile,
    });
    domainMode = "default";
    queriesToTry.push(...buildFallbackQueries(briefQuery));
    builtFromQuery = queriesToTry[0] || briefQuery;
  }

  const fields = [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "subject",
    "cover_i",
    "edition_count",
    "publisher",
    "language",
    "ebook_access",
  ].join(",");

  const minCandidateFloor = Math.max(0, Math.min(fetchLimit, Number((input as any)?.minCandidateFloor ?? 0) || 0));
  let bestDocsRaw: any[] = [];
  let bestQuery = builtFromQuery;
  const collectedDocsRaw: any[] = [];
  const seenKeys = new Set<string>();
  let lastError: Error | null = null;

  for (let queryIndex = 0; queryIndex < queriesToTry.length; queryIndex += 1) {
    const q = queriesToTry[queryIndex];
    const url =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}` +
      `&limit=${encodeURIComponent(String(fetchLimit))}` +
      `&fields=${encodeURIComponent(fields)}` +
      `&language=${encodeURIComponent("eng")}`;

    try {
      const data = await fetchJsonWithTimeout(url, timeoutMs);
      const docsRaw = Array.isArray(data?.docs) ? data.docs : [];
      const admittedDocsRaw = docsRaw.filter((d: any) => {
        const publishers = Array.isArray(d?.publisher) ? d.publisher : [];
        return !publishers.some((p: any) => isHardSelfPublished(p));
      });

      if (admittedDocsRaw.length > bestDocsRaw.length) {
        bestDocsRaw = admittedDocsRaw;
        bestQuery = q;
      }

      for (const d of admittedDocsRaw) {
        const key = String(d?.key || `${d?.title || "unknown"}|${queryIndex}`);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        collectedDocsRaw.push({ ...d, queryRung: queryIndex, queryText: q });
      }

      if (collectedDocsRaw.length >= fetchLimit) break;
      if (queryIndex === 0 && admittedDocsRaw.length >= Math.max(finalLimit, minCandidateFloor)) break;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err?.message || err || "Unknown Open Library error"));
    }
  }

  const docsRaw = collectedDocsRaw.length ? collectedDocsRaw : bestDocsRaw;
  builtFromQuery = bestQuery;
  if (!docsRaw.length && lastError) throw lastError;

  const docs: RecommendationDoc[] = docsRaw
    .filter((d: any) => d && d.title)
    .map((d: any) => ({
      key: d.key,
      title: d.title,
      author_name: Array.isArray(d.author_name) ? d.author_name : undefined,
      first_publish_year: typeof d.first_publish_year === "number" ? d.first_publish_year : undefined,
      cover_i: d.cover_i,
      subject: Array.isArray(d.subject) ? d.subject : undefined,
      edition_count: typeof d.edition_count === "number" ? d.edition_count : undefined,
      publisher: Array.isArray(d.publisher) ? d.publisher : undefined,
      language: Array.isArray(d.language) ? d.language : undefined,
      ebook_access: typeof d.ebook_access === "string" ? d.ebook_access : undefined,
      source: "openLibrary",
      queryRung: Number.isFinite(Number(d.queryRung)) ? Number(d.queryRung) : undefined,
      queryText: typeof d.queryText === "string" ? d.queryText : undefined,
    }));

  return {
    engineId: "openLibrary",
    engineLabel: "Open Library",
    deckKey,
    domainMode,
    builtFromQuery,
    items: docs.map((doc) => ({ kind: "open_library", doc })),
  };
}
