import { describe, expect, it } from 'vitest'
import { landingRouteForRole, navigationForRole } from '../../../src/app/navigation'

const names = (role: Parameters<typeof navigationForRole>[0]) => navigationForRole(role).flatMap((group) => group.items.map((item) => item.name))

describe('role navigation', () => {
  it('gives owners the complete farm workspace', () => {
    expect(names('owner')).toEqual(expect.arrayContaining(['Tổng quan', 'Đàn bò', 'Sinh sản', 'Báo cáo', 'Thông tin trại', 'Gói dịch vụ']))
  })

  it('links primary herd workspaces directly to their preview screens', () => {
    const byName = Object.fromEntries(navigationForRole('owner').flatMap((group) => group.items.map((item) => [item.name, item.to])))
    expect(byName['Đàn bò']).toBe('/ui/scr-26')
    expect(byName['Chuồng trại']).toBe('/ui/scr-22')
    expect(byName['Xuất đàn']).toBe('/ui/scr-69')
  })

  it('keeps owner-only farm actions away from managers', () => {
    expect(names('manager')).not.toContain('Gói dịch vụ')
    expect(names('manager')).not.toContain('Thông tin trại')
    expect(names('manager')).toContain('Xuất đàn')
  })

  it('provides a task-first technician workspace', () => {
    expect(names('technician')).toEqual(expect.arrayContaining(['Hôm nay', 'Đàn bò', 'Quét QR', 'Sinh sản', 'Khẩu phần hôm nay', 'Thông báo']))
    expect(landingRouteForRole('technician')).toBe('/ui/scr-104')
  })

  it('provides distinct platform workspaces', () => {
    expect(names('cs')).toEqual(expect.arrayContaining(['Hàng đợi hỗ trợ', 'Công việc được giao']))
    expect(names('pm')).toEqual(expect.arrayContaining(['Đăng ký dịch vụ', 'Thanh toán & đối soát', 'Báo cáo tiền mặt']))
    expect(names('sa')).toEqual(expect.arrayContaining(['Tài khoản người dùng', 'Quyền nhân sự', 'Nhật ký kiểm tra']))
    expect(landingRouteForRole('cs')).toBe('/ui/scr-96')
    expect(landingRouteForRole('pm')).toBe('/ui/scr-90')
    expect(landingRouteForRole('sa')).toBe('/ui/scr-20')
  })
})
