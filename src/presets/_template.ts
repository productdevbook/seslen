/// <reference path="../env.d.ts" />
import { asHandle, callGain, type PresetEntry } from "./_meta.ts"

/**
 * TEMPLATE — copy this file to `<your-id>.ts` and fill in the blanks.
 *
 * Checklist:
 *   1. Pick a stable `id` (lower-case, kebab-style, single word if possible).
 *   2. Keep `description` to one sentence.
 *   3. Tag with at least one canonical tag (see `_meta.ts`).
 *   4. Keep total duration ≤ 800 ms unless the sound is genuinely musical.
 *   5. Always multiply your envelope peak by `callGain(opts)`.
 *   6. Schedule a hard `stop()` past the envelope tail so the source is
 *      released — never rely on natural decay alone.
 *   7. Wire up to `presets/index.ts` (one import + one entry).
 */
export const myPreset: PresetEntry = {
  id: "my-preset",
  label: "My Preset",
  description: "One-sentence description of when to use this sound.",
  tags: ["ui"],
  recipe: "sine 1 kHz · 100 ms",
  motion: "bounce",
  accent: "blue",
  // author: "your-github-handle",
  factory(ctx, master, opts) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    o.frequency.setValueAtTime(1000, t)
    const peak = 0.1 * callGain(opts)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.12)
    return asHandle([o])
  },
}
