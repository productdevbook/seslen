import { describe, expect, it } from "vitest"
import { createRegistry } from "../src/_registry.ts"

describe("createRegistry", () => {
  it("seeds from the initial map", () => {
    const r = createRegistry({ tick: "/a.mp3", error: "/b.mp3" })
    expect(r.resolve("tick")).toBe("/a.mp3")
    expect(r.resolve("error")).toBe("/b.mp3")
    expect(r.names().sort()).toEqual(["error", "tick"])
  })

  it("registers new sources at runtime", () => {
    const r = createRegistry()
    r.register("victory", "/z.mp3")
    expect(r.resolve("victory")).toBe("/z.mp3")
  })

  it("returns undefined for unknown names", () => {
    const r = createRegistry()
    expect(r.resolve("missing")).toBeUndefined()
  })
})
