// /screens/swipe/openLibraryTeen.ts
//
// Teen (MS/HS) band query shaping + guardrail keywords.
// NOTE: "OpenLibrary" naming is legacy; we are building Google Books queries.

import type { TagCounts } from "./openLibraryFromTags";
import { buildSwipeTermsQueryFromTagCounts } from "./openLibraryFromTags";
import { coreTagToKeywords, normalizeToken } from "./openLibraryCore";

function normalizeTokenLocal(s: string) {
  return normalizeToken(s);
}

export function tagToKeywordsTeen(tag: string): string[] {
  const [rawKey, rawVal] = tag.split(":");
  const key = (rawKey || "").trim();
  const val = normalizeTokenLocal((rawVal || "").trim());

  if (!key || !val) return [];

  if (key === "topic" && val === "manga") {
    return [
      'subject:"manga"',
      'subject:"graphic novels"',
      'subject:"comics"',
      "manga",
      '"graphic novel"',
      "comic",
    ];
  }

  if (key === "format" && (val === "graphic novel" || val === "graphic_novel")) {
    return [
      'subject:"graphic novels"',
      'subject:"comics"',
      '"graphic novel"',
      "comic",
    ];
  }

  if (key === "media" && val === "anime") {
    return [
      'subject:"manga"',
      'subject:"graphic novels"',
      'subject:"comics"',
      "manga",
      '"graphic novel"',
      "comic",
    ];
  }

  return coreTagToKeywords(tag);
}

function stripAgeMarkers(tagCounts: TagCounts): TagCounts {
  const out: TagCounts = {};
  for (const [k, v] of Object.entries(tagCounts || {})) {
    if (
      k.startsWith("age:") ||
      k.startsWith("audience:") ||
      k.startsWith("ageBand:") ||
      k.startsWith("band:")
    ) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function buildFinalQueryTeen(tagCounts: TagCounts): string {
  const guardrail = 'subject:fiction subject:"Young Adult Fiction"';
  const cleaned = stripAgeMarkers(tagCounts);

  const swipeTermsRaw = buildSwipeTermsQueryFromTagCounts(cleaned, tagToKeywordsTeen).trim();

  let swipeTerms = swipeTermsRaw;

  if (swipeTerms.includes("epic") && swipeTerms.includes("fantasy")) {
    swipeTerms = swipeTerms.replace(/\bepic\b/g, "").replace(/\bfantasy\b/g, "").trim();
    swipeTerms = `"epic fantasy" ${swipeTerms}`.trim();
  }

  if (swipeTerms.includes("found family")) {
    swipeTerms = swipeTerms.replace(/\bfound family\b/g, '"found family"');
  }

  const teenThemeExpansion = ['"coming of age"', "identity", "friendship", "relationships"].join(" ");

  const mangaWeight =
    Number(cleaned["topic:manga"] || 0) +
    Number(cleaned["media:anime"] || 0) +
    Number(cleaned["format:graphic_novel"] || 0) +
    Number(cleaned["format:graphic novel"] || 0);

  const teenFormatExpansion =
    mangaWeight >= 4
      ? [
          'subject:"manga"',
          'subject:"graphic novels"',
          'subject:"comics"',
          "manga",
          '"graphic novel"',
          "comic",
        ].join(" ")
      : [
          'subject:"manga"',
          'subject:"graphic novels"',
          'subject:"comics"',
          '"graphic novel"',
          "manga",
        ].join(" ");

  const proseGuardrail = mangaWeight >= 4 ? "subject:fiction" : guardrail;

  const fallbackBlock =
    mangaWeight >= 4
      ? ""
      : mangaWeight >= 2
        ? 'OR subject:fiction subject:"young adult fiction"'
        : 'OR subject:"young adult fiction" subject:"juvenile fiction" subject:fiction subject:"adventure" subject:"fantasy"';

  if (mangaWeight >= 4) {
    return swipeTerms
      ? `${teenFormatExpansion} ${swipeTerms} ${teenThemeExpansion} OR subject:fiction OR ${swipeTerms}`.trim()
      : `${teenFormatExpansion} ${teenThemeExpansion} OR subject:fiction`.trim();
  }

  return swipeTerms
    ? `${proseGuardrail} ${swipeTerms} ${teenThemeExpansion} ${fallbackBlock} OR subject:fiction ${teenFormatExpansion}`.trim()
    : `${proseGuardrail} ${teenThemeExpansion} ${fallbackBlock} OR subject:fiction OR ${teenFormatExpansion}`.trim();
}
