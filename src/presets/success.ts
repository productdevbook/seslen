/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two-step rising chirp — “success”. */
export const success: PresetEntry = {
  id: "success",
  label: "Success",
  description: "Two-step rising chirp for completed actions and confirmations.",
  tags: ["feedback", "success", "chirp"],
  recipe: "triangle 660→990→1320 Hz · 320 ms",
  durationMs: 340,
  motion: "bounce",
  accent: "green",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "triangle"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(660 * r, t)
    o.frequency.linearRampToValueAtTime(990 * r, t + 0.08)
    o.frequency.linearRampToValueAtTime(1320 * r, t + 0.18)
    const peak = 0.18 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.34)
    return asHandle([o])
  },
}
