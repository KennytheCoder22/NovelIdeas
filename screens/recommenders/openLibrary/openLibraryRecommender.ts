// /screens/recommenders/openLibrary/openLibraryRecommender.ts
//
// Open Library recommendation engine.
// NOTE: This module must NOT import any Google Books HTTP code.

import type { RecommenderInput, RecommendationResult, RecommendationDoc, DeckKey } from "../types";
import { buildOpenLibraryKidsQ } from "./openLibraryKidsQueryBuilder";

function normalizePublisherText(value: any): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const HARD_SELF_PUBLISH_PAT = /(independently published|self[- ]published|createspace|kindle direct publishing|\bkdp\b|amazon digital services|amazon kdp|lulu\.com|lulu press|blurb|smashwords|draft2digital|authorhouse|xlibris|iuniverse|bookbaby|notion press|balboa press|trafford|whitmore publishing)/i;

function isHardSelfPublished(publisher: any): boolean {
  const p = normalizePublisherText(publisher);
  if (!p) return false;
  return HARD_SELF_PUBLISH_PAT.test(p);
}

function buildFallbackQueries(built: { q: string; parts?: { core: string[]; optional: string[] } }): string[] {
  // Open Library ANDs tokens; too many tokens => 0 hits.
  // Try: full -> drop optional tokens one-by-one -> lighter optional mixes -> core only.
  const seen = new Set<string>();
  const add = (q: string) => {
    const t = (q || "").trim();
    if (!t) return;
    if (seen.has(t)) return;
    seen.add(t);
  };

  add(built.q);

  const parts = built.parts;
  if (parts?.core?.length) {
    const core = parts.core;
    const opt = [...(parts.optional || [])];

    // Drop last optional one-by-one.
    for (let i = opt.length - 1; i >= 0; i -= 1) {
      add([...core, ...opt.slice(0, i)].join(" "));
    }

    // Core + strongest single optional terms
    for (let i = 0; i < Math.min(opt.length, 4); i += 1) {
      add([...core, opt[i]].join(" "));
    }

    // Core + adjacent optional pairs
    for (let i = 0; i < Math.min(opt.length - 1, 3); i += 1) {
      add([...core, opt[i], opt[i + 1]].join(" "));
    }

    // Core only (highest recall)
    add(core.join(" "));
  }

  return Array.from(seen);
}

function normalizeTagKey(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function stripKnownPrefix(tag: string): { prefix: string; value: string } {
  const normalized = normalizeTagKey(tag);
  const idx = normalized.indexOf(":");
  if (idx < 0) return { prefix: "", value: normalized };
  return {
    prefix: normalized.slice(0, idx).trim(),
    value: normalized.slice(idx + 1).trim(),
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function mapTagToSubjects(tag: string): string[] {
  const { prefix, value } = stripKnownPrefix(tag);
  const raw = value || normalizeTagKey(tag);

  switch (raw) {
    case "coming of age":
      return ['subject:"coming of age"', 'subject:"young adult"'];
    case "survival":
      return ['subject:"survival"', 'subject:"adventure"'];
    case "psychological":
    case "psychological fiction":
      return ['subject:"psychological"', 'subject:"psychological fiction"', 'subject:"thriller"'];
    case "friendship":
      return ['subject:"friendship"'];
    case "identity":
      return ['subject:"identity"', 'subject:"coming of age"'];
    case "adventure":
      return ['subject:"adventure"'];
    case "mystery":
      return ['subject:"mystery"', 'subject:"detective and mystery stories"'];
    case "crime":
      return ['subject:"crime"', 'subject:"crime fiction"', 'subject:"detective and mystery stories"'];
    case "romance":
      return ['subject:"romance"', 'subject:"love stories"'];
    case "fantasy":
      return ['subject:"fantasy"'];
    case "dystopian":
      return ['subject:"dystopian fiction"', 'subject:"science fiction"'];
    case "science fiction":
    case "sci fi":
    case "sci-fi":
      return ['subject:"science fiction"'];
    case "historical fiction":
      return ['subject:"historical fiction"'];
    case "thriller":
      return ['subject:"thrillers"', 'subject:"suspense fiction"'];
    case "horror":
      return ['subject:"horror tales"', 'subject:"horror"'];
    case "paranormal":
      return ['subject:"paranormal fiction"', 'subject:"supernatural"'];
    case "sports":
      return ['subject:"sports stories"', 'subject:"sports"'];
    case "found family":
      return ['subject:"friendship"', 'subject:"coming of age"'];
    case "everyday life":
      return ['subject:"social life and customs"'];
    case "magic":
      return ["subject:magic", 'subject:"fantasy"'];
    case "rebellion":
      return ["subject:rebellion", 'subject:"dystopian fiction"'];
    case "drama":
      return ['subject:"drama"'];
    case "realistic fiction":
      return ['subject:"realistic fiction"', 'subject:"social life and customs"', 'subject:"fiction"'];
    case "literary fiction":
      return ['subject:"literary fiction"', 'subject:"fiction"'];
    case "suspense":
      return ['subject:"suspense fiction"', 'subject:"thrillers"'];
    case "weird":
      return ['subject:"psychological fiction"', 'subject:"fiction"'];
    case "artificial intelligence":
      return ['subject:"artificial intelligence"', 'subject:"science fiction"'];
    case "power":
      return ['subject:"power"', 'subject:"social conditions"'];
    default:
      break;
  }

  // Prefix-sensitive handling from canonical tag vocabulary.
  if (prefix === "genre") {
    if (raw === "science fiction") return ['subject:"science fiction"'];
    if (raw === "realistic fiction") return ['subject:"realistic fiction"', 'subject:"fiction"'];
    if (raw === "historical fiction") return ['subject:"historical fiction"'];
    if (raw === "crime") return ['subject:"crime fiction"', 'subject:"detective and mystery stories"'];
    if (raw === "mystery") return ['subject:"mystery"', 'subject:"detective and mystery stories"'];
    if (raw === "drama") return ['subject:"drama"'];
    if (raw === "thriller") return ['subject:"thrillers"', 'subject:"suspense fiction"'];
    if (raw === "fantasy") return ['subject:"fantasy"'];
    if (raw === "horror") return ['subject:"horror tales"', 'subject:"horror"'];
    if (raw === "romance") return ['subject:"romance"', 'subject:"love stories"'];
    if (raw === "dystopian") return ['subject:"dystopian fiction"', 'subject:"science fiction"'];
  }

  if (prefix === "theme") {
    if (raw === "power") return ['subject:"power"', 'subject:"social conditions"'];
    if (raw === "identity") return ['subject:"identity"', 'subject:"coming of age"'];
    if (raw === "friendship") return ['subject:"friendship"'];
    if (raw === "rebellion") return ['subject:"rebellion"', 'subject:"dystopian fiction"'];
  }

  if (prefix === "vibe") {
    if (raw === "thoughtful") return ['subject:"psychological fiction"', 'subject:"literary fiction"'];
    if (raw === "weird ambition") return ['subject:"psychological fiction"', 'subject:"fiction"'];
    if (raw === "weird") return ['subject:"psychological fiction"', 'subject:"fiction"'];
  }

  // Generic fallback: Open Library works best with subject: prefixes, not free text.
  if (raw && raw.length >= 3) {
    return [`subject:"${raw}"`];
  }

  return [];
}

function buildOpenLibraryBandQBase(
  core: string[],
  tagCounts: Record<string, number> | undefined
): { q: string; parts?: { core: string[]; optional: string[] } } {
  const entries = Object.entries(tagCounts || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k]) => normalizeTagKey(k))
    .filter(Boolean);

  const optional: string[] = [];

  const addOptional = (s: string) => {
    if (!optional.includes(s) && !core.includes(s)) optional.push(s);
  };

  const prioritized = entries.sort((left, right) => {
    const l = stripKnownPrefix(left).prefix;
    const r = stripKnownPrefix(right).prefix;
    const lScore = l === "genre" ? 0 : l === "theme" ? 1 : l === "vibe" ? 2 : 3;
    const rScore = r === "genre" ? 0 : r === "theme" ? 1 : r === "vibe" ? 2 : 3;
    return lScore - rScore;
  });

  for (const tag of prioritized.slice(0, 8)) {
    const mapped = mapTagToSubjects(tag);
    for (const subject of mapped) {
      if (optional.length < 6) addOptional(subject);
    }
  }

  const coreUnique = uniqueStrings(core);
  const optionalUnique = uniqueStrings(optional);
  const baseQuery = uniqueStrings([...coreUnique, ...optionalUnique]).join(" ");
  const fanOutQueries: string[] = [];

  for (const opt of optionalUnique) {
    fanOutQueries.push([...coreUnique, opt].join(" "));
  }

  const q = fanOutQueries.length ? fanOutQueries.join(" || ") : baseQuery;

  return {
    q,
    parts: { core: coreUnique, optional: optionalUnique },
  };
}

function buildOpenLibraryPreTeenQ(
  tagCounts: Record<string, number> | undefined
): { q: string; parts?: { core: string[]; optional: string[] } } {
  return buildOpenLibraryBandQBase(
    ['subject:"juvenile fiction"', "subject:fiction"],
    tagCounts
  );
}

function buildOpenLibraryTeenQ(
  tagCounts: Record<string, number> | undefined
): { q: string; parts?: { core: string[]; optional: string[] } } {
  return buildOpenLibraryBandQBase(
    ['subject:"young adult fiction"', 'subject:"juvenile fiction"', "subject:fiction"],
    tagCounts
  );
}

function buildOpenLibraryAdultQ(
  tagCounts: Record<string, number> | undefined
): { q: string; parts?: { core: string[]; optional: string[] } } {
  return buildOpenLibraryBandQBase(["subject:fiction"], tagCounts);
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
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
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

  // v1: only Kids uses the deterministic OL query builder spec right now.
  const band = deckKeyToBand(deckKey);

  let builtFromQuery = "";
  let domainMode: any = "default";

  const queriesToTry: string[] = [];

  if (band === "kids") {
    const built = buildOpenLibraryKidsQ(input.tagCounts, input.domainModeOverride);
    domainMode = built.mode;
    queriesToTry.push(...buildFallbackQueries(built));
    builtFromQuery = queriesToTry[0] || built.q;
  } else if (band === "preteen") {
    const built = buildOpenLibraryPreTeenQ(input.tagCounts);
    domainMode = "default";
    queriesToTry.push(...buildFallbackQueries(built));
    builtFromQuery = queriesToTry[0] || built.q;
  } else if (band === "teens") {
    const built = buildOpenLibraryTeenQ(input.tagCounts);
    domainMode = "default";
    queriesToTry.push(...buildFallbackQueries(built));
    builtFromQuery = queriesToTry[0] || built.q;
  } else {
    const built = buildOpenLibraryAdultQ(input.tagCounts);
    domainMode = "default";
    queriesToTry.push(...buildFallbackQueries(built));
    builtFromQuery = queriesToTry[0] || built.q;
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

  const minCandidateFloor = Math.max(
    0,
    Math.min(fetchLimit, Number((input as any)?.minCandidateFloor ?? 0) || 0)
  );

  let bestDocsRaw: any[] = [];
  let bestQuery = builtFromQuery;
  const collectedDocsRaw: any[] = [];
  const seenKeys = new Set<string>();
  let lastError: Error | null = null;

  for (let queryIndex = 0; queryIndex < queriesToTry.length; queryIndex += 1) {
    const q = queriesToTry[queryIndex];
    const url =
      `https://openlibrary.org/search.json` +
      `?q=${encodeURIComponent(q)}` +
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
      if (queryIndex === 0 && admittedDocsRaw.length >= Math.max(finalLimit, minCandidateFloor)) {
        // strong first query; no need to keep broadening
        break;
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err?.message || err || "Unknown Open Library error"));
      continue;
    }
  }

  const docsRaw = collectedDocsRaw.length ? collectedDocsRaw : bestDocsRaw;
  builtFromQuery = bestQuery;

  if (!docsRaw.length && lastError) {
    throw lastError;
  }

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
