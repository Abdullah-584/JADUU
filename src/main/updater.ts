/** Optional auto-update via GitHub Releases (electron-updater). Disabled in dev. */
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { logger, safeError } from "./logger";

const log = logger("updater");

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    log.info("auto-update disabled in development");
    return;
  }
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => log.info("checking for update"));
    autoUpdater.on("update-available", (info) => log.info(`update available: ${info.version}`));
    autoUpdater.on("update-not-available", () => log.info("no update available"));
    autoUpdater.on("error", (err) => log.warn(`update error: ${safeError(err)}`));
    autoUpdater.on("download-progress", (p) => {
      if (Math.round(p.percent) % 25 === 0) log.info(`downloading: ${Math.round(p.percent)}%`);
    });
    autoUpdater.on("update-downloaded", (info) => log.info(`update downloaded: ${info.version} (installs on quit)`));

    // First check shortly after launch, then every 4 hours.
    setTimeout(() => void autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn(safeError(e))), 30_000);
    setInterval(() => void autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn(safeError(e))), 4 * 60 * 60 * 1000);
  } catch (err) {
    log.warn(`updater init failed: ${safeError(err)}`);
  }
}
