// Minimal runtime globals shared by seslen.
declare var window:
  | {
      [key: string]: unknown
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
      OfflineAudioContext?: typeof OfflineAudioContext
      matchMedia?: (query: string) => MediaQueryList
      localStorage?: {
        getItem(key: string): string | null
        setItem(key: string, value: string): void
        removeItem(key: string): void
      }
      addEventListener?: (type: string, listener: () => void, opts?: unknown) => void
      removeEventListener?: (type: string, listener: () => void, opts?: unknown) => void
    }
  | undefined

declare var fetch: (
  input: string,
  init?: unknown,
) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>

interface MediaQueryList {
  readonly matches: boolean
  addEventListener(type: "change", listener: (e: { matches: boolean }) => void): void
  removeEventListener(type: "change", listener: (e: { matches: boolean }) => void): void
}

interface AudioContext {
  readonly state: "suspended" | "running" | "closed"
  readonly destination: AudioNode
  readonly currentTime: number
  readonly sampleRate: number
  readonly baseLatency?: number
  readonly outputLatency?: number
  suspend(): Promise<void>
  resume(): Promise<void>
  close(): Promise<void>
  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer>
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer
  createBufferSource(): AudioBufferSourceNode
  createGain(): GainNode
  createOscillator(): OscillatorNode
  createBiquadFilter(): BiquadFilterNode
  createStereoPanner(): StereoPannerNode
  createDelay(maxDelayTime?: number): DelayNode
  createDynamicsCompressor(): DynamicsCompressorNode
  createConvolver(): ConvolverNode
  createAnalyser(): AnalyserNode
}

interface OfflineAudioContext {
  readonly length: number
  readonly destination: AudioNode
  readonly currentTime: number
  readonly sampleRate: number
  startRendering(): Promise<AudioBuffer>
  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer>
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer
  createBufferSource(): AudioBufferSourceNode
  createGain(): GainNode
  createOscillator(): OscillatorNode
  createBiquadFilter(): BiquadFilterNode
  createStereoPanner(): StereoPannerNode
  createDelay(maxDelayTime?: number): DelayNode
  createDynamicsCompressor(): DynamicsCompressorNode
  createConvolver(): ConvolverNode
  createAnalyser(): AnalyserNode
}

declare var AudioContext: { new (): AudioContext }
declare var OfflineAudioContext: {
  new (channels: number, length: number, sampleRate: number): OfflineAudioContext
}
declare var Blob: { new (parts: ArrayBuffer[], opts?: { type?: string }): unknown }

interface AudioNode {
  connect(destination: AudioNode): AudioNode
  disconnect(): void
}

interface AudioBuffer {
  readonly duration: number
  readonly length: number
  readonly numberOfChannels: number
  readonly sampleRate: number
  getChannelData(channel: number): Float32Array
}

type OscillatorType = "sine" | "square" | "sawtooth" | "triangle"

interface AudioParam {
  value: number
  setValueAtTime(value: number, when: number): void
  linearRampToValueAtTime(value: number, when: number): void
  exponentialRampToValueAtTime(value: number, when: number): void
  setTargetAtTime(target: number, startTime: number, timeConstant: number): void
  cancelScheduledValues(when: number): void
}

interface AudioBufferSourceNode extends AudioNode {
  buffer: AudioBuffer | null
  loop: boolean
  loopStart: number
  loopEnd: number
  playbackRate: AudioParam
  detune: AudioParam
  onended: (() => void) | null
  start(when?: number, offset?: number, duration?: number): void
  stop(when?: number): void
}

interface GainNode extends AudioNode {
  gain: AudioParam
}

interface OscillatorNode extends AudioNode {
  type: OscillatorType
  frequency: AudioParam
  detune: AudioParam
  onended: (() => void) | null
  start(when?: number): void
  stop(when?: number): void
}

interface StereoPannerNode extends AudioNode {
  pan: AudioParam
}

interface DelayNode extends AudioNode {
  delayTime: AudioParam
}

interface DynamicsCompressorNode extends AudioNode {
  threshold: AudioParam
  knee: AudioParam
  ratio: AudioParam
  attack: AudioParam
  release: AudioParam
}

interface ConvolverNode extends AudioNode {
  buffer: AudioBuffer | null
  normalize: boolean
}

interface AnalyserNode extends AudioNode {
  fftSize: number
  readonly frequencyBinCount: number
  smoothingTimeConstant: number
  minDecibels: number
  maxDecibels: number
  getByteTimeDomainData(array: Uint8Array): void
  getByteFrequencyData(array: Uint8Array): void
  getFloatTimeDomainData(array: Float32Array): void
  getFloatFrequencyData(array: Float32Array): void
}

type BiquadFilterType =
  | "lowpass"
  | "highpass"
  | "bandpass"
  | "lowshelf"
  | "highshelf"
  | "peaking"
  | "notch"
  | "allpass"

interface BiquadFilterNode extends AudioNode {
  type: BiquadFilterType
  frequency: AudioParam
  Q: AudioParam
  gain: AudioParam
}
