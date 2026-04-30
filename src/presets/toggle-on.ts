/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two-step ascending click — “switch enabled”. */
export const toggleOn: PresetEntry = {
  id: "toggle-on",
  label: "Toggle on",
  description: "A two-step ascending click for switches and checkboxes turning on.",
  tags: ["ui", "feedback", "toggle"],
  recipe: "sine 700 + 1100 Hz · 110 ms",
  durationMs: 130,
  motion: "bounce",
  accent: "green",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.1 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const notes: [number, number][] = [
      [700, 0],
      [1100, 0.05],
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
