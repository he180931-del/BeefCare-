import { Navigate, Route, Routes } from 'react-router-dom'
import CatalogueShell from '../components/CatalogueShell'
import BreedsPage from './BreedsPage'
import MedicinesPage from './MedicinesPage'
import ParametersPage from './ParametersPage'
import PurposesPage from './PurposesPage'
import VaccinesPage from './VaccinesPage'

/** /danh-muc/*: năm tab dùng chung một khung; lịch sử phiên bản mở thành hộp thoại trên trang tham số. */
export default function CatalogueRoutes() {
  return (
    <CatalogueShell>
      <Routes>
        <Route index element={<Navigate to="giong" replace />} />
        <Route path="giong" element={<BreedsPage />} />
        <Route path="vac-xin" element={<VaccinesPage />} />
        <Route path="thuoc" element={<MedicinesPage />} />
        <Route path="muc-dich" element={<PurposesPage />} />
        <Route path="tham-so" element={<ParametersPage />} />
        <Route path="tham-so/lich-su" element={<ParametersPage historyOpen />} />
        <Route path="*" element={<Navigate to="/danh-muc/giong" replace />} />
      </Routes>
    </CatalogueShell>
  )
}
