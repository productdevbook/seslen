import { create } from "zustand"
import type { PatternStep, PlayOptions } from "seslen"

/* -------------------------------------------------------------- types */

export interface Block {
  id: number
  presetId: string
  position: number
  duration: number
  intensity: number
  rate?: number
  detune?: number
}

export interface Lane {
  id: number
  name: string
  muted: boolean
  blocks: Block[]
}

export interface BuilderState {
  lanes: Lane[]
  selected: { laneId: number; blockId: number } | null
  pendingDelete: { laneId: number; blockId: number } | null
  totalMs: number
  pxPerMs: number

  /* derived selectors (called as functions to keep getter ergonomics) */
  total: () => number
  steps: () => PatternStep[]
  selectedBlock: () => { lane: Lane; block: Block } | null

  /* lanes */
  addLane: (name?: string) => Lane
  removeLane: (laneId: number) => void
  setLaneName: (laneId: number, name: string) => void
  setLaneMuted: (laneId: number, muted: boolean) => void

  /* blocks */
  addBlockAt: (
    laneId: number,
    positionMs: number,
    presetId: string,
    snapMs?: number,
  ) => Block | null
  appendBlock: (laneId: number, presetId: string, snapMs?: number) => Block | null
  removeBlock: (laneId: number, blockId: number) => void
  setBlockPreset: (laneId: number, blockId: number, presetId: string) => void
  movePosition: (laneId: number, blockId: number, ms: number, snapMs?: number) => void
  resizeRight: (laneId: number, blockId: number, edgeMs: number, snapMs?: number) => void
  resizeLeft: (laneId: number, blockId: number, edgeMs: number, snapMs?: number) => void
  setIntensity: (laneId: number, blockId: number, intensity: number) => void
  setRate: (laneId: number, blockId: number, rate: number) => void
  setDetune: (laneId: number, blockId: number, detune: number) => void
  moveBlockToLane: (blockId: number, fromLaneId: number, toLaneId: number) => void
  duplicateBlock: (laneId: number, blockId: number) => Block | null

  /* selection */
  select: (laneId: number | null, blockId: number | null) => void
  setPendingDelete: (laneId: number | null, blockId: number | null) => void

  /* timeline controls */
  setTotalMs: (ms: number) => void
  setPxPerMs: (v: number) => void

  /* serialization */
  load: (lanes: { name?: string; muted?: boolean; blocks: Omit<Block, "id">[] }[]) => void
  reset: () => void

  /* history */
  commit: () => void
  undo: () => boolean
  redo: () => boolean
}

/* -------------------------------------------------------------- consts */

export const SNAP_MS = 10
export const DEFAULT_BLOCK = 200
export const DELETE_THRESHOLD = 28
export const MIN_TOTAL = 1000
export const MAX_TOTAL = 5 * 60 * 1000
export const MIN_PX_PER_MS = 0.05
export const MAX_PX_PER_MS = 4

/* ---------------------------------------------------------- helpers */

let nextId = 1
function id(): number {
  return nextId++
}

function snap(ms: number, snapMs: number): number {
  return Math.round(ms / snapMs) * snapMs
}

function neighbors(blocks: Block[], blockId: number): { minPos: number; maxEnd: number } {
  const sorted = [...blocks].sort((a, b) => a.position - b.position)
  const idx = sorted.findIndex((b) => b.id === blockId)
  const prev = idx > 0 ? sorted[idx - 1] : null
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null
  return {
    minPos: prev ? prev.position + prev.duration : 0,
    maxEnd: next ? next.position : Number.POSITIVE_INFINITY,
  }
}

function canFit(blocks: Block[], position: number, duration: number, totalMs: number): boolean {
  for (const b of blocks) {
    const end = b.position + b.duration
    const newEnd = position + duration
    if (position < end && newEnd > b.position) return false
  }
  return position >= 0 && position + duration <= totalMs
}

function cloneLanes(lanes: Lane[]): Lane[] {
  return lanes.map((l) => ({ ...l, blocks: l.blocks.map((b) => ({ ...b })) }))
}

interface Snapshot {
  lanes: Lane[]
  totalMs: number
}

const HISTORY_MAX = 100

export const useBuilder = create<BuilderState>((set, get) => {
  const past: Snapshot[] = []
  const future: Snapshot[] = []
  let lastSnap: Snapshot = {
    lanes: [{ id: id(), name: "Track 1", muted: false, blocks: [] }],
    totalMs: 10_000,
  }

  function snapshot(): Snapshot {
    const s = get()
    return {
      lanes: cloneLanes(s.lanes),
      totalMs: s.totalMs,
    }
  }

  function applySnapshot(s: Snapshot): void {
    set({
      lanes: cloneLanes(s.lanes),
      totalMs: s.totalMs,
      selected: null,
      pendingDelete: null,
    })
  }

  /* mutations operate on a draft of `lanes`; we always set a fresh array
   * so React + zustand subscribers re-render. */
  function mutLanes(fn: (lanes: Lane[]) => Lane[] | void): void {
    const next = cloneLanes(get().lanes)
    const result = fn(next)
    set({ lanes: Array.isArray(result) ? result : next })
  }

  return {
    lanes: cloneLanes(lastSnap.lanes),
    selected: null,
    pendingDelete: null,
    totalMs: lastSnap.totalMs,
    pxPerMs: 0.4,

    total: () => {
      const lanes = get().lanes
      if (lanes.length === 0) return 0
      let max = 0
      for (const l of lanes) {
        for (const b of l.blocks) {
          const end = b.position + b.duration
          if (end > max) max = end
        }
      }
      return max
    },

    steps: () => {
      const out: PatternStep[] = []
      for (const l of get().lanes) {
        if (l.muted) continue
        for (const b of l.blocks) {
          const o: PlayOptions = {}
          if (Math.abs(b.intensity - 1) > 1e-6) o.gain = Number(b.intensity.toFixed(2))
          if (b.rate !== undefined && Math.abs(b.rate - 1) > 1e-6) {
            o.rate = Number(b.rate.toFixed(2))
          }
          if (b.detune !== undefined && Math.abs(b.detune) > 1e-6) {
            o.detune = Math.round(b.detune)
          }
          out.push(
            Object.keys(o).length > 0
              ? { at: b.position, id: b.presetId, options: o }
              : { at: b.position, id: b.presetId },
          )
        }
      }
      return out.sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    },

    selectedBlock: () => {
      const s = get()
      if (!s.selected) return null
      const lane = s.lanes.find((l) => l.id === s.selected!.laneId)
      if (!lane) return null
      const block = lane.blocks.find((b) => b.id === s.selected!.blockId)
      if (!block) return null
      return { lane, block }
    },

    /* lanes */
    addLane: (name) => {
      const lane: Lane = {
        id: id(),
        name: name ?? `Track ${get().lanes.length + 1}`,
        muted: false,
        blocks: [],
      }
      set({ lanes: [...get().lanes, lane] })
      return lane
    },
    removeLane: (laneId) => {
      const s = get()
      set({
        lanes: s.lanes.filter((l) => l.id !== laneId),
        selected: s.selected?.laneId === laneId ? null : s.selected,
        pendingDelete: s.pendingDelete?.laneId === laneId ? null : s.pendingDelete,
      })
    },
    setLaneName: (laneId, name) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        if (l) l.name = name
      })
    },
    setLaneMuted: (laneId, muted) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        if (l) l.muted = muted
      })
    },

    /* blocks */
    addBlockAt: (laneId, positionMs, presetId, snapMs = SNAP_MS) => {
      const s = get()
      const lane = s.lanes.find((l) => l.id === laneId)
      if (!lane) return null
      let dur = DEFAULT_BLOCK
      while (dur > 30) {
        const pos = snap(Math.max(0, Math.min(s.totalMs - dur, positionMs)), snapMs)
        if (canFit(lane.blocks, pos, dur, s.totalMs)) {
          const block: Block = { id: id(), presetId, position: pos, duration: dur, intensity: 0.7 }
          mutLanes((lanes) => {
            const l = lanes.find((x) => x.id === laneId)
            if (l) l.blocks = [...l.blocks, block]
          })
          set({ selected: { laneId, blockId: block.id } })
          return block
        }
        dur -= 50
      }
      return null
    },
    appendBlock: (laneId, presetId, snapMs = SNAP_MS) => {
      const lane = get().lanes.find((l) => l.id === laneId)
      if (!lane) return null
      const lastEnd =
        lane.blocks.length === 0 ? 0 : Math.max(...lane.blocks.map((b) => b.position + b.duration))
      return get().addBlockAt(laneId, lastEnd + 40, presetId, snapMs)
    },
    removeBlock: (laneId, blockId) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        if (l) l.blocks = l.blocks.filter((b) => b.id !== blockId)
      })
      const s = get()
      set({
        selected: s.selected?.blockId === blockId ? null : s.selected,
        pendingDelete: s.pendingDelete?.blockId === blockId ? null : s.pendingDelete,
      })
    },
    setBlockPreset: (laneId, blockId, presetId) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        const b = l?.blocks.find((x) => x.id === blockId)
        if (b) b.presetId = presetId
      })
    },
    movePosition: (laneId, blockId, ms, snapMs = SNAP_MS) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        if (!l) return
        const b = l.blocks.find((x) => x.id === blockId)
        if (!b) return
        const bounds = neighbors(l.blocks, blockId)
        const totalMs = get().totalMs
        const maxEnd = Math.min(bounds.maxEnd, totalMs)
        const clamped = snap(Math.max(bounds.minPos, Math.min(maxEnd - b.duration, ms)), snapMs)
        if (b.position !== clamped) b.position = clamped
      })
    },
    resizeRight: (laneId, blockId, edgeMs, snapMs = SNAP_MS) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        if (!l) return
        const b = l.blocks.find((x) => x.id === blockId)
        if (!b) return
        const bounds = neighbors(l.blocks, blockId)
        const totalMs = get().totalMs
        const maxEnd = Math.min(bounds.maxEnd, totalMs)
        const dur = snap(Math.max(20, Math.min(maxEnd - b.position, edgeMs - b.position)), snapMs)
        if (b.duration !== dur) b.duration = dur
      })
    },
    resizeLeft: (laneId, blockId, edgeMs, snapMs = SNAP_MS) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        if (!l) return
        const b = l.blocks.find((x) => x.id === blockId)
        if (!b) return
        const bounds = neighbors(l.blocks, blockId)
        const newPos = snap(
          Math.max(bounds.minPos, Math.min(b.position + b.duration - 20, edgeMs)),
          snapMs,
        )
        const newDur = b.position + b.duration - newPos
        if (b.position !== newPos) {
          b.position = newPos
          b.duration = newDur
        }
      })
    },
    setIntensity: (laneId, blockId, intensity) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        const b = l?.blocks.find((x) => x.id === blockId)
        if (!b) return
        const v = Math.round(Math.max(0, Math.min(1, intensity)) * 100) / 100
        if (b.intensity !== v) b.intensity = v
      })
    },
    setRate: (laneId, blockId, rate) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        const b = l?.blocks.find((x) => x.id === blockId)
        if (!b) return
        const v = Math.round(Math.max(0.25, Math.min(4, rate)) * 100) / 100
        if (Math.abs(v - 1) < 1e-6) {
          if (b.rate !== undefined) b.rate = undefined
        } else if (b.rate !== v) {
          b.rate = v
        }
      })
    },
    setDetune: (laneId, blockId, detune) => {
      mutLanes((lanes) => {
        const l = lanes.find((x) => x.id === laneId)
        const b = l?.blocks.find((x) => x.id === blockId)
        if (!b) return
        const v = Math.round(Math.max(-2400, Math.min(2400, detune)))
        if (v === 0) {
          if (b.detune !== undefined) b.detune = undefined
        } else if (b.detune !== v) {
          b.detune = v
        }
      })
    },
    moveBlockToLane: (blockId, fromLaneId, toLaneId) => {
      if (fromLaneId === toLaneId) return
      const s = get()
      const from = s.lanes.find((l) => l.id === fromLaneId)
      const to = s.lanes.find((l) => l.id === toLaneId)
      if (!from || !to) return
      const block = from.blocks.find((b) => b.id === blockId)
      if (!block) return
      if (!canFit(to.blocks, block.position, block.duration, s.totalMs)) return
      mutLanes((lanes) => {
        const f = lanes.find((l) => l.id === fromLaneId)
        const t = lanes.find((l) => l.id === toLaneId)
        if (!f || !t) return
        f.blocks = f.blocks.filter((b) => b.id !== blockId)
        t.blocks = [...t.blocks, { ...block }]
      })
      set({ selected: { laneId: toLaneId, blockId } })
    },
    duplicateBlock: (laneId, blockId) => {
      const s = get()
      const lane = s.lanes.find((l) => l.id === laneId)
      if (!lane) return null
      const src = lane.blocks.find((x) => x.id === blockId)
      if (!src) return null
      let pos = src.position + src.duration + 20
      while (pos + src.duration <= s.totalMs) {
        if (canFit(lane.blocks, pos, src.duration, s.totalMs)) {
          const block: Block = {
            id: id(),
            presetId: src.presetId,
            position: snap(pos, SNAP_MS),
            duration: src.duration,
            intensity: src.intensity,
          }
          mutLanes((lanes) => {
            const l = lanes.find((x) => x.id === laneId)
            if (l) l.blocks = [...l.blocks, block]
          })
          set({ selected: { laneId, blockId: block.id } })
          return block
        }
        pos += 50
      }
      return null
    },

    /* selection */
    select: (laneId, blockId) => {
      set({
        selected: laneId !== null && blockId !== null ? { laneId, blockId } : null,
      })
    },
    setPendingDelete: (laneId, blockId) => {
      set({
        pendingDelete: laneId !== null && blockId !== null ? { laneId, blockId } : null,
      })
    },

    /* timeline */
    setTotalMs: (ms) => {
      if (!Number.isFinite(ms)) return
      const next = Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, ms))
      mutLanes((lanes) => {
        for (const lane of lanes) {
          for (const b of lane.blocks) {
            if (b.position >= next) {
              b.position = Math.max(0, next - 20)
              b.duration = Math.min(20, next - b.position)
            } else if (b.position + b.duration > next) {
              b.duration = Math.max(20, next - b.position)
            }
          }
        }
      })
      set({ totalMs: next })
    },
    setPxPerMs: (v) => {
      set({ pxPerMs: Math.max(MIN_PX_PER_MS, Math.min(MAX_PX_PER_MS, v)) })
    },

    /* serialization */
    load: (lanes) => {
      const next: Lane[] =
        lanes.length === 0
          ? [{ id: id(), name: "Track 1", muted: false, blocks: [] }]
          : lanes.map((l, i) => ({
              id: id(),
              name: l.name ?? `Track ${i + 1}`,
              muted: l.muted ?? false,
              blocks: l.blocks.map((b) => ({ ...b, id: id() })),
            }))
      set({ lanes: next, selected: null, pendingDelete: null })
      lastSnap = snapshot()
      past.length = 0
      future.length = 0
    },
    reset: () => {
      set({
        lanes: [{ id: id(), name: "Track 1", muted: false, blocks: [] }],
        selected: null,
        pendingDelete: null,
      })
      lastSnap = snapshot()
      past.length = 0
      future.length = 0
    },

    /* history */
    commit: () => {
      const next = snapshot()
      if (JSON.stringify(next) === JSON.stringify(lastSnap)) return
      past.push(lastSnap)
      if (past.length > HISTORY_MAX) past.shift()
      future.length = 0
      lastSnap = next
    },
    undo: () => {
      const s = past.pop()
      if (!s) return false
      future.push(snapshot())
      applySnapshot(s)
      lastSnap = snapshot()
      return true
    },
    redo: () => {
      const s = future.pop()
      if (!s) return false
      past.push(snapshot())
      applySnapshot(s)
      lastSnap = snapshot()
      return true
    },
  }
})
