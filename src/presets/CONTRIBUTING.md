# Contributing a preset

Presets are the friendliest part of `seslen` to contribute to — every sound is one self-contained file with no central wiring beyond a single import. We ship a starter playground (`/web`) where you can hear every preset live, including yours.

## Quick start

1. **Copy the template.**

   ```bash
   cp src/presets/_template.ts src/presets/<your-id>.ts
   ```

2. **Fill in the metadata.** Every field in `PresetEntry` matters:

   | field         | rule                                                                                                   |
   | ------------- | ------------------------------------------------------------------------------------------------------ |
   | `id`          | lower-case, kebab-style, single word if possible. **Stable**.                                          |
   | `label`       | Title-case, used in demos.                                                                             |
   | `description` | One sentence: when _should_ this sound be played?                                                      |
   | `tags`        | At least one. Use canonical tags (see `_meta.ts`) when possible.                                       |
   | `recipe`      | One short line, e.g. `"sine 1 kHz · 100 ms"`.                                                          |
   | `motion`      | Optional demo hint: `bounce`, `shake`, `wiggle`, `pulse`, `swirl`, `flash`.                            |
   | `accent`      | Optional theme colour: `green`, `red`, `orange`, `yellow`, `blue`, `indigo`, `purple`, `pink`, `teal`. |
   | `author`      | Your GitHub handle. We credit you on every release.                                                    |
   | `factory`     | The synthesis function — see below.                                                                    |

3. **Write the factory.** A factory is a pure function:

   ```ts
   factory(ctx, master, opts) => PlayHandle
   ```

   Rules of thumb:
   - **Always** multiply your envelope peak by `callGain(opts)` so per-call gain works.
   - **Always** schedule an explicit `o.stop(t + tailEnd)`; never rely on decay alone.
   - Keep total duration ≤ 800 ms unless the sound is genuinely musical (e.g. `victory`).
   - Avoid distinct harsh frequencies above 8 kHz; they fatigue listeners.
   - Return `asHandle(stoppableNodes)` — pass every `OscillatorNode` /
     `AudioBufferSourceNode` you started, so the caller's `stop()` works.

4. **Wire it up.** In `src/presets/index.ts`:

   ```ts
   import { myPreset } from "./<your-id>.ts"

   export const presetEntries: Record<string, PresetEntry> = {
     // ...
     [myPreset.id]: myPreset,
   }
   ```

5. **Hear it.** Run the playground:

   ```bash
   cd web && pnpm install && pnpm dev
   ```

   Your preset shows up in the grid automatically — no UI changes needed. Type its `id`, `label`, `description` or any of its tags into the search box; click any of its tags to filter.

## Style guide

- **Loudness:** target peak gain ≤ 0.18 (linear). The master gain in real apps is usually ≤ 0.8, so a peak of 0.18 lands well under harsh territory.
- **Tail:** always end on `exponentialRampToValueAtTime(0.0001, t + tail)` — never a hard cut.
- **Pitch:** prefer notes that fit a major scale unless the preset is intentionally dissonant (e.g. `error`).
- **Randomness:** small randomisation (e.g. ±200 Hz on `tick`) makes a preset feel alive without being inconsistent. Keep it under 10% of the base frequency.

## What gets accepted

- Sounds that fit a recognisable UI/feedback role (success, error, hover, drag, drop, expand, collapse, undo, redo, send, receive, copy, paste, …).
- Sounds that are short, distinct, and good defaults for the role they target.
- Sounds whose envelope is well-controlled — no clicks, no DC offsets, no clipping.

## What we'll send back for revisions

- Sounds whose `id` clashes with an existing preset's role.
- Factories that allocate inside a tight loop (e.g. multiple oscillators per frame).
- Effects that depend on `OfflineAudioContext` or `AudioWorkletNode` — too heavy for v0.
- Anything that requires a network fetch — built-in presets must be pure synthesis.

## Crediting

Every contributor with a merged preset is listed in `README.md` and tagged on the GitHub release.
