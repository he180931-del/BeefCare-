import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, Note, PageHeader, Select, Table, Td, Th, Tile, Textarea, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { getFeedRation, listFeedRationFeeds, listFeedRationPens, listFeedRations, saveFeedRationDemoVersion } from '../api/feedRationApi'
import { initialFeedRationForm, localRationDate, nextRationCode, previewFeedRation, RATION_GROUPS, rationGroupLabel, toSaveFeedRationInput, validateFeedRationForm } from '../data/feedRationForm'
import type { FeedRation, FeedRationFormValues, FeedRationPenOption } from '../types/feedRation'
import type { FeedStockRow } from '../types'
import FeedManagementTabs from '../components/FeedManagementTabs'

const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

export default function FeedRationFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useQuery(async () => {
    if (backendMode === 'backend') return { record: id ? await getFeedRation(id) : null, rows: [], pens: [], feeds: [] }
    const [rows, pens, feeds] = await Promise.all([listFeedRations(), listFeedRationPens(), listFeedRationFeeds()])
    return { record: id ? rows.find((row) => String(row.id) === id) ?? null : null, rows, pens, feeds }
  }, [id])

  if (query.error) {
    return (
      <Layout title="Thức ăn – Khẩu phần" user="manager">
        <PageHeader title="Không thể mở khẩu phần" />
        <div role="alert" className="mb-4 text-sm text-err-fg">{userFacingError(query.error, 'Không thể mở khẩu phần.')}</div>
        <Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button>
      </Layout>
    )
  }
  if (query.loading || !query.data) return <Layout title="Thức ăn – Khẩu phần" user="manager"><p role="status" className="m-0 text-xs text-muted">Đang tải khẩu phần…</p></Layout>

  if (backendMode === 'backend') {
    if (!id) {
      return (
        <Layout title="Thức ăn – Khẩu phần" user="manager">
          <PageHeader title="Tạo khẩu phần" sub="Một số thông tin chưa sẵn sàng." />
          <FeedManagementTabs />
          <Note tone="warn">Lưu khẩu phần hiện chỉ hoạt động trong bản demo.</Note>
          <Button className="mt-4" onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button>
        </Layout>
      )
    }
    return query.data.record ? <BackendRationDetail record={query.data.record} /> : (
      <Layout title="Thức ăn – Khẩu phần" user="manager"><PageHeader title="Không tìm thấy khẩu phần" /><Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button></Layout>
    )
  }

  if (id && !query.data.record) {
    return <Layout title="Thức ăn – Khẩu phần" user="manager"><PageHeader title="Không tìm thấy khẩu phần" /><Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button></Layout>
  }

  return (
    <FeedRationForm
      key={id ?? 'new-ration'}
      record={query.data.record}
      rows={query.data.rows}
      pens={query.data.pens}
      feeds={query.data.feeds}
    />
  )
}

function BackendRationDetail({ record }: { record: FeedRation }) {
  const navigate = useNavigate()
  return (
    <Layout title="Thức ăn – Khẩu phần" user="manager">
      <PageHeader title="Chi tiết phiên bản khẩu phần" sub={`${record.rationCode} v${record.versionNo}`}>
        <Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button>
      </PageHeader>
      <FeedManagementTabs />
      <Card title={record.name} sub={`${rationGroupLabel(record.herdGroup)} · Hiệu lực ${record.effectiveFrom} – ${record.effectiveTo ?? '—'}`}>
        <p className="m-0 text-xs">Nguồn: {record.basis || '—'} · {record.sessionsPerDay} cữ/ngày · Chuồng: {record.penIds.length ? `${record.penIds.length} chuồng` : '—'}</p>
        <RationComponentsView record={record} />
      </Card>
      <Note tone="warn">Phiên bản đang ở chế độ chỉ xem. Lưu khẩu phần hiện chỉ hoạt động trong bản demo.</Note>
    </Layout>
  )
}

function RationComponentsView({ record }: { record: FeedRation }) {
  return (
    <Table scroll>
      <thead><tr><Th>Thức ăn</Th><Th>Cữ 1</Th><Th>Cữ 2</Th><Th>Cữ 3</Th><Th>Tổng / đầu / ngày</Th><Th>Chi phí / đầu / ngày</Th></tr></thead>
      <tbody>{record.components.map((line) => (
        <tr key={line.feedItemId}>
          <Td>{line.feedCode} · {line.feedName}</Td><Td>{quantity.format(line.session1Kg)}</Td><Td>{quantity.format(line.session2Kg)}</Td><Td>{quantity.format(line.session3Kg)}</Td><Td>{quantity.format(line.dailyKg)} kg</Td><Td>{line.estimatedDailyCost === null ? '—' : `${currency.format(line.estimatedDailyCost)} đ`}</Td>
        </tr>
      ))}</tbody>
    </Table>
  )
}

function FeedRationForm({ record, rows, pens, feeds }: {
  record: FeedRation | null
  rows: FeedRation[]
  pens: FeedRationPenOption[]
  feeds: FeedStockRow[]
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FeedRationFormValues>(() => initialFeedRationForm(record))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const preview = useMemo(() => previewFeedRation(values, feeds, pens), [values, feeds, pens])
  const nextCode = record?.rationCode ?? nextRationCode(rows)
  const nextVersion = record ? Math.max(0, ...rows.filter((row) => row.rationCode === record.rationCode).map((row) => row.versionNo)) + 1 : 1
  const previousDailyKg = record?.components.reduce((sum, component) => sum + component.dailyKg, 0) ?? null
  const previousDailyCost = record && record.components.every((component) => component.estimatedDailyCost !== null)
    ? record.components.reduce((sum, component) => sum + (component.estimatedDailyCost ?? 0), 0)
    : null

  const update = <K extends keyof Omit<FeedRationFormValues, 'components' | 'sessionTimes' | 'penIds'>>(key: K, value: FeedRationFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError('')
  }
  const updateComponent = (index: number, key: keyof FeedRationFormValues['components'][number], value: string) => {
    setValues((current) => ({ ...current, components: current.components.map((component, i) => i === index ? { ...component, [key]: value } : component) }))
    setError('')
  }
  const updateSessionsPerDay = (nextValue: string) => {
    const sessionsPerDay = Number(nextValue) as 1 | 2 | 3
    setValues((current) => ({
      ...current,
      sessionsPerDay,
      sessionTimes: Array.from({ length: sessionsPerDay }, (_, index) => current.sessionTimes[index] ?? (index === 1 ? '16:30' : '')),
      components: current.components.map((component) => ({
        ...component,
        session2Kg: sessionsPerDay < 2 ? '0' : component.session2Kg,
        session3Kg: sessionsPerDay < 3 ? '0' : component.session3Kg,
      })),
    }))
    setError('')
  }
  const updateSessionTime = (index: number, value: string) => {
    setValues((current) => ({ ...current, sessionTimes: current.sessionTimes.map((time, i) => i === index ? value : time) }))
    setError('')
  }
  const togglePen = (penId: number) => {
    setValues((current) => ({ ...current, penIds: current.penIds.includes(penId) ? current.penIds.filter((id) => id !== penId) : [...current.penIds, penId] }))
    setError('')
  }
  const addComponent = () => setValues((current) => ({ ...current, components: [...current.components, { feedItemId: '', session1Kg: '0', session2Kg: '0', session3Kg: '0' }] }))
  const removeComponent = (index: number) => setValues((current) => ({ ...current, components: current.components.filter((_, i) => i !== index) }))

  const submit = async () => {
    if (savingRef.current) return
    const validation = validateFeedRationForm(values, feeds, pens)
    if (validation) {
      setError(validation)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await saveFeedRationDemoVersion(toSaveFeedRationInput(values, record?.rationCode))
      navigate('/thuc-an/khau-phan', { state: { rationMessage: `Đã lưu ${saved.rationCode} phiên bản ${saved.versionNo} trong bản demo.` } })
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu khẩu phần. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const penHeadcount = preview.headcount
  return (
    <Layout title="Thức ăn – Khẩu phần" user="manager">
      <PageHeader title={record ? 'Sửa khẩu phần – tạo phiên bản mới' : 'Tạo khẩu phần'} sub="Lập lượng thức ăn theo đầu con cho từng cữ và chuồng áp dụng.">
        <Button disabled={saving} onClick={() => navigate('/thuc-an/khau-phan')}>Hủy</Button>
      </PageHeader>
      <Badge tone="info">Dữ liệu minh họa</Badge>
      <FeedManagementTabs />
      {record && <Note tone="info">Phiên bản hiện tại {record.rationCode} v{record.versionNo} sẽ được giữ lại trong lịch sử.</Note>}
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Thông tin khẩu phần">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Mã khẩu phần / phiên bản" id="feed-ration-code">
                <input id="feed-ration-code" readOnly value={`${nextCode} · v${nextVersion}`} className={inputCls} />
              </Field>
              <Field label="Tên khẩu phần *" id="feed-ration-name">
                <input id="feed-ration-name" maxLength={100} disabled={saving} value={values.name} onChange={(event) => update('name', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Nhóm đàn" id="feed-ration-group">
                <Select id="feed-ration-group" aria-label="Nhóm đàn" disabled={saving} value={values.herdGroup} onChange={(event) => update('herdGroup', event.target.value)}>
                  <option value="">Chọn nhóm đàn</option>
                  {RATION_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
                </Select>
              </Field>
              <Field label="Hiệu lực từ *" id="feed-ration-effective-from">
                <input id="feed-ration-effective-from" aria-label="Hiệu lực từ" type="date" min={localRationDate(1)} disabled={saving} value={values.effectiveFrom} onChange={(event) => update('effectiveFrom', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Số cữ mỗi ngày *" id="feed-ration-sessions">
                <Select id="feed-ration-sessions" aria-label="Số cữ mỗi ngày" disabled={saving} value={values.sessionsPerDay} onChange={(event) => updateSessionsPerDay(event.target.value)}>
                  <option value={1}>1 cữ</option><option value={2}>2 cữ</option><option value={3}>3 cữ</option>
                </Select>
              </Field>
              <Field label="Nguồn / căn cứ" id="feed-ration-basis">
                <Textarea id="feed-ration-basis" aria-label="Nguồn / căn cứ" maxLength={500} disabled={saving} value={values.basis} onChange={(event) => update('basis', event.target.value)} />
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {values.sessionTimes.map((time, index) => (
                <Field key={index} label={`Giờ cữ ${index + 1} *`} id={`feed-ration-time-${index}`}>
                  <input id={`feed-ration-time-${index}`} aria-label={`Giờ cữ ${index + 1}`} type="time" disabled={saving} value={time} onChange={(event) => updateSessionTime(index, event.target.value)} className={inputCls} />
                </Field>
              ))}
            </div>
          </Card>

          <Card title="Chuồng áp dụng *" sub="Chọn chuồng đang hoạt động; số đầu con lấy từ dữ liệu chuồng hiện có.">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {pens.filter((pen) => pen.status === 'ACTIVE').map((pen) => (
                <label key={pen.id} className="flex cursor-pointer items-start gap-2 rounded border border-edge p-3 text-xs">
                  <input type="checkbox" aria-label={`${pen.code} · ${pen.headcount} con`} disabled={saving} checked={values.penIds.includes(pen.id)} onChange={() => togglePen(pen.id)} />
                  <span><strong>{pen.code}</strong> · {pen.name}<small className="block text-muted">{pen.headcount} con</small></span>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Thành phần thức ăn" sub="Khối lượng tính theo kg trên mỗi đầu con trong từng cữ." actions={<Button size="sm" disabled={saving} onClick={addComponent}>+ Thêm thức ăn</Button>}>
            <Table scroll>
              <thead><tr>
                <Th>Thức ăn *</Th><Th>Cữ 1 · kg</Th>{values.sessionsPerDay >= 2 && <Th>Cữ 2 · kg</Th>}{values.sessionsPerDay >= 3 && <Th>Cữ 3 · kg</Th>}<Th>Tổng kg/đầu/ngày</Th><Th>Giá bình quân</Th><Th>Chi phí/đầu/ngày</Th><Th></Th>
              </tr></thead>
              <tbody>
                {values.components.map((component, index) => {
                  const line = preview.lines[index]
                  return (
                    <tr key={`component-${index}`}>
                      <Td>
                        <Select aria-label={`Thức ăn dòng ${index + 1}`} disabled={saving} value={component.feedItemId} onChange={(event) => updateComponent(index, 'feedItemId', event.target.value)}>
                          <option value="">Chọn thức ăn</option>
                          {feeds.filter((feed) => feed.available !== false || Number(component.feedItemId) === feed.feedItemId).map((feed) => <option key={feed.feedItemId} value={feed.feedItemId}>{feed.code} · {feed.name}{feed.available === false ? ' · Ngừng hoạt động' : ''}</option>)}
                        </Select>
                      </Td>
                      <Td><input aria-label={`Kg/đầu/cữ 1 dòng ${index + 1}`} type="number" min="0" step="0.001" disabled={saving} value={component.session1Kg} onChange={(event) => updateComponent(index, 'session1Kg', event.target.value)} className={`${inputCls} min-w-[100px]`} /></Td>
                      {values.sessionsPerDay >= 2 && <Td><input aria-label={`Kg/đầu/cữ 2 dòng ${index + 1}`} type="number" min="0" step="0.001" disabled={saving} value={component.session2Kg} onChange={(event) => updateComponent(index, 'session2Kg', event.target.value)} className={`${inputCls} min-w-[100px]`} /></Td>}
                      {values.sessionsPerDay >= 3 && <Td><input aria-label={`Kg/đầu/cữ 3 dòng ${index + 1}`} type="number" min="0" step="0.001" disabled={saving} value={component.session3Kg} onChange={(event) => updateComponent(index, 'session3Kg', event.target.value)} className={`${inputCls} min-w-[100px]`} /></Td>}
                      <Td>{quantity.format(line?.dailyKg ?? 0)}</Td>
                      <Td>{line?.feed && line.feed.onHandKg > 0 ? `${currency.format(line.feed.stockValue / line.feed.onHandKg)} đ/kg` : '—'}</Td>
                      <Td>{line?.dailyCost === null || line?.dailyCost === undefined ? '—' : `${currency.format(line.dailyCost)} đ`}</Td>
                      <Td><Button size="sm" disabled={saving || values.components.length <= 1} aria-label={`Xóa thức ăn dòng ${index + 1}`} onClick={() => removeComponent(index)}>Xóa</Button></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>
        </div>

        <aside className="flex flex-col gap-3">
          <Tile label="Lượng mỗi đầu con / ngày" value={`${quantity.format(preview.dailyKgPerHead)} kg`} note={record && previousDailyKg !== null ? `Phiên bản trước: ${quantity.format(previousDailyKg)} kg` : 'Tổng lượng qua các cữ'} />
          <Tile label="Chi phí mỗi đầu con / ngày" value={preview.dailyCostPerHead === null ? '—' : `${currency.format(preview.dailyCostPerHead)} đ`} note={record && previousDailyCost !== null ? `Phiên bản trước: ${currency.format(previousDailyCost)} đ` : 'Theo giá bình quân hiện có'} />
          <Tile label="Kế hoạch cho chuồng đã chọn" value={`${quantity.format(preview.plannedDailyKg)} kg/ngày`} note={`${penHeadcount} đầu con · ${preview.plannedDailyCost === null ? '—' : `${currency.format(preview.plannedDailyCost)} đ/ngày`}`} />
          <Card title="Số ngày đủ dùng">
            {preview.lines.map((line, index) => (
              <p key={index} className="m-0 flex justify-between gap-2 text-xs"><span>{line.feed?.name ?? 'Chọn thức ăn'}</span><strong>{line.daysOfCover === null ? '—' : `${quantity.format(line.daysOfCover)} ngày`}</strong></p>
            ))}
          </Card>
          {preview.dailyCostPerHead === null && <Note tone="warn">Chưa có đủ giá bình quân để tính chi phí cho một số thức ăn.</Note>}
          {preview.lines.some((line) => line.daysOfCover !== null && line.daysOfCover < 1) && <Note tone="warn">Có thức ăn chưa đủ tồn cho một ngày theo số đầu con đã chọn.</Note>}
          <Note tone="info">Phiên bản áp dụng từ ngày mai trở đi. Các lần cho ăn đã ghi sẽ không thay đổi.</Note>
          <div className="flex flex-col gap-2 rounded-md border border-edge bg-white p-4">
            <strong className="text-xs">Kiểm tra trước khi lưu</strong>
            <span className="text-xs text-muted">Mỗi chuồng có tối đa một khẩu phần hiệu lực trong một ngày.</span>
            <Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : 'Lưu khẩu phần'}</Button>
            <Button disabled={saving} onClick={() => navigate('/thuc-an/khau-phan')}>Hủy</Button>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
