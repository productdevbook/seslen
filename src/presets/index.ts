/**
 * Built-in UI sound presets.
 *
 * Every preset lives in its own file alongside its metadata
 * (label, description, tags, recipe). Adding a new preset is a
 * 30-line edit; see `CONTRIBUTING.md` next to this file.
 *
 * @module
 */
import type { SoundSource, SourceDefaults } from "../_types.ts"
import { add } from "./add.ts"
import { alarm } from "./alarm.ts"
import { coin } from "./coin.ts"
import { collapse } from "./collapse.ts"
import { copy } from "./copy.ts"
import { deletePreset } from "./delete.ts"
import { drag } from "./drag.ts"
import { drop } from "./drop.ts"
import { error } from "./error.ts"
import { expand } from "./expand.ts"
import { explosion } from "./explosion.ts"
import { heartbeat } from "./heartbeat.ts"
import { hover } from "./hover.ts"
import { jump } from "./jump.ts"
import { keypress } from "./keypress.ts"
import { levelUp } from "./level-up.ts"
import { lock } from "./lock.ts"
import { message } from "./message.ts"
import { notify } from "./notify.ts"
import { paste } from "./paste.ts"
import { pop } from "./pop.ts"
import { receive } from "./receive.ts"
import { redo } from "./redo.ts"
import { scrollTick } from "./scroll-tick.ts"
import { send } from "./send.ts"
import { shoot } from "./shoot.ts"
import { success } from "./success.ts"
import { swoosh } from "./swoosh.ts"
import { tick } from "./tick.ts"
import { toggleOff } from "./toggle-off.ts"
import { toggleOn } from "./toggle-on.ts"
import { typewriter } from "./typewriter.ts"
import { undo } from "./undo.ts"
import { unlock } from "./unlock.ts"
import { victory } from "./victory.ts"
import { warning } from "./warning.ts"
import type { PresetEntry } from "./_meta.ts"

export type { PresetEntry } from "./_meta.ts"

const _presetEntries = {
  // Original eight
  tick,
  success,
  error,
  warning,
  message,
  add,
  delete: deletePreset,
  victory,
  // UI feedback
  hover,
  pop,
  swoosh,
  "toggle-on": toggleOn,
  "toggle-off": toggleOff,
  notify,
  keypress,
  "scroll-tick": scrollTick,
  drag,
  drop,
  expand,
  collapse,
  undo,
  redo,
  send,
  receive,
  copy,
  paste,
  // Game / playful
  "level-up": levelUp,
  coin,
  jump,
  shoot,
  explosion,
  // Ambient / state
  heartbeat,
  alarm,
  typewriter,
  lock,
  unlock,
} as const satisfies Record<string, PresetEntry>

/** Union of every built-in preset ID. */
export type PresetName = keyof typeof _presetEntries

/** Every built-in preset, indexed by stable ID. */
export const presetEntries: Record<string, PresetEntry> = _presetEntries

/**
 * Just the factories — drop straight into `createSeslen({ sources })`.
 *
 * ```ts
 * const ses = createSeslen({ sources: presets, defaults: presetDefaults })
 * ```
 */
export const presets: Record<PresetName, SoundSource> = (() => {
  const out: Record<string, SoundSource> = {}
  for (const [k, v] of Object.entries(_presetEntries)) out[k] = v.factory
  return out as Record<PresetName, SoundSource>
})()

/** Per-preset default playback hints (jitter, throttle, voices, steal, bus).
 *  Pass alongside `presets` to `createSeslen({ sources, defaults })`. */
export const presetDefaults: Partial<Record<PresetName, SourceDefaults>> = (() => {
  const out: Record<string, SourceDefaults> = {}
  for (const [k, v] of Object.entries(_presetEntries)) {
    if (v.defaults) out[k] = v.defaults
  }
  return out as Partial<Record<PresetName, SourceDefaults>>
})()

/** All tags used by built-in presets, deduplicated and sorted. */
export const presetTags: readonly string[] = Array.from(
  new Set(Object.values(presetEntries).flatMap((p) => p.tags)),
).sort()
