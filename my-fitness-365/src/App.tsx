import { createBrowserRouter, createMemoryRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router'
import { ConfirmProvider } from '@/components/confirm'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, useProfile, useSession } from '@/app/session'
import { Layout } from '@/app/Layout'
import { SignIn } from '@/features/auth/SignIn'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Today } from '@/features/today/Today'
import { DiaryCalendar, DiaryDay } from '@/features/diary/Diary'
import { Workouts, TemplateDetail, SessionDetail } from '@/features/workouts/Workouts'
import { ExerciseDetail } from '@/features/workouts/ExerciseDetail'
import { Player } from '@/features/workouts/Player'
import { Meals, RecipeDetail } from '@/features/meals/Meals'
import { ProgressPage, MonthlyReview } from '@/features/progress/Progress'
import { WeightPage } from '@/features/progress/Weight'
import { MeasurementsPage } from '@/features/progress/Measurements'
import { PhotosPage, NewPhoto, ComparePhotos } from '@/features/progress/Photos'
import { SettingsPage } from '@/features/settings/Settings'
import { UpdatePrompt } from '@/app/UpdatePrompt'

const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'offlineFirst', retry: 1 } } })

function Gate() {
  const { status, error } = useSession()
  const profile = useProfile()
  const loc = useLocation()
  if (error) return <p role="alert" className="pt-safe p-4 text-danger">Could not start: {error}</p>
  if (status === 'signed-out') return <SignIn />
  if (status === 'loading' || profile === undefined) return <p className="pt-safe p-4 text-muted">Loading…</p>
  if (profile && !profile.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function NotFound() {
  return <p className="pt-safe p-4">Page not found.</p>
}

export const routes = [
  {
    element: <Gate />,
    children: [
      { path: '/onboarding', element: <Onboarding /> },
      { path: '/workouts/session/:id', element: <div className="mx-auto max-w-xl px-4"><Player /></div> },
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Today /> },
          { path: '/diary', element: <DiaryCalendar /> },
          { path: '/diary/:date', element: <DiaryDay /> },
          { path: '/workouts', element: <Workouts /> },
          { path: '/workouts/template/:id', element: <TemplateDetail /> },
          { path: '/workouts/exercise/:id', element: <ExerciseDetail /> },
          { path: '/workouts/history/:id', element: <SessionDetail /> },
          { path: '/meals', element: <Meals /> },
          { path: '/meals/recipe/:id', element: <RecipeDetail /> },
          { path: '/progress', element: <ProgressPage /> },
          { path: '/progress/weight', element: <WeightPage /> },
          { path: '/progress/measurements', element: <MeasurementsPage /> },
          { path: '/progress/photos', element: <PhotosPage /> },
          { path: '/progress/photos/new', element: <NewPhoto /> },
          { path: '/progress/photos/compare', element: <ComparePhotos /> },
          { path: '/progress/review', element: <MonthlyReview /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]

// The embedded test build runs inside a frame that doesn't share URL paths, so it keeps routes in memory.
const router = import.meta.env.VITE_ROUTER === 'memory' ? createMemoryRouter(routes) : createBrowserRouter(routes)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <SessionProvider>
          <RouterProvider router={router} />
          <UpdatePrompt />
        </SessionProvider>
      </ConfirmProvider>
    </QueryClientProvider>
  )
}
