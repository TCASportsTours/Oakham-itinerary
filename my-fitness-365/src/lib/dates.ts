import { addDays, format, parseISO, startOfWeek, differenceInCalendarDays } from 'date-fns'

/** Date-only values are stored as 'YYYY-MM-DD' local calendar dates (Europe/London). */
export type ISODate = string

export const APP_TIME_ZONE = 'Europe/London'

/** Calendar date in the given time zone for an instant. Handles BST/GMT transitions. */
export function localDate(instant: Date = new Date(), timeZone = APP_TIME_ZONE): ISODate {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export const today = () => localDate()

/** Parse a date-only string as a local midnight Date for display / arithmetic. */
export const toDate = (d: ISODate) => parseISO(d)

export const shiftDate = (d: ISODate, days: number): ISODate => format(addDays(parseISO(d), days), 'yyyy-MM-dd')

export const daysBetween = (a: ISODate, b: ISODate) => differenceInCalendarDays(parseISO(b), parseISO(a))

/** 0 = Sunday … 6 = Saturday (matches JS getDay). */
export const weekday = (d: ISODate) => parseISO(d).getDay()

export const weekStart = (d: ISODate): ISODate => format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd')

export const weekDates = (d: ISODate): ISODate[] => {
  const start = weekStart(d)
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i))
}

export const formatUK = (d: ISODate) => format(parseISO(d), 'dd/MM/yyyy')
export const formatLong = (d: ISODate) => format(parseISO(d), 'EEEE d MMMM')
export const formatShort = (d: ISODate) => format(parseISO(d), 'EEE d MMM')

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const nowIso = () => new Date().toISOString()
