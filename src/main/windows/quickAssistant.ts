/** Floating Quick Assistant window (global-shortcut summon). */
import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { QUICK_ASSISTANT_HEIGHT, QUICK_ASSISTANT_WIDTH } from "@shared/constants";

export function createQuickAssistant(): BrowserWindow {
  const win = new BrowserWindow({
    width: QUICK_ASSISTANT_WIDTH,
    height: QUICK_ASSISTANT_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: "#14121f",
    title: "JADUU Quick Assistant",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");

  const load = process.env.VITE_DEV_SERVER_URL
    ? Promise.resolve(win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/quick`))
    : win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash: "/quick" });
  void load;

  return win;
}

/** Centers the window on the cursor's display, near the top. */
export function positionQuickAssistant(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width } = display.workArea;
  const left = x + Math.round((width - QUICK_ASSISTANT_WIDTH) / 2);
  const top = y + Math.round(80);
  win.setPosition(left, top);
}
