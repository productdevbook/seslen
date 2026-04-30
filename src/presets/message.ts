/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Soft two-tone bell — “message”. */
export const message: PresetEntry = {
  id: "message",
  label: "Message",
  description: "Soft two-tone bell for incoming messages and notifications.",
  tags: ["notification", "bell"],
  recipe: "sine 880 + 1320 Hz · 420 ms",
  motion: "pulse",
  accent: "indigo",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const peak = 0.14 * callGain(opts)
    const r = callRate(opts)
    const dt = callDetune(opts)

    const o1 = ctx.createOscillator()
    const g1 = ctx.createGain()
    o1.type = "sine"
    o1.detune.value = dt
    o1.frequency.setValueAtTime(880 * r, t)
    g1.gain.setValueAtTime(0.0001, t)
    g1.gain.linearRampToValueAtTime(peak, t + 0.01)
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    o1.connect(g1).connect(master)
    o1.start(t)
    o1.stop(t + 0.3)

    const o2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    o2.type = "sine"
    o2.detune.value = dt
    o2.frequency.setValueAtTime(1320 * r, t + 0.08)
    g2.gain.setValueAtTime(0.0001, t + 0.08)
    g2.gain.linearRampToValueAtTime(peak * 0.85, t + 0.09)
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    o2.connect(g2).connect(master)
    o2.start(t + 0.08)
    o2.stop(t + 0.42)

    return asHandle([o1, o2])
  },
}
