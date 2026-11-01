import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ExcelModal from '../../../src/features/herd-entry/components/ExcelModal'
import { ENTRY_EXCEL_HEADERS, parseEntryExcelRows } from '../../../src/features/herd-entry/data/entryExcel'

describe('Nhập bò từ Excel', () => {
  it('cung cấp file mẫu chuẩn và control chọn tệp xlsx', () => {
    render(<ExcelModal recordId="PN-2026-0014" onAdd={vi.fn()} onClose={vi.fn()} />)

    const template = screen.getByRole('link', { name: 'Tải mẫu .xlsx' })
    expect(template).toHaveAttribute('href', '/templates/beefcare-herd-entry-template.xlsx')
    expect(template).toHaveAttribute('download')

    const fileInput = screen.getByLabelText('Chọn file Excel nhập đàn')
    expect(fileInput).toHaveAttribute('type', 'file')
    expect(fileInput).toHaveAttribute('accept', '.xlsx')
  })

  it('chuyển một dòng hợp lệ thành dữ liệu bò để thêm vào phiếu', () => {
    const result = parseEntryExcelRows([
      ENTRY_EXCEL_HEADERS,
      ['VN-0601', 'Bò 601', 'Lai Sind', 'Cái', '04/2025', 'Ước tính', 'Bò tơ', 'Bò sinh sản · loại Sinh sản', 60, 'Cân thực tế', 'A1', 85_000],
    ])

    expect(result).toHaveLength(1)
    expect(result[0].result).toEqual({ tone: 'ok', text: 'Hợp lệ' })
    expect(result[0].cow).toMatchObject({
      tag: 'VN-0601',
      name: 'Bò 601',
      breed: 'Lai Sind',
      sex: 'Cái',
      dob: '2025-04',
      dobAccuracy: 'Ước tính',
      weight: 60,
      estimated: false,
      barn: 'A1',
      unitPrice: 85_000,
    })
  })

  it('không nhận dòng sai cân nặng, giới tính và chuồng', () => {
    const result = parseEntryExcelRows([
      ENTRY_EXCEL_HEADERS,
      ['VN-0602', '', 'Lai Sind', 'Khác', '04/2025', 'Ước tính', 'Bò tơ', 'Nuôi thương phẩm · loại Vỗ béo', 0, 'Cân thực tế', 'Z9', 85_000],
    ])

    expect(result[0].cow).toBeNull()
    expect(result[0].result.tone).toBe('err')
    expect(result[0].result.text).toMatch(/giới tính/i)
    expect(result[0].result.text).toMatch(/cân nhập/i)
    expect(result[0].result.text).toMatch(/chuồng/i)
  })

  it('cảnh báo nhưng vẫn nhận dòng chưa có thẻ tai', () => {
    const result = parseEntryExcelRows([
      ENTRY_EXCEL_HEADERS,
      ['', '', 'Zebu', 'Cái', '10/2025', 'Không rõ', 'Chưa xác định', 'Chưa xác định', 198, 'Ước tính', 'C1', 80_000],
    ])

    expect(result[0].cow).not.toBeNull()
    expect(result[0].result).toEqual({ tone: 'warn', text: 'Cảnh báo · chưa có thẻ tai' })
  })

  it('dùng cùng tệp cho preview và commit backend rồi trả các dòng đã commit về biểu mẫu', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const preview = vi.fn().mockResolvedValue({
      rows: [{ row: 2, earTag: 'VN-0601', breed: 'Lai Sind', sex: 'FEMALE', weight: '320', pen: 'A1', result: 'VALID' }],
    })
    const committedCow = { tag: 'VN-0601', name: '', breed: 'Lai Sind', sex: 'Cái', dob: '', dobAccuracy: 'UNKNOWN', stage: 'ADULT', purpose: '', weight: 320, estimated: false, barn: 'A1', unitPrice: 85_000, hist: { vaccine: 'UNKNOWN', disease: 'UNKNOWN', repro: 'UNKNOWN' } }
    const commit = vi.fn().mockResolvedValue([committedCow])
    render(<ExcelModal recordId="PN-2026-0014" onAdd={onAdd} onClose={vi.fn()} onBackendPreview={preview} onBackendCommit={commit} />)
    const file = new File(['xlsx'], 'dan-bo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    await user.upload(screen.getByLabelText('Chọn file Excel nhập đàn'), file)
    await waitFor(() => expect(preview).toHaveBeenCalledWith(file))
    expect(screen.getByText('VN-0601')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Thêm 1 con vào phiếu/ }))

    await waitFor(() => expect(commit).toHaveBeenCalledWith(file))
    expect(onAdd).toHaveBeenCalledWith([committedCow])
  })

  it('từ chối tệp không phải xlsx trước khi gọi backend preview', async () => {
    const user = userEvent.setup()
    const preview = vi.fn()
    render(<ExcelModal recordId="PN-2026-0014" onAdd={vi.fn()} onClose={vi.fn()} onBackendPreview={preview} />)

    fireEvent.change(screen.getByLabelText('Chọn file Excel nhập đàn'), {
      target: { files: [new File(['csv'], 'dan-bo.csv', { type: 'text/csv' })] },
    })

    expect(await screen.findByText(/chỉ chấp nhận file.*\.xlsx/i)).toBeInTheDocument()
    expect(preview).not.toHaveBeenCalled()
  })

  it('từ chối tệp xlsx lớn hơn 5 MiB trước khi gọi backend preview', async () => {
    const user = userEvent.setup()
    const preview = vi.fn()
    render(<ExcelModal recordId="PN-2026-0014" onAdd={vi.fn()} onClose={vi.fn()} onBackendPreview={preview} />)
    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'dan-bo.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    )

    await user.upload(screen.getByLabelText('Chọn file Excel nhập đàn'), oversized)

    expect(await screen.findByText(/không được lớn hơn 5 MB/i)).toBeInTheDocument()
    expect(preview).not.toHaveBeenCalled()
  })
})
