import { describe, expect, it } from "vitest"
import { version, isBrowser, SeslenError } from "../src/index.ts"

describe("seslen", () => {
  it("exposes a version string", () => {
    expect(typeof version).toBe("string")
    expect(version.length).toBeGreaterThan(0)
  })

  it("detects non-browser runtime", () => {
    expect(isBrowser()).toBe(false)
  })

  it("exports SeslenError", () => {
    const err = new SeslenError("boom")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("SeslenError")
  })
})
