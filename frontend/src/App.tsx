import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { LoadingState } from './components/workspace'

// Mỗi trang tải lazy: lỗi ở một trang không làm hỏng các trang khác.
const Placeholder = lazy(() => import('./pages/Placeholder'))
const ScreenPreviewPage = lazy(() => import('./features/ui-preview/pages/ScreenPreviewPage'))

function CattleProfileRedirect() {
  const { code = '' } = useParams()
  return <Navigate to={`/ui/scr-27?code=${encodeURIComponent(code)}`} replace />
}

function EntryDetailRedirect() {
  const { id = '' } = useParams()
  return <Navigate to={`/ui/scr-106?id=${encodeURIComponent(id)}`} replace />
}

function ExitDetailRedirect() {
  const { id = '' } = useParams()
  return <Navigate to={`/ui/scr-110?id=${encodeURIComponent(id)}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-5xl bg-page px-5 py-8 sm:px-8"><LoadingState label="Đang mở màn hình…" rows={5} /></main>}>
      <Routes>
        <Route path="/" element={<Navigate to="/ui/scr-01" replace />} />
        <Route path="/herd-entry" element={<Navigate to="/ui/scr-33" replace />} />
        <Route path="/herd-entry/new" element={<Navigate to="/ui/scr-34" replace />} />
        <Route path="/herd-entry/:id" element={<EntryDetailRedirect />} />
        <Route path="/herd-exit" element={<Navigate to="/ui/scr-69" replace />} />
        <Route path="/herd-exit/new" element={<Navigate to="/ui/scr-70" replace />} />
        <Route path="/herd-exit/:id" element={<ExitDetailRedirect />} />
        <Route path="/pens" element={<Navigate to="/ui/scr-22" replace />} />
        <Route path="/cattle" element={<Navigate to="/ui/scr-26" replace />} />
        <Route path="/cattle/:code" element={<CattleProfileRedirect />} />
        <Route path="/ui/:screenId" element={<ScreenPreviewPage />} />
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </Suspense>
  )
}
