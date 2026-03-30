import type { TagCounts } from "./openLibraryFromTags";
import { buildFinalQueryKids } from "./openLibraryKids";
import { buildFinalQueryPreTeen } from "./openLibraryPreTeen";
import { buildFinalQueryTeen } from "./openLibraryTeen";
import { buildFinalQueryAdult } from "./openLibraryAdult";
import { buildIntentProfile } from "../recommenders/intent/buildIntentProfile";
import { buildQueryBrief } from "../recommenders/intent/buildQueryBrief";

export type BuildFinalQueryInput = {
  deckKey: string;
  tagCounts: TagCounts;
  tasteProfile?: {
    axes?: Record<string, number>;
    confidence?: number;
  };
};

function quoteIfNeeded(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^subject:/i.test(trimmed)) return trimmed;
  return trimmed.includes(" ") ? `subject:"${trimmed}"` : `subject:${trimmed}`;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = String(value || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(value).trim());
  }
  return out;
}

function buildBriefDrivenQuery(input: BuildFinalQueryInput): string {
  const intent = buildIntentProfile(input);
  const brief = buildQueryBrief(intent);

  const baseAudience =
    brief.audience === "kids"
      ? ['subject:"juvenile fiction"', 'subject:fiction']
      : brief.audience === "preteen"
        ? ['subject:"juvenile fiction"', 'subject:fiction']
        : brief.audience === "teen"
          ? ['subject:"young adult fiction"', 'subject:"juvenile fiction"', 'subject:fiction']
          : ['subject:fiction'];

  const anchors = [
    ...brief.genreAnchors.map(quoteIfNeeded),
    ...brief.thematicAnchors.map(quoteIfNeeded),
    quoteIfNeeded(brief.protagonistAnchor || ""),
    quoteIfNeeded(brief.toneAnchor || ""),
  ].filter(Boolean);

  const query = unique([...baseAudience, ...anchors]).slice(0, 6).join(" ").trim();

  if (query) return query;

  // Fallback to legacy per-band builders.
  if (input.deckKey === "k-2" || input.deckKey === "k2" || input.deckKey === "kids") return buildFinalQueryKids(input.tagCounts);
  if (input.deckKey === "3-6" || input.deckKey === "36") return buildFinalQueryPreTeen(input.tagCounts);
  if (
    input.deckKey === "ms-hs" ||
    input.deckKey === "ms_hs" ||
    input.deckKey === "mshs" ||
    input.deckKey === "teen" ||
    input.deckKey === "teens" ||
    input.deckKey === "teens_school"
  ) return buildFinalQueryTeen(input.tagCounts);
  if (input.deckKey === "adult") return buildFinalQueryAdult(input.tagCounts);
  return buildFinalQueryTeen(input.tagCounts);
}

export function buildFinalQueryForDeck(inputOrDeckKey: BuildFinalQueryInput | string, maybeTagCounts?: TagCounts): string {
  const input: BuildFinalQueryInput =
    typeof inputOrDeckKey === "string"
      ? { deckKey: inputOrDeckKey, tagCounts: maybeTagCounts || {} }
      : inputOrDeckKey;

  return buildBriefDrivenQuery(input);
}
