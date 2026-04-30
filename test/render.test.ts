import { describe, expect, it } from "vitest"
import { encodeWav } from "../src/_render.ts"

function makeBuffer(frames: number, channels: number, sampleRate: number): AudioBuffer {
  const data = Array.from({ length: channels }, () => new Float32Array(frames))
  for (let c = 0; c < channels; c++) {
    for (let i = 0; i < frames; i++) (data[c] as Float32Array)[i] = Math.sin(i * 0.1) * 0.5
  }
  return {
    duration: frames / sampleRate,
    length: frames,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: (c: number) => data[c] as Float32Array,
  } as AudioBuffer
}

describe("encodeWav", () => {
  it("produces a valid WAV header", () => {
    const ab = encodeWav(makeBuffer(100, 1, 44100))
    const view = new DataView(ab)
    const tag = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    )
    expect(tag).toBe("RIFF")
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    )
    expect(wave).toBe("WAVE")
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint32(24, true)).toBe(44100) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
  })

  it("interleaves stereo data", () => {
    const ab = encodeWav(makeBuffer(10, 2, 48000))
    // header (44) + 10 frames * 2 channels * 2 bytes = 84 total
    expect(ab.byteLength).toBe(44 + 10 * 2 * 2)
  })
})
