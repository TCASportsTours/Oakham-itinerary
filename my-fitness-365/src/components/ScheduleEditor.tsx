import { useLiveQuery } from 'dexie-react-hooks'
import { list } from '@/data/repo'
import { WEEKDAY_NAMES } from '@/lib/dates'
import { cn } from '@/lib/cn'

const ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Toggle activity templates on/off for each weekday of the default week. */
export function ScheduleEditor({ value, onChange }: { value: Record<string, string[]>; onChange: (v: Record<string, string[]>) => void }) {
  const templates = useLiveQuery(() => list('activity_templates'), []) ?? []
  const toggle = (day: number, key: string) => {
    const cur = value[String(day)] ?? []
    onChange({ ...value, [String(day)]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] })
  }
  return (
    <div className="space-y-4">
      {ORDER.map((d) => (
        <fieldset key={d}>
          <legend className="mb-1.5 font-semibold">{WEEKDAY_NAMES[d]}</legend>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => {
              const on = (value[String(d)] ?? []).includes(t.key)
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d, t.key)}
                  className={cn('min-h-9 rounded-full border px-3 text-sm font-semibold', on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted')}
                >
                  {t.name.replace('Mountain bike — ', 'MTB ').replace(/Workout ([ABC]) — .*/, 'Workout $1')}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
