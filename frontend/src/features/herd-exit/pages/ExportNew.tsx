import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Checkbox, DateInput, Field, Foot, Note, Segmented, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { useModalParam } from '../../../components/Modal'
import { BARNS, BUYERS, PAY_METHODS } from '../data/exitData'
import { EXPORT_HERD, TODAY } from '../data/exportsData'
import { dm, money } from '../../../data/format'
import { getExitDraftState, herdExitApi, saveHerdExit, pens } from '../api/index'
import { useMutation, useQuery } from '../../../hooks/useApi'
import { Box, CheckList, DocRow, Drop, MoneyInput, SummaryCard, TH, cx } from '../components/parts'
import PickModal from '../components/PickModal'
import type { HerdExit, ExitType } from '../../../types'

const TYPES: ExitType[] = ['Bán', 'Loại thải', 'Chết / mất', 'Khác']
const displayError = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error'
type HerdCow = { code: string; tag: string; breed: string; sex: string; age: string; group: string; stage: string; barn: string; weight: number; weightNote: string; estimated: boolean; unitPrice: number; withdrawalUntil?: string; openCase?: string }
const herdByCode = (code: string) => EXPORT_HERD.find((c) => c.code === code)

// Tải danh sách phiếu trước, rồi mới dựng form (form lấy phiếu Nháp làm giá trị ban đầu).
export default function ExportNew() {
  const [params] = useSearchParams()
  const { data: exports } = useQuery<HerdExit[]>(() => herdExitApi.list(), [])
  if (!exports) {
    return (
      <Layout title="Phiếu xuất mới">
        <p className="m-0 text-xs text-muted">Đang tải…</p>
      </Layout>
    )
  }
  return <ExportForm key={params.get('id') ?? 'new'} draftId={params.get('id')} exports={exports} />
}

function ExportForm({ exports, draftId }: { exports: HerdExit[]; draftId: string | null }) {
  const { mutate: persistExit, error: saveError } = useMutation(saveHerdExit)
  const nav = useNavigate()
  const [m, openModal, closeModal] = useModalParam()

  // Phiếu Nháp còn dở được tiếp tục sửa; không có thì lập phiếu mới.
  const draftState = draftId ? getExitDraftState(exports, draftId) : { type: 'Bán' as const, row: undefined }
  const draftRow = draftState.row
  const d = draftState
  const nextId = `PX-2026-${String(Math.max(0, ...exports.map((r) => Number(r.id.split('-')[2]) || 0)) + 1).padStart(4, '0')}`
  const id = draftRow?.id ?? nextId

  const [type, setType] = useState<ExitType>((d.type as ExitType | undefined) ?? 'Bán')
  const [date, setDate] = useState(d?.date ?? TODAY)
  const [buyerId, setBuyerId] = useState(d?.buyerId ?? BUYERS[0].id)
  const [quarantine, setQuarantine] = useState(d?.quarantine ?? '')
  const [plate, setPlate] = useState(d?.plate ?? '')
  const [note, setNote] = useState(d?.note ?? '')
  const [pricing, setPricing] = useState(d?.pricing ?? 'kg')
  const [picked, setPicked] = useState<HerdCow[]>(() => (d?.cows ?? []).map((c) => ({ ...herdByCode(c.code ?? ''), ...c, unitPrice: c.unitPrice ?? 0 } as unknown as HerdCow)))
  const [deduction, setDeduction] = useState(d?.deduction ?? 0)
  const [collected, setCollected] = useState(d?.collected ?? 0)
  const [method, setMethod] = useState(d?.method ?? PAY_METHODS[0])
  const [dueDate, setDueDate] = useState(d?.dueDate ?? TODAY)
  const [confirmed, setConfirmed] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const isSale = type === 'Bán'
  const buyer = BUYERS.find((b) => b.id === buyerId)
  const amount = (c: HerdCow) => (pricing === 'kg' ? c.weight * c.unitPrice : c.unitPrice)
  const withdrawal = picked.filter((c) => c.withdrawalUntil && date < c.withdrawalUntil)
  const totalWeight = picked.reduce((s, c) => s + c.weight, 0)
  const estimated = picked.filter((c) => c.estimated).length
  const cowsMoney = isSale ? picked.reduce((s, c) => s + amount(c), 0) : 0
  const receivable = Math.max(cowsMoney - deduction, 0)
  const remaining = Math.max(receivable - collected, 0)
  const barnDelta = BARNS.map((b) => ({ ...b, out: picked.filter((c) => c.barn === b.code).length })).filter((b) => b.out)

  const patch = (code: string, p: Partial<HerdCow>) => setPicked(picked.map((c) => (c.code === code ? { ...c, ...p } : c)))
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const save = async (status: 'Nháp' | 'Đã xuất') => {
    const record: Partial<HerdExit> = {
      date,
      type,
      who: isSale ? (buyer?.name ?? '') : note || type,
      sub: `${picked.length} con · chuồng ${[...new Set(picked.map((c) => c.barn))].join(', ')}`,
      count: picked.length,
      weight: `${money(totalWeight)} kg`,
      total: isSale ? receivable : null,
      due: isSale ? remaining : null,
      dueNote: status === 'Nháp' && isSale ? '(nháp)' : undefined,
      status,
      draft: {
        type, date, buyerId, quarantine, plate, note, pricing, deduction, collected, method, dueDate, docs: [],
        cows: picked.map((c) => ({ code: c.code, weight: c.weight, unitPrice: c.unitPrice, estimated: c.estimated })),
      },
    }
    if (status === 'Đã xuất') {
      record.draft = undefined
      record.detail = {
        quarantine, buyer: buyer?.name ?? '', phone: buyer?.phone ?? '', plate, by: `N. V. Hùng · ${date}`, note,
        cows: picked.map((c) => ({ code: c.code, tag: c.tag, breed: `${c.breed} · ${c.sex}`, weight: c.weight, barn: c.barn, amount: amount(c) })),
        cowsTotal: cowsMoney, deduction,
        payments: collected ? [{ date, by: 'N. V. Hùng', method, ref: '', amount: collected }] : [],
        docs: [{ ext: 'PDF', name: 'phieu-can-xuat-2210.pdf' }],
        history: [`${date} · N. V. Hùng xác nhận xuất ${picked.length} con`],
      }
    }
    await persistExit({ id: draftRow?.id ?? id, record, cattleRows: picked.map((cow) => ({ ...cow, barn: cow.barn })) })
    nav('/herd-exit')
  }

  return (
    <Layout title={`Phiếu xuất mới – ${type}`}>
      <div>
        <h1 className="m-0 text-[22px] font-bold">Phiếu xuất mới</h1>
        <p className="mb-0 mt-1 text-xs text-muted">Chỉ Chủ trại xác nhận · bò chuyển ĐÃ XUẤT sau khi xác nhận.</p>
      </div>
      <div>
        <Segmented value={type} onChange={(value) => setType(value as ExitType)} options={TYPES.map((t) => ({ value: t, label: t }))} />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_354px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Box title="1. Thông tin phiếu" gap="gap-[14px]">
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
              <Field label="Mã phiếu"><input className={inputCls} value={id} readOnly /></Field>
              <Field label="Ngày xuất *"><DateInput value={date} onChange={setDate} /></Field>
              <Field label="Loại xuất"><input className={inputCls} value={type} readOnly /></Field>
              {isSale && (
                <>
                  <Field label="Người mua / thương lái *" hint={`${buyer?.phone ?? ''} · + Thêm người mua`}>
                    <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="w-full">
                      {BUYERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Số giấy kiểm dịch vận chuyển"><input className={inputCls} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} /></Field>
                  <Field label="Biển số xe"><input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
                </>
              )}
            </div>
            <Field label={isSale ? 'Ghi chú' : 'Lý do *'}>
              <input className={inputCls} value={note} placeholder={isSale ? '' : 'Nhập lý do xuất'} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </Box>

          <Box
            title={`2. Danh sách bò trong phiếu (${picked.length} con)`}
            gap="gap-3"
            actions={
              <>
                <Button size="sm" onClick={() => showToast('Quét QR chưa hỗ trợ trong bản demo')}>Quét QR</Button>
                <Button size="sm" onClick={() => openModal('pick')}>+ Chọn bò</Button>
              </>
            }
          >
            {isSale && (
              <div className="flex flex-wrap items-center gap-3">
                <b className="text-xs">Cách tính giá *</b>
                  <Segmented value={pricing} onChange={(value) => setPricing(value as 'kg' | 'con')} options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]} />
                <span className="max-w-[330px] text-[11px] text-muted">Cân xuất mặc định = cân gần nhất (ước tính) · cân lại để ghi thực tế</span>
              </div>
            )}
            <Table>
              <thead>
                <tr>
                  <Th className={TH}>#</Th><Th className={TH}>Mã bò · thẻ tai</Th><Th className={TH}>Giống · giới tính</Th><Th className={TH}>Chuồng</Th>
                  <Th className={TH}>Cân xuất</Th>
                  {isSale && <><Th className={TH}>{pricing === 'kg' ? 'Đơn giá/kg' : 'Giá/con'}</Th><Th className={TH}>Thành tiền</Th></>}
                  <Th className={TH}>Kiểm tra</Th><Th className={TH} />
                </tr>
              </thead>
              <tbody>
                {picked.map((c, i) => {
                  const blocked = c.withdrawalUntil && date < c.withdrawalUntil
                  return (
                    <tr key={c.code}>
                      <Td className={TH}>{i + 1}</Td>
                      <Td className={cx(TH, 'whitespace-nowrap')}>{c.code}<br />{c.tag}</Td>
                      <Td className={TH}>{c.breed} · {c.sex}<br />{c.age} · {c.group}</Td>
                      <Td className={TH}>{c.barn}</Td>
                      <Td className={TH}>
                        <input
                          inputMode="numeric"
                          value={c.weight}
                          onChange={(e) => patch(c.code, { weight: Number(e.target.value.replace(/\D/g, '')) || 0, estimated: false })}
                          className="w-[4ch] border-0 bg-transparent p-0 text-xs outline-none focus:bg-chip"
                        />
                        {' kg'}{c.estimated && ' UT'}
                      </Td>
                      {isSale && (
                        <>
                          <Td className={TH}>
                            <MoneyInput value={c.unitPrice} onChange={(v) => patch(c.code, { unitPrice: v })} className="w-[70px]" />
                          </Td>
                          <Td className={TH}>{money(amount(c))}</Td>
                        </>
                      )}
                      <Td className={TH}>{blocked ? <Badge tone="err" className="!border-0">Ngưng GM → {dm(c.withdrawalUntil)}</Badge> : <Badge tone="ok" className="!border-0">OK</Badge>}</Td>
                      <Td className={cx(TH, 'relative')}>
                        <button type="button" className="cursor-pointer px-1 text-muted" onClick={() => setMenu(menu === c.code ? null : c.code)}>⋯</button>
                        {menu === c.code && (
                          <button
                            type="button"
                            className="absolute right-0 top-full z-10 cursor-pointer rounded border border-edge bg-white px-3 py-1.5 text-xs text-err-fg"
                            onClick={() => { setPicked(picked.filter((x) => x.code !== c.code)); setMenu(null) }}
                          >
                            Bỏ khỏi phiếu
                          </button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td className={TH} /><Td className={TH}>{picked.length} con</Td><Td className={TH} /><Td className={TH} />
                  <Td className={TH}>{money(totalWeight)} kg</Td>
                  {isSale && <><Td className={TH} /><Td className={TH}>{money(cowsMoney)}</Td></>}
                  <Td className={TH} /><Td className={TH} />
                </tr>
              </tfoot>
            </Table>
            {withdrawal.map((c) => (
              <Note tone="err" key={c.code}>
                {c.code} đang trong thời gian ngưng giết mổ đến {dm(c.withdrawalUntil)}/2026{c.code === 'BC-000205' ? ' (điều trị kháng sinh 18/10)' : ''}. Bán để giết mổ trước ngày này vi phạm an toàn thực phẩm – nên dời ngày xuất hoặc bỏ con khỏi phiếu.
              </Note>
            ))}
          </Box>

          <div className={cx('grid items-start gap-[18px]', isSale ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1 lg:grid-cols-[300px]')}>
            <Box title="3. Chứng từ đính kèm" gap="gap-[10px]">
              <Drop hint="Hợp đồng, phiếu cân, giấy kiểm dịch · PDF, JPG ≤ 10MB" />
              <DocRow ext="PDF" name="phieu-can-xuat-2210.pdf" />
            </Box>
            {isSale && (
              <Box title="4. Thanh toán" gap="gap-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div><div className="mb-[3px] text-[11px] text-faint">Tiền bò</div><div className="text-[13px] font-medium">{money(cowsMoney)} đ</div></div>
                  <div><div className="mb-[3px] text-[11px] text-faint">Tổng phải thu</div><div className="text-[13px] font-medium">{money(receivable)} đ</div></div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Khấu trừ (hao hụt, môi giới)"><MoneyInput value={deduction} onChange={setDeduction} suffix="đ" /></Field>
                  <Field label="Đã thu (đặt cọc)"><MoneyInput value={collected} onChange={setCollected} suffix="đ" /></Field>
                </div>
                <div>
                  <div className="mb-[3px] text-[11px] text-faint">Còn phải thu</div>
                  <div className="text-[13px] font-semibold text-warn-fg">{money(remaining)} đ</div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Phương thức">
                    <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full">
                      {PAY_METHODS.map((p) => <option key={p}>{p}</option>)}
                    </Select>
                  </Field>
                  <Field label="Hạn thu phần còn lại"><DateInput value={dueDate} onChange={setDueDate} /></Field>
                </div>
              </Box>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <SummaryCard
            badge={<Badge>Nháp</Badge>}
            rows={[
              ['Số con', picked.length],
              ['Loại xuất', type],
              ['Tổng cân xuất', `${money(totalWeight)} kg${estimated ? ` (${estimated} con ước tính)` : ''}`],
              ['Chuồng giảm', barnDelta.length ? barnDelta.map((b) => `${b.name} (${b.count} → ${b.count - b.out})`).join(' · ') : '—'],
              ...(isSale ? [['Tổng phải thu', `${money(receivable)} đ`]] : []),
            ]}
          />
          <Box title="Kiểm tra trước khi xác nhận" gap="gap-[10px]">
            <CheckList
              rows={[
                ['Ngưng giết mổ còn hiệu lực', withdrawal.length ? `${withdrawal.length} con · ${withdrawal.map((c) => c.code).join(', ')} đến ${dm(withdrawal[0].withdrawalUntil)}` : 'Không có', withdrawal.length > 0],
                ['Ca sức khỏe mở / mạn tính', 'Không có'],
                ['Mũi tiêm, nhắc việc tương lai', '4 mục – sẽ hủy'],
                ['Thai đang theo dõi', 'Không áp dụng'],
                ['Bê nháp của bò mẹ', 'Không có'],
              ]}
            />
            <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="text-xs font-semibold">
              Tôi đã xem các mục trên và xác nhận xuất đàn *
            </Checkbox>
      {Boolean(saveError) && <Note tone="err">{displayError(saveError)}</Note>}
            <Button variant="primary" block className="!border-0 !py-[9px]" disabled={!confirmed || !picked.length} onClick={() => save('Đã xuất')}>
              Xác nhận xuất {picked.length} con
            </Button>
            <Button block onClick={() => save('Nháp')}>Lưu nháp phiếu</Button>
            <Button variant="link" block onClick={() => nav('/herd-exit')}>Hủy</Button>
            <p className="m-0 text-[11px] text-muted">
              Khi xác nhận, mỗi con: chuyển ĐÃ XUẤT, đóng phân chuồng, hủy mũi tiêm / nhắc việc sau ngày xuất, đóng ca bệnh và thai đang mở (GBR-35). Hồ sơ chỉ còn xem.
            </p>
          </Box>
        </div>
      </div>

      <Foot>Loại xuất cố định sau lần lưu đầu. Cân xuất mặc định là cân gần nhất (ước tính); cảnh báo không chặn lưu nháp nhưng phải xem lại trước khi xác nhận.</Foot>

      {m === 'pick' && (
        <PickModal id={id} herdExits={exports} picked={picked} setPicked={(rows) => setPicked(rows)} onClose={closeModal} />
      )}
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-md bg-side px-4 py-2.5 text-xs text-white">{toast}</div>}
    </Layout>
  )
}
