/// <reference path="../env.d.ts" />
import { asHandle, callGain, callRate, noiseBurst, type PresetEntry } from "./_meta.ts"

/** Bandpassed noise zap — “shoot / laser”. */
export const shoot: PresetEntry = {
  id: "shoot",
  label: "Shoot",
  description: "Bandpassed noise zap for shoots, lasers and quick projectiles.",
  tags: ["game", "noise"],
  recipe: "noise sweep 5 kHz→500 Hz · 130 ms",
  motion: "shake",
  accent: "red",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const src = noiseBurst(ctx, 0.13)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    filter.type = "bandpass"
    filter.Q.value = 12
    const r = callRate(opts)
    filter.frequency.setValueAtTime(5000 * r, t)
    filter.frequency.exponentialRampToValueAtTime(500 * r, t + 0.12)
    const peak = 0.18 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    src.connect(filter).connect(g).connect(master)
    src.start(t)
    src.stop(t + 0.14)
    return asHandle([src])
  },
}
