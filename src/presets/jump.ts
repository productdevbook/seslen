/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Quick low→high blip — “jump”. */
export const jump: PresetEntry = {
  id: "jump",
  label: "Jump",
  description: "Quick rising blip for jumps and pop-up animations.",
  tags: ["game"],
  recipe: "square 220→880 Hz · 100 ms",
  motion: "bounce",
  accent: "green",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "square"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(220 * r, t)
    o.frequency.exponentialRampToValueAtTime(880 * r, t + 0.08)
    const peak = 0.1 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.12)
    return asHandle([o])
  },
}
