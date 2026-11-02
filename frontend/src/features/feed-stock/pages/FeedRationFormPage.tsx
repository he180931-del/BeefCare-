import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, DateInput, Field, Foot, Info, Note, PageHeader, Radio, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { getFeedRation, listFeedRationFeeds, listFeedRationPens, listFeedRations, saveFeedRationDemoVersion } from '../api/feedRationApi'
import { initialFeedRationForm, nextRationCode, previewFeedRation, RATION_GROUPS, rationGroupLabel, toSaveFeedRationInput, validateFeedRationForm } from '../data/feedRationForm'
import { formatDate, formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedRation, FeedRationFormValues, FeedRationPenOption } from '../types/feedRation'
import type { FeedStockRow } from '../types'
import FeedManagementTabs from '../components/FeedManagementTabs'

const TITLE = 'Thức ăn › Khẩu phần'
const FOOT = 'Sửa khẩu phần (Chủ trại, Quản lý). Khẩu phần đang dùng không bị ghi đè: mỗi lần lưu tạo phiên bản mới với ngày hiệu lực từ ngày mai trở đi. Bảng tồn kho cho biết đủ dùng bao nhiêu ngày với lượng mới để nhắc nhập kho kịp thời.'
const SESSION_NAMES = ['Cữ sáng', 'Cữ chiều', 'Cữ tối']
const SESSION_LABEL = ['Sáng', 'Chiều', 'Tối']

const dayBefore = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
      <Layout title={TITLE} user="manager">
        <PageHeader title="Không thể mở khẩu phần" />
        <div role="alert" className="mb-4 text-sm text-err-fg">{userFacingError(query.error, 'Không thể mở khẩu phần.')}</div>
        <div><Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button></div>
      </Layout>
    )
  }
  if (query.loading || !query.data) return <Layout title={TITLE} user="manager"><p role="status" className="m-0 text-xs text-muted">Đang tải khẩu phần…</p></Layout>

  if (backendMode === 'backend') {
    if (!id) {
      return (
        <Layout title={TITLE} user="manager">
          <PageHeader title="Tạo khẩu phần" sub="Một số thông tin chưa sẵn sàng." />
          <FeedManagementTabs />
          <Note tone="warn">Lưu khẩu phần hiện chỉ hoạt động trong bản demo.</Note>
          <div><Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button></div>
        </Layout>
      )
    }
    return query.data.record ? <BackendRationDetail record={query.data.record} /> : (
      <Layout title={TITLE} user="manager"><PageHeader title="Không tìm thấy khẩu phần" /><div><Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button></div></Layout>
    )
  }

  if (id && !query.data.record) {
    return <Layout title={TITLE} user="manager"><PageHeader title="Không tìm thấy khẩu phần" /><div><Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button></div></Layout>
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
    <Layout title={TITLE} user="manager">
      <PageHeader title={`Khẩu phần ${record.rationCode} v${record.versionNo}`} sub="Phiên bản đang ở chế độ chỉ xem.">
        <Button onClick={() => navigate('/thuc-an/khau-phan')}>Quay lại danh sách</Button>
      </PageHeader>
      <FeedManagementTabs />
      <Card title={record.name} sub={`${rationGroupLabel(record.herdGroup)} · Hiệu lực ${formatDate(record.effectiveFrom)} – ${record.effectiveTo ? formatDate(record.effectiveTo) : '—'}`}>
        <p className="m-0 text-xs">Nguồn: {record.basis || '—'} · {record.sessionsPerDay} cữ/ngày · Chuồng: {record.penIds.length ? `${record.penIds.length} chuồng` : '—'}</p>
        <Table scroll>
          <thead><tr><Th>Thức ăn</Th><Th>Cữ 1</Th><Th>Cữ 2</Th><Th>Cữ 3</Th><Th>Tổng / đầu / ngày</Th><Th>Chi phí / đầu / ngày</Th></tr></thead>
          <tbody>{record.components.map((line) => (
            <tr key={line.feedItemId}>
              <Td>{line.feedCode} · {line.feedName}</Td><Td>{formatNumber(line.session1Kg, 3)}</Td><Td>{formatNumber(line.session2Kg, 3)}</Td><Td>{formatNumber(line.session3Kg, 3)}</Td><Td>{formatNumber(line.dailyKg, 3)} kg</Td><Td>{line.estimatedDailyCost === null ? '—' : formatVnd(line.estimatedDailyCost)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Note tone="warn">Lưu khẩu phần hiện chỉ hoạt động trong bản demo.</Note>
      <Foot>{FOOT}</Foot>
    </Layout>
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
  const replacing = record?.status === 'SCHEDULED' ? record : null
  const nextCode = record?.rationCode ?? nextRationCode(rows)
  const sameCode = record ? rows.filter((row) => row.rationCode === record.rationCode && row.id !== replacing?.id) : []
  const nextVersion = replacing ? replacing.versionNo : Math.max(0, ...sameCode.map((row) => row.versionNo)) + 1
  const inUse = sameCode.find((row) => row.status === 'EFFECTIVE') ?? (record?.status === 'EFFECTIVE' ? record : null)
  const previous = inUse
  const previousDailyCost = previous && previous.components.every((component) => component.estimatedDailyCost !== null)
    ? previous.components.reduce((sum, component) => sum + (component.estimatedDailyCost ?? 0), 0)
    : null
  const selectedPens = pens.filter((pen) => values.penIds.includes(pen.id))
  const lowCover = preview.lines.filter((line) => line.daysOfCover !== null && line.daysOfCover < 1)
  const costDiff = preview.dailyCostPerHead !== null && previousDailyCost !== null ? preview.dailyCostPerHead - previousDailyCost : null

  const update = <K extends keyof Omit<FeedRationFormValues, 'components' | 'sessionTimes' | 'penIds'>>(key: K, value: FeedRationFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError('')
  }
  const updateComponent = (index: number, key: keyof FeedRationFormValues['components'][number], value: string) => {
    setValues((current) => ({ ...current, components: current.components.map((component, i) => i === index ? { ...component, [key]: value } : component) }))
    setError('')
  }
  const updateSessionsPerDay = (sessionsPerDay: 1 | 2 | 3) => {
    setValues((current) => ({
      ...current,
      sessionsPerDay,
      sessionTimes: Array.from({ length: sessionsPerDay }, (_, index) => current.sessionTimes[index] || ['06:30', '16:30', '20:00'][index]),
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
      const saved = await saveFeedRationDemoVersion(toSaveFeedRationInput(values, record?.rationCode, replacing?.id))
      navigate('/thuc-an/khau-phan', { state: { rationMessage: `Khẩu phần ${saved.rationCode} v${saved.versionNo} đã lưu, hiệu lực từ ${formatDate(saved.effectiveFrom)}. Phiên bản trước kết thúc ngày ${formatDate(dayBefore(saved.effectiveFrom))}.` } })
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu khẩu phần. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const sessionCols = Array.from({ length: values.sessionsPerDay }, (_, index) => index)
  const penSummary = selectedPens.length ? selectedPens.map((pen) => pen.code).join(', ') : 'Chọn chuồng'
  return (
    <Layout title={TITLE} user="manager">
      <PageHeader
        title={record ? `Sửa khẩu phần ${record.rationCode}` : 'Tạo khẩu phần'}
        sub={record ? 'Sửa khẩu phần đang dùng sẽ tạo phiên bản mới, không ghi đè phiên bản cũ' : 'Lập lượng thức ăn theo đầu con cho từng cữ và chuồng áp dụng.'}
      />
      <FeedManagementTabs />
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Thông tin khẩu phần">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Mã" id="feed-ration-code"><input id="feed-ration-code" readOnly value={nextCode} className={inputCls} /></Field>
              <Field label="Tên khẩu phần *" id="feed-ration-name">
                <input id="feed-ration-name" maxLength={100} disabled={saving} value={values.name} onChange={(event) => update('name', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Phiên bản" id="feed-ration-version">
                <input id="feed-ration-version" readOnly value={`v${nextVersion}${inUse ? ` (đang dùng: v${inUse.versionNo})` : ''}`} className={inputCls} />
              </Field>
              <Field label="Nhóm đàn áp dụng" id="feed-ration-group">
                <Select id="feed-ration-group" aria-label="Nhóm đàn" disabled={saving} value={values.herdGroup} onChange={(event) => update('herdGroup', event.target.value)}>
                  <option value="">Chọn nhóm đàn</option>
                  {RATION_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
                </Select>
              </Field>
              <Field label="Chuồng áp dụng *" id="feed-ration-pens">
                <details className="group relative">
                  <summary id="feed-ration-pens" className={`${inputCls} flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden`}>
                    <span className="min-w-0 flex-1 truncate">{selectedPens.length ? selectedPens.map((pen) => `${pen.name} (${pen.headcount} con)`).join(', ') : 'Chọn chuồng'}</span>
                    <Icon name="chevron-down" className="text-muted" />
                  </summary>
                  <div className="absolute left-0 top-[calc(100%+4px)] z-20 flex max-h-[260px] w-[300px] flex-col gap-1 overflow-y-auto rounded-xl border border-field bg-white p-2 shadow-md">
                    {pens.filter((pen) => pen.status === 'ACTIVE').map((pen) => (
                      <label key={pen.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-page">
                        <input type="checkbox" aria-label={`${pen.code} · ${pen.headcount} con`} disabled={saving} checked={values.penIds.includes(pen.id)} onChange={() => togglePen(pen.id)} />
                        <span><strong>{pen.code}</strong> · {pen.name}<small className="ml-1 text-muted">{pen.headcount} con</small></span>
                      </label>
                    ))}
                  </div>
                </details>
              </Field>
              <Field label="Hiệu lực từ *" id="feed-ration-effective-from" hint="Không sớm hơn ngày mai">
                <DateInput id="feed-ration-effective-from" readOnly={saving} value={values.effectiveFrom} onChange={(value) => update('effectiveFrom', value)} />
              </Field>
            </div>
            <Field label="Căn cứ / nguồn" id="feed-ration-basis">
              <input id="feed-ration-basis" maxLength={500} disabled={saving} value={values.basis} onChange={(event) => update('basis', event.target.value)} className={inputCls} />
            </Field>
          </Card>

          <Card
            title="Thành phần theo cữ"
            sub="Lượng tính theo kg / con"
            actions={<Button size="sm" disabled={saving} onClick={addComponent}><span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Thêm thức ăn</span></Button>}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <span className="text-xs font-medium">Số cữ / ngày</span>
              {[1, 2, 3].map((count) => (
                <Radio key={count} name="feed-ration-sessions" checked={values.sessionsPerDay === count} onChange={() => updateSessionsPerDay(count as 1 | 2 | 3)}>{count} cữ</Radio>
              ))}
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {values.sessionTimes.map((time, index) => (
                  <label key={index} className="inline-flex items-center gap-1">
                    {SESSION_LABEL[index]}
                    <input aria-label={`Giờ cữ ${index + 1}`} type="time" disabled={saving} value={time} onChange={(event) => updateSessionTime(index, event.target.value)} className="h-8 rounded-lg border border-field bg-white px-1.5 text-xs text-ink outline-none focus:border-brand" />
                  </label>
                ))}
              </span>
            </div>
            <Table scroll stack={false}>
              <thead><tr>
                <Th>Thức ăn</Th>
                {sessionCols.map((index) => <Th key={index} className="whitespace-nowrap">{SESSION_NAMES[index]}</Th>)}
                <Th className="whitespace-nowrap">Tổng/con/ngày</Th><Th className="whitespace-nowrap">Đơn giá BQ</Th><Th className="whitespace-nowrap">đ/con/ngày</Th><Th aria-label="Xóa" />
              </tr></thead>
              <tbody>
                {values.components.map((component, index) => {
                  const line = preview.lines[index]
                  const unitCost = line?.feed && line.feed.onHandKg > 0 ? line.feed.stockValue / line.feed.onHandKg : null
                  return (
                    <tr key={`component-${index}`}>
                      <Td className="min-w-[160px]">
                        <Select aria-label={`Thức ăn dòng ${index + 1}`} disabled={saving} value={component.feedItemId} onChange={(event) => updateComponent(index, 'feedItemId', event.target.value)}>
                          <option value="">Chọn thức ăn</option>
                          {feeds.filter((feed) => feed.available !== false || Number(component.feedItemId) === feed.feedItemId).map((feed) => <option key={feed.feedItemId} value={feed.feedItemId}>{feed.code} · {feed.name}{feed.available === false ? ' · Ngừng hoạt động' : ''}</option>)}
                        </Select>
                      </Td>
                      {sessionCols.map((sessionIndex) => {
                        const key = (['session1Kg', 'session2Kg', 'session3Kg'] as const)[sessionIndex]
                        return (
                          <Td key={sessionIndex}>
                            <input aria-label={`Kg/đầu/cữ ${sessionIndex + 1} dòng ${index + 1}`} type="number" min="0" step="0.001" disabled={saving} value={component[key]} onChange={(event) => updateComponent(index, key, event.target.value)} className="h-10 w-[76px] rounded-xl border border-field bg-white px-2 text-sm outline-none focus:border-brand" />
                          </Td>
                        )
                      })}
                      <Td className="whitespace-nowrap">{formatNumber(line?.dailyKg ?? 0, 3)} kg</Td>
                      <Td className="whitespace-nowrap">{unitCost === null ? '—' : `${formatNumber(unitCost, 0)} đ/kg`}</Td>
                      <Td className="whitespace-nowrap">{line?.dailyCost === null || line?.dailyCost === undefined ? '—' : formatNumber(line.dailyCost, 0)}</Td>
                      <Td><Button variant="link" size="sm" disabled={saving || values.components.length <= 1} aria-label={`Xóa thức ăn dòng ${index + 1}`} onClick={() => removeComponent(index)}>Xóa</Button></Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <Td className="font-semibold">Tổng</Td>
                  {sessionCols.map((sessionIndex) => (
                    <Td key={sessionIndex} className="whitespace-nowrap font-semibold">
                      {formatNumber(preview.lines.reduce((sum, line) => sum + (sessionIndex === 0 ? line.session1Kg : sessionIndex === 1 ? line.session2Kg : line.session3Kg), 0), 3)} kg
                    </Td>
                  ))}
                  <Td className="whitespace-nowrap font-semibold">{formatNumber(preview.dailyKgPerHead, 3)} kg</Td>
                  <Td />
                  <Td className="whitespace-nowrap font-semibold">{preview.dailyCostPerHead === null ? '—' : formatNumber(preview.dailyCostPerHead, 0)}</Td>
                  <Td />
                </tr>
              </tfoot>
            </Table>
            <p className="m-0 text-[11px] text-muted">Đơn giá lấy theo giá nhập bình quân hiện tại trong kho – chỉ dùng để ước tính chi phí.</p>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <h3 className="m-0 flex-1 text-sm font-semibold">Tóm tắt khẩu phần</h3>
              <Badge tone="info">Sắp áp dụng</Badge>
            </div>
            <Info cols={2} items={[
              ['Lượng / con / ngày', `${formatNumber(preview.dailyKgPerHead, 2)} kg`],
              ['Chi phí / con / ngày', preview.dailyCostPerHead === null ? '—' : formatVnd(preview.dailyCostPerHead)],
              [previous ? `So với v${previous.versionNo}` : 'So với bản trước', costDiff === null ? '—' : `${costDiff > 0 ? '+' : costDiff < 0 ? '−' : ''}${formatNumber(Math.abs(costDiff), 0)} đ/con/ngày`],
              ['Áp dụng', selectedPens.length ? `${penSummary} · ${preview.headcount} con` : '—'],
            ]} />
            <div className="rounded-md bg-chip px-3 py-2.5 text-xs">
              {selectedPens.length
                ? `${penSummary} · ${preview.headcount} con → ${formatNumber(preview.plannedDailyKg, 0)} kg/ngày · ${preview.plannedDailyCost === null ? '—' : `${formatNumber(preview.plannedDailyCost, 0)} đ/ngày`}`
                : 'Chọn chuồng để xem kế hoạch theo số con.'}
            </div>
            <h4 className="m-0 text-xs font-semibold">Tồn kho đủ dùng</h4>
            <Table stack={false}>
              <thead><tr><Th>Thức ăn</Th><Th>Tồn → đủ dùng</Th></tr></thead>
              <tbody>
                {preview.lines.filter((line) => line.feed).map((line, index) => {
                  const low = line.daysOfCover !== null && line.daysOfCover < 1
                  return (
                    <tr key={`${line.feed?.feedItemId}-${index}`} className={low ? 'bg-warn-bg' : undefined}>
                      <Td className="font-medium">{line.feed?.name}</Td>
                      <Td className={`whitespace-nowrap ${low ? 'text-err-fg' : ''}`}>{formatNumber(line.feed?.onHandKg ?? 0, 0)} kg → {line.daysOfCover === null ? '—' : `${formatNumber(line.daysOfCover, 1)} ngày`}</Td>
                    </tr>
                  )
                })}
                {!preview.lines.some((line) => line.feed) && <tr><Td colSpan={2} className="text-muted">Chọn thức ăn để xem tồn kho đủ dùng.</Td></tr>}
              </tbody>
            </Table>
          </Card>

          <Card>
            <h3 className="m-0 text-[13px] font-semibold">Kiểm tra trước khi lưu</h3>
            <div className="flex gap-2 text-xs"><span aria-hidden="true" className="font-bold text-brand">✓</span><span>Thức ăn đang dùng trong danh mục, lượng &gt; 0</span></div>
            <div className="flex gap-2 text-xs"><span aria-hidden="true" className="font-bold text-brand">✓</span><span>Mỗi chuồng chỉ có 1 khẩu phần hiệu lực mỗi ngày</span></div>
            {lowCover.map((line, index) => (
              <div key={index} className="flex gap-2 text-xs text-warn-fg"><span aria-hidden="true" className="font-bold">!</span><span>{line.feed?.name} không đủ cho 1 ngày – nhập kho trước {formatDate(values.effectiveFrom)}</span></div>
            ))}
          </Card>

          <Note tone="info">
            Lưu sẽ tạo phiên bản v{nextVersion} hiệu lực từ {formatDate(values.effectiveFrom)}{inUse ? `; v${inUse.versionNo} tự kết thúc ngày ${formatDate(dayBefore(values.effectiveFrom))}` : ''}. Nhật ký cho ăn đã ghi không đổi.
          </Note>
          <div className="flex flex-col gap-2.5">
            <Button variant="primary" block disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lưu khẩu phần'}</Button>
            <Button block disabled={saving} onClick={() => navigate('/thuc-an/khau-phan')}>Hủy</Button>
          </div>
        </aside>
      </div>
      <Foot>{FOOT}</Foot>
    </Layout>
  )
}
