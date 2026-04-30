import { describe, expect, it } from "vitest"
import { presetEntries, presets, presetTags } from "../src/presets/index.ts"

describe("seslen/presets", () => {
  it("exports the core preset names", () => {
    const required = ["tick", "success", "error", "warning", "message", "add", "delete", "victory"]
    const all = presets as Record<string, unknown>
    for (const name of required) {
      expect(presetEntries[name]).toBeDefined()
      expect(all[name]).toBeDefined()
    }
  })

  it("every preset is a synthesised SoundFactory", () => {
    for (const value of Object.values(presets)) {
      expect(typeof value).toBe("function")
    }
  })

  it("every entry carries metadata", () => {
    for (const entry of Object.values(presetEntries)) {
      expect(entry.id).toBeTypeOf("string")
      expect(entry.label).toBeTypeOf("string")
      expect(entry.description).toBeTypeOf("string")
      expect(entry.recipe).toBeTypeOf("string")
      expect(Array.isArray(entry.tags)).toBe(true)
      expect(entry.tags.length).toBeGreaterThan(0)
    }
  })

  it("entry.id matches its registry key", () => {
    for (const [key, entry] of Object.entries(presetEntries)) {
      expect(entry.id).toBe(key)
    }
  })

  it("presetTags is the deduplicated, sorted union of all tags", () => {
    const expected = Array.from(new Set(Object.values(presetEntries).flatMap((p) => p.tags))).sort()
    expect(presetTags).toEqual(expected)
  })
})
