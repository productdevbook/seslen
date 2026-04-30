import { useMemo, useState } from "react"
import type { PatternStep } from "seslen"
import { ComarkClient } from "@comark/react"
import highlight from "@comark/react/plugins/highlight"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Copy01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

/**
 * Stable plugin reference: ComarkClient re-runs the parse when its
 * `plugins` prop identity changes, so we instantiate `highlight()` once
 * at module scope instead of on every Snippet render.
 */
const PLUGINS = [highlight()]

interface Props {
  steps: PatternStep[]
}

/**
 * The pattern fed to `ses.playPattern` plus the boilerplate that goes
 * with it. Rendered as a syntax-highlighted Markdown code fence via
 * `@comark/react` (Shiki under the hood); a single Copy button captures
 * just the code, not the markdown wrapper.
 */
export function Snippet({ steps }: Props): React.ReactElement {
  const code = useMemo<string>(() => {
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

  const markdown = useMemo<string>(() => "```ts\n" + code + "\n```\n", [code])

  const [copied, setCopied] = useState(false)
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1100)
    } catch {
      // ignore
    }
  }

  return (
    <div className="snippet relative rounded-xl bg-muted/40 ring-1 ring-border overflow-hidden">
      {/* ComarkClient is the pure-client wrapper: it parses + highlights
       *  inside its own Suspense boundary, so a vanilla React 19 app
       *  doesn't need to render <Comark> directly (which is async). */}
      <ComarkClient markdown={markdown} plugins={PLUGINS} />
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
