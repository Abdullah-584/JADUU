import type { JaduuBridge } from "../preload/index";

declare global {
  interface Window {
    jaduu: JaduuBridge;
  }
}

export {};
