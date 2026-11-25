import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { demoUserForRole } from '../../../src/features/authentication/data/demoUsers'
import { supportApi } from '../../../src/features/platform-support/api/supportApi'
import { supportDemoStore } from '../../../src/features/platform-support/data/supportDemoStore'
import InternalRequestRoutes from '../../../src/features/platform-support/pages/InternalRequestRoutes'
import SupportDeskRoutes from '../../../src/features/platform-support/pages/SupportDeskRoutes'

const session = (role: Session['role'], id?: number, fullName = 'Người dùng'): Session => ({ id, role, fullName, email: 'u@beefcare.vn', farmId: null, farmName: null, logout: async () => {} })

function renderAt(path: string, role: Session['role'] = 'CS', id = role === 'PM' ? 21 : role === 'SA' ? 31 : 1, fullName = 'Người dùng') {
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
    expect(await screen.findByRole('button', { name: 'Chưa nhận 4' })).toBeInTheDocument()
    expect(screen.queryByText(/chưa xử lý trước, rồi theo ưu tiên và thời gian tạo/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chưa nhận 4' }))
    expect(screen.queryByText(/chưa xử lý trước, rồi theo ưu tiên và thời gian tạo/)).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Nhận' })[0])
    expect(await screen.findByRole('heading', { name: /TK-10\d\d · / })).toBeInTheDocument()
    expect(await screen.findByText(/Bạn đang phụ trách TK-/)).toBeInTheDocument()
  })

  it('hiện lỗi khi không tải được hàng đợi', async () => {
    renderAt('/nen-tang/ho-tro?demo=load-error')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được hàng đợi hỗ trợ.')
  })
})

describe('yêu cầu nội bộ trong phiên mock', () => {
  it('PM và SA có actor id ổn định để tải được danh sách được giao', async () => {
    for (const role of ['PM', 'SA'] as const) {
      const user = demoUserForRole(role)
      expect(user.id).toBeGreaterThan(0)
      const mounted = render(
        <SessionContext.Provider value={{ ...user, logout: async () => {} }}>
          <MemoryRouter initialEntries={['/nen-tang/yeu-cau']}>
            <Routes><Route path="/nen-tang/yeu-cau/*" element={<InternalRequestRoutes />} /></Routes>
          </MemoryRouter>
        </SessionContext.Provider>,
      )
      expect(await screen.findByRole('heading', { name: 'Yêu cầu nội bộ được giao' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Danh sách yêu cầu nội bộ' })).toHaveClass('max-h-[calc(100vh-260px)]', 'overflow-y-auto')
      mounted.unmount()
    }
  })
})

describe('xử lý ticket', () => {
  it('đặt trao đổi ở cột trái và thông tin xử lý ở cột phải từ màn hình desktop', async () => {
    renderAt('/nen-tang/ho-tro/TK-1042', 'CS', 1, 'Phạm Thu Hà')

    const workspace = await screen.findByTestId('cs-ticket-workspace')
    expect(workspace).toHaveClass('lg:grid-cols-[minmax(0,1fr)_336px]')
    expect(within(workspace).getByRole('heading', { name: 'Trao đổi' })).toBeInTheDocument()
    expect(within(workspace).getByRole('heading', { name: 'Xử lý' })).toBeInTheDocument()
    expect(within(workspace).getByRole('heading', { name: 'Thao tác được phép' })).toBeInTheDocument()
  })

  it('để CS hỏi thêm thông tin bằng chat thay vì một thao tác yêu cầu khách bổ sung riêng', async () => {
    renderAt('/nen-tang/ho-tro/TK-1029', 'CS', 1, 'Phạm Thu Hà')

    expect(await screen.findByLabelText('Trả lời công khai')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yêu cầu khách bổ sung' })).not.toBeInTheDocument()
  })

  it('cho CS xem trạng thái yêu cầu nội bộ từ nút dưới thao tác được phép', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro/TK-1042', 'CS', 1, 'Phạm Thu Hà')

    await user.click(await screen.findByRole('button', { name: 'Xem yêu cầu nội bộ' }))
    const list = await screen.findByRole('dialog', { name: 'Yêu cầu nội bộ' })
    expect(within(list).getByText('IR-077')).toBeInTheDocument()
    expect(within(list).getByText('Đỗ Minh Quân')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Mở yêu cầu nội bộ IR-077' }))
    const detail = await screen.findByRole('dialog', { name: 'Yêu cầu nội bộ IR-077' })
    expect(within(detail).getByText('Đang mở')).toBeInTheDocument()
    expect(within(detail).getByText(/Khách chuyển 1.200.000đ/)).toBeInTheDocument()
  })

  it('hiển thị lịch sử ticket theo thứ tự thời gian tăng dần với nhãn truy cập rõ ràng', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro/TK-1042', 'CS', 1, 'Phạm Thu Hà')

    await screen.findByRole('heading', { name: /TK-1042 · / })
    await user.click(screen.getByRole('button', { name: 'Lịch sử' }))

    const history = screen.getByRole('list', { name: 'Lịch sử ticket' })
    const events = within(history).getAllByRole('listitem')
    expect(events[0]).toHaveTextContent('Tạo ticket (Mới mở).')
    expect(events.at(-1)).toHaveTextContent('Tạo yêu cầu nội bộ IR-077')
  })

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

  it('cảnh báo và hủy yêu cầu nội bộ khi trả ticket về hàng đợi', async () => {
    const user = userEvent.setup()
    const actor = { id: 1, name: 'Phạm Thu Hà', role: 'CS' as const }
    renderAt('/nen-tang/ho-tro/TK-1042', 'CS', actor.id, actor.name)
    await user.click(await screen.findByRole('button', { name: 'Trả về hàng đợi' }))
    const dialog = await screen.findByRole('dialog', { name: 'Trả yêu cầu về hàng đợi' })
    expect(within(dialog).getByText(/Trả về hàng đợi đồng nghĩa hủy các yêu cầu nội bộ đang mở/)).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Lý do *'), 'Cần nhân viên hỗ trợ phù hợp hơn.')
    await user.click(within(dialog).getByRole('button', { name: 'Trả về hàng đợi' }))
    expect(await screen.findByText('Yêu cầu TK-1042 đã trả về hàng đợi.')).toBeInTheDocument()
    await waitFor(async () => expect((await supportDemoStore.getTicket(actor, 'TK-1042')).internalRequests.find((r) => r.code === 'IR-077')?.status).toBe('CANCELLED'))
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

  it('cảnh báo và hủy yêu cầu nội bộ khi đổi người nhận', async () => {
    const user = userEvent.setup()
    const actor = { id: 1, name: 'Phạm Thu Hà', role: 'CS' as const }
    renderAt('/nen-tang/ho-tro/TK-1019?ir=IR-082', 'CS', actor.id, actor.name)

    const reassign = await screen.findByRole('button', { name: 'Đổi người nhận yêu cầu nội bộ' })
    expect(reassign).toBeEnabled()
    await user.click(reassign)
    const dialog = await screen.findByRole('dialog', { name: 'Đổi người nhận IR-082' })
    await user.type(within(dialog).getByLabelText('Lý do *'), 'Người nhận cũ cần được thay thế.')
    expect(within(dialog).getByText(/Đổi người nhận đồng nghĩa hủy yêu cầu nội bộ IR-082/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Hủy để đổi người nhận' }))

    expect(await screen.findByText('Yêu cầu IR-082 đã được hủy để đổi người nhận.')).toBeInTheDocument()
    await waitFor(async () => expect((await supportDemoStore.getTicket(actor, 'TK-1019')).internalRequests.find((r) => r.code === 'IR-082')?.status).toBe('CANCELLED'))
  })

  it('cho phép hủy yêu cầu nội bộ đang Chờ CS bổ sung và vẫn chặn trạng thái kết thúc', async () => {
    const user = userEvent.setup()
    const actor = { id: 1, name: 'Phạm Thu Hà', role: 'CS' as const }
    renderAt('/nen-tang/ho-tro/TK-1019?ir=IR-082', 'CS', actor.id, actor.name)

    const cancel = await screen.findByRole('button', { name: 'Hủy yêu cầu nội bộ' })
    expect(cancel).toBeEnabled()
    await user.click(cancel)
    const dialog = await screen.findByRole('dialog', { name: 'Hủy yêu cầu nội bộ IR-082' })
    await user.type(within(dialog).getByLabelText('Lý do hủy *'), 'Yêu cầu không còn cần xử lý.')
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận hủy IR' }))

    expect(await screen.findByText('Yêu cầu IR-082 đã được hủy.')).toBeInTheDocument()
    await waitFor(async () => expect((await supportDemoStore.getTicket(actor, 'TK-1019')).internalRequests.find((r) => r.code === 'IR-082')?.status).toBe('CANCELLED'))
    expect(screen.getByRole('button', { name: 'Đổi người nhận yêu cầu nội bộ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hủy yêu cầu nội bộ' })).toBeDisabled()
    await expect(supportDemoStore.manageInternal(actor, 'TK-1019', 'IR-082', { action: 'REASSIGN', recipientId: 22, reason: 'Thử lại yêu cầu đã hủy.' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(supportDemoStore.manageInternal(actor, 'TK-1019', 'IR-082', { action: 'CANCEL', reason: 'Thử hủy lại yêu cầu đã hủy.' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('định tuyến yêu cầu nội bộ theo danh mục', () => {
  it('chọn PM và chỉ cho phép PM với ticket thanh toán', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro/TK-1042')

    await user.click(await screen.findByRole('button', { name: 'Tạo yêu cầu nội bộ' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạo yêu cầu nội bộ' })
    const role = within(dialog).getByLabelText('Vai trò đích *')

    expect(role).toHaveValue('PM')
    expect(within(role).getByRole('option', { name: 'Quản lý nền tảng' })).toBeInTheDocument()
    expect(within(role).queryByRole('option', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Ngữ cảnh được chia sẻ')).not.toBeInTheDocument()
  })

  it('chọn SA và chỉ cho phép SA với ticket truy cập tài khoản', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro/TK-1019')

    await user.click(await screen.findByRole('button', { name: 'Tạo yêu cầu nội bộ' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạo yêu cầu nội bộ' })
    const role = within(dialog).getByLabelText('Vai trò đích *')

    expect(role).toHaveValue('SA')
    expect(within(role).getByRole('option', { name: 'Quản trị hệ thống' })).toBeInTheDocument()
    expect(within(role).queryByRole('option', { name: 'Quản lý nền tảng' })).not.toBeInTheDocument()
  })

  it('cho phép CS chọn PM hoặc SA với ticket sử dụng hệ thống', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/ho-tro/TK-1021', 'CS', 3, 'Lê Thanh Tâm')

    await user.click(await screen.findByRole('button', { name: 'Tạo yêu cầu nội bộ' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạo yêu cầu nội bộ' })
    const role = within(dialog).getByLabelText('Vai trò đích *')

    expect(role).toHaveValue('SA')
    expect(within(role).getByRole('option', { name: 'Quản lý nền tảng' })).toBeInTheDocument()
    expect(within(role).getByRole('option', { name: 'Quản trị hệ thống' })).toBeInTheDocument()
  })
})

describe('yêu cầu nội bộ được giao', () => {
  it('PM chỉ nhận nội dung yêu cầu tối thiểu và tự tra cứu trong nghiệp vụ của mình', async () => {
    renderAt('/nen-tang/yeu-cau/IR-077', 'PM')

    expect(await screen.findByRole('heading', { name: /IR-077 · / })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'IR-077 · [Thanh toán] · Kiểm tra giao dịch SePay 09:05 18/10' })).toBeInTheDocument()
    expect(screen.getByText('Người dùng và trang trại')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn Hùng · Trại bò Yên Bài – Ba Vì')).toBeInTheDocument()
    expect(screen.queryByText('Đã chuyển khoản gia hạn nhưng chưa thấy xác nhận · Trại bò Yên Bài – Ba Vì')).not.toBeInTheDocument()
    expect(screen.queryByText('Câu hỏi từ nhân viên hỗ trợ · yêu cầu TK-1042')).not.toBeInTheDocument()
    expect(screen.queryByText('Phạm vi')).not.toBeInTheDocument()
    expect(screen.getByText('Phạm Thu Hà (Nhân viên hỗ trợ)')).toBeInTheDocument()
    expect(screen.queryByText('Nhân viên hỗ trợ Phạm Thu Hà · 18/10/2026 09:55')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở bàn đối soát' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Kết quả gửi cho nhân viên hỗ trợ phụ trách/)).not.toBeInTheDocument()
  })

  it('phân trang lịch sử yêu cầu nội bộ sau mỗi mười sự kiện', async () => {
    const user = userEvent.setup()
    const actor = { id: 21, name: 'Đỗ Minh Quân', role: 'PM' as const }
    const source = await supportDemoStore.getAssigned(actor, 'IR-077')
    const request = {
      ...source,
      history: Array.from({ length: 11 }, (_, index) => ({
        at: `2026-10-18T10:${String(index).padStart(2, '0')}:00`,
        actor: 'Lịch sử',
        text: `Sự kiện ${index + 1}`,
      })),
    }
    const listSpy = vi.spyOn(supportApi, 'listAssigned').mockResolvedValue([request])
    const getSpy = vi.spyOn(supportApi, 'getAssigned').mockResolvedValue(request)

    try {
      renderAt('/nen-tang/yeu-cau/IR-077', 'PM')
      const history = await screen.findByRole('list', { name: 'Lịch sử yêu cầu' })
      expect(within(history).getAllByRole('listitem')).toHaveLength(10)
      expect(screen.getByText('Hiển thị 10 / 11 sự kiện')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '2' }))
      expect(within(history).getAllByRole('listitem')).toHaveLength(1)
      expect(within(history).getByText(/Sự kiện 11/)).toBeInTheDocument()
    } finally {
      listSpy.mockRestore()
      getSpy.mockRestore()
    }
  })

  it('không hiển thị hộp giải thích trạng thái màu xanh khi yêu cầu đang mở', async () => {
    renderAt('/nen-tang/yeu-cau/IR-077', 'PM')

    expect(await screen.findByRole('heading', { name: /IR-077 · / })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /Đang mở.*Đỗ Minh Quân.*gửi kết quả/i })).not.toBeInTheDocument()
  })

  it('does not render the CS context link on the named-recipient screen', async () => {
    renderAt('/nen-tang/yeu-cau/IR-077', 'PM')

    expect(await screen.findByRole('heading', { name: /IR-077 · / })).toBeInTheDocument()
    expect(screen.getByText('Phạm Thu Hà (Nhân viên hỗ trợ)')).toBeInTheDocument()
    expect(screen.queryByText('Liên kết')).not.toBeInTheDocument()
    expect(screen.queryByText('Thanh toán SePay #843')).not.toBeInTheDocument()
  })

  it('PM thấy tab Chờ CS bổ sung và có thể yêu cầu NEED_MORE_INFO với ghi chú bắt buộc', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/yeu-cau', 'PM')
    await screen.findByRole('button', { name: /Chờ CS bổ sung 1/ })
    await user.click(screen.getByRole('button', { name: /Đang mở 2/ }))
    await user.click(screen.getByRole('button', { name: /IR-077/ }))
    expect(await screen.findByRole('heading', { name: /IR-077 · / })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Gửi kết quả & hoàn thành/ }))
    expect(await screen.findByText('Kết quả là bắt buộc.')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Cần bổ sung thông tin'))
    await user.click(screen.getByRole('button', { name: /Yêu cầu bổ sung thông tin/ }))
    expect(await screen.findByText('Nội dung cần bổ sung là bắt buộc.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nội dung cần bổ sung *'), 'Thiếu mã giao dịch và ảnh chứng từ.')
    await user.click(screen.getByRole('button', { name: /Yêu cầu bổ sung thông tin/ }))
    expect(await screen.findByRole('dialog', { name: 'IR-077 đã chờ CS bổ sung' })).toBeInTheDocument()
    await waitFor(async () => expect((await supportDemoStore.getAssigned({ id: 21, name: 'Đỗ Minh Quân', role: 'PM' }, 'IR-077')).status).toBe('WAITING_CS'))
  })

  it('CS không có thao tác yêu cầu bổ sung riêng', async () => {
    renderAt('/nen-tang/ho-tro/TK-1019?ir=IR-082', 'CS', 1, 'Phạm Thu Hà')
    await screen.findByRole('heading', { name: /TK-1019 · / })
    expect(screen.queryByRole('button', { name: 'Yêu cầu CS bổ sung' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Bổ sung thông tin cho IR-082/ })).not.toBeInTheDocument()
  })

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
    await waitFor(async () => expect(await supportDemoStore.getAssigned({ id: 31, name: 'Vũ Hoàng Nam', role: 'SA' }, 'IR-081')).toMatchObject({ status: 'DONE', outcome: 'OUT_OF_SCOPE', resultNote: 'Không có thao tác đổi email Google trong phạm vi SA.' }))
  })

  it('PM/SA nhận biểu mẫu kết quả theo bốn outcome target FE20', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/yeu-cau/IR-081', 'SA')
    await screen.findByRole('heading', { name: /IR-081 · / })
    await user.click(screen.getByRole('button', { name: /Gửi kết quả & hoàn thành/ }))
    expect(screen.getByLabelText('Đã xác nhận')).toBeInTheDocument()
    expect(screen.getByLabelText('Không xác nhận')).toBeInTheDocument()
    expect(screen.getByLabelText('Cần bổ sung thông tin')).toBeInTheDocument()
    expect(screen.getByLabelText('Ngoài phạm vi')).toBeInTheDocument()
    expect(screen.queryByLabelText('Đã thực hiện')).not.toBeInTheDocument()
  })

  it('hiển thị lịch sử yêu cầu theo thứ tự thời gian trong hộp thoại kết quả', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/yeu-cau/IR-081', 'SA')
    await screen.findByRole('heading', { name: /IR-081 · / })
    await user.click(screen.getByRole('button', { name: /Gửi kết quả & hoàn thành/ }))
    await user.click(await screen.findByLabelText('Ngoài phạm vi'))
    await user.type(screen.getByLabelText('Nội dung kết quả'), 'Không có thao tác đổi email Google trong phạm vi SA.')
    await user.click(screen.getByRole('button', { name: /Gửi kết quả & hoàn thành/ }))

    const dialog = await screen.findByRole('dialog', { name: 'IR-081 đã hoàn thành' })
    expect(within(dialog).getByText('Lịch sử yêu cầu')).toBeInTheDocument()
    expect(within(dialog).getByText(/Tạo yêu cầu IR-081 gửi Vũ Hoàng Nam/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Gửi kết quả và hoàn thành\./)).toBeInTheDocument()
  })

  it('popup kết quả chỉ hiển thị ghi chú, không hiển thị người hoàn thành hay thời điểm', async () => {
    renderAt('/nen-tang/yeu-cau/IR-073?m=hoan-thanh', 'SA')
    const detail = await screen.findByRole('heading', { name: /IR-073 · / })
    expect(detail).toBeInTheDocument()
    expect(screen.getByLabelText('Ghi chú kết quả đã lưu')).toHaveValue('Đã xử lý trong phạm vi.')
    expect(screen.queryByLabelText('Người hoàn thành / thời điểm')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Trạng thái / kết quả')).not.toBeInTheDocument()
    expect(screen.queryByText(/Đã gửi yêu cầu bổ sung cho nhân viên hỗ trợ/)).not.toBeInTheDocument()
  })

  it('nút về danh sách đóng popup và bỏ chọn yêu cầu hiện tại', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/yeu-cau/IR-073?m=hoan-thanh', 'SA')

    const dialog = await screen.findByRole('dialog', { name: 'IR-073 đã hoàn thành' })
    await user.click(within(dialog).getByRole('button', { name: 'Về danh sách được giao' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Chưa chọn yêu cầu')).toBeInTheDocument()
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
