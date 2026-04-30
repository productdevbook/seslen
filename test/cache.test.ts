import { describe, expect, it, vi } from "vitest"
import { createCache } from "../src/_cache.ts"

describe("createCache", () => {
  it("returns the same value across calls", async () => {
    const loader = vi.fn(async (k: string) => `value:${k}`)
    const cache = createCache(loader)
    expect(await cache.get("a")).toBe("value:a")
    expect(await cache.get("a")).toBe("value:a")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("dedupes concurrent in-flight calls (single-flight)", async () => {
    let resolveLoader!: (v: string) => void
    const loader = vi.fn(() => new Promise<string>((r) => (resolveLoader = r)))
    const cache = createCache(loader)

    const a = cache.get("k")
    const b = cache.get("k")
    resolveLoader("once")

    expect(await a).toBe("once")
    expect(await b).toBe("once")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("supports manual set + has + clear", async () => {
    const cache = createCache(async (_k: string) => "loaded")
    cache.set("x", "manual")
    expect(cache.has("x")).toBe(true)
    expect(await cache.get("x")).toBe("manual")
    cache.clear()
    expect(cache.has("x")).toBe(false)
  })
})
