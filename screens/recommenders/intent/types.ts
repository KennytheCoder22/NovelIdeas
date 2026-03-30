export type AudienceBand = "kids" | "preteen" | "teen" | "adult";

export type StoryMode =
  | "character_driven"
  | "plot_driven"
  | "mystery_driven"
  | "idea_driven"
  | "relationship_driven";

export type ProtagonistPreference =
  | "heroic"
  | "sympathetic"
  | "flawed_but_rootable"
  | "morally_mixed_tolerant"
  | "antihero_tolerant"
  | "antihero_averse";

export type TonePreference =
  | "warm"
  | "hopeful"
  | "balanced"
  | "dark"
  | "bleak_averse"
  | "playful"
  | "weird_tolerant";

export type IntensityPreference =
  | "gentle"
  | "moderate"
  | "tense"
  | "intense"
  | "extreme_averse";

export type ComplexityPreference =
  | "accessible"
  | "layered"
  | "complex"
  | "confusing_averse";

export type RelationshipPreference =
  | "healthy_connection"
  | "messy_but_rootable"
  | "toxic_averse";

export type FormatBias = "prose" | "visual" | "mixed";

export type QueryGuard =
  | "avoid_antihero"
  | "avoid_bleak"
  | "avoid_toxic_relationships"
  | "avoid_extreme_violence"
  | "avoid_confusing_structure"
  | "avoid_hopelessness";

export type IntentProfile = {
  audience: AudienceBand;
  storyMode?: StoryMode;
  protagonistPreference?: ProtagonistPreference;
  tonePreference?: TonePreference;
  intensityPreference?: IntensityPreference;
  complexityPreference?: ComplexityPreference;
  relationshipPreference?: RelationshipPreference;
  formatBias?: FormatBias;
  genreAnchors: string[];
  thematicAnchors: string[];
  queryGuards: QueryGuard[];
  retrievalConfidence: number;
};

export type QueryBrief = {
  audience: AudienceBand;
  genreAnchors: string[];
  thematicAnchors: string[];
  protagonistAnchor?: string;
  toneAnchor?: string;
  formatBias?: FormatBias;
  queryGuards: QueryGuard[];
  confidence: number;
};
