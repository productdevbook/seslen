/// <reference path="./env.d.ts" />
import { ContextNotReadyError, SeslenError } from "./errors.ts"
import type { PlayOptions, SoundFactory, SoundSource } from "./_types.ts"

/**
 * Render a `SoundSource` to a 16-bit PCM WAV `Blob` via `OfflineAudioContext`.
 *
 * - Synthesised factories run inside the offline context, so the recipe is
 *   captured 1:1 — no live AudioContext is touched.
 * - URL sources are fetched + decoded into the offline context.
 * - Decoded buffers are copied straight into the offline graph.
 *
 * `durationSeconds` defaults to 2 s. Lengthen it for longer presets like
 * `victory` or for sounds with reverb tails.
 */
export async function renderToWav(
  source: SoundSource,
  loadBuffer: (url: string, ctx: OfflineAudioContext) => Promise<AudioBuffer>,
  opts: PlayOptions & { durationSeconds?: number; sampleRate?: number; channels?: number } = {},
): Promise<unknown> {
  if (typeof OfflineAudioContext === "undefined") {
    throw new ContextNotReadyError("seslen: OfflineAudioContext is not available")
  }
  const sampleRate = opts.sampleRate ?? 44100
  const channels = opts.channels ?? 2
  const seconds = Math.max(0.05, opts.durationSeconds ?? 2)
  const length = Math.floor(seconds * sampleRate)
  const offline = new OfflineAudioContext(channels, length, sampleRate)

  const ac = offline as unknown as AudioContext
  if (typeof source === "function") {
    ;(source as SoundFactory)(ac, ac.destination, opts)
  } else if (typeof source === "string") {
    const buffer = await loadBuffer(source, offline)
    const src = offline.createBufferSource()
    src.buffer = buffer
    src.loop = opts.loop ?? false
    src.playbackRate.value = opts.rate ?? 1
    src.detune.value = opts.detune ?? 0
    const gain = offline.createGain()
    gain.gain.value = opts.gain ?? 1
    src.connect(gain).connect(offline.destination)
    if (opts.sprite) {
      src.start(0, opts.sprite[0], opts.sprite[1])
    } else {
      src.start(0)
    }
  } else {
    const src = offline.createBufferSource()
    src.buffer = source
    src.loop = opts.loop ?? false
    src.playbackRate.value = opts.rate ?? 1
    src.detune.value = opts.detune ?? 0
    const gain = offline.createGain()
    gain.gain.value = opts.gain ?? 1
    src.connect(gain).connect(offline.destination)
    src.start(0)
  }

  const rendered = await offline.startRendering()
  if (typeof Blob === "undefined") {
    throw new SeslenError("seslen: Blob is not available in this runtime")
  }
  const wav = encodeWav(rendered)
  return new Blob([wav], { type: "audio/wav" })
}

/** Encode an `AudioBuffer` to a 16-bit little-endian PCM WAV `ArrayBuffer`. */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numFrames * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const ab = new ArrayBuffer(totalSize)
  const view = new DataView(ab)

  // RIFF header
  writeString(view, 0, "RIFF")
  view.setUint32(4, totalSize - 8, true)
  writeString(view, 8, "WAVE")
  // fmt subchunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true) // subchunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  // data subchunk
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  // Interleave + convert Float32 → Int16
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))
  let offset = headerSize
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = clamp(channels[c]?.[i] ?? 0)
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return ab
}

function clamp(v: number): number {
  if (v > 1) return 1
  if (v < -1) return -1
  return v
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
