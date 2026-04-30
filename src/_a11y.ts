/// <reference path="./env.d.ts" />

/**
 * Watch `prefers-reduced-motion: reduce` and call `onChange(true|false)` when
 * it flips. Returns a dispose function. SSR-safe (returns a no-op when
 * `window` or `matchMedia` is missing).
 *
 * The contract: when reduced-motion is *active*, `seslen` auto-mutes. The
 * caller decides what to do with the boolean.
 */
export function watchReducedMotion(onChange: (reduce: boolean) => void): () => void {
  if (typeof window === "undefined" || !window?.matchMedia) return () => {}
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  // Fire the initial state synchronously so callers can mute immediately.
  onChange(mq.matches)
  const listener = (e: { matches: boolean }): void => {
    onChange(e.matches)
  }
  mq.addEventListener("change", listener)
  return () => mq.removeEventListener("change", listener)
}
