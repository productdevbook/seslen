/** Base class for every error thrown by `seslen`. Use `instanceof` to gate
 *  recovery paths. */
export class SeslenError extends Error {
  override name = "SeslenError"
}

/** Thrown when the AudioContext is unavailable — typically because the
 *  caller is on a non-browser runtime. */
export class ContextNotReadyError extends SeslenError {
  override name = "ContextNotReadyError"
}

/** Thrown when `decodeAudioData` rejects (corrupt or unsupported format). */
export class DecodeError extends SeslenError {
  override name = "DecodeError"
}

/** Thrown when the underlying `fetch` for a sound fails. */
export class LoadError extends SeslenError {
  override name = "LoadError"
}
