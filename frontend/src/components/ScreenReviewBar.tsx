import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SCREEN_MANIFEST, type ScreenId } from '../app/screenManifest'
import { useFixtureSession, type ReviewState } from '../app/fixtureSession'
import { saveLocalStressConfig, useLocalStressConfig } from '../app/localStressData'

export default function ScreenReviewBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useFixtureSession()
  const stress = useLocalStressConfig()
  const [collapsed, setCollapsed] = useState(true)
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get('review') !== '1' || !/^\/ui\/scr-\d{2,3}$/i.test(location.pathname)) return null
  const routeId = location.pathname.match(/^\/ui\/(scr-\d{2,3})$/i)?.[1]?.toUpperCase() as ScreenId | undefined
  return <aside aria-label="Điều khiển duyệt giao diện" className="fixed bottom-16 left-1/2 z-[80] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 border border-edge bg-white px-3 py-2 text-[11px] shadow-lg sm:bottom-3">
    <div className="flex items-center gap-2"><strong className="text-brand">Duyệt UI</strong><button type="button" className="text-subtle underline" onClick={() => setCollapsed((value) => !value)}>{collapsed ? 'Mở' : 'Thu gọn'}</button></div>
    {!collapsed && <div className="mt-2 flex max-h-32 flex-wrap items-center gap-2 overflow-auto">
    <label>Vai trò <select aria-label="Vai trò duyệt" value={session.role} onChange={(event) => session.dispatch({ type: 'set-role', role: event.target.value as typeof session.role })} className="ml-1 rounded border border-field px-1.5 py-1"><option value="owner">Chủ trại</option><option value="manager">Quản lý</option><option value="technician">Kỹ thuật viên</option><option value="cs">CS</option><option value="pm">PM</option><option value="sa">SA</option></select></label>
    <label>Màn hình <select aria-label="Màn hình duyệt" value={routeId ?? session.screenId} onChange={(event) => { const id = event.target.value as ScreenId; session.dispatch({ type: 'set-screen', screenId: id }); navigate(`/ui/${id.toLowerCase()}`) }} className="ml-1 max-w-44 rounded border border-field px-1.5 py-1">{SCREEN_MANIFEST.map((screen) => <option key={screen.id} value={screen.id}>{screen.id} · {screen.viTitle}</option>)}</select></label>
    <label>Trạng thái <select aria-label="Trạng thái duyệt" value={session.reviewState} onChange={(event) => session.dispatch({ type: 'set-review-state', reviewState: event.target.value as ReviewState })} className="ml-1 rounded border border-field px-1.5 py-1"><option value="success">Có dữ liệu</option><option value="loading">Đang tải</option><option value="empty">Trống</option><option value="error">Lỗi</option><option value="read-only">Chỉ đọc</option></select></label>
    <label>Dữ liệu <select aria-label="Quy mô dữ liệu duyệt" value={stress.enabled ? 'large' : 'normal'} onChange={(event) => { saveLocalStressConfig({ ...stress, enabled: event.target.value === 'large', rowsPerTable: 100 }); window.location.reload() }} className="ml-1 rounded border border-field px-1.5 py-1"><option value="normal">Mẫu gọn</option><option value="large">100 dòng / bảng</option></select></label>
    </div>}
  </aside>
}
