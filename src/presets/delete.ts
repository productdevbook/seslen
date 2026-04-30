/// <reference path="../env.d.ts" />
import { asHandle, callGain, callRate, noiseBurst, type PresetEntry } from "./_meta.ts"

/** Filtered noise sweep — “delete / swoosh”. */
export const deletePreset: PresetEntry = {
  id: "delete",
  label: "Delete",
  description: "Filtered noise swoosh for removing items and dismissing dialogs.",
  tags: ["ui", "noise", "sweep"],
  recipe: "noise sweep 4 kHz→400 Hz · 200 ms",
  durationMs: 220,
  motion: "swirl",
  accent: "purple",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const src = noiseBurst(ctx, 0.2)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    filter.type = "lowpass"
    filter.Q.value = 4
    const r = callRate(opts)
    filter.frequency.setValueAtTime(4000 * r, t)
    filter.frequency.exponentialRampToValueAtTime(400 * r, t + 0.18)
    const peak = 0.18 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    src.connect(filter).connect(g).connect(master)
    src.start(t)
    src.stop(t + 0.22)
    return asHandle([src])
  },
}
