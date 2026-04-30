import { describe, expect, it, vi } from "vitest"
import { applyJitter, mergeDefaults } from "../src/_jitter.ts"

describe("applyJitter", () => {
  it("returns the input unchanged when no jitter is set", () => {
    const opts = { gain: 0.5, rate: 1, detune: 0 }
    expect(applyJitter(opts, undefined)).toBe(opts)
  })

  it("varies rate within ±jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(1) // pushes to +max
    const out = applyJitter({ rate: 1, rateJitter: 0.1 }, undefined)
    expect(out.rate).toBeCloseTo(1.1, 5)
    vi.restoreAllMocks()
  })

  it("clamps gain to 0..1 even with extreme jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0) // pushes to -max
    const out = applyJitter({ gain: 1, gainJitter: 0.5 }, undefined)
    expect(out.gain).toBeGreaterThanOrEqual(0)
    expect(out.gain).toBeLessThanOrEqual(1)
    vi.restoreAllMocks()
  })

  it("falls back to source defaults when option is omitted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5) // mid → no shift
    const out = applyJitter({}, { rate: 2, rateJitter: 0.1 })
    expect(out.rate).toBeCloseTo(2, 5)
    vi.restoreAllMocks()
  })
})

describe("mergeDefaults", () => {
  it("does not overwrite caller-set fields", () => {
    const out = mergeDefaults({ gain: 0.5 }, { gain: 0.9, rate: 1.5 })
    expect(out.gain).toBe(0.5)
    expect(out.rate).toBe(1.5)
  })

  it("returns input untouched when no defaults", () => {
    const opts = { gain: 0.5 }
    expect(mergeDefaults(opts, undefined)).toBe(opts)
  })
})
