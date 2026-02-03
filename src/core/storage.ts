import type { Tournament } from "./types";

const KEY = "holoocg_live_tournament_v1";

export function loadLive(): Tournament | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tournament) : null;
  } catch {
    return null;
  }
}

export function saveLive(t: Tournament) {
  localStorage.setItem(KEY, JSON.stringify(t));
}

export function clearLive() {
  localStorage.removeItem(KEY);
}
