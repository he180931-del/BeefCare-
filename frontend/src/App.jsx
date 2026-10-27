import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// Mỗi trang tải lazy: lỗi ở một trang không làm hỏng các trang khác.
const ImportList = lazy(() => import('./pages/ImportList'))
const ImportNew = lazy(() => import('./pages/ImportNew'))
const ImportDetail = lazy(() => import('./pages/ImportDetail'))
const ExportList = lazy(() => import('./pages/ExportList'))
const ExportNew = lazy(() => import('./pages/ExportNew'))
const ExportDetail = lazy(() => import('./pages/ExportDetail'))
const BarnList = lazy(() => import('./pages/BarnList'))
const CowList = lazy(() => import('./pages/CowList'))
const CowProfile = lazy(() => import('./pages/CowProfile'))
const Placeholder = lazy(() => import('./pages/Placeholder'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/herd-entry" replace />} />
        <Route path="/herd-entry" element={<ImportList />} />
        <Route path="/herd-entry/new" element={<ImportNew />} />
        <Route path="/herd-entry/:id" element={<ImportDetail />} />
        <Route path="/herd-exit" element={<ExportList />} />
        <Route path="/herd-exit/new" element={<ExportNew />} />
        <Route path="/herd-exit/:id" element={<ExportDetail />} />
        <Route path="/pens" element={<BarnList />} />
        <Route path="/cattle" element={<CowList />} />
        <Route path="/cattle/:code" element={<CowProfile />} />
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </Suspense>
  )
}
