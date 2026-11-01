import { useRef, useState, type ChangeEvent } from 'react'
import readXlsxFile from 'read-excel-file'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Button, Table, Td, Th, Note } from '../../../components/ui'
import { parseEntryExcelRows, type EntryExcelPreviewRow } from '../data/entryExcel'
import { kg } from '../../../data/format'
import type { EntryCow } from '../../../types'
import { userFacingError } from '../../../api/userFacingError'

const TH = 'px-1! first:pl-3! last:pr-3!'

export type EntryBackendImportResult = {
  total?: number
  valid?: number
  warnings?: number
  errors?: number
  summary?: { message?: string }
  rows?: Array<{
    row?: number
    earTag?: string
    breed?: string
    sex?: string
    weight?: string | number
    pen?: string
    result?: string
    issues?: Array<{ message?: string; field?: string; severity?: string }>
  }>
}

type ExcelModalProps = {
  recordId: string
  onAdd: (cows: EntryCow[]) => void
  onClose: () => void
  onDownloadTemplate?: () => Promise<Blob>
  onBackendPreview?: (file: File) => Promise<EntryBackendImportResult>
  onBackendCommit?: (file: File) => Promise<EntryCow[]>
}

const backendRows = (result: EntryBackendImportResult): EntryExcelPreviewRow[] => (result.rows ?? []).map((row, index) => {
  const resultCode = String(row.result ?? '').toUpperCase()
  const tone = resultCode === 'ERROR' ? 'err' : resultCode === 'WARNING' ? 'warn' : 'ok'
  const issues = (row.issues ?? []).map((issue) => {
    const message = String(issue.message ?? '').trim()
    if (message) return message
    const field = String(issue.field ?? '').trim()
    const labels: Record<string, string> = {
      earTagNumber: 'Số thẻ tai',
      breed: 'Giống',
      sex: 'Giới tính',
      birthDate: 'Ngày sinh',
      birthDateAccuracy: 'Độ chính xác ngày sinh',
      lifeStage: 'Giai đoạn sinh trưởng',
      purposeId: 'Mục đích nuôi',
      entryWeightKg: 'Cân nhập (kg)',
      weightBasis: 'Cơ sở cân',
      penId: 'Chuồng nhận',
      unitPrice: 'Đơn giá',
      quarantineUntil: 'Ngày kết thúc cách ly',
    }
    return field ? `Vui lòng kiểm tra trường ${labels[field] ?? field}.` : ''
  }).filter(Boolean)
  const text = issues.length ? `${tone === 'err' ? 'Lỗi' : 'Cảnh báo'} · ${issues.join('; ')}` : tone === 'err' ? 'Lỗi' : tone === 'warn' ? 'Cảnh báo' : 'Hợp lệ'
  const sex = row.sex === 'MALE' ? 'Đực' : row.sex === 'FEMALE' ? 'Cái' : String(row.sex ?? '')
  const kg = Number(row.weight) || 0
  return { line: row.row ?? index + 2, tag: String(row.earTag ?? ''), breed: String(row.breed ?? ''), sex, kg, barn: String(row.pen ?? ''), result: { tone, text }, cow: null }
})

/** Nhập nhiều con từ tệp Excel. Chỉ các dòng ok/warn được thêm; onAdd(cows[]) nhận danh sách con. */
export default function ExcelModal({ recordId, onAdd, onClose, onDownloadTemplate, onBackendPreview, onBackendCommit }: ExcelModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<EntryExcelPreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [previewComplete, setPreviewComplete] = useState(false)
  const valid = rows.filter((r) => onBackendPreview ? r.result.tone !== 'err' : r.cow !== null)
  const bad = rows.length - valid.length
  const warn = rows.filter((r) => r.result.tone === 'warn').length

  const add = async () => {
    if (onBackendCommit) {
      if (!selectedFile) return
      setLoading(true)
      setLoadingLabel('Đang thêm dữ liệu vào phiếu…')
      setError('')
      try {
        onAdd(await onBackendCommit(selectedFile))
      } catch (nextError) {
        setError(userFacingError(nextError, 'Không thể nhập file Excel. Vui lòng kiểm tra tệp rồi thử lại.'))
      } finally {
        setLoading(false)
        setLoadingLabel('')
      }
      return
    }
    onAdd(valid.map((row) => row.cow).filter((cow): cow is EntryCow => cow !== null))
  }

  const downloadTemplate = async () => {
    if (!onDownloadTemplate) return
    if (loading) return
    setLoading(true)
    setLoadingLabel('Đang tải file mẫu…')
    setError('')
    try {
      const blob = await onDownloadTemplate()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'beefcare-entry-template.xlsx'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (nextError) {
      setError(userFacingError(nextError, 'Không thể tải file mẫu Excel. Vui lòng thử lại.'))
    } finally {
      setLoading(false)
      setLoadingLabel('')
    }
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setLoadingLabel('Đang kiểm tra file…')
    setError('')
    setRows([])
    setPreviewComplete(false)
    setFileName(file.name)
    setSelectedFile(file)
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Chỉ chấp nhận file có định dạng .xlsx.')
      if (file.size > 5 * 1024 * 1024) throw new Error('File Excel không được lớn hơn 5 MB.')
      if (onBackendPreview) {
        const preview = await onBackendPreview(file)
        setRows(backendRows(preview))
      } else {
        const sheet = await readXlsxFile(file, { sheet: 'Danh sách bò' })
        const parsed = parseEntryExcelRows(sheet)
        if (!parsed.length) throw new Error('File Excel chưa có dòng dữ liệu bò.')
        setRows(parsed)
      }
      setPreviewComplete(true)
    } catch (nextError) {
      setError(userFacingError(nextError, 'Không thể đọc file Excel. Vui lòng kiểm tra tệp rồi thử lại.'))
    } finally {
      setLoading(false)
      setLoadingLabel('')
      event.target.value = ''
    }
  }

  return (
    <Modal top={24} width={840} maxHeight="calc(100vh - 3rem)" title="Nhập danh sách bò từ Excel" sub={`Thêm nhiều con vào phiếu ${recordId} · chỉ dòng hợp lệ được thêm`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="m-0 text-[13px] font-semibold">1. Tải file mẫu</h3>
          {onDownloadTemplate ? <Button small disabled={loading} onClick={downloadTemplate}>Tải mẫu .xlsx</Button> : <a
            href="/templates/beefcare-herd-entry-template.xlsx"
            download
            className="whitespace-nowrap rounded border border-edge bg-white px-4 py-[9px] text-xs font-semibold text-[#212121]"
          >Tải mẫu .xlsx</a>}
          <span className="max-w-[380px] text-[11px] text-muted">Cột: Số thẻ tai · Giống · Giới tính · Ngày sinh · Độ chính xác · Cân · Cơ sở cân · Chuồng · Mục đích · Đơn giá</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-semibold">2. Chọn tệp</h3>
        <div className="flex items-center gap-2.5 rounded-xl border border-field bg-page px-3 py-2.5">
          <Badge>XLSX</Badge>
          <span className="text-xs font-semibold">
            {loading ? loadingLabel : fileName ? `${fileName}${rows.length ? ` · ${rows.length} dòng dữ liệu` : ''}` : 'Chưa chọn tệp'}
          </span>
          {loading && <ProcessingIndicator label={loadingLabel} />}
          <span className="flex-1" />
          <Button small disabled={loading} onClick={() => inputRef.current?.click()}>{fileName ? 'Đổi tệp' : 'Chọn tệp'}</Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            aria-label="Chọn file Excel nhập đàn"
            className="sr-only"
            onChange={chooseFile}
          />
        </div>
        {error && <Note tone="err">{error}</Note>}
      </div>

      {rows.length > 0 && <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-semibold">3. Kết quả kiểm tra</h3>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-edge">
        <Table stack={false}>
          <thead>
            <tr>
              <Th className={`${TH} w-[40px]`}>Dòng</Th>
              <Th className={`${TH} w-[70px]`}>Thẻ tai</Th>
              <Th className={`${TH} w-[130px]`}>Giống · giới tính</Th>
              <Th className={`${TH} w-[60px]`}>Cân</Th>
              <Th className={`${TH} w-[100px]`}>Chuồng</Th>
              <Th className={TH}>Kết quả</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line}>
                <Td className={TH}>{r.line}</Td>
                <Td className={TH}>{r.tag}</Td>
                <Td className={TH}>{`${r.breed} · ${r.sex}`}</Td>
                <Td className={`${TH} whitespace-nowrap`}>{kg(r.kg)}</Td>
                <Td className={`${TH} whitespace-nowrap`}>{IMPORT_BARN_NAME[r.barn]}</Td>
                <Td className={TH}><Badge tone={r.result.tone}>{r.result.text}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </div>
      </div>}

      {previewComplete && !loading && !error && rows.length === 0 && <Note tone="warn">
        File đã được kiểm tra nhưng chưa có dòng dữ liệu bò. Hãy chọn file có dữ liệu rồi tải lại.
      </Note>}

      {rows.length > 0 && <Note tone="info">
        {`${rows.length} dòng: ${valid.length} hợp lệ (${warn} cảnh báo) · ${bad} lỗi. Dòng lỗi không được thêm – sửa tệp rồi tải lại, hoặc thêm tay bằng "+ Thêm con". Tối đa 200 dòng.`}
      </Note>}

      <ModalFooter>
        <ModalButton disabled={loading} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!valid.length || loading} onClick={add}>{`Thêm ${valid.length} con vào phiếu`}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

function ProcessingIndicator({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" aria-label={label} className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-brand">
      <span aria-hidden="true" className="inline-block size-3.5 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

const IMPORT_BARN_NAME: Record<string, string> = { A1: 'A1 – Bò cái', A2: 'A2 – Bò cái', B1: 'B1 – Vỗ béo' }
