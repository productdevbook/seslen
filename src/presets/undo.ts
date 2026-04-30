/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Reverse-arpeggio — “undo / step back”. */
export const undo: PresetEntry = {
  id: "undo",
  label: "Undo",
  description: "Two-note reverse blip for undo, back and step-back actions.",
  tags: ["ui", "feedback"],
  recipe: "triangle 880→520 Hz · 180 ms",
  durationMs: 200,
  motion: "shake",
  accent: "indigo",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "triangle"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(880 * r, t)
    o.frequency.linearRampToValueAtTime(520 * r, t + 0.16)
    const peak = 0.1 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.2)
    return asHandle([o])
  },
}
