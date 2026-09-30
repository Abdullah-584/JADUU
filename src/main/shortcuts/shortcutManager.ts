/** Global shortcut registration with safe rebind + failure reporting. */
import { globalShortcut } from "electron";
import { logger, safeError } from "../logger";

const log = logger("shortcuts");

export interface ShortcutActions {
  onQuickAssistant: () => void;
}

export class ShortcutManager {
  private current: string | null = null;

  register(accelerator: string, actions: ShortcutActions): { ok: boolean; error: string | null } {
    this.unregisterAll();
    try {
      const ok = globalShortcut.register(accelerator, () => actions.onQuickAssistant());
      if (!ok) {
        log.warn(`failed to register ${accelerator} (probably in use by another app)`);
        return { ok: false, error: `The shortcut ${accelerator} is already in use by another application.` };
      }
      this.current = accelerator;
      log.info(`registered ${accelerator}`);
      return { ok: true, error: null };
    } catch (err) {
      const msg = safeError(err);
      log.error(`shortcut registration failed: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  unregisterAll(): void {
    if (this.current) {
      try {
        globalShortcut.unregister(this.current);
      } catch {
        /* ignore */
      }
      this.current = null;
    }
  }

  getCurrent(): string | null {
    return this.current;
  }
}
