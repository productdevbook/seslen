import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSeslen } from "@/store/seslen"

export function PlaybackOptions(): React.ReactElement {
  const callOpts = useSeslen((s) => s.callOpts)
  const setCallOpt = useSeslen((s) => s.setCallOpt)
  const masterVolume = useSeslen((s) => s.masterVolume)
  const setMasterVolume = useSeslen((s) => s.setMasterVolume)
  const stopAll = useSeslen((s) => s.stopAll)

  const gain = callOpts.gain ?? 1
  const rate = callOpts.rate ?? 1
  const detune = callOpts.detune ?? 0

  return (
    <div className="flex flex-col gap-4">
      <ParamSlider
        label="gain"
        valueLabel={gain.toFixed(2)}
        value={gain}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setCallOpt("gain", v)}
      />
      <ParamSlider
        label="rate"
        valueLabel={`${rate.toFixed(2)}×`}
        value={rate}
        min={0.25}
        max={2}
        step={0.01}
        onChange={(v) => setCallOpt("rate", v)}
      />
      <ParamSlider
        label="detune"
        valueLabel={`${detune >= 0 ? "+" : ""}${detune}`}
        value={detune}
        min={-1200}
        max={1200}
        step={1}
        onChange={(v) => setCallOpt("detune", v)}
      />
      <ParamSlider
        label="master volume"
        valueLabel={masterVolume.toFixed(2)}
        value={masterVolume}
        min={0}
        max={1}
        step={0.01}
        onChange={setMasterVolume}
      />
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="default" size="sm" onClick={stopAll}>
          Stop all
        </Button>
      </div>
    </div>
  )
}

interface ParamSliderProps {
  label: string
  valueLabel: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function ParamSlider({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  onChange,
}: ParamSliderProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5 select-none">
      <Label className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-[11px] tabular-nums">{valueLabel}</span>
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
      />
    </div>
  )
}
