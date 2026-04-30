/// <reference path="./env.d.ts" />
import type { BusHandle } from "./_types.ts"

/**
 * Tiny bus mixer. Each bus is a `GainNode` connected to `master`. Sounds
 * routed through `{ bus: name }` connect to the bus's gain instead of master.
 *
 * Buses are lazily created on first `get(name)` so the wiring cost is zero
 * for callers that never use them.
 */
export function createBuses(
  ctx: AudioContext,
  master: GainNode,
  initial?: Record<string, { volume?: number; muted?: boolean }>,
): {
  /** Resolve the destination node a sound should connect to (bus or master). */
  resolve(name: string | undefined): GainNode
  /** Get or create a bus handle. */
  get(name: string): BusHandle
  /** Underlying nodes (for testing). */
  nodes(): Map<string, GainNode>
} {
  type Bus = {
    name: string
    node: GainNode
    volume: number
    muted: boolean
    preMute: number
  }
  const buses = new Map<string, Bus>()

  function ensure(name: string): Bus {
    let b = buses.get(name)
    if (b) return b
    const node = ctx.createGain()
    const init = initial?.[name]
    const vol = clamp01(init?.volume ?? 1)
    const muted = init?.muted ?? false
    node.gain.value = muted ? 0 : vol
    node.connect(master)
    b = { name, node, volume: vol, muted, preMute: vol }
    buses.set(name, b)
    return b
  }

  // Pre-create initial buses so they exist even if never referenced.
  if (initial) {
    for (const name of Object.keys(initial)) ensure(name)
  }

  function handle(b: Bus): BusHandle {
    return {
      get name() {
        return b.name
      },
      getVolume() {
        return b.volume
      },
      setVolume(value) {
        b.volume = clamp01(value)
        if (!b.muted) b.preMute = b.volume
        b.node.gain.value = b.muted ? 0 : b.volume
      },
      mute() {
        if (b.muted) return
        b.preMute = b.volume
        b.muted = true
        b.node.gain.value = 0
      },
      unmute() {
        if (!b.muted) return
        b.muted = false
        b.volume = b.preMute
        b.node.gain.value = b.volume
      },
      isMuted() {
        return b.muted
      },
      duck({ target, holdSeconds, attackSeconds = 0.05, releaseSeconds = 0.2 }) {
        const now = ctx.currentTime
        const start = b.muted ? 0 : b.volume
        const goal = clamp01(target)
        const param = b.node.gain
        param.cancelScheduledValues(now)
        param.setValueAtTime(start, now)
        param.linearRampToValueAtTime(goal, now + Math.max(0, attackSeconds))
        param.setValueAtTime(goal, now + attackSeconds + Math.max(0, holdSeconds))
        param.linearRampToValueAtTime(
          start,
          now + attackSeconds + holdSeconds + Math.max(0, releaseSeconds),
        )
      },
    }
  }

  return {
    resolve(name) {
      if (!name) return master
      return ensure(name).node
    },
    get(name) {
      return handle(ensure(name))
    },
    nodes() {
      const map = new Map<string, GainNode>()
      for (const [k, v] of buses) map.set(k, v.node)
      return map
    },
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}
