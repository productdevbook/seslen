/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Forward arpeggio — “redo / replay”. */
export const redo: PresetEntry = {
  id: "redo",
  label: "Redo",
  description: "Two-note forward blip for redo and replay actions.",
  tags: ["ui", "feedback"],
  recipe: "triangle 520→880 Hz · 180 ms",
  motion: "bounce",
  accent: "indigo",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "triangle"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(520 * r, t)
    o.frequency.linearRampToValueAtTime(880 * r, t + 0.16)
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
