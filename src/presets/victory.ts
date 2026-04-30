/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Major arpeggio — “victory”. */
export const victory: PresetEntry = {
  id: "victory",
  label: "Victory",
  description: "A four-note major arpeggio for level-ups and game-style success.",
  tags: ["game", "success", "arpeggio"],
  recipe: "C-E-G-C arpeggio · 360 ms",
  motion: "flash",
  accent: "yellow",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const peak = 0.16 * callGain(opts)
    const r = callRate(opts)
    const dt = callDetune(opts)
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    const step = 0.09
    const oscs: OscillatorNode[] = []
    for (let i = 0; i < notes.length; i++) {
      const start = t + i * step
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "triangle"
      o.detune.value = dt
      o.frequency.setValueAtTime((notes[i] as number) * r, start)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.linearRampToValueAtTime(peak, start + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.24)
      o.connect(g).connect(master)
      o.start(start)
      o.stop(start + 0.26)
      oscs.push(o)
    }
    return asHandle(oscs)
  },
}
