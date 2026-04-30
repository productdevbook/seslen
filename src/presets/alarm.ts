/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Repeating two-tone alarm. Distinct from `warning` — sustained, not a one-shot. */
export const alarm: PresetEntry = {
  id: "alarm",
  label: "Alarm",
  description: "Repeating two-tone siren for sustained alarms and timed warnings.",
  tags: ["feedback", "warning"],
  recipe: "square 880↔660 Hz · 4 cycles · 800 ms",
  durationMs: 840,
  motion: "shake",
  accent: "red",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "square"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    const period = 0.18
    for (let i = 0; i < 4; i++) {
      const lo = t + i * period
      const hi = lo + period / 2
      o.frequency.setValueAtTime(880 * r, lo)
      o.frequency.setValueAtTime(660 * r, hi)
    }
    const peak = 0.12 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.setValueAtTime(peak, t + 0.78)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.82)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.84)
    return asHandle([o])
  },
}
