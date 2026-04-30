/**
 * Per-name throttle. Tracks the timestamp of the last successful play for
 * each source name. `tryFire(name, minIntervalMs)` returns `true` and stamps
 * the time if the call is allowed; returns `false` if it should be dropped.
 *
 * `minIntervalMs <= 0` disables throttling for that call.
 */
export function createThrottle(): {
  tryFire(name: string, minIntervalMs: number): boolean
  reset(name: string): void
  clear(): void
} {
  const last = new Map<string, number>()
  const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now())

  return {
    tryFire(name, minIntervalMs) {
      if (!Number.isFinite(minIntervalMs) || minIntervalMs <= 0) {
        last.set(name, now())
        return true
      }
      const t = now()
      const prev = last.get(name)
      if (prev !== undefined && t - prev < minIntervalMs) return false
      last.set(name, t)
      return true
    },
    reset(name) {
      last.delete(name)
    },
    clear() {
      last.clear()
    },
  }
}

declare var performance: { now(): number } | undefined
