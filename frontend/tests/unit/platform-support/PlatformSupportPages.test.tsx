import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { supportApi } from '../../../src/features/platform-support/api/supportApi'
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
  it('khóa gửi trùng và dùng version mới từ phản hồi cho tin nhắn kế tiếp', async () => {
    const user = userEvent.setup()
    const actor = { id: 1, name: 'Phạm Thu Hà', role: 'CS' as const }
    const initial = await supportDemoStore.getTicket(actor, 'TK-1042')
    let releaseFirst!: () => void
    const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve })
    const versions: Array<number | undefined> = []
    let replyCount = 0
    const replySpy = vi.spyOn(supportApi, 'reply').mockImplementation(async (_actor, _code, command) => {
      versions.push(command.expectedVersion)
      replyCount += 1
      if (replyCount === 1) await firstPending
      const version = initial.version + replyCount
      return {
        ...initial,
        version,
        updatedAt: `2026-11-18T07:0${replyCount}:00`,
        messages: [...initial.messages, {
          id: 99000 + replyCount,
          visibility: 'PUBLIC' as const,
          author: actor.name,
          authorRole: 'CS' as const,
          text: command.text,
          at: `2026-11-18T07:0${replyCount}:00`,
        }],
      }
    })

    try {
      renderAt('/nen-tang/ho-tro/TK-1042', 'CS', actor.id, actor.name)
      const input = await screen.findByLabelText('Trả lời công khai')
      const send = screen.getByRole('button', { name: /Gửi/ })

      await user.type(input, 'Phản hồi thứ nhất')
      await user.click(send)
      expect(send).toBeDisabled()

      releaseFirst()
      expect(await screen.findByText('Phản hồi thứ nhất')).toBeInTheDocument()
      await waitFor(() => expect(send).toBeEnabled())

      await user.type(input, 'Phản hồi thứ hai')
      await user.click(send)
      await waitFor(() => expect(versions).toEqual([initial.version, initial.version + 1]))
    } finally {
      replySpy.mockRestore()
    }
  })

  it('ưu tiên toàn bộ chiều cao cho hội thoại và neo xuống tin mới nhất khi đổi tab', async () => {
    const user = userEvent.setup()
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(720)

    try {
      renderAt('/nen-tang/ho-tro/TK-1042', 'CS', 1, 'Phạm Thu Hà')

      const viewport = await screen.findByRole('log', { name: 'Danh sách trao đổi' })
      await waitFor(() => expect(viewport.scrollTop).toBe(720))
      expect(screen.queryByRole('heading', { name: 'Yêu cầu nội bộ' })).not.toBeInTheDocument()

      viewport.scrollTop = 0
      await user.click(screen.getByRole('button', { name: 'Ghi chú nội bộ (nhân viên hỗ trợ)' }))
      await waitFor(() => expect(viewport.scrollTop).toBe(720))
    } finally {
      scrollHeight.mockRestore()
    }
  })

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
