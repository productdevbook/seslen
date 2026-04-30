/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Soft pickup chirp for drag-start. */
export const drag: PresetEntry = {
  id: "drag",
  label: "Drag",
  description: "Soft pickup chirp for the start of a drag gesture.",
  tags: ["ui", "drag"],
  recipe: "sine 440→660 Hz · 120 ms",
  motion: "pulse",
  accent: "orange",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(440 * r, t)
    o.frequency.linearRampToValueAtTime(660 * r, t + 0.1)
    const peak = 0.08 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.14)
    return asHandle([o])
  },
}
