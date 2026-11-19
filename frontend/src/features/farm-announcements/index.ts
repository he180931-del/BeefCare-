export const loadAnnouncementRoutes = () => import('./pages/AnnouncementRoutes')
export const loadTechnicianAnnouncementRoutes = () => import('./pages/TechnicianAnnouncementRoutes')
// Các feature khác (trang chủ Kỹ thuật viên) đọc thông báo chưa đọc qua API này.
export { announcementsApi } from './api/announcementsApi'
export type { AnnouncementSummary } from './types'
