/// <reference path="../env.d.ts" />
import { asHandle, callGain, callRate, noiseBurst, type PresetEntry } from "./_meta.ts"

/** Whoosh-up for send / submit / publish. */
export const send: PresetEntry = {
  id: "send",
  label: "Send",
  description: "Rising whoosh for send, submit and publish actions.",
  tags: ["ui", "noise", "sweep"],
  recipe: "noise sweep 600→4000 Hz · 220 ms",
  durationMs: 240,
  motion: "swirl",
  accent: "blue",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const src = noiseBurst(ctx, 0.22)
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    filter.type = "highpass"
    filter.Q.value = 3
    const r = callRate(opts)
    filter.frequency.setValueAtTime(600 * r, t)
    filter.frequency.exponentialRampToValueAtTime(4000 * r, t + 0.2)
    const peak = 0.18 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    src.connect(filter).connect(g).connect(master)
    src.start(t)
    src.stop(t + 0.24)
    return asHandle([src])
  },
}
