/** Per-player preferences, kept in this browser only. */
export interface Settings {
  volume: number;
  muted: boolean;
  /** Start runs running (2 tiles/tick) rather than walking. */
  run: boolean;
  showToasts: boolean;
  lowHpWarning: boolean;
  groundLabels: boolean;
  /** Auto-pickup when you walk over these. */
  autoPickup: { coins: boolean; arrows: boolean; runes: boolean };
  /** Prayers toggled together by the quick-prayer button / Q. */
  quickPrayers: string[];
  zoom: number;
  /** Offer "Autoplay to your best floor" when starting a run. */
  allowAutoplay: boolean;
  /** Soft gold glow around the screen edge on a level-up. */
  levelUpFlash: boolean;
  /** Spiders are drawn as harmless-looking brown blobs. */
  arachnophobia: boolean;
  /** Fight back automatically when attacked while idle or skilling. */
  autoRetaliate: boolean;
}

const KEY = 'tickbound.settings';

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.35,
  muted: false,
  run: true,
  showToasts: true,
  lowHpWarning: true,
  groundLabels: true,
  autoPickup: { coins: true, arrows: true, runes: true },
  quickPrayers: [],
  zoom: 1,
  allowAutoplay: true,
  levelUpFlash: true,
  arachnophobia: false,
  autoRetaliate: true,
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function load(): Settings {
  const raw = read(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed, autoPickup: { ...DEFAULT_SETTINGS.autoPickup, ...parsed.autoPickup } };
    } catch {
      // Corrupt settings: fall through to defaults.
    }
  }
  // First load since settings existed: carry over the old separate keys.
  return { ...DEFAULT_SETTINGS, muted: read('tickbound.muted') === '1', run: read('tickbound.run') !== '0' };
}

/** The live settings object; mutate it then call saveSettings(). */
export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not persisted (private mode etc.); the in-memory settings still apply.
  }
}
