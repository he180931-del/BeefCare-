import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Badge, Button, Card, Docs, Dropzone, Field, Foot, Note, Segmented, Table, Td, Th, inputCls, smInputCls } from '../components/ui'
import { useStore } from '../data/store'
import { BARNS, CALF_BARN, GROUPS, PAY_METHODS, PURPOSES, SOURCES, initialCalves } from '../data/mock'
import { dmy, money } from '../data/format'

const blankCow = () => ({ tag: '', breed: '', sex: 'Cái', group: 'Chưa xác định', ageMonths: 12, weight: 0, estimated: false, barn: 'A1', unitPrice: 0 })
const num = (v) => (v === '' ? 0 : Number(v))

export default function ImportNew() {
  const { imports, addImport } = useStore()
  const nav = useNavigate()
  const [kind, setKind] = useState('Mua ngoài')
  const [pricing, setPricing] = useState('kg')
  const [sourceId, setSourceId] = useState(SOURCES[0].id)
  const [date, setDate] = useState('2026-10-22')
  const [quarantine, setQuarantine] = useState('')
  const [receiver, setReceiver] = useState('Anh A')
  const [note, setNote] = useState('Bê đẻ tháng 10 – đã gắn thẻ tai tại chuồng A3')
  const [editing, setEditing] = useState(null)
  const [calves, setCalves] = useState(initialCalves)
  const [cows, setCows] = useState([
    { tag: 'VN-0503', breed: 'Lai Sind', sex: 'Cái', group: 'Bò tơ', ageMonths: 18, weight: 236, estimated: true, barn: 'A1', unitPrice: 85000 },
    { tag: 'VN-0504', breed: 'Brahman lai', sex: 'Đực', group: 'Vỗ béo', ageMonths: 14, weight: 285, estimated: false, barn: 'B1', unitPrice: 85000 },
    { tag: '', breed: 'Zebu', sex: 'Cái', group: 'Chưa xác định', ageMonths: 12, weight: 198, estimated: true, barn: 'C1', unitPrice: 80000 },
  ])
  const [freight, setFreight] = useState(1500000)
  const [paid, setPaid] = useState(40000000)
  const [method, setMethod] = useState(PAY_METHODS[0])
  const [due, setDue] = useState('2026-11-05')
  const [printQr, setPrintQr] = useState(true)

  const isBuy = kind === 'Mua ngoài'
  const source = SOURCES.find((s) => s.id === sourceId)
  const nextId = `PN-2026-${String(Math.max(...imports.map((r) => Number(r.id.split('-')[2]))) + 1).padStart(4, '0')}`

  const patch = (i, p) => setCows(cows.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  const amount = (c) => (pricing === 'kg' ? c.weight * c.unitPrice : c.unitPrice)
  const totalWeight = cows.reduce((s, c) => s + c.weight, 0)
  const cowsMoney = isBuy ? cows.reduce((s, c) => s + amount(c), 0) : 0
  const total = cowsMoney + (isBuy ? freight : 0)
  const debt = Math.max(total - paid, 0)
  const estimatedCount = cows.filter((c) => c.estimated).length

  const picked = calves.filter((c) => c.picked)
  const patchCalf = (i, p) => setCalves(calves.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  const calfWeight = picked.reduce((s, c) => s + c.weight, 0)
  const calfEstimated = picked.filter((c) => c.estimated).length
  const calfAfter = CALF_BARN.count + picked.filter((c) => c.barn).length
  const calfOver = calfAfter > CALF_BARN.capacity
  const n = isBuy ? cows.length : picked.length

  const barnAfter = BARNS.map((b) => ({ ...b, after: b.count + cows.filter((c) => c.barn === b.code).length })).filter((b) => b.after !== b.count)
  const overflow = barnAfter.filter((b) => b.after > b.capacity)

  const save = (status) => {
    addImport({
      date,
      type: kind,
      source: isBuy ? `${source.name}${quarantine ? ` · ${quarantine}` : ''}` : `Bê của ${[...new Set(picked.map((c) => c.mother))].join(', ')}`,
      count: n,
      weight: isBuy ? totalWeight : calfWeight,
      total: isBuy ? total : null,
      debt: isBuy ? debt : null,
      status,
    })
    nav('/herd-entry')
  }

  const summaryRow = (label, value) => (
    <div>
      <dt className="mb-[3px] text-[11px] text-faint">{label}</dt>
      <dd className="m-0 text-[13px] font-medium">{value}</dd>
    </div>
  )

  return (
    <Layout title={isBuy ? 'Phiếu nhập mới – Mua ngoài (theo phiếu)' : 'Phiếu nhập mới – Bê sinh tại trại'} user="manager">
      <div>
        <h1 className="m-0 text-[22px] font-bold">Phiếu nhập mới</h1>
        <p className="mb-0 mt-1 text-xs text-muted">
          {isBuy ? 'Mỗi con trong phiếu sẽ được tạo 1 mã nội bộ cố định và thẻ QR khi lưu.' : 'Bê được tạo từ sự kiện đẻ đang ở trạng thái Chờ xác nhận.'}
        </p>
      </div>
      <div>
        <Segmented value={kind} onChange={setKind} options={[{ value: 'Mua ngoài', label: 'Mua ngoài' }, { value: 'Bê sinh tại trại', label: 'Bê sinh tại trại' }]} />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card title="1. Thông tin phiếu">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Mã phiếu"><input className={inputCls} value={nextId} readOnly /></Field>
              <Field label={isBuy ? 'Ngày nhập trại *' : 'Ngày lập phiếu *'}>
                <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Loại nhập"><input className={inputCls} value={kind} readOnly /></Field>
              {isBuy && (
                <>
                  <Field label="Nguồn / chủ bò cũ *" hint={`${source.phone} · + Thêm nguồn mới`}>
                    <select className={inputCls} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                      {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Số giấy kiểm dịch *">
                    <input className={inputCls} value={quarantine} placeholder="KD-HN-2026-004512" onChange={(e) => setQuarantine(e.target.value)} />
                  </Field>
                  <Field label="Người nhập"><input className={inputCls} value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
                </>
              )}
            </div>
            <Field label={isBuy ? 'Ghi chú khi nhận bò' : 'Ghi chú'}>
              <input className={inputCls} value={note} placeholder="Khám ngoại hình bình thường..." onChange={(e) => setNote(e.target.value)} />
            </Field>
          </Card>

          {isBuy ? (
          <Card
            title={`2. Danh sách bò trong phiếu (${cows.length} con)`}
            sub='Lịch sử trước nhập đàn mặc định "Không rõ" · sửa từng con bằng ✎'
            actions={
              <>
                <Button small>Nhập từ Excel</Button>
                <Button small onClick={() => setCows([...cows, blankCow()])}>+ Thêm con</Button>
              </>
            }
          >
            {isBuy && (
              <div className="flex items-center gap-2.5">
                <b className="text-xs">Cách tính giá</b>
                <Segmented value={pricing} onChange={setPricing} options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]} />
              </div>
            )}
            <Table scroll>
              <thead>
                <tr>
                  <Th>#</Th><Th>Thẻ tai</Th><Th>Giống · giới tính · nhóm</Th><Th>Tuổi</Th><Th>Cân nặng</Th><Th>Chuồng nhận</Th>
                  {isBuy && <><Th>{pricing === 'kg' ? 'Đơn giá/kg' : 'Giá/con'}</Th><Th>Thành tiền</Th></>}
                  <Th />
                </tr>
              </thead>
              <tbody>
                {cows.map((c, i) => {
                  const edit = editing === i
                  return (
                    <tr key={i}>
                      <Td>{i + 1}</Td>
                      <Td>
                        {edit
                          ? <input className={`${smInputCls} w-[84px]`} value={c.tag} placeholder="Gắn sau" onChange={(e) => patch(i, { tag: e.target.value })} />
                          : c.tag || <span className="text-muted">Gắn sau</span>}
                      </Td>
                      <Td>
                        {edit ? (
                          <div className="flex flex-wrap gap-1">
                            <input className={`${smInputCls} w-24`} value={c.breed} placeholder="Giống" onChange={(e) => patch(i, { breed: e.target.value })} />
                            <select className={smInputCls} value={c.sex} onChange={(e) => patch(i, { sex: e.target.value })}>
                              <option>Cái</option><option>Đực</option>
                            </select>
                            <select className={smInputCls} value={c.group} onChange={(e) => patch(i, { group: e.target.value })}>
                              {GROUPS.map((g) => <option key={g}>{g}</option>)}
                            </select>
                          </div>
                        ) : `${c.breed || '—'} · ${c.sex} · ${c.group}`}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {edit
                          ? <input className={`${smInputCls} w-14`} type="number" min="0" value={c.ageMonths} onChange={(e) => patch(i, { ageMonths: num(e.target.value) })} />
                          : `~${c.ageMonths} th`}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {edit ? (
                          <>
                            <input className={`${smInputCls} w-16`} type="number" min="0" value={c.weight} onChange={(e) => patch(i, { weight: num(e.target.value) })} />
                            <label className="mt-0.5 block text-[11px] text-muted">
                              <input type="checkbox" checked={c.estimated} onChange={(e) => patch(i, { estimated: e.target.checked })} /> ước tính
                            </label>
                          </>
                        ) : `${money(c.weight)} kg${c.estimated ? ' UT' : ''}`}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <select className="cursor-pointer rounded border border-transparent bg-transparent py-0.5 text-xs hover:border-field focus:border-brand" value={c.barn} onChange={(e) => patch(i, { barn: e.target.value })}>
                          {BARNS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                        </select>
                      </Td>
                      {isBuy && (
                        <>
                          <Td>
                            {edit
                              ? <input className={`${smInputCls} w-[84px]`} type="number" min="0" value={c.unitPrice} onChange={(e) => patch(i, { unitPrice: num(e.target.value) })} />
                              : money(c.unitPrice)}
                          </Td>
                          <Td className="whitespace-nowrap">{money(amount(c))}</Td>
                        </>
                      )}
                      <Td className="whitespace-nowrap">
                        <button type="button" aria-label={edit ? 'Xong' : 'Sửa con này'} title={edit ? 'Xong' : 'Sửa'} className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-brand" onClick={() => setEditing(edit ? null : i)}>
                          {edit ? '✓' : '✎'}
                        </button>
                        <button type="button" aria-label="Xóa con này" title="Xóa" className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-err-fg" onClick={() => { setCows(cows.filter((_, idx) => idx !== i)); setEditing(null) }}>✕</button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td /><Td>{cows.length} con</Td><Td /><Td /><Td className="whitespace-nowrap">{money(totalWeight)} kg</Td><Td />
                  {isBuy && <><Td /><Td className="whitespace-nowrap">{money(cowsMoney)}</Td></>}
                  <Td />
                </tr>
              </tfoot>
            </Table>
            <p className="m-0 text-[11px] text-muted">
              UT = cân nặng ước tính. Con chưa có thẻ tai vẫn được tạo hồ sơ & QR, gắn thẻ sau. Mỗi dòng được kiểm tra tiêu chí và sức chứa của chuồng nhận.
            </p>
          </Card>
          ) : (
          <Card title="2. Chọn bê chờ xác nhận" sub={`${picked.length} / ${calves.length} bê được chọn`}>
            <Table scroll>
              <thead>
                <tr>
                  <Th />
                  <Th>Bê · thẻ tai</Th><Th>Bò mẹ · bố</Th><Th>Ngày sinh</Th><Th>Giới tính</Th><Th>Cân sơ sinh</Th><Th>Chuồng nhận</Th><Th>Mục đích nuôi</Th>
                </tr>
              </thead>
              <tbody>
                {calves.map((c, i) => (
                  <tr key={c.name}>
                    <Td>
                      <input type="checkbox" aria-label={`Chọn ${c.tag || c.name}`} className="h-4 w-4 cursor-pointer accent-brand" checked={c.picked} onChange={(e) => patchCalf(i, { picked: e.target.checked, barn: e.target.checked ? CALF_BARN.code : '' })} />
                    </Td>
                    <Td>{c.tag || 'Chưa gắn thẻ'}<br />{c.name}</Td>
                    <Td>{c.mother}<br />{c.father}</Td>
                    <Td className="whitespace-nowrap">{dmy(c.born)}</Td>
                    <Td>{c.sex}</Td>
                    <Td className="whitespace-nowrap">{money(c.weight)} kg{c.estimated ? ' UT' : ''}</Td>
                    <Td className="whitespace-nowrap">{c.picked ? CALF_BARN.name : '—'}</Td>
                    <Td className="whitespace-nowrap">
                      {c.picked ? (
                        <select className="cursor-pointer rounded border border-transparent bg-transparent py-0.5 text-xs hover:border-field focus:border-brand" value={c.purpose} onChange={(e) => patchCalf(i, { purpose: e.target.value })}>
                          {PURPOSES.map((x) => <option key={x}>{x}</option>)}
                        </select>
                      ) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="m-0 text-[11px] text-muted">
              Bò mẹ, giống, giới tính và cân sơ sinh lấy từ sự kiện đẻ – không sửa ở đây. Ngày nhập đàn của bê = ngày sinh; giai đoạn = Bê theo mẹ. Bê chưa gắn thẻ vẫn chọn được, hệ thống cấp mã và QR. Bê đã chết trước khi đăng ký được đánh dấu tại đây.
            </p>
          </Card>
          )}

          <div className={`grid items-start gap-[18px] ${isBuy ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
            <Card title="3. Chứng từ đính kèm" sub={isBuy ? undefined : 'Không bắt buộc'}>
              <Dropzone hint={isBuy ? 'PDF, JPG ≤ 10MB' : 'Ảnh bê, biên bản đỡ đẻ · PDF, JPG ≤ 10MB'} />
              {isBuy && <Docs docs={[{ ext: 'PDF', name: 'giay-kiem-dich-2210.pdf' }, { ext: 'JPG', name: 'anh-lo-bo-nhan.jpg' }]} />}
            </Card>
            {isBuy && (
              <Card title="4. Thanh toán">
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Phí vận chuyển (đ)"><input className={inputCls} type="number" min="0" value={freight} onChange={(e) => setFreight(num(e.target.value))} /></Field>
                  <Field label="Đã thanh toán (đ)"><input className={inputCls} type="number" min="0" value={paid} onChange={(e) => setPaid(num(e.target.value))} /></Field>
                  <Field label="Phương thức">
                    <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                      {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Hạn trả phần nợ"><input className={inputCls} type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-3">
                  {summaryRow('Tiền bò', `${money(cowsMoney)} đ`)}
                  {summaryRow('Tổng phải trả', `${money(total)} đ`)}
                  {summaryRow('Còn nợ nguồn bán', <span className={debt ? 'font-semibold text-warn-fg' : ''}>{money(debt)} đ</span>)}
                  {summaryRow('Hạn trả', debt ? dmy(due) : '—')}
                </dl>
              </Card>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card title="Tóm tắt phiếu nhập" actions={<Badge>Nháp</Badge>}>
            <dl className="m-0 flex flex-col gap-3">
              {summaryRow('Số con', n)}
              {summaryRow('Loại nhập', isBuy ? 'Mua ngoài · theo phiếu' : 'Bê sinh tại trại')}
              {summaryRow(isBuy ? 'Tổng cân nặng' : 'Tổng cân sơ sinh', isBuy ? `${money(totalWeight)} kg${estimatedCount ? ` (${estimatedCount} con ước tính)` : ''}` : `${money(calfWeight)} kg${calfEstimated ? ` (${calfEstimated} con ước tính)` : ''}`)}
              {isBuy && summaryRow('Tổng phải trả', `${money(total)} đ`)}
              {!isBuy && summaryRow('Chuồng nhận', picked.length ? <span className="text-xs font-semibold">{`${CALF_BARN.name} (${CALF_BARN.count}/${CALF_BARN.capacity} → ${calfAfter}/${CALF_BARN.capacity})`}</span> : '—')}
              {!isBuy && summaryRow('Giai đoạn sống', 'Bê theo mẹ')}
              {isBuy && summaryRow('Chuồng nhận', <span className="text-xs font-semibold">{barnAfter.length ? barnAfter.map((b) => `${b.code} (${b.count}/${b.capacity} → ${b.after}/${b.capacity})`).join(' · ') : '—'}</span>)}
            </dl>
            {!isBuy && <Note>Phiếu bê sinh tại trại không có giá và thanh toán.</Note>}
            {!isBuy && calfOver && <Note tone="err">Chuồng {CALF_BARN.code} vượt sức chứa ({calfAfter}/{CALF_BARN.capacity}).</Note>}
            {isBuy && estimatedCount > 0 && <Note tone="warn">Cân nặng {estimatedCount} con sẽ được lưu là ƯỚC TÍNH.</Note>}
            {isBuy && barnAfter.filter((b) => b.after === b.capacity).map((b) => <Note tone="warn" key={b.code}>Chuồng {b.code} sẽ đầy ({b.after}/{b.capacity}) sau khi nhập.</Note>)}
            {isBuy && overflow.map((b) => <Note tone="err" key={b.code}>Chuồng {b.code} vượt sức chứa ({b.after}/{b.capacity}).</Note>)}
          </Card>

          <Card title="Kiểm tra trước khi lưu">
            {(isBuy
              ? [
                'Thẻ tai không trùng với bò đang có trong trại',
                `Tiêu chí chuồng nhận: ${cows.length}/${cows.length} con đạt`,
                overflow.length ? 'Sức chứa chuồng chưa đủ' : `Sức chứa chuồng đủ cho ${cows.length} con`,
                'Ngày nhập không ở tương lai, sau ngày sinh',
              ]
              : [
                'Bê đang Chờ xác nhận, chưa được đăng ký',
                'Thẻ tai không trùng trong trại',
                calfOver ? 'Sức chứa chuồng chưa đủ' : `Chuồng ${CALF_BARN.code} đủ chỗ cho ${picked.length} con`,
                'Bò mẹ đang ACTIVE trong trại',
              ]
            ).map((t) => (
              <div key={t} className="flex gap-2 text-xs"><span className="font-semibold text-brand">✓</span>{t}</div>
            ))}
          </Card>

          <Card>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={printQr} onChange={(e) => setPrintQr(e.target.checked)} />
              In tem QR cho {n} con sau khi lưu
            </label>
            <Button variant="primary" block disabled={!n || (isBuy ? overflow.length > 0 : calfOver)} onClick={() => save('Đã nhập')}>
              Lưu & tạo hồ sơ {n} con
            </Button>
            <Button block onClick={() => save('Nháp')}>Lưu nháp phiếu</Button>
            <Button variant="link" block onClick={() => nav('/herd-entry')}>Hủy</Button>
          </Card>
        </div>
      </div>

      <Foot>
        {isBuy
          ? 'Phiếu nhập gom nhiều con cùng nguồn; khi lưu, mỗi con được tạo hồ sơ, mã nội bộ, thẻ QR và phân chuồng; tiền bò và công nợ tính theo phiếu.'
          : 'Chỉ bê có kết quả đẻ đang Chờ xác nhận mới được chọn; khi lưu, mỗi bê được tạo hồ sơ, mã nội bộ, thẻ QR và xếp vào chuồng nhận.'}
      </Foot>
    </Layout>
  )
}
