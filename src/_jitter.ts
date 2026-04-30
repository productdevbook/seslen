import type { PlayOptions, SourceDefaults } from "./_types.ts"

/**
 * Apply per-call ± random jitter to `rate`, `gain` and `detune`. A small
 * amount of variation (`rateJitter: 0.05`, `detuneJitter: 30`) is enough to
 * make repeated UI ticks feel alive without being inconsistent.
 *
 * Returns a *new* options object — never mutates the caller's input.
 */
export function applyJitter(opts: PlayOptions, defaults: SourceDefaults | undefined): PlayOptions {
  const rateJ = pick(opts.rateJitter, defaults?.rateJitter, 0)
  const gainJ = pick(opts.gainJitter, defaults?.gainJitter, 0)
  const detuneJ = pick(opts.detuneJitter, defaults?.detuneJitter, 0)
  if (rateJ === 0 && gainJ === 0 && detuneJ === 0) return opts

  const out: PlayOptions = { ...opts }
  if (rateJ !== 0) {
    const base = opts.rate ?? defaults?.rate ?? 1
    out.rate = base * (1 + (Math.random() * 2 - 1) * rateJ)
  }
  if (gainJ !== 0) {
    const base = opts.gain ?? defaults?.gain ?? 1
    out.gain = clamp01(base * (1 + (Math.random() * 2 - 1) * gainJ))
  }
  if (detuneJ !== 0) {
    const base = opts.detune ?? defaults?.detune ?? 0
    out.detune = base + (Math.random() * 2 - 1) * detuneJ
  }
  return out
}

/** Merge per-source defaults into a play-options object without overwriting
 *  fields the caller explicitly set. */
export function mergeDefaults(
  opts: PlayOptions,
  defaults: SourceDefaults | undefined,
): PlayOptions {
  if (!defaults) return opts
  const out: PlayOptions = { ...opts }
  if (out.gain === undefined && defaults.gain !== undefined) out.gain = defaults.gain
  if (out.rate === undefined && defaults.rate !== undefined) out.rate = defaults.rate
  if (out.detune === undefined && defaults.detune !== undefined) out.detune = defaults.detune
  if (out.pan === undefined && defaults.pan !== undefined) out.pan = defaults.pan
  if (out.bus === undefined && defaults.bus !== undefined) out.bus = defaults.bus
  return out
}

function pick(...values: (number | undefined)[]): number {
  for (const v of values) if (v !== undefined && Number.isFinite(v)) return v
  return 0
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}
