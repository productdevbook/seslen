/// <reference path="./env.d.ts" />
import type { PlayHandle, PlayOptions } from "./_types.ts"

/** Schedule one playback of a decoded `AudioBuffer` through `destination`.
 *  Returned handle owns lifetime — `stop()` cancels playback. */
export function startBuffer(
  ctx: AudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  opts: PlayOptions = {},
): PlayHandle {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = opts.loop ?? false
  source.playbackRate.value = opts.rate ?? 1
  source.detune.value = opts.detune ?? 0

  const gain = ctx.createGain()
  const target = clamp01(opts.gain ?? 1)
  const fadeIn = Math.max(0, opts.fadeIn ?? 0)
  const fadeOut = Math.max(0, opts.fadeOut ?? 0)
  const startAt = ctx.currentTime + Math.max(0, opts.when ?? 0)

  if (fadeIn > 0) {
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.linearRampToValueAtTime(target, startAt + fadeIn)
  } else {
    gain.gain.value = target
  }

  // Optional stereo pan via StereoPannerNode (skipped when pan == 0 to
  // avoid an extra node in the common case).
  let panner: StereoPannerNode | null = null
  const pan = opts.pan ?? 0
  if (pan !== 0) {
    panner = ctx.createStereoPanner()
    panner.pan.value = clampPan(pan)
    source.connect(gain)
    gain.connect(panner)
    panner.connect(destination)
  } else {
    source.connect(gain)
    gain.connect(destination)
  }

  let stopped = false
  let endedCb: (() => void) | null = null
  function fireEnded(): void {
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

  source.onended = () => {
    stopped = true
    source.disconnect()
    gain.disconnect()
    panner?.disconnect()
    fireEnded()
  }
  if (opts.sprite) {
    source.start(startAt, opts.sprite[0], opts.sprite[1])
  } else {
    source.start(startAt)
  }

  // For looped sources duration is meaningless; otherwise we know it. When
  // a sprite is set, the slice's `duration` wins over the buffer length.
  let durationSeconds: number | null
  if (source.loop) {
    durationSeconds = null
  } else if (opts.sprite) {
    durationSeconds = opts.sprite[1] / (opts.rate ?? 1)
  } else {
    durationSeconds = buffer.duration / (opts.rate ?? 1)
  }

  function applyFadeAndStop(): void {
    const now = ctx.currentTime
    if (fadeOut > 0) {
      try {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(gain.gain.value, now)
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeOut)
      } catch {
        // ignore param errors
      }
      try {
        source.stop(now + fadeOut)
      } catch {
        // already stopped
      }
    } else {
      try {
        source.stop()
      } catch {
        // already stopped
      }
      fireEnded()
    }
  }

  return {
    stop() {
      if (stopped) return
      stopped = true
      applyFadeAndStop()
    },
    get done() {
      return stopped
    },
    get duration() {
      return durationSeconds
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
    fadeTo(value, seconds) {
      const now = ctx.currentTime
      const v = clamp01(value)
      const t = Math.max(0, seconds)
      try {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(gain.gain.value, now)
        if (t === 0) {
          gain.gain.setValueAtTime(v, now)
        } else {
          gain.gain.linearRampToValueAtTime(v === 0 ? 0.0001 : v, now + t)
        }
      } catch {
        // ignore
      }
    },
    setGain(value) {
      try {
        gain.gain.value = clamp01(value)
      } catch {
        // ignore
      }
    },
    rampRate(value, seconds) {
      const now = ctx.currentTime
      const t = Math.max(0, seconds)
      try {
        source.playbackRate.cancelScheduledValues(now)
        source.playbackRate.setValueAtTime(source.playbackRate.value, now)
        if (t === 0) source.playbackRate.setValueAtTime(value, now)
        else source.playbackRate.linearRampToValueAtTime(value, now + t)
      } catch {
        // ignore
      }
    },
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function clampPan(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(-1, Math.min(1, v))
}
