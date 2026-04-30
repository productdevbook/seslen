// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createPersist } from "../src/_persist.ts"

beforeEach(() => {
  globalThis.localStorage.clear()
})
afterEach(() => {
  globalThis.localStorage.clear()
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
    globalThis.localStorage.setItem("seslen:test", "{not json")
    const p = createPersist("seslen:test")
    expect(p.load()).toEqual({})
  })
})
