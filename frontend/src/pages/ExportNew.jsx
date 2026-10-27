import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Badge, Button, Card, Docs, Dropzone, Field, Foot, Note, Segmented, Table, Td, Th, inputCls, smInputCls } from '../components/ui'
import { useStore } from '../data/store'
import { BARNS, BUYERS, HERD, PAY_METHODS } from '../data/mock'
import { dm, money } from '../data/format'

const TYPES = ['Bán', 'Loại thải', 'Chết / mất', 'Khác']
const num = (v) => (v === '' ? 0 : Number(v))

export default function ExportNew() {
  const { exports, addExport } = useStore()
  const nav = useNavigate()
  const [type, setType] = useState('Bán')
  const [date, setDate] = useState('2026-10-22')
  const [buyerId, setBuyerId] = useState(BUYERS[0].id)
  const [quarantine, setQuarantine] = useState('KD-HN-2026-005130')
  const [plate, setPlate] = useState('29H-456.78')
  const [note, setNote] = useState('')
  const [pricing, setPricing] = useState('kg')
  const [picked, setPicked] = useState(() => HERD.slice(0, 3).map((c) => ({ ...c, unitPrice: 92000 })))
  const [picker, setPicker] = useState(false)
  const [deduction, setDeduction] = useState(0)
  const [collected, setCollected] = useState(60000000)
  const [method, setMethod] = useState(PAY_METHODS[0])
  const [due, setDue] = useState('2026-10-29')
  const [confirmed, setConfirmed] = useState(false)

  const money$ = type === 'Bán' || type === 'Loại thải'
  const buyer = BUYERS.find((b) => b.id === buyerId)
  const nextId = `PX-2026-${String(Math.max(...exports.map((r) => Number(r.id.split('-')[2]))) + 1).padStart(4, '0')}`

  const amount = (c) => (pricing === 'kg' ? c.weight * c.unitPrice : c.unitPrice)
  const withdrawal = picked.filter((c) => c.withdrawalUntil && date < c.withdrawalUntil)
  const totalWeight = picked.reduce((s, c) => s + c.weight, 0)
  const estimated = picked.filter((c) => c.estimated).length
  const cowsMoney = money$ ? picked.reduce((s, c) => s + amount(c), 0) : 0
  const receivable = Math.max(cowsMoney - deduction, 0)
  const remaining = Math.max(receivable - collected, 0)

  const barnDelta = BARNS.map((b) => ({ ...b, out: picked.filter((c) => c.barn === b.code).length })).filter((b) => b.out)

  const patch = (code, p) => setPicked(picked.map((c) => (c.code === code ? { ...c, ...p } : c)))
  const toggle = (c) =>
    setPicked(picked.some((x) => x.code === c.code) ? picked.filter((x) => x.code !== c.code) : [...picked, { ...c, unitPrice: 92000 }])

  const save = (status) => {
    addExport({
      date,
      type,
      who: money$ ? `${type === 'Bán' ? 'Thương lái ' : ''}${buyer.name}` : note || type,
      sub: `${picked.length} con · chuồng ${[...new Set(picked.map((c) => c.barn))].join(', ')}`,
      count: picked.length,
      weight: `${money(totalWeight)} kg`,
      total: money$ ? receivable : null,
      due: money$ ? remaining : null,
      status,
    })
    nav('/herd-exit')
  }

  const summaryRow = (label, value) => (
    <div>
      <dt className="mb-[3px] text-[11px] text-faint">{label}</dt>
      <dd className="m-0 text-[13px] font-medium">{value}</dd>
    </div>
  )

  return (
    <Layout title={`Phiếu xuất mới – ${type}`}>
      <div>
        <h1 className="m-0 text-[22px] font-bold">Phiếu xuất mới</h1>
        <p className="mb-0 mt-1 text-xs text-muted">Chỉ Chủ trại xác nhận · bò chuyển ĐÃ XUẤT sau khi xác nhận.</p>
      </div>
      <div><Segmented value={type} onChange={setType} options={TYPES.map((t) => ({ value: t, label: t }))} /></div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card title="1. Thông tin phiếu">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Mã phiếu"><input className={inputCls} value={nextId} readOnly /></Field>
              <Field label="Ngày xuất *"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Loại xuất"><input className={inputCls} value={type} readOnly /></Field>
              {money$ && (
                <>
                  <Field label="Người mua / thương lái *" hint={`${buyer.phone} · + Thêm người mua`}>
                    <select className={inputCls} value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                      {BUYERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Số giấy kiểm dịch vận chuyển"><input className={inputCls} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} /></Field>
                  <Field label="Biển số xe"><input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
                </>
              )}
            </div>
            <Field label={money$ ? 'Ghi chú' : 'Lý do *'}>
              <input className={inputCls} value={note} placeholder={money$ ? 'Xuất bán vỗ béo đạt trọng lượng...' : 'Nhập lý do xuất'} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </Card>

          <Card
            title={`2. Danh sách bò trong phiếu (${picked.length} con)`}
            actions={
              <>
                <Button small>Quét QR</Button>
                <Button small onClick={() => setPicker(!picker)}>+ Chọn bò</Button>
              </>
            }
          >
            {picker && (
              <div className="flex flex-col gap-1.5 rounded-md border border-field bg-page p-3">
                {HERD.map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={picked.some((x) => x.code === c.code)} onChange={() => toggle(c)} />
                    {c.code} · {c.tag} · {c.breed} {c.sex} · {c.barn} · {c.weight} kg
                  </label>
                ))}
              </div>
            )}
            {money$ && (
              <div className="flex items-center gap-3">
                <b className="text-xs">Cách tính giá *</b>
                <Segmented value={pricing} onChange={setPricing} options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]} />
                <span className="text-[11px] text-muted">Cân xuất mặc định = cân gần nhất (ước tính) · cân lại để ghi thực tế</span>
              </div>
            )}
            <Table wide>
              <thead>
                <tr>
                  <Th>#</Th><Th>Mã bò · thẻ tai</Th><Th>Giống · giới tính</Th><Th>Chuồng</Th><Th>Cân xuất</Th>
                  {money$ && <><Th>{pricing === 'kg' ? 'Đơn giá/kg' : 'Giá/con'}</Th><Th>Thành tiền</Th></>}
                  <Th>Kiểm tra</Th><Th />
                </tr>
              </thead>
              <tbody>
                {picked.map((c, i) => {
                  const blocked = c.withdrawalUntil && date < c.withdrawalUntil
                  return (
                    <tr key={c.code}>
                      <Td>{i + 1}</Td>
                      <Td className="whitespace-nowrap">{c.code}<br />{c.tag}</Td>
                      <Td>{c.breed} · {c.sex}<br />{c.age} · {c.group}</Td>
                      <Td>{c.barn}</Td>
                      <Td>
                        <input className={`${smInputCls} w-16`} type="number" min="0" value={c.weight} onChange={(e) => patch(c.code, { weight: num(e.target.value), estimated: false })} />
                        {c.estimated && <span className="ml-1 text-[11px] text-muted">UT</span>}
                      </Td>
                      {money$ && (
                        <>
                          <Td><input className={`${smInputCls} w-20`} type="number" min="0" value={c.unitPrice} onChange={(e) => patch(c.code, { unitPrice: num(e.target.value) })} /></Td>
                          <Td>{money(amount(c))}</Td>
                        </>
                      )}
                      <Td>{blocked ? <Badge tone="err">Ngưng GM → {dm(c.withdrawalUntil)}</Badge> : <Badge tone="ok">OK</Badge>}</Td>
                      <Td><Button variant="link" small onClick={() => toggle(c)}>✕</Button></Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td /><Td>{picked.length} con</Td><Td /><Td /><Td>{money(totalWeight)} kg</Td>
                  {money$ && <><Td /><Td>{money(cowsMoney)}</Td></>}
                  <Td /><Td />
                </tr>
              </tfoot>
            </Table>
            {withdrawal.map((c) => (
              <Note tone="err" key={c.code}>
                {c.code} đang trong thời gian ngưng giết mổ đến {dm(c.withdrawalUntil)}/2026. Bán để giết mổ trước ngày này vi phạm an toàn thực phẩm – nên dời ngày xuất hoặc bỏ con khỏi phiếu.
              </Note>
            ))}
          </Card>

          <div className={`grid items-start gap-[18px] ${money$ ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1 lg:grid-cols-[300px]'}`}>
            <Card title="3. Chứng từ đính kèm">
              <Dropzone hint="Hợp đồng, phiếu cân, giấy kiểm dịch · PDF, JPG ≤ 10MB" />
              <Docs docs={[{ ext: 'PDF', name: 'phieu-can-xuat-2210.pdf' }]} />
            </Card>
            {money$ && (
              <Card title="4. Thanh toán">
                <dl className="m-0 grid grid-cols-2 gap-3">
                  {summaryRow('Tiền bò', `${money(cowsMoney)} đ`)}
                  {summaryRow('Tổng phải thu', `${money(receivable)} đ`)}
                </dl>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Khấu trừ (hao hụt, môi giới)"><input className={inputCls} type="number" min="0" value={deduction} onChange={(e) => setDeduction(num(e.target.value))} /></Field>
                  <Field label="Đã thu (đặt cọc)"><input className={inputCls} type="number" min="0" value={collected} onChange={(e) => setCollected(num(e.target.value))} /></Field>
                </div>
                {summaryRow('Còn phải thu', <span className="font-semibold text-warn-fg">{money(remaining)} đ</span>)}
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Phương thức">
                    <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                      {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Hạn thu phần còn lại"><input className={inputCls} type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card title="Tóm tắt phiếu xuất" actions={<Badge>Nháp</Badge>}>
            <dl className="m-0 flex flex-col gap-3">
              {summaryRow('Số con', picked.length)}
              {summaryRow('Loại xuất', type)}
              {summaryRow('Tổng cân xuất', `${money(totalWeight)} kg${estimated ? ` (${estimated} con ước tính)` : ''}`)}
              {summaryRow('Chuồng giảm', barnDelta.length ? barnDelta.map((b) => `${b.name} (${b.count} → ${b.count - b.out})`).join(' · ') : '—')}
              {money$ && summaryRow('Tổng phải thu', `${money(receivable)} đ`)}
            </dl>
          </Card>

          <Card title="Kiểm tra trước khi xác nhận">
            <Table stack={false}>
              <thead><tr><Th>Mục</Th><Th>Kết quả</Th></tr></thead>
              <tbody>
                <tr>
                  <Td>Ngưng giết mổ còn hiệu lực</Td>
                  <Td className={withdrawal.length ? 'font-medium text-err-fg' : ''}>
                    {withdrawal.length ? `${withdrawal.length} con · ${withdrawal.map((c) => c.code).join(', ')} đến ${dm(withdrawal[0].withdrawalUntil)}` : 'Không có'}
                  </Td>
                </tr>
                <tr><Td>Ca sức khỏe mở / mạn tính</Td><Td>Không có</Td></tr>
                <tr><Td>Mũi tiêm, nhắc việc tương lai</Td><Td>4 mục – sẽ hủy</Td></tr>
                <tr><Td>Thai đang theo dõi</Td><Td>Không áp dụng</Td></tr>
                <tr><Td>Bê nháp của bò mẹ</Td><Td>Không có</Td></tr>
              </tbody>
            </Table>
            <label className="flex items-start gap-2 text-xs font-semibold">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              Tôi đã xem các mục trên và xác nhận xuất đàn *
            </label>
            <Button variant="primary" block disabled={!confirmed || !picked.length} onClick={() => save('Đã xuất')}>
              Xác nhận xuất {picked.length} con
            </Button>
            <Button block onClick={() => save('Nháp')}>Lưu nháp phiếu</Button>
            <Button variant="link" block onClick={() => nav('/herd-exit')}>Hủy</Button>
            <p className="m-0 text-[11px] text-muted">
              Khi xác nhận, mỗi con: chuyển ĐÃ XUẤT, đóng phân chuồng, hủy mũi tiêm / nhắc việc sau ngày xuất, đóng ca bệnh và thai đang mở (GBR-35). Hồ sơ chỉ còn xem.
            </p>
          </Card>
        </div>
      </div>

      <Foot>Loại xuất cố định sau lần lưu đầu. Cân xuất mặc định là cân gần nhất (ước tính); cảnh báo không chặn lưu nháp nhưng phải xem lại trước khi xác nhận.</Foot>
    </Layout>
  )
}
