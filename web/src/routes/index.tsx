import { useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { presetEntries, presetTags, type PresetEntry } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  FavouriteIcon,
  Github01Icon,
  RepeatIcon,
  PlayCircleIcon,
  Search01Icon,
  StarIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { useSeslen } from "@/store/seslen"
import { accentOf, motionOf } from "@/lib/preset-meta"

export const Route = createFileRoute("/")({
  component: IndexPage,
})

function IndexPage(): React.ReactElement {
  const navigate = useNavigate()
  const state = useSeslen((s) => s.state)
  const isLooping = useSeslen((s) => s.isLooping)
  // Subscribe so the row re-renders when a loop start/stop bumps the version.
  useSeslen((s) => s.loopVersion)
  const play = useSeslen((s) => s.play)
  const startLoop = useSeslen((s) => s.startLoop)

  const [query, setQuery] = useState("")
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())

  const total = Object.keys(presetEntries).length

  const tagCounts = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (const e of Object.values(presetEntries)) {
      for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [])

  /* Apply tag filter at the data layer; the DataTable's globalFilter handles
   * the search box. */
  const data = useMemo<PresetEntry[]>(() => {
    if (activeTags.size === 0) return Object.values(presetEntries)
    return Object.values(presetEntries).filter((entry) => {
      for (const t of activeTags) if (!entry.tags.includes(t)) return false
      return true
    })
  }, [activeTags])

  function toggleTag(t: string): void {
    const next = new Set(activeTags)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    setActiveTags(next)
  }

  function clearTags(): void {
    setActiveTags(new Set())
  }

  function rowClick(entry: PresetEntry): void {
    void navigate({ to: "/compose", search: { seed: entry.id } })
  }

  async function onPlayClick(
    entry: PresetEntry,
    e: React.MouseEvent,
    host: HTMLElement,
  ): Promise<void> {
    e.stopPropagation()
    triggerMotion(host, motionOf(entry))
    emitWave(host)
    await play(entry.id)
  }

  async function onLoopClick(entry: PresetEntry, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await startLoop(entry.id)
  }

  async function onCopyClick(
    entry: PresetEntry,
    e: React.MouseEvent,
    btn: HTMLButtonElement,
  ): Promise<void> {
    e.stopPropagation()
    const snippet = [
      `import { createSeslen } from "seslen"`,
      `import { presets } from "seslen/presets"`,
      ``,
      `const ses = createSeslen({ sources: presets })`,
      `await ses.play("${entry.id}")`,
    ].join("\n")
    try {
      await navigator.clipboard.writeText(snippet)
      btn.dataset.copied = "true"
      const t = setTimeout(() => {
        btn.dataset.copied = "false"
      }, 1100)
      void t
    } catch {
      // ignore
    }
  }

  const columns = useMemo<ColumnDef<PresetEntry, unknown>[]>(
    () => [
      {
        accessorKey: "label",
        header: ({ column }) => (
          <SortHeader
            label="Preset"
            sort={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const entry = row.original
          return (
            <div className={`flex items-center gap-2.5 ${accentOf(entry)}`}>
              <span className="dot" />
              <span className="font-semibold text-[14px] tracking-tight">{entry.label}</span>
              <code className="font-mono text-[11px] text-muted-foreground">"{entry.id}"</code>
            </div>
          )
        },
        meta: { className: "min-w-[180px]" },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground">{row.original.description}</span>
        ),
        meta: { className: "hidden md:table-cell max-w-[28rem] whitespace-normal" },
      },
      {
        id: "tags",
        header: "Tags",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {row.original.tags.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="text-[10px] uppercase tracking-wider cursor-pointer hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTag(t)
                }}
              >
                {t}
              </Badge>
            ))}
          </div>
        ),
        enableSorting: false,
        meta: { className: "hidden lg:table-cell whitespace-normal" },
      },
      {
        accessorKey: "recipe",
        header: "Recipe",
        cell: ({ row }) => (
          <code className="font-mono text-[11px] text-muted-foreground">{row.original.recipe}</code>
        ),
        meta: { className: "hidden xl:table-cell" },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => {
          const entry = row.original
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant={isLooping(entry.id) ? "default" : "outline"}
                size="xs"
                onClick={(e) => onLoopClick(entry, e)}
              >
                <HugeiconsIcon icon={RepeatIcon} strokeWidth={2} />
                {isLooping(entry.id) ? "Stop" : "Loop"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                data-copied="false"
                onClick={(e) => onCopyClick(entry, e, e.currentTarget)}
              >
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                Copy
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon-sm"
                title="Play"
                className={`relative isolate ${accentOf(entry)}`}
                onClick={(e) => onPlayClick(entry, e, e.currentTarget)}
              >
                <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} />
              </Button>
            </div>
          )
        },
      },
    ],
    // toggleTag / isLooping update via state — capture them via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTags, isLooping],
  )

  /* Match the search field against label, id, description, and tags. */
  const globalFilterFn = (entry: PresetEntry, value: string): boolean => {
    const q = value.trim().toLowerCase()
    if (!q) return true
    if (entry.id.toLowerCase().includes(q)) return true
    if (entry.label.toLowerCase().includes(q)) return true
    if (entry.description.toLowerCase().includes(q)) return true
    return entry.tags.some((t) => t.toLowerCase().includes(q))
  }

  /* The DataTable computes its own filtered rows, but we want the count
   * shown above. Mirror the filter here. */
  const visibleCount = useMemo(
    () => data.filter((e) => globalFilterFn(e, query)).length,
    [data, query],
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10 flex flex-col gap-6">
      <a
        href="https://github.com/productdevbook/seslen"
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-3 rounded-lg border border-border bg-muted/40 hover:bg-muted px-4 py-2.5 text-[12px] transition"
      >
        <HugeiconsIcon icon={Github01Icon} strokeWidth={2} className="size-4 shrink-0" />
        <span className="flex-1 leading-snug">
          <strong className="font-semibold">Got a sound in your head?</strong>{" "}
          <span className="text-muted-foreground">
            Contribute a preset on GitHub — it's a single self-contained file under{" "}
            <code className="font-mono text-[11px]">src/presets/</code>.
          </span>
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition">
          Open repo
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
        </span>
      </a>

      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            seslen / playground
          </span>
          <h1 className="font-sans text-4xl sm:text-5xl font-black tracking-tight leading-none">
            seslen
          </h1>
          <p className="max-w-xl text-muted-foreground text-[14px] leading-relaxed">
            Synthesised UI sounds for the web. Click a row to open it in the composer with one
            starter block; click ▶ to preview without leaving this page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/compose"
            className="inline-flex h-9 gap-1.5 px-2.5 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition"
          >
            Open composer
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
          </Link>
          <Badge variant="secondary" className="font-mono text-[11px]">
            state: {state}
          </Badge>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search presets, tags, descriptions…"
              className="pl-9"
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
            {visibleCount === total ? `${total} presets` : `${visibleCount} / ${total}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
          {activeTags.size > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={clearTags}>
              Clear
            </Button>
          )}
        </div>
      </section>

      <DataTable<PresetEntry>
        columns={columns}
        data={data}
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        globalFilterFn={globalFilterFn}
        onRowClick={rowClick}
        emptyState={`No presets match "${query}".`}
      />

      <footer className="pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground border-t mt-2">
        <span>
          MIT ©{" "}
          <a
            href="https://github.com/productdevbook"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition"
          >
            productdevbook
          </a>
        </span>
        <nav className="flex items-center gap-3 flex-wrap justify-center">
          <a
            href="https://github.com/productdevbook/seslen"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition"
          >
            <HugeiconsIcon icon={Github01Icon} strokeWidth={2} className="size-3.5" />
            Repository
          </a>
          <a
            href="https://github.com/productdevbook/seslen/tree/main/src/presets"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition"
          >
            <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-3.5" />
            Contribute a preset
          </a>
          <a
            href="https://www.npmjs.com/package/seslen"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition"
          >
            npm
          </a>
          <a
            href="https://github.com/productdevbook/seslen/issues"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition"
          >
            Issues
          </a>
          <a
            href="https://github.com/sponsors/productdevbook"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition"
          >
            <HugeiconsIcon icon={FavouriteIcon} strokeWidth={2} className="size-3.5" />
            Sponsor
          </a>
        </nav>
      </footer>
    </main>
  )
}

interface SortHeaderProps {
  label: string
  sort: false | "asc" | "desc"
  onClick: () => void
}

function SortHeader({ label, sort, onClick }: SortHeaderProps): React.ReactElement {
  const icon = sort === "asc" ? ArrowUp01Icon : sort === "desc" ? ArrowDown01Icon : UnfoldMoreIcon
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 -mx-2 px-2 py-1 rounded hover:bg-muted transition cursor-pointer"
    >
      {label}
      <HugeiconsIcon icon={icon} strokeWidth={2} className={`size-3 ${sort ? "" : "opacity-40"}`} />
    </button>
  )
}

function emitWave(host: HTMLElement): void {
  const wave = document.createElement("span")
  wave.className = "wave"
  host.append(wave)
  wave.addEventListener("animationend", () => wave.remove(), { once: true })
}

function triggerMotion(host: HTMLElement, className: string | null): void {
  if (!className) return
  host.classList.remove(className)
  void host.offsetWidth
  host.classList.add(className)
  host.addEventListener("animationend", () => host.classList.remove(className), { once: true })
}
