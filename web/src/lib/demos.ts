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

interface BlockOpts {
  duration?: number
  intensity?: number
  rate?: number
  detune?: number
}

function block(presetId: string, position: number, opts: BlockOpts = {}): Omit<Block, "id"> {
  return {
    presetId,
    position,
    duration: opts.duration ?? 80,
    intensity: opts.intensity ?? 0.7,
    rate: opts.rate,
    detune: opts.detune,
  }
}

const heartbeat: Demo = {
  id: "heartbeat",
  label: "Heartbeat",
  description: "Lub-dub pulse at ~70 bpm — calm ambient loop.",
  totalMs: 3500,
  lanes: [
    {
      name: "Lub",
      blocks: [0, 860, 1720, 2580].map((t) =>
        block("heartbeat", t, { duration: 360, intensity: 0.9 }),
      ),
    },
    {
      name: "Dub",
      blocks: [220, 1080, 1940, 2800].map((t) =>
        block("heartbeat", t, { duration: 360, intensity: 0.55, rate: 0.85 }),
      ),
    },
  ],
}

const typingFlow: Demo = {
  id: "typing-flow",
  label: "Typing → send",
  description: "Keypress chatter resolving into a whoosh — chat send vibe.",
  totalMs: 2400,
  lanes: [
    {
      name: "Keys",
      blocks: (() => {
        // Stable pseudo-random pattern so the demo is deterministic
        // (matters for share links and snapshot tests).
        const offsets = [0, 110, 230, 380, 470, 590, 720, 840, 960, 1080, 1240, 1360, 1500]
        const intensities = [0.7, 0.6, 0.75, 0.55, 0.7, 0.65, 0.8, 0.6, 0.7, 0.55, 0.75, 0.65, 0.7]
        const detunes = [-60, 40, 80, -20, 100, -80, 20, 60, -40, 0, 80, -60, 40]
        return offsets.map((t, i) =>
          block("keypress", t, {
            duration: 30,
            intensity: intensities[i],
            detune: detunes[i],
          }),
        )
      })(),
    },
    {
      name: "Send",
      blocks: [
        block("send", 1700, { duration: 240, intensity: 0.85 }),
        block("success", 1900, { duration: 340, intensity: 0.7 }),
      ],
    },
  ],
}

const coinRun: Demo = {
  id: "coin-run",
  label: "Coin run",
  description: "Jump, three rising coins, level-up fanfare.",
  totalMs: 2400,
  lanes: [
    {
      name: "Hero",
      blocks: [block("jump", 0, { duration: 120, intensity: 0.85 })],
    },
    {
      name: "Coins",
      blocks: [
        block("coin", 220, { duration: 200, intensity: 0.8 }),
        block("coin", 460, { duration: 200, intensity: 0.85, detune: 200 }),
        block("coin", 700, { duration: 200, intensity: 0.9, detune: 400 }),
      ],
    },
    {
      name: "Reward",
      blocks: [block("level-up", 1000, { duration: 700, intensity: 0.95 })],
    },
  ],
}

const notificationStack: Demo = {
  id: "notify-stack",
  label: "Notification stack",
  description: "Three messages arriving in quick succession.",
  totalMs: 2200,
  lanes: [
    {
      name: "Bell",
      blocks: [
        block("message", 0, { duration: 420, intensity: 0.85 }),
        block("notify", 600, { duration: 380, intensity: 0.75, detune: 120 }),
        block("receive", 1200, { duration: 240, intensity: 0.7, detune: -100 }),
      ],
    },
    {
      name: "Pop",
      blocks: [
        block("pop", 80, { duration: 80, intensity: 0.6 }),
        block("pop", 680, { duration: 80, intensity: 0.55 }),
        block("pop", 1280, { duration: 80, intensity: 0.5 }),
      ],
    },
  ],
}

const lockUnlock: Demo = {
  id: "lock-unlock",
  label: "Lock → unlock",
  description: "Bolt clicks shut, beat, then opens with a confirm chime.",
  totalMs: 1800,
  lanes: [
    {
      name: "Bolt",
      blocks: [
        block("lock", 0, { duration: 140, intensity: 0.85 }),
        block("unlock", 900, { duration: 140, intensity: 0.85 }),
      ],
    },
    {
      name: "Confirm",
      blocks: [block("success", 1060, { duration: 340, intensity: 0.8 })],
    },
  ],
}

const bossFight: Demo = {
  id: "boss-fight",
  label: "Boss fight",
  description: "Warning, four shots, explosion, victory arpeggio.",
  totalMs: 3600,
  lanes: [
    {
      name: "Alert",
      blocks: [block("warning", 0, { duration: 520, intensity: 0.85 })],
    },
    {
      name: "Shots",
      blocks: [
        block("shoot", 600, { duration: 140, intensity: 0.75 }),
        block("shoot", 820, { duration: 140, intensity: 0.75, detune: -120 }),
        block("shoot", 1040, { duration: 140, intensity: 0.8, detune: 120 }),
        block("shoot", 1260, { duration: 140, intensity: 0.85 }),
      ],
    },
    {
      name: "Boom",
      blocks: [block("explosion", 1500, { duration: 620, intensity: 0.95 })],
    },
    {
      name: "Win",
      blocks: [
        block("victory", 2300, { duration: 600, intensity: 0.95 }),
        block("coin", 2500, { duration: 200, intensity: 0.7, detune: 300 }),
        block("coin", 2700, { duration: 200, intensity: 0.7, detune: 500 }),
      ],
    },
  ],
}

const toggleDance: Demo = {
  id: "toggle-dance",
  label: "Toggle dance",
  description: "Alternating switch flicks over a hover bed.",
  totalMs: 2200,
  lanes: [
    {
      name: "Switches",
      blocks: [
        block("toggle-on", 0, { duration: 130, intensity: 0.85 }),
        block("toggle-off", 280, { duration: 130, intensity: 0.7 }),
        block("toggle-on", 560, { duration: 130, intensity: 0.8 }),
        block("toggle-off", 840, { duration: 130, intensity: 0.7 }),
        block("toggle-on", 1120, { duration: 130, intensity: 0.9 }),
        block("toggle-off", 1400, { duration: 130, intensity: 0.75 }),
      ],
    },
    {
      name: "Hover",
      blocks: (() => {
        const out: Omit<Block, "id">[] = []
        for (let t = 0; t < 1700; t += 140) {
          out.push(
            block("hover", t, {
              duration: 30,
              intensity: 0.4,
              detune: t % 280 === 0 ? 0 : 200,
            }),
          )
        }
        return out
      })(),
    },
    {
      name: "Cap",
      blocks: [block("success", 1700, { duration: 340, intensity: 0.8 })],
    },
  ],
}

const swooshTransition: Demo = {
  id: "swoosh",
  label: "Swoosh transition",
  description: "Filtered sweep into a soft bell — page-transition vibe.",
  totalMs: 1600,
  lanes: [
    {
      name: "Sweep",
      blocks: [
        block("swoosh", 0, { duration: 260, intensity: 0.85 }),
        block("swoosh", 280, { duration: 260, intensity: 0.55, rate: 1.2 }),
      ],
    },
    {
      name: "Bell",
      blocks: [block("message", 600, { duration: 420, intensity: 0.7 })],
    },
  ],
}

export const demos: Demo[] = [
  heartbeat,
  typingFlow,
  coinRun,
  notificationStack,
  lockUnlock,
  bossFight,
  toggleDance,
  swooshTransition,
]

export function findDemo(id: string): Demo | undefined {
  return demos.find((d) => d.id === id)
}
