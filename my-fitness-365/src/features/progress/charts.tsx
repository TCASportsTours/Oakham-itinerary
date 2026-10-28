import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'

const AXIS = { stroke: '#8a8a83', fontSize: 12, fontFamily: 'Josefin Sans' }
const GRID = '#2b2b29'
export const SERIES = { primary: '#51cea7', a: '#2fa883', b: '#7777c9' }

const tick = (d: string) => format(parseISO(d), 'd MMM')

function TooltipBox({ active, payload, label, unit, digits = 1 }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit: string; digits?: number }) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{format(parseISO(label), 'EEE d MMM yyyy')}</p>
      {payload.map((p) => (
        <p key={p.name} className="tnum text-muted">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="text-ink">{p.value.toFixed(digits)}{unit}</span>
        </p>
      ))}
    </div>
  )
}

/** Single-series trend. Rendered only with ≥2 real points; caller handles empty states. */
export function TrendChart({ data, unit, name, target, height = 200 }: { data: { date: string; value: number }[]; unit: string; name: string; target?: number; height?: number }) {
  const values = data.map((d) => d.value).concat(target ?? [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(0.5, (max - min) * 0.15)
  return (
    <figure aria-label={`${name} chart`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={tick} {...AXIS} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} {...AXIS} tickLine={false} axisLine={false} width={44} />
          {target !== undefined && <ReferenceLine y={target} stroke="#ff7c1a" strokeDasharray="4 4" label={{ value: 'Target', fill: '#ff7c1a', fontSize: 12, position: 'insideTopRight' }} />}
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: '#8a8a83', strokeWidth: 1 }} />
          <Line type="monotone" dataKey="value" name={name} stroke={SERIES.primary} strokeWidth={2} dot={{ r: 4, fill: SERIES.primary, stroke: '#212120', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

/** Raw weigh-ins as dots plus the 7-day rolling average line. */
export function WeightChart({ raw, avg, target, unit }: { raw: { date: string; value: number }[]; avg: { date: string; value: number }[]; target?: number; unit: string }) {
  const merged = raw.map((r) => ({ date: r.date, raw: r.value, avg: avg.find((a) => a.date === r.date)?.value }))
  const values = raw.map((r) => r.value).concat(target ?? [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(0.5, (max - min) * 0.15)
  return (
    <figure aria-label="Weight chart">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={tick} {...AXIS} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} {...AXIS} tickLine={false} axisLine={false} width={44} />
          {target !== undefined && <ReferenceLine y={target} stroke="#ff7c1a" strokeDasharray="4 4" />}
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: '#8a8a83', strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontFamily: 'Josefin Sans', fontSize: 12, color: '#b4b4ac' }} />
          <Line dataKey="raw" name="Weigh-in" stroke="transparent" dot={{ r: 4, fill: SERIES.b, stroke: '#212120', strokeWidth: 2 }} activeDot={{ r: 6, fill: SERIES.b }} isAnimationActive={false} legendType="circle" />
          <Line type="monotone" dataKey="avg" name="7-day average" stroke={SERIES.a} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function PairChart({ data, unit, aName, bName }: { data: { date: string; a?: number; b?: number }[]; unit: string; aName: string; bName: string }) {
  const values = data.flatMap((d) => [d.a, d.b]).filter((v): v is number => v !== undefined)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(0.5, (max - min) * 0.15)
  return (
    <figure aria-label={`${aName} and ${bName} chart`}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={tick} {...AXIS} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} {...AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<TooltipBox unit={unit} />} />
          <Legend wrapperStyle={{ fontFamily: 'Josefin Sans', fontSize: 12, color: '#b4b4ac' }} />
          <Line type="monotone" dataKey="a" name={aName} stroke={SERIES.a} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="b" name={bName} stroke={SERIES.b} strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 3" isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function StrengthChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) return <p className="text-sm text-muted">The chart appears after two completed sessions.</p>
  return <TrendChart data={data} unit="kg" name="Heaviest set" height={160} />
}
