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

function chooseGenreAnchors(tagCounts: TagCounts, max = 3): string[] {
  return Object.entries(tagCounts || {})
    .filter(([k, v]) => Number(v) > 0 && GENRE_TO_ANCHOR[k])
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k]) => GENRE_TO_ANCHOR[k])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, max);
}

function chooseThematicAnchors(tagCounts: TagCounts, max = 3): string[] {
  return Object.entries(THEMATIC_ANCHOR_MAP)
    .map(([raw, mapped]) => ({ mapped, score: scoreMatches([raw], tagCounts) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.mapped)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, max);
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

function chooseEnumFromSignals<T extends string>(signalMap: Record<T, readonly string[]>, tagCounts: TagCounts, minScore = 1): T | undefined {
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

export function buildIntentProfile(input: BuildIntentProfileInput): IntentProfile {
  const audience = audienceFromDeckKey(input.deckKey);
  const tagCounts = input.tagCounts || {};
  const storyMode = chooseStoryMode(tagCounts);
  const protagonistPreference = chooseProtagonistPreference(tagCounts);
  const tonePreference = chooseEnumFromSignals(TONE_SIGNALS, tagCounts, 1);
  const intensityPreference = chooseEnumFromSignals(INTENSITY_SIGNALS, tagCounts, 1);
  const complexityPreference = chooseEnumFromSignals(COMPLEXITY_SIGNALS, tagCounts, 0.8);
  const relationshipPreference = chooseEnumFromSignals(RELATIONSHIP_SIGNALS, tagCounts, 0.8);
  const formatBias = chooseFormatBias(tagCounts);
  const genreAnchors = chooseGenreAnchors(tagCounts, 3);
  const thematicAnchors = chooseThematicAnchors(tagCounts, 3);
  const queryGuards = chooseQueryGuards({
    protagonistPreference,
    tonePreference,
    intensityPreference,
    complexityPreference,
    relationshipPreference,
  }, tagCounts);

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
  };
}
