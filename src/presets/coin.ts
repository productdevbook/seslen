/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Two-note metallic ping — “coin / pickup”. */
export const coin: PresetEntry = {
  id: "coin",
  label: "Coin",
  description: "Two-note metallic ping for coin pickups, points and item collections.",
  tags: ["game", "pickup"],
  recipe: "square 988 + 1320 Hz · 180 ms",
  motion: "flash",
  accent: "yellow",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.12 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const notes: [number, number][] = [
      [988, 0],
      [1320, 0.04],
    ]
    for (const [freq, off] of notes) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "square"
      o.detune.value = dt
      o.frequency.setValueAtTime(freq * r, t + off)
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.linearRampToValueAtTime(peak, t + off + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.14)
      o.connect(g).connect(master)
      o.start(t + off)
      o.stop(t + off + 0.16)
      oscs.push(o)
    }
    return asHandle(oscs)
  },
}
