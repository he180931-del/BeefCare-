export type ScreenId = `SCR-${string}`
export type ScreenRole = 'guest' | 'owner' | 'manager' | 'technician' | 'cs' | 'pm' | 'sa'
export type ScreenKind = 'page' | 'tab' | 'dialog'
export type ScreenArchetype = 'public' | 'list' | 'detail' | 'form' | 'dashboard' | 'report' | 'catalogue' | 'workbench' | 'mobile'
export type ScreenDataMode = 'backend' | 'fixture' | 'hybrid'

export interface ScreenDefinition {
  id: ScreenId
  feature: string
  viTitle: string
  roles: ScreenRole[]
  kind: ScreenKind
  archetype: ScreenArchetype
  route: string
  dataMode: ScreenDataMode
  parentId?: ScreenId
  figmaRef?: string
}

type ScreenSeed = Omit<ScreenDefinition, 'id' | 'route'> & { route?: string }

const GUEST: ScreenRole[] = ['guest']
const FARM: ScreenRole[] = ['owner', 'manager']
const FARM_ALL: ScreenRole[] = ['owner', 'manager', 'technician']
const OWNER: ScreenRole[] = ['owner']
const PLATFORM: ScreenRole[] = ['cs', 'pm', 'sa']

const seeds: ScreenSeed[] = [
  { feature: 'account', viTitle: 'Trang giới thiệu BeefCare', roles: GUEST, kind: 'page', archetype: 'public', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Đăng nhập', roles: GUEST, kind: 'page', archetype: 'public', dataMode: 'hybrid' },
  { feature: 'account', viTitle: 'Đăng ký Chủ trại', roles: GUEST, kind: 'page', archetype: 'form', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Xác minh email', roles: GUEST, kind: 'page', archetype: 'public', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Quên mật khẩu', roles: GUEST, kind: 'page', archetype: 'form', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Đặt mật khẩu mới', roles: GUEST, kind: 'page', archetype: 'form', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Hoàn thiện hồ sơ Chủ trại', roles: ['owner'], kind: 'page', archetype: 'form', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Hồ sơ và quyền của tôi', roles: FARM_ALL.concat(PLATFORM), kind: 'page', archetype: 'detail', dataMode: 'fixture' },
  { feature: 'account', viTitle: 'Đổi mật khẩu', roles: FARM_ALL.concat(PLATFORM), kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-08' },
  { feature: 'farm', viTitle: 'Chọn trang trại', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'farm', viTitle: 'Đăng ký trang trại', roles: OWNER, kind: 'page', archetype: 'form', dataMode: 'fixture' },
  { feature: 'farm', viTitle: 'Thông tin trang trại', roles: OWNER, kind: 'page', archetype: 'detail', dataMode: 'fixture' },
  { feature: 'farm', viTitle: 'Tổng quan dịch vụ trang trại', roles: ['pm'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'farm', viTitle: 'Tạm ngừng hoặc khôi phục dịch vụ', roles: ['pm'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-13' },
  { feature: 'membership', viTitle: 'Thành viên và vai trò', roles: FARM, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'membership', viTitle: 'Mời thành viên', roles: OWNER, kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-15' },
  { feature: 'membership', viTitle: 'Lời mời vào trang trại', roles: OWNER, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'membership', viTitle: 'Đổi vai trò hoặc ngừng thành viên', roles: OWNER, kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-15' },
  { feature: 'membership', viTitle: 'Chấp nhận lời mời', roles: GUEST.concat(FARM_ALL), kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-17' },
  { feature: 'platform-access', viTitle: 'Tài khoản người dùng', roles: ['sa'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'platform-access', viTitle: 'Quyền nhân sự nền tảng', roles: ['sa'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'pen-management', viTitle: 'Chuồng trại', roles: FARM_ALL, kind: 'page', archetype: 'list', route: '/pens', dataMode: 'fixture' },
  { feature: 'pen-management', viTitle: 'Tạo hoặc sửa chuồng', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-22' },
  { feature: 'pen-management', viTitle: 'Ngừng hoặc mở lại chuồng', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-22' },
  { feature: 'pen-management', viTitle: 'Chuyển chuồng cho bò', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'hybrid', parentId: 'SCR-22' },
  { feature: 'cattle', viTitle: 'Danh sách đàn bò', roles: FARM_ALL, kind: 'page', archetype: 'list', route: '/cattle', dataMode: 'fixture' },
  { feature: 'cattle', viTitle: 'Tổng quan hồ sơ bò', roles: FARM_ALL, kind: 'page', archetype: 'detail', route: '/cattle/:code', dataMode: 'backend' },
  { feature: 'cattle', viTitle: 'Lịch sử chuồng', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'hybrid', parentId: 'SCR-27' },
  { feature: 'cattle', viTitle: 'Thẻ QR của bò', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'hybrid', parentId: 'SCR-27' },
  { feature: 'cattle', viTitle: 'Cập nhật hồ sơ bò', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'backend', parentId: 'SCR-27' },
  { feature: 'cattle', viTitle: 'Cấp hoặc thay thẻ QR', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'hybrid', parentId: 'SCR-29' },
  { feature: 'cattle', viTitle: 'Quét mã QR', roles: FARM_ALL, kind: 'page', archetype: 'mobile', dataMode: 'fixture' },
  { feature: 'herd-entry', viTitle: 'Danh sách phiếu nhập đàn', roles: FARM, kind: 'page', archetype: 'list', route: '/herd-entry', dataMode: 'backend' },
  { feature: 'herd-entry', viTitle: 'Tạo phiếu nhập mua ngoài', roles: FARM, kind: 'page', archetype: 'form', route: '/herd-entry/new', dataMode: 'backend' },
  { feature: 'herd-entry', viTitle: 'Điều chỉnh hoặc hủy phiếu nhập', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'backend', parentId: 'SCR-33' },
  { feature: 'herd-entry', viTitle: 'Đăng ký bê sinh tại trại', roles: FARM, kind: 'page', archetype: 'form', dataMode: 'hybrid', parentId: 'SCR-33' },
  { feature: 'herd-entry', viTitle: 'Thông tin từng con trong phiếu nhập', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'backend', parentId: 'SCR-34' },
  { feature: 'announcement', viTitle: 'Thông báo trang trại', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'announcement', viTitle: 'Soạn thông báo', roles: FARM, kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-38' },
  { feature: 'announcement', viTitle: 'Xem lại và phát hành thông báo', roles: FARM_ALL, kind: 'page', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-38' },
  { feature: 'announcement', viTitle: 'Đính chính thông báo', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-38' },
  { feature: 'growth', viTitle: 'Cân nặng và thể trạng', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'growth', viTitle: 'Tăng trưởng và thể trạng của bò', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-27' },
  { feature: 'growth', viTitle: 'Ghi nhận cân nặng và BCS', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-42' },
  { feature: 'growth', viTitle: 'Sửa hoặc loại trừ số đo tăng trưởng', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-43' },
  { feature: 'vaccination', viTitle: 'Lịch tiêm phòng', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'vaccination', viTitle: 'Quản lý lịch tiêm', roles: ['manager'], kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-46' },
  { feature: 'vaccination', viTitle: 'Ghi nhận tiêm phòng', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-46' },
  { feature: 'vaccination', viTitle: 'Lịch sử tiêm của bò', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-27' },
  { feature: 'vaccination', viTitle: 'Hoãn mũi tiêm', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-46' },
  { feature: 'vaccination', viTitle: 'Lịch sử tiêm phòng', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'vaccination', viTitle: 'Sửa hoặc hủy bản ghi tiêm', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-51' },
  { feature: 'health', viTitle: 'Ca bệnh và điều trị', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'health', viTitle: 'Sức khỏe và điều trị của bò', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-27' },
  { feature: 'health', viTitle: 'Mở ca bệnh', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-53' },
  { feature: 'health', viTitle: 'Ghi nhận tái khám', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-53' },
  { feature: 'health', viTitle: 'Ghi nhận điều trị', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-53' },
  { feature: 'health', viTitle: 'Cập nhật hoặc đóng ca bệnh', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-53' },
  { feature: 'reproduction', viTitle: 'Danh sách công việc sinh sản', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'reproduction', viTitle: 'Hồ sơ sinh sản của bò', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-27' },
  { feature: 'reproduction', viTitle: 'Ghi nhận động dục', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-59' },
  { feature: 'reproduction', viTitle: 'Ghi nhận phối giống', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-59' },
  { feature: 'reproduction', viTitle: 'Sửa hoặc hủy động dục, phối giống', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-60' },
  { feature: 'reproduction', viTitle: 'Khám thai', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-59' },
  { feature: 'reproduction', viTitle: 'Cập nhật thai kỳ', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-60' },
  { feature: 'reproduction', viTitle: 'Ghi nhận sinh bê', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-59' },
  { feature: 'reproduction', viTitle: 'Sửa hoặc hủy kết quả khám thai', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-60' },
  { feature: 'reproduction', viTitle: 'Sửa hoặc hủy thai kỳ, sinh bê', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-60' },
  { feature: 'herd-exit', viTitle: 'Danh sách phiếu xuất đàn', roles: FARM, kind: 'page', archetype: 'list', route: '/herd-exit', dataMode: 'fixture' },
  { feature: 'herd-exit', viTitle: 'Tạo phiếu xuất đàn', roles: FARM, kind: 'page', archetype: 'form', route: '/herd-exit/new', dataMode: 'fixture' },
  { feature: 'herd-exit', viTitle: 'Phiếu xuất do chết hoặc thất lạc', roles: ['owner'], kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-69' },
  { feature: 'herd-exit', viTitle: 'Hủy phiếu xuất đàn', roles: ['owner'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-69' },
  { feature: 'reminder', viTitle: 'Nhắc việc trang trại', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'notification', viTitle: 'Thông báo của tôi', roles: OWNER, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'support', viTitle: 'Thông báo hỗ trợ', roles: ['cs', 'pm', 'sa'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'finance', viTitle: 'Thông báo đối soát', roles: ['pm'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'dashboard', viTitle: 'Tổng quan trang trại', roles: FARM, kind: 'page', archetype: 'dashboard', dataMode: 'fixture' },
  { feature: 'report', viTitle: 'Báo cáo quản trị', roles: FARM, kind: 'page', archetype: 'report', dataMode: 'fixture' },
  { feature: 'cattle', viTitle: 'Dòng thời gian hồ sơ bò', roles: FARM_ALL, kind: 'tab', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-27' },
  { feature: 'audit', viTitle: 'Lịch sử kiểm tra', roles: ['sa'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'catalogue', viTitle: 'Danh mục giống bò', roles: FARM_ALL, kind: 'page', archetype: 'catalogue', dataMode: 'fixture' },
  { feature: 'catalogue', viTitle: 'Danh mục vaccine', roles: FARM_ALL, kind: 'page', archetype: 'catalogue', dataMode: 'fixture' },
  { feature: 'catalogue', viTitle: 'Danh mục thuốc', roles: FARM_ALL, kind: 'page', archetype: 'catalogue', dataMode: 'fixture' },
  { feature: 'catalogue', viTitle: 'Danh mục mục đích nuôi', roles: FARM, kind: 'page', archetype: 'catalogue', dataMode: 'fixture' },
  { feature: 'catalogue', viTitle: 'Tham số trạng thái và nhắc việc', roles: FARM, kind: 'page', archetype: 'catalogue', dataMode: 'fixture' },
  { feature: 'subscription', viTitle: 'Gói dịch vụ trang trại', roles: OWNER, kind: 'page', archetype: 'detail', dataMode: 'fixture' },
  { feature: 'subscription', viTitle: 'Chọn kỳ hạn và xem lại đăng ký', roles: OWNER, kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-86' },
  { feature: 'subscription', viTitle: 'Hướng dẫn chuyển khoản', roles: OWNER, kind: 'page', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-87' },
  { feature: 'subscription', viTitle: 'Lịch sử và chi tiết thanh toán', roles: OWNER, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'platform-subscription', viTitle: 'Quản lý đăng ký dịch vụ', roles: ['pm'], kind: 'page', archetype: 'workbench', dataMode: 'fixture', parentId: 'SCR-13' },
  { feature: 'platform-finance', viTitle: 'Thanh toán và đối soát', roles: ['pm'], kind: 'page', archetype: 'workbench', dataMode: 'fixture', parentId: 'SCR-90' },
  { feature: 'platform-subscription', viTitle: 'Bảng giá gói dịch vụ', roles: ['pm'], kind: 'page', archetype: 'workbench', dataMode: 'fixture', parentId: 'SCR-90' },
  { feature: 'support', viTitle: 'Yêu cầu hỗ trợ của tôi', roles: OWNER, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'support', viTitle: 'Tạo yêu cầu hỗ trợ', roles: OWNER, kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-93' },
  { feature: 'support', viTitle: 'Chi tiết yêu cầu hỗ trợ', roles: OWNER, kind: 'page', archetype: 'detail', dataMode: 'fixture', parentId: 'SCR-93' },
  { feature: 'support', viTitle: 'Hàng đợi hỗ trợ', roles: ['cs'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'support', viTitle: 'Xử lý yêu cầu hỗ trợ', roles: ['cs'], kind: 'page', archetype: 'workbench', dataMode: 'fixture', parentId: 'SCR-96' },
  { feature: 'support', viTitle: 'Đóng yêu cầu hỗ trợ', roles: ['cs'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-97' },
  { feature: 'platform-work', viTitle: 'Công việc nội bộ được giao', roles: ['pm', 'sa'], kind: 'page', archetype: 'workbench', dataMode: 'fixture' },
  { feature: 'platform-finance', viTitle: 'Biên nhận đăng ký dịch vụ', roles: ['pm'], kind: 'page', archetype: 'list', dataMode: 'fixture', parentId: 'SCR-13' },
  { feature: 'platform-finance', viTitle: 'Sổ thu chi thủ công', roles: ['pm'], kind: 'page', archetype: 'workbench', dataMode: 'fixture', parentId: 'SCR-13' },
  { feature: 'platform-finance', viTitle: 'Tạo hoặc sửa bản ghi thu chi', roles: ['pm'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-101' },
  { feature: 'platform-finance', viTitle: 'Báo cáo tiền mặt nền tảng', roles: ['pm'], kind: 'page', archetype: 'report', dataMode: 'fixture', parentId: 'SCR-13' },
  { feature: 'technician', viTitle: 'Trang chủ kỹ thuật viên', roles: ['technician'], kind: 'page', archetype: 'mobile', dataMode: 'fixture' },
  { feature: 'herd-entry', viTitle: 'Nhập danh sách bò từ Excel', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'backend', parentId: 'SCR-34' },
  { feature: 'herd-entry', viTitle: 'Chi tiết phiếu nhập đàn', roles: FARM, kind: 'page', archetype: 'detail', route: '/herd-entry/:id', dataMode: 'backend', parentId: 'SCR-33' },
  { feature: 'payment', viTitle: 'Ghi nhận thanh toán phiếu', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'hybrid', parentId: 'SCR-106' },
  { feature: 'herd-entry', viTitle: 'Hủy phiếu nhập đàn', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'backend', parentId: 'SCR-106' },
  { feature: 'herd-exit', viTitle: 'Chọn bò để xuất đàn', roles: ['owner'], kind: 'dialog', archetype: 'list', dataMode: 'fixture', parentId: 'SCR-70' },
  { feature: 'herd-exit', viTitle: 'Chi tiết phiếu xuất đàn', roles: FARM, kind: 'page', archetype: 'detail', route: '/herd-exit/:id', dataMode: 'fixture', parentId: 'SCR-69' },
  { feature: 'feed', viTitle: 'Tồn kho thức ăn', roles: ['owner', 'manager'], kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'feed', viTitle: 'Phiếu nhập thức ăn', roles: FARM, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'feed', viTitle: 'Tạo hoặc sửa phiếu nhập thức ăn', roles: FARM, kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-112' },
  { feature: 'feed', viTitle: 'Điều chỉnh tồn kho', roles: FARM, kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-111' },
  { feature: 'feed', viTitle: 'Khẩu phần ăn', roles: ['owner', 'manager'], kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'feed', viTitle: 'Soạn khẩu phần', roles: FARM, kind: 'page', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-115' },
  { feature: 'feed', viTitle: 'Nhật ký cho ăn', roles: FARM_ALL, kind: 'page', archetype: 'list', dataMode: 'fixture' },
  { feature: 'feed', viTitle: 'Ghi nhận lần cho ăn', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-117' },
  { feature: 'feed', viTitle: 'Sửa hoặc hủy lần cho ăn', roles: ['manager'], kind: 'dialog', archetype: 'form', dataMode: 'fixture', parentId: 'SCR-117' },
  { feature: 'feed', viTitle: 'Danh mục thức ăn và nhà cung cấp', roles: FARM, kind: 'page', archetype: 'catalogue', dataMode: 'fixture' },
  { feature: 'feed', viTitle: 'Báo cáo tiêu thụ và chi phí thức ăn', roles: FARM, kind: 'page', archetype: 'report', dataMode: 'fixture' },
  { feature: 'feed', viTitle: 'Khẩu phần hôm nay', roles: ['technician'], kind: 'page', archetype: 'mobile', dataMode: 'fixture' },
]

export const SCREEN_MANIFEST: ScreenDefinition[] = seeds.map((seed, index) => ({
  ...seed,
  id: `SCR-${String(index + 1).padStart(2, '0')}` as ScreenId,
  route: seed.route ?? `/ui/scr-${String(index + 1).padStart(2, '0')}`,
}))

export function screenById(id: ScreenId): ScreenDefinition | undefined {
  return SCREEN_MANIFEST.find((screen) => screen.id === id)
}

export function screensForRole(role: ScreenRole): ScreenDefinition[] {
  return SCREEN_MANIFEST.filter((screen) => screen.roles.includes(role))
}
