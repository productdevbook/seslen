/// <reference path="../env.d.ts" />
import { asHandle, callGain, callRate, noiseBurst, type PresetEntry } from "./_meta.ts"

/** Lowpass noise explosion. */
export const explosion: PresetEntry = {
  id: "explosion",
  label: "Explosion",
  description: "Low rumbling noise burst for explosions, crashes and impact moments.",
  tags: ["game", "noise"],
  recipe: "noise lowpass 2 kHz→100 Hz · 600 ms",
  durationMs: 620,
  motion: "shake",
  accent: "red",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const src = noiseBurst(ctx, 0.6)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    filter.type = "lowpass"
    filter.Q.value = 1
    const r = callRate(opts)
    filter.frequency.setValueAtTime(2000 * r, t)
    filter.frequency.exponentialRampToValueAtTime(100 * r, t + 0.55)
    const peak = 0.22 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    src.connect(filter).connect(g).connect(master)
    src.start(t)
    src.stop(t + 0.62)
    return asHandle([src])
  },
}
