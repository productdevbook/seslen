/**
 * SSR-safe stub. Every method is a typed no-op so the same import
 * tree compiles on the server without touching `AudioContext`.
 *
 * @module
 */
import type { AnalyserTap, BusHandle, PlayHandle, SeslenInstance, SeslenOptions } from "./_types.ts"

const NOOP_HANDLE: PlayHandle = {
  stop() {},
  get done() {
    return true
  },
  get duration() {
    return null
  },
  onEnded(cb) {
    try {
      cb()
    } catch {
      // ignore
    }
  },
  fadeTo() {},
  setGain() {},
  rampRate() {},
}

const NOOP_BUS: BusHandle = {
  name: "",
  getVolume: () => 1,
  setVolume() {},
  mute() {},
  unmute() {},
  isMuted: () => false,
  duck() {},
}

const NOOP_ANALYSER: AnalyserTap = {
  getWaveform() {},
  getSpectrum() {},
  fftSize: 0,
  dispose() {},
}

export function createSeslen(_opts?: SeslenOptions): SeslenInstance {
  return {
    async play() {
      return NOOP_HANDLE
    },
    async playPattern() {
      return NOOP_HANDLE
    },
    async preload() {},
    stopAll() {},
    stop() {
      return 0
    },
    register() {},
    unregister() {
      return false
    },
    has() {
      return false
    },
    names() {
      return []
    },
    getVolume() {
      return 1
    },
    setVolume() {},
    mute() {},
    unmute() {},
    isMuted() {
      return false
    },
    bus() {
      return NOOP_BUS
    },
    now() {
      return 0
    },
    latency() {
      return 0
    },
    async render() {
      return null
    },
    analyser() {
      return NOOP_ANALYSER
    },
    on() {
      return () => {}
    },
    off() {},
    async pause() {},
    async resume() {},
    async close() {},
    isReady() {
      return false
    },
    state() {
      return "idle"
    },
  }
}

export const version = "0.0.1"
