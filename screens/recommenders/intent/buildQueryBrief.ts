import type { FormatBias, IntentProfile, QueryBrief } from "./types";

type AnchorType = "protagonist" | "tone" | "thematic" | "genre";

type AnchorCandidate = {
  value: string;
  type: AnchorType;
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
    ...(protagonistAnchor ? [{ value: protagonistAnchor, type: "protagonist" as const }] : []),
    ...(toneAnchor ? [{ value: toneAnchor, type: "tone" as const }] : []),
    ...intent.thematicAnchors.map((value) => ({ value, type: "thematic" as const })),
    ...intent.genreAnchors.map((value) => ({ value, type: "genre" as const })),
  ].filter((candidate) => Boolean(candidate.value));
}

function selectAnchors(intent: IntentProfile): { selected: string[]; enforcedNonGenre: string[] } {
  const candidates = buildAnchorCandidates(intent)
    .filter((candidate) => candidate.value && !WEAK_ANCHORS.has(candidate.value))
    .sort((a, b) => PRIORITY_ORDER[b.type] - PRIORITY_ORDER[a.type]);

  const selected: AnchorCandidate[] = [];

  for (const candidate of candidates) {
    if (selected.some((existing) => overlaps(existing.value, candidate.value))) continue;
    selected.push(candidate);
    if (selected.length === 2) break;
  }

  if (!selected.some((candidate) => RETRIEVAL_SAFE.has(candidate.value))) {
    const safeGenre = intent.genreAnchors.find((value) => RETRIEVAL_SAFE.has(value));
    if (safeGenre) {
      const replacementIndex = selected.findIndex((candidate) => candidate.type === "genre");
      if (replacementIndex >= 0) {
        selected[replacementIndex] = { value: safeGenre, type: "genre" };
      } else if (selected.length < 2) {
        selected.push({ value: safeGenre, type: "genre" });
      } else {
        selected[selected.length - 1] = { value: safeGenre, type: "genre" };
      }
    }
  }

  const fallbackCandidates = buildAnchorCandidates(intent).sort(
    (a, b) => PRIORITY_ORDER[b.type] - PRIORITY_ORDER[a.type]
  );

  for (const candidate of fallbackCandidates) {
    if (selected.length >= 2) break;
    if (WEAK_ANCHORS.has(candidate.value)) continue;
    if (selected.some((existing) => overlaps(existing.value, candidate.value))) continue;
    selected.push(candidate);
  }

  const finalSelected = selected.slice(0, 2);
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
  const thematicAnchors = selected.filter((value) => intent.thematicAnchors.includes(value)).slice(0, 2);

  if (toneAnchor && selected.includes(toneAnchor) && !thematicAnchors.includes(toneAnchor)) {
    thematicAnchors.unshift(toneAnchor);
  }

  if (protagonistAnchor && selected.includes(protagonistAnchor) && !thematicAnchors.includes(protagonistAnchor)) {
    thematicAnchors.unshift(protagonistAnchor);
  }

  return {
    audience: intent.audience,
    genreAnchors,
    thematicAnchors: thematicAnchors.slice(0, 2),
    protagonistAnchor,
    toneAnchor,
    formatBias: intent.formatBias as FormatBias | undefined,
    queryGuards: intent.queryGuards.slice(0, 2),
    confidence,
    enforcedNonGenre,
  };
}
