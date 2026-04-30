import type { Block } from "../store/builder"

export interface DemoLane {
  name?: string
  muted?: boolean
  blocks: Omit<Block, "id">[]
}

export interface Demo {
  id: string
  label: string
  description: string
  totalMs: number
  lanes: DemoLane[]
}

const block = (
  presetId: string,
  position: number,
  duration = 80,
  intensity = 0.7,
): Omit<Block, "id"> => ({
  presetId,
  position,
  duration,
  intensity,
})

const heartbeat: Demo = {
  id: "heartbeat",
  label: "Heartbeat",
  description: "Lub-dub tick at ~70 bpm.",
  totalMs: 4000,
  lanes: [
    {
      name: "Pulse",
      blocks: (() => {
        const out: Omit<Block, "id">[] = []
        const period = 860
        for (let t = 0; t + 220 < 4000; t += period) {
          out.push(block("tick", t, 60, 0.9))
          out.push(block("tick", t + 180, 60, 0.55))
        }
        return out
      })(),
    },
  ],
}

const notificationChime: Demo = {
  id: "notification",
  label: "Notification chime",
  description: "A soft message bell with an add blip.",
  totalMs: 1600,
  lanes: [
    { name: "Bell", blocks: [block("message", 0, 420, 0.85)] },
    {
      name: "Sparkle",
      blocks: [block("add", 200, 140, 0.7), block("add", 600, 140, 0.55)],
    },
  ],
}

const gameOver: Demo = {
  id: "game-over",
  label: "Game over → victory",
  description: "A frustrated buzz, a sweep, then a triumphant arpeggio.",
  totalMs: 3000,
  lanes: [
    {
      name: "Fail",
      blocks: [block("error", 0, 260, 0.9), block("delete", 280, 220, 0.7)],
    },
    { name: "Triumph", blocks: [block("victory", 700, 360, 0.95)] },
    {
      name: "Cheer",
      blocks: [
        block("add", 1100, 140, 0.7),
        block("add", 1280, 140, 0.7),
        block("success", 1500, 320, 0.85),
      ],
    },
  ],
}

const drumKit: Demo = {
  id: "drum-kit",
  label: "Drum kit",
  description: "Sixteenth-note ticks with a success on every beat.",
  totalMs: 4000,
  lanes: [
    {
      name: "Hat",
      blocks: (() => {
        const out: Omit<Block, "id">[] = []
        for (let i = 0; i < 64; i++) {
          const at = i * 60 + 20
          out.push(block("tick", at, 50, i % 4 === 0 ? 0.9 : 0.45))
        }
        return out
      })(),
    },
    {
      name: "Kick",
      blocks: (() => {
        const out: Omit<Block, "id">[] = []
        for (let beat = 0; beat < 16; beat++) {
          out.push(block("success", beat * 240, 180, 0.7))
        }
        return out
      })(),
    },
    {
      name: "Snare",
      blocks: (() => {
        const out: Omit<Block, "id">[] = []
        for (let beat = 0; beat < 8; beat++) {
          out.push(block("delete", beat * 480 + 220, 180, 0.6))
        }
        return out
      })(),
    },
  ],
}

const swooshSweep: Demo = {
  id: "swoosh",
  label: "Swoosh sweep",
  description: "Filtered noise tail into a soft bell — page-transition vibe.",
  totalMs: 1400,
  lanes: [
    {
      name: "Sweep",
      blocks: [block("delete", 0, 320, 0.85), block("delete", 360, 220, 0.55)],
    },
    { name: "Bell", blocks: [block("message", 600, 420, 0.7)] },
  ],
}

export const demos: Demo[] = [heartbeat, notificationChime, gameOver, drumKit, swooshSweep]

export function findDemo(id: string): Demo | undefined {
  return demos.find((d) => d.id === id)
}
