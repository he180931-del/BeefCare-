import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Badge, Button, Card, Checkbox, DateInput, Docs, Dropzone, Field, Foot, KV, Note, Segmented, Select, Table, Td, Th, inputCls } from '../components/ui'
import { useModalParam } from '../components/Modal'
import { herdEntryApi } from '../api/herdEntryApi'
import { registerEntryCattle } from '../api/herdDomainApi'
import { useMutation, useQuery } from '../hooks/useApi'
import { CALF_BARN, PAY_METHODS, PURPOSES, SOURCES, initialCalves } from '../data/mock'
import { IMPORT_BARNS, INITIAL_COWS, TODAY, ageOf, blankCow } from '../data/importsData'
import { dmy, money } from '../data/format'
import { GhostMoney, GhostSelect, RadioRow } from './import/parts'
import RowEditModal from './import/RowEditModal'
import ExcelModal from './import/ExcelModal'

const TH = 'px-1! first:pl-3! last:pr-3!'
const KIND_BUY = 'Mua ngoài'
const KIND_CALF = 'Bê sinh tại trại'
const BARN_OPTIONS = IMPORT_BARNS.map((b) => ({ value: b.code, label: b.name }))
const CALF_BARN_OPTIONS = [{ value: CALF_BARN.code, label: CALF_BARN.name }]
const PURPOSE_CHOICES = PURPOSES.map((p) => ({ value: p, label: p }))
const barnLabel = (b) => (b.showName ? `${b.code} ${b.name.split(' – ')[1]}` : b.code)
const num = (v) => Number(v) || 0

export default function ImportNew() {
  const [params] = useSearchParams()
  const { data } = useQuery(() => herdEntryApi.list(), [])
  if (!data) {
    return <Layout title="Phiếu nhập mới" user="manager"><p className="m-0 text-xs text-muted">Đang tải phiếu nhập…</p></Layout>
  }
  return <ImportForm key={params.get('kind') === 'calf' ? 'calf' : 'buy'} imports={data} />
}

function ImportForm({ imports }) {
  const { mutate: persistEntry } = useMutation(({ id, record, exists }) => (exists ? herdEntryApi.update(id, record) : herdEntryApi.create({ ...record, id })))
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()

  const kind = params.get('kind') === 'calf' ? KIND_CALF : KIND_BUY
  const isBuy = kind === KIND_BUY
  const draftRow = imports.find((row) => row.status === 'Nháp' && row.type === kind)
  const draft = draftRow?.draft
  const nextNumber = Math.max(0, ...imports.map((row) => Number(row.id?.split('-')[2]) || 0)) + 1
  const recordId = draftRow?.id ?? `PN-2026-${String(nextNumber).padStart(4, '0')}`
  const setKind = (next) => {
    const query = new URLSearchParams(params)
    if (next === KIND_CALF) query.set('kind', 'calf')
    else query.delete('kind')
    setParams(query)
  }

  const [pricing, setPricing] = useState(draft?.pricing ?? 'kg')
  const [sourceId, setSourceId] = useState(draft?.sourceId ?? SOURCES[0].id)
  const [date, setDate] = useState(draft?.date ?? TODAY)
  const [quarantine, setQuarantine] = useState(draft?.quarantine ?? '')
  const [receiver, setReceiver] = useState(draft?.receiver ?? 'Anh A')
  const [note, setNote] = useState(draft?.note ?? '')
  const [cows, setCows] = useState(draft?.cows ?? INITIAL_COWS)
  const [calves, setCalves] = useState(draft?.calves ?? initialCalves)
  const [freight, setFreight] = useState(draft?.freight ?? 1500000)
  const [paid, setPaid] = useState(draft?.paid ?? 40000000)
  const [method, setMethod] = useState(draft?.method ?? PAY_METHODS[0])
  const [due, setDue] = useState(draft?.due ?? '2026-11-05')
  const [printQr, setPrintQr] = useState(draft?.printQr ?? true)

  const source = SOURCES.find((s) => s.id === sourceId)
  const cowsMoney = cows.reduce((s, c) => s + (pricing === 'kg' ? c.weight * c.unitPrice : c.unitPrice), 0)
  const totalWeight = cows.reduce((s, c) => s + c.weight, 0)
  const total = cowsMoney + freight
  const debt = Math.max(total - paid, 0)
  const estimatedCount = cows.filter((c) => c.estimated).length
  const barnAfter = IMPORT_BARNS.map((b) => ({ ...b, after: b.count + cows.filter((c) => c.barn === b.code).length })).filter((b) => b.after !== b.count)
  const overflow = barnAfter.filter((b) => b.after > b.capacity)

  const picked = calves.filter((c) => c.picked)
  const calfWeight = picked.reduce((s, c) => s + c.weight, 0)
  const calfEstimated = picked.filter((c) => c.estimated).length
  const calfAfter = CALF_BARN.count + picked.length
  const calfOver = calfAfter > CALF_BARN.capacity
  const n = isBuy ? cows.length : picked.length

  const patchCow = (i, p) => setCows(cows.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  const patchCalf = (i, p) => setCalves(calves.map((c, idx) => (idx === i ? { ...c, ...p } : c)))

  const save = async (status) => {
    const sourceText = isBuy
      ? `${source.name}${quarantine ? ` · ${quarantine}` : ''}${estimatedCount ? ` · ${estimatedCount} con cân ước tính` : ''}`
      : `Bê của ${[...new Set(picked.map((c) => c.mother))].join(', ')}`
    const editableDraft = {
      pricing, sourceId, date, quarantine, receiver, note, cows, calves, freight, paid, method, due, printQr,
    }
    const record = isBuy
      ? {
          date,
          type: kind,
          source: sourceText,
          count: n,
          weight: totalWeight,
          total,
          debt,
          status,
        }
      : {
          date,
          type: kind,
          source: sourceText,
          count: n,
          weight: calfWeight,
          total: null,
          debt: null,
          status,
        }
    if (status === 'Nháp') {
      record.draft = editableDraft
    } else {
      const inputs = isBuy
        ? cows.map((cow) => ({ ...cow, date }))
        : picked.map((calf) => ({ ...calf, tag: calf.tag, ageMonths: 0, stage: 'Bê', group: 'Bê', date: calf.born }))
      const registered = await registerEntryCattle(inputs, recordId)
      record.detail = {
        sourceName: isBuy ? source.name : sourceText,
        quarantine: isBuy ? quarantine : '',
        phone: isBuy ? source.phone : '',
        plate: '',
        by: `${receiver} · ${date}`,
        note,
        cows: registered.map((cow, index) => ({
          code: cow.code,
          tag: cow.tag || '—',
          breed: `${cow.breed} · ${cow.sex}`,
          weight: cow.weight,
          barn: cow.barn,
          current: `ACTIVE · ${cow.barn}`,
          amount: isBuy ? (pricing === 'kg' ? cows[index].weight * cows[index].unitPrice : cows[index].unitPrice) : 0,
        })),
        cowsTotal: isBuy ? cowsMoney : 0,
        freight: isBuy ? freight : 0,
        payments: isBuy && paid > 0 ? [{ date: dmy(date), by: receiver, method, ref: '', amount: Math.min(paid, total) }] : [],
        docs: isBuy ? [{ ext: 'PDF', name: 'giay-kiem-dich.pdf' }] : [],
        history: [`${dmy(date)} · ${receiver} ${status === 'Đã nhập' ? 'lưu và xác nhận' : 'lưu'} phiếu ${recordId}`],
      }
      record.draft = undefined
    }
    await persistEntry({ id: recordId, record, exists: Boolean(draftRow) })
    nav('/herd-entry')
  }

  const rowIndex = m && m.startsWith('row-') ? Number(m.slice(4)) - 1 : -1
  const editing = rowIndex >= 0 && rowIndex < cows.length ? rowIndex : -1
  const blocked = isBuy ? overflow.length > 0 : calfOver

  return (
    <Layout title={isBuy ? 'Phiếu nhập mới – Mua ngoài (theo phiếu)' : 'Phiếu nhập mới – Bê sinh tại trại'} user="manager">
      <div className="contents leading-[normal]">
        <div>
          <h1 className="m-0 text-[22px] font-bold">Phiếu nhập mới</h1>
          <p className="mb-0 mt-1 text-xs text-muted">
            {isBuy ? 'Mỗi con trong phiếu sẽ được tạo 1 mã nội bộ cố định và thẻ QR khi lưu.' : 'Bê được tạo từ sự kiện đẻ đang ở trạng thái Chờ xác nhận.'}
          </p>
        </div>
        <div>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: KIND_BUY, label: KIND_BUY }, { value: KIND_CALF, label: KIND_CALF }]}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Card title="1. Thông tin phiếu">
              <div className="flex flex-col gap-3.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Mã phiếu"><input className={inputCls} value={recordId} readOnly /></Field>
                  <Field label={isBuy ? 'Ngày nhập trại *' : 'Ngày lập phiếu *'}>
                    <DateInput value={date} onChange={setDate} />
                  </Field>
                  <Field label="Loại nhập"><input className={inputCls} value={kind} readOnly /></Field>
                  {isBuy && (
                    <>
                      <Field label="Nguồn / chủ bò cũ *" hint={`${source.phone} · + Thêm nguồn mới`}>
                        <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                          {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      </Field>
                      <Field label="Số giấy kiểm dịch *">
                        <input className={inputCls} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} />
                      </Field>
                      <Field label="Người nhập"><input className={inputCls} value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
                    </>
                  )}
                </div>
                <Field label={isBuy ? 'Ghi chú khi nhận bò' : 'Ghi chú'}>
                  <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </div>
            </Card>

            {isBuy ? (
              <Card
                title={`2. Danh sách bò trong phiếu (${cows.length} con)`}
                sub='Lịch sử trước nhập đàn mặc định "Không rõ" · sửa từng con bằng ✎'
                actions={
                  <>
                    <Button small onClick={() => openModal('excel')}>Nhập từ Excel</Button>
                    <Button small onClick={() => { setCows([...cows, blankCow()]); openModal(`row-${cows.length + 1}`) }}>+ Thêm con</Button>
                  </>
                }
              >
                <div className="flex items-center gap-2.5">
                  <b className="text-xs">Cách tính giá</b>
                  <Segmented value={pricing} onChange={setPricing} options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]} />
                </div>
                <Table wide>
                  <thead>
                    <tr>
                      <Th className={`${TH} w-[20px]`}>#</Th>
                      <Th className={`${TH} w-[70px]`}>Thẻ tai</Th>
                      <Th className={`${TH} w-[150px]`}>Giống · giới tính · nhóm</Th>
                      <Th className={`${TH} w-[60px]`}>Tuổi</Th>
                      <Th className={`${TH} w-[70px]`}>Cân nặng</Th>
                      <Th className={`${TH} w-[100px]`}>Chuồng nhận</Th>
                      <Th className={`${TH} w-[70px]`}>{pricing === 'kg' ? 'Đơn giá/kg' : 'Giá/con'}</Th>
                      <Th className={`${TH} w-[80px]`}>Thành tiền</Th>
                      <Th className={`${TH} w-[20px]`} />
                      <Th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {cows.map((c, i) => (
                      <tr key={i}>
                        <Td className={TH}>{i + 1}</Td>
                        <Td className={TH}>{c.tag || <span className="text-muted">Gắn sau</span>}</Td>
                        <Td className={TH}>{`${c.breed || '—'} · ${c.sex} · ${c.stage}`}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`~${ageOf(c.dob, date)} th`}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`${money(c.weight)} kg${c.estimated ? ' UT' : ''}`}</Td>
                        <Td className={TH}>
                          <GhostSelect value={c.barn} onChange={(barn) => patchCow(i, { barn })} options={BARN_OPTIONS} />
                        </Td>
                        <Td className={TH}>{money(c.unitPrice)}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{money(pricing === 'kg' ? c.weight * c.unitPrice : c.unitPrice)}</Td>
                        <Td className={TH}>
                          <button type="button" aria-label={`Sửa con #${i + 1}`} className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-brand" onClick={() => openModal(`row-${i + 1}`)}>✎</button>
                        </Td>
                        <Td className={TH} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <Td className={TH} />
                      <Td className={TH}>{cows.length} con</Td>
                      <Td className={TH} /><Td className={TH} />
                      <Td className={`${TH} whitespace-nowrap`}>{`${money(totalWeight)} kg`}</Td>
                      <Td className={TH} /><Td className={TH} />
                      <Td className={`${TH} whitespace-nowrap`}>{money(cowsMoney)}</Td>
                      <Td className={TH} /><Td className={TH} />
                    </tr>
                  </tfoot>
                </Table>
                <p className="m-0 text-[11px] text-muted">
                  UT = cân nặng ước tính. Con chưa có thẻ tai vẫn được tạo hồ sơ & QR, gắn thẻ sau. Mỗi dòng được kiểm tra tiêu chí và sức chứa của chuồng nhận.
                </p>
              </Card>
            ) : (
              <Card title="2. Chọn bê chờ xác nhận" sub={`${picked.length} / ${calves.length} bê được chọn`}>
                <Table wide>
                  <thead>
                    <tr>
                      <Th className={`${TH} w-[20px]`} />
                      <Th className={`${TH} w-[90px]`}>Bê · thẻ tai</Th>
                      <Th className={`${TH} w-[120px]`}>Bò mẹ · bố</Th>
                      <Th className={`${TH} w-[78px]`}>Ngày sinh</Th>
                      <Th className={`${TH} w-[56px]`}>Giới tính</Th>
                      <Th className={`${TH} w-[72px]`}>Cân sơ sinh</Th>
                      <Th className={`${TH} w-[110px]`}>Chuồng nhận</Th>
                      <Th className={`${TH} w-[92px]`}>Mục đích nuôi</Th>
                      <Th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {calves.map((c, i) => (
                      <tr key={`${c.tag}-${c.mother}`}>
                        <Td className={TH}>
                          <Checkbox
                            checked={c.picked}
                            aria-label={`Chọn ${c.tag || c.name}`}
                            onChange={(e) => patchCalf(i, { picked: e.target.checked, barn: e.target.checked ? CALF_BARN.code : '' })}
                          />
                        </Td>
                        <Td className={TH}>{c.tag || 'Chưa gắn thẻ'}<br />{c.name}</Td>
                        <Td className={TH}>{c.mother}<br />{c.father}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{dmy(c.born)}</Td>
                        <Td className={TH}>{c.sex}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`${money(c.weight)} kg${c.estimated ? ' UT' : ''}`}</Td>
                        <Td className={TH}>
                          {c.picked ? <GhostSelect value={c.barn} onChange={(barn) => patchCalf(i, { barn })} options={CALF_BARN_OPTIONS} /> : '—'}
                        </Td>
                        <Td className={TH}>
                          {c.picked ? <GhostSelect value={c.purpose} onChange={(purpose) => patchCalf(i, { purpose })} options={PURPOSE_CHOICES} /> : '—'}
                        </Td>
                        <Td className={TH} />
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <p className="m-0 text-[11px] text-muted">
                  Bố, mẹ, giống, giới tính và cân sơ sinh lấy từ sự kiện đẻ – không sửa ở đây. Ngày nhập đàn của bê = ngày sinh; giai đoạn = Bê theo mẹ. Bê chưa gắn thẻ vẫn chọn được, hệ thống cấp mã và QR. Bê đã chết trước khi đăng ký được đánh dấu tại đây.
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <KV k="Tiền bò">{money(cowsMoney)} đ</KV>
                    <KV k="Phí vận chuyển"><GhostMoney value={freight} onChange={setFreight} /></KV>
                    <KV k="Tổng phải trả">{money(total)} đ</KV>
                    <KV k="Đã thanh toán"><GhostMoney value={paid} onChange={setPaid} /></KV>
                    <KV k="Còn nợ nguồn bán">{money(debt)} đ</KV>
                    <KV k="Phương thức">
                      <GhostSelect value={method} onChange={setMethod} options={PAY_METHODS.map((p) => ({ value: p, label: p }))} />
                    </KV>
                    <KV k="Hạn trả phần nợ">
                      <span className="relative inline-block">
                        {dmy(due)}
                        <input type="date" aria-label="Hạn trả phần nợ" value={due} onChange={(e) => setDue(e.target.value)} className="absolute inset-0 opacity-0" />
                      </span>
                    </KV>
                  </div>
                </Card>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[18px]">
            <Card title="Tóm tắt phiếu nhập" actions={<Badge>Nháp</Badge>}>
              <div className="flex flex-col gap-3">
                <KV k="Số con">{n}</KV>
                <KV k="Loại nhập">{isBuy ? 'Mua ngoài · theo phiếu' : 'Bê sinh tại trại'}</KV>
                {isBuy ? (
                  <KV k="Tổng cân nặng">{`${money(totalWeight)} kg${estimatedCount ? ` (${estimatedCount} con ước tính)` : ''}`}</KV>
                ) : (
                  <KV k="Tổng cân sơ sinh">{`${money(calfWeight)} kg${calfEstimated ? ` (${calfEstimated} con ước tính)` : ''}`}</KV>
                )}
                {isBuy && <KV k="Tổng phải trả">{money(total)} đ</KV>}
                {isBuy ? (
                  <KV k="Chuồng nhận">
                    <span className="text-xs font-semibold">
                      {barnAfter.length ? barnAfter.map((b) => `${barnLabel(b)} (${b.count}/${b.capacity} → ${b.after}/${b.capacity})`).join(' · ') : '—'}
                    </span>
                  </KV>
                ) : (
                  <>
                    <KV k="Chuồng nhận">{picked.length ? `${CALF_BARN.name} (${CALF_BARN.count}/${CALF_BARN.capacity} → ${calfAfter}/${CALF_BARN.capacity})` : '—'}</KV>
                    <KV k="Giai đoạn sống">Bê theo mẹ</KV>
                  </>
                )}
              </div>
              {!isBuy && <Note>Phiếu bê sinh tại trại không có giá và thanh toán.</Note>}
              {!isBuy && calfOver && <Note tone="err">{`Chuồng ${CALF_BARN.code} vượt sức chứa (${calfAfter}/${CALF_BARN.capacity}).`}</Note>}
              {isBuy && estimatedCount > 0 && <Note tone="warn">{`Cân nặng ${estimatedCount} con sẽ được lưu là ƯỚC TÍNH.`}</Note>}
              {isBuy && barnAfter.filter((b) => b.after === b.capacity).map((b) => <Note tone="warn" key={b.code}>{`Chuồng ${b.code} sẽ đầy (${b.after}/${b.capacity}) sau khi nhập.`}</Note>)}
              {isBuy && overflow.map((b) => <Note tone="err" key={b.code}>{`Chuồng ${b.code} vượt sức chứa (${b.after}/${b.capacity}).`}</Note>)}
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
              <Checkbox checked={printQr} onChange={(e) => setPrintQr(e.target.checked)}>
                <span className="text-[13px]">{`In tem QR cho ${n} con sau khi lưu`}</span>
              </Checkbox>
              <Button variant="primary" block disabled={!n || blocked} onClick={() => save('Đã nhập')}>
                {`Lưu & tạo hồ sơ ${n} con`}
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
      </div>

      {isBuy && editing >= 0 && (
        <RowEditModal
          key={editing}
          cow={cows[editing]}
          index={editing}
          recordId={BUY_ID}
          dateIso={date}
          pricing={pricing}
          others={cows.filter((_, idx) => idx !== editing)}
          onSave={(next) => { patchCow(editing, next); closeModal() }}
          onRemove={() => { setCows(cows.filter((_, idx) => idx !== editing)); closeModal() }}
          onClose={closeModal}
        />
      )}
      {isBuy && m === 'excel' && (
        <ExcelModal recordId={BUY_ID} onAdd={(added) => { setCows([...cows, ...added]); closeModal() }} onClose={closeModal} />
      )}
    </Layout>
  )
}
