/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Falling arc — “closing / collapsing”. */
export const collapse: PresetEntry = {
  id: "collapse",
  label: "Collapse",
  description: "Falling arc for accordions, drawers and panels collapsing.",
  tags: ["ui", "transition"],
  recipe: "sine 990→330 Hz · 200 ms",
  motion: "pulse",
  accent: "teal",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(990 * r, t)
    o.frequency.exponentialRampToValueAtTime(330 * r, t + 0.18)
    const peak = 0.1 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.22)
    return asHandle([o])
  },
}
