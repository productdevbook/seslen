import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createPersist } from "../src/_persist.ts"

/**
 * Tiny in-memory localStorage shim. Avoids depending on jsdom: vitest 4
 * + Node 22 would not always populate `window.localStorage.clear` on
 * the global path, so installing our own keeps the test stable.
 */
function installStorage(): { reset: () => void; uninstall: () => void } {
  const map = new Map<string, string>()
  const storage = {
    getItem: (k: string): string | null => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string): void => {
      map.set(k, String(v))
    },
    removeItem: (k: string): void => {
      map.delete(k)
    },
    clear: (): void => {
      map.clear()
    },
  }
  const g = globalThis as { window?: { localStorage?: unknown } }
  const prevWindow = g.window
  g.window = { ...(prevWindow ?? {}), localStorage: storage } as { localStorage: unknown }
  return {
    reset: () => map.clear(),
    uninstall: () => {
      g.window = prevWindow
    },
  }
}

let store: ReturnType<typeof installStorage>

beforeEach(() => {
  store = installStorage()
})
afterEach(() => {
  store.uninstall()
})

describe("createPersist", () => {
  it("returns empty state when key is undefined", () => {
    const p = createPersist(undefined)
    p.save({ volume: 0.5, muted: true })
    expect(p.load()).toEqual({})
  })

  it("round-trips volume + muted through localStorage", () => {
    const p = createPersist("seslen:test")
    p.save({ volume: 0.42, muted: true })
    const loaded = p.load()
    expect(loaded.volume).toBeCloseTo(0.42)
    expect(loaded.muted).toBe(true)
  })

  it("ignores corrupt JSON", () => {
    ;(
      globalThis as { window?: { localStorage?: { setItem: (k: string, v: string) => void } } }
    ).window!.localStorage!.setItem("seslen:test", "{not json")
    const p = createPersist("seslen:test")
    expect(p.load()).toEqual({})
  })
})
