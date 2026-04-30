/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Mechanical keyboard-style click. Heavy jitter so 60-wpm feels organic. */
export const keypress: PresetEntry = {
  id: "keypress",
  label: "Keypress",
  description: "A short mechanical-key click — defaults to heavy jitter so typing feels organic.",
  tags: ["ui", "click", "keyboard"],
  recipe: "square 1.8 kHz · 12 ms",
  motion: "bounce",
  accent: "purple",
  defaults: { rateJitter: 0.12, detuneJitter: 80, gainJitter: 0.2, minInterval: 30 },
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "square"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(1800 * r, t)
    const peak = 0.06 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.014)
    return asHandle([o])
  },
}
