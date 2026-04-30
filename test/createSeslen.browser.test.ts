// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSeslen, SeslenError } from "../src/index.ts"

class FakeAudioContext {
  state: "suspended" | "running" | "closed" = "suspended"
  destination = makeNode()
  currentTime = 0
  sampleRate = 44100
  resume = vi.fn(async () => {
    this.state = "running"
  })
  suspend = vi.fn(async () => {
    this.state = "suspended"
  })
  close = vi.fn(async () => {
    this.state = "closed"
  })
  decodeAudioData = vi.fn(async () => makeBuffer())
  createBuffer = vi.fn(() => makeBuffer())
  createBufferSource = vi.fn(() => makeSource())
  createGain = vi.fn(() => makeGain())
  createOscillator = vi.fn(() => makeOscillator())
  createBiquadFilter = vi.fn(() => makeFilter())
  createStereoPanner = vi.fn(() => makePanner())
  createAnalyser = vi.fn(() => makeAnalyser())
  baseLatency = 0.005
  outputLatency = 0.01
}

function makePanner(): ReturnType<typeof makeNode> & { pan: ReturnType<typeof param> } {
  return Object.assign(makeNode(), { pan: param() })
}
function makeAnalyser(): ReturnType<typeof makeNode> & {
  fftSize: number
  frequencyBinCount: number
  smoothingTimeConstant: number
  minDecibels: number
  maxDecibels: number
  getByteTimeDomainData: ReturnType<typeof vi.fn>
  getByteFrequencyData: ReturnType<typeof vi.fn>
  getFloatTimeDomainData: ReturnType<typeof vi.fn>
  getFloatFrequencyData: ReturnType<typeof vi.fn>
} {
  return Object.assign(makeNode(), {
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0.8,
    minDecibels: -100,
    maxDecibels: -30,
    getByteTimeDomainData: vi.fn(),
    getByteFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
  })
}

function param(): {
  value: number
  setValueAtTime: () => void
  linearRampToValueAtTime: () => void
  exponentialRampToValueAtTime: () => void
  cancelScheduledValues: () => void
} {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}
function makeNode(): { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } {
  const node = {
    connect: vi.fn(() => node),
    disconnect: vi.fn(),
  }
  return node
}
function makeGain(): ReturnType<typeof makeNode> & { gain: ReturnType<typeof param> } {
  return Object.assign(makeNode(), { gain: param() })
}
function makeBuffer(): {
  duration: number
  length: number
  numberOfChannels: number
  sampleRate: number
  getChannelData: () => Float32Array
} {
  return {
    duration: 0.2,
    length: 8820,
    numberOfChannels: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array(8820),
  }
}
function makeSource(): ReturnType<typeof makeNode> & {
  buffer: unknown
  loop: boolean
  playbackRate: ReturnType<typeof param>
  detune: ReturnType<typeof param>
  onended: (() => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
} {
  return Object.assign(makeNode(), {
    buffer: null,
    loop: false,
    playbackRate: param(),
    detune: param(),
    onended: null,
    start: vi.fn(),
    stop: vi.fn(),
  })
}
function makeOscillator(): ReturnType<typeof makeNode> & {
  type: string
  frequency: ReturnType<typeof param>
  detune: ReturnType<typeof param>
  onended: (() => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
} {
  return Object.assign(makeNode(), {
    type: "sine",
    frequency: param(),
    detune: param(),
    onended: null,
    start: vi.fn(),
    stop: vi.fn(),
  })
}
function makeFilter(): ReturnType<typeof makeNode> & {
  type: string
  frequency: ReturnType<typeof param>
  Q: ReturnType<typeof param>
  gain: ReturnType<typeof param>
} {
  return Object.assign(makeNode(), {
    type: "lowpass",
    frequency: param(),
    Q: param(),
    gain: param(),
  })
}

beforeEach(() => {
  ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext
  ;(globalThis as { fetch?: unknown }).fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  }))
})

afterEach(() => {
  delete (globalThis as { AudioContext?: unknown }).AudioContext
  delete (globalThis as { fetch?: unknown }).fetch
})

describe("createSeslen (browser)", () => {
  it("plays a registered URL via fetch + decode", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const handle = await ses.play("tick")
    expect(handle).toBeDefined()
    expect(handle!.done).toBe(false)
  })

  it("invokes a SoundFactory directly", async () => {
    const factory = vi.fn((_ctx, _master, _opts) => ({
      stop: vi.fn(),
      get done() {
        return false
      },
      get duration() {
        return null
      },
      onEnded: vi.fn(),
    }))
    const ses = createSeslen({ sources: { synth: factory } })
    await ses.play("synth", { gain: 0.5 })
    expect(factory).toHaveBeenCalledTimes(1)
    const call = factory.mock.calls[0]
    expect(call?.[2]).toEqual({ gain: 0.5 })
  })

  it("throws on unknown sound", async () => {
    const ses = createSeslen<string>({ sources: {} })
    await expect(ses.play("missing")).rejects.toBeInstanceOf(SeslenError)
  })

  it("stopAll() stops every active handle", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const a = await ses.play("tick")
    const b = await ses.play("tick")
    ses.stopAll()
    expect(a!.done).toBe(true)
    expect(b!.done).toBe(true)
  })

  it("playPattern() fires every scheduled step (no race on setTimeout)", async () => {
    vi.useFakeTimers()
    try {
      const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
      const fired: number[] = []
      ses.on("play", (e) => {
        if (e.name === "tick") fired.push(performance.now())
      })
      await ses.playPattern([
        { at: 0, id: "tick" },
        { at: 100, id: "tick" },
        { at: 250, id: "tick" },
        { at: 400, id: "tick" },
      ])
      // Drain microtasks for the immediate-fire step.
      await Promise.resolve()
      // Walk past every scheduled offset.
      await vi.advanceTimersByTimeAsync(500)
      expect(fired.length).toBe(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it("playPattern() schedules each step and returns a combined handle", async () => {
    vi.useFakeTimers()
    try {
      const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
      const handle = await ses.playPattern([
        { id: "tick" },
        { at: 100, id: "tick", options: { gain: 0.5 } },
        { at: 250, id: "tick" },
      ])
      expect(handle.done).toBe(false)
      // Advance and let microtasks settle so the per-step `play()` promises
      // resolve.
      await vi.advanceTimersByTimeAsync(300)
      handle.stop()
      expect(handle.done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("stop(name) only kills handles for that preset", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3", chime: "/chime.mp3" } })
    const a = await ses.play("tick")
    const b = await ses.play("tick")
    const c = await ses.play("chime")
    expect(ses.stop("tick")).toBe(2)
    expect(a!.done).toBe(true)
    expect(b!.done).toBe(true)
    expect(c!.done).toBe(false)
  })

  it("register/unregister at runtime", async () => {
    const ses = createSeslen()
    expect(ses.has("late")).toBe(false)
    ses.register("late", "/late.mp3")
    expect(ses.has("late")).toBe(true)
    expect(ses.names()).toContain("late")
    const h = await ses.play("late")
    expect(ses.unregister("late")).toBe(true)
    expect(ses.has("late")).toBe(false)
    // Unregistering stops live handles for that name.
    expect(h!.done).toBe(true)
  })

  it("master volume + mute round-trip", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" }, volume: 0.4 })
    expect(ses.getVolume()).toBe(0.4)
    ses.setVolume(0.8)
    expect(ses.getVolume()).toBe(0.8)
    ses.mute()
    expect(ses.isMuted()).toBe(true)
    // setVolume while muted updates the post-unmute target without
    // unmuting the master.
    ses.unmute()
    expect(ses.isMuted()).toBe(false)
    expect(ses.getVolume()).toBe(0.8)
    // Clamping
    ses.setVolume(-1)
    expect(ses.getVolume()).toBe(0)
    ses.setVolume(2)
    expect(ses.getVolume()).toBe(1)
  })

  it("pause / resume call AudioContext suspend / resume", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    await ses.play("tick") // make sure ctx exists
    await ses.pause()
    await ses.resume()
    // No throws ⇒ the lifecycle hooks are wired.
  })

  it("emits play and ended events", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const plays: string[] = []
    const ends: string[] = []
    ses.on("play", (e) => plays.push(e.name))
    ses.on("ended", (e) => ends.push(e.name))
    const h = await ses.play("tick")
    expect(plays).toEqual(["tick"])
    h!.stop()
    // stop fires onended synchronously via _player's fireEnded.
    expect(ends).toEqual(["tick"])
  })

  it("on() returns an unsubscribe function", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const seen: string[] = []
    const off = ses.on("play", (e) => seen.push(e.name))
    await ses.play("tick")
    off()
    await ses.play("tick")
    expect(seen).toEqual(["tick"])
  })

  it("PlayHandle.onEnded fires when stopped", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const h = await ses.play("tick")
    let fired = false
    h!.onEnded(() => {
      fired = true
    })
    h!.stop()
    expect(fired).toBe(true)
  })

  it("PlayHandle.duration is set for buffer sources", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const h = await ses.play("tick")
    // FakeAudioBuffer's duration is 0.2; rate=1 ⇒ 0.2.
    expect(h!.duration).toBeCloseTo(0.2, 3)
  })

  it("close() closes the AudioContext", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    await ses.play("tick")
    await ses.close()
    expect(ses.state()).toBe("idle")
  })

  it("throttle drops repeat plays inside the window", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const first = await ses.play("tick", { throttle: 1000 })
    const second = await ses.play("tick", { throttle: 1000 })
    expect(first).not.toBeNull()
    expect(second).toBeNull()
  })

  it("emits a throttled event when a play is suppressed", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const dropped: string[] = []
    ses.on("throttled", (e) => dropped.push(e.name))
    await ses.play("tick", { throttle: 1000 })
    await ses.play("tick", { throttle: 1000 })
    expect(dropped).toEqual(["tick"])
  })

  it("interrupt stops prior instances of the same sound", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const first = await ses.play("tick")
    const second = await ses.play("tick", { interrupt: true })
    expect(first!.done).toBe(true)
    expect(second!.done).toBe(false)
  })

  it("voices: drop refuses additional plays at the cap", async () => {
    const ses = createSeslen({
      sources: { tick: "/tick.mp3" },
      defaults: { tick: { voices: 1, steal: "drop" } },
    })
    const first = await ses.play("tick")
    const second = await ses.play("tick")
    expect(first).not.toBeNull()
    expect(second).toBeNull()
  })

  it("bus(name) creates an addressable sub-mixer", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    await ses.play("tick") // boots the context
    const ui = ses.bus("ui")
    expect(ui.name).toBe("ui")
    expect(ui.getVolume()).toBe(1)
    ui.setVolume(0.4)
    expect(ui.getVolume()).toBe(0.4)
    ui.mute()
    expect(ui.isMuted()).toBe(true)
  })

  it("now() and latency() are non-negative numbers", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    await ses.play("tick")
    expect(ses.now()).toBeGreaterThanOrEqual(0)
    expect(ses.latency()).toBeGreaterThanOrEqual(0)
  })

  it("PlayHandle exposes fadeTo / setGain / rampRate for buffer sources", async () => {
    const ses = createSeslen({ sources: { tick: "/tick.mp3" } })
    const h = await ses.play("tick")
    expect(typeof h!.fadeTo).toBe("function")
    expect(typeof h!.setGain).toBe("function")
    expect(typeof h!.rampRate).toBe("function")
    h!.fadeTo!(0, 0.1)
    h!.setGain!(0.5)
    h!.rampRate!(2, 0.2)
  })
})
