/**
 * `seslen` — a small, high-DX Web Audio library.
 *
 * Play built-in UI sounds in one line: `await ses.play("victory")`.
 * Preset pack lives at `seslen/presets`. SSR stub at `seslen/server`.
 *
 * @module
 */
/// <reference path="./env.d.ts" />
import { ContextNotReadyError, SeslenError } from "./errors.ts"
import { watchReducedMotion } from "./_a11y.ts"
import { createAnalyser } from "./_analyser.ts"
import { createBuses } from "./_buses.ts"
import { createCache } from "./_cache.ts"
import { createContext, isBrowser } from "./_context.ts"
import { applyJitter, mergeDefaults } from "./_jitter.ts"
import { fetchAndDecode } from "./_loader.ts"
import { createPersist } from "./_persist.ts"
import { startBuffer } from "./_player.ts"
import { createRegistry } from "./_registry.ts"
import { renderToWav } from "./_render.ts"
import { createThrottle } from "./_throttle.ts"
import { createVoices } from "./_voices.ts"
import type {
  AnalyserTap,
  BusHandle,
  PatternStep,
  PlayHandle,
  PlayOptions,
  SeslenEvent,
  SeslenEventListener,
  SeslenEventType,
  SeslenInstance,
  SeslenOptions,
  SoundFactory,
  SoundSource,
  SourceDefaults,
  VoiceStealStrategy,
} from "./_types.ts"

export { SeslenError, ContextNotReadyError, DecodeError, LoadError } from "./errors.ts"
export type {
  AnalyserTap,
  BusHandle,
  PatternStep,
  PlayHandle,
  PlayOptions,
  SeslenEvent,
  SeslenEventListener,
  SeslenEventType,
  SeslenInstance,
  SeslenOptions,
  SoundFactory,
  SoundSource,
  SourceDefaults,
  VoiceStealStrategy,
}
export { isBrowser }

/** Library version — bumped automatically on release. */
export const version = "0.0.1"

/**
 * Create a new `seslen` instance.
 *
 * Pass `sources` as a literal object to get a typed instance — `play`,
 * `playPattern`, `preload` and `stop` will all autocomplete on the
 * registered names.
 *
 * ```ts
 * import { createSeslen } from "seslen"
 * import { presets } from "seslen/presets"
 *
 * const ses = createSeslen({ sources: presets, volume: 0.8 })
 * await ses.play("victory") // ← `keyof typeof presets` autocompletes
 * ```
 */
export function createSeslen<TName extends string = string>(
  opts: SeslenOptions<TName> = {},
): SeslenInstance<TName> {
  const registry = createRegistry(
    opts.sources,
    opts.defaults as Record<string, SourceDefaults> | undefined,
  )
  const handles = new Map<PlayHandle, string>()
  const throttle = createThrottle()
  const voices = createVoices(opts.maxVoices)
  const persist = createPersist(opts.persist)
  const persisted = persist.load()

  type AnyListener = (e: SeslenEvent) => void
  const listeners = new Map<SeslenEventType, Set<AnyListener>>()
  function emit(e: SeslenEvent): void {
    const set = listeners.get(e.type)
    if (!set) return
    for (const fn of set) {
      try {
        fn(e)
      } catch {
        // listener errors must not break playback
      }
    }
  }
  function on<T extends SeslenEventType>(type: T, listener: SeslenEventListener<T>): () => void {
    let set = listeners.get(type)
    if (!set) {
      set = new Set()
      listeners.set(type, set)
    }
    set.add(listener as AnyListener)
    return () => off(type, listener)
  }
  function off<T extends SeslenEventType>(type: T, listener: SeslenEventListener<T>): void {
    listeners.get(type)?.delete(listener as AnyListener)
  }

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let buses: ReturnType<typeof createBuses> | null = null
  let urlCache: ReturnType<typeof createCache<string, AudioBuffer>> | null = null
  let analyser: AnalyserTap | null = null
  let stopReducedMotion: (() => void) | null = null

  let volume = clamp01(persisted.volume ?? opts.volume ?? 1)
  let mutedFlag = persisted.muted ?? false
  let preMuteVolume = volume
  let reducedMotionMute = false
  let lastState: "idle" | "running" | "suspended" | "closed" = "idle"

  function syncState(): void {
    const next = (ctx?.state ?? "idle") as "idle" | "running" | "suspended" | "closed"
    if (next !== lastState) {
      lastState = next
      emit({ type: "statechange", state: next })
    }
  }

  function clamp01(v: number): number {
    if (Number.isNaN(v)) return 0
    return Math.max(0, Math.min(1, v))
  }

  function effectiveMuted(): boolean {
    return mutedFlag || reducedMotionMute
  }

  function applyVolume(): void {
    if (!master) return
    master.gain.value = effectiveMuted() ? 0 : volume
  }

  function persistNow(): void {
    persist.save({ volume, muted: mutedFlag })
  }

  function ensure(): { ctx: AudioContext; master: GainNode } {
    if (ctx && master) return { ctx, master }
    ctx = createContext()
    master = ctx.createGain()
    master.gain.value = effectiveMuted() ? 0 : volume
    master.connect(ctx.destination)
    buses = createBuses(ctx, master, opts.buses)
    urlCache = createCache((url: string) => fetchAndDecode(ctx as AudioContext, url))
    if (opts.respectReducedMotion !== false) {
      stopReducedMotion = watchReducedMotion((reduce) => {
        reducedMotionMute = reduce
        applyVolume()
      })
    }
    syncState()
    return { ctx, master }
  }

  function track(handle: PlayHandle, name: string): PlayHandle {
    handles.set(handle, name)
    return handle
  }

  return {
    /* ----------------------------------------------- playback */

    async play(name, playOpts: PlayOptions = {}) {
      const source: SoundSource | undefined = registry.resolve(name)
      if (source === undefined) throw new SeslenError(`seslen: unknown sound "${name}"`)

      const defaults = registry.defaults(name)
      const merged = mergeDefaults(playOpts, defaults)

      // Throttle gate — explicit option wins over per-source default.
      const minInterval = merged.throttle ?? defaults?.minInterval ?? 0
      if (!throttle.tryFire(name, minInterval)) {
        emit({ type: "throttled", name })
        return null
      }

      // Voice cap — per-source `voices` (or default) + global `maxVoices`.
      const cap = defaults?.voices
      const steal: VoiceStealStrategy | undefined = defaults?.steal
      if (merged.interrupt) {
        // "interrupt" is a one-shot steal of every prior voice for `name`.
        for (const [h, n] of handles) {
          if (n === name) {
            try {
              h.stop()
            } catch {
              // ignore
            }
          }
        }
      } else if (cap !== undefined || opts.maxVoices !== undefined) {
        if (voices.request(name, cap, steal) === "dropped") return null
      }

      const jittered = applyJitter(merged, defaults)
      const { ctx: c, master: m } = ensure()
      const dest = buses?.resolve(jittered.bus) ?? m

      let handle: PlayHandle
      if (typeof source === "function") {
        handle = (source as SoundFactory)(c, dest, jittered)
      } else if (typeof source === "string") {
        if (!urlCache) throw new ContextNotReadyError("seslen: cache not initialised")
        const buf = await urlCache.get(source)
        handle = startBuffer(c, dest, buf, jittered)
      } else {
        handle = startBuffer(c, dest, source, jittered)
      }
      track(handle, name)
      voices.add(name, handle)
      handle.onEnded(() => {
        handles.delete(handle)
        voices.remove(name, handle)
        emit({ type: "ended", name, handle })
      })
      emit({ type: "play", name, handle, pattern: false })
      return handle
    },

    async playPattern(steps) {
      ensure()
      const live = new Set<PlayHandle>()
      const timers = new Set<ReturnType<typeof setTimeout>>()
      let stopped = false
      let endedCb: (() => void) | null = null

      function fireEnded(): void {
        if (endedCb) {
          const cb = endedCb
          endedCb = null
          try {
            cb()
          } catch {
            // ignore listener errors
          }
        }
        emit({ type: "ended", name: "@pattern", handle })
      }

      function maybeNaturalEnd(): void {
        if (stopped) return
        if (live.size === 0 && timers.size === 0 && pendingFires === 0) {
          stopped = true
          handles.delete(handle)
          fireEnded()
        }
      }

      const total = steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.at ?? 0))

      const handle: PlayHandle = {
        stop() {
          if (stopped) return
          stopped = true
          for (const t of timers) clearTimeout(t)
          timers.clear()
          for (const h of live) h.stop()
          live.clear()
          handles.delete(handle)
          fireEnded()
        },
        get done() {
          return stopped && live.size === 0 && timers.size === 0
        },
        get duration() {
          return total > 0 ? total / 1000 : null
        },
        onEnded(cb) {
          if (stopped) {
            try {
              cb()
            } catch {
              // ignore
            }
            return
          }
          endedCb = cb
        },
      }
      track(handle, "@pattern")
      emit({ type: "play", name: "@pattern", handle, pattern: true })

      let pendingFires = 0
      const self = this

      for (const step of steps) {
        const at = Math.max(0, step.at ?? 0)
        const fire = async (): Promise<void> => {
          pendingFires++
          try {
            if (stopped) return
            try {
              const h = await self.play(step.id, step.options)
              if (!h) return
              if (stopped) {
                h.stop()
                return
              }
              live.add(h)
              h.onEnded(() => {
                live.delete(h)
                maybeNaturalEnd()
              })
            } catch {
              // ignore per-step failures so one bad step doesn't kill the rest
            }
          } finally {
            pendingFires--
            maybeNaturalEnd()
          }
        }
        if (at === 0) {
          void fire()
        } else {
          const timer = setTimeout(() => {
            timers.delete(timer)
            void fire()
          }, at)
          timers.add(timer)
        }
      }

      return handle
    },

    async preload(name) {
      const source = registry.resolve(name)
      if (source === undefined) throw new SeslenError(`seslen: unknown sound "${name}"`)
      ensure()
      if (typeof source === "string") {
        if (!urlCache) throw new ContextNotReadyError("seslen: cache not initialised")
        await urlCache.get(source)
      }
    },

    stopAll() {
      for (const [h] of handles) h.stop()
      handles.clear()
      voices.clear()
    },

    stop(name) {
      let count = 0
      for (const [h, n] of handles) {
        if (n === name) {
          h.stop()
          handles.delete(h)
          count++
        }
      }
      return count
    },

    /* ----------------------------------------------- registry */

    register(name, source, defaults) {
      registry.register(name, source, defaults)
    },

    unregister(name) {
      const ok = registry.unregister(name)
      if (ok) {
        for (const [h, n] of handles) {
          if (n === name) {
            h.stop()
            handles.delete(h)
          }
        }
      }
      return ok
    },

    has(name) {
      return registry.has(name)
    },

    names() {
      return registry.names() as TName[]
    },

    /* ----------------------------------------------- master */

    getVolume() {
      return volume
    },

    setVolume(value) {
      volume = clamp01(value)
      if (!mutedFlag) preMuteVolume = volume
      applyVolume()
      persistNow()
    },

    mute() {
      if (mutedFlag) return
      preMuteVolume = volume
      mutedFlag = true
      applyVolume()
      persistNow()
    },

    unmute() {
      if (!mutedFlag) return
      mutedFlag = false
      volume = preMuteVolume
      applyVolume()
      persistNow()
    },

    isMuted() {
      return mutedFlag
    },

    /* ----------------------------------------------- buses */

    bus(name) {
      ensure()
      return (buses as ReturnType<typeof createBuses>).get(name)
    },

    /* ----------------------------------------------- timing */

    now() {
      return ctx?.currentTime ?? 0
    },

    latency() {
      if (!ctx) return 0
      return (ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0)
    },

    /* ----------------------------------------------- render */

    async render(name, renderOpts) {
      const source = registry.resolve(name)
      if (source === undefined) throw new SeslenError(`seslen: unknown sound "${name}"`)
      return renderToWav(
        source,
        async (url, off) => {
          const res = await fetch(url)
          const bytes = await res.arrayBuffer()
          return off.decodeAudioData(bytes)
        },
        renderOpts,
      )
    },

    /* ----------------------------------------------- analysis */

    analyser(analyserOpts) {
      ensure()
      analyser?.dispose()
      analyser = createAnalyser(ctx as AudioContext, master as GainNode, analyserOpts)
      return analyser
    },

    /* ----------------------------------------------- events */

    on,
    off,

    /* --------------------------------------------- lifecycle */

    async pause() {
      if (!ctx) return
      if (ctx.state === "running") await ctx.suspend()
      syncState()
    },

    async resume() {
      if (!ctx) return
      if (ctx.state === "suspended") await ctx.resume()
      syncState()
    },

    async close() {
      for (const [h] of handles) h.stop()
      handles.clear()
      voices.clear()
      throttle.clear()
      analyser?.dispose()
      analyser = null
      stopReducedMotion?.()
      stopReducedMotion = null
      urlCache?.clear()
      if (ctx && ctx.state !== "closed") await ctx.close()
      ctx = null
      master = null
      buses = null
      urlCache = null
      syncState()
    },

    isReady() {
      return ctx?.state === "running"
    },

    state() {
      return ctx?.state ?? "idle"
    },
  }
}
