/// <reference path="../env.d.ts" />
import { asHandle, callDetune, callGain, callRate, type PresetEntry } from "./_meta.ts"

/** Bright two-tap — “copied!”. */
export const copy: PresetEntry = {
  id: "copy",
  label: "Copy",
  description: "Bright two-tap blip for copy-to-clipboard confirmations.",
  tags: ["ui", "feedback"],
  recipe: "sine 1480 + 1480 Hz · 90 ms",
  motion: "bounce",
  accent: "yellow",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const r = callRate(opts)
    const dt = callDetune(opts)
    const peak = 0.1 * callGain(opts)
    const oscs: OscillatorNode[] = []
    for (const off of [0, 0.05]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.detune.value = dt
      o.frequency.setValueAtTime(1480 * r, t + off)
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.linearRampToValueAtTime(peak, t + off + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.04)
      o.connect(g).connect(master)
      o.start(t + off)
      o.stop(t + off + 0.05)
      oscs.push(o)
    }
    return asHandle(oscs)
  },
}
