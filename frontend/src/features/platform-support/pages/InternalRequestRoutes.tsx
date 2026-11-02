import { Route, Routes } from 'react-router-dom'
import InternalRequestsPage from './InternalRequestsPage'

export default function InternalRequestRoutes() {
  return (
    <Routes>
      <Route index element={<InternalRequestsPage />} />
      <Route path=":code" element={<InternalRequestsPage />} />
    </Routes>
  )
}
