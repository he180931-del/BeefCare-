import { Route, Routes } from 'react-router-dom'
import TechnicianHerd from '../components/TechnicianHerd'
import TechnicianProfile from '../components/TechnicianProfile'

export default function TechnicianCattleRoutes() {
  return (
    <Routes>
      <Route index element={<TechnicianHerd />} />
      <Route path=":code" element={<TechnicianProfile />} />
    </Routes>
  )
}
