
import type { TagCounts } from "../openLibraryFromTags";
import type { IntentProfile, AudienceBand, QueryGuard } from "./types";
import {
  GENRE_TO_ANCHOR,
  THEMATIC_ANCHOR_MAP,
  STORY_MODE_SIGNALS,
  PROTAGONIST_SIGNALS,
  TONE_SIGNALS,
  INTENSITY_SIGNALS,
  COMPLEXITY_SIGNALS,
  RELATIONSHIP_SIGNALS,
  QUERY_GUARD_WEIGHTS,
  FORMAT_SIGNAL_WEIGHTS,
} from "./mappings";

type TasteAxes = Record<string, number>;

type BuildIntentProfileInput = {
  deckKey: string;
  tagCounts: TagCounts;
  tasteProfile?: {
    axes?: TasteAxes;
    confidence?: number;
  };
};

type Scored<T extends string> = { value: T; score: number };

type CandidateType =
  | "storyMode"
  | "protagonistPreference"
  | "tonePreference"
  | "intensityPreference"
  | "complexityPreference"
  | "relationshipPreference"
  | "formatBias"
  | "genreAnchor"
  | "thematicAnchor";

type Candidate = {
  type: CandidateType;
  value: string;
  score: number;
  source: "tags" | "axis" | "co_signal";
  retrievalSafe?: boolean;
};

const RETRIEVAL_SAFE_ANCHORS = new Set([
  "mystery",
  "science fiction",
  "sci-fi",
  "fantasy",
  "adventure",
  "thriller",
  "psychological",
  "speculative",
  "survival",
]);

const SEMANTIC_EQUIVALENTS: Record<string, string[]> = {
  psychological: ["thoughtful"],
  "science fiction": ["speculative", "sci-fi"],
  speculative: ["science fiction", "sci-fi"],
  dark: ["bleak"],
};

function audienceFromDeckKey(deckKey: string): AudienceBand {
  if (deckKey === "k2" || deckKey === "kids" || deckKey === "k-2") return "kids";
  if (deckKey === "36" || deckKey === "3-6") return "preteen";
  if (deckKey === "ms_hs" || deckKey === "mshs" || deckKey === "teen" || deckKey === "teens") return "teen";
  return "adult";
}

function normalizeKey(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/_/g, " ");
}

function scoreMatches(signals: readonly string[], tagCounts: TagCounts): number {
  let score = 0;
  for (const [rawTag, rawWeight] of Object.entries(tagCounts || {})) {
    const tag = normalizeKey(rawTag);
    const count = Number(rawWeight) || 0;
    if (!count) continue;

    for (const signal of signals) {
      const s = normalizeKey(signal);
      if (tag === s || tag.endsWith(`:${s}`)) {
        score += count;
      } else if (tag.includes(s) && s.length >= 4) {
        score += count * 0.6;
      }
    }
  }
  return score;
}

function chooseTop<T extends string>(scored: Scored<T>[], minScore = 0.75): T | undefined {
  const sorted = scored.slice().sort((a, b) => b.score - a.score);
  if (!sorted.length || sorted[0].score < minScore) return undefined;
  return sorted[0].value;
}

function chooseStoryMode(tagCounts: TagCounts): IntentProfile["storyMode"] | undefined {
  const scored = Object.entries(STORY_MODE_SIGNALS).map(([mode, cfg]) => ({
    value: mode as NonNullable<IntentProfile["storyMode"]>,
    score: scoreMatches(cfg.positive, tagCounts),
  }));
  const top = scored.sort((a, b) => b.score - a.score)[0];
  return top && top.score >= 1 ? top.value : undefined;
}

function chooseProtagonistPreference(tagCounts: TagCounts): IntentProfile["protagonistPreference"] | undefined {
  const antiheroAverseScore = scoreMatches(PROTAGONIST_SIGNALS.antihero_averse.negativeTriggers, tagCounts);
  const otherKeys: Array<Exclude<NonNullable<IntentProfile["protagonistPreference"]>, "antihero_averse">> = [
    "heroic",
    "sympathetic",
    "flawed_but_rootable",
    "morally_mixed_tolerant",
    "antihero_tolerant",
  ];
  const otherScores = otherKeys.map((key) => ({
    value: key,
    score: scoreMatches(PROTAGONIST_SIGNALS[key].positive, tagCounts),
  }));
  const topOther = otherScores.sort((a, b) => b.score - a.score)[0];
  if (antiheroAverseScore >= Math.max(1.5, (topOther?.score || 0) + 0.25)) return "antihero_averse";
  return topOther && topOther.score >= 1 ? topOther.value : undefined;
}

function chooseEnumFromSignals<T extends string>(
  signalMap: Record<T, readonly string[]>,
  tagCounts: TagCounts,
  minScore = 1
): T | undefined {
  const scored = (Object.keys(signalMap) as T[]).map((key) => ({ value: key, score: scoreMatches(signalMap[key], tagCounts) }));
  return chooseTop(scored, minScore);
}

function chooseFormatBias(tagCounts: TagCounts): IntentProfile["formatBias"] | undefined {
  let visual = 0;
  let prose = 0;
  for (const [tag, count] of Object.entries(tagCounts || {})) {
    const normalized = normalizeKey(tag);
    const value = Number(count) || 0;
    if (!value) continue;
    if (FORMAT_SIGNAL_WEIGHTS.visual.some((s) => normalized === s || normalized.endsWith(`:${s}`))) visual += value;
    if (FORMAT_SIGNAL_WEIGHTS.prose.some((s) => normalized === s || normalized.endsWith(`:${s}`))) prose += value;
  }
  if (visual >= prose + 1.5) return "visual";
  if (prose >= visual + 1.5) return "prose";
  if (visual > 0 || prose > 0) return "mixed";
  return undefined;
}

function chooseQueryGuards(
  profile: {
    protagonistPreference?: IntentProfile["protagonistPreference"];
    tonePreference?: IntentProfile["tonePreference"];
    intensityPreference?: IntentProfile["intensityPreference"];
    complexityPreference?: IntentProfile["complexityPreference"];
    relationshipPreference?: IntentProfile["relationshipPreference"];
  },
  tagCounts: TagCounts
): QueryGuard[] {
  const guards: Array<{ guard: QueryGuard; score: number }> = [];
  if (profile.protagonistPreference === "antihero_averse") guards.push({ guard: "avoid_antihero", score: 3 });
  if (profile.tonePreference === "bleak_averse") {
    guards.push({ guard: "avoid_bleak", score: 2.5 });
    guards.push({ guard: "avoid_hopelessness", score: 2.0 });
  }
  if (profile.relationshipPreference === "toxic_averse") guards.push({ guard: "avoid_toxic_relationships", score: 2.2 });
  if (profile.intensityPreference === "extreme_averse") guards.push({ guard: "avoid_extreme_violence", score: 2.1 });
  if (profile.complexityPreference === "confusing_averse") guards.push({ guard: "avoid_confusing_structure", score: 1.8 });

  for (const [guard, signals] of Object.entries(QUERY_GUARD_WEIGHTS)) {
    const score = scoreMatches(signals, tagCounts);
    if (score > 0.8) guards.push({ guard: guard as QueryGuard, score });
  }

  return guards
    .sort((a, b) => b.score - a.score)
    .map((x) => x.guard)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 2);
}

function retrievalConfidence(tagCounts: TagCounts, selectedCount: number, tasteConfidence?: number): number {
  const magnitude = Object.values(tagCounts || {}).reduce((sum, n) => sum + Math.abs(Number(n) || 0), 0);
  const base = Math.min(0.8, magnitude / 12);
  const structure = Math.min(0.15, selectedCount * 0.02);
  const taste = Math.min(0.2, Number(tasteConfidence || 0) * 0.2);
  return Math.max(0, Math.min(1, base + structure + taste));
}

function isRetrievalSafe(value: string): boolean {
  return RETRIEVAL_SAFE_ANCHORS.has(normalizeKey(value));
}

function scoreGenreAnchors(tagCounts: TagCounts, max = 6): Scored<string>[] {
  return Object.entries(tagCounts || {})
    .filter(([k, v]) => Number(v) > 0 && GENRE_TO_ANCHOR[k])
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k, v]) => ({ value: GENRE_TO_ANCHOR[k], score: Number(v) || 0 }))
    .filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i)
    .slice(0, max);
}

function scoreThematicAnchors(tagCounts: TagCounts, max = 6): Scored<string>[] {
  return Object.entries(THEMATIC_ANCHOR_MAP)
    .map(([raw, mapped]) => ({ value: mapped, score: scoreMatches([raw], tagCounts) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i)
    .slice(0, max);
}

function generateBaseCandidates(tagCounts: TagCounts): Candidate[] {
  const candidates: Candidate[] = [];

  const storyMode = chooseStoryMode(tagCounts);
  if (storyMode) candidates.push({ type: "storyMode", value: storyMode, score: 1.2, source: "tags" });

  const protagonistPreference = chooseProtagonistPreference(tagCounts);
  if (protagonistPreference) {
    candidates.push({ type: "protagonistPreference", value: protagonistPreference, score: 1.1, source: "tags" });
  }

  const tonePreference = chooseEnumFromSignals(TONE_SIGNALS, tagCounts, 1);
  if (tonePreference) candidates.push({ type: "tonePreference", value: tonePreference, score: 1.0, source: "tags" });

  const intensityPreference = chooseEnumFromSignals(INTENSITY_SIGNALS, tagCounts, 1);
  if (intensityPreference) {
    candidates.push({ type: "intensityPreference", value: intensityPreference, score: 1.0, source: "tags" });
  }

  const complexityPreference = chooseEnumFromSignals(COMPLEXITY_SIGNALS, tagCounts, 0.8);
  if (complexityPreference) {
    candidates.push({ type: "complexityPreference", value: complexityPreference, score: 0.9, source: "tags" });
  }

  const relationshipPreference = chooseEnumFromSignals(RELATIONSHIP_SIGNALS, tagCounts, 0.8);
  if (relationshipPreference) {
    candidates.push({ type: "relationshipPreference", value: relationshipPreference, score: 0.9, source: "tags" });
  }

  const formatBias = chooseFormatBias(tagCounts);
  if (formatBias) candidates.push({ type: "formatBias", value: formatBias, score: 0.8, source: "tags" });

  for (const anchor of scoreGenreAnchors(tagCounts)) {
    candidates.push({
      type: "genreAnchor",
      value: anchor.value,
      score: anchor.score,
      source: "tags",
      retrievalSafe: isRetrievalSafe(anchor.value),
    });
  }

  for (const anchor of scoreThematicAnchors(tagCounts)) {
    candidates.push({
      type: "thematicAnchor",
      value: anchor.value,
      score: anchor.score,
      source: "tags",
      retrievalSafe: isRetrievalSafe(anchor.value),
    });
  }

  return candidates;
}

function bumpCandidate(candidates: Candidate[], type: CandidateType, value: string, delta: number, source: Candidate["source"]): Candidate[] {
  const normalizedValue = normalizeKey(value);
  const existing = candidates.find((candidate) => candidate.type === type && normalizeKey(candidate.value) === normalizedValue);
  if (existing) {
    existing.score += delta;
    return candidates;
  }
  candidates.push({
    type,
    value,
    score: Math.max(0, delta),
    source,
    retrievalSafe: type === "genreAnchor" || type === "thematicAnchor" ? isRetrievalSafe(value) : undefined,
  });
  return candidates;
}


function hasTagSignal(tagCounts: TagCounts, signals: readonly string[]): boolean {
  return scoreMatches(signals, tagCounts) > 0;
}

function adjustCandidate(
  candidates: Candidate[],
  type: CandidateType,
  value: string,
  delta: number
): Candidate[] {
  const normalizedValue = normalizeKey(value);
  const existing = candidates.find((candidate) => candidate.type === type && normalizeKey(candidate.value) === normalizedValue);
  if (existing) {
    existing.score = Math.max(0, existing.score + delta);
  }
  return candidates;
}


function applyAxisModifiers(candidates: Candidate[], axes?: TasteAxes, tagCounts?: TagCounts): Candidate[] {
  if (!axes) return candidates;

  const ideaDensity = Number(axes.ideaDensity || 0);
  const realism = Number(axes.realism || 0);
  const humor = Number(axes.humor || 0);
  const pacing = Number(axes.pacing || 0);
  const darkness = Number(axes.darkness || 0);

  const hasGenre = (genre: string): boolean =>
    hasStrongCandidate(candidates, genre, 0.25) || Boolean(tagCounts && hasTagSignal(tagCounts, [genre]));

  const hasTag = (tag: string): boolean =>
    Boolean(tagCounts && hasTagSignal(tagCounts, [tag]));

  const hasSciFiContext = (): boolean =>
    hasGenre("science fiction") || hasStrongCandidate(candidates, "speculative", 0.25) || hasTag("ai") || hasTag("cyberpunk");

  const hasMysteryContext = (): boolean =>
    hasGenre("mystery") || hasGenre("thriller");

  const boostOrCreate = (value: string, delta: number): Candidate[] =>
    bumpCandidate(candidates, "thematicAnchor", value, delta, "axis");

  const reduce = (value: string, delta: number): Candidate[] =>
    adjustCandidate(candidates, "genreAnchor", value, -Math.abs(delta));

  if (ideaDensity >= 0.5) {
    if (hasSciFiContext()) {
      boostOrCreate("speculative", 0.7);
    } else if (hasMysteryContext()) {
      boostOrCreate("psychological", 0.6);
    } else {
      boostOrCreate("thoughtful", 0.5);
    }
  } else if (ideaDensity >= 0.2) {
    if (hasMysteryContext()) {
      boostOrCreate("psychological", 0.45);
    } else if (hasSciFiContext()) {
      boostOrCreate("speculative", 0.45);
    } else {
      boostOrCreate("thoughtful", 0.35);
    }
  }

  if (realism <= -0.2) {
    adjustCandidate(candidates, "thematicAnchor", "realism", -0.4);
  }

  if (realism <= -0.5) {
    boostOrCreate("speculative", 0.6);
  }

  if (darkness >= 0.15) {
    bumpCandidate(candidates, "thematicAnchor", "dark", 0.35, "axis");
  }

  if (humor >= 0.25 && darkness < 0.25 && !hasStrongCandidate(candidates, "dark", 0.9)) {
    bumpCandidate(candidates, "tonePreference", "playful", 0.3, "axis");
    bumpCandidate(candidates, "thematicAnchor", "ironic", 0.2, "axis");
  }

  if (pacing >= 0.2) {
    if (ideaDensity < 0.5) bumpCandidate(candidates, "genreAnchor", "adventure", 0.3, "axis");
    bumpCandidate(candidates, "genreAnchor", "thriller", 0.25, "axis");
    bumpCandidate(candidates, "thematicAnchor", "survival", 0.25, "axis");
  }

  if (ideaDensity >= 0.5) {
    reduce("adventure", 0.4);
  }

  return candidates;
}

function hasStrongCandidate(candidates: Candidate[], value: string, minScore = 0.8): boolean {
  const normalizedValue = normalizeKey(value);
  return candidates.some((candidate) => normalizeKey(candidate.value) === normalizedValue && candidate.score >= minScore);
}


function runCoSignalRouting(candidates: Candidate[], axes?: TasteAxes, tagCounts?: TagCounts): Candidate[] {
  if (!axes) return candidates;

  const ideaDensity = Number(axes.ideaDensity || 0);
  const realism = Number(axes.realism || 0);
  const darkness = Number(axes.darkness || 0);
  const humor = Number(axes.humor || 0);
  const pacing = Number(axes.pacing || 0);

  const hasSciFiContext =
    hasStrongCandidate(candidates, "science fiction", 0.25) ||
    hasStrongCandidate(candidates, "speculative", 0.25) ||
    Boolean(tagCounts && hasTagSignal(tagCounts, ["science fiction", "ai", "cyberpunk"]));

  const hasMysteryContext =
    hasStrongCandidate(candidates, "mystery", 0.25) ||
    hasStrongCandidate(candidates, "thriller", 0.25) ||
    Boolean(tagCounts && hasTagSignal(tagCounts, ["mystery", "thriller"]));

  if (realism <= -0.2 && (hasStrongCandidate(candidates, "science fiction", 0.25) || hasStrongCandidate(candidates, "fantasy", 0.25))) {
    bumpCandidate(candidates, "thematicAnchor", "speculative", 0.25, "co_signal");
  }

  if (realism <= -0.5) {
    bumpCandidate(candidates, "thematicAnchor", "speculative", 0.7, "co_signal");
  }

  if (darkness >= 0.15 && !hasStrongCandidate(candidates, "horror")) {
    bumpCandidate(candidates, "thematicAnchor", "dark", 0.25, "co_signal");
  }

  if (humor >= 0.25 && !hasStrongCandidate(candidates, "dark", 1.0)) {
    bumpCandidate(candidates, "tonePreference", "playful", 0.15, "co_signal");
  }

  if (pacing >= 0.2) {
    if (!hasStrongCandidate(candidates, "adventure")) bumpCandidate(candidates, "genreAnchor", "adventure", 0.2, "co_signal");
    if (!hasStrongCandidate(candidates, "survival")) bumpCandidate(candidates, "thematicAnchor", "survival", 0.2, "co_signal");
  }

  if (ideaDensity >= 0.5) {
    adjustCandidate(candidates, "genreAnchor", "adventure", -0.7);
  }

  return candidates;
}

function betterCandidate(a: Candidate, b: Candidate): Candidate {
  if (a.score !== b.score) return a.score > b.score ? a : b;
  const aSafe = a.retrievalSafe ? 1 : 0;
  const bSafe = b.retrievalSafe ? 1 : 0;
  if (aSafe !== bSafe) return aSafe > bSafe ? a : b;
  return normalizeKey(a.value) <= normalizeKey(b.value) ? a : b;
}

function normalizeAndRankCandidates(candidates: Candidate[]): Candidate[] {
  const byTypeAndValue = new Map<string, Candidate>();

  for (const candidate of candidates) {
    if (candidate.score <= 0) continue;
    const key = `${candidate.type}::${normalizeKey(candidate.value)}`;
    const existing = byTypeAndValue.get(key);
    if (!existing) {
      byTypeAndValue.set(key, { ...candidate });
      continue;
    }
    existing.score += candidate.score;
    existing.retrievalSafe = existing.retrievalSafe || candidate.retrievalSafe;
  }

  const merged = Array.from(byTypeAndValue.values());
  const filtered: Candidate[] = [];

  for (const candidate of merged.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))) {
    const equivalent = filtered.find((existing) => {
      if (existing.type !== candidate.type) return false;
      const normalizedExisting = normalizeKey(existing.value);
      const normalizedCandidate = normalizeKey(candidate.value);
      return normalizedExisting === normalizedCandidate || (SEMANTIC_EQUIVALENTS[normalizedExisting] || []).includes(normalizedCandidate) || (SEMANTIC_EQUIVALENTS[normalizedCandidate] || []).includes(normalizedExisting);
    });

    if (!equivalent) {
      filtered.push(candidate);
      continue;
    }

    const winner = betterCandidate(candidate, equivalent);
    if (winner !== equivalent) {
      const idx = filtered.indexOf(equivalent);
      filtered[idx] = winner;
    }
  }

  const maxScore = Math.max(...filtered.map((candidate) => candidate.score), 1);
  return filtered
    .map((candidate) => ({
      ...candidate,
      score: Number((candidate.score / maxScore).toFixed(4)),
    }))
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
}

function pickTopByType<T extends string>(candidates: Candidate[], type: CandidateType, minScore: number): T | undefined {
  const scoped = candidates.filter((candidate) => candidate.type === type && candidate.score >= minScore);
  return scoped.length ? (scoped[0].value as T) : undefined;
}

function pickAnchors(candidates: Candidate[], type: "genreAnchor" | "thematicAnchor", max: number, minScore: number): string[] {
  return candidates
    .filter((candidate) => candidate.type === type && candidate.score >= minScore)
    .slice(0, max)
    .map((candidate) => candidate.value);
}

function collectAnchorScores(candidates: Candidate[]): { genre: Record<string, number>; thematic: Record<string, number> } {
  const genre: Record<string, number> = {};
  const thematic: Record<string, number> = {};

  for (const candidate of candidates) {
    const key = normalizeKey(candidate.value);
    if (candidate.type === "genreAnchor") genre[key] = candidate.score;
    if (candidate.type === "thematicAnchor") thematic[key] = candidate.score;
  }

  return { genre, thematic };
}

export function buildIntentProfile(input: BuildIntentProfileInput): IntentProfile {
  const audience = audienceFromDeckKey(input.deckKey);
  const tagCounts = input.tagCounts || {};

  const candidates = normalizeAndRankCandidates(
    runCoSignalRouting(
      applyAxisModifiers(generateBaseCandidates(tagCounts), input.tasteProfile?.axes, tagCounts),
      input.tasteProfile?.axes,
      tagCounts
    )
  );

  const anchorScores = collectAnchorScores(candidates);

  const storyMode = pickTopByType<NonNullable<IntentProfile["storyMode"]>>(candidates, "storyMode", 0.25);
  const protagonistPreference = pickTopByType<NonNullable<IntentProfile["protagonistPreference"]>>(
    candidates,
    "protagonistPreference",
    0.25
  );
  const tonePreference = pickTopByType<NonNullable<IntentProfile["tonePreference"]>>(candidates, "tonePreference", 0.2);
  const intensityPreference = pickTopByType<NonNullable<IntentProfile["intensityPreference"]>>(
    candidates,
    "intensityPreference",
    0.2
  );
  const complexityPreference = pickTopByType<NonNullable<IntentProfile["complexityPreference"]>>(
    candidates,
    "complexityPreference",
    0.2
  );
  const relationshipPreference = pickTopByType<NonNullable<IntentProfile["relationshipPreference"]>>(
    candidates,
    "relationshipPreference",
    0.2
  );
  const formatBias = pickTopByType<NonNullable<IntentProfile["formatBias"]>>(candidates, "formatBias", 0.2);
  const genreAnchors = pickAnchors(candidates, "genreAnchor", 2, 0.18);
  const thematicAnchors = pickAnchors(candidates, "thematicAnchor", 2, 0.18);

  const queryGuards = chooseQueryGuards(
    {
      protagonistPreference,
      tonePreference,
      intensityPreference,
      complexityPreference,
      relationshipPreference,
    },
    tagCounts
  );

  const selectedCount = [
    storyMode,
    protagonistPreference,
    tonePreference,
    intensityPreference,
    complexityPreference,
    relationshipPreference,
    formatBias,
    ...genreAnchors,
    ...thematicAnchors,
    ...queryGuards,
  ].filter(Boolean).length;

  return {
    audience,
    storyMode,
    protagonistPreference,
    tonePreference,
    intensityPreference,
    complexityPreference,
    relationshipPreference,
    formatBias,
    genreAnchors,
    thematicAnchors,
    queryGuards,
    retrievalConfidence: retrievalConfidence(tagCounts, selectedCount, input.tasteProfile?.confidence),
    anchorScores,
  } as IntentProfile;
}
