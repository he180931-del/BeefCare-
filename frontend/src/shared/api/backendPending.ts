/**
 * Feature đã có giao diện và mock nhưng chưa nối API thật. Trong backend mode, adapter ném lỗi này
 * để màn hình báo rõ, không bao giờ âm thầm rơi về dữ liệu mock.
 */
export const backendPending = (what: string) => new Error(`Chưa tích hợp ${what} với backend.`)
