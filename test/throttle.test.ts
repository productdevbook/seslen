import { describe, expect, it, vi } from "vitest"
import { createThrottle } from "../src/_throttle.ts"

describe("createThrottle", () => {
  it("admits the first call regardless of interval", () => {
    const t = createThrottle()
    expect(t.tryFire("tick", 100)).toBe(true)
  })

  it("drops calls inside the min-interval window", () => {
    vi.useFakeTimers()
    try {
      const t = createThrottle()
      expect(t.tryFire("tick", 50)).toBe(true)
      expect(t.tryFire("tick", 50)).toBe(false)
      vi.advanceTimersByTime(60)
      expect(t.tryFire("tick", 50)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("treats interval <= 0 as no throttling", () => {
    const t = createThrottle()
    for (let i = 0; i < 100; i++) expect(t.tryFire("tick", 0)).toBe(true)
  })

  it("tracks names independently", () => {
    const t = createThrottle()
    expect(t.tryFire("a", 1000)).toBe(true)
    expect(t.tryFire("b", 1000)).toBe(true)
    expect(t.tryFire("a", 1000)).toBe(false)
  })
})
