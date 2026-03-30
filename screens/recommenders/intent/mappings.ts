export const GENRE_TO_ANCHOR: Record<string, string> = {
  "genre:fantasy": "fantasy",
  "genre:science_fiction": "science fiction",
  "genre:mystery": "mystery",
  "genre:crime": "crime",
  "genre:romance": "romance",
  "genre:dystopian": "dystopian",
  "genre:horror": "horror",
  "genre:historical_fiction": "historical fiction",
  "genre:adventure": "adventure",
  "genre:thriller": "thriller",
  "genre:paranormal": "paranormal",
  "genre:superheroes": "superheroes",
  "genre:sports": "sports",
  "genre:comedy": "comedy",
  "genre:realistic_fiction": "realistic fiction",
  "genre:mythology": "mythology",
};

export const THEMATIC_ANCHOR_MAP: Record<string, string> = {
  "theme:friendship": "friendship",
  "theme:belonging": "found family",
  "theme:coming_of_age": "coming of age",
  "theme:survival": "survival",
  "theme:rebellion": "rebellion",
  "theme:identity": "identity",
  "genre:mystery": "mystery",
  "theme:magic": "magic",
  "theme:power": "power struggle",
  "genre:romance": "romance",
  "theme:justice": "justice",
  "genre:adventure": "adventure",
  "archetype:exploration": "exploration",
  "theme:family": "family",
  "genre:mythology": "mythology",
  "archetype:competition": "competition",
};

export const STORY_MODE_SIGNALS = {
  character_driven: {
    positive: [
      "character driven",
      "relationship driven",
      "human connection",
      "coming of age",
      "interpersonal drama",
      "love",
      "friendship",
    ],
  },
  plot_driven: {
    positive: [
      "adventure",
      "quest",
      "survival",
      "heist",
      "rebellion",
      "escape",
      "power struggle",
    ],
  },
  mystery_driven: {
    positive: [
      "mystery",
      "investigation",
      "detective",
      "secrets",
      "conspiracy",
      "hidden past reveal",
    ],
  },
  idea_driven: {
    positive: [
      "science problem solving",
      "artificial intelligence",
      "identity split",
      "multiverse",
      "philosophical",
      "thoughtful",
      "concept over character",
    ],
  },
  relationship_driven: {
    positive: [
      "romance",
      "family",
      "friendship",
      "courtship drama",
      "on off relationship arc",
      "relationship unraveling",
    ],
  },
} as const;

export const PROTAGONIST_SIGNALS = {
  heroic: {
    positive: [
      "heroic lead",
      "heroic",
      "resilient protagonist",
      "protective parent",
      "mentor figures",
      "truth seeking reporters",
      "admirable lead",
    ],
  },
  sympathetic: {
    positive: [
      "sympathetic protagonist",
      "gentle caretaker",
      "lovable misfits",
      "quiet protagonist",
      "outsider protagonist",
      "resourceful protagonist",
    ],
  },
  flawed_but_rootable: {
    positive: [
      "flawed lovers",
      "damaged protagonist",
      "wounded protagonist",
      "gifted outsider",
      "haunted expert",
      "messy team",
    ],
  },
  morally_mixed_tolerant: {
    positive: [
      "morally mixed cast",
      "double life couple",
      "complicated women",
      "obsessive rivals",
    ],
  },
  antihero_tolerant: {
    positive: [
      "antihero lead",
      "morally compromised protagonist",
      "charismatic hustler",
      "double agent",
    ],
  },
  antihero_averse: {
    negativeTriggers: [
      "antihero lead",
      "morally compromised protagonist",
      "unlikable protagonist",
      "glamorized wrongdoing",
      "empathy resistance",
      "ethical decline",
    ],
  },
} as const;

export const TONE_SIGNALS = {
  warm: ["warm", "cozy", "gentle", "tender", "kindness", "belonging", "community"],
  hopeful: ["hopeful", "uplifting", "resilience", "redemption", "encouraging"],
  balanced: ["serious", "human", "earnest", "measured", "thoughtful"],
  dark: ["dark", "brooding", "grim", "haunting", "melancholic", "somber"],
  bleak_averse: ["bleakness", "hopelessness", "nihilism", "emotional devastation"],
  playful: ["playful", "funny", "quirky", "whimsical", "silly"],
  weird_tolerant: ["weird", "strange", "mind bending", "metaphysical horror", "awe struck"],
} as const;

export const INTENSITY_SIGNALS = {
  gentle: ["calm", "gentle", "cozy", "quiet pacing", "soft transformation"],
  moderate: ["thoughtful", "balanced", "human", "measured"],
  tense: ["tense", "suspense", "mystery", "investigation", "pursuit", "cat and mouse"],
  intense: ["grim", "furious", "adrenalized", "war escalation", "survival pressure", "chaotic"],
  extreme_averse: ["graphic violence", "war brutality", "body horror", "fear intensity", "stress level", "sensory overload"],
} as const;

export const COMPLEXITY_SIGNALS = {
  accessible: ["concise", "clear", "fast", "simple", "direct"],
  layered: ["thoughtful", "nonlinear connections", "nested stories", "identity search", "literary investigation"],
  complex: ["complexity", "structural complexity", "time loop puzzle", "layered mission", "reality uncertainty"],
  confusing_averse: ["confusing structure", "fragmented timeline", "ambiguity", "structural complexity"],
} as const;

export const RELATIONSHIP_SIGNALS = {
  healthy_connection: ["friendship", "human connection", "found family", "belonging", "devoted lovers"],
  messy_but_rootable: ["flawed lovers", "on off relationship arc", "class difference", "emotionally inarticulate lovers"],
  toxic_averse: ["toxicity", "toxic relationships", "domestic toxicity", "manipulation", "marital cat and mouse"],
} as const;

export const FORMAT_SIGNAL_WEIGHTS = {
  visual: [
    "topic:manga",
    "media:anime",
    "format:graphic_novel",
    "format:graphic novel",
    "genre:superheroes",
  ],
  prose: [
    "genre:literary_fiction",
    "format:chapter_book",
    "genre:realistic_fiction",
    "genre:historical_fiction",
  ],
} as const;

export const QUERY_GUARD_WEIGHTS = {
  avoid_antihero: ["antihero lead", "morally compromised protagonist", "glamorized wrongdoing"],
  avoid_bleak: ["bleakness", "nihilism", "bleak worldview"],
  avoid_toxic_relationships: ["toxicity", "toxic relationships", "domestic toxicity"],
  avoid_extreme_violence: ["graphic violence", "war brutality", "body horror"],
  avoid_confusing_structure: ["confusing structure", "fragmented timeline", "ambiguity"],
  avoid_hopelessness: ["hopelessness", "emotional devastation"],
} as const;
