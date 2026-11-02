import { Navigate, Route, Routes } from 'react-router-dom'
import HealthCaseList from './HealthCaseList'

export default function HealthRoutes() {
  return (
    <Routes>
      <Route index element={<HealthCaseList />} />
      <Route path="*" element={<Navigate to="/suc-khoe" replace />} />
    </Routes>
  )
}
