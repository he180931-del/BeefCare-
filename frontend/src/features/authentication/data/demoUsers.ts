import type { SessionUser } from '../../authorization'

const DEMO_FARM = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
const NO_FARM = { farmId: null, farmName: null }

/** Tài khoản của chế độ mock (`npm run dev:mock`), mỗi tài khoản một vai trò để xem đủ các màn hình. */
export const DEMO_USERS: ReadonlyArray<SessionUser & { label: string }> = [
  { label: 'Chủ trại', role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...DEMO_FARM },
  { label: 'Quản lý', role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...DEMO_FARM },
  { label: 'Kỹ thuật viên', role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'technician@beefcare.local', ...DEMO_FARM },
  { label: 'CS', role: 'CS', fullName: 'Phạm Thu Hà', email: 'cs@beefcare.local', ...NO_FARM },
  { label: 'PM', role: 'PM', fullName: 'Đỗ Minh Quân', email: 'pm@beefcare.local', ...NO_FARM },
  { label: 'SA', role: 'SA', fullName: 'Vũ Hoàng Nam', email: 'sa@beefcare.local', ...NO_FARM },
]

/** Client mô phỏng nhận mọi mật khẩu khác rỗng; trang đăng nhập điền sẵn giá trị này khi chọn nhanh tài khoản. */
export const DEMO_PASSWORD = 'mock-demo'

const STORAGE_KEY = 'beefcare:mock-user'

export const readMockUserEmail = () => sessionStorage.getItem(STORAGE_KEY)
export const writeMockUserEmail = (email: string | null) => {
  if (email) sessionStorage.setItem(STORAGE_KEY, email)
  else sessionStorage.removeItem(STORAGE_KEY)
}

/** Tài khoản mẫu của một vai trò (mặc định Chủ trại). */
export const demoUserForRole = (role: SessionUser['role']): SessionUser => demoUserFor(DEMO_USERS.find((item) => item.role === role)?.email ?? null)

export function demoUserFor(email: string | null): SessionUser {
  const { label: _label, ...user } = DEMO_USERS.find((item) => item.email === email) ?? DEMO_USERS[0]
  return user
}
