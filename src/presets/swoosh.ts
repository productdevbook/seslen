/// <reference path="../env.d.ts" />
import { asHandle, callGain, callRate, noiseBurst, type PresetEntry } from "./_meta.ts"

/** Filtered noise rising sweep — “swoosh / open / reveal”. */
export const swoosh: PresetEntry = {
  id: "swoosh",
  label: "Swoosh",
  description: "Filtered noise sweep for transitions, modal opens and panel reveals.",
  tags: ["ui", "noise", "sweep"],
  recipe: "noise sweep 400→4000 Hz · 240 ms",
  durationMs: 260,
  motion: "swirl",
  accent: "indigo",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const src = noiseBurst(ctx, 0.24)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    filter.type = "bandpass"
    filter.Q.value = 6
    const r = callRate(opts)
    filter.frequency.setValueAtTime(400 * r, t)
    filter.frequency.exponentialRampToValueAtTime(4000 * r, t + 0.22)
    const peak = 0.16 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    src.connect(filter).connect(g).connect(master)
    src.start(t)
    src.stop(t + 0.26)
    return asHandle([src])
  },
}
