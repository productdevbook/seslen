/// <reference path="../env.d.ts" />
import type { SoundFactory, SourceDefaults } from "../_types.ts"

/**
 * The full descriptor for a built-in preset.
 *
 * Every preset ships its own metadata so contributors can add a sound
 * without touching central wiring. Tag your preset with one or more of
 * the canonical tags below; new tags are welcome — keep them short and
 * lower-case.
 *
 * Canonical tags (non-exhaustive):
 *   ui          interactive feedback (clicks, hovers)
 *   feedback    state change (success, error)
 *   success     positive completion
 *   error       negative completion
 *   warning     caution / heads-up
 *   notification background event (message, ping)
 *   game        game-style success / level-up
 *   bell        bell-like ring
 *   chirp       short pitched glide
 *   noise       contains noise components
 *   sweep       a frequency or filter sweep
 *   arpeggio    multiple stacked notes
 */
export interface PresetEntry {
  /** Stable ID, lowercase, kebab-style. Used as the registry key. */
  readonly id: string
  /** Human label shown in UIs (e.g. demos). */
  readonly label: string
  /** One-sentence description of when to use this sound. */
  readonly description: string
  /** Tags — used for search & filtering. */
  readonly tags: readonly string[]
  /** One-line synthesis recipe, e.g. `"sine 4 kHz · 3 ms"`. */
  readonly recipe: string
  /**
   * Optional preview animation hint for demos. Pure data — not enforced
   * by the library. Demos may map this to their own keyframes.
   */
  readonly motion?: "bounce" | "shake" | "wiggle" | "pulse" | "swirl" | "flash"
  /**
   * Optional accent colour for demos. Should be a CSS colour token name
   * (e.g. `"green"`, `"red"`) — demos resolve it through their theme.
   */
  readonly accent?:
    | "green"
    | "red"
    | "orange"
    | "yellow"
    | "blue"
    | "indigo"
    | "purple"
    | "pink"
    | "teal"
  /** GitHub handle of the original contributor. */
  readonly author?: string
  /** Optional per-source defaults (jitter, voices, throttle, bus) that the
   *  preset wants applied automatically when registered through
   *  `createSeslen({ sources, defaults })`. Pure data — consumers can
   *  override on a per-call basis with `play(name, opts)`. */
  readonly defaults?: SourceDefaults
  /** Approximate audible duration in milliseconds. Synthesised factories
   *  don't expose `duration` on their `PlayHandle`, so this is the
   *  metadata-side hint UIs need to show progress, sequence presets and
   *  size waveform previews. Should match the recipe's tail. */
  readonly durationMs?: number
  /** The synthesis function. */
  readonly factory: SoundFactory
}

/* ------------------------------------------------------------------ helpers */

/** Wraps a list of stop-capable nodes into a `PlayHandle`.
 *
 *  Each tracked node should also propagate its `onended` so the wrapper can
 *  fire the consumer's `onEnded` callback when the *last* node finishes.
 *  Nodes that don't expose `onended` (e.g. plain timers) are still stopped
 *  on `stop()`, but the handle's natural-end event won't fire for them. */
export function asHandle(
  nodes: {
    stop: (when?: number) => void
    onended?: (() => void) | null
  }[],
): {
  stop: () => void
  readonly done: boolean
  readonly duration: number | null
  onEnded(cb: () => void): void
} {
  let stopped = false
  let pending = nodes.length
  let endedCb: (() => void) | null = null

  function fire(): void {
    if (endedCb) {
      const cb = endedCb
      endedCb = null
      try {
        cb()
      } catch {
        // listener errors must not break playback
      }
    }
  }

  for (const n of nodes) {
    if ("onended" in n) {
      n.onended = () => {
        pending -= 1
        if (pending <= 0) {
          stopped = true
          fire()
        }
      }
    } else {
      pending -= 1
    }
  }
  if (pending <= 0) {
    // No node-level end events — fire when stop() is called.
    pending = 0
  }

  return {
    stop() {
      if (stopped) return
      stopped = true
      for (const n of nodes) {
        try {
          n.stop()
        } catch {
          // already stopped
        }
      }
      fire()
    },
    get done() {
      return stopped
    },
    /** Duration is opaque for synthesised factories; surface as null. */
    get duration() {
      return null
    },
    onEnded(cb) {
      if (stopped) {
        try {
          cb()
        } catch {
          // ignore
        }
        return
      }
      endedCb = cb
    },
  }
}

/** Per-call gain multiplier applied on top of a recipe envelope. */
export function callGain(opts: { gain?: number }): number {
  return opts.gain ?? 1
}

/** Per-call playback rate. Multiply scheduled frequencies (and proportionally
 *  scale time-based parameters in the recipe) by this. Default `1`. */
export function callRate(opts: { rate?: number }): number {
  return opts.rate ?? 1
}

/** Per-call detune (cents). Set this on every `OscillatorNode`'s `detune`
 *  param so semitones add cleanly across the recipe. Default `0`. */
export function callDetune(opts: { detune?: number }): number {
  return opts.detune ?? 0
}

/** A short white-noise burst as an `AudioBufferSourceNode`. */
export function noiseBurst(ctx: AudioContext, durSeconds: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durSeconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  return src
}
