/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Tiny dry tick — typewriter / streaming text character. Heavy jitter. */
export const typewriter: PresetEntry = {
  id: "typewriter",
  label: "Typewriter",
  description: "Tiny dry tick for streaming text and typewriter character reveals.",
  tags: ["ui", "click"],
  recipe: "triangle 2.6 kHz · 8 ms",
  durationMs: 10,
  motion: "bounce",
  accent: "purple",
  defaults: {
    rateJitter: 0.15,
    detuneJitter: 120,
    gainJitter: 0.25,
    minInterval: 18,
    voices: 6,
    steal: "oldest",
  },
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "triangle"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(2600 * r, t)
    const peak = 0.05 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.008)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.01)
    return asHandle([o])
  },
}
