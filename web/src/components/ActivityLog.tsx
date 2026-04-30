import { useSeslen } from "@/store/seslen"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ActivityLog(): React.ReactElement {
  const log = useSeslen((s) => s.log)
  const text = log
    .map(
      (e) => `[${e.ts}] ${e.line}${e.payload === undefined ? "" : ` ${JSON.stringify(e.payload)}`}`,
    )
    .join("\n")
  return (
    <ScrollArea className="h-32 rounded-xl bg-foreground text-background/90">
      <pre className="font-mono text-[11px] leading-relaxed p-3">{text || "No activity yet."}</pre>
    </ScrollArea>
  )
}
