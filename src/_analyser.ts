/// <reference path="./env.d.ts" />
import type { AnalyserTap } from "./_types.ts"

/**
 * Insert an `AnalyserNode` between `master` and `ctx.destination` so callers
 * can read time- and frequency-domain data for visualisation. Pure tap — does
 * not change the audible signal.
 *
 * Calling `dispose()` removes the analyser and restores the original wiring.
 */
export function createAnalyser(
  ctx: AudioContext,
  master: GainNode,
  opts: { fftSize?: number; smoothing?: number } = {},
): AnalyserTap {
  const node = ctx.createAnalyser()
  node.fftSize = opts.fftSize ?? 1024
  node.smoothingTimeConstant = opts.smoothing ?? 0.8

  // Re-route: master → analyser → destination
  master.disconnect()
  master.connect(node)
  node.connect(ctx.destination)

  let disposed = false
  return {
    getWaveform(array) {
      if (disposed) return
      node.getByteTimeDomainData(array)
    },
    getSpectrum(array) {
      if (disposed) return
      node.getByteFrequencyData(array)
    },
    get fftSize() {
      return node.fftSize
    },
    dispose() {
      if (disposed) return
      disposed = true
      try {
        master.disconnect()
        node.disconnect()
        master.connect(ctx.destination)
      } catch {
        // best-effort
      }
    },
  }
}
