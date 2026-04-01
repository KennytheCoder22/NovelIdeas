import type { FormatBias, IntentProfile, QueryBrief } from "./types";

type AnchorType = "protagonist" | "tone" | "thematic" | "genre";

type AnchorCandidate = {
  value: string;
  type: AnchorType;
  score: number;
};

const PRIORITY_ORDER: Record<AnchorType, number> = {
  protagonist: 4,
  tone: 3,
  thematic: 2,
  genre: 1,
};

const RETRIEVAL_SAFE = new Set([
  "mystery",
  "thriller",
  "fantasy",
  "science fiction",
  "adventure",
  "psychological",
  "speculative",
  "survival",
]);

const WEAK_ANCHORS = new Set([
  "identity",
  "life",
  "relationships",
  "human",
]);

const OVERLAP_GROUPS: string[][] = [
  ["psychological", "thoughtful"],
  ["speculative", "science fiction"],
  ["dark", "bleak", "grim"],
  ["character-driven", "identity"],
];

function getAnchorScore(intent: IntentProfile, type: "genre" | "thematic", value: string, fallback: number): number {
  const scoreMap = ((intent as any)?.anchorScores?.[type] || {}) as Record<string, number>;
  const normalized = String(value || "").trim().toLowerCase();
  const score = Number(scoreMap[normalized]);
  return Number.isFinite(score) ? score : fallback;
}

function compareAnchorCandidates(a: AnchorCandidate, b: AnchorCandidate): number {
  const aIsGenre = a.type === "genre";
  const bIsGenre = b.type === "genre";

  if (aIsGenre !== bIsGenre && Math.abs(a.score - b.score) <= 0.15) {
    return aIsGenre ? 1 : -1;
  }

  if (a.score !== b.score) return b.score - a.score;

  if (
    (a.type === "thematic" && b.type === "tone" && a.score >= b.score - 0.08) ||
    (b.type === "thematic" && a.type === "tone" && b.score >= a.score - 0.08)
  ) {
    return a.type === "thematic" ? -1 : 1;
  }

  if (PRIORITY_ORDER[a.type] !== PRIORITY_ORDER[b.type]) {
    return PRIORITY_ORDER[b.type] - PRIORITY_ORDER[a.type];
  }

  return a.value.localeCompare(b.value);
}

function protagonistToQueryAnchor(value: IntentProfile["protagonistPreference"]): string | undefined {
  switch (value) {
    case "heroic":
      return "heroic protagonist";
    case "sympathetic":
      return "sympathetic protagonist";
    case "flawed_but_rootable":
      return "flawed but likable protagonist";
    case "morally_mixed_tolerant":
      return "morally complex characters";
    case "antihero_tolerant":
      return "antihero";
    case "antihero_averse":
      return "sympathetic protagonist";
    default:
      return undefined;
  }
}

function toneToQueryAnchor(value: IntentProfile["tonePreference"]): string | undefined {
  switch (value) {
    case "warm":
      return "warm";
    case "hopeful":
      return "hopeful";
    case "balanced":
      return "character-driven";
    case "dark":
      return "dark";
    case "playful":
      return "playful";
    case "weird_tolerant":
      return "strange";
    case "bleak_averse":
      return "hopeful";
    default:
      return undefined;
  }
}

function overlaps(a: string, b: string): boolean {
  if (a === b) return true;
  return OVERLAP_GROUPS.some((group) => group.includes(a) && group.includes(b));
}

function buildAnchorCandidates(intent: IntentProfile): AnchorCandidate[] {
  const protagonistAnchor = protagonistToQueryAnchor(intent.protagonistPreference);
  const toneAnchor = toneToQueryAnchor(intent.tonePreference);

  return [
    ...(protagonistAnchor ? [{ value: protagonistAnchor, type: "protagonist" as const, score: 1 }] : []),
    ...(toneAnchor ? [{
      value: toneAnchor,
      type: "tone" as const,
      score:
        intent.audience === "teen"
          ? (toneAnchor === "dark" ? 0.56 : 0.82)
          : (toneAnchor === "dark" ? 0.72 : 0.9),
    }] : []),
    ...intent.thematicAnchors.map((value, index) => {
      const normalized = String(value || "").trim().toLowerCase();
      const teenBoost =
        intent.audience === "teen" && (
          normalized === "psychological" ||
          normalized === "speculative" ||
          normalized === "survival" ||
          normalized === "coming of age" ||
          normalized === "friendship"
        )
          ? 0.08
          : 0;
      return {
        value,
        type: "thematic" as const,
        score: getAnchorScore(intent, "thematic", value, Math.max(0.2, 0.9 - index * 0.1)) + teenBoost,
      };
    }),
    ...intent.genreAnchors.map((value, index) => ({
      value,
      type: "genre" as const,
      score: getAnchorScore(intent, "genre", value, Math.max(0.2, 0.85 - index * 0.1)),
    })),
  ].filter((candidate) => Boolean(candidate.value));
}

function findNextDistinctAnchor(selected: AnchorCandidate[], candidates: AnchorCandidate[]): AnchorCandidate | undefined {
  return candidates.find((candidate) => {
    if (!candidate.value || WEAK_ANCHORS.has(candidate.value)) return false;
    if (selected.some((existing) => overlaps(existing.value, candidate.value))) return false;
    if (selected.some((existing) => existing.value === candidate.value && existing.type === candidate.type)) return false;
    return true;
  });
}

function selectAnchors(intent: IntentProfile): { selected: string[]; enforcedNonGenre: string[] } {
  const maxSelected = 3;

  const candidates = buildAnchorCandidates(intent)
    .filter((candidate) => candidate.value && !WEAK_ANCHORS.has(candidate.value))
    .sort(compareAnchorCandidates);

  const selected: AnchorCandidate[] = [];

  const chooseCandidate = (candidate: AnchorCandidate) => {
    if (selected.some((existing) => overlaps(existing.value, candidate.value))) return false;
    if (selected.some((existing) => existing.value === candidate.value && existing.type === candidate.type)) return false;
    selected.push(candidate);
    return true;
  };

  const safeGenreValues = intent.genreAnchors.filter((value) => RETRIEVAL_SAFE.has(value));
  const safeGenreCandidates = safeGenreValues
    .map((value, index) => ({
      value,
      type: "genre" as const,
      score: getAnchorScore(intent, "genre", value, Math.max(0.35, 0.8 - index * 0.08)),
    }))
    .sort(compareAnchorCandidates);

  const thematicPriority = candidates.filter((candidate) => candidate.type === "thematic");
  const genrePriority = candidates.filter((candidate) => candidate.type === "genre");
  const otherPriority = candidates.filter((candidate) => candidate.type !== "thematic" && candidate.type !== "genre");

  const primaryPools = [thematicPriority, genrePriority, otherPriority];

  for (const pool of primaryPools) {
    for (const candidate of pool) {
      chooseCandidate(candidate);
      if (selected.length >= 2) break;
    }
    if (selected.length >= 2) break;
  }

  if (!selected.some((candidate) => candidate.type === "genre" && RETRIEVAL_SAFE.has(candidate.value))) {
    const safeGenre = findNextDistinctAnchor(selected, safeGenreCandidates);
    if (safeGenre) {
      const replacementIndex = selected.findIndex((candidate) => candidate.type === "genre");
      if (replacementIndex >= 0) {
        selected[replacementIndex] = safeGenre;
      } else if (selected.length < maxSelected) {
        selected.push(safeGenre);
      } else if (selected.length > 0) {
        selected[selected.length - 1] = safeGenre;
      }
    }
  }

  const fallbackCandidates = buildAnchorCandidates(intent).sort(compareAnchorCandidates);

  while (selected.length < maxSelected) {
    const next =
      findNextDistinctAnchor(selected, thematicPriority) ||
      findNextDistinctAnchor(selected, safeGenreCandidates) ||
      findNextDistinctAnchor(selected, fallbackCandidates);

    if (!next) break;
    selected.push(next);
  }

  if (!selected.length) {
    const hardFallback =
      findNextDistinctAnchor(selected, safeGenreCandidates) ||
      findNextDistinctAnchor(selected, fallbackCandidates);
    if (hardFallback) selected.push(hardFallback);
  }

  const finalSelected = selected.slice(0, maxSelected);
  const enforcedNonGenre = finalSelected
    .filter((candidate) => candidate.type !== "genre")
    .map((candidate) => candidate.value);

  return {
    selected: finalSelected.map((candidate) => candidate.value),
    enforcedNonGenre,
  };
}

export function buildQueryBrief(intent: IntentProfile): QueryBrief & { enforcedNonGenre?: string[] } {
  const confidence = intent.retrievalConfidence;
  const protagonistAnchor = protagonistToQueryAnchor(intent.protagonistPreference);
  const toneAnchor = toneToQueryAnchor(intent.tonePreference);
  const { selected, enforcedNonGenre } = selectAnchors(intent);

  const genreAnchors = selected.filter((value) => intent.genreAnchors.includes(value)).slice(0, 2);
  const thematicAnchors = selected.filter((value) => intent.thematicAnchors.includes(value)).slice(0, 3);

  if (toneAnchor && selected.includes(toneAnchor) && !thematicAnchors.includes(toneAnchor)) {
    thematicAnchors.unshift(toneAnchor);
  }

  if (protagonistAnchor && selected.includes(protagonistAnchor) && !thematicAnchors.includes(protagonistAnchor)) {
    thematicAnchors.unshift(protagonistAnchor);
  }

  return {
    audience: intent.audience,
    genreAnchors,
    thematicAnchors: thematicAnchors.slice(0, 3),
    protagonistAnchor: protagonistAnchor && selected.includes(protagonistAnchor) ? protagonistAnchor : undefined,
    toneAnchor: toneAnchor && selected.includes(toneAnchor) ? toneAnchor : undefined,
    formatBias: intent.formatBias as FormatBias | undefined,
    queryGuards: intent.queryGuards.slice(0, 2),
    confidence,
    enforcedNonGenre,
  };
}
