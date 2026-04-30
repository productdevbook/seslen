import { useMemo } from "react"
import { presetEntries, type PresetEntry } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, PlayCircleIcon } from "@hugeicons/core-free-icons"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import { accentOf } from "@/lib/preset-meta"
import { useRecentPresets } from "@/store/recent-presets"
import { useSeslen } from "@/store/seslen"

interface Props {
  modelValue: string
  audible?: boolean
  onPick?: (id: string) => void
}

export function PresetCombobox({ modelValue, audible = true, onPick }: Props): React.ReactElement {
  const presetList = useMemo<PresetEntry[]>(() => Object.values(presetEntries) as PresetEntry[], [])
  const recent = useRecentPresets((s) => s.recent)
  const pushRecent = useRecentPresets((s) => s.push)
  const play = useSeslen((s) => s.play)

  const recentEntries = useMemo<PresetEntry[]>(
    () => recent.map((id) => presetEntries[id]).filter((e): e is PresetEntry => !!e),
    [recent],
  )

  const items = useMemo<PresetEntry[]>(() => {
    const seen = new Set<string>()
    const out: PresetEntry[] = []
    for (const e of recentEntries) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(e)
    }
    for (const e of presetList) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(e)
    }
    return out
  }, [recentEntries, presetList])

  const activeEntry = presetEntries[modelValue]

  function preview(entry: PresetEntry, e: React.MouseEvent | React.PointerEvent): void {
    e.stopPropagation()
    e.preventDefault()
    void play(entry.id)
  }

  function handleValueChange(entry: PresetEntry | null): void {
    if (!entry) return
    pushRecent(entry.id)
    onPick?.(entry.id)
    if (audible) void play(entry.id)
  }

  return (
    <Combobox<PresetEntry>
      items={items}
      value={activeEntry ?? null}
      onValueChange={handleValueChange}
      itemToStringLabel={(e) => e.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
    >
      <ComboboxTrigger
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        render={
          <button type="button">
            {activeEntry ? (
              <>
                <span className={`dot shrink-0 ${accentOf(activeEntry)}`} />
                <ComboboxValue>{(v: PresetEntry | null) => v?.label ?? ""}</ComboboxValue>
                <code className="font-mono text-[10px] text-muted-foreground truncate hidden sm:inline">
                  "{activeEntry.id}"
                </code>
              </>
            ) : (
              <span className="text-muted-foreground">Pick a preset</span>
            )}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="ml-auto size-4 text-muted-foreground"
            />
          </button>
        }
      />

      <ComboboxContent>
        <ComboboxInput placeholder="Search presets…" />
        <ComboboxEmpty>No presets match.</ComboboxEmpty>
        <ComboboxList>
          {(entry: PresetEntry) => (
            <ComboboxItem key={entry.id} value={entry} className="pe-12">
              <span className={`dot shrink-0 ${accentOf(entry)}`} />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-semibold truncate">{entry.label}</span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {entry.description}
                </span>
              </span>
              <Button
                type="button"
                tabIndex={-1}
                size="icon-xs"
                variant="ghost"
                className="absolute end-2 top-1/2 -translate-y-1/2"
                title="Preview"
                onPointerDown={(e) => preview(entry, e)}
              >
                <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} />
              </Button>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
