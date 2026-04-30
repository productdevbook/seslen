/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Detuned descending square — “error”. */
export const error: PresetEntry = {
  id: "error",
  label: "Error",
  description: "A short descending buzz for failed or rejected actions.",
  tags: ["feedback", "error"],
  recipe: "square 220→150 Hz · 260 ms",
  durationMs: 280,
  motion: "shake",
  accent: "red",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "square"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(220 * r, t)
    o.frequency.linearRampToValueAtTime(150 * r, t + 0.22)
    const peak = 0.12 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.28)
    return asHandle([o])
  },
}
