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
        <Route path="/" element={<Navigate to="/nhap" replace />} />
        <Route path="/nhap" element={<ImportList />} />
        <Route path="/nhap/moi" element={<ImportNew />} />
        <Route path="/nhap/:id" element={<ImportDetail />} />
        <Route path="/xuat" element={<ExportList />} />
        <Route path="/xuat/moi" element={<ExportNew />} />
        <Route path="/xuat/:id" element={<ExportDetail />} />
        <Route path="/chuong-trai" element={<BarnList />} />
        <Route path="/dan-bo" element={<CowList />} />
        <Route path="/dan-bo/:code" element={<CowProfile />} />
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </Suspense>
  )
}
