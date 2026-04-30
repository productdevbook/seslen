/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Soft drop chime — incoming message / receive. */
export const receive: PresetEntry = {
  id: "receive",
  label: "Receive",
  description: "Soft falling chime for incoming messages and received items.",
  tags: ["notification", "chirp"],
  recipe: "sine 1320→880 Hz · 220 ms",
  durationMs: 240,
  motion: "pulse",
  accent: "teal",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    const r = callRate(opts)
    o.detune.value = callDetune(opts)
    o.frequency.setValueAtTime(1320 * r, t)
    o.frequency.linearRampToValueAtTime(880 * r, t + 0.18)
    const peak = 0.12 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.24)
    return asHandle([o])
  },
}
