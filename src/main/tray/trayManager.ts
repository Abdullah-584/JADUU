/** System tray (Windows) / menu bar (macOS) manager. */
import { app, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import fs from "node:fs";

export interface TrayActions {
  onOpen: () => void;
  onNewChat: () => void;
  onQuickAssistant: () => void;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;

  create(actions: TrayActions): Tray | null {
    try {
      const iconPath = this.resolveIconPath();
      if (!iconPath) {
        console.warn("[tray] icon not found; tray disabled");
        return null;
      }
      const icon = nativeImage.createFromPath(iconPath);
      this.tray = new Tray(icon);
      this.tray.setToolTip("JADUU — private AI companion");

      this.rebuildMenu({ online: false, model: null, actions });

      this.tray.on("click", () => actions.onOpen());
      return this.tray;
    } catch (err) {
      console.warn("[tray] failed to create tray:", err);
      return null;
    }
  }

  private resolveIconPath(): string | null {
    const candidates =
      process.platform === "darwin"
        ? ["trayTemplate.png", "tray.png"]
        : ["tray.png"];
    for (const candidate of candidates) {
      const p = path.join(__dirname, "../../assets", candidate);
      if (fs.existsSync(p)) return p;
    }
    // Fallback: repo-root assets during dev
    for (const candidate of candidates) {
      const p = path.join(process.cwd(), "assets", candidate);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  rebuildMenu(status: { online: boolean; model: string | null; actions: TrayActions }): void {
    if (!this.tray) return;
    const menu = Menu.buildFromTemplate([
      { label: "JADUU", enabled: false },
      { type: "separator" },
      { label: "Open JADUU", click: () => status.actions.onOpen() },
      { label: "New Chat", click: () => status.actions.onNewChat() },
      { label: "Quick Assistant", click: () => status.actions.onQuickAssistant() },
      { type: "separator" },
      {
        label: status.online ? `● Ollama Connected${status.model ? ` — ${status.model}` : ""}` : "○ Ollama Offline",
        enabled: false,
      },
      { type: "separator" },
      { label: "Quit", click: () => status.actions.onQuit() },
    ]);
    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    try {
      this.tray?.destroy();
    } catch {
      /* ignore */
    }
    this.tray = null;
  }
}

export function markTrayReady(): void {
  // Placeholder for future dynamic-icon states; menu already conveys status.
  void app;
}
