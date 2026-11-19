import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { announcementsDemoStore, type AnnouncementsDemoStore } from '../data/announcementsDemoStore'
import type { CorrectionCommand, DraftCommand, Viewer } from '../types'

export function createAnnouncementsApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: AnnouncementsDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('thông báo trại') }
  return {
    // GET /api/farms/{farmId}/announcements
    async list(viewer: Viewer) { requireLocal(); return store.list(viewer) },
    // GET /api/farms/{farmId}/announcements (lọc chưa đọc ở phía client)
    async listUnread(viewer: Viewer, limit = 3) {
      requireLocal()
      return (await store.list(viewer)).filter((a) => a.isReceived && a.unread).slice(0, limit)
    },
    // chưa có API (GET /announcements/{id} chưa có trong OpenAPI; hiện lấy từ AnnouncementView của danh sách)
    async get(id: number, viewer: Viewer) { requireLocal(); return store.get(id, viewer) },
    // chưa có API (danh sách thành viên đang hoạt động có thể nhận; sẽ lấy từ API thành viên)
    async listMembers(viewer: Viewer) { requireLocal(); return store.listMembers(viewer) },
    // POST /api/farms/{farmId}/announcements/drafts (tạo mới) hoặc PUT /api/farms/{farmId}/announcements/{id}/draft (sửa bản nháp)
    async saveDraft(viewer: Viewer, command: DraftCommand) { requireLocal(); return store.saveDraft(viewer, command) },
    // chưa có API (người nhận được giải ở bước đăng; hộp thoại xem lại cần danh sách này trước khi đăng)
    async previewPublish(viewer: Viewer, id: number) { requireLocal(); return store.previewPublish(viewer, id) },
    // POST /api/farms/{farmId}/announcements/{id}/publish
    async publish(viewer: Viewer, id: number, expectedVersion: number) { requireLocal(); return store.publish(viewer, id, expectedVersion) },
    // POST /api/farms/{farmId}/announcements/{id}/corrections
    async correct(viewer: Viewer, id: number, command: CorrectionCommand) { requireLocal(); return store.correct(viewer, id, command) },
    // POST /api/farms/{farmId}/announcements/recipients/{recipientId}/read
    async markRead(viewer: Viewer, id: number) { requireLocal(); return store.markRead(viewer, id) },
  }
}
export const announcementsApi = createAnnouncementsApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: announcementsDemoStore })
