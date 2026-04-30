/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two-step descending click — “switch disabled”. */
export const toggleOff: PresetEntry = {
  id: "toggle-off",
  label: "Toggle off",
  description: "A two-step descending click for switches and checkboxes turning off.",
  tags: ["ui", "feedback", "toggle"],
  recipe: "sine 1100 + 700 Hz · 110 ms",
  durationMs: 130,
  motion: "bounce",
  accent: "red",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.1 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const notes: [number, number][] = [
      [1100, 0],
      [700, 0.05],
    ]
    for (const [freq, off] of notes) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.detune.value = dt
      o.frequency.setValueAtTime(freq * r, t + off)
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.linearRampToValueAtTime(peak, t + off + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.06)
      o.connect(g).connect(master)
      o.start(t + off)
      o.stop(t + off + 0.08)
      oscs.push(o)
    }
    return asHandle(oscs)
  },
}
