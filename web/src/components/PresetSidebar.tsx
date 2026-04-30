import { useMemo, useState } from "react"
import { presetEntries, presetTags, type PresetEntry } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayCircleIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
  const recent = useRecentPresets((s) => s.recent)
  const pushRecent = useRecentPresets((s) => s.push)
  const play = useSeslen((s) => s.play)

  const [query, setQuery] = useState("")
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())

  const tagCounts = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (const e of presetList) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return m
  }, [presetList])

  const filtered = useMemo<PresetEntry[]>(() => {
    const q = query.trim().toLowerCase()
    return presetList.filter((entry) => {
      if (activeTags.size > 0) {
        for (const t of activeTags) if (!entry.tags.includes(t)) return false
      }
      if (!q) return true
      if (entry.id.toLowerCase().includes(q)) return true
      if (entry.label.toLowerCase().includes(q)) return true
      if (entry.description.toLowerCase().includes(q)) return true
      if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true
      return false
    })
  }, [presetList, query, activeTags])

  const recentEntries = useMemo<PresetEntry[]>(
    () => recent.map((id) => presetEntries[id]).filter((e): e is PresetEntry => !!e),
    [recent],
  )

  const showRecents = query.trim().length === 0 && activeTags.size === 0 && recentEntries.length > 0

  function toggleTag(t: string): void {
    const next = new Set(activeTags)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    setActiveTags(next)
  }

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
      <header className="px-3 py-3 flex flex-col gap-2 border-b">
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
        <div className="flex flex-wrap gap-1">
          {presetTags.map((t) => (
            <button key={t} type="button" onClick={() => toggleTag(t)} className="cursor-pointer">
              <Badge
                variant={activeTags.has(t) ? "default" : "outline"}
                className="text-[10px] uppercase tracking-wider"
              >
                {t}
                <span className="tabular-nums opacity-70 ml-1">{tagCounts.get(t) ?? 0}</span>
              </Badge>
            </button>
          ))}
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {showRecents && (
            <>
              <h3 className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </h3>
              {recentEntries.map((entry) => (
                <PresetRow
                  key={`r-${entry.id}`}
                  entry={entry}
                  active={activeId === entry.id}
                  subtitle={entry.recipe}
                  onPick={() => pick(entry)}
                  onPointerDown={(e) => startDrag(entry, e)}
                  onPreview={(e) => preview(entry, e)}
                />
              ))}
              <Separator className="my-1" />
              <h3 className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                All presets
              </h3>
            </>
          )}

          {filtered.map((entry) => (
            <PresetRow
              key={entry.id}
              entry={entry}
              active={activeId === entry.id}
              subtitle={entry.description}
              onPick={() => pick(entry)}
              onPointerDown={(e) => startDrag(entry, e)}
              onPreview={(e) => preview(entry, e)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              No presets match.
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="px-3 py-2 border-t text-[10px] text-muted-foreground font-mono">
        Drag a preset onto a lane to add a block.
      </footer>
    </aside>
  )
}

interface PresetRowProps {
  entry: PresetEntry
  active: boolean
  subtitle: string
  onPick: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onPreview: (e: React.MouseEvent) => void
}

function PresetRow({
  entry,
  active,
  subtitle,
  onPick,
  onPointerDown,
  onPreview,
}: PresetRowProps): React.ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      data-active={active ? "true" : "false"}
      className="w-full px-3 py-2 flex items-center gap-2.5 transition data-[active=true]:bg-accent hover:bg-muted/60 cursor-pointer outline-none focus-visible:bg-muted"
      onClick={onPick}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPick()
        }
      }}
    >
      <span className={`dot shrink-0 ${accentOf(entry)}`} />
      <span className="flex flex-col items-start min-w-0 flex-1">
        <span className="text-[12px] font-semibold truncate">{entry.label}</span>
        <span className="text-[10px] text-muted-foreground truncate">{subtitle}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Preview"
        onClick={onPreview}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} />
      </Button>
    </div>
  )
}
