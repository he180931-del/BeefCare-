export type AccountFieldKind = 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'checkbox' | 'radio'

export interface AccountFieldSpec {
  label: string
  kind?: AccountFieldKind
  required?: boolean
  placeholder?: string
  value?: string
  hint?: string
  readOnly?: boolean
  options?: string[]
  maxLength?: number
}

export const accountMembers = [
  { name: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', role: 'Chủ trại', status: 'Đang hoạt động', joined: '03/2024' },
  { name: 'Trần Quốc Long', email: 'manager@beefcare.local', role: 'Quản lý', status: 'Đang hoạt động', joined: '06/2024' },
  { name: 'Lê Minh An', email: 'technician@beefcare.local', role: 'Kỹ thuật viên', status: 'Ngừng hoạt động', joined: '01/2026' },
]

export const farmRows = [
  { name: 'Trại bò Ba Vì', address: 'Vật Lại, Hà Nội', role: 'Chủ trại', status: 'Đang hoạt động', statusCode: 'ACTIVE', herd: '328 con', service: 'Đến 31/12/2027' },
  { name: 'Trại vệ tinh Mộc Châu', address: 'Mường Sang, Sơn La', role: 'Quản lý', status: 'Chờ thanh toán', statusCode: 'PENDING_PAYMENT', herd: '86 con', service: 'Chưa có kỳ dịch vụ' },
  { name: 'Trại kỹ thuật Yên Bài', address: 'Yên Bài, Hà Nội', role: 'Kỹ thuật viên', status: 'Đang hoạt động', statusCode: 'ACTIVE', herd: '142 con', service: 'Đến 30/09/2027' },
  { name: 'Trại Hòa Bình', address: 'Lương Sơn, Hòa Bình', role: 'Chủ trại', status: 'Đã hết hạn', statusCode: 'EXPIRED', herd: '74 con', service: 'Hết hạn 15/10/2026' },
  { name: 'Trại thử nghiệm Sơn Tây', address: 'Sơn Tây, Hà Nội', role: 'Chủ trại', status: 'Tạm ngừng', statusCode: 'SUSPENDED', herd: '36 con', service: 'Tạm ngừng từ 28/10/2026' },
]

export type FarmMemberRole = 'Chủ trại' | 'Quản lý' | 'Kỹ thuật viên'
export type FarmAccessRow = typeof farmRows[number] & { role: FarmMemberRole }

/**
 * Local-preview membership boundary. It deliberately stays separate from the
 * farm catalogue: a farm's owner is not evidence that the signed-in user can
 * open it. Replace this adapter with the membership API when that endpoint is
 * connected.
 */
const activeMemberships: Record<FarmMemberRole, Array<{ farm: string; role: FarmMemberRole }>> = {
  'Chủ trại': [
    { farm: 'Trại bò Ba Vì', role: 'Chủ trại' },
    { farm: 'Trại Hòa Bình', role: 'Chủ trại' },
    { farm: 'Trại thử nghiệm Sơn Tây', role: 'Chủ trại' },
  ],
  'Quản lý': [{ farm: 'Trại bò Ba Vì', role: 'Quản lý' }],
  'Kỹ thuật viên': [{ farm: 'Trại kỹ thuật Yên Bài', role: 'Kỹ thuật viên' }],
}

export function farmsForMember(role: FarmMemberRole): FarmAccessRow[] {
  return activeMemberships[role].flatMap((membership) => {
    const farm = farmRows.find((candidate) => candidate.name === membership.farm)
    return farm ? [{ ...farm, role: membership.role }] : []
  })
}

export const serviceFarmRows = [
  { farm: 'Trại bò Ba Vì', owner: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', status: 'Đang hoạt động', coverage: '31/12/2027', suspended: 'Không', herd: '328' },
  { farm: 'Trại Mộc Châu', owner: 'Hoàng Thu Hà', email: 'ha@beefcare.local', status: 'Tạm ngừng', coverage: '30/06/2027', suspended: 'Có · 28/10/2026', herd: '146' },
  { farm: 'Trại Hòa Bình', owner: 'Phạm Văn Minh', email: 'minh@beefcare.local', status: 'Đã hết hạn', coverage: '15/10/2026', suspended: 'Không', herd: '74' },
  { farm: 'Trại mới Yên Bài', owner: 'Đỗ Thu Lan', email: 'lan@beefcare.local', status: 'Chờ thanh toán', coverage: '—', suspended: 'Không', herd: '0' },
]

export const invitationRows = [
  { email: 'an.nguyen@example.vn', hint: 'Đã có tài khoản', role: 'Kỹ thuật viên', sent: '01/11/2026 09:15', expires: '08/11/2026 09:15', status: 'Đang chờ' },
  { email: 'minh.tran@example.vn', hint: 'Chưa có tài khoản', role: 'Quản lý', sent: '28/10/2026 14:20', expires: '04/11/2026 14:20', status: 'Đã hết hạn' },
]

export const permissionRows = [
  { area: 'Hồ sơ bò và thẻ QR', owner: 'Quản lý', manager: 'Quản lý, trừ mục đích nuôi', technician: 'Chỉ xem' },
  { area: 'Chuồng và chuyển chuồng', owner: 'Quản lý', manager: 'Quản lý', technician: 'Chỉ xem' },
  { area: 'Phiếu nhập đàn và thanh toán', owner: 'Quản lý', manager: 'Quản lý', technician: 'Không truy cập' },
  { area: 'Tăng trưởng và thể trạng', owner: 'Chỉ xem', manager: 'Ghi nhận và điều chỉnh', technician: 'Chỉ xem' },
  { area: 'Tiêm phòng', owner: 'Chỉ xem', manager: 'Lập lịch và ghi nhận', technician: 'Chỉ xem' },
  { area: 'Sức khỏe và điều trị', owner: 'Chỉ xem', manager: 'Ghi nhận và điều chỉnh', technician: 'Chỉ xem' },
  { area: 'Sinh sản', owner: 'Chỉ xem', manager: 'Ghi nhận và điều chỉnh', technician: 'Chỉ xem' },
  { area: 'Danh mục và tham số', owner: 'Quản lý', manager: 'Chỉ xem', technician: 'Không truy cập' },
  { area: 'Thông báo trang trại', owner: 'Phát hành', manager: 'Phát hành', technician: 'Chỉ xem' },
  { area: 'Nhắc việc', owner: 'Xem và xử lý', manager: 'Xem và xử lý', technician: 'Xem và xử lý việc được giao' },
  { area: 'Báo cáo và tổng quan', owner: 'Xem đầy đủ', manager: 'Xem vận hành', technician: 'Xem giới hạn' },
  { area: 'Thành viên và vai trò', owner: 'Quản lý', manager: 'Xem danh sách', technician: 'Không truy cập' },
  { area: 'Xuất đàn', owner: 'Quản lý', manager: 'Quản lý', technician: 'Không truy cập' },
  { area: 'Thức ăn và kho', owner: 'Chỉ xem', manager: 'Quản lý', technician: 'Ghi nhận cấp phát' },
  { area: 'Gói dịch vụ', owner: 'Quản lý', manager: 'Không truy cập', technician: 'Không truy cập' },
  { area: 'Thông tin trang trại', owner: 'Quản lý', manager: 'Chỉ xem', technician: 'Chỉ xem' },
]

export const accountFields: Record<string, AccountFieldSpec[]> = {
  'SCR-12': [
    { label: 'Tên trang trại', required: true, value: 'Trại bò Ba Vì', maxLength: 150 },
    { label: 'Tỉnh / thành phố', kind: 'select', required: true, value: 'Hà Nội', options: ['Hà Nội', 'Sơn La', 'Hòa Bình'] },
    { label: 'Xã / phường', required: true, value: 'Vật Lại', maxLength: 150 },
    { label: 'Địa chỉ chi tiết', value: 'Thôn Yên Bài', maxLength: 255 },
    { label: 'Người liên hệ', required: true, value: 'Nguyễn Văn Hùng', maxLength: 100 },
    { label: 'Điện thoại', kind: 'tel', value: '0912 345 678' },
    { label: 'Thông tin giấy chứng nhận', kind: 'textarea', value: 'GCN-2024-118 · 12/03/2024', maxLength: 255 },
    { label: 'Múi giờ', kind: 'select', required: true, value: 'Asia/Ho_Chi_Minh', options: ['Asia/Ho_Chi_Minh'] },
    { label: 'Ca sáng bắt đầu', kind: 'time', value: '06:00' },
    { label: 'Ghi chú vận hành', kind: 'textarea', value: 'Ưu tiên kiểm tra chuồng sinh sản trước 07:00.', maxLength: 1000 },
  ],
  'SCR-08': [
    { label: 'Họ và tên', required: true, value: 'Nguyễn Văn Hùng', maxLength: 100 },
    { label: 'Số điện thoại', kind: 'tel', value: '0912 345 678' },
  ],
  'SCR-02': [
    { label: 'Email', kind: 'email', required: true, placeholder: 'ten@trangtrai.vn' },
    { label: 'Mật khẩu', kind: 'password', required: true, placeholder: 'Nhập mật khẩu' },
    { label: 'Ghi nhớ đăng nhập', kind: 'checkbox', hint: 'Giữ phiên tối đa 30 ngày trên thiết bị này.' },
  ],
  'SCR-03': [
    { label: 'Họ và tên', required: true, maxLength: 100 },
    { label: 'Email', kind: 'email', required: true },
    { label: 'Mật khẩu', kind: 'password', required: true, hint: 'Từ 8 đến 128 ký tự và không trùng email.' },
    { label: 'Xác nhận mật khẩu', kind: 'password', required: true },
    { label: 'Tôi đồng ý với Điều khoản sử dụng và Chính sách dữ liệu', kind: 'checkbox', required: true },
  ],
  'SCR-05': [{ label: 'Email', kind: 'email', required: true }],
  'SCR-06': [
    { label: 'Email của liên kết', kind: 'email', value: 'owner@beefcare.local', readOnly: true },
    { label: 'Mật khẩu mới', kind: 'password', required: true, hint: 'Từ 8 đến 128 ký tự và không trùng email.' },
    { label: 'Xác nhận mật khẩu mới', kind: 'password', required: true },
  ],
  'SCR-07': [
    { label: 'Email đăng nhập', kind: 'email', value: 'owner@beefcare.local', readOnly: true, hint: 'Đã xác minh qua Google.' },
    { label: 'Họ và tên', required: true, value: 'Nguyễn Văn Hùng', maxLength: 100 },
    { label: 'Số điện thoại liên hệ', kind: 'tel', placeholder: '0912 345 678', hint: 'Thông tin liên hệ, không dùng để đăng nhập.' },
    { label: 'Tôi đồng ý với Điều khoản sử dụng và Chính sách dữ liệu', kind: 'checkbox', required: true },
  ],
  'SCR-09': [
    { label: 'Tài khoản', kind: 'email', value: 'owner@beefcare.local', readOnly: true },
    { label: 'Mật khẩu hiện tại', kind: 'password', required: true },
    { label: 'Mật khẩu mới', kind: 'password', required: true },
    { label: 'Xác nhận mật khẩu mới', kind: 'password', required: true },
  ],
  'SCR-11': [
    { label: 'Tên trang trại', required: true, maxLength: 150 },
    { label: 'Tỉnh / thành phố', kind: 'select', required: true, options: ['Hà Nội', 'Sơn La', 'Hòa Bình'] },
    { label: 'Xã / phường', required: true, maxLength: 150 },
    { label: 'Địa chỉ chi tiết', maxLength: 255 },
    { label: 'Người liên hệ', value: 'Nguyễn Văn Hùng', maxLength: 100 },
    { label: 'Điện thoại liên hệ', kind: 'tel', value: '0912345678' },
    { label: 'Thông tin giấy chứng nhận đăng ký', kind: 'textarea', maxLength: 255 },
    { label: 'Quy mô đàn dự kiến', kind: 'select', options: ['Dưới 50 con', '50–149 con', '150–300 con', 'Trên 300 con'] },
    { label: 'Giống nuôi chính', placeholder: 'Ví dụ: Zebu đỏ, Lai Sind', maxLength: 255 },
  ],
  'SCR-14': [
    { label: 'Lý do', kind: 'textarea', required: true, maxLength: 500, placeholder: 'Nêu rõ căn cứ tạm ngừng hoặc khôi phục', hint: 'Tối đa 500 ký tự.' },
  ],
  'SCR-16': [
    { label: 'Trang trại', value: 'Trại bò Ba Vì', readOnly: true },
    { label: 'Email người nhận', kind: 'email', required: true },
    { label: 'Vai trò', kind: 'radio', required: true, options: ['Quản lý', 'Kỹ thuật viên'] },
    { label: 'Hiệu lực lời mời', kind: 'select', required: true, options: ['3 ngày', '7 ngày', '14 ngày'], value: '7 ngày' },
  ],
  'SCR-18': [
    { label: 'Thành viên', value: 'Trần Quốc Long · manager@beefcare.local', readOnly: true },
    { label: 'Hành động', kind: 'select', required: true, options: ['Đổi vai trò', 'Ngừng hoạt động', 'Kích hoạt lại'] },
    { label: 'Vai trò mới', kind: 'select', required: true, options: ['Quản lý', 'Kỹ thuật viên'] },
    { label: 'Ngày hiệu lực', kind: 'date', required: true, value: '2026-11-03' },
    { label: 'Lý do', kind: 'textarea', required: true, maxLength: 500, hint: 'Tối đa 500 ký tự.' },
  ],
}
