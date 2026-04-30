import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { presetEntries, type PresetEntry } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, VolumeMute01Icon } from "@hugeicons/core-free-icons"
import {
  DELETE_THRESHOLD,
  MAX_PX_PER_MS,
  MIN_PX_PER_MS,
  useBuilder,
  type Block,
  type Lane,
} from "@/store/builder"
import { accentOf } from "@/lib/preset-meta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface TimelineHandle {
  hitTest: (clientX: number, clientY: number) => { laneId: number; ms: number } | null
  /** Move the playhead to `elapsedMs` from the start of the pattern. */
  paintPlayhead: (elapsedMs: number) => void
  /** Hide the playhead and reset its position. */
  hidePlayhead: () => void
  scrollTo: (ms: number) => void
}

interface Props {
  snapMs: number
  dragOverLaneId?: number | null
  dragOverMs?: number | null
  followPlayhead?: boolean
  onDropBlock: (payload: { laneId: number; ms: number }) => void
  onRemoveLane: (laneId: number) => void
  onToggleMute: (laneId: number) => void
  onRenameLane: (payload: { laneId: number; name: string }) => void
  onViewChange: (payload: { startMs: number; endMs: number }) => void
}

const LANE_H = 56
const RULER_H = 28
const LABEL_W = 200

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}`
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(2)}s`
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const r = (s - m * 60).toFixed(0).padStart(2, "0")
  return `${m}:${r}`
}

function presetEntry(presetId: string | undefined): PresetEntry | undefined {
  if (!presetId) return undefined
  return presetEntries[presetId]
}

export const Timeline = forwardRef<TimelineHandle, Props>(function Timeline(
  {
    snapMs,
    dragOverLaneId,
    dragOverMs,
    followPlayhead = true,
    onDropBlock,
    onRemoveLane,
    onToggleMute,
    onRenameLane,
    onViewChange,
  },
  ref,
) {
  const lanes = useBuilder((s) => s.lanes)
  const totalMs = useBuilder((s) => s.totalMs)
  const pxPerMs = useBuilder((s) => s.pxPerMs)
  const selected = useBuilder((s) => s.selected)
  const pendingDelete = useBuilder((s) => s.pendingDelete)
  const builderApi = useBuilder

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const playheadRef = useRef<HTMLDivElement | null>(null)
  const playheadVisibleRef = useRef(false)
  const userScrolledRef = useRef(false)
  const followRef = useRef(followPlayhead)
  followRef.current = followPlayhead

  const contentW = Math.max(400, Math.round(totalMs * pxPerMs))

  /* ------------------------------------------------------------ ruler */

  const ruler = useMemo(() => {
    const out: { ms: number; major: boolean; label: string | null }[] = []
    const minPxPerLabel = 64
    const labelStepCandidates = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000]
    let labelStep = 1000
    for (const c of labelStepCandidates) {
      if (c * pxPerMs >= minPxPerLabel) {
        labelStep = c
        break
      }
    }
    const minorStep = Math.max(50, Math.round(labelStep / 5))
    for (let ms = 0; ms <= totalMs; ms += minorStep) {
      const isMajor = ms % labelStep === 0
      out.push({ ms, major: isMajor, label: isMajor ? formatTime(ms) : null })
    }
    return out
  }, [totalMs, pxPerMs])

  /* ----------------------------------------------------- imperative */

  useImperativeHandle(ref, () => ({
    hitTest(clientX, clientY) {
      const root = scrollRef.current
      if (!root) return null
      const laneEls = root.querySelectorAll<HTMLDivElement>(".lane[data-lane-id]")
      for (const laneEl of laneEls) {
        const r = laneEl.getBoundingClientRect()
        if (clientY < r.top || clientY > r.bottom) continue
        const areaEl = laneEl.querySelector<HTMLDivElement>(".lane-area")
        if (!areaEl) continue
        const ar = areaEl.getBoundingClientRect()
        if (clientX < ar.left || clientX > ar.right) continue
        const laneId = Number(laneEl.dataset.laneId)
        const ms = (clientX - ar.left) / pxPerMs
        return { laneId, ms }
      }
      return null
    },
    scrollTo(ms) {
      const root = scrollRef.current
      if (!root) return
      root.scrollLeft = Math.max(0, ms * pxPerMs - 80)
    },
    paintPlayhead(elapsedMs) {
      const el = playheadRef.current
      const root = scrollRef.current
      if (!el) return
      // First paint of a new run: reveal the head and start watching for
      // user-driven scrolls so we can pause the auto-follow.
      if (!playheadVisibleRef.current) {
        playheadVisibleRef.current = true
        userScrolledRef.current = false
        el.style.display = "block"
        if (root && !root.dataset.tlPlayheadHook) {
          root.dataset.tlPlayheadHook = "1"
          const onUserScroll = (e: Event): void => {
            if ((e as Event & { isTrusted?: boolean }).isTrusted) {
              userScrolledRef.current = true
            }
          }
          root.addEventListener("wheel", onUserScroll, { passive: true })
          root.addEventListener("pointerdown", onUserScroll)
        }
      }
      el.style.left = `${LABEL_W + elapsedMs * pxPerMs}px`

      if (followRef.current && !userScrolledRef.current && root) {
        const visiblePx = Math.max(0, root.clientWidth - LABEL_W)
        if (visiblePx > 0) {
          const playheadX = elapsedMs * pxPerMs
          const visStart = root.scrollLeft
          const trigger = visStart + visiblePx * 0.8
          if (playheadX > trigger || playheadX < visStart) {
            const target = playheadX - visiblePx * 0.2
            const newContentW = Math.max(400, Math.round(totalMs * pxPerMs))
            const maxScroll = Math.max(0, newContentW - visiblePx)
            root.scrollLeft = Math.max(0, Math.min(maxScroll, target))
          }
        }
      }
    },
    hidePlayhead() {
      playheadVisibleRef.current = false
      userScrolledRef.current = false
      if (playheadRef.current) {
        playheadRef.current.style.display = "none"
        playheadRef.current.style.left = "0px"
      }
    },
  }))

  /* ----------------------------------------------------------- view emit */

  useEffect(() => {
    let raf = 0
    function emit(): void {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const root = scrollRef.current
        if (!root) return
        const visiblePx = Math.max(0, root.clientWidth - LABEL_W)
        const startMs = root.scrollLeft / pxPerMs
        const endMs = startMs + visiblePx / pxPerMs
        onViewChange({
          startMs: Math.max(0, startMs),
          endMs: Math.min(totalMs, endMs),
        })
      })
    }
    emit()
    const root = scrollRef.current
    root?.addEventListener("scroll", emit, { passive: true })
    const obs = new ResizeObserver(emit)
    if (root) obs.observe(root)
    return () => {
      root?.removeEventListener("scroll", emit)
      obs.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [pxPerMs, totalMs, onViewChange])

  /* -------------------------------------------------- pointer handlers */

  function laneClick(lane: Lane, e: React.MouseEvent): void {
    const target = e.target as HTMLElement
    if (target.closest(".tl-region")) return
    if (target.closest(".lane-label")) return
    const laneAreaEl = target.closest(".lane-area") as HTMLElement | null
    if (!laneAreaEl) return
    const rect = laneAreaEl.getBoundingClientRect()
    const ms = (e.clientX - rect.left) / pxPerMs
    onDropBlock({ laneId: lane.id, ms })
  }

  function lockSelection(): () => void {
    const prev = document.body.style.userSelect
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.userSelect = prev
    }
  }

  function startBlockDrag(lane: Lane, b: Block, e: React.PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()
    builderApi.getState().select(lane.id, b.id)

    const tgt = e.target as HTMLElement
    if (tgt.classList.contains("h-edge")) return
    if (tgt.classList.contains("v-edge")) return

    const laneEl = (e.currentTarget as HTMLElement).closest(".lane") as HTMLElement | null
    if (!laneEl) return
    const rect = laneEl.getBoundingClientRect()

    const cursorMs = (e.clientX - rect.left) / pxPerMs
    const offsetMs = cursorMs - b.position
    const unlock = lockSelection()

    function onMove(ev: PointerEvent): void {
      const distLeft = rect.left - ev.clientX
      const distRight = ev.clientX - rect.right
      const distTop = rect.top - ev.clientY
      const distBottom = ev.clientY - rect.bottom
      const maxDist = Math.max(distLeft, distRight, distTop, distBottom)
      if (maxDist > DELETE_THRESHOLD) {
        builderApi.getState().setPendingDelete(lane.id, b.id)
        return
      }
      builderApi.getState().setPendingDelete(null, null)
      const ms = (ev.clientX - rect.left) / pxPerMs - offsetMs
      builderApi.getState().movePosition(lane.id, b.id, ms, snapMs)
    }
    function onUp(): void {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      unlock()
      const pd = builderApi.getState().pendingDelete
      if (pd && pd.laneId === lane.id && pd.blockId === b.id) {
        builderApi.getState().removeBlock(lane.id, b.id)
      }
      builderApi.getState().commit()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
  }

  function startResize(lane: Lane, b: Block, edge: "left" | "right", e: React.PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const laneEl = (e.currentTarget as HTMLElement).closest(".lane") as HTMLElement | null
    if (!laneEl) return
    const rect = laneEl.getBoundingClientRect()
    const unlock = lockSelection()
    function onMove(ev: PointerEvent): void {
      const ms = (ev.clientX - rect.left) / pxPerMs
      if (edge === "right") builderApi.getState().resizeRight(lane.id, b.id, ms, snapMs)
      else builderApi.getState().resizeLeft(lane.id, b.id, ms, snapMs)
    }
    function onUp(): void {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      unlock()
      builderApi.getState().commit()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
  }

  function startIntensity(
    lane: Lane,
    b: Block,
    edge: "top" | "bottom",
    e: React.PointerEvent,
  ): void {
    e.preventDefault()
    e.stopPropagation()
    const regionEl = e.currentTarget as HTMLElement
    const rect = regionEl.parentElement!.getBoundingClientRect()
    const unlock = lockSelection()
    function onMove(ev: PointerEvent): void {
      const distFromEdge =
        edge === "top"
          ? (ev.clientY - rect.top) / rect.height
          : (rect.bottom - ev.clientY) / rect.height
      const intensity = 1 - distFromEdge * 2
      builderApi.getState().setIntensity(lane.id, b.id, intensity)
    }
    function onUp(): void {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      unlock()
      builderApi.getState().commit()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
  }

  /* zoom: ⌘/Ctrl + wheel */
  // Use a non-passive listener so we can preventDefault.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    function onWheel(e: WheelEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      if (!root) return

      const rect = root.getBoundingClientRect()
      const visibleAreaLeft = rect.left + LABEL_W
      const visibleAreaRight = rect.right
      const anchorX = Math.max(visibleAreaLeft, Math.min(visibleAreaRight, e.clientX))
      const offsetInArea = anchorX - visibleAreaLeft
      const cursorMs = (root.scrollLeft + offsetInArea) / pxPerMs

      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      else if (e.deltaMode === 2) dy *= rect.height
      const factor = Math.exp(-dy * 0.0035)

      const before = pxPerMs
      const next = Math.max(MIN_PX_PER_MS, Math.min(MAX_PX_PER_MS, before * factor))
      if (next === before) return

      builderApi.getState().setPxPerMs(next)
      const targetScrollLeft = cursorMs * next - offsetInArea
      const newContentW = Math.max(400, Math.round(totalMs * next))
      const maxScroll = Math.max(0, newContentW - (rect.width - LABEL_W))
      root.scrollLeft = Math.max(0, Math.min(maxScroll, targetScrollLeft))
    }
    root.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      root.removeEventListener("wheel", onWheel)
    }
  }, [pxPerMs, totalMs, builderApi])

  return (
    <div
      ref={scrollRef}
      className="tl-scroll relative overflow-x-auto overflow-y-auto bg-muted flex-1 min-h-[200px]"
    >
      <div
        className="relative"
        style={{
          width: `${LABEL_W + contentW}px`,
          minHeight: `${RULER_H + Math.max(lanes.length, 1) * LANE_H}px`,
        }}
      >
        {/* Sticky time ruler */}
        <div
          className="sticky top-0 z-30 bg-muted/95 backdrop-blur border-b border-border flex"
          style={{ height: `${RULER_H}px`, width: `${LABEL_W + contentW}px` }}
        >
          <div
            className="sticky left-0 z-20 bg-muted/95 border-r border-border shrink-0"
            style={{ width: `${LABEL_W}px` }}
          />
          <div className="relative shrink-0" style={{ width: `${contentW}px` }}>
            {ruler.map((t) => (
              <span
                key={t.ms}
                className="absolute bottom-0"
                style={{ left: `${t.ms * pxPerMs}px`, height: t.major ? "12px" : "6px" }}
              >
                <span
                  className={`absolute bottom-0 w-px ${t.major ? "bg-border" : "bg-border"}`}
                  style={{ height: t.major ? "12px" : "6px" }}
                />
                {t.label && (
                  <span
                    className="absolute font-mono text-[9px] text-muted-foreground tabular-nums whitespace-nowrap -translate-x-1/2"
                    style={{ bottom: "14px", left: "0" }}
                  >
                    {t.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {lanes.length === 0 && (
          <div
            className="absolute inset-x-0 flex items-center justify-center text-muted-foreground text-[12px]"
            style={{ top: `${RULER_H}px`, height: `${LANE_H * 2}px` }}
          >
            Add a track to start composing.
          </div>
        )}

        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="lane flex border-b border-border/70"
            data-lane-id={lane.id}
            style={{ height: `${LANE_H}px`, width: `${LABEL_W + contentW}px` }}
            onClick={(e) => laneClick(lane, e)}
          >
            <div
              className="lane-label sticky left-0 z-20 bg-background border-r px-2 py-1.5 flex items-center gap-1 shrink-0"
              style={{ width: `${LABEL_W}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                defaultValue={lane.name}
                key={`${lane.id}:${lane.name}`}
                className="h-7 px-2 text-[12px] font-semibold border-transparent bg-transparent shadow-none focus-visible:bg-muted/40"
                onBlur={(e) => onRenameLane({ laneId: lane.id, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                }}
              />
              <Button
                type="button"
                variant={lane.muted ? "default" : "ghost"}
                size="icon-xs"
                title={lane.muted ? "Unmute" : "Mute"}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleMute(lane.id)
                }}
              >
                <HugeiconsIcon icon={VolumeMute01Icon} strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title="Remove track"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveLane(lane.id)
                }}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </div>

            <div
              className={`lane-area relative shrink-0 ${lane.muted ? "opacity-50" : ""}`}
              style={{ width: `${contentW}px` }}
            >
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-border" />

              {dragOverLaneId === lane.id && typeof dragOverMs === "number" && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 pointer-events-none"
                  style={{ left: `${dragOverMs * pxPerMs}px` }}
                />
              )}

              {lane.blocks.map((b) => (
                <div
                  key={b.id}
                  className="absolute"
                  style={{
                    left: `${b.position * pxPerMs}px`,
                    width: `${Math.max(8, b.duration * pxPerMs)}px`,
                    top: "4px",
                    bottom: "4px",
                  }}
                >
                  <div
                    className={`tl-region ${
                      presetEntry(b.presetId) ? accentOf(presetEntry(b.presetId)!) : "accent-blue"
                    } ${pendingDelete?.blockId === b.id ? "wobble" : ""}`}
                    data-selected={selected?.blockId === b.id ? "true" : "false"}
                    style={{
                      top: `${(1 - b.intensity) * 30}%`,
                      bottom: `${(1 - b.intensity) * 30}%`,
                    }}
                    onPointerDown={(e) => startBlockDrag(lane, b, e)}
                  >
                    <div
                      className="h-edge left"
                      onPointerDown={(e) => startResize(lane, b, "left", e)}
                    />
                    <div
                      className="h-edge right"
                      onPointerDown={(e) => startResize(lane, b, "right", e)}
                    />
                    <div
                      className="v-edge top"
                      onPointerDown={(e) => startIntensity(lane, b, "top", e)}
                    />
                    <div
                      className="v-edge bottom"
                      onPointerDown={(e) => startIntensity(lane, b, "bottom", e)}
                    />
                    <span className="label">{presetEntry(b.presetId)?.label ?? b.presetId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div
          ref={playheadRef}
          className="tl-playhead z-30"
          style={{
            display: "none",
            top: `${RULER_H}px`,
            height: `${Math.max(lanes.length, 1) * LANE_H}px`,
          }}
        />
      </div>
    </div>
  )
})
