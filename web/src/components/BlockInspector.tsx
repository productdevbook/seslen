import { presetEntries } from "seslen/presets"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Delete02Icon, ReloadIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useBuilder, type Block, type Lane } from "@/store/builder"
import { accentOf } from "@/lib/preset-meta"
import { PresetCombobox } from "@/components/PresetCombobox"

interface Props {
  lane: Lane
  block: Block
}

export function BlockInspector({ lane, block }: Props): React.ReactElement {
  const builder = useBuilder.getState()
  const presetEntry = presetEntries[block.presetId]
  const endMs = block.position + block.duration

  const rate = block.rate ?? 1
  const detune = block.detune ?? 0
  const rateActive = Math.abs(rate - 1) > 1e-6
  const detuneActive = detune !== 0

  function commit(): void {
    builder.commit()
  }
  function changePreset(presetId: string): void {
    if (presetId === block.presetId) return
    builder.setBlockPreset(lane.id, block.id, presetId)
    builder.commit()
  }
  function duplicate(): void {
    builder.duplicateBlock(lane.id, block.id)
    builder.commit()
  }
  function remove(): void {
    builder.removeBlock(lane.id, block.id)
    builder.commit()
  }
  function resetRate(): void {
    builder.setRate(lane.id, block.id, 1)
    builder.commit()
  }
  function resetDetune(): void {
    builder.setDetune(lane.id, block.id, 0)
    builder.commit()
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <span className={`dot ${presetEntry ? accentOf(presetEntry) : "accent-blue"}`} />
        <h2 className="font-semibold tracking-tight truncate">
          {presetEntry?.label ?? block.presetId}
        </h2>
        <code className="font-mono text-[11px] text-muted-foreground ml-auto">
          {block.position}–{endMs}ms
        </code>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            at (ms)
          </Label>
          <Input
            value={block.position}
            type="number"
            min={0}
            step={1}
            className="h-8 tabular-nums"
            onChange={(e) =>
              builder.movePosition(lane.id, block.id, Math.round(Number(e.target.value)))
            }
            onBlur={commit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            duration (ms)
          </Label>
          <Input
            value={block.duration}
            type="number"
            min={20}
            step={1}
            className="h-8 tabular-nums"
            onChange={(e) =>
              builder.resizeRight(
                lane.id,
                block.id,
                block.position + Math.round(Number(e.target.value)),
              )
            }
            onBlur={commit}
          />
        </div>

        <ThumbSlider
          className="col-span-2"
          label="intensity (gain)"
          valueLabel={block.intensity.toFixed(2)}
          value={block.intensity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => builder.setIntensity(lane.id, block.id, v)}
          onCommit={commit}
        />

        <ThumbSlider
          className="col-span-2"
          label="rate"
          valueLabel={`${rate.toFixed(2)}×`}
          value={rate}
          min={0.25}
          max={2}
          step={0.01}
          onChange={(v) => builder.setRate(lane.id, block.id, v)}
          onCommit={commit}
          extra={
            rateActive ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-5 px-1.5 text-[10px]"
                onClick={resetRate}
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-3" />
                reset
              </Button>
            ) : null
          }
        />

        <ThumbSlider
          className="col-span-2"
          label="detune"
          valueLabel={`${detune >= 0 ? "+" : ""}${detune}c`}
          value={detune}
          min={-1200}
          max={1200}
          step={1}
          onChange={(v) => builder.setDetune(lane.id, block.id, v)}
          onCommit={commit}
          extra={
            detuneActive ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-5 px-1.5 text-[10px]"
                onClick={resetDetune}
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-3" />
                reset
              </Button>
            ) : null
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Preset
        </Label>
        <PresetCombobox modelValue={block.presetId} audible={false} onPick={changePreset} />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={duplicate}>
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
          Duplicate
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={remove}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          Delete
        </Button>
      </div>
    </section>
  )
}

interface ThumbSliderProps {
  className?: string
  label: string
  valueLabel: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  onCommit: () => void
  extra?: React.ReactNode
}

function ThumbSlider({
  className,
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  extra,
}: ThumbSliderProps): React.ReactElement {
  return (
    <div className={`flex flex-col gap-1.5 select-none ${className ?? ""}`}>
      <Label className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {extra}
        </span>
        <span className="font-mono tabular-nums">{valueLabel}</span>
      </Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v
          if (typeof next === "number") onChange(next)
        }}
        onValueCommitted={onCommit}
      />
    </div>
  )
}
