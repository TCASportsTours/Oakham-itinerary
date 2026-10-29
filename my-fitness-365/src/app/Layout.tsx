import { NavLink, Outlet } from 'react-router'
import { CalendarDays, Dumbbell, Home, LineChart, Utensils, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useSession } from './session'
import { useStravaAutoImport } from '@/features/strava/Strava'

const tabs = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/diary', label: 'Diary', icon: CalendarDays },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/meals', label: 'Meals', icon: Utensils },
  { to: '/progress', label: 'Progress', icon: LineChart },
]

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function Layout() {
  useStravaAutoImport()
  const online = useOnline()
  const { mode } = useSession()
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      {!online && (
        <div role="status" className="pt-safe flex items-center justify-center gap-2 bg-warn/15 px-4 pb-2 text-sm font-semibold text-warn">
          <WifiOff className="h-4 w-4" aria-hidden /> Offline — changes are saved on this device{mode === 'cloud' ? ' and will sync later' : ''}.
        </div>
      )}
      {import.meta.env.VITE_EMBED && (
        <p role="note" className="pt-safe bg-data/20 px-4 pb-2 text-center text-xs text-[#d4d4f5]">
          Test version — data stays in this browser. Downloads, the camera and Add to Home Screen only work in the installed app.
        </p>
      )}
      <main className="flex-1 px-4 pb-28">
        <Outlet />
      </main>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex min-h-14 flex-col items-center justify-center gap-0.5 pt-1.5 text-[0.7rem] font-semibold', isActive ? 'text-accent' : 'text-faint hover:text-ink')
                }
              >
                <Icon className="h-6 w-6" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
