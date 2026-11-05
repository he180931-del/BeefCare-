import { expandLocalTable, isStressGenerated, type StressGeneratedRow } from '../../../app/localStressData'
import { accountMembers, farmRows, invitationRows, serviceFarmRows } from './accountFixtures'

type AccountMember = typeof accountMembers[number]
type FarmRow = typeof farmRows[number]
type ServiceFarmRow = typeof serviceFarmRows[number]
type InvitationRow = typeof invitationRows[number]

const provinces = ['Hà Nội', 'Sơn La', 'Hòa Bình', 'Phú Thọ', 'Tuyên Quang', 'Nghệ An']
const districts = ['Ba Vì', 'Mộc Châu', 'Lương Sơn', 'Sơn Tây', 'Yên Bài', 'Thanh Sơn']

function previewIndex(row: StressGeneratedRow, fallback: number) {
  return (row.__stressIndex ?? fallback) + 1
}

/** Preview adapters only decorate generated rows; persisted fixture rows remain untouched. */
export function previewMembers(rows: AccountMember[]) {
  return expandLocalTable('account-members', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const role = value % 4 === 0 ? 'Quản lý' : 'Kỹ thuật viên'
    return {
      ...row,
      name: `${value % 2 ? 'Nguyễn' : 'Trần'} Thành viên ${String(value).padStart(3, '0')}`,
      email: `thanhvien.${String(value).padStart(3, '0')}@preview.beefcare.local`,
      role,
      status: value % 7 === 0 ? 'Ngừng hoạt động' : 'Đang hoạt động',
      joined: `${String((value % 12) + 1).padStart(2, '0')}/${2024 + (value % 3)}`,
    }
  })
}

export function previewFarms(rows: FarmRow[] = farmRows) {
  return expandLocalTable('account-farms', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const statusIndex = value % 10
    const status = statusIndex < 6 ? 'Đang hoạt động' : statusIndex < 8 ? 'Chờ thanh toán' : statusIndex === 8 ? 'Đã hết hạn' : 'Tạm ngừng'
    const statusCode = status === 'Đang hoạt động' ? 'ACTIVE' : status === 'Chờ thanh toán' ? 'PENDING_PAYMENT' : status === 'Đã hết hạn' ? 'EXPIRED' : 'SUSPENDED'
    return {
      ...row,
      name: `Trại ${districts[value % districts.length]} ${String(value).padStart(3, '0')}`,
      address: `${districts[(value + 2) % districts.length]}, ${provinces[value % provinces.length]}`,
      role: value % 5 === 0 ? 'Kỹ thuật viên' : value % 3 === 0 ? 'Quản lý' : 'Chủ trại',
      status,
      statusCode,
      herd: `${42 + (value * 17) % 360} con`,
      service: status === 'Đang hoạt động' ? `Đến 31/12/${2027 + value % 2}` : status === 'Chờ thanh toán' ? 'Chưa có kỳ dịch vụ' : status === 'Đã hết hạn' ? 'Hết hạn 15/10/2026' : 'Đang tạm ngừng',
    }
  })
}

export function previewServiceFarms(rows: ServiceFarmRow[] = serviceFarmRows) {
  return expandLocalTable('account-service-farms', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const status = value % 9 < 5 ? 'Đang hoạt động' : value % 9 < 7 ? 'Chờ thanh toán' : value % 9 === 7 ? 'Đã hết hạn' : 'Tạm ngừng'
    return {
      ...row,
      farm: `Trại ${districts[value % districts.length]} ${String(value).padStart(3, '0')}`,
      owner: `Chủ trại mô phỏng ${String(value).padStart(3, '0')}`,
      email: `chutrai.${String(value).padStart(3, '0')}@preview.beefcare.local`,
      status,
      coverage: status === 'Chờ thanh toán' ? '—' : `31/12/${2026 + value % 3}`,
      suspended: status === 'Tạm ngừng' ? 'Có · mô phỏng' : 'Không',
      herd: String(30 + (value * 19) % 420),
    }
  })
}

export function previewInvitations(rows: InvitationRow[]) {
  return expandLocalTable('account-invitations', rows).map((row, index) => {
    if (!isStressGenerated(row)) return row
    const value = previewIndex(row, index)
    const status = value % 6 < 3 ? 'Đang chờ' : value % 6 === 3 ? 'Đã chấp nhận' : value % 6 === 4 ? 'Đã hết hạn' : 'Đã hủy'
    return {
      ...row,
      email: `loimoi.${String(value).padStart(3, '0')}@preview.beefcare.local`,
      hint: value % 3 === 0 ? 'Đã có tài khoản' : 'Chưa có tài khoản',
      role: value % 4 === 0 ? 'Quản lý' : 'Kỹ thuật viên',
      sent: `${String((value % 28) + 1).padStart(2, '0')}/10/2026 09:15`,
      expires: `${String((value % 28) + 1).padStart(2, '0')}/11/2026 09:15`,
      status,
    }
  })
}
