import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { PatternStep } from "seslen"
import { presetEntries } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

export interface PreviewPanelHandle {
  runPlayhead: (durationMs: number) => void
  stopPlayhead: () => void
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
  const [playheadMs, setPlayheadMs] = useState(0)
  const [playheadVisible, setPlayheadVisible] = useState(false)
  const playheadRafRef = useRef<number>(0)

  const viewStart = Math.max(0, viewStartMs ?? 0)
  const viewEnd = useMemo(() => {
    const fallback = totalMs
    const v = viewEndMs ?? fallback
    if (v <= viewStart) return Math.max(viewStart + 1, fallback)
    return v
  }, [viewEndMs, viewStart, totalMs])

  const totalLabel = formatTime(totalMs)
  const viewLabel = `${formatTime(viewStart)} → ${formatTime(viewEnd)}`

  const playheadPct = useMemo(() => {
    const span = Math.max(1, viewEnd - viewStart)
    const ratio = (playheadMs - viewStart) / span
    return Math.max(0, Math.min(1, ratio))
  }, [playheadMs, viewStart, viewEnd])

  const playheadInView = playheadVisible && playheadMs >= viewStart && playheadMs <= viewEnd

  useImperativeHandle(ref, () => ({
    runPlayhead(durationMs: number) {
      if (durationMs <= 0) return
      if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current)
      setPlayheadVisible(true)
      const start = performance.now()
      const tick = (): void => {
        const elapsed = performance.now() - start
        if (elapsed >= durationMs) {
          playheadRafRef.current = 0
          setPlayheadVisible(false)
          setPlayheadMs(0)
          return
        }
        setPlayheadMs(elapsed)
        playheadRafRef.current = requestAnimationFrame(tick)
      }
      playheadRafRef.current = requestAnimationFrame(tick)
    },
    stopPlayhead() {
      if (playheadRafRef.current) {
        cancelAnimationFrame(playheadRafRef.current)
        playheadRafRef.current = 0
      }
      setPlayheadVisible(false)
      setPlayheadMs(0)
    },
  }))

  /* ------------------------------------------------------ waveform render */

  const renderTokenRef = useRef(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    function schedule(): void {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void renderWaveform()
      }, 80)
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

      const sampleRate = 44100
      const length = Math.max(1, Math.floor((sampleRate * Math.max(totalMs, 200)) / 1000))
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
  }, [steps, totalMs, viewStart, viewEnd])

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
          className="absolute top-0 bottom-0 w-px bg-background/80"
          style={{
            left: `${playheadPct * 100}%`,
            display: playheadInView ? "block" : "none",
          }}
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
