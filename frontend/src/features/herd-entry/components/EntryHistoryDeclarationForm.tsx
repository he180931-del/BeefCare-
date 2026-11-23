import { useState } from 'react'
import { Field, Modal, ModalButton, ModalFooter, Note, Table, Td, Th } from '../../../shared/ui'
import { RadioRow } from './parts'
import { entryToday } from '../validation/entryValidation'
import type { EntryVaccineOption } from '../api/herdEntryBackendApi'
import type { EntryHistory } from '../domain/entryHistory'

const TH = 'px-1! first:pl-3! last:pr-3!'
const compactInputCls = 'box-border min-w-0 w-full rounded-lg border border-field bg-white px-1.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand read-only:bg-page read-only:text-muted sm:px-2 sm:py-2 sm:text-[13px]'
const HIST_OPTIONS = ['Có', 'Không', 'Không rõ']
type HistoryDetail = 'vaccine' | 'disease' | 'repro'

/** Shared declaration controls for draft rows and posted-entry corrections. */
export default function EntryHistoryDeclarationForm({ value, sex, vaccines = [], showReproduction = true, onChange, onError }: {
  value: EntryHistory; sex: string; vaccines?: EntryVaccineOption[]; showReproduction?: boolean;
  onChange: (patch: Partial<EntryHistory>) => void; onError?: (message: string | null) => void
}) {
  const c = { hist: value, sex }
  const [validationError, setError] = useState<string | null>(null)
  const setValidationError = (message: string | null) => { setError(message); onError?.(message) }
  const [detailModal, setDetailModal] = useState<HistoryDetail | null>(null)
  const [detailDraft, setDetailDraft] = useState('')
  const [detailDate, setDetailDate] = useState('')
  const [detailSource, setDetailSource] = useState('')
  const [vaccineRows, setVaccineRows] = useState<Array<{ vaccineId?: number; vaccineName: string; date: string; source: string }>>([])
  const setHist = onChange
  const detailMeta: Record<HistoryDetail, { title: string; label: string; placeholder: string; value: string; type?: 'number' }> = {
    vaccine: { title: 'Chi tiết tiêm phòng', label: 'Loại vaccine', placeholder: 'Nhập tên vaccine nếu chưa có trong danh mục', value: c.hist.vaccineName ?? c.hist.vaccineNote ?? '' },
    disease: { title: 'Chi tiết bệnh đã biết', label: 'Mô tả bệnh', placeholder: 'Nhập mô tả bệnh đã biết', value: c.hist.diseaseNote ?? '' },
    repro: { title: 'Chi tiết sinh sản', label: 'Số tháng mang thai', placeholder: 'Nhập số tháng nếu đang mang thai', value: c.hist.pregnancyMonths == null ? '' : String(c.hist.pregnancyMonths), type: 'number' },
  }
  const openDetail = (kind: HistoryDetail) => {
    setDetailDraft(detailMeta[kind].value)
    setDetailDate(kind === 'vaccine' ? c.hist.vaccineDate ?? '' : '')
    setDetailSource(kind === 'vaccine' ? c.hist.vaccineSource ?? '' : kind === 'repro' ? c.hist.reproductionNote ?? '' : '')
    if (kind === 'vaccine') setVaccineRows((c.hist.vaccineItems?.length ? c.hist.vaccineItems : [{ vaccineId: c.hist.vaccineId, vaccineName: c.hist.vaccineName ?? c.hist.vaccineNote ?? '', vaccineDate: c.hist.vaccineDate ?? '', vaccineSource: c.hist.vaccineSource ?? '' }]).map((item) => ({ vaccineId: item.vaccineId, vaccineName: item.vaccineName ?? '', date: item.vaccineDate ?? '', source: item.vaccineSource ?? '' })))
    // The backend contract stores one disease declaration description string
    // (max 1,000 characters), so keep this editor as one textarea rather than
    // presenting a UI-only list that would be re-joined before submission.
    setDetailModal(kind)
  }
  const saveDetail = () => {
    if (!detailModal) return
    if (detailModal === 'repro') {
      const pregnantAtEntry = c.hist.pregnantAtEntry ?? 'UNKNOWN'
      const months = pregnantAtEntry === 'YES' && c.hist.pregnancyMonths != null ? Number(c.hist.pregnancyMonths) : undefined
      if (months != null && (!Number.isInteger(months) || months < 1 || months > 9)) return setValidationError('Số tháng mang thai phải từ 1 đến 9.')
      setHist({ pregnancyMonths: months, earlierCalvings: c.hist.earlierCalvings, pregnantAtEntry, reproductionNote: detailSource.slice(0, 1000) })
    } else if (detailModal === 'vaccine') {
      if (detailDate && detailDate > entryToday()) return setValidationError('Ngày tiêm không được ở tương lai.')
      const items = vaccineRows.filter((item) => item.vaccineName.trim() || item.vaccineId != null || item.date || item.source).map((item) => ({ vaccineId: item.vaccineId, vaccineName: item.vaccineName, vaccineDate: item.date, vaccineSource: item.source }))
      setHist({ vaccineDeclarationSource: c.hist.vaccineDeclarationSource ?? c.hist.vaccineSource ?? c.hist.vaccineNote ?? '', vaccineItems: items, vaccineId: items[0]?.vaccineId, vaccineName: items[0]?.vaccineName, vaccineDate: items[0]?.vaccineDate, vaccineSource: items[0]?.vaccineSource, vaccineNote: items[0]?.vaccineSource || items[0]?.vaccineName })
    } else setHist({ diseaseNote: detailDraft.trim().slice(0, 1000) })
    setValidationError(null)
    setDetailModal(null)
  }
  return <>
        <h3 className="m-0 text-sm font-semibold text-ink">Lịch sử trước nhập đàn</h3>
        <div className="overflow-hidden rounded border border-edge">
          <Table bordered={false} stack={false}>
            <thead>
              <tr>
                <Th className={`${TH} w-[110px]`}>Mục</Th>
                <Th className={`${TH} w-[260px]`}>Khai báo</Th>
                <Th className={TH}>Chi tiết</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className={TH}>Tiêm phòng</Td>
                <Td className={TH}><RadioRow name="vaccine" value={c.hist.vaccine} options={HIST_OPTIONS} onChange={(v) => setHist({ vaccine: v })} /></Td>
                <Td className={`${TH} max-w-[150px]`}><button type="button" aria-label="Chi tiết tiêm phòng" disabled={c.hist.vaccine !== 'Có'} onClick={() => openDetail('vaccine')} className="w-full max-w-[150px] cursor-pointer truncate rounded-lg border border-field bg-white px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-brand hover:bg-page disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-field disabled:hover:bg-white">{c.hist.vaccine === 'Có' && (c.hist.vaccineName?.trim() || c.hist.vaccineNote?.trim()) ? 'Chi tiết (đã nhập)' : 'Chi tiết'}</button></Td>
              </tr>
              <tr>
                <Td className={TH}>Bệnh đã biết</Td>
                <Td className={TH}><RadioRow name="disease" value={c.hist.disease} options={HIST_OPTIONS} onChange={(v) => setHist({ disease: v })} /></Td>
                <Td className={`${TH} max-w-[150px]`}><button type="button" aria-label="Chi tiết bệnh đã biết" disabled={c.hist.disease !== 'Có'} onClick={() => openDetail('disease')} className="w-full max-w-[150px] cursor-pointer truncate rounded-lg border border-field bg-white px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-brand hover:bg-page disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-field disabled:hover:bg-white">{c.hist.disease === 'Có' && c.hist.diseaseNote?.trim() ? 'Chi tiết (đã nhập)' : 'Chi tiết'}</button></Td>
              </tr>
              {showReproduction && <>
              <tr>
                <Td className={TH}>{c.sex === 'Cái' ? 'Sinh sản (bò cái)' : 'Sinh sản'}</Td>
                <Td className={TH}><RadioRow name="repro" value={c.hist.repro} options={HIST_OPTIONS} onChange={(v) => {
                  if (v === 'Có') {
                    setHist({ repro: v, pregnantAtEntry: c.hist.pregnantAtEntry ?? 'UNKNOWN' })
                  } else {
                    // Conditional reproduction details must not survive after
                    // the declaration is changed away from "Có".
                    setHist({ repro: v, pregnantAtEntry: v === 'Không' ? 'NO' : 'UNKNOWN', earlierCalvings: undefined, pregnancyMonths: undefined, reproductionNote: undefined })
                  }
                }} /></Td>
                <Td className={`${TH} max-w-[150px]`}><button type="button" aria-label="Chi tiết sinh sản" disabled={c.hist.repro !== 'Có'} onClick={() => openDetail('repro')} className="w-full max-w-[150px] cursor-pointer truncate rounded-lg border border-field bg-white px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-brand hover:bg-page disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-field disabled:hover:bg-white">{c.hist.repro === 'Có' && c.hist.pregnancyMonths != null ? 'Chi tiết (đã nhập)' : 'Chi tiết'}</button></Td>
              </tr>
              </>}
            </tbody>
          </Table>
        </div>
    {detailModal && (
      <Modal width={520} maxHeight="min(600px, calc(100vh - 2rem))" title={detailMeta[detailModal].title} sub="Nhập thông tin chi tiết cho khai báo này." onClose={() => setDetailModal(null)}>
        {detailModal === 'vaccine' ? <div className="flex min-h-0 flex-col gap-2">
          <div aria-label="Danh sách vaccine" role="region" className="max-h-[220px] min-h-0 overflow-y-auto overscroll-contain pr-1">
          <div className="flex flex-col gap-2">
          {vaccineRows.map((item, index) => <div key={index} className="grid items-end gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <Field label={index === 0 ? 'Loại vaccine' : undefined} id={`entry-history-vaccine-name-${index}`}>
              <input id={`entry-history-vaccine-name-${index}`} aria-label={index === 0 ? 'Tên vaccine tự do' : `Tên vaccine tự do ${index + 1}`} className={compactInputCls} maxLength={255} value={item.vaccineName} placeholder="Ví dụ: LMLM" onChange={(e) => { const next = [...vaccineRows]; next[index] = { ...item, vaccineId: undefined, vaccineName: e.target.value }; setVaccineRows(next) }} />
            </Field>
            {vaccines.length > 0 ? <Field label={index === 0 ? 'Chọn trong danh mục' : undefined} id={`entry-history-vaccine-catalogue-${index}`}><select id={`entry-history-vaccine-catalogue-${index}`} aria-label={`Chọn vaccine trong danh mục ${index + 1}`} className={compactInputCls} value={item.vaccineId == null ? '' : `id:${item.vaccineId}`} onChange={(e) => { const value = e.target.value; const next = [...vaccineRows]; const option = vaccines.find((entry) => String(entry.id) === value.slice(3)); next[index] = value ? { ...item, vaccineId: option?.id, vaccineName: option?.name ?? item.vaccineName } : { ...item, vaccineId: undefined }; setVaccineRows(next) }}><option value="">Không chọn</option>{item.vaccineId != null && !vaccines.some(vaccine => vaccine.id === item.vaccineId) && <option value={`id:${item.vaccineId}`}>{item.vaccineName} · Đã ngưng</option>}{vaccines.map((entry) => <option key={entry.id} value={`id:${entry.id}`}>{entry.code} · {entry.name}</option>)}</select></Field> : <span aria-hidden="true" />}
            <Field label={index === 0 ? 'Ngày tiêm' : undefined}><input aria-label={`Ngày tiêm ${index + 1}`} type="text" maxLength={10} placeholder="2026-03-01 hoặc 03/2026" className={compactInputCls} value={item.date} onChange={(e) => { const next = [...vaccineRows]; next[index] = { ...item, date: e.target.value }; setVaccineRows(next) }} /></Field>
            <Field label={index === 0 ? 'Nguồn thông tin' : undefined}><input aria-label={`Nguồn thông tin ${index + 1}`} className={compactInputCls} maxLength={255} value={item.source} placeholder="Ví dụ: sổ tiêm cũ" onChange={(e) => { const next = [...vaccineRows]; next[index] = { ...item, source: e.target.value }; setVaccineRows(next) }} /></Field>
            <button type="button" aria-label={`Xóa vaccine ${index + 1}`} className="h-8 cursor-pointer rounded border border-field px-2 text-xs text-danger hover:border-danger" onClick={() => setVaccineRows((rows) => rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [{ vaccineName: '', date: '', source: '' }])}>Xóa</button>
          </div>)}
          </div>
          </div>
          <button type="button" className="w-fit cursor-pointer rounded border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-page" onClick={() => setVaccineRows((rows) => [...rows, { vaccineName: '', date: '', source: '' }])}>+ Thêm vaccine</button>
        </div> : detailModal === 'disease' ? <div className="flex flex-col gap-2">
          <Field label="Mô tả bệnh" id="entry-history-disease">
            <textarea id="entry-history-disease" aria-label="Mô tả bệnh" rows={5} maxLength={1000} autoFocus className={`${compactInputCls} min-h-[120px] resize-y`} value={detailDraft} placeholder="Nhập mô tả bệnh đã biết" onChange={(e) => setDetailDraft(e.target.value)} />
          </Field>
          <p className="text-xs text-muted">Tối đa 1.000 ký tự.</p>
        </div> : detailModal === 'repro' ? <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số lứa đã đẻ trước nhập đàn" id="entry-history-earlier-calvings"><input id="entry-history-earlier-calvings" aria-label="Số lứa đã đẻ trước nhập đàn" type="number" min={0} max={15} className={compactInputCls} value={c.hist.earlierCalvings ?? ''} onChange={(e) => setHist({ earlierCalvings: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Đang mang thai" id="entry-history-pregnant"><select id="entry-history-pregnant" aria-label="Đang mang thai" className={compactInputCls} value={c.hist.pregnantAtEntry ?? 'UNKNOWN'} onChange={(e) => { const pregnantAtEntry = e.target.value; setHist({ pregnantAtEntry, ...(pregnantAtEntry !== 'YES' ? { pregnancyMonths: undefined } : {}) }) }}><option value="YES">Có</option><option value="NO">Không</option><option value="UNKNOWN">Không rõ</option></select></Field>
          <Field label="Số tháng mang thai" id="entry-history-pregnancy-months">
            <input
              id="entry-history-pregnancy-months"
              aria-label="Số tháng mang thai"
              type="number"
              min={1}
              max={9}
              disabled={c.hist.pregnantAtEntry !== 'YES'}
              className={`${compactInputCls} disabled:cursor-not-allowed disabled:bg-page disabled:text-muted`}
              value={c.hist.pregnancyMonths ?? ''}
              placeholder={c.hist.pregnantAtEntry === 'YES' ? 'Nhập 1–9 tháng' : 'Chỉ nhập khi đang mang thai'}
              onChange={(e) => setHist({ pregnancyMonths: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Mô tả bổ sung" id="entry-history-repro-note"><textarea id="entry-history-repro-note" aria-label="Mô tả bổ sung" rows={3} maxLength={1000} className={`${compactInputCls} resize-y`} value={detailSource} placeholder="Thông tin sinh sản bổ sung" onChange={(e) => setDetailSource(e.target.value)} /></Field>
        </div> : null}
        {validationError && <Note tone="err">{validationError}</Note>}
        <ModalFooter className="[&_button]:rounded-lg [&_button]:px-3 [&_button]:text-xs"><ModalButton onClick={() => setDetailModal(null)}>Hủy</ModalButton><ModalButton variant="primary" onClick={saveDetail}>Lưu chi tiết</ModalButton></ModalFooter>
      </Modal>
    )}
  </>
}
