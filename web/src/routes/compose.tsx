import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { presetEntries, type PresetEntry } from "seslen/presets"
import type { PlayHandle } from "seslen"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowDown01Icon,
  UndoIcon,
  RedoIcon,
  PauseIcon,
  PlayCircleIcon,
  PlusSignIcon,
  Share01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { MAX_PX_PER_MS, MAX_TOTAL, MIN_PX_PER_MS, MIN_TOTAL, useBuilder } from "@/store/builder"
import { useSeslen } from "@/store/seslen"
import { accentOf } from "@/lib/preset-meta"
import { decode, encode } from "@/lib/share-link"
import { demos, type Demo } from "@/lib/demos"
import { Timeline, type TimelineHandle } from "@/components/Timeline"
import { Snippet } from "@/components/Snippet"
import { PlaybackOptions } from "@/components/PlaybackOptions"
import { ActivityLog } from "@/components/ActivityLog"
import { BlockInspector } from "@/components/BlockInspector"
import { PresetSidebar } from "@/components/PresetSidebar"
import { PreviewPanel, type PreviewPanelHandle } from "@/components/PreviewPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ComposeSearch {
  p?: string
  seed?: string
}

export const Route = createFileRoute("/compose")({
  validateSearch: (search: Record<string, unknown>): ComposeSearch => ({
    p: typeof search.p === "string" ? search.p : undefined,
    seed: typeof search.seed === "string" ? search.seed : undefined,
  }),
  component: ComposePage,
})

const SNAP_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "1", label: "1ms" },
  { value: "10", label: "10ms" },
  { value: "50", label: "50ms" },
  { value: "100", label: "100ms" },
]

function formatTime(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const s = ms / 1000
  const m = Math.floor(s / 60)
  const r = (s - m * 60).toFixed(2).padStart(5, "0")
  return `${m}:${r}`
}

interface DragState {
  presetId: string
  pointer: { x: number; y: number }
  overLaneId: number | null
  overMs: number | null
}

function ComposePage(): React.ReactElement {
  const navigate = useNavigate({ from: "/compose" })
  const search = Route.useSearch()

  const lanes = useBuilder((s) => s.lanes)
  const totalMs = useBuilder((s) => s.totalMs)
  const pxPerMs = useBuilder((s) => s.pxPerMs)
  const selected = useBuilder((s) => s.selected)
  const builder = useBuilder.getState

  const stepsSig = useMemo(
    () =>
      JSON.stringify(
        lanes.map((l) => [
          l.muted,
          l.blocks.map((b) => [
            b.id,
            b.position,
            b.duration,
            b.intensity,
            b.rate,
            b.detune,
            b.presetId,
          ]),
        ]),
      ),
    [lanes],
  )
  const steps = useMemo(() => builder().steps(), [stepsSig, builder])
  const total = useMemo(() => {
    let max = 0
    for (const s of steps) {
      const at = s.at ?? 0
      const dur = presetEntries[s.id]?.durationMs ?? 0
      const end = at + dur
      if (end > max) max = end
    }
    return max
  }, [steps])
  const selectedView = useMemo(() => builder().selectedBlock(), [stepsSig, selected, builder])

  const seslenPlay = useSeslen((s) => s.play)
  const seslenPlayPattern = useSeslen((s) => s.playPattern)
  const seslenStopAll = useSeslen((s) => s.stopAll)

  const initialPresetId = (Object.keys(presetEntries)[0] ?? "tick") as string
  const [activePresetId, setActivePresetId] = useState<string>(initialPresetId)
  const [snapMs, setSnapMs] = useState<number>(10)
  const [followPlayhead, setFollowPlayhead] = useState<boolean>(true)
  const [view, setView] = useState<{ startMs: number; endMs: number }>({
    startMs: 0,
    endMs: 10_000,
  })
  const [playing, setPlaying] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [demosOpen, setDemosOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)

  const timelineRef = useRef<TimelineHandle | null>(null)
  const previewRef = useRef<PreviewPanelHandle | null>(null)
  const liveHandleRef = useRef<PlayHandle | null>(null)
  const elapsedRafRef = useRef<number>(0)
  const playTokenRef = useRef(0)

  /* hydrate from URL once */
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const p = search.p ?? ""
    if (p) {
      const restored = decode(p)
      if (restored && restored.lanes.length > 0) {
        builder().load(restored.lanes)
        if (typeof restored.totalMs === "number") builder().setTotalMs(restored.totalMs)
        const first = restored.lanes[0]?.blocks[0]
        if (first) setActivePresetId(first.presetId)
        return
      }
    }
    const seed = search.seed ?? ""
    if (seed && presetEntries[seed]) {
      setActivePresetId(seed)
      const firstLane = builder().lanes[0]
      if (firstLane) {
        builder().appendBlock(firstLane.id, seed)
        builder().commit()
      }
    }
  }, [builder, search.p, search.seed])

  /* mirror state -> URL */
  useEffect(() => {
    const code = encode(lanes, totalMs)
    void navigate({
      to: "/compose",
      search: code ? { p: code } : {},
      replace: true,
    })
  }, [lanes, totalMs, navigate])

  function endPlayback(): void {
    playTokenRef.current++
    // Stop the pattern handle and every fire-and-forget sound so a
    // mid-playback stop kills lingering sidebar previews / drop blips
    // that aren't tracked by liveHandleRef.
    if (liveHandleRef.current) {
      liveHandleRef.current.stop()
      liveHandleRef.current = null
    }
    seslenStopAll()
    if (elapsedRafRef.current) {
      cancelAnimationFrame(elapsedRafRef.current)
      elapsedRafRef.current = 0
    }
    timelineRef.current?.stopPlayhead()
    previewRef.current?.stopPlayhead()
    setPlaying(false)
    setElapsedMs(0)
  }

  function play(): void {
    if (playing) {
      endPlayback()
      return
    }
    const liveSteps = builder().steps()
    if (liveSteps.length === 0) return
    // Audible span: latest step.at + that preset's durationMs. `builder.total()`
    // is block-edge — a UI-only construct — but the underlying preset only
    // sounds for `presetEntry.durationMs`, so use that to keep playhead and
    // counter in sync with what the user hears.
    let span = 0
    for (const s of liveSteps) {
      const end = (s.at ?? 0) + (presetEntries[s.id]?.durationMs ?? 0)
      if (end > span) span = end
    }
    if (span <= 0) return

    const token = ++playTokenRef.current
    timelineRef.current?.runPlayhead(span)
    previewRef.current?.runPlayhead(span)
    setPlaying(true)
    setElapsedMs(0)

    const startedAt = performance.now()
    function tickElapsed(): void {
      if (playTokenRef.current !== token) return
      const t = performance.now() - startedAt
      if (t >= span) {
        endPlayback()
        return
      }
      setElapsedMs(t)
      elapsedRafRef.current = requestAnimationFrame(tickElapsed)
    }
    elapsedRafRef.current = requestAnimationFrame(tickElapsed)

    void (async () => {
      const handle = await seslenPlayPattern(liveSteps)
      if (playTokenRef.current !== token) {
        handle.stop()
        return
      }
      liveHandleRef.current = handle
      handle.onEnded(() => {
        if (playTokenRef.current === token) endPlayback()
      })
    })()
  }

  useEffect(() => {
    return () => {
      endPlayback()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function workspaceHasContent(): boolean {
    return builder().lanes.some((l) => l.blocks.length > 0)
  }
  function loadDemo(demo: Demo): void {
    if (workspaceHasContent()) {
      const ok = window.confirm(
        `Loading "${demo.label}" will replace your current workspace. Continue?`,
      )
      if (!ok) {
        setDemosOpen(false)
        return
      }
    }
    builder().load(demo.lanes)
    builder().setTotalMs(demo.totalMs)
    builder().commit()
    const firstPresetId = demo.lanes.find((l) => l.blocks.length > 0)?.blocks[0]?.presetId
    if (firstPresetId && presetEntries[firstPresetId]) setActivePresetId(firstPresetId)
    setDemosOpen(false)
    setTimeout(() => play(), 80)
  }

  function addEmptyLane(): void {
    builder().addLane()
    builder().commit()
  }
  function clearAll(): void {
    builder().reset()
  }
  function removeLane(laneId: number): void {
    builder().removeLane(laneId)
    builder().commit()
  }
  function renameLane(payload: { laneId: number; name: string }): void {
    builder().setLaneName(payload.laneId, payload.name)
    builder().commit()
  }
  function toggleLaneMute(laneId: number): void {
    const lane = builder().lanes.find((l) => l.id === laneId)
    if (lane) builder().setLaneMuted(laneId, !lane.muted)
    builder().commit()
  }
  function onDropBlock(payload: { laneId: number; ms: number }): void {
    const block = builder().addBlockAt(payload.laneId, payload.ms, activePresetId, snapMs || 1)
    if (block) {
      builder().commit()
      void seslenPlay(activePresetId)
    }
  }

  // Stable identity so Timeline's view-emit useEffect doesn't re-run on
  // every ComposePage render; without this, Timeline schedules a fresh
  // RAF emit per render and React 19 flags the resulting setView() as
  // "update during a different component's render".
  const onViewChange = useCallback(
    (payload: { startMs: number; endMs: number }) => {
      const t = builder().totalMs
      setView((prev) => {
        const startMs = Math.max(0, Math.min(t, payload.startMs))
        const endMs = Math.max(0, Math.min(t, payload.endMs))
        if (prev.startMs === startMs && prev.endMs === endMs) return prev
        return { startMs, endMs }
      })
    },
    [builder],
  )

  function snap(ms: number, q: number): number {
    if (q <= 1) return Math.round(ms)
    return Math.round(ms / q) * q
  }

  function onSidebarBeginDrag(payload: {
    presetId: string
    pointer: { x: number; y: number }
  }): void {
    const initial: DragState = {
      presetId: payload.presetId,
      pointer: payload.pointer,
      overLaneId: null,
      overMs: null,
    }
    setDrag(initial)
    // PresetSidebar already disables user-select on its own pointerdown,
    // but if the drag arrives here through some other path the page text
    // could still highlight as the cursor moves; lock it for the lifetime
    // of the drag.
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = "none"

    const move = (e: PointerEvent): void => {
      const tl = timelineRef.current
      if (!tl) {
        setDrag((d) =>
          d ? { ...d, pointer: { x: e.clientX, y: e.clientY }, overLaneId: null, overMs: null } : d,
        )
        return
      }
      const hit = tl.hitTest(e.clientX, e.clientY)
      setDrag((d) => {
        if (!d) return d
        return {
          ...d,
          pointer: { x: e.clientX, y: e.clientY },
          overLaneId: hit ? hit.laneId : null,
          overMs: hit ? snap(Math.max(0, hit.ms), snapMs || 1) : null,
        }
      })
    }
    const cleanup = (): void => {
      document.body.style.userSelect = prevUserSelect
    }
    const up = (): void => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("keydown", key)
      cleanup()
      setDrag((d) => {
        if (d && d.overLaneId !== null && d.overMs !== null) {
          const block = builder().addBlockAt(d.overLaneId, d.overMs, d.presetId, snapMs || 1)
          if (block) {
            builder().commit()
            void seslenPlay(d.presetId)
          }
        }
        return null
      })
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("keydown", key)
        cleanup()
        setDrag(null)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up, { once: true })
    window.addEventListener("keydown", key)
  }

  const shareUrl = useMemo(() => {
    const code = encode(lanes, totalMs)
    if (typeof window === "undefined") return ""
    if (!code) return `${window.location.origin}/compose`
    return `${window.location.origin}/compose?p=${code}`
  }, [lanes, totalMs])

  async function copyShare(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1100)
    } catch {
      // ignore
    }
  }

  function nudgeSelected(deltaMs: number): void {
    const sel = builder().selected
    if (!sel) return
    const lane = builder().lanes.find((l) => l.id === sel.laneId)
    const block = lane?.blocks.find((b) => b.id === sel.blockId)
    if (!lane || !block) return
    builder().movePosition(sel.laneId, sel.blockId, block.position + deltaMs, snapMs || 1)
  }
  function resizeSelected(deltaMs: number): void {
    const sel = builder().selected
    if (!sel) return
    const lane = builder().lanes.find((l) => l.id === sel.laneId)
    const block = lane?.blocks.find((b) => b.id === sel.blockId)
    if (!lane || !block) return
    builder().resizeRight(
      sel.laneId,
      sel.blockId,
      block.position + block.duration + deltaMs,
      snapMs || 1,
    )
  }
  function duplicateSelected(): void {
    const sel = builder().selected
    if (!sel) return
    builder().duplicateBlock(sel.laneId, sel.blockId)
    builder().commit()
  }
  function deleteSelected(): void {
    const sel = builder().selected
    if (!sel) return
    builder().removeBlock(sel.laneId, sel.blockId)
    builder().commit()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const t = e.target as HTMLElement | null
      const inForm = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement
      if (inForm) return

      const meta = e.metaKey || e.ctrlKey

      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault()
        if (e.shiftKey) builder().redo()
        else builder().undo()
        return
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault()
        builder().redo()
        return
      }
      if (meta && (e.key === "d" || e.key === "D")) {
        e.preventDefault()
        duplicateSelected()
        return
      }
      if (e.key === "Escape") {
        void navigate({ to: "/" })
        return
      }
      if ((e.key === "Backspace" || e.key === "Delete") && builder().selected !== null) {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (e.key === " " && builder().steps().length > 0) {
        e.preventDefault()
        play()
        return
      }
      if (builder().selected !== null) {
        const step = e.shiftKey ? 100 : snapMs || 1
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          nudgeSelected(-step)
          builder().commit()
          return
        }
        if (e.key === "ArrowRight") {
          e.preventDefault()
          nudgeSelected(step)
          builder().commit()
          return
        }
        if (e.key === "[") {
          e.preventDefault()
          resizeSelected(-step)
          builder().commit()
          return
        }
        if (e.key === "]") {
          e.preventDefault()
          resizeSelected(step)
          builder().commit()
          return
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [snapMs, navigate, builder])

  const lengthSec = Math.round(totalMs / 100) / 10
  function setLengthSec(s: number): void {
    const ms = Math.round(s * 1000)
    builder().setTotalMs(ms)
  }

  const activeEntry: PresetEntry | undefined = presetEntries[activePresetId]
  const totalLabel = formatTime(total)

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col bg-muted ${
        activeEntry ? accentOf(activeEntry) : "accent-blue"
      }`}
    >
      <header className="h-11 flex items-center gap-2 px-3 bg-background border-b shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Back (Esc)"
          onClick={() => void navigate({ to: "/" })}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <h1 className="font-semibold tracking-tight text-[13px]">Composer</h1>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
          seslen / compose
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Popover open={demosOpen} onOpenChange={setDemosOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm">
                  Demos
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                </Button>
              }
            />
            <PopoverContent align="end" sideOffset={6} className="w-72 p-0">
              <div className="p-2 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Demo patterns
              </div>
              {demos.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  className="w-full px-3 py-2.5 flex flex-col items-start gap-0.5 text-left hover:bg-muted transition cursor-pointer"
                  onClick={() => loadDemo(demo)}
                >
                  <span className="text-[12px] font-semibold">{demo.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    {demo.description}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {(demo.totalMs / 1000).toFixed(2)}s · {demo.lanes.length}{" "}
                    {demo.lanes.length === 1 ? "track" : "tracks"}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" disabled={lanes.length === 0} onClick={clearAll}>
            Clear
          </Button>
          <Button
            variant={copied ? "default" : "outline"}
            size="sm"
            disabled={steps.length === 0}
            onClick={copyShare}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Share01Icon} strokeWidth={2} />
            {copied ? "Link copied" : "Share"}
          </Button>
        </div>
      </header>

      <main
        className="flex-1 grid min-h-0 min-w-0 overflow-hidden"
        style={{
          gridTemplateColumns: "240px 1fr 320px",
          gridTemplateRows: "1fr auto minmax(220px, 36vh)",
        }}
      >
        <div className="row-span-3 min-h-0 min-w-0 overflow-hidden">
          <PresetSidebar
            activeId={activePresetId}
            onActiveIdChange={setActivePresetId}
            onBeginDrag={onSidebarBeginDrag}
          />
        </div>

        <div className="min-w-0 min-h-0 overflow-hidden flex flex-col">
          <PreviewPanel
            ref={previewRef}
            totalMs={total}
            steps={steps}
            viewStartMs={view.startMs}
            viewEndMs={view.endMs}
            hasContent={steps.length > 0}
            playing={playing}
            onPlay={play}
          />
        </div>

        <aside className="row-span-3 border-l bg-background flex flex-col gap-5 p-4 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          {selectedView ? (
            <BlockInspector lane={selectedView.lane} block={selectedView.block} />
          ) : (
            <section className="flex flex-col gap-3 rounded-xl bg-muted/40 ring-1 ring-border p-3 text-[12px] text-muted-foreground">
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">How it works</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Drag a preset from the left sidebar onto a lane.</li>
                  <li>Drag to move, edges to resize, top/bottom for intensity.</li>
                  <li>Drag a block off the lane to delete it.</li>
                  <li>⌘/Ctrl + scroll to zoom; toolbar Snap controls grid quantum.</li>
                  <li>
                    <strong>+ Track</strong> adds a new empty lane.
                  </li>
                </ol>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">Shortcuts</p>
                <ul className="font-mono text-[11px] space-y-0.5">
                  <li>
                    <kbd>Space</kbd> play pattern
                  </li>
                  <li>
                    <kbd>← →</kbd> nudge selected · <kbd>Shift</kbd> ±100ms
                  </li>
                  <li>
                    <kbd>[ ]</kbd> resize selected
                  </li>
                  <li>
                    <kbd>⌘D</kbd> duplicate · <kbd>⌫</kbd> delete
                  </li>
                  <li>
                    <kbd>⌘Z</kbd> undo · <kbd>⌘⇧Z</kbd> redo
                  </li>
                </ul>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Preview defaults
            </h2>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Used by sidebar ▶ previews. Per-block options live in the inspector above and override
              these.
            </p>
            <PlaybackOptions />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Snippet
            </h2>
            <Snippet steps={steps} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Activity
            </h2>
            <ActivityLog />
          </section>
        </aside>

        {/* transport */}
        <div className="bg-background border-t min-w-0 px-3 py-2 flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="default"
                  size="icon"
                  className={
                    playing
                      ? "bg-destructive hover:bg-destructive/80 text-destructive-foreground"
                      : ""
                  }
                  disabled={steps.length === 0}
                  onClick={play}
                >
                  <HugeiconsIcon icon={playing ? PauseIcon : PlayCircleIcon} strokeWidth={2} />
                </Button>
              }
            />
            <TooltipContent>{playing ? "Stop (Space)" : "Play (Space)"}</TooltipContent>
          </Tooltip>

          <span className="font-mono text-[12px] tabular-nums text-muted-foreground min-w-[110px]">
            <span className={playing ? "text-foreground" : ""}>{formatTime(elapsedMs)}</span>
            <span className="opacity-60"> / </span>
            <span>{totalLabel}</span>
          </span>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon-sm" onClick={() => builder().undo()}>
                    <HugeiconsIcon icon={UndoIcon} strokeWidth={2} />
                  </Button>
                }
              />
              <TooltipContent>Undo (⌘Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon-sm" onClick={() => builder().redo()}>
                    <HugeiconsIcon icon={RedoIcon} strokeWidth={2} />
                  </Button>
                }
              />
              <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Button variant="outline" size="sm" onClick={addEmptyLane}>
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
            Track
          </Button>

          <Button
            variant={followPlayhead ? "default" : "outline"}
            size="sm"
            title={followPlayhead ? "Follow playhead is on" : "Follow playhead is off"}
            onClick={() => setFollowPlayhead((v) => !v)}
          >
            Follow
          </Button>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Label className="font-semibold uppercase tracking-wider text-[10px]">Snap</Label>
            <Select
              value={String(snapMs)}
              onValueChange={(v) => {
                if (typeof v === "string") setSnapMs(Number(v))
              }}
            >
              <SelectTrigger className="h-7 px-2 text-[11px] tabular-nums w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SNAP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Label className="font-semibold uppercase tracking-wider text-[10px]">Length</Label>
            <Input
              value={lengthSec}
              type="number"
              min={MIN_TOTAL / 1000}
              max={MAX_TOTAL / 1000}
              step={0.1}
              className="w-20 h-7 text-[11px] tabular-nums"
              onChange={(e) => setLengthSec(Number(e.target.value))}
            />
            <span>s</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-auto min-w-[180px]">
            <Label className="font-semibold uppercase tracking-wider text-[10px]">Zoom</Label>
            <Slider
              value={[pxPerMs]}
              min={MIN_PX_PER_MS}
              max={MAX_PX_PER_MS}
              step={0.01}
              className="w-32"
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                if (typeof n === "number") builder().setPxPerMs(n)
              }}
            />
          </div>
        </div>

        <section className="bg-background border-t min-h-0 min-w-0 flex flex-col overflow-hidden">
          <Timeline
            ref={timelineRef}
            snapMs={snapMs || 1}
            dragOverLaneId={drag?.overLaneId ?? null}
            dragOverMs={drag?.overMs ?? null}
            followPlayhead={followPlayhead}
            onDropBlock={onDropBlock}
            onRemoveLane={removeLane}
            onToggleMute={toggleLaneMute}
            onRenameLane={renameLane}
            onViewChange={onViewChange}
          />
        </section>
      </main>

      {drag && (
        <div
          className={`fixed z-50 pointer-events-none rounded-full px-3 py-1 text-[12px] font-semibold bg-background shadow-lg ring-1 ring-border flex items-center gap-2 ${
            presetEntries[drag.presetId] ? accentOf(presetEntries[drag.presetId]!) : "accent-blue"
          }`}
          style={{
            left: `${drag.pointer.x + 12}px`,
            top: `${drag.pointer.y + 12}px`,
          }}
        >
          <span className="dot" />
          <span>{presetEntries[drag.presetId]?.label ?? drag.presetId}</span>
        </div>
      )}
    </div>
  )
}
