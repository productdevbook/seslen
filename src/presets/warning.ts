/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two-tone alarm — “warning”. */
export const warning: PresetEntry = {
  id: "warning",
  label: "Warning",
  description: "Two-tone alarm for cautions and confirmations that need attention.",
  tags: ["feedback", "warning"],
  recipe: "square 880↔660 Hz · 500 ms",
  motion: "wiggle",
  accent: "orange",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "square"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(880 * r, t)
    o.frequency.setValueAtTime(660 * r, t + 0.16)
    o.frequency.setValueAtTime(880 * r, t + 0.32)
    const peak = 0.1 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.setValueAtTime(peak, t + 0.46)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.52)
    return asHandle([o])
  },
}
