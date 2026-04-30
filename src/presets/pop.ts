/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Bubbly downward pop for popovers, dismissals and lightweight toggles. */
export const pop: PresetEntry = {
  id: "pop",
  label: "Pop",
  description: "Bubbly downward pop for popovers, dismissals and lightweight toggles.",
  tags: ["ui", "feedback"],
  recipe: "triangle 1200→320 Hz · 90 ms",
  motion: "bounce",
  accent: "pink",
  defaults: { rateJitter: 0.04, gainJitter: 0.08 },
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "triangle"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(1200 * r, t)
    o.frequency.exponentialRampToValueAtTime(320 * r, t + 0.08)
    const peak = 0.12 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.1)
    return asHandle([o])
  },
}
