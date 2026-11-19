import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HerdEntry, Pen } from '../../../src/types'

const apiState = vi.hoisted(() => ({
  entries: [] as HerdEntry[],
  details: {} as Record<string, HerdEntry>,
  getCalls: [] as string[],
  pens: [] as Pen[],
  calves: [] as unknown[],
  sellers: [] as Array<{ id: string; name: string; phone: string }>,
  saved: [] as unknown[],
}))

vi.mock('../../../src/features/herd-entry/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/features/herd-entry/api/index')>()
  return {
    ...actual,
    herdEntryApi: {
      ...actual.herdEntryApi,
      list: async () => structuredClone(apiState.entries),
      get: async (id: string) => {
        apiState.getCalls.push(id)
        const row = apiState.details[id] ?? apiState.entries.find((entry) => entry.id === id)
        if (!row) throw new Error(`Không tìm thấy phiếu nhập ${id}`)
        return structuredClone(row)
      },
    },
    pens: {
      ...actual.pens,
      list: async () => structuredClone(apiState.pens),
    },
    listPendingEntryCalves: async () => structuredClone(apiState.calves),
    listEntrySellers: async () => structuredClone(apiState.sellers),
    saveHerdEntry: async (input: unknown) => {
      apiState.saved.push(structuredClone(input))
      return input
    },
  }
})

import ImportNew from '../../../src/features/herd-entry/pages/ImportNew'

const pens: Pen[] = [
  { code: 'A1', name: 'A1 – Bò cái', count: 10, capacity: 30, status: 'ACTIVE', cows: [] },
  { code: 'A2', name: 'A2 – Bò cái', count: 12, capacity: 30, status: 'ACTIVE', cows: [] },
  { code: 'B1', name: 'B1 – Vỗ béo', count: 20, capacity: 50, status: 'ACTIVE', cows: [] },
  { code: 'B2', name: 'B2 – Đực giống', count: 3, capacity: 10, status: 'ACTIVE', cows: [] },
  { code: 'C1', name: 'C1 – Cách ly', count: 0, capacity: 10, status: 'ACTIVE', cows: [] },
  { code: 'A3', name: 'A3 – Bê theo mẹ', count: 5, capacity: 20, status: 'ACTIVE', cows: [] },
]

const sellers = [
  { id: 's1', name: 'Hộ ông Lê Văn C – Sơn Tây', phone: '0912 345 678' },
  { id: 's2', name: 'Trại giống Mộc Châu – Sơn La', phone: '0912 888 456' },
]

const existingEntry: HerdEntry = {
  id: 'PN-2026-0013',
  date: '2026-10-20',
  type: 'Mua ngoài',
  source: sellers[0].name,
  count: 1,
  status: 'Đã nhập',
}

function renderPage(url = '/herd-entry/new') {
  // Diagnostic guard: a broken test harness must fail before business assertions.
  if (!MemoryRouter || !ImportNew) throw new Error(`Invalid test harness: MemoryRouter=${typeof MemoryRouter}, ImportNew=${typeof ImportNew}`)
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[url]}>
      <ImportNew />
    </MemoryRouter>,
  )
}

async function waitForForm() {
  await screen.findByText('1. Thông tin phiếu')
}

function controlInField(label: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const labelNode = screen.getByText(label, { selector: 'label' })
  const field = labelNode.parentElement
  const control = field?.querySelector('input, select, textarea')
  if (!control) throw new Error(`Không tìm thấy control của trường ${label}`)
  return control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
}

beforeEach(() => {
  apiState.entries = [structuredClone(existingEntry)]
  apiState.details = {}
  apiState.getCalls = []
  apiState.pens = structuredClone(pens)
  apiState.calves = []
  apiState.sellers = structuredClone(sellers)
  apiState.saved = []
})

describe('Phiếu nhập mới — thông tin phiếu', () => {
  it('prices each line per kg by default and shows the voucher-level pricing basis', async () => {
    renderPage()
    await waitForForm()

    // Figma + SRS GBR-92: the voucher has one pricing basis for all lines, per kg by default.
    expect(screen.getByText('Cách tính giá')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theo kg' })).toBeInTheDocument()
    expect(screen.getByText('20.060.000')).toBeInTheDocument()
    expect(screen.getByText('24.225.000')).toBeInTheDocument()
  })

  it('tự sinh mã phiếu kế tiếp và không cho người dùng sửa mã', async () => {
    renderPage()
    await waitForForm()

    const code = controlInField('Mã phiếu') as HTMLInputElement
    expect(code).toHaveValue('PN-2026-0014')
    expect(code).toHaveAttribute('readonly')
  })

  it('cho phép nhập các trường đầu phiếu hiện có bằng bàn phím', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForForm()

    await user.selectOptions(controlInField('Nguồn / chủ bò cũ *'), 's2')
    await user.clear(screen.getByLabelText('Chọn ngày'))
    await user.type(screen.getByLabelText('Chọn ngày'), '2026-10-21')
    await user.clear(controlInField('Số giấy kiểm dịch'))
    await user.type(controlInField('Số giấy kiểm dịch'), 'KD-SL-2026-00871')
    await user.clear(controlInField('Người nhập'))
    await user.type(controlInField('Người nhập'), 'Nguyễn Văn Hùng')
    await user.clear(controlInField('Ghi chú khi nhận bò'))
    await user.type(controlInField('Ghi chú khi nhận bò'), 'Bò khỏe, nhận đủ số lượng')

    expect(controlInField('Nguồn / chủ bò cũ *')).toHaveValue('s2')
    expect(screen.getByLabelText('Chọn ngày')).toHaveValue('2026-10-21')
    expect(controlInField('Số giấy kiểm dịch')).toHaveValue('KD-SL-2026-00871')
    expect(controlInField('Người nhập')).toHaveValue('Nguyễn Văn Hùng')
    expect(controlInField('Ghi chú khi nhận bò')).toHaveValue('Bò khỏe, nhận đủ số lượng')
  })

  it('hiển thị loại nhập chỉ đọc và chỉ đổi loại bằng nút phân đoạn khi tạo mới', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForForm()

    const type = controlInField('Loại nhập') as HTMLInputElement
    expect(type).toHaveValue('Mua ngoài')
    expect(type).toHaveAttribute('readonly')

    await user.click(screen.getByRole('button', { name: 'Bê sinh tại trại' }))

    const calfType = await screen.findByDisplayValue('Bê sinh tại trại')
    expect(calfType).toHaveAttribute('readonly')
  })

  it('cung cấp tên truy cập cho các control theo đúng nhãn người dùng nhìn thấy', async () => {
    renderPage()
    await waitForForm()

    expect(screen.getByRole('textbox', { name: 'Mã phiếu' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Nguồn / chủ bò cũ' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Số giấy kiểm dịch' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Người nhập' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Ghi chú khi nhận bò' })).toBeInTheDocument()
  })

  it('hiển thị trường biển số xe và nhận được dữ liệu bàn phím', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForForm()

    const plate = screen.getByRole('textbox', { name: 'Biển số xe' })
    await user.type(plate, '29C-118.46')

    expect(plate).toHaveValue('29C-118.46')
  })

  it('áp dụng giới hạn ký tự theo SCR-24', async () => {
    renderPage()
    await waitForForm()

    expect(screen.getByRole('textbox', { name: 'Số giấy kiểm dịch' })).toHaveAttribute('maxlength', '50')
    expect(screen.getByRole('textbox', { name: 'Biển số xe' })).toHaveAttribute('maxlength', '20')
    expect(screen.getByRole('textbox', { name: 'Ghi chú khi nhận bò' })).toHaveAttribute('maxlength', '1000')
  })

  it('cảnh báo nhưng vẫn cho xác nhận khi thiếu số giấy kiểm dịch', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForForm()

    await user.clear(controlInField('Số giấy kiểm dịch'))
    await user.click(screen.getByRole('button', { name: /Lưu & tạo hồ sơ/ }))

    await waitFor(() => expect(apiState.saved).toHaveLength(1))
    expect(screen.getByText(/chưa nhập số giấy kiểm dịch.*vẫn có thể lưu/i)).toBeInTheDocument()
    expect(apiState.saved[0]).toMatchObject({ record: { status: 'Đã nhập' } })
  })

  it('không xác nhận phiếu khi ngày nhập ở tương lai', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForForm()

    await user.clear(controlInField('Số giấy kiểm dịch'))
    await user.type(controlInField('Số giấy kiểm dịch'), 'KD-2026-100')
    await user.clear(screen.getByLabelText('Chọn ngày'))
    await user.type(screen.getByLabelText('Chọn ngày'), '2099-01-01')
    await user.click(screen.getByRole('button', { name: /Lưu & tạo hồ sơ/ }))

    expect(await screen.findByText(/ngày nhập.*không.*tương lai/i)).toBeInTheDocument()
    expect(apiState.saved).toHaveLength(0)
  })

  it('mở lại nháp với mã và toàn bộ dữ liệu đầu phiếu đã lưu', async () => {
    apiState.entries = [{
      id: 'PN-2026-0042',
      date: '2026-10-18',
      type: 'Mua ngoài',
      source: sellers[1].name,
      count: 0,
      status: 'Nháp',
      draft: {
        type: 'Mua ngoài',
        date: '2026-10-18',
        sourceId: 's2',
        quarantine: 'KD-SL-42',
        receiver: 'Nguyễn Văn Hùng',
        note: 'Nháp cần hoàn thiện',
        plate: '26C-045.12',
        cows: [],
      },
    }]

    renderPage('/herd-entry/new?id=PN-2026-0042')
    await waitForForm()

    expect(controlInField('Mã phiếu')).toHaveValue('PN-2026-0042')
    expect(controlInField('Nguồn / chủ bò cũ *')).toHaveValue('s2')
    expect(controlInField('Số giấy kiểm dịch')).toHaveValue('KD-SL-42')
    expect(controlInField('Người nhập')).toHaveValue('Nguyễn Văn Hùng')
    expect(controlInField('Ghi chú khi nhận bò')).toHaveValue('Nháp cần hoàn thiện')
    expect(screen.getByRole('textbox', { name: 'Biển số xe' })).toHaveValue('26C-045.12')
  })

  it('khóa loại nhập sau khi phiếu đã được lưu nháp lần đầu', async () => {
    const user = userEvent.setup()
    apiState.entries = [{
      id: 'PN-2026-0042',
      date: '2026-10-18',
      type: 'Mua ngoài',
      source: sellers[0].name,
      count: 0,
      status: 'Nháp',
      draft: { type: 'Mua ngoài', date: '2026-10-18', sourceId: 's1', cows: [] },
    }]

    renderPage('/herd-entry/new?id=PN-2026-0042')
    await waitForForm()
    const typeSwitch = screen.getByRole('button', { name: 'Bê sinh tại trại' })
    await user.click(typeSwitch)

    expect(typeSwitch).toBeDisabled()
    expect(controlInField('Loại nhập')).toHaveValue('Mua ngoài')
  })

  it('lưu nháp đầy đủ thông tin đầu phiếu nhưng không yêu cầu tạo hồ sơ bò', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForForm()

    await user.selectOptions(controlInField('Nguồn / chủ bò cũ *'), 's2')
    await user.clear(controlInField('Số giấy kiểm dịch'))
    await user.type(controlInField('Số giấy kiểm dịch'), 'KD-DRAFT-14')
    await user.type(screen.getByRole('textbox', { name: 'Biển số xe' }), '29C-999.99')
    await user.clear(controlInField('Người nhập'))
    await user.type(controlInField('Người nhập'), 'Trần Quốc Long')
    await user.clear(controlInField('Ghi chú khi nhận bò'))
    await user.type(controlInField('Ghi chú khi nhận bò'), 'Lưu để bổ sung bò sau')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    await waitFor(() => expect(apiState.saved).toHaveLength(1))
    const persisted = apiState.saved[0] as {
      record: { status: string; draft?: Record<string, unknown> }
      cattleRows?: unknown[]
    }
    expect(persisted.record.status).toBe('Nháp')
    expect(persisted.record.draft).toMatchObject({
      sourceId: 's2',
      quarantine: 'KD-DRAFT-14',
      plate: '29C-999.99',
      receiver: 'Trần Quốc Long',
      note: 'Lưu để bổ sung bò sau',
    })
    expect(persisted.cattleRows ?? []).toHaveLength(0)
  })
})
