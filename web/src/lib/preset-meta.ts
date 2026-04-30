import type { PresetEntry } from "seslen/presets"

export const ACCENT_CLASS: Record<NonNullable<PresetEntry["accent"]>, string> = {
  blue: "accent-blue",
  teal: "accent-teal",
  indigo: "accent-indigo",
  green: "accent-green",
  orange: "accent-orange",
  yellow: "accent-yellow",
  red: "accent-red",
  purple: "accent-purple",
  pink: "accent-pink",
}

export const MOTION_CLASS = {
  bounce: "animate-bounce-press",
  shake: "animate-shake-x",
  wiggle: "animate-wiggle-y",
  pulse: "animate-pulse-soft",
  swirl: "animate-swirl",
  flash: "animate-flash",
} as const

export function accentOf(entry: PresetEntry): string {
  return entry.accent ? ACCENT_CLASS[entry.accent] : ACCENT_CLASS.blue
}

export function motionOf(entry: PresetEntry): string | null {
  if (!entry.motion) return null
  const cls = MOTION_CLASS[entry.motion as keyof typeof MOTION_CLASS]
  return cls ?? null
}
