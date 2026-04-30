/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Soft, very quiet sine puff for hover affordance — easy to play 60×/sec. */
export const hover: PresetEntry = {
  id: "hover",
  label: "Hover",
  description: "A near-silent sine puff for hover affordance — safe to fire repeatedly.",
  tags: ["ui", "hover"],
  recipe: "sine 2.4 kHz · 25 ms",
  durationMs: 30,
  motion: "pulse",
  accent: "blue",
  defaults: { rateJitter: 0.05, gainJitter: 0.1, minInterval: 40, voices: 3, steal: "oldest" },
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(2400 * r, t)
    const peak = 0.018 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.03)
    return asHandle([o])
  },
}
