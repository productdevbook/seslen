import { useMemo, useState } from "react"
import { presetEntries, type PresetEntry } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayCircleIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { accentOf } from "@/lib/preset-meta"
import { useRecentPresets } from "@/store/recent-presets"
import { useSeslen } from "@/store/seslen"

interface Props {
  activeId: string
  onActiveIdChange: (id: string) => void
  onBeginDrag: (payload: { presetId: string; pointer: { x: number; y: number } }) => void
}

export function PresetSidebar({
  activeId,
  onActiveIdChange,
  onBeginDrag,
}: Props): React.ReactElement {
  const presetList = useMemo<PresetEntry[]>(() => Object.values(presetEntries) as PresetEntry[], [])
  const pushRecent = useRecentPresets((s) => s.push)
  const play = useSeslen((s) => s.play)

  const [query, setQuery] = useState("")

  /**
   * Single flat list — no Recent block, no tag-filter chips. The search
   * input alone covers id/label/description/tag matching, which keeps
   * the sidebar quiet when the user is composing and lets the list stay
   * stable under the cursor.
   */
  const filtered = useMemo<PresetEntry[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return presetList
    return presetList.filter((entry) => {
      if (entry.id.toLowerCase().includes(q)) return true
      if (entry.label.toLowerCase().includes(q)) return true
      if (entry.description.toLowerCase().includes(q)) return true
      return entry.tags.some((t) => t.toLowerCase().includes(q))
    })
  }, [presetList, query])

  function pick(entry: PresetEntry): void {
    // Only update the active id on click; the recent list is touched
    // when a preset is actually used (drag start), so simply clicking
    // around the sidebar doesn't reshuffle the list under the cursor.
    onActiveIdChange(entry.id)
  }

  function markRecent(entry: PresetEntry): void {
    pushRecent(entry.id)
  }

  function preview(entry: PresetEntry, e: React.MouseEvent): void {
    e.stopPropagation()
    markRecent(entry)
    void play(entry.id)
  }

  function startDrag(entry: PresetEntry, e: React.PointerEvent): void {
    // Prevent the browser from starting a text selection or focusing
    // ancestor controls while we wait to see if this becomes a drag.
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    let started = false
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = "none"

    function onMove(ev: PointerEvent): void {
      if (started) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (dx * dx + dy * dy > 25) {
        started = true
        onBeginDrag({ presetId: entry.id, pointer: { x: ev.clientX, y: ev.clientY } })
        pick(entry)
        markRecent(entry)
      }
    }
    function onUp(): void {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      document.body.style.userSelect = prevUserSelect
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
  }

  return (
    <aside className="flex flex-col h-full min-h-0 bg-background border-r">
      <header className="px-3 py-3 border-b">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search presets…"
            className="h-8 pl-8 text-[12px]"
          />
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {filtered.map((entry) => (
            <PresetRow
              key={entry.id}
              entry={entry}
              active={activeId === entry.id}
              onPick={() => pick(entry)}
              onPointerDown={(e) => startDrag(entry, e)}
              onPreview={(e) => preview(entry, e)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">
              No presets match.
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="px-3 py-2 border-t text-[10px] text-muted-foreground font-mono">
        {filtered.length} {filtered.length === 1 ? "preset" : "presets"} · drag onto a lane
      </footer>
    </aside>
  )
}

interface PresetRowProps {
  entry: PresetEntry
  active: boolean
  onPick: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onPreview: (e: React.MouseEvent) => void
}

function PresetRow({
  entry,
  active,
  onPick,
  onPointerDown,
  onPreview,
}: PresetRowProps): React.ReactElement {
  // Single-line row: dot + label fill the left column, the preview button
  // sits in a fixed right column (perfectly aligned across rows). Active
  // state is a thin left accent stripe + bolder text — no background
  // fills, no flashing on click.
  return (
    <div
      role="button"
      tabIndex={0}
      data-active={active ? "true" : "false"}
      className="group relative w-full pl-4 pr-2 h-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 cursor-pointer outline-none select-none"
      onClick={onPick}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPick()
        }
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground opacity-0 group-data-[active=true]:opacity-100 transition-opacity"
      />
      <span className="flex items-center gap-2 min-w-0">
        <span className={`dot shrink-0 ${accentOf(entry)}`} />
        <span className="text-[12px] font-medium truncate group-data-[active=true]:font-semibold group-data-[active=true]:text-foreground text-foreground/80">
          {entry.label}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Preview"
        className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
        onClick={onPreview}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} className="size-4" />
      </Button>
    </div>
  )
}
