import { describe, expect, it, vi } from "vitest"
import { createVoices } from "../src/_voices.ts"
import type { PlayHandle } from "../src/_types.ts"

function fakeHandle(): PlayHandle {
  return {
    stop: vi.fn(),
    get done() {
      return false
    },
    get duration() {
      return null
    },
    onEnded() {},
  }
}

describe("createVoices", () => {
  it("admits voices below the per-name cap", () => {
    const v = createVoices()
    expect(v.request("tick", 2, "oldest")).toBe("ok")
    v.add("tick", fakeHandle())
    expect(v.request("tick", 2, "oldest")).toBe("ok")
    v.add("tick", fakeHandle())
  })

  it("steals the oldest voice when the cap is hit", () => {
    const v = createVoices()
    const a = fakeHandle()
    const b = fakeHandle()
    v.request("tick", 2, "oldest")
    v.add("tick", a)
    v.request("tick", 2, "oldest")
    v.add("tick", b)
    // Third request — caps at 2, oldest (a) should be stopped.
    expect(v.request("tick", 2, "oldest")).toBe("ok")
    expect(a.stop).toHaveBeenCalled()
    expect(b.stop).not.toHaveBeenCalled()
  })

  it("drops the new voice with steal: drop", () => {
    const v = createVoices()
    v.request("tick", 1, "drop")
    v.add("tick", fakeHandle())
    expect(v.request("tick", 1, "drop")).toBe("dropped")
  })

  it("global cap fires across sources", () => {
    const v = createVoices(2)
    v.request("tick", undefined, "oldest")
    v.add("tick", fakeHandle())
    v.request("error", undefined, "oldest")
    v.add("error", fakeHandle())
    expect(v.total()).toBe(2)
    expect(v.request("victory", undefined, "drop")).toBe("dropped")
  })
})
