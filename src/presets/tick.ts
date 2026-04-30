/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/**
 * Soft, sharp UI tick.
 *   sine 4000–4400 Hz, 3 ms attack/decay envelope.
 */
export const tick: PresetEntry = {
  id: "tick",
  label: "Tick",
  description: "A short, crisp click for buttons, toggles and toasts.",
  tags: ["ui", "feedback", "click"],
  recipe: "sine 4 kHz · 3 ms",
  motion: "bounce",
  accent: "blue",
  defaults: { rateJitter: 0.04, gainJitter: 0.08, minInterval: 25 },
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime((4000 + Math.random() * 400) * r, t)
    const peak = 0.035 * callGain(opts)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.003)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.005)
    return asHandle([o])
  },
}
