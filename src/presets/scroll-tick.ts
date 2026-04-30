/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Tiny detent click for scroll-wheels, sliders and steppers. */
export const scrollTick: PresetEntry = {
  id: "scroll-tick",
  label: "Scroll tick",
  description: "Tiny detent click for scroll wheels, sliders, steppers and value pickers.",
  tags: ["ui", "click"],
  recipe: "triangle 3 kHz · 6 ms",
  motion: "bounce",
  accent: "teal",
  defaults: { rateJitter: 0.06, detuneJitter: 40, minInterval: 20, voices: 4, steal: "oldest" },
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "triangle"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(3000 * r, t)
    const peak = 0.04 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.008)
    return asHandle([o])
  },
}
