import type { HistoryEntry, MessageKind, OwnedFarm, ResolutionView, Ticket, TicketMessage } from '../types'

/** Thời điểm "hiện tại" của bản mock: khớp các frame (cập nhật gần nhất 18/10/2026 09:40). */
export const SUPPORT_DEMO_NOW = '2026-10-18T09:52:00'

const OWNER_ID = 101
const OWNER = 'Nguyễn Văn Hùng'
const CS_ID = 201
const CS = 'Phạm Thu Hà'

export const OWNED_FARMS: OwnedFarm[] = [
  { id: 1, name: 'Trại bò Yên Bài – Ba Vì' },
  { id: 2, name: 'Trại Suối Hai' },
  { id: 3, name: 'Trại bò Tản Lĩnh' },
]
const farmName = (id: number) => OWNED_FARMS.find((f) => f.id === id)!.name

let msgNo = 5480
const m = (kind: MessageKind, from: 'OWNER' | 'CS', createdAt: string, text: string): TicketMessage => ({
  code: `MSG-${msgNo++}`,
  params: {},
  text,
  kind,
  author: from === 'OWNER' ? OWNER : CS,
  authorRole: from,
  createdAt,
})
const h = (at: string, event: HistoryEntry['event'], status: HistoryEntry['status'], actor: string, reason?: string): HistoryEntry => ({ at, event, status, actor, ...(reason ? { reason } : {}) })
const res = (id: number, version: number, resolvedAt: string, content: string, ack: string | null = null): ResolutionView => ({
  id,
  version,
  content,
  resolvedBy: CS,
  resolvedAt,
  acknowledged: ack !== null,
  acknowledgedAt: ack,
  acknowledgmentComment: null,
  reviewed: false,
})

const base = { priority: 'NORMAL' as const, requesterId: OWNER_ID, requester: OWNER }

const TK_1042: Ticket = {
  ...base,
  id: 1042,
  code: 'TK-1042',
  subject: 'Đã chuyển khoản gia hạn nhưng chưa thấy xác nhận',
  category: 'PAYMENT',
  status: 'IN_PROGRESS',
  scope: 'FARM',
  farmId: 1,
  farmName: farmName(1),
  assignedCsId: CS_ID,
  assignedCs: CS,
  createdAt: '2026-10-18T09:12:00',
  updatedAt: '2026-10-18T09:40:00',
  version: 6,
  messages: [
    m('DESCRIPTION', 'OWNER', '2026-10-18T09:12:00', 'Tôi đã chuyển 1.200.000 đồng lúc 09:05 ngày 18/10, kèm nội dung BCF7K2Q9 nhưng chưa thấy xác nhận.'),
    m('REOPEN', 'OWNER', '2026-10-18T09:30:00', 'Tôi vẫn chưa thấy kỳ gia hạn được cập nhật. Nhờ kiểm tra lại.'),
    m('REPLY', 'CS', '2026-10-18T09:40:00', 'Chúng tôi đang đối chiếu lại kỳ gia hạn của trại với yêu cầu thanh toán BCF7K2Q9 và sẽ phản hồi ngay trong ticket này.'),
  ],
  resolutions: [res(9001, 1, '2026-10-18T09:22:00', 'Thanh toán đã xác nhận; kỳ mua 15/11/2026 – 14/11/2027.')],
  history: [
    h('2026-10-18T09:12:00', 'CREATED', 'OPEN', OWNER),
    h('2026-10-18T09:15:00', 'IN_PROGRESS', 'IN_PROGRESS', CS),
    h('2026-10-18T09:22:00', 'RESOLVED', 'RESOLVED', CS),
    h('2026-10-18T09:30:00', 'REOPENED', 'OPEN', OWNER, 'Tôi vẫn chưa thấy kỳ gia hạn được cập nhật. Nhờ kiểm tra lại.'),
    h('2026-10-18T09:40:00', 'IN_PROGRESS', 'IN_PROGRESS', CS),
  ],
}

const TK_1031: Ticket = {
  ...base,
  id: 1031,
  code: 'TK-1031',
  subject: 'Không quét được thẻ nhận diện trên điện thoại Android cũ',
  category: 'SYSTEM_USAGE',
  status: 'RESOLVED',
  scope: 'FARM',
  farmId: 1,
  farmName: farmName(1),
  assignedCsId: CS_ID,
  assignedCs: CS,
  createdAt: '2026-10-16T07:20:00',
  updatedAt: '2026-10-17T16:05:00',
  version: 7,
  messages: [
    m('DESCRIPTION', 'OWNER', '2026-10-16T07:20:00', 'Kỹ thuật viên dùng Samsung J7 không mở được máy ảnh để quét mã trong trình duyệt.'),
    m('REPLY', 'CS', '2026-10-16T09:05:00', 'Anh cho biết trình duyệt đang dùng và đã cấp quyền máy ảnh chưa ạ?'),
    m('REPLY', 'OWNER', '2026-10-16T10:12:00', 'Dùng trình duyệt mặc định của máy, đã cấp quyền.'),
  ],
  resolutions: [res(9002, 2, '2026-10-17T16:05:00', 'Trình duyệt mặc định trên máy cũ không hỗ trợ máy ảnh trên web. Vui lòng dùng Chrome bản mới.')],
  history: [
    h('2026-10-16T07:20:00', 'CREATED', 'OPEN', OWNER),
    h('2026-10-16T09:05:00', 'IN_PROGRESS', 'IN_PROGRESS', CS),
    h('2026-10-16T09:06:00', 'WAITING_CUSTOMER', 'WAITING_CUSTOMER', CS),
    h('2026-10-16T10:12:00', 'IN_PROGRESS', 'IN_PROGRESS', OWNER),
    h('2026-10-17T16:05:00', 'RESOLVED', 'RESOLVED', CS),
  ],
}

const TK_1027: Ticket = {
  ...base,
  id: 1027,
  code: 'TK-1027',
  subject: 'Xin khôi phục dịch vụ Trại Suối Hai',
  category: 'FARM_SERVICE',
  status: 'WAITING_CUSTOMER',
  scope: 'FARM',
  farmId: 2,
  farmName: farmName(2),
  assignedCsId: CS_ID,
  assignedCs: CS,
  createdAt: '2026-10-14T14:10:00',
  updatedAt: '2026-10-15T10:22:00',
  version: 4,
  messages: [
    m('DESCRIPTION', 'OWNER', '2026-10-14T14:10:00', 'Trại Suối Hai đang bị tạm ngưng dịch vụ. Tôi muốn khôi phục lại để tiếp tục ghi nhận đàn bò.'),
    m('REPLY', 'CS', '2026-10-15T10:22:00', 'Anh vui lòng cho biết mã yêu cầu thanh toán và thời điểm chuyển khoản gần nhất của trại này ạ.'),
  ],
  resolutions: [],
  history: [
    h('2026-10-14T14:10:00', 'CREATED', 'OPEN', OWNER),
    h('2026-10-14T15:00:00', 'IN_PROGRESS', 'IN_PROGRESS', CS),
    h('2026-10-15T10:22:00', 'WAITING_CUSTOMER', 'WAITING_CUSTOMER', CS),
  ],
}

const TK_1019: Ticket = {
  ...base,
  id: 1019,
  code: 'TK-1019',
  subject: 'Không nhận được thư điện tử mời thành viên',
  category: 'ACCOUNT_ACCESS',
  status: 'IN_PROGRESS',
  scope: 'ACCOUNT',
  farmId: null,
  farmName: null,
  assignedCsId: CS_ID,
  assignedCs: CS,
  createdAt: '2026-10-12T07:50:00',
  updatedAt: '2026-10-12T08:14:00',
  version: 3,
  messages: [
    m('DESCRIPTION', 'OWNER', '2026-10-12T07:50:00', 'Tôi mời một quản lý vào trại nhưng người đó không nhận được thư điện tử mời.'),
    m('REPLY', 'CS', '2026-10-12T08:14:00', 'Chúng tôi đang kiểm tra nhật ký gửi thư và sẽ cập nhật cho anh trong ticket này.'),
  ],
  resolutions: [],
  history: [h('2026-10-12T07:50:00', 'CREATED', 'OPEN', OWNER), h('2026-10-12T08:14:00', 'IN_PROGRESS', 'IN_PROGRESS', CS)],
}

const TK_0988: Ticket = {
  ...base,
  id: 988,
  code: 'TK-0988',
  subject: 'Hỏi cách nhập lịch sử tiêm cũ',
  category: 'SYSTEM_USAGE',
  status: 'CLOSED',
  scope: 'FARM',
  farmId: 3,
  farmName: farmName(3),
  assignedCsId: CS_ID,
  assignedCs: CS,
  createdAt: '2026-09-01T15:00:00',
  updatedAt: '2026-09-02T11:30:00',
  version: 6,
  messages: [
    m('DESCRIPTION', 'OWNER', '2026-09-01T15:00:00', 'Bò mua về đã tiêm vắc-xin trước đó, tôi nhập lịch sử tiêm cũ ở đâu?'),
    m('REPLY', 'CS', '2026-09-01T15:20:00', 'Anh nhập ở bước khai báo lịch sử trước khi nhập đàn, mục Tiêm phòng, chọn "Đã biết" rồi thêm từng mũi.'),
    m('ACKNOWLEDGMENT', 'OWNER', '2026-09-02T10:15:00', 'Chủ trại đã xác nhận kết quả giải quyết phiên bản 1.'),
  ],
  resolutions: [res(9003, 1, '2026-09-02T09:00:00', 'Đã hướng dẫn nhập lịch sử tiêm cũ ở bước khai báo lịch sử khi nhập đàn.', '2026-09-02T10:15:00')],
  history: [
    h('2026-09-01T15:00:00', 'CREATED', 'OPEN', OWNER),
    h('2026-09-01T15:20:00', 'IN_PROGRESS', 'IN_PROGRESS', CS),
    h('2026-09-02T09:00:00', 'RESOLVED', 'RESOLVED', CS),
    h('2026-09-02T11:30:00', 'CLOSED', 'CLOSED', CS),
  ],
}

/** Ticket của chủ trại khác: store phải ẩn (GBR-81). */
const TK_1043_OTHER: Ticket = {
  ...base,
  id: 1043,
  code: 'TK-1043',
  requesterId: 900,
  requester: 'Trần Thị Mai',
  subject: 'Cần xuất hóa đơn kỳ gia hạn',
  category: 'PAYMENT',
  status: 'OPEN',
  scope: 'ACCOUNT',
  farmId: null,
  farmName: null,
  assignedCsId: null,
  assignedCs: null,
  createdAt: '2026-10-18T08:00:00',
  updatedAt: '2026-10-18T08:00:00',
  version: 1,
  messages: [{ ...m('DESCRIPTION', 'OWNER', '2026-10-18T08:00:00', 'Nội dung của chủ trại khác.'), author: 'Trần Thị Mai' }],
  resolutions: [],
  history: [h('2026-10-18T08:00:00', 'CREATED', 'OPEN', 'Trần Thị Mai')],
}

export interface SupportSeed {
  ownerId: number
  ownerName: string
  farms: OwnedFarm[]
  tickets: Ticket[]
  nextTicketNumber: number
  nextMessageNumber: number
  nextResolutionId: number
}

export const SUPPORT_SEED: SupportSeed = {
  ownerId: OWNER_ID,
  ownerName: OWNER,
  farms: OWNED_FARMS,
  tickets: [TK_1042, TK_1031, TK_1027, TK_1019, TK_0988, TK_1043_OTHER],
  nextTicketNumber: 1045,
  nextMessageNumber: 5512,
  nextResolutionId: 9100,
}
