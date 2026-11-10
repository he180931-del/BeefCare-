import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { supportDemoStore } from '../../../src/features/platform-support/data/supportDemoStore'
import InternalRequestRoutes from '../../../src/features/platform-support/pages/InternalRequestRoutes'
import SupportDeskRoutes from '../../../src/features/platform-support/pages/SupportDeskRoutes'

const session = (role: Session['role'], id?: number, fullName = 'Người dùng'): Session => ({ id, role, fullName, email: 'u@beefcare.vn', farmId: null, farmName: null, logout: async () => {} })

function renderAt(path: string, role: Session['role'] = 'CS', id?: number, fullName = 'Người dùng') {
  return render(
    <SessionContext.Provider value={session(role, id, fullName)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nen-tang/ho-tro/*" element={<SupportDeskRoutes />} />
          <Route path="/nen-tang/yeu-cau/*" element={<InternalRequestRoutes />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(async () => { await supportDemoStore.reset() })

describe('hàng đợi hỗ trợ', () => {
  it('lọc theo tab và nhận ticket rồi mở màn xử lý', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro')
    expect(await screen.findByText('Hiển thị 21 / 21 yêu cầu · chưa xử lý trước, rồi theo ưu tiên và thời gian tạo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chưa nhận 4' }))
    expect(await screen.findByText('Hiển thị 4 / 4 yêu cầu · chưa xử lý trước, rồi theo ưu tiên và thời gian tạo')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Nhận' })[0])
    expect(await screen.findByRole('heading', { name: /TK-10\d\d · / })).toBeInTheDocument()
    expect(await screen.findByText(/Bạn đang phụ trách TK-/)).toBeInTheDocument()
  })

  it('hiện lỗi khi không tải được hàng đợi', async () => {
    renderAt('/nen-tang/ho-tro?demo=load-error')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được hàng đợi hỗ trợ.')
  })
})

describe('xử lý ticket', () => {
  it('dùng đúng id tài khoản CS đang đăng nhập để mở quyền xử lý ticket đã nhận', async () => {
    renderAt('/nen-tang/ho-tro/TK-1027', 'CS', 2, 'Ngô Minh Khang')
    expect(await screen.findByRole('button', { name: 'Chuyển giao' })).toBeInTheDocument()
    expect(screen.getByText('Ngô Minh Khang (bạn)')).toBeInTheDocument()
    expect(screen.queryByText('Chỉ nhân viên hỗ trợ đang phụ trách mới được thay đổi yêu cầu này.')).not.toBeInTheDocument()
  })

  it('lưu ghi chú nội bộ trong hộp thoại', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro/TK-1042?m=ghi-chu')
    await user.type(await screen.findByLabelText('Ghi chú mới'), 'Cần xác minh mã chính xác.')
    await user.click(screen.getByRole('button', { name: /Lưu ghi chú/ }))
    expect(await screen.findByText('Đã thêm ghi chú nội bộ (chỉ nhân viên hỗ trợ thấy).')).toBeInTheDocument()
    expect((await supportDemoStore.getTicket({ id: 1, name: 'Phạm Thu Hà', role: 'CS' }, 'TK-1042')).messages.some((m) => m.text === 'Cần xác minh mã chính xác.')).toBe(true)
  })

  it('khóa ghi kết quả khi còn yêu cầu nội bộ đang mở', async () => {
    renderAt('/nen-tang/ho-tro/TK-1042?m=ghi-ket-qua')
    const dialog = await screen.findByRole('dialog', { name: 'Ghi kết quả giải quyết công khai' })
    expect(within(dialog).getByText(/IR-077 vẫn đang mở/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Gửi kết quả và Đã giải quyết/ })).toBeDisabled()
  })

  it('CS không phụ trách chỉ xem; ticket không tồn tại báo không tìm thấy', async () => {
    renderAt('/nen-tang/ho-tro/TK-1027')
    expect(await screen.findByText('Chỉ nhân viên hỗ trợ đang phụ trách mới được thay đổi yêu cầu này.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chuyển giao' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy yêu cầu nội bộ' })).toBeDisabled()
  })

  it('ticket không tồn tại', async () => {
    renderAt('/nen-tang/ho-tro/TK-9999')
    expect(await screen.findByText('Không tìm thấy yêu cầu TK-9999')).toBeInTheDocument()
  })
})

describe('yêu cầu nội bộ được giao', () => {
  it('SA gửi kết quả Ngoài phạm vi cho IR-081', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/yeu-cau/IR-081', 'SA')
    await screen.findByRole('heading', { name: /IR-081 · / })
    await user.click(screen.getByRole('button', { name: /Gửi kết quả & hoàn thành/ }))
    expect(await screen.findByText('Kết quả là bắt buộc.')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Ngoài phạm vi'))
    await user.type(screen.getByLabelText('Nội dung kết quả'), 'Không có thao tác đổi email Google trong phạm vi SA.')
    await user.click(screen.getByRole('button', { name: /Gửi kết quả & hoàn thành/ }))
    expect(await screen.findByRole('dialog', { name: 'IR-081 đã hoàn thành' })).toBeInTheDocument()
    await waitFor(async () => expect((await supportDemoStore.getAssigned({ id: 31, name: 'Vũ Hoàng Nam', role: 'SA' }, 'IR-081')).status).toBe('DONE'))
  })

  it('mã không có và mã không thuộc người xem', async () => {
    renderAt('/nen-tang/yeu-cau/IR-999', 'SA')
    expect(await screen.findByText('Không tìm thấy yêu cầu IR-999')).toBeInTheDocument()
  })

  it('IR của PM hiện thông báo không còn được giao khi SA mở', async () => {
    renderAt('/nen-tang/yeu-cau/IR-077', 'SA')
    expect(await screen.findByRole('dialog', { name: 'Yêu cầu không còn được giao cho bạn' })).toBeInTheDocument()
  })

  it('các mã SA mở từ thông báo đều hiện chi tiết', async () => {
    for (const code of ['IR-073', 'IR-076', 'IR-078']) {
      const { unmount } = renderAt(`/nen-tang/yeu-cau/${code}`, 'SA')
      expect(await screen.findByRole('heading', { name: new RegExp(`${code} · `) })).toBeInTheDocument()
      unmount()
    }
  })
})
