/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two heavy clicks — locking. */
export const lock: PresetEntry = {
  id: "lock",
  label: "Lock",
  description: "Two heavy clicks for locking, sealing and confirming a secured state.",
  tags: ["ui", "feedback", "click"],
  recipe: "square 320 + 220 Hz · 140 ms",
  durationMs: 140,
  motion: "shake",
  accent: "indigo",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.14 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const notes: [number, number][] = [
      [320, 0],
      [220, 0.06],
    ]
    for (const [freq, off] of notes) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "square"
      o.detune.value = dt
      o.frequency.setValueAtTime(freq * r, t + off)
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.linearRampToValueAtTime(peak, t + off + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.06)
      o.connect(g).connect(master)
      o.start(t + off)
      o.stop(t + off + 0.08)
      oscs.push(o)
    }
    return asHandle(oscs)
  },
}
