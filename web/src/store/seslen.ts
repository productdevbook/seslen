import { create } from "zustand"
import { createSeslen, type PlayHandle, type PlayOptions } from "seslen"
import { presets } from "seslen/presets"

export interface LogEntry {
  ts: string
  line: string
  payload?: unknown
}

type CtxState = "idle" | "running" | "suspended" | "closed"

// Cast to a wider name set so user-provided ids work alongside built-ins.
const ses = createSeslen<string>({ sources: presets, volume: 0.8 })

const loopHandles = new Map<string, PlayHandle>()

interface SeslenState {
  callOpts: PlayOptions
  masterVolume: number
  muted: boolean
  state: CtxState
  log: LogEntry[]
  /** Bumped whenever a loop start/stop happens — drives re-renders. */
  loopVersion: number

  setCallOpt: <K extends keyof PlayOptions>(key: K, value: PlayOptions[K]) => void
  setMasterVolume: (v: number) => void
  setMuted: (v: boolean) => void

  play: (id: string, opts?: PlayOptions) => Promise<PlayHandle | null>
  playPattern: (steps: { at?: number; id: string; options?: PlayOptions }[]) => Promise<PlayHandle>
  startLoop: (id: string) => Promise<void>
  isLooping: (id: string) => boolean
  stopAll: () => void
}

function pushLog(
  get: () => SeslenState,
  set: (p: Partial<SeslenState>) => void,
  line: string,
  payload?: unknown,
): void {
  const ts = new Date().toLocaleTimeString()
  const next = [{ ts, line, payload }, ...get().log].slice(0, 80)
  set({ log: next })
}

export const useSeslen = create<SeslenState>((set, get) => {
  // Wire context state events back into the store.
  ses.on("statechange", (e) => {
    set({ state: e.state })
  })

  return {
    callOpts: { gain: 1, rate: 1, detune: 0 },
    masterVolume: ses.getVolume(),
    muted: ses.isMuted(),
    state: ses.state(),
    log: [],
    loopVersion: 0,

    setCallOpt: (key, value) => {
      set({ callOpts: { ...get().callOpts, [key]: value } })
    },
    setMasterVolume: (v) => {
      ses.setVolume(v)
      set({ masterVolume: ses.getVolume() })
    },
    setMuted: (v) => {
      if (v) ses.mute()
      else ses.unmute()
      set({ muted: ses.isMuted() })
    },

    play: async (id, opts) => {
      const handle = await ses.play(id, opts ?? { ...get().callOpts })
      pushLog(get, set, `play("${id}")`, opts ?? get().callOpts)
      return handle
    },
    playPattern: async (steps) => {
      pushLog(get, set, `playPattern()`, { steps: steps.length })
      return ses.playPattern(steps)
    },
    startLoop: async (id) => {
      const existing = loopHandles.get(id)
      if (existing) {
        existing.stop()
        loopHandles.delete(id)
        pushLog(get, set, `loop stop "${id}"`)
        set({ loopVersion: get().loopVersion + 1 })
        return
      }
      const handle = await ses.play(id, { ...get().callOpts, loop: true })
      if (!handle) return
      loopHandles.set(id, handle)
      pushLog(get, set, `loop start "${id}"`)
      set({ loopVersion: get().loopVersion + 1 })
    },
    isLooping: (id) => loopHandles.has(id),
    stopAll: () => {
      ses.stopAll()
      for (const [, h] of loopHandles) h.stop()
      loopHandles.clear()
      pushLog(get, set, "stopAll()")
      set({ loopVersion: get().loopVersion + 1 })
    },
  }
})
