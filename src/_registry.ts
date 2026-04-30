import type { SoundSource, SourceDefaults } from "./_types.ts"

/** Mutable name → SoundSource registry, with optional per-source defaults. */
export function createRegistry(
  initial?: Record<string, SoundSource>,
  initialDefaults?: Record<string, SourceDefaults>,
): {
  register(name: string, source: SoundSource, defaults?: SourceDefaults): void
  unregister(name: string): boolean
  has(name: string): boolean
  resolve(name: string): SoundSource | undefined
  defaults(name: string): SourceDefaults | undefined
  names(): string[]
} {
  const map = new Map<string, SoundSource>()
  const defs = new Map<string, SourceDefaults>()
  if (initial) {
    for (const [k, v] of Object.entries(initial)) map.set(k, v)
  }
  if (initialDefaults) {
    for (const [k, v] of Object.entries(initialDefaults)) defs.set(k, v)
  }
  return {
    register(name, source, defaults) {
      map.set(name, source)
      if (defaults) defs.set(name, defaults)
    },
    unregister(name) {
      defs.delete(name)
      return map.delete(name)
    },
    has(name) {
      return map.has(name)
    },
    resolve(name) {
      return map.get(name)
    },
    defaults(name) {
      return defs.get(name)
    },
    names() {
      return Array.from(map.keys())
    },
  }
}
