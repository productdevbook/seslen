import type { PlayHandle, VoiceStealStrategy } from "./_types.ts"

/**
 * Per-source voice tracker. Enforces a max simultaneous-voice cap per
 * source name and an optional global cap. When a new voice would exceed
 * the cap, the chosen `steal` strategy decides what happens:
 *
 *   - `"oldest"` — stop the oldest live voice, then admit the new one
 *   - `"newest"` — stop the newest live voice (effectively keeps the oldest)
 *   - `"drop"`   — refuse the new voice; `play()` returns null
 */
export function createVoices(globalMax?: number): {
  /** Decide whether `name` can spawn a new voice given `cap`/`steal`. */
  request(
    name: string,
    cap: number | undefined,
    steal: VoiceStealStrategy | undefined,
  ): "ok" | "dropped"
  /** Track a freshly-started handle. */
  add(name: string, handle: PlayHandle): void
  /** Drop a handle (called from its own `onEnded`). */
  remove(name: string, handle: PlayHandle): void
  /** Total live count for `name`. */
  count(name: string): number
  /** Total live count across all sources. */
  total(): number
  /** Stop and forget every tracked voice. */
  clear(): void
} {
  const live = new Map<string, PlayHandle[]>()

  function listOf(name: string): PlayHandle[] {
    let arr = live.get(name)
    if (!arr) {
      arr = []
      live.set(name, arr)
    }
    return arr
  }

  function totalLive(): number {
    let n = 0
    for (const arr of live.values()) n += arr.length
    return n
  }

  return {
    request(name, cap, steal) {
      // Global cap applies first.
      if (globalMax !== undefined && totalLive() >= globalMax) {
        return enforce(name, steal ?? "oldest", live)
      }
      if (cap !== undefined && (live.get(name)?.length ?? 0) >= cap) {
        return enforce(name, steal ?? "oldest", live)
      }
      return "ok"
    },
    add(name, handle) {
      listOf(name).push(handle)
    },
    remove(name, handle) {
      const arr = live.get(name)
      if (!arr) return
      const i = arr.indexOf(handle)
      if (i !== -1) arr.splice(i, 1)
    },
    count(name) {
      return live.get(name)?.length ?? 0
    },
    total: totalLive,
    clear() {
      for (const arr of live.values()) {
        for (const h of arr) {
          try {
            h.stop()
          } catch {
            // already stopped
          }
        }
      }
      live.clear()
    },
  }
}

function enforce(
  name: string,
  steal: VoiceStealStrategy,
  live: Map<string, PlayHandle[]>,
): "ok" | "dropped" {
  if (steal === "drop") return "dropped"
  // Pick a victim from `name`'s list first; fall back to any list for the
  // global cap case.
  const arr = live.get(name) ?? pickAnyNonEmpty(live)
  if (!arr || arr.length === 0) return "ok"
  const victim = steal === "newest" ? arr.pop() : arr.shift()
  if (victim) {
    try {
      victim.stop()
    } catch {
      // already stopped
    }
  }
  return "ok"
}

function pickAnyNonEmpty(live: Map<string, PlayHandle[]>): PlayHandle[] | undefined {
  for (const arr of live.values()) if (arr.length > 0) return arr
  return undefined
}
