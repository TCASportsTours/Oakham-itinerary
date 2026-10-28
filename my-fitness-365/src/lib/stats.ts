export interface DatedValue {
  date: string
  value: number
}

/** Sort ascending by date; for duplicate dates keep the mean. */
export function byDate(values: DatedValue[]): DatedValue[] {
  const map = new Map<string, number[]>()
  for (const v of values) map.set(v.date, [...(map.get(v.date) ?? []), v.value])
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vs]) => ({ date, value: vs.reduce((s, x) => s + x, 0) / vs.length }))
}

/**
 * Trailing 7-calendar-day rolling average: for each entry, the mean of entries
 * whose dates fall in (date − 6 … date). Gaps are not filled with invented values.
 */
export function rollingAverage(values: DatedValue[], windowDays = 7): DatedValue[] {
  const sorted = byDate(values)
  const t = (d: string) => Date.parse(d + 'T00:00:00Z') / 86_400_000
  return sorted.map((v) => {
    const end = t(v.date)
    const win = sorted.filter((w) => t(w.date) <= end && t(w.date) > end - windowDays)
    return { date: v.date, value: win.reduce((s, w) => s + w.value, 0) / win.length }
  })
}

/** Value on or before a date (latest not after). */
export function valueAtOrBefore(values: DatedValue[], date: string): DatedValue | undefined {
  return byDate(values)
    .filter((v) => v.date <= date)
    .at(-1)
}

export function change(baseline: number, latest: number) {
  const abs = latest - baseline
  return { abs, pct: baseline === 0 ? 0 : (abs / baseline) * 100 }
}
