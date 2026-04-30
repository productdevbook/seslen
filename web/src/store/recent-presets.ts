import { create } from "zustand"

const KEY = "seslen.recent-presets.v1"
const MAX = 6

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX)
  } catch {
    return []
  }
}

function write(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    // ignore
  }
}

interface RecentState {
  recent: string[]
  push: (id: string) => void
  clear: () => void
}

export const useRecentPresets = create<RecentState>((set, get) => ({
  recent: read(),
  push: (id) => {
    const next = [id, ...get().recent.filter((x) => x !== id)].slice(0, MAX)
    set({ recent: next })
    write(next)
  },
  clear: () => {
    set({ recent: [] })
    write([])
  },
}))
