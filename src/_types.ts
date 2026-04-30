/**
 * A sound source can be one of three things:
 * - a remote URL (string) — fetched, decoded and cached
 * - an already-decoded `AudioBuffer`
 * - a `SoundFactory` — a function that synthesises the sound directly
 *   on the live `AudioContext`. Use this for short UI clicks/blips that
 *   are cheaper to generate than to download.
 */
export type SoundSource = string | AudioBuffer | SoundFactory

/** Synthesises a sound on the fly. Receives the live context, the destination
 *  node it must connect to (a bus or the master), and the per-call options.
 *  Returns a `PlayHandle` so the caller can stop it. */
export type SoundFactory = (
  ctx: AudioContext,
  destination: AudioNode,
  opts: PlayOptions,
) => PlayHandle

/** Strategy used by the polyphony cap when a new voice would exceed the
 *  per-source `voices` limit. */
export type VoiceStealStrategy = "oldest" | "newest" | "drop"

/** Optional per-call playback parameters. */
export interface PlayOptions {
  /** Linear gain (0..1). Default `1`. */
  gain?: number
  /** Playback rate multiplier. Default `1`. */
  rate?: number
  /** Detune in cents. Default `0`. */
  detune?: number
  /** Loop the sound until `stop()` is called. Default `false`. */
  loop?: boolean
  /** Stereo pan (-1 left .. 1 right). Default `0`. */
  pan?: number
  /** Fade-in duration in seconds. Default `0`. */
  fadeIn?: number
  /** Fade-out duration in seconds — applied automatically on `stop()`. Default `0`. */
  fadeOut?: number
  /** Schedule the start at an absolute `AudioContext.currentTime + when` seconds.
   *  Use the `ses.now()` helper. Default: as soon as possible. */
  when?: number
  /** Sprite slice for buffer sources: `[offsetSeconds, durationSeconds]`. */
  sprite?: readonly [number, number]
  /** If a previous instance of the same sound is still playing, stop it
   *  before starting the new one. Default `false`. */
  interrupt?: boolean
  /** Drop this play if the same sound was triggered fewer than `throttle`
   *  milliseconds ago. Default `0` (no throttling). */
  throttle?: number
  /** Random ±jitter applied to `rate` (e.g. `0.05` ⇒ ±5%). */
  rateJitter?: number
  /** Random ±jitter applied to `gain` (e.g. `0.1` ⇒ ±10%). */
  gainJitter?: number
  /** Random ±jitter applied to `detune` (cents). */
  detuneJitter?: number
  /** Route through a named bus. Default: master. */
  bus?: string
}

/** Handle returned by `play()` — lets callers stop a still-playing sound and
 *  manipulate its gain/rate while it's alive. */
export interface PlayHandle {
  stop(): void
  readonly done: boolean
  /** Recipe duration in seconds, when the underlying source can report one
   *  (URL/AudioBuffer). Synthesised factory presets return `null`. */
  readonly duration: number | null
  /** Set a callback that fires once the handle finishes (naturally or via
   *  `stop()`). Idempotent. */
  onEnded(cb: () => void): void
  /** Ramp gain to `value` over `seconds`. No-op for synthesised handles
   *  that don't expose a gain param. */
  fadeTo?(value: number, seconds: number): void
  /** Set gain immediately. */
  setGain?(value: number): void
  /** Ramp playback rate to `value` over `seconds`. */
  rampRate?(value: number, seconds: number): void
}

/** Events emitted by the seslen instance. */
export type SeslenEvent =
  /** AudioContext state changed (idle/suspended/running/closed). */
  | { type: "statechange"; state: "idle" | "running" | "suspended" | "closed" }
  /** A play call started. `pattern` is true for `playPattern` handles. */
  | { type: "play"; name: string; handle: PlayHandle; pattern: boolean }
  /** A play call was suppressed by throttling. */
  | { type: "throttled"; name: string }
  /** A handle finished (naturally or via stop). */
  | { type: "ended"; name: string; handle: PlayHandle }

export type SeslenEventType = SeslenEvent["type"]
export type SeslenEventListener<T extends SeslenEventType> = (
  e: Extract<SeslenEvent, { type: T }>,
) => void

/** Per-source defaults. Any preset can declare these via `PresetEntry.defaults`
 *  to set sensible per-source baselines for jitter, throttling and voice cap. */
export interface SourceDefaults {
  gain?: number
  rate?: number
  detune?: number
  pan?: number
  rateJitter?: number
  gainJitter?: number
  detuneJitter?: number
  /** Min ms between successive plays. */
  minInterval?: number
  /** Max simultaneous voices for this source. */
  voices?: number
  /** Steal strategy when the voice cap is hit. Default `"oldest"`. */
  steal?: VoiceStealStrategy
  /** Default bus name. */
  bus?: string
}

/** Options for `createSeslen()`. */
export interface SeslenOptions<TName extends string = string> {
  /** Map of preset name → `SoundSource`. */
  sources?: Record<TName, SoundSource>
  /** Per-source defaults (gain/rate/detune/pan/jitter/voices/steal/bus/minInterval). */
  defaults?: Partial<Record<TName, SourceDefaults>>
  /** Master volume (0..1). Default `1`. */
  volume?: number
  /** Pre-declared bus names with optional initial volume. */
  buses?: Record<string, { volume?: number; muted?: boolean }>
  /** Global voice cap across all sources. Default: unlimited. */
  maxVoices?: number
  /** Honour `prefers-reduced-motion: reduce` by auto-muting. Default `true`. */
  respectReducedMotion?: boolean
  /** Persist mute + volume to `localStorage` under this key. */
  persist?: string
  /** Preload all URL sources on first user gesture. Default `false`. */
  preload?: boolean
}

/** A single step inside a `playPattern()` call. */
export interface PatternStep<TName extends string = string> {
  /** Offset from the start of the pattern, in milliseconds. Default `0`. */
  at?: number
  /** Registered sound name. */
  id: TName
  /** Per-step options. */
  options?: PlayOptions
}

/** Description of a tap into the master signal for visualisation. */
export interface AnalyserTap {
  /** Fill `array` with time-domain (waveform) samples in 0..255. */
  getWaveform(array: Uint8Array): void
  /** Fill `array` with frequency-domain (spectrum) samples in 0..255. */
  getSpectrum(array: Uint8Array): void
  /** Underlying FFT size. */
  readonly fftSize: number
  /** Detach the analyser. */
  dispose(): void
}

/** Bus handle returned by `ses.bus(name)`. */
export interface BusHandle {
  readonly name: string
  getVolume(): number
  setVolume(value: number): void
  mute(): void
  unmute(): void
  isMuted(): boolean
  /** Temporarily attenuate this bus to `target` for `holdSeconds`, ramping in
   *  `attackSeconds` and back to original in `releaseSeconds`. */
  duck(opts: {
    target: number
    holdSeconds: number
    attackSeconds?: number
    releaseSeconds?: number
  }): void
}

/** Public instance returned by `createSeslen()`. */
export interface SeslenInstance<TName extends string = string> {
  /* ---------------------------------------------------------- playback */

  /** Play a registered sound. Returns `null` when the call was suppressed
   *  (e.g. by `throttle` or `voices: drop`). */
  play(name: TName, opts?: PlayOptions): Promise<PlayHandle | null>
  playPattern(steps: PatternStep<TName>[]): Promise<PlayHandle>
  preload(name: TName): Promise<void>
  stopAll(): void
  stop(name: TName): number

  /* ---------------------------------------------------------- registry */

  register(name: string, source: SoundSource, defaults?: SourceDefaults): void
  unregister(name: string): boolean
  has(name: string): boolean
  names(): TName[]

  /* ----------------------------------------------------------- master */

  getVolume(): number
  setVolume(value: number): void
  mute(): void
  unmute(): void
  isMuted(): boolean

  /* ----------------------------------------------------------- buses */

  /** Get (or create) a named bus. Sounds played with `{ bus: name }` are
   *  routed through this bus so it can be muted, volumed or ducked
   *  independently of the master. */
  bus(name: string): BusHandle

  /* ----------------------------------------------------------- timing */

  /** Current `AudioContext.currentTime`. Use with `play(name, { when })`. */
  now(): number
  /** Reported audio output latency in seconds (`baseLatency + outputLatency`). */
  latency(): number

  /* ------------------------------------------------------------ render */

  /** Render a registered sound to a WAV `Blob` via `OfflineAudioContext`.
   *  Useful for previews, exports and tests. */
  render(name: TName, opts?: PlayOptions & { durationSeconds?: number }): Promise<unknown>

  /* ----------------------------------------------------------- analysis */

  /** Tap an `AnalyserNode` after the master gain for waveform/spectrum data. */
  analyser(opts?: { fftSize?: number; smoothing?: number }): AnalyserTap

  /* ------------------------------------------------------------ events */

  on<T extends SeslenEventType>(type: T, listener: SeslenEventListener<T>): () => void
  off<T extends SeslenEventType>(type: T, listener: SeslenEventListener<T>): void

  /* --------------------------------------------------------- lifecycle */

  pause(): Promise<void>
  resume(): Promise<void>
  close(): Promise<void>
  isReady(): boolean
  state(): "idle" | "running" | "suspended" | "closed"
}
