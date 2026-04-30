/// <reference path="./env.d.ts" />
import { ContextNotReadyError } from "./errors.ts"

/** Lazy AudioContext factory + auto-unlock on first user gesture.
 *
 *  Browsers suspend the context until a user interaction. We resume it on
 *  the first `pointerdown` / `keydown` / `touchstart` and detach the
 *  listeners. SSR-safe: returns null on non-browser runtimes. */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof AudioContext !== "undefined"
}

export function createContext(): AudioContext {
  if (!isBrowser()) {
    throw new ContextNotReadyError("seslen: AudioContext is only available in the browser")
  }
  const ctx = new AudioContext()
  attachUnlock(ctx)
  return ctx
}

function attachUnlock(ctx: AudioContext): void {
  if (!window) return
  const events = ["pointerdown", "keydown", "touchstart"] as const
  const unlock = (): void => {
    if (ctx.state === "suspended") void ctx.resume()
    for (const evt of events) {
      window?.removeEventListener?.(evt, unlock as never)
    }
  }
  for (const evt of events) {
    window.addEventListener?.(evt, unlock as never, { once: true, passive: true })
  }
}
