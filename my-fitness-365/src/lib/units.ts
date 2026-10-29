export const KG_PER_LB = 0.45359237
export const LB_PER_STONE = 14
export const CM_PER_INCH = 2.54

export function kgToStLb(kg: number): { st: number; lb: number } {
  const totalLb = kg / KG_PER_LB
  let st = Math.floor(totalLb / LB_PER_STONE)
  let lb = Math.round((totalLb - st * LB_PER_STONE) * 10) / 10
  if (lb >= LB_PER_STONE) {
    st += 1
    lb = 0
  }
  return { st, lb }
}

export function stLbToKg(st: number, lb: number): number {
  return (st * LB_PER_STONE + lb) * KG_PER_LB
}

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp

export function formatWeight(kg: number, unit: 'st' | 'kg', withSecondary = true): string {
  const kgStr = `${round(kg, 1).toFixed(1)}kg`
  if (unit === 'kg') return kgStr
  const { st, lb } = kgToStLb(kg)
  const stStr = `${st}st ${lb % 1 === 0 ? lb.toFixed(0) : lb.toFixed(1)}lb`
  return withSecondary ? `${stStr} (${kgStr})` : stStr
}

/** Signed difference, e.g. "−1.2kg (−2.6lb)". */
export function formatWeightDelta(kg: number, unit: 'st' | 'kg'): string {
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : '±'
  const abs = Math.abs(kg)
  const lb = abs / KG_PER_LB
  return unit === 'kg' ? `${sign}${abs.toFixed(1)}kg` : `${sign}${lb.toFixed(1)}lb (${sign}${abs.toFixed(1)}kg)`
}

export const cmToIn = (cm: number) => cm / CM_PER_INCH
export const inToCm = (inch: number) => inch * CM_PER_INCH

export function formatLength(cm: number, unit: 'cm' | 'in'): string {
  return unit === 'cm' ? `${round(cm, 1).toFixed(1)}cm` : `${round(cmToIn(cm), 1).toFixed(1)}in`
}

export const INCHES_PER_FOOT = 12

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const total = cm / CM_PER_INCH
  let ft = Math.floor(total / INCHES_PER_FOOT)
  let inch = Math.round((total - ft * INCHES_PER_FOOT) * 10) / 10
  if (inch >= INCHES_PER_FOOT) {
    ft += 1
    inch = 0
  }
  return { ft, inch }
}

export const ftInToCm = (ft: number, inch: number) => (ft * INCHES_PER_FOOT + inch) * CM_PER_INCH

/** "5ft 9in (175cm)" — inches rounded to the nearest whole inch for display. */
export function formatHeight(cm: number) {
  const totalIn = Math.round(cm / CM_PER_INCH)
  return `${Math.floor(totalIn / 12)}ft ${totalIn % 12}in (${Math.round(cm)}cm)`
}
