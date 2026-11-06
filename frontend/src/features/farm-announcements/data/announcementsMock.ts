import type { AnnouncementRecord, AnnouncementsSeed, Member, RecipientRecord } from '../types'

const MEMBERS: Member[] = [
  { id: 1, name: 'Nguyễn Văn Hùng', role: 'OWNER', active: true },
  { id: 2, name: 'Trần Quốc Long', role: 'MANAGER', active: true },
  { id: 3, name: 'Hoàng Thị Lan', role: 'MANAGER', active: true },
  { id: 4, name: 'Lê Thị Mai', role: 'TECHNICIAN', active: true },
  { id: 5, name: 'Phạm Văn Tú', role: 'TECHNICIAN', active: true },
  { id: 6, name: 'Đinh Văn Sơn', role: 'TECHNICIAN', active: true },
  { id: 7, name: 'Bùi Văn Nam', role: 'TECHNICIAN', active: false },
]

let recipientSeq = 0
/** `read` = [mã thành viên, phiên bản đã đọc, giờ đọc] */
const deliver = (memberIds: number[], version: number, read: Record<number, string | null> = {}): RecipientRecord[] =>
  memberIds.map((memberId) => ({
    recipientId: ++recipientSeq,
    memberId,
    readVersion: read[memberId] ? version : null,
    readTime: read[memberId] ?? null,
  }))
const allRead = (ids: number[], at: string) => Object.fromEntries(ids.map((id) => [id, at]))

const TECHS = [4, 5, 6]
const EVERYONE = [2, 3, 4, 5, 6]
const TECH_AUDIENCE = { allManagers: false, allTechnicians: true, memberIds: [] }
const ALL_AUDIENCE = { allManagers: true, allTechnicians: true, memberIds: [] }

const record = (r: AnnouncementRecord) => r
export const ANNOUNCEMENTS_SEED: AnnouncementsSeed = {
  farmName: 'Trại bò Yên Bài – Ba Vì',
  members: MEMBERS,
  announcements: [
    record({
      id: 1, state: 'PUBLISHED', authorId: 2, title: '', body: '', audience: TECH_AUDIENCE, version: 1,
      versions: [{
        id: 1, versionNo: 1, publishedTime: '2026-10-18T09:20:00+07:00', correctionReason: null,
        title: 'Lịch tiêm LMLM mũi 2 cho đàn sinh sản – tuần 19–24/10',
        body: 'Từ thứ Hai 19/10, tiêm LMLM mũi 2 cho 25 con còn lại ở chuồng A1, A2. Chuẩn bị vắc-xin Aftopor, kiểm tra thân nhiệt trước khi tiêm.',
      }],
      recipients: deliver(TECHS, 1, { 6: '2026-10-18T10:02:00+07:00' }),
      relatedLink: { label: 'Mở lịch tiêm liên quan', to: '/tiem-phong' },
    }),
    record({
      id: 2, state: 'PUBLISHED', authorId: 2, title: '', body: '', audience: TECH_AUDIENCE, version: 2,
      versions: [
        { id: 2, versionNo: 1, publishedTime: '2026-10-10T07:30:00+07:00', correctionReason: null, title: 'Quy trình kiểm tra động dục sáng/chiều', body: 'Kiểm tra động dục 2 lần/ngày: 06:00–06:30 và 16:00–16:30. Bò có dấu hiệu báo ngay cho Quản lý ghi nhận.' },
        { id: 3, versionNo: 2, publishedTime: '2026-10-10T15:45:00+07:00', correctionReason: 'Sửa giờ kiểm tra buổi chiều từ 16:00 thành 17:00', title: 'Quy trình kiểm tra động dục sáng/chiều', body: 'Kiểm tra động dục 2 lần/ngày: 06:00–06:30 và 17:00–17:30. Bò có dấu hiệu báo ngay cho Quản lý ghi nhận.' },
      ],
      recipients: deliver(TECHS, 2, allRead(TECHS, '2026-10-10T16:10:00+07:00')),
    }),
    record({
      id: 3, state: 'PUBLISHED', authorId: 1, title: '', body: '', audience: ALL_AUDIENCE, version: 1,
      versions: [{ id: 4, versionNo: 1, publishedTime: '2026-10-08T08:30:00+07:00', correctionReason: null, title: 'Chuẩn bị chuồng đẻ D cho 3 bò sắp đẻ', body: 'Vệ sinh chuồng đẻ D, thay rơm lót và kiểm tra đèn sưởi trước ngày 12/10.' }],
      recipients: deliver(EVERYONE, 1, allRead(EVERYONE, '2026-10-08T09:00:00+07:00')),
    }),
    record({
      id: 4, state: 'PUBLISHED', authorId: 1, title: '', body: '', audience: ALL_AUDIENCE, version: 1,
      versions: [{ id: 5, versionNo: 1, publishedTime: '2026-10-01T08:00:00+07:00', correctionReason: null, title: 'Nhắc bảo quản vắc-xin 2–8°C', body: 'Vắc-xin phải bảo quản ở 2–8°C, không để đông đá. Kiểm tra nhiệt kế tủ lạnh mỗi sáng và ghi lại.' }],
      recipients: deliver(EVERYONE, 1, allRead(EVERYONE, '2026-10-01T08:40:00+07:00')),
    }),
    record({
      id: 5, state: 'PUBLISHED', authorId: 2, title: '', body: '', audience: TECH_AUDIENCE, version: 1,
      versions: [{ id: 6, versionNo: 1, publishedTime: '2026-10-05T08:00:00+07:00', correctionReason: null, title: 'Lịch cân định kỳ tháng 10', body: 'Cân toàn đàn vỗ béo vào sáng thứ Sáu 09/10, trước giờ cho ăn. Ghi khối lượng vào phiếu cân.' }],
      recipients: deliver(TECHS, 1, allRead(TECHS, '2026-10-05T08:30:00+07:00')),
    }),
    record({
      id: 6, state: 'PUBLISHED', authorId: 2, title: '', body: '', audience: TECH_AUDIENCE, version: 1,
      versions: [{ id: 7, versionNo: 1, publishedTime: '2026-09-25T16:00:00+07:00', correctionReason: null, title: 'Vệ sinh máng ăn cuối tuần', body: 'Rửa và phơi khô máng ăn các chuồng B1, B3, C2 vào chiều thứ Bảy.' }],
      recipients: deliver(TECHS, 1, allRead(TECHS, '2026-09-25T17:00:00+07:00')),
    }),
    record({
      id: 7, state: 'DRAFT', authorId: 2, title: 'Lịch cân định kỳ tháng 11', body: 'Dự kiến cân toàn đàn vào ngày 05/11. Chuẩn bị cân và sổ ghi.',
      audience: TECH_AUDIENCE, version: 1, versions: [], recipients: [],
    }),
  ],
}
