import { Route, Routes } from 'react-router-dom'
import StaffPage from './StaffPage'

// `/nen-tang/quyen` và `/nen-tang/quyen/:id?m=access` dùng cùng một trang.
export default function StaffAccessRoutes() {
  return (
    <Routes>
      <Route path="*" element={<StaffPage />} />
    </Routes>
  )
}
