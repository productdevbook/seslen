import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import type { PatternStep } from "seslen"
import { presetEntries } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

export interface PreviewPanelHandle {
  /** Move the playhead to `elapsedMs` from the start of the pattern. */
  paintPlayhead: (elapsedMs: number) => void
  /** Hide the playhead and reset its position. */
  hidePlayhead: () => void
}

interface Props {
  totalMs: number
  steps: PatternStep[]
  hasContent: boolean
  playing: boolean
  viewStartMs?: number
  viewEndMs?: number
  onPlay: () => void
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(2)}s`
  const m = Math.floor(s / 60)
  const r = (s - m * 60).toFixed(2).padStart(5, "0")
  return `${m}:${r}`
}

export const PreviewPanel = forwardRef<PreviewPanelHandle, Props>(function PreviewPanel(
  { totalMs, steps, hasContent, playing, viewStartMs, viewEndMs, onPlay },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const playheadRef = useRef<HTMLDivElement | null>(null)
  // Latest view-window in refs so the imperative paint method doesn't
  // depend on closure-captured props.
  const viewRangeRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: Math.max(1, totalMs),
  })

  const viewStart = Math.max(0, viewStartMs ?? 0)
  const viewEnd = useMemo(() => {
    const fallback = totalMs
    const v = viewEndMs ?? fallback
    if (v <= viewStart) return Math.max(viewStart + 1, fallback)
    return v
  }, [viewEndMs, viewStart, totalMs])

  // Keep the view-range ref in sync with the resolved viewStart/viewEnd
  // every render. Cheap, no re-render cost.
  viewRangeRef.current = { start: viewStart, end: viewEnd }

  const totalLabel = formatTime(totalMs)
  const viewLabel = `${formatTime(viewStart)} → ${formatTime(viewEnd)}`

  useImperativeHandle(ref, () => ({
    paintPlayhead(elapsedMs: number) {
      const el = playheadRef.current
      if (!el) return
      const { start, end } = viewRangeRef.current
      const span = Math.max(1, end - start)
      const ratio = Math.max(0, Math.min(1, (elapsedMs - start) / span))
      const inView = elapsedMs >= start && elapsedMs <= end
      el.style.display = inView ? "block" : "none"
      el.style.left = `${ratio * 100}%`
    },
    hidePlayhead() {
      if (playheadRef.current) {
        playheadRef.current.style.display = "none"
        playheadRef.current.style.left = "0%"
      }
    },
  }))

  /* ------------------------------------------------------ waveform render */

  const renderTokenRef = useRef(0)
  // Mirror `playing` into a ref so the schedule() callback can read the
  // latest value without re-running the effect (which would re-tear-down
  // the ResizeObserver).
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    function schedule(): void {
      if (timer) clearTimeout(timer)
      // Skip the offline render entirely while playing — the playhead
      // animation runs at 60fps and a 200-800ms render call inside the
      // click/play handler caused "[Violation] click handler took ~1s".
      // The waveform is already on screen from the last render; we'll
      // refresh it when playback ends.
      if (playingRef.current) return
      timer = setTimeout(() => {
        // Yield to the next idle slot so the click handler that triggered
        // this re-render can return immediately.
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(() => void renderWaveform(), { timeout: 400 })
        } else {
          void renderWaveform()
        }
      }, 250)
    }

    async function renderWaveform(): Promise<void> {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = canvas.clientWidth || 600
      const h = canvas.clientHeight || 120
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      if (steps.length === 0 || totalMs <= 0) {
        drawCenterline(ctx, w, h)
        return
      }

      // Halve the sample rate (22.05 kHz vs 44.1 kHz) and cap the buffer
      // length: the preview is a visual waveform, not playback audio, so
      // we don't need full-fidelity samples.
      const sampleRate = 22050
      const cappedMs = Math.min(Math.max(totalMs, 200), 8000)
      const length = Math.max(1, Math.floor((sampleRate * cappedMs) / 1000))
      type OACtor = new (channels: number, length: number, sampleRate: number) => unknown
      const Offline =
        (window as unknown as { OfflineAudioContext?: OACtor }).OfflineAudioContext ??
        (window as unknown as { webkitOfflineAudioContext?: OACtor }).webkitOfflineAudioContext
      if (!Offline) {
        drawCenterline(ctx, w, h)
        return
      }

      const myToken = ++renderTokenRef.current
      const offline = new Offline(1, length, sampleRate) as unknown as AudioContext & {
        startRendering(): Promise<AudioBuffer>
        currentTime: number
      }
      const master = offline.createGain()
      master.gain.value = 1
      master.connect(offline.destination)

      for (const step of steps) {
        const entry = presetEntries[step.id]
        if (!entry) continue
        const at = step.at ?? 0
        const delay = (
          offline as unknown as {
            createDelay(max: number): AudioNode & { delayTime: { value: number } }
          }
        ).createDelay(Math.max(0.1, at / 1000 + 1))
        delay.delayTime.value = at / 1000
        delay.connect(master)
        try {
          entry.factory(offline as AudioContext, delay as unknown as GainNode, step.options ?? {})
        } catch {
          // ignore
        }
      }

      let buffer: AudioBuffer
      try {
        buffer = await offline.startRendering()
      } catch {
        drawCenterline(ctx, w, h)
        return
      }
      if (myToken !== renderTokenRef.current) return

      const data = buffer.getChannelData(0)
      const cols = Math.max(1, w)
      const innerH = h
      const cy = innerH / 2

      const total = Math.max(1, totalMs)
      const startIdx = Math.max(
        0,
        Math.min(data.length, Math.floor((viewStart / total) * data.length)),
      )
      const endIdx = Math.max(
        startIdx + 1,
        Math.min(data.length, Math.ceil((viewEnd / total) * data.length)),
      )
      const span = endIdx - startIdx

      const peaks: { min: number; max: number }[] = new Array(cols)
      let absMax = 0
      for (let i = 0; i < cols; i++) {
        const s = startIdx + Math.floor((i / cols) * span)
        const e = startIdx + Math.floor(((i + 1) / cols) * span)
        let mn = 0
        let mx = 0
        for (let j = s; j < e; j++) {
          const v = data[j] ?? 0
          if (v < mn) mn = v
          if (v > mx) mx = v
        }
        peaks[i] = { min: mn, max: mx }
        const a = Math.max(Math.abs(mn), mx)
        if (a > absMax) absMax = a
      }

      const norm = absMax > 1e-4 ? 0.92 / absMax : 0
      const yScale = innerH * 0.45 * norm

      drawCenterline(ctx, w, h, "rgba(255,255,255,0.10)")
      const viewSpan = Math.max(1, viewEnd - viewStart)
      for (const step of steps) {
        const at = step.at ?? 0
        if (at < viewStart || at > viewEnd) continue
        const x = ((at - viewStart) / viewSpan) * w
        ctx.strokeStyle = "rgba(255,255,255,0.16)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.22)"
      ctx.beginPath()
      ctx.moveTo(0, cy)
      for (let i = 0; i < cols; i++) {
        const p = peaks[i]!
        ctx.lineTo(i, cy - p.max * yScale)
      }
      for (let i = cols - 1; i >= 0; i--) {
        const p = peaks[i]!
        ctx.lineTo(i, cy - p.min * yScale)
      }
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = "rgba(255, 255, 255, 0.90)"
      ctx.lineWidth = 1.25
      ctx.beginPath()
      for (let i = 0; i < cols; i++) {
        const p = peaks[i]!
        const peak = Math.max(Math.abs(p.min), p.max)
        const y = cy - peak * yScale
        if (i === 0) ctx.moveTo(i, y)
        else ctx.lineTo(i, y)
      }
      ctx.stroke()
    }

    function drawCenterline(
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      stroke = "rgba(255,255,255,0.12)",
    ): void {
      ctx.strokeStyle = stroke
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
    }

    schedule()
    const obs = new ResizeObserver(schedule)
    if (canvasRef.current) obs.observe(canvasRef.current)
    window.addEventListener("resize", schedule)

    return () => {
      if (timer) clearTimeout(timer)
      obs.disconnect()
      window.removeEventListener("resize", schedule)
    }
  }, [steps, totalMs, viewStart, viewEnd, playing])

  return (
    <section className="relative flex-1 flex flex-col bg-foreground text-background p-4 min-h-0 overflow-hidden">
      <header className="flex items-center gap-3 pb-2">
        <Button
          type="button"
          variant="default"
          size="icon-lg"
          className="bg-background text-foreground hover:bg-background/90"
          disabled={!hasContent}
          title="Play (Space)"
          onClick={onPlay}
        >
          <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} className="size-5" />
        </Button>
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider opacity-50">
            Total
            {playing && (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"
                title="Playing"
              />
            )}
          </span>
          <span className="font-mono text-[14px] tabular-nums">{totalLabel}</span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-wider opacity-50">Window</span>
          <span className="font-mono text-[12px] tabular-nums opacity-80">{viewLabel}</span>
        </div>
        <div className="ml-auto text-[11px] opacity-60 font-mono">
          {steps.length} {steps.length === 1 ? "block" : "blocks"}
        </div>
      </header>

      <div className="relative flex-1 min-h-0 overflow-hidden bg-foreground/40">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div
          ref={playheadRef}
          className="absolute top-0 bottom-0 w-px bg-background/80 pointer-events-none"
          style={{ display: "none", left: "0%" }}
        />
        {!hasContent && (
          <p className="absolute inset-0 flex items-center justify-center text-[12px] opacity-60">
            Drag a preset onto a lane to start.
          </p>
        )}
      </div>
    </section>
  )
})
