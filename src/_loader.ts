/// <reference path="./env.d.ts" />
import { DecodeError, LoadError } from "./errors.ts"

/** Fetch a URL and decode it into an AudioBuffer. */
export async function fetchAndDecode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let res
  try {
    res = await fetch(url)
  } catch (cause) {
    throw new LoadError(`seslen: failed to fetch ${url}`, { cause })
  }
  if (!res.ok) throw new LoadError(`seslen: failed to fetch ${url}`)
  const bytes = await res.arrayBuffer()
  try {
    return await ctx.decodeAudioData(bytes)
  } catch (cause) {
    throw new DecodeError(`seslen: failed to decode ${url}`, { cause })
  }
}
