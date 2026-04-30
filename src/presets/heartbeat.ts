/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two-pulse low thump — heartbeat. */
export const heartbeat: PresetEntry = {
  id: "heartbeat",
  label: "Heartbeat",
  description: "Two low thumps spaced like a human heartbeat — for tension and pulse states.",
  tags: ["ambient", "rhythm"],
  recipe: "sine 60 Hz double-thump · 600 ms",
  motion: "pulse",
  accent: "red",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.22 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const offs: number[] = [0, 0.18]
    for (const off of offs) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.detune.value = dt
      o.frequency.setValueAtTime(60 * r, t + off)
      o.frequency.exponentialRampToValueAtTime(40 * r, t + off + 0.14)
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.linearRampToValueAtTime(peak, t + off + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.16)
      o.connect(g).connect(master)
      o.start(t + off)
      o.stop(t + off + 0.18)
      oscs.push(o)
    }
    return asHandle(oscs)
  },
}
