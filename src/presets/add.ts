/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Quick rising blip — “added / done”. */
export const add: PresetEntry = {
  id: "add",
  label: "Add",
  description: "A quick rising blip for adding items, ticking todos and incrementing counters.",
  tags: ["ui", "feedback", "chirp"],
  recipe: "sine 880→1480 Hz · 140 ms",
  motion: "bounce",
  accent: "teal",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(880 * r, t)
    o.frequency.linearRampToValueAtTime(1480 * r, t + 0.08)
    const peak = 0.13 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.16)
    return asHandle([o])
  },
}
