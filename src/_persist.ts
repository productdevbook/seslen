/// <reference path="./env.d.ts" />

/**
 * Tiny `localStorage`-backed persistence for master volume + mute state.
 *
 * The stored shape is `{ "v": number, "m": 0 | 1 }`. We keep keys terse
 * to avoid bloating browser storage. SSR-safe: every method becomes a
 * no-op when `localStorage` is unavailable.
 */
export interface PersistedState {
  volume?: number
  muted?: boolean
}

export function createPersist(key: string | undefined): {
  load(): PersistedState
  save(state: PersistedState): void
} {
  const ls = typeof window !== "undefined" && window?.localStorage ? window.localStorage : null
  if (!key || !ls) {
    return {
      load: () => ({}),
      save: () => {},
    }
  }
  return {
    load() {
      try {
        const raw = ls.getItem(key)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as { v?: number; m?: number }
        const state: PersistedState = {}
        if (typeof parsed.v === "number") state.volume = parsed.v
        if (parsed.m === 0 || parsed.m === 1) state.muted = parsed.m === 1
        return state
      } catch {
        return {}
      }
    },
    save(state) {
      try {
        ls.setItem(
          key,
          JSON.stringify({
            v: state.volume,
            m: state.muted ? 1 : 0,
          }),
        )
      } catch {
        // quota exceeded / private mode — silent
      }
    },
  }
}
