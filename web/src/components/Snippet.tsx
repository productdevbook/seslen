import { useMemo, useState } from "react"
import type { PatternStep } from "seslen"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Copy01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface Props {
  steps: PatternStep[]
}

export function Snippet({ steps }: Props): React.ReactElement {
  const text = useMemo<string>(() => {
    if (steps.length === 0) {
      return [
        `import { createSeslen } from "seslen"`,
        `import { presets } from "seslen/presets"`,
        ``,
        `const ses = createSeslen({ sources: presets })`,
        `// Add a block on the timeline to see the call here.`,
      ].join("\n")
    }
    const lines = steps.map((step) => {
      const parts: string[] = []
      if (step.at !== undefined && step.at > 0) parts.push(`at: ${step.at}`)
      parts.push(`id: "${step.id}"`)
      if (step.options) {
        const o: string[] = []
        if (step.options.gain !== undefined) o.push(`gain: ${step.options.gain}`)
        if (step.options.rate !== undefined) o.push(`rate: ${step.options.rate}`)
        if (step.options.detune !== undefined) o.push(`detune: ${step.options.detune}`)
        parts.push(`options: { ${o.join(", ")} }`)
      }
      return `  { ${parts.join(", ")} },`
    })
    return [
      `import { createSeslen } from "seslen"`,
      `import { presets } from "seslen/presets"`,
      ``,
      `const ses = createSeslen({ sources: presets })`,
      `await ses.playPattern([`,
      ...lines,
      `])`,
    ].join("\n")
  }, [steps])

  const [copied, setCopied] = useState(false)
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1100)
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative rounded-xl bg-muted/40 ring-1 ring-border">
      <ScrollArea className="max-h-72">
        <pre className="code text-foreground p-4 pr-14">{text}</pre>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Button
        type="button"
        variant={copied ? "default" : "outline"}
        size="xs"
        className="absolute top-2 right-2"
        onClick={copy}
      >
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={2} />
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}
