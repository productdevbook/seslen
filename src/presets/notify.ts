/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Three-tone ascending notification — distinct from `message`/`success`. */
export const notify: PresetEntry = {
  id: "notify",
  label: "Notify",
  description: "Three-tone ascending notification for in-app alerts and banners.",
  tags: ["notification", "chirp"],
  recipe: "sine 660-880-1320 Hz · 360 ms",
  motion: "pulse",
  accent: "blue",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.13 * callGain(opts)
    const oscs: OscillatorNode[] = []
    const notes: [number, number][] = [
      [660, 0],
      [880, 0.1],
      [1320, 0.2],
    ]
    for (const [freq, off] of notes) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.detune.value = dt
      o.frequency.setValueAtTime(freq * r, t + off)
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
