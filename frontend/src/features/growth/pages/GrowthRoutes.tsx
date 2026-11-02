import { Navigate, Route, Routes } from 'react-router-dom'
import GrowthHerdPage from './GrowthHerdPage'

export default function GrowthRoutes() {
  return (
    <Routes>
      <Route index element={<GrowthHerdPage />} />
      <Route path="*" element={<Navigate to="/can-nang" replace />} />
    </Routes>
  )
}
