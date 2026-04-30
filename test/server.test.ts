import { describe, expect, it } from "vitest"
import { createSeslen } from "../src/server.ts"

describe("seslen/server (SSR stub)", () => {
  it("every method is a typed no-op", async () => {
    const ses = createSeslen()
    const handle = await ses.play("anything")
    expect(handle!.done).toBe(true)
    handle!.stop() // does nothing, must not throw

    expect(ses.isReady()).toBe(false)
    expect(ses.state()).toBe("idle")

    await ses.preload("anything")
    const pat = await ses.playPattern([{ id: "anything" }])
    expect(pat.done).toBe(true)
    ses.stopAll()
    expect(ses.stop("anything")).toBe(0)

    // Registry stubs
    ses.register("foo", "/foo.mp3")
    expect(ses.has("foo")).toBe(false) // SSR stub: no-op
    expect(ses.unregister("foo")).toBe(false)
    expect(ses.names()).toEqual([])

    // Master controls
    expect(ses.getVolume()).toBe(1)
    ses.setVolume(0.5)
    ses.mute()
    expect(ses.isMuted()).toBe(false) // SSR stub: no-op
    ses.unmute()

    // Events
    const off = ses.on("play", () => {})
    off()
    ses.off("play", () => {})

    // Lifecycle
    await ses.pause()
    await ses.resume()
    await ses.close()

    // Handle metadata
    const h2 = await ses.play("anything")
    expect(h2!.duration).toBeNull()
    let fired = false
    h2!.onEnded(() => {
      fired = true
    })
    expect(fired).toBe(true) // SSR stub is "already done"
  })
})
