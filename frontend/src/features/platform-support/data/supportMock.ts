import type {
  Actor, ContextRef, DomainResult, InternalView, StaffMember, SupportNotification, Ticket, TicketCategory, TicketPriority, TicketStatus,
} from '../types'

export const CS_ME: Actor = { id: 1, name: 'Phạm Thu Hà', role: 'CS' }
export const PM_QUAN: Actor = { id: 21, name: 'Đỗ Minh Quân', role: 'PM' }
export const SA_NAM: Actor = { id: 31, name: 'Vũ Hoàng Nam', role: 'SA' }

export function actorForRole(role: string | undefined): Actor {
  if (role === 'PM') return PM_QUAN
  if (role === 'SA') return SA_NAM
  return CS_ME
}

export const STAFF_SEED: StaffMember[] = [
  { id: 1, name: 'Phạm Thu Hà', role: 'CS', available: true },
  { id: 2, name: 'Ngô Minh Khang', role: 'CS', available: true },
  { id: 3, name: 'Lê Thanh Tâm', role: 'CS', available: true },
  { id: 21, name: 'Đỗ Minh Quân', role: 'PM', available: true },
  { id: 22, name: 'Trần Minh Đức', role: 'PM', available: true },
  { id: 31, name: 'Vũ Hoàng Nam', role: 'SA', available: true },
  { id: 32, name: 'Lê Quốc Hưng', role: 'SA', available: true },
]

const FARMS = {
  yenBai: { id: 1, name: 'Trại bò Yên Bài – Ba Vì', owner: 'Nguyễn Văn Hùng', ownerId: 101 },
  vanHoa: { id: 2, name: 'Trại Vân Hòa', owner: 'Lê Văn Bình', ownerId: 102 },
  suoiHai: { id: 3, name: 'Trại Suối Hai', owner: 'Nguyễn Văn Hùng', ownerId: 101 },
  tongBat: { id: 4, name: 'Trại Tòng Bạt', owner: 'Trần Thị Hoa', ownerId: 103 },
} as const
type FarmKey = keyof typeof FARMS

const KHANG = { id: 2, name: 'Ngô Minh Khang' }
const TAM = { id: 3, name: 'Lê Thanh Tâm' }
const HA = { id: 1, name: 'Phạm Thu Hà' }

let msgId = 0
function ticket(
  n: number, subject: string, farm: FarmKey, category: TicketCategory, priority: TicketPriority, status: TicketStatus,
  cs: { id: number; name: string } | null, createdAt: string, extra: Partial<Ticket> = {},
): Ticket {
  const f = FARMS[farm]
  const code = `TK-${n}`
  const ctx: ContextRef[] = [{ type: 'FARM', id: f.id, label: f.name }]
  return {
    id: n, code, subject, category, priority, status, farmId: f.id, farmName: f.name, requesterId: f.ownerId, requester: f.owner,
    assignedCsId: cs?.id ?? null, assignedCs: cs?.name ?? null, assignedAvailable: true, createdAt, updatedAt: createdAt, version: 1,
    messages: [{ id: ++msgId, visibility: 'PUBLIC', author: f.owner, authorRole: 'OWNER', text: `${subject}. Nhờ bên hỗ trợ kiểm tra giúp tôi.`, at: createdAt }],
    resolutions: [],
    history: [{ at: createdAt, actor: f.owner, text: 'Tạo ticket (Mới mở).' }],
    internalRequests: [],
    contextOptions: { PM: ctx, SA: [{ type: 'ACCOUNT', id: f.ownerId, label: `User USR-${n} · email được che` }] },
    ...extra,
  }
}

const tk1042 = ticket(1042, 'Đã chuyển khoản gia hạn nhưng chưa thấy xác nhận', 'yenBai', 'PAYMENT', 'NORMAL', 'IN_PROGRESS', HA, '2026-10-18T09:40:00', {
  updatedAt: '2026-10-18T09:55:00', version: 4,
  messages: [
    { id: 9001, visibility: 'PUBLIC', author: 'Nguyễn Văn Hùng', authorRole: 'OWNER', text: 'Tôi đã chuyển 1.200.000đ lúc 09:05 ngày 18/10 với nội dung BCF7K2Q9 qua MB Bank nhưng yêu cầu vẫn đang chờ thanh toán.', at: '2026-10-18T09:40:00' },
    { id: 9002, visibility: 'PUBLIC', author: 'Phạm Thu Hà', authorRole: 'CS', text: 'Chào anh, em đã ghi nhận và đang nhờ bộ phận thanh toán đối soát giao dịch. Em sẽ phản hồi trong hôm nay ạ.', at: '2026-10-18T09:52:00' },
    { id: 9003, visibility: 'INTERNAL', author: 'Phạm Thu Hà', authorRole: 'CS', text: 'Nội dung chuyển khoản khách gõ "BCF7K2Q 9" (có dấu cách) – có thể không khớp tự động. Đã gửi yêu cầu nội bộ cho PM.', at: '2026-10-18T09:55:00' },
  ],
  history: [
    { at: '2026-10-18T09:40:00', actor: 'Nguyễn Văn Hùng', text: 'Tạo ticket (Mới mở).' },
    { at: '2026-10-18T09:48:00', actor: 'Phạm Thu Hà', text: 'Nhận ticket: Mới mở → Đang xử lý.' },
    { at: '2026-10-18T09:55:00', actor: 'Phạm Thu Hà', text: 'Tạo yêu cầu nội bộ IR-077 gửi Đỗ Minh Quân (PM).' },
  ],
  contextOptions: {
    PM: [{ type: 'PAYMENT', id: 843, label: 'Thanh toán BCF7K2Q9 · Trại Yên Bài' }, { type: 'FARM', id: 1, label: 'Trại bò Yên Bài – Ba Vì' }],
  SA: [{ type: 'ACCOUNT', id: 1042, label: 'Người dùng USR-1042 · email được che; không có chứng từ ngân hàng' }],
  },
})

const tk1031 = ticket(1031, 'Không quét được thẻ QR trên Android cũ', 'yenBai', 'SYSTEM_USAGE', 'NORMAL', 'RESOLVED', KHANG, '2026-10-16T14:20:00', {
  assignedAvailable: false, updatedAt: '2026-10-18T07:58:00', version: 6,
  resolutions: [
    { id: 1, version: 1, content: 'Đã hướng dẫn bật quyền camera.', resolvedBy: 'Ngô Minh Khang', resolvedAt: '2026-10-17T10:10:00', acknowledged: false, reviewed: false },
    { id: 2, version: 2, content: 'Đã cập nhật trình quét tương thích Android 8; vui lòng thử lại thẻ QR.', resolvedBy: 'Ngô Minh Khang', resolvedAt: '2026-10-17T16:05:00', acknowledged: true, acknowledgedAt: '2026-10-18T07:58:00', acknowledgmentComment: 'Chủ trại đã bấm Xác nhận cho kết quả phiên bản 2', reviewed: false },
  ],
  history: [
    { at: '2026-10-16T14:20:00', actor: 'Nguyễn Văn Hùng', text: 'Tạo ticket (Mới mở).' },
    { at: '2026-10-17T16:05:00', actor: 'Ngô Minh Khang', text: 'Ghi kết quả giải quyết phiên bản 2: Đã giải quyết.' },
    { at: '2026-10-18T07:58:00', actor: 'Nguyễn Văn Hùng', text: 'Xác nhận kết quả phiên bản 2.' },
  ],
})

const tk1027 = ticket(1027, 'Xin khôi phục dịch vụ Trại Suối Hai', 'suoiHai', 'FARM_SERVICE', 'HIGH', 'WAITING_CUSTOMER', KHANG, '2026-10-17T15:30:00')
const tk1019 = ticket(1019, 'Không nhận được email mời thành viên', 'yenBai', 'ACCOUNT_ACCESS', 'NORMAL', 'IN_PROGRESS', HA, '2026-10-15T11:05:00', {
  history: [
    { at: '2026-10-15T11:05:00', actor: 'Nguyễn Văn Hùng', text: 'Tạo ticket (Mới mở).' },
    { at: '2026-10-17T17:10:00', actor: 'Ngô Minh Khang', text: 'Bàn giao cho Phạm Thu Hà. Lý do: cân bằng tải ca chiều.' },
  ],
})

export const TICKETS_SEED: Ticket[] = [
  tk1042, tk1031, tk1027, tk1019,
  ticket(1044, 'Không vào được trại sau khi gia hạn', 'vanHoa', 'FARM_SERVICE', 'HIGH', 'OPEN', null, '2026-10-18T11:20:00'),
  ticket(1025, 'Đổi email đăng nhập Google', 'tongBat', 'ACCOUNT_ACCESS', 'LOW', 'OPEN', null, '2026-10-18T08:25:00'),
  ticket(1046, 'Thanh toán trừ tiền hai lần', 'vanHoa', 'PAYMENT', 'HIGH', 'OPEN', null, '2026-10-18T10:45:00'),
  ticket(1038, 'Hỏi cách xuất báo cáo đàn', 'tongBat', 'SYSTEM_USAGE', 'NORMAL', 'OPEN', null, '2026-10-17T09:15:00'),
  ticket(1040, 'Không cập nhật được số điện thoại', 'yenBai', 'ACCOUNT_ACCESS', 'NORMAL', 'IN_PROGRESS', HA, '2026-10-17T13:00:00'),
  ticket(1036, 'Hóa đơn gia hạn thiếu thông tin', 'suoiHai', 'PAYMENT', 'LOW', 'IN_PROGRESS', HA, '2026-10-17T08:40:00'),
  ticket(1034, 'Mất quyền Quản lý của một thành viên', 'yenBai', 'ACCOUNT_ACCESS', 'NORMAL', 'IN_PROGRESS', HA, '2026-10-16T16:10:00'),
  ticket(1029, 'Trại hiển thị tạm ngừng sai kỳ', 'suoiHai', 'FARM_SERVICE', 'HIGH', 'IN_PROGRESS', HA, '2026-10-16T09:30:00'),
  ticket(1030, 'Cần bổ sung chứng từ chuyển khoản', 'vanHoa', 'PAYMENT', 'NORMAL', 'WAITING_CUSTOMER', TAM, '2026-10-15T15:45:00'),
  ticket(1023, 'Xác minh chủ sở hữu trại', 'tongBat', 'ACCOUNT_ACCESS', 'NORMAL', 'WAITING_CUSTOMER', KHANG, '2026-10-14T10:20:00'),
  ticket(1021, 'Máy tính bảng không đồng bộ', 'vanHoa', 'SYSTEM_USAGE', 'LOW', 'RESOLVED', TAM, '2026-10-13T14:00:00', {
    resolutions: [{ id: 3, version: 1, content: 'Đã hướng dẫn đăng nhập lại và đồng bộ thủ công.', resolvedBy: 'Lê Thanh Tâm', resolvedAt: '2026-10-17T11:00:00', acknowledged: false, reviewed: false }],
  }),
  ticket(1017, 'Thay đổi tên hiển thị của trại', 'yenBai', 'FARM_SERVICE', 'NORMAL', 'IN_PROGRESS', KHANG, '2026-10-13T09:00:00'),
  ticket(1015, 'Không đăng nhập được bằng Google', 'tongBat', 'ACCOUNT_ACCESS', 'HIGH', 'IN_PROGRESS', TAM, '2026-10-12T16:30:00'),
  ticket(1012, 'Thắc mắc kỳ dịch vụ sau gia hạn', 'suoiHai', 'PAYMENT', 'NORMAL', 'IN_PROGRESS', KHANG, '2026-10-12T08:50:00'),
  ticket(1008, 'Lỗi hiển thị trên điện thoại', 'vanHoa', 'SYSTEM_USAGE', 'LOW', 'IN_PROGRESS', TAM, '2026-10-11T13:15:00'),
  ticket(1005, 'Yêu cầu hóa đơn VAT', 'yenBai', 'PAYMENT', 'NORMAL', 'IN_PROGRESS', KHANG, '2026-10-10T10:10:00'),
  ticket(1002, 'Hỏi về gói dịch vụ cho trại thứ hai', 'tongBat', 'OTHER', 'LOW', 'IN_PROGRESS', TAM, '2026-10-09T09:45:00'),
  ticket(1009, 'Lỗi vẫn xảy ra trên máy thứ hai', 'yenBai', 'SYSTEM_USAGE', 'NORMAL', 'CLOSED', HA, '2026-10-08T09:00:00'),
]

type IrSeed = Pick<InternalView, 'code' | 'title' | 'ticketCode' | 'targetRole' | 'recipientId' | 'recipient' | 'from' | 'fromId' | 'createdAt' | 'question' | 'status'> & Partial<InternalView>
function ir(seed: IrSeed, farm: FarmKey): InternalView {
  const f = FARMS[farm]
  const n = Number(seed.code.slice(3))
  return {
    id: n, ticketId: Number(seed.ticketCode.slice(3)), farmId: f.id, farmName: f.name, context: [], version: 1,
    history: [{ at: seed.createdAt, actor: seed.from, text: `Tạo yêu cầu ${seed.code} gửi ${seed.recipient}.` }],
    ...seed,
  }
}
const PAY_CTX: ContextRef[] = [{ type: 'PAYMENT', id: 843, label: 'Thanh toán BCF7K2Q9' }]
const done = { status: 'DONE' as const, outcome: 'PERFORMED' as const, completedAt: '2026-10-12T15:00:00', result: 'Đã xử lý trong phạm vi.', version: 2 }

export const IR_SEED: InternalView[] = [
  ir({ code: 'IR-077', title: 'Kiểm tra giao dịch SePay 09:05 18/10', ticketCode: 'TK-1042', targetRole: 'PM', recipientId: 21, recipient: 'Đỗ Minh Quân', from: 'Phạm Thu Hà', fromId: 1, createdAt: '2026-10-18T09:55:00', status: 'OPEN', context: PAY_CTX, question: 'Khách chuyển 1.200.000đ lúc 09:05; mã nội dung không khớp chính xác. Kiểm tra trong miền thanh toán, không bỏ qua kiểm tra mã.' }, 'yenBai'),
  ir({ code: 'IR-079', title: 'Lý do tạm ngừng Trại Suối Hai', ticketCode: 'TK-1027', targetRole: 'PM', recipientId: 21, recipient: 'Đỗ Minh Quân', from: 'Ngô Minh Khang', fromId: 2, createdAt: '2026-10-17T15:50:00', status: 'OPEN', context: [{ type: 'FARM', id: 3, label: 'Trại Suối Hai' }], question: 'Chủ trại hỏi vì sao dịch vụ bị tạm ngừng và điều kiện khôi phục. Nhờ PM xác nhận lý do trong miền dịch vụ trại.' }, 'suoiHai'),
  ir({ code: 'IR-081', title: 'Kiểm tra quyền đăng nhập của tài khoản', ticketCode: 'TK-1025', targetRole: 'SA', recipientId: 31, recipient: 'Vũ Hoàng Nam', from: 'Phạm Thu Hà', fromId: 1, createdAt: '2026-10-18T08:40:00', status: 'OPEN', context: [{ type: 'ACCOUNT', id: 1025, label: 'Người dùng USR-1025 · h***@gmail.com' }], question: 'Chủ trại Trần Thị Hoa muốn đổi Gmail đăng nhập. Nhờ kiểm tra tài khoản có đang bị khóa hay trùng định danh Google không.' }, 'tongBat'),
  ir({ code: 'IR-073', title: 'Kiểm tra tài khoản bị khóa đăng nhập', ticketCode: 'TK-1011', targetRole: 'SA', recipientId: 31, recipient: 'Vũ Hoàng Nam', from: 'Ngô Minh Khang', fromId: 2, createdAt: '2026-10-12T09:10:00', question: 'Tài khoản chủ trại không đăng nhập được, nhờ SA kiểm tra trạng thái.', ...done, completedBy: 'Vũ Hoàng Nam' }, 'vanHoa'),
  ir({ code: 'IR-076', title: 'Xác minh định danh Google trùng', ticketCode: 'TK-1016', targetRole: 'SA', recipientId: 31, recipient: 'Vũ Hoàng Nam', from: 'Lê Thanh Tâm', fromId: 3, createdAt: '2026-10-14T10:30:00', question: 'Hai tài khoản cùng email Google, nhờ SA kiểm tra trùng định danh.', ...done, outcome: 'UNABLE', result: 'Không phát hiện định danh trùng.', completedAt: '2026-10-14T14:00:00', completedBy: 'Vũ Hoàng Nam' }, 'tongBat'),
  ir({ code: 'IR-078', title: 'Mở khóa tài khoản thành viên', ticketCode: 'TK-1020', targetRole: 'SA', recipientId: 31, recipient: 'Vũ Hoàng Nam', from: 'Phạm Thu Hà', fromId: 1, createdAt: '2026-10-15T08:00:00', status: 'CANCELLED', question: 'Mở khóa tài khoản thành viên của trại.', history: [{ at: '2026-10-15T08:00:00', actor: 'Phạm Thu Hà', text: 'Tạo yêu cầu IR-078 gửi Vũ Hoàng Nam.' }, { at: '2026-10-15T08:30:00', actor: 'Phạm Thu Hà', text: 'Hủy yêu cầu. Lý do: Chủ trại tự xử lý được.' }] }, 'yenBai'),
  ir({ code: 'IR-072', title: 'Đối soát thanh toán BCF3A1', ticketCode: 'TK-1010', targetRole: 'PM', recipientId: 21, recipient: 'Đỗ Minh Quân', from: 'Phạm Thu Hà', fromId: 1, createdAt: '2026-10-11T09:00:00', question: 'Kiểm tra thanh toán BCF3A1 đã khớp chưa.', ...done, completedBy: 'Đỗ Minh Quân' }, 'yenBai'),
  ir({ code: 'IR-075', title: 'Kiểm tra kỳ dịch vụ Trại Vân Hòa', ticketCode: 'TK-1018', targetRole: 'PM', recipientId: 21, recipient: 'Đỗ Minh Quân', from: 'Ngô Minh Khang', fromId: 2, createdAt: '2026-10-14T13:00:00', question: 'Kỳ dịch vụ sau gia hạn chưa đúng ngày.', ...done, outcome: 'OUTSIDE_DOMAIN', result: 'Thuộc phạm vi SA.', completedBy: 'Đỗ Minh Quân' }, 'vanHoa'),
  ir({ code: 'IR-080', title: 'Hủy yêu cầu gửi nhầm vai trò', ticketCode: 'TK-1024', targetRole: 'PM', recipientId: 21, recipient: 'Đỗ Minh Quân', from: 'Lê Thanh Tâm', fromId: 3, createdAt: '2026-10-16T09:00:00', status: 'CANCELLED', question: 'Gửi nhầm vai trò.' }, 'suoiHai'),
]

export const DOMAIN_RESULTS_SEED: Record<string, DomainResult[]> = {
  'IR-077': [{ id: 843, label: 'OP-Chấp nhận-0843 · Thanh toán BCF7K2Q9 · Đã thanh toán' }],
  'IR-079': [{ id: 850, label: 'AUD-0850 · Trại Suối Hai · Lý do tạm ngừng đã ghi' }],
  'IR-081': [{ id: 911, label: 'AUD-0911 · Tài khoản USR-1025 · Kiểm tra trạng thái' }],
}

export const NOTIFICATIONS_SEED: SupportNotification[] = [
  { id: 1, title: 'Ticket mới TK-1044 · ưu tiên Cao', body: 'Lê Văn Bình · Trại Vân Hòa · chưa có người nhận', at: '2 phút trước', read: false, actionLabel: 'Nhận ticket', ticketCode: 'TK-1044' },
  { id: 2, title: 'PM Đỗ Minh Quân đã trả kết quả IR-077', body: 'Giao dịch đã được chấp nhận thủ công', at: '8 phút trước', read: false, actionLabel: 'Xem TK-1042', ticketCode: 'TK-1042' },
  { id: 3, title: 'Chủ trại đã xác nhận kết quả TK-1031', body: 'Có thể xem xét đóng ticket', at: '07:58', read: false, actionLabel: 'Đóng ticket', ticketCode: 'TK-1031' },
  { id: 4, title: 'TK-1009 được Chủ trại mở lại', body: 'Lý do: lỗi vẫn xảy ra trên máy thứ hai', at: 'Hôm qua', read: true, actionLabel: 'Xem', ticketCode: 'TK-1009' },
  { id: 5, title: 'Bạn nhận bàn giao TK-1019 từ Ngô Minh Khang', body: 'Lý do: cân bằng tải ca chiều', at: 'Hôm qua', read: true, actionLabel: 'Xem', ticketCode: 'TK-1019' },
]
