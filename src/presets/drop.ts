/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Short thud for drop / release. */
export const drop: PresetEntry = {
  id: "drop",
  label: "Drop",
  description: "Short low thud for the end of a drag gesture or item drop.",
  tags: ["ui", "drag"],
  recipe: "sine 220→110 Hz · 120 ms",
  durationMs: 150,
  motion: "shake",
  accent: "orange",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(220 * r, t)
    o.frequency.exponentialRampToValueAtTime(110 * r, t + 0.1)
    const peak = 0.16 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.15)
    return asHandle([o])
  },
}
