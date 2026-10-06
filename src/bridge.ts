import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import type { Note } from "./types";

/**
 * The one place the UI touches its host. On Linux that's Tauri; on macOS
 * it's the native Swift app (macos/), which injects the note and a message
 * handler into the page before it loads.
 */

type Listener = (payload?: unknown) => void;

interface NativeHandler {
  postMessage(message: unknown): Promise<unknown>;
}

declare global {
  interface Window {
    __JOTTER_PLATFORM__?: "macos";
    __NOTE__?: Note | null;
    __jotter?: { emit: (name: string, payload?: unknown) => void };
    webkit?: { messageHandlers?: { bridge?: NativeHandler } };
  }
}

export const platform: "macos" | "linux" = window.__JOTTER_PLATFORM__ === "macos" ? "macos" : "linux";
export const isMac = platform === "macos";

document.documentElement.dataset.platform = platform;

export function invoke<T = unknown>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isMac) return tauriInvoke<T>(cmd, args);
  const handler = window.webkit?.messageHandlers?.bridge;
  if (!handler) return Promise.reject(new Error("native bridge unavailable"));
  return handler.postMessage({ cmd, args }) as Promise<T>;
}

export function loadNote(): Promise<Note | null> {
  if (isMac) return Promise.resolve(window.__NOTE__ ?? null);
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return Promise.resolve(null);
  return invoke<Note | null>("get_note", { id });
}

/** Windows are created hidden so they never flash empty; this reveals them. */
export function notifyReady(): Promise<unknown> {
  return isMac ? invoke("ready") : getCurrentWindow().show();
}

export function openUrl(url: string): Promise<unknown> {
  return isMac ? invoke("open_url", { url }) : tauriOpenUrl(url);
}

// Events pushed from the macOS app's menu bar (colors, float on top, undo...).
const listeners = new Map<string, Set<Listener>>();

window.__jotter = {
  emit(name, payload) {
    listeners.get(name)?.forEach((listener) => listener(payload));
  },
};

export function listen(name: string, listener: Listener): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}
