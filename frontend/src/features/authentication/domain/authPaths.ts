export const AUTH_PATH = {
  home: '/', signIn: '/dang-nhap', register: '/dang-ky', verification: '/xac-minh-email',
  forgot: '/quen-mat-khau', resetSent: '/kiem-tra-email', reset: '/dat-lai-mat-khau',
  invalid: '/lien-ket-khong-con-hieu-luc', suspended: '/tai-khoan-tam-ngung', loginFailed: '/dang-nhap-that-bai',
  terms: '/dieu-khoan-su-dung', policy: '/chinh-sach',
  acceptance: '/chap-nhan-dieu-khoan',
} as const

export const AUTH_PATHS = new Set<string>(Object.values(AUTH_PATH).filter((path) => path !== AUTH_PATH.home))
