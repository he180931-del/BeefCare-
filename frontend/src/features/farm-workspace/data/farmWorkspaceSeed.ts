import type { FarmDetails, Invitation, InvitationPreview, Membership } from '../types'

export const YEN_BAI = 'Trại bò Yên Bài – Ba Vì'
/** Mã liên kết mẫu cho chế độ mô phỏng (xem /invitation/accept?token=…). */
export const SAMPLE_TOKEN = 'mock-invitation-token'
export const EXPIRED_TOKEN = 'mock-invitation-expired'
/** Trại của lời mời mẫu; không trùng mã trại đã có hoặc sắp cấp. */
export const INVITED_FARM_ID = 99
export const FIRST_NEW_FARM_ID = 5

const base = { timeZone: 'Asia/Ho_Chi_Minh', mainBreedIds: [1], mainBreedCodes: ['VANG'], expectedHerdSize: '150_300' as const, version: 1 }

/** Bốn trại của Chủ trại trong khung "Chọn trang trại"; trại 1 là trại mẫu của cả hệ thống. */
export function seedFarms(): FarmDetails[] {
  return [
    {
      ...base, id: 1, name: YEN_BAI, role: 'OWNER', serviceStatus: 'ACTIVE', province: 'Hà Nội', commune: 'Xã Yên Bài, Ba Vì', detailedAddress: 'Thôn Muỗi, xã Yên Bài',
      contactPerson: 'Nguyễn Văn Hùng', contactPhone: '0912 345 678', registrationCertificateInfo: 'GCN trang trại số 12/GCN-TT · cấp 03/2024',
      morningShiftStart: '05:30', operatingNotes: 'Cho ăn 2 bữa 06:00 & 16:00 · kiểm tra động dục sáng/chiều',
      serviceUntil: '2026-11-14', renewalOpensAt: '2026-08-16', activeCattleCount: 248, ownerName: 'Nguyễn Văn Hùng', ownerEmail: 'owner@beefcare.local',
    },
    {
      ...base, id: 2, name: 'Trại Tản Lĩnh', role: 'OWNER', serviceStatus: 'PENDING_PAYMENT', province: 'Hà Nội', commune: 'Tản Lĩnh, Ba Vì', detailedAddress: 'Thôn Bơn, xã Tản Lĩnh',
      contactPerson: 'Nguyễn Văn Hùng', contactPhone: '0912 345 678', registrationCertificateInfo: '', morningShiftStart: '', operatingNotes: '',
      serviceUntil: null, renewalOpensAt: null, activeCattleCount: 0, ownerName: 'Nguyễn Văn Hùng', ownerEmail: 'owner@beefcare.local',
    },
    {
      ...base, id: 3, name: 'Trại Cẩm Lĩnh', role: 'MANAGER', serviceStatus: 'ACTIVE', province: 'Hà Nội', commune: 'Cẩm Lĩnh, Ba Vì', detailedAddress: '',
      contactPerson: '', contactPhone: '', registrationCertificateInfo: '', morningShiftStart: '', operatingNotes: '',
      serviceUntil: '2027-03-31', renewalOpensAt: null, activeCattleCount: 132, ownerName: 'Chủ trại Cẩm Lĩnh',
    },
    {
      ...base, id: 4, name: 'Trại Suối Hai', role: 'OWNER', serviceStatus: 'SUSPENDED', province: 'Hà Nội', commune: 'Suối Hai, Ba Vì', detailedAddress: '',
      contactPerson: 'Nguyễn Văn Hùng', contactPhone: '0912 345 678', registrationCertificateInfo: '', morningShiftStart: '', operatingNotes: '',
      serviceUntil: null, renewalOpensAt: null, activeCattleCount: 61, ownerName: 'Nguyễn Văn Hùng', ownerEmail: 'owner@beefcare.local',
    },
  ]
}

const member = (id: number, fullName: string, email: string, role: Membership['role'], joinedAt: string, status: Membership['status'] = 'ACTIVE'): Membership =>
  ({ id, userId: id, fullName, email, role, status, joinedAt: `${joinedAt}T08:00:00+07:00`, version: 1, actions: [] })

/** Bảy thành viên của trại Yên Bài (Figma "Thành viên & vai trò"). */
export function seedYenBaiMembers(): Membership[] {
  return [
    member(1, 'Nguyễn Văn Hùng', 'owner@beefcare.local', 'OWNER', '2024-03-01'),
    member(2, 'Trần Quốc Long', 'manager@beefcare.local', 'MANAGER', '2024-05-01'),
    member(3, 'Hoàng Thị Lan', 'lan.ht@gmail.com', 'MANAGER', '2025-01-01'),
    member(4, 'Lê Thị Mai', 'technician@beefcare.local', 'TECHNICIAN', '2024-05-01'),
    member(5, 'Phạm Văn Tú', 'tu.pv@gmail.com', 'TECHNICIAN', '2025-09-01'),
    member(6, 'Đinh Văn Sơn', 'son.dv@gmail.com', 'TECHNICIAN', '2026-02-01'),
    member(7, 'Bùi Văn Khoa', 'khoa.bv@gmail.com', 'TECHNICIAN', '2024-06-01', 'INACTIVE'),
  ]
}

const invitation = (id: number, email: string, role: Invitation['role'], status: Invitation['status'], sent: string, expires: string, hint: Invitation['accountHint']): Invitation =>
  ({ id, email, role, status, createdAt: sent, lastSentAt: sent, expiresAt: expires, validityDays: 7, version: 1, accountHint: hint })

/** Hai lời mời đang chờ như Figma, cùng sáu lời mời đã chấp nhận, một hết hạn và một đã hủy. */
export function seedYenBaiInvitations(): Invitation[] {
  const accepted = seedYenBaiMembers().slice(1).map((item, index) => invitation(3 + index, item.email, item.role as Invitation['role'], 'ACCEPTED', item.joinedAt, item.joinedAt, 'HAS_ACCOUNT'))
  return [
    invitation(1, 'dinhthuy.kt@gmail.com', 'TECHNICIAN', 'PENDING', '2026-10-17T08:10:00+07:00', '2026-10-24T08:10:00+07:00', 'NO_ACCOUNT'),
    invitation(2, 'quang.manager@gmail.com', 'MANAGER', 'PENDING', '2026-10-12T14:30:00+07:00', '2026-10-19T14:30:00+07:00', 'HAS_ACCOUNT'),
    ...accepted,
    invitation(9, 'cu.kt@gmail.com', 'TECHNICIAN', 'EXPIRED', '2026-08-02T09:00:00+07:00', '2026-08-09T09:00:00+07:00', 'NO_ACCOUNT'),
    invitation(10, 'huy.qly@gmail.com', 'MANAGER', 'CANCELLED', '2026-09-05T10:00:00+07:00', '2026-09-12T10:00:00+07:00', 'HAS_ACCOUNT'),
  ]
}

/** Lời mời của Kỹ thuật viên Lê Thị Mai (Figma "Chấp nhận lời mời" và "Lời mời không còn hiệu lực"). */
export const samplePreview: InvitationPreview = {
  farmName: YEN_BAI, email: 'technician@beefcare.local', role: 'TECHNICIAN', status: 'PENDING', timeZone: 'Asia/Ho_Chi_Minh',
  sentAt: '2026-10-17T08:10:00+07:00', expiresAt: '2026-10-24T08:10:00+07:00', invitedBy: 'Nguyễn Văn Hùng', farmId: INVITED_FARM_ID,
}
