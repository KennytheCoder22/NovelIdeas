import type { FormatBias, IntentProfile, QueryBrief } from "./types";

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

export function buildQueryBrief(intent: IntentProfile): QueryBrief {
  return {
    audience: intent.audience,
    genreAnchors: intent.genreAnchors.slice(0, 3),
    thematicAnchors: intent.thematicAnchors.slice(0, 3),
    protagonistAnchor: protagonistToQueryAnchor(intent.protagonistPreference),
    toneAnchor: toneToQueryAnchor(intent.tonePreference),
    formatBias: intent.formatBias as FormatBias | undefined,
    queryGuards: intent.queryGuards.slice(0, 2),
    confidence: intent.retrievalConfidence,
  };
}
