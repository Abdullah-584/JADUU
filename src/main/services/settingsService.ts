/** Settings service: DB-backed key/value store merged over defaults. */
import type { AppSettings } from "@shared/types";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@shared/constants";
import type { SettingsRepository } from "../database/repositories/files";
import { logger, safeError } from "../logger";

const log = logger("settings");

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {
    // Mark onboarding as not-done for fresh installs (only if key absent).
    if (this.repo.get(STORAGE_KEYS.ONBOARDED) === null) {
      this.repo.set(STORAGE_KEYS.ONBOARDED, "false");
    }
  }

  getAll(): AppSettings {
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    try {
      const raw = this.repo.get("app.settings");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        Object.assign(settings, parsed);
      }
    } catch (err) {
      log.warn(`failed to parse settings: ${safeError(err)}`);
    }
    return settings;
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const current = this.getAll();
    const next = { ...current, ...patch };
    this.repo.set("app.settings", JSON.stringify(next));
    return next;
  }

  getFlag(key: string): string | null {
    return this.repo.get(key);
  }

  setFlag(key: string, value: string): void {
    this.repo.set(key, value);
  }
}
