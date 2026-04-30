/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Soft sustained tap — “pasted”. */
export const paste: PresetEntry = {
  id: "paste",
  label: "Paste",
  description: "Soft sustained tap for paste / drop-in confirmations.",
  tags: ["ui", "feedback"],
  recipe: "sine 880 Hz · 80 ms",
  durationMs: 100,
  motion: "pulse",
  accent: "yellow",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(880 * r, t)
    const peak = 0.1 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.setValueAtTime(peak, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.1)
    return asHandle([o])
  },
}
