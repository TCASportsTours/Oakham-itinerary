import { lazy, Suspense, type ComponentProps } from 'react'

// Recharts is large; load it only when a chart is actually on screen.
const charts = () => import('./charts')
const LazyTrend = lazy(() => charts().then((m) => ({ default: m.TrendChart })))
const LazyWeight = lazy(() => charts().then((m) => ({ default: m.WeightChart })))
const LazyPair = lazy(() => charts().then((m) => ({ default: m.PairChart })))
const LazyStrength = lazy(() => charts().then((m) => ({ default: m.StrengthChart })))

type Charts = typeof import('./charts')
const fallback = <div className="h-40 animate-pulse rounded-xl bg-surface-2/50" aria-label="Loading chart" />

export const TrendChart = (p: ComponentProps<Charts['TrendChart']>) => <Suspense fallback={fallback}><LazyTrend {...p} /></Suspense>
export const WeightChart = (p: ComponentProps<Charts['WeightChart']>) => <Suspense fallback={fallback}><LazyWeight {...p} /></Suspense>
export const PairChart = (p: ComponentProps<Charts['PairChart']>) => <Suspense fallback={fallback}><LazyPair {...p} /></Suspense>
export const StrengthChart = (p: ComponentProps<Charts['StrengthChart']>) => <Suspense fallback={fallback}><LazyStrength {...p} /></Suspense>
