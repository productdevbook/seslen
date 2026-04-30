# seslen

Zero-dependency, high-DX Web Audio library. A small, ergonomic API on top of `AudioContext` that turns playing UI sounds into a single line. Built-in presets are _synthesised at call time_ (oscillator + envelope) — no audio files, no network, no decode. Pure TypeScript, tree-shakeable, SSR-safe.

> [!IMPORTANT]
> Keep `AGENTS.md` updated with project status.

## Project Structure

```
src/
  index.ts          # Public API — createSeslen, types, helpers
  errors.ts         # SeslenError, ContextNotReadyError, DecodeError, LoadError
  env.d.ts          # AudioContext / OfflineAudioContext / DOM type declarations
  _types.ts         # PlayOptions, PlayHandle, SeslenOptions, SoundSource, SourceDefaults, BusHandle, AnalyserTap, ...
  _context.ts       # createContext — lazy AudioContext + unlock-on-gesture
  _cache.ts         # createCache<AudioBuffer> — single-flight URL loader
  _loader.ts        # fetchAndDecode — fetch → ArrayBuffer → decodeAudioData
  _player.ts        # startBuffer — gain, rate, detune, loop, pan, fades, sprite, when
  _registry.ts      # Name → SoundSource + per-source defaults registry
  _buses.ts         # Named bus mixer (per-bus volume / mute / duck)
  _voices.ts        # Polyphony cap + steal strategy (oldest / newest / drop)
  _throttle.ts      # Per-name min-interval enforcement
  _jitter.ts        # Random rate / gain / detune variation per play
  _a11y.ts          # prefers-reduced-motion auto-mute
  _persist.ts       # localStorage volume + mute persistence
  _render.ts        # OfflineAudioContext render-to-WAV
  _analyser.ts      # AnalyserNode tap on master (waveform / spectrum)
  presets/          # One file per built-in preset (36 total)
    _meta.ts        # PresetEntry type + asHandle/callGain/noiseBurst helpers
    _template.ts    # Copy-paste starter for new presets
    CONTRIBUTING.md # 30-line guide for adding presets
    index.ts        # Collects entries + presets/presetEntries/presetDefaults/presetTags
    # — Original eight —
    tick.ts success.ts error.ts warning.ts message.ts add.ts delete.ts victory.ts
    # — UI feedback —
    hover.ts pop.ts swoosh.ts toggle-on.ts toggle-off.ts notify.ts
    keypress.ts scroll-tick.ts drag.ts drop.ts expand.ts collapse.ts
    undo.ts redo.ts send.ts receive.ts copy.ts paste.ts
    # — Game / playful —
    level-up.ts coin.ts jump.ts shoot.ts explosion.ts
    # — Ambient / state —
    heartbeat.ts alarm.ts typewriter.ts lock.ts unlock.ts
  server.ts         # SSR stub — every method is a typed no-op

test/
  *.test.ts         # vitest suites (jsdom for browser tests)

web/
  *                 # Vite + Tailwind v4 playground

scripts/
  bundle-budget.mjs # Per-file size budget enforcer

.github/
  assets/           # cover.svg + cover.png
  workflows/        # ci.yml + release.yml
  FUNDING.yml
```

## Public API

```ts
import { createSeslen } from "seslen"
import { presets, presetDefaults } from "seslen/presets"

const ses = createSeslen({
  sources: presets,
  defaults: presetDefaults, // per-preset jitter / throttle / voices
  volume: 0.8,
  buses: { ui: {}, music: { volume: 0.6 } },
  maxVoices: 24,
  respectReducedMotion: true, // auto-mute on prefers-reduced-motion
  persist: "seslen:master", // round-trip volume/mute through localStorage
})

await ses.play("victory") // play preset
await ses.play("tick", { gain: 0.4, pan: -0.5 }) // gain / rate / detune / pan
await ses.play("hover", { rateJitter: 0.1, throttle: 40 }) // perceptual variation + rapid-fire guard
await ses.play("notify", { interrupt: true, fadeIn: 0.05 }) // steal previous instance, ramp in
await ses.play("music", { bus: "music", loop: true, when: ses.now() + 0.25 })

const h = await ses.play("ambient", { loop: true })
h?.fadeTo(0, 0.4) // ramp gain → 0 over 400 ms
h?.rampRate(0.5, 1) // half-speed over 1 s

ses.bus("music").duck({ target: 0.2, holdSeconds: 0.5 }) // sidechain music while a UI sound plays
const tap = ses.analyser({ fftSize: 256 }) // waveform/spectrum data for visualisations
const wav = await ses.render("victory", { durationSeconds: 1.5 }) // OfflineAudioContext → WAV Blob
```

Methods: `createSeslen()`, `play()`, `playPattern()`, `preload()`, `stop(name)`, `stopAll()`, `register()`, `unregister()`, `has()`, `names()`, `getVolume()`, `setVolume()`, `mute()`, `unmute()`, `isMuted()`, `bus(name)`, `now()`, `latency()`, `render(name)`, `analyser()`, `on()`, `off()`, `pause()`, `resume()`, `close()`, `isReady()`, `state()`.

`SoundSource` is one of: a URL string, a decoded `AudioBuffer`, or a `SoundFactory` (`(ctx, destination, opts) => PlayHandle`). Built-in presets are factories.

`PlayOptions`: `gain`, `rate`, `detune`, `loop`, `pan`, `fadeIn`, `fadeOut`, `when`, `sprite`, `interrupt`, `throttle`, `rateJitter`, `gainJitter`, `detuneJitter`, `bus`.

`PlayHandle`: `stop()`, `done`, `duration`, `onEnded(cb)`, `fadeTo(value, seconds)`, `setGain(value)`, `rampRate(value, seconds)`.

`SourceDefaults` (per-preset, via `createSeslen({ defaults })` or `register(name, source, defaults)`): `gain`, `rate`, `detune`, `pan`, `rateJitter`, `gainJitter`, `detuneJitter`, `minInterval`, `voices`, `steal`, `bus`.

Events: `play`, `ended`, `throttled`, `statechange`.

## Build & Scripts

```bash
pnpm build          # obuild (rolldown) → dist/
pnpm dev            # vitest watch
pnpm lint           # oxlint + oxfmt --check
pnpm lint:fix       # oxlint --fix + oxfmt
pnpm fmt            # oxfmt
pnpm test           # pnpm lint && pnpm typecheck && vitest run
pnpm typecheck      # tsgo --noEmit
pnpm bundle-budget  # raw byte size budgets
pnpm attw           # Are-The-Types-Wrong CLI
pnpm release        # pnpm test && build && bundle-budget && bumpp --commit --tag --push --all
```

## Code Conventions

- **Pure ESM** — no CJS
- **Zero runtime dependencies**
- **TypeScript strict** — tsgo for typecheck, `verbatimModuleSyntax`, `isolatedModules`
- **Formatter:** oxfmt (no semicolons, double quotes)
- **Linter:** oxlint (unicorn, typescript, oxc plugins)
- **Tests:** vitest in `test/` (flat naming)
- **Internal files:** prefix with `_` (`_context.ts`, `_cache.ts`, …)
- **Exports:** explicit in `src/index.ts`, no barrel re-exports
- **Commits:** semantic lowercase (`feat:`, `fix:`, `chore:`, `docs:`)
- **Language:** all comments, docs and identifiers in English, including preset names (`tick`, `success`, `error`, `warning`, `message`, `add`, `delete`, `victory`).

## Status

- 🚧 v0.0.1 — package name reservation
- ⬜ v0.1.0 — `createSeslen` + synthesised presets + Vite/Tailwind playground
- ⬜ v0.2.0 — full Web Audio surface: buses, voices, ducking, throttle, jitter,
  fades, pan, sprites, scheduling (`when`), reduced-motion, persistence,
  OfflineAudioContext render-to-WAV, AnalyserNode tap, latency reporting; 36
  built-in presets across UI / game / ambient categories.
- ⬜ v0.3.0 — framework adapters (react, vue, svelte) + theme/preset packs.
