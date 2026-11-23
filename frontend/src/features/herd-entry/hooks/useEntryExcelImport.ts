import { useRef, useState, type ChangeEvent } from 'react'
import readXlsxFile from 'read-excel-file'
import { parseEntryExcelRows, type EntryExcelPreviewRow } from '../domain/entryExcel'
import type { EntryCow } from '../types'
import { herdEntryError } from '../api/herdEntryError'

export type EntryBackendImportResult = {
  total?: number; valid?: number; warnings?: number; errors?: number; summary?: { message?: string }
  rows?: Array<{ row?: number; earTag?: string; breed?: string; sex?: string; weight?: string | number; pen?: string; result?: string; issues?: Array<{ message?: string; field?: string; severity?: string }> }>
}
export type { EntryExcelPreviewRow }

type Options = {
  recordId: string; onAdd: (cows: EntryCow[]) => void; onDownloadTemplate?: () => Promise<Blob>
  onBackendPreview?: (file: File) => Promise<EntryBackendImportResult>; onBackendCommit?: (file: File) => Promise<EntryCow[]>
}

const backendRows = (result: EntryBackendImportResult): EntryExcelPreviewRow[] => (result.rows ?? []).map((row, index) => {
  const resultCode = String(row.result ?? '').toUpperCase()
  const tone = resultCode === 'ERROR' ? 'err' : resultCode === 'WARNING' ? 'warn' : 'ok'
  const issues = (row.issues ?? []).map((issue) => {
    const message = String(issue.message ?? '').trim()
    if (message) return message
    const field = String(issue.field ?? '').trim()
    const labels: Record<string, string> = { earTagNumber: 'Số thẻ tai', breed: 'Giống', sex: 'Giới tính', birthDate: 'Ngày sinh', birthDateAccuracy: 'Độ chính xác ngày sinh', lifeStage: 'Giai đoạn sinh trưởng', purposeId: 'Mục đích nuôi', entryWeightKg: 'Cân nhập (kg)', weightBasis: 'Cơ sở cân', penId: 'Chuồng nhận', unitPrice: 'Đơn giá', quarantineUntil: 'Ngày kết thúc cách ly' }
    return field ? `Vui lòng kiểm tra trường ${labels[field] ?? field}.` : ''
  }).filter(Boolean)
  const text = issues.length ? `${tone === 'err' ? 'Lỗi' : 'Cảnh báo'} · ${issues.join('; ')}` : tone === 'err' ? 'Lỗi' : tone === 'warn' ? 'Cảnh báo' : 'Hợp lệ'
  return { line: row.row ?? index + 2, tag: String(row.earTag ?? ''), breed: String(row.breed ?? ''), sex: row.sex === 'MALE' ? 'Đực' : row.sex === 'FEMALE' ? 'Cái' : String(row.sex ?? ''), kg: Number(row.weight) || 0, barn: String(row.pen ?? ''), result: { tone, text }, cow: null }
})

export function useEntryExcelImport({ recordId, onAdd, onDownloadTemplate, onBackendPreview, onBackendCommit }: Options) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<EntryExcelPreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [previewComplete, setPreviewComplete] = useState(false)
  const valid = rows.filter((row) => onBackendPreview ? row.result.tone !== 'err' : row.cow !== null)
  const bad = rows.length - valid.length
  const warn = rows.filter((row) => row.result.tone === 'warn').length

  const add = async () => {
    if (onBackendCommit) {
      if (!selectedFile) return
      setLoading(true); setLoadingLabel('Đang thêm dữ liệu vào phiếu…'); setError('')
      try { onAdd(await onBackendCommit(selectedFile)) } catch (nextError) { setError(herdEntryError(nextError, 'Không thể nhập file Excel. Vui lòng kiểm tra tệp rồi thử lại.')) } finally { setLoading(false); setLoadingLabel('') }
      return
    }
    onAdd(valid.map((row) => row.cow).filter((cow): cow is EntryCow => cow !== null))
  }

  const downloadTemplate = async () => {
    if (!onDownloadTemplate || loading) return
    setLoading(true); setLoadingLabel('Đang tải file mẫu…'); setError('')
    try {
      const blob = await onDownloadTemplate(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'beefcare-entry-template.xlsx'; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
    } catch (nextError) { setError(herdEntryError(nextError, 'Không thể tải file mẫu Excel. Vui lòng thử lại.')) } finally { setLoading(false); setLoadingLabel('') }
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    setLoading(true); setLoadingLabel('Đang kiểm tra file…'); setError(''); setRows([]); setPreviewComplete(false); setFileName(file.name); setSelectedFile(file)
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Chỉ chấp nhận file có định dạng .xlsx.')
      if (file.size > 5 * 1024 * 1024) throw new Error('File Excel không được lớn hơn 5 MB.')
      if (onBackendPreview) setRows(backendRows(await onBackendPreview(file)))
      else {
        const sheet = await readXlsxFile(file, { sheet: 'Danh sách bò' }); const parsed = parseEntryExcelRows(sheet)
        if (!parsed.length) throw new Error('File Excel chưa có dòng dữ liệu bò.')
        setRows(parsed)
      }
      setPreviewComplete(true)
    } catch (nextError) { setError(herdEntryError(nextError, 'Không thể đọc file Excel. Vui lòng kiểm tra tệp rồi thử lại.')) } finally { setLoading(false); setLoadingLabel(''); event.target.value = '' }
  }

  return { inputRef, rows, fileName, error, loading, loadingLabel, previewComplete, valid, bad, warn, add, downloadTemplate, chooseFile }
}
