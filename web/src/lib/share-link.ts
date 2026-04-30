import type { Block, Lane } from "../store/builder"

const VERSION = 4

type V1Block = [string, number, number, number]
type V2Block = [number, number, number]
type V2Lane = [string, 0 | 1, V2Block[]]
type V3Block = [string, number, number, number]
type V3Lane = [string, 0 | 1, V3Block[]]
type V4Block =
  | [string, number, number, number]
  | [string, number, number, number, number]
  | [string, number, number, number, number, number]
type V4Lane = [string, 0 | 1, V4Block[]]

export interface RestoredLane {
  name?: string
  muted: boolean
  blocks: Omit<Block, "id">[]
}

export interface Restored {
  totalMs?: number
  lanes: RestoredLane[]
}

function base64urlEncode(input: string): string {
  const b64 = btoa(unescape(encodeURIComponent(input)))
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

function laneToWire(lane: Lane): V4Lane {
  return [
    lane.name,
    lane.muted ? 1 : 0,
    lane.blocks.map((b) => {
      const base: V4Block = [
        b.presetId,
        Math.round(b.position),
        Math.round(b.duration),
        Number(b.intensity.toFixed(2)),
      ]
      if (b.detune !== undefined && Math.abs(b.detune) > 0) {
        const rate = b.rate ?? 1
        return [...base, Number(rate.toFixed(2)), Math.round(b.detune)] as V4Block
      }
      if (b.rate !== undefined && Math.abs(b.rate - 1) > 1e-6) {
        return [...base, Number(b.rate.toFixed(2))] as V4Block
      }
      return base
    }),
  ]
}

function wireV4ToLanes(wire: V4Lane[]): RestoredLane[] {
  return wire
    .filter(
      (w): w is V4Lane =>
        Array.isArray(w) &&
        typeof w[0] === "string" &&
        (w[1] === 0 || w[1] === 1) &&
        Array.isArray(w[2]),
    )
    .map((w) => ({
      name: w[0],
      muted: w[1] === 1,
      blocks: w[2]
        .filter(
          (b): b is V4Block =>
            Array.isArray(b) &&
            typeof b[0] === "string" &&
            typeof b[1] === "number" &&
            typeof b[2] === "number" &&
            typeof b[3] === "number",
        )
        .map((b) => {
          const out: Omit<Block, "id"> = {
            presetId: b[0],
            position: Math.max(0, Math.round(b[1])),
            duration: Math.max(20, Math.round(b[2])),
            intensity: Math.max(0, Math.min(1, b[3])),
          }
          if (b.length >= 5 && typeof b[4] === "number" && Math.abs(b[4] - 1) > 1e-6) {
            out.rate = b[4]
          }
          if (b.length >= 6 && typeof b[5] === "number" && b[5] !== 0) {
            out.detune = b[5]
          }
          return out
        }),
    }))
}

function wireV3ToLanes(wire: V3Lane[]): RestoredLane[] {
  return wireV4ToLanes(wire as unknown as V4Lane[])
}

function wireV2ToLanes(wire: V2Lane[]): RestoredLane[] {
  return wire
    .filter(
      (w): w is V2Lane =>
        Array.isArray(w) &&
        typeof w[0] === "string" &&
        (w[1] === 0 || w[1] === 1) &&
        Array.isArray(w[2]),
    )
    .map((w) => ({
      name: w[0],
      muted: w[1] === 1,
      blocks: w[2]
        .filter(
          (b): b is V2Block =>
            Array.isArray(b) &&
            typeof b[0] === "number" &&
            typeof b[1] === "number" &&
            typeof b[2] === "number",
        )
        .map((b) => ({
          presetId: w[0],
          position: Math.max(0, Math.round(b[0])),
          duration: Math.max(20, Math.round(b[1])),
          intensity: Math.max(0, Math.min(1, b[2])),
        })),
    }))
}

function wireV1ToLanes(wire: V1Block[]): RestoredLane[] {
  const byPreset = new Map<string, RestoredLane>()
  for (const w of wire) {
    if (
      !Array.isArray(w) ||
      typeof w[0] !== "string" ||
      typeof w[1] !== "number" ||
      typeof w[2] !== "number" ||
      typeof w[3] !== "number"
    )
      continue
    let lane = byPreset.get(w[0])
    if (!lane) {
      lane = { name: w[0], muted: false, blocks: [] }
      byPreset.set(w[0], lane)
    }
    lane.blocks.push({
      presetId: w[0],
      position: Math.max(0, Math.round(w[1])),
      duration: Math.max(20, Math.round(w[2])),
      intensity: Math.max(0, Math.min(1, w[3])),
    })
  }
  return [...byPreset.values()]
}

export function encode(lanes: Lane[], totalMs: number): string {
  if (lanes.length === 0) return ""
  const meaningful = lanes.filter((l) => l.blocks.length > 0)
  if (meaningful.length === 0) return ""
  const payload = JSON.stringify([VERSION, Math.round(totalMs), ...meaningful.map(laneToWire)])
  return base64urlEncode(payload)
}

export function decode(s: string): Restored | null {
  if (!s) return null
  try {
    const json = base64urlDecode(s)
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr) || arr.length < 1) return null
    const v = arr[0] as number
    if (v === 4) {
      const [, totalMs, ...rest] = arr as [number, number, ...V4Lane[]]
      return { totalMs, lanes: wireV4ToLanes(rest) }
    }
    if (v === 3) {
      const [, totalMs, ...rest] = arr as [number, number, ...V3Lane[]]
      return { totalMs, lanes: wireV3ToLanes(rest) }
    }
    if (v === 2) {
      const [, totalMs, ...rest] = arr as [number, number, ...V2Lane[]]
      return { totalMs, lanes: wireV2ToLanes(rest) }
    }
    if (v === 1) {
      const [, ...rest] = arr as [number, ...V1Block[]]
      return { lanes: wireV1ToLanes(rest) }
    }
    return null
  } catch {
    return null
  }
}
