import { Platform } from "react-native";
import configFile from "../NovelIdeas.json";
import SwipeDeckScreen from "../screens/SwipeDeckScreen";

type DeckKey = "k2" | "36" | "ms_hs" | "adult";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function syncSchema(cfg: any) {
  if (!cfg || typeof cfg !== "object") return cfg;

  cfg.enabledDecks = (cfg.enabledDecks && typeof cfg.enabledDecks === "object") ? cfg.enabledDecks : {};
  cfg.decks = (cfg.decks && typeof cfg.decks === "object") ? cfg.decks : {};
  cfg.decks.enabled = (cfg.decks.enabled && typeof cfg.decks.enabled === "object") ? cfg.decks.enabled : {};

  const deckKeys: DeckKey[] = ["k2", "36", "ms_hs", "adult"];
  for (const k of deckKeys) {
    const canonVal = cfg.enabledDecks?.[k];
    const legacyVal = cfg.decks?.enabled?.[k];

    let v: boolean;
    if (typeof canonVal === "boolean") v = canonVal;
    else if (typeof legacyVal === "boolean") v = legacyVal;
    else v = true;

    cfg.enabledDecks[k] = v;
    cfg.decks.enabled[k] = v;
  }

  cfg.swipe = (cfg.swipe && typeof cfg.swipe === "object") ? cfg.swipe : {};
  cfg.swipe.categoriesEnabled =
    (cfg.swipe.categoriesEnabled && typeof cfg.swipe.categoriesEnabled === "object")
      ? cfg.swipe.categoriesEnabled
      : {};

  return cfg;
}

function loadRuntimeConfig() {
  const base = deepClone(configFile);
  syncSchema(base);

  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("novelideas_admin_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return syncSchema(parsed);
      }
    }
  } catch {}

  return base;
}

export default function Swipe() {
  const config = loadRuntimeConfig();

  return (
    <SwipeDeckScreen
      enabledDecks={config?.enabledDecks ?? config?.decks?.enabled}
      swipeCategories={config?.swipe?.categoriesEnabled}
    />
  );
}
