import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { loadImportDetailPage, loadImportListPage, loadImportNewPage } from './features/herd-entry'
import { loadExportDetailPage, loadExportListPage, loadExportNewPage } from './features/herd-exit'
import { loadCowListPage, loadCowProfilePage } from './features/cattle'
import { loadPenListPage } from './features/pen-management'

// Mỗi trang tải lazy: lỗi ở một trang không làm hỏng các trang khác.
const ImportList = lazy(loadImportListPage)
const ImportNew = lazy(loadImportNewPage)
const ImportDetail = lazy(loadImportDetailPage)
const ExportList = lazy(loadExportListPage)
const ExportNew = lazy(loadExportNewPage)
const ExportDetail = lazy(loadExportDetailPage)
const BarnList = lazy(loadPenListPage)
const CowList = lazy(loadCowListPage)
const CowProfile = lazy(loadCowProfilePage)
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
