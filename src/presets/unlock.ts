/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two light clicks rising — unlocking. */
export const unlock: PresetEntry = {
  id: "unlock",
  label: "Unlock",
  description: "Two light clicks rising in pitch for unlock and grant-access actions.",
  tags: ["ui", "feedback", "click"],
  recipe: "triangle 220 + 440 Hz · 140 ms",
  durationMs: 140,
  motion: "bounce",
  accent: "teal",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.12 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const notes: [number, number][] = [
      [220, 0],
      [440, 0.06],
    ]
    for (const [freq, off] of notes) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "triangle"
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
