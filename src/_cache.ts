/** Single-flight cache: a second `get()` for the same key while the first
 *  is still in-flight returns the same Promise. Resolved values are kept
 *  forever (audio buffers are small and bounded by the registry). */
export function createCache<K, V>(
  loader: (key: K) => Promise<V>,
): {
  get(key: K): Promise<V>
  set(key: K, value: V): void
  has(key: K): boolean
  clear(): void
} {
  const ready = new Map<K, V>()
  const pending = new Map<K, Promise<V>>()

  return {
    async get(key) {
      const cached = ready.get(key)
      if (cached !== undefined) return cached
      let inflight = pending.get(key)
      if (!inflight) {
        inflight = loader(key).then((value) => {
          ready.set(key, value)
          pending.delete(key)
          return value
        })
        pending.set(key, inflight)
      }
      return inflight
    },
    set(key, value) {
      ready.set(key, value)
    },
    has(key) {
      return ready.has(key)
    },
    clear() {
      ready.clear()
      pending.clear()
    },
  }
}
