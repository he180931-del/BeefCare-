import { useState } from 'react'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Button, Card, DateInput, ErrorBlock, FilterSelect, Foot, LoadingBlock, Metric, Note, PageHeader, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { financeApi } from '../api/financeApi'
import { FlashNote, RoField, useFlash } from '../components/common'
import { IncomeChart, ScopeTable } from '../components/ReportParts'
import { formatDate, formatDateTime, formatMoney, formatVnd, validateCriteria } from '../domain/financeRules'
import type { CashReport, ReportCriteria, ScopeTotals, SourceFilter } from '../types'

const TITLE = 'Báo cáo dòng tiền nền tảng'
const SOURCE_LABEL: Record<SourceFilter, string> = { BOTH: 'Biên nhận + thủ công', RECEIPTS: 'Chỉ biên nhận gói', MANUAL: 'Chỉ khoản thủ công' }
const scopeLabel = (c: ReportCriteria, farmName: string) => `${c.dateFrom.slice(8, 10)}/${c.dateFrom.slice(5, 7)}–${formatDate(c.dateTo)} · ${farmName} · Asia/Ho_Chi_Minh · VND`

/** SCR-73: báo cáo dòng tiền nền tảng chạy trên bản chốt, xuất XLSX đúng bản chốt đang xem. */
export default function CashReportRoutes() {
  const [m, open, close] = useModalParam()
  const demo = useDemoState()
  const [flash, setFlash] = useFlash()
  const [criteria, setCriteria] = useState<ReportCriteria>({ dateFrom: '2026-10-01', dateTo: '2026-10-18', farmId: null, sourceFilter: 'BOTH' })
  const [shown, setShown] = useState<CashReport | null>(null)
  const [focus, setFocus] = useState<ScopeTotals | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const farms = useQuery(() => financeApi.listFarms(), [])
  const { data, loading, error, refetch } = useQuery(() => financeApi.currentReport(), [])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được báo cáo.')} onRetry={refetch} /></Layout>

  const report = shown ?? data
  const expired = report.expired || demo === 'het-han'
  const s = report.summary
  const farmLabel = report.criteria.farmId ? farms.data?.find((f) => f.id === report.criteria.farmId)?.name ?? 'Một trại' : 'Tất cả trại'
  const dirty = JSON.stringify(criteria) !== JSON.stringify(report.criteria)
  const setCrit = (p: Partial<ReportCriteria>) => setCriteria((c) => ({ ...c, ...p }))

  const run = async () => {
    const problem = validateCriteria(criteria)
    if (problem) { setFormError(problem); return }
    setBusy(true); setFormError(null)
    try {
      const next = await financeApi.runReport(criteria)
      setShown(next)
      setFlash({ tone: 'ok', text: `Báo cáo ${next.code} được tạo lúc ${formatDateTime(next.generatedAt)}.` })
      open(next.lines.length === 0 ? 'rong' : 'lam-moi')
    } catch (e) { setFormError(userFacingError(e, 'Không chạy được báo cáo.')) } finally { setBusy(false) }
  }
  const doExport = async () => {
    open('dang-tao')
    try {
      if (demo === 'xuat-loi') throw new Error('export-failed')
      const file = await financeApi.exportXlsx(report.id)
      close()
      setFlash({ tone: 'ok', text: `Tệp xuất ${file.fileName} đã sẵn sàng.` })
    } catch (e) {
      open(report.expired || (e instanceof Error && /hết hạn/.test(e.message)) ? 'het-han' : 'xuat-loi')
    }
  }
  const refreshAndClose = async () => { close(); await run() }
  const critText = scopeLabel(report.criteria, farmLabel)
  const snapshot = `${report.code} · ${formatDateTime(report.generatedAt)}`

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub="Biên nhận tính theo thời điểm ngân hàng ghi nhận; khoản thủ công đã ghi sổ tính theo ngày phát sinh · giờ Việt Nam">
          <Button onClick={() => open('xuat')}><Icon name="table-export" size={16} /> Xuất XLSX</Button>
        </PageHeader>
        <FlashNote flash={flash} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-[12px] text-muted">Kỳ *<div className="w-[150px]"><DateInput id="rp-from" value={criteria.dateFrom} onChange={(v) => setCrit({ dateFrom: v })} /></div>–<div className="w-[150px]"><DateInput id="rp-to" value={criteria.dateTo} onChange={(v) => setCrit({ dateTo: v })} /></div></div>
          <div className="w-[200px]"><FilterSelect aria-label="Trang trại" value={criteria.farmId ?? ''} onChange={(e) => setCrit({ farmId: e.target.value ? Number(e.target.value) : null })}><option value="">Trang trại: Tất cả</option>{(farms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</FilterSelect></div>
          <div className="w-[240px]"><FilterSelect aria-label="Nguồn" value={criteria.sourceFilter} onChange={(e) => setCrit({ sourceFilter: e.target.value as SourceFilter })}>{(Object.keys(SOURCE_LABEL) as SourceFilter[]).map((k) => <option key={k} value={k}>Nguồn: {SOURCE_LABEL[k]}</option>)}</FilterSelect></div>
        </div>
        {formError && <Note tone="err">{formError}</Note>}
        {expired && <div role="alert"><Note tone="warn">Kết quả báo cáo này đã hết hạn. Hãy chạy lại báo cáo.</Note></div>}
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <div className="text-[13px] font-semibold text-ink">Kết quả đang xem · {report.code}</div>
              <div className="text-[11px] text-muted">Dữ liệu chốt lúc {formatDateTime(report.generatedAt)} · đơn vị đồng. Xuất XLSX dùng đúng kết quả và bộ lọc đang xem.{dirty ? ' Bộ lọc đã đổi – hãy chạy lại để cập nhật.' : ''}</div>
            </div>
            <Button variant="link" onClick={() => open('chi-tiet')}>Xem chi tiết giao dịch</Button>
            <Button onClick={run} disabled={busy}><Icon name="refresh" size={16} /> Chạy / làm mới báo cáo</Button>
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Tổng thu" value={`${formatVnd(s.totalIncome)} đ`} note={`Gói ${formatVnd(s.subscriptionReceipts)} · thu khác ${formatVnd(s.otherIncome)}`} />
          <Metric label="Tổng chi" value={`${formatVnd(s.totalExpense)} đ`} note="Chỉ khoản đã ghi sổ" />
          <Metric label="Dòng tiền ròng" value={`${formatMoney(s.netCashFlow)} đ`} note="Không gồm nháp, hủy bỏ, chứng từ chưa khớp" />
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_416px]">
          <Card title="Thu theo ngày" sub="Biên nhận gói + thu khác đã ghi sổ · triệu đồng"><IncomeChart days={s.dailyIncome} /></Card>
          <Card title="Phạm vi tính">
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[12px] text-ink">
              <li>• Thu gồm biên nhận gói và thu khác đã ghi sổ.</li>
              <li>• Khoản chung nền tảng được tách riêng; không tính vào dòng tiền ròng khi lọc một trại.</li>
              <li>• Nháp, đã hủy bỏ, tiền chuyển nhầm và khoản hoàn ngoài hệ thống không vào tổng.</li>
              <li className="text-muted">• {s.note}</li>
            </ul>
          </Card>
        </div>
        <ScopeTable scopes={s.scopes} onFarm={(row) => { setFocus(row); open('rieng-trai') }} />
        <Foot>Báo cáo dòng tiền nền tảng (PM). Báo cáo chạy trên một bản chốt dữ liệu (snapshot) để số liệu không đổi khi xem và xuất; &quot;Chạy / làm mới&quot; tạo bản chốt mới. Biểu đồ cột hiển thị thu theo ngày trong kỳ, bảng dưới chia theo phạm vi.</Foot>
      </div>

      {m === 'chi-tiet' && (
        <Modal title="Chi tiết giao dịch của báo cáo" width={840} onClose={close}>
          <div className="flex flex-col gap-3">
            <RoField label="Bản chốt / thời điểm" value={snapshot} />
            <RoField label="Tiêu chí" value={`${formatDate(report.criteria.dateFrom).slice(0, 5)} – ${formatDate(report.criteria.dateTo)} · ${farmLabel} · VND · Asia/Ho_Chi_Minh`} />
            {report.lines.length === 0 ? <Note tone="info">Chi tiết rỗng; bộ lọc và thời điểm chốt được giữ.</Note> : (
              <div className="max-h-[320px] overflow-auto">
                <Table stack={false}>
                  <thead><tr><Th>Mã</Th><Th>Phạm vi</Th><Th>Danh mục</Th><Th>Số tiền</Th><Th>Ngày</Th><Th>Nguồn</Th></tr></thead>
                  <tbody>{report.lines.map((l) => (
                    <tr key={l.code}><Td>{l.code}</Td><Td>{l.farmName}</Td><Td>{l.category}</Td><Td><span className={l.direction === 'OUT' ? 'text-err-fg' : ''}>{l.direction === 'OUT' ? '−' : '+'}{formatVnd(l.amountVnd)}</span></Td><Td>{formatDate(l.cashDate)}</Td><Td>{l.reference}</Td></tr>
                  ))}</tbody>
                </Table>
              </div>
            )}
            <Note tone="info">Các dòng là dữ liệu và phiên bản đã chốt trong bản chốt. Mở nguồn được kiểm tra quyền riêng. Biên nhận tính theo bank_paid; khoản Đã ghi sổ tính theo ngày phát sinh.</Note>
          </div>
          <ModalFooter><ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton></ModalFooter>
        </Modal>
      )}
      {m === 'rieng-trai' && focus && (
        <Modal title={`Báo cáo riêng ${focus.farmName.replace('Trại bò ', 'Trại ').replace(' – Ba Vì', '')}`} width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <RoField label="Bản chốt / thời điểm" value={snapshot} />
              <RoField label="Biên nhận đăng ký gói" value={`${formatVnd(focus.subscriptionReceipts)} VND`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RoField label="Thu thủ công / chi thủ công" value={`${formatVnd(focus.otherIncome)} / ${formatVnd(focus.expense)} VND`} />
              <RoField label="Ròng của trại" value={`${formatMoney(focus.subscriptionReceipts + focus.otherIncome - focus.expense)} VND`} />
            </div>
            <RoField label="Khoản chung nền tảng (tham khảo)" value={`Chi ${formatVnd(s.scopes.find((x) => x.scope === 'GENERAL')?.expense ?? 0)} VND · Không tính vào ròng trại`} />
            <Note tone="info">Khoản còn Nháp ở bản chốt này nên chưa tính. Không phân bổ chi Chung nền tảng vào trại.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về tất cả trại</ModalButton>
            <ModalButton variant="primary" onClick={() => { void doExport() }}>Xuất bản chốt này</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'xuat' && (
        <Modal title="Xuất báo cáo đang xem" width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <RoField label="Bản chốt / thời điểm" value={snapshot} />
            <RoField label="Định dạng" value="XLSX · Tổng hợp và Chi tiết" />
            <RoField label="Tiêu chí" value={scopeLabel(report.criteria, farmLabel)} />
            <Note tone="info">Tổng hợp: tiêu chí, định nghĩa, tổng gói / thu khác / chi / ròng, từng trại và Chung nền tảng riêng.</Note>
            <Note tone="info">Chi tiết: ID và phiên bản nguồn, loại/phạm vi/trại, ngày dòng tiền, tiền, Thanh toán / Chứng từ, thời hạn / kỳ mua. Xuất đúng bản chốt đang xem, không tự chạy lại số mới.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
            <ModalButton variant="primary" onClick={() => { void doExport() }}><Icon name="table-export" size={16} /> Xuất XLSX</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'dang-tao' && (
        <Modal title="Đang tạo tệp XLSX" width={640} onClose={close}>
          <Note tone="info">Đang xuất theo đúng bản chốt, bộ lọc và thời điểm bạn vừa xác nhận. Vui lòng chờ; nguồn tài chính không thay đổi.</Note>
          <ModalFooter><ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton></ModalFooter>
        </Modal>
      )}
      {m === 'xuat-loi' && (
        <Modal title="Chưa xuất được báo cáo" width={640} onClose={close}>
          <Note tone="warn">Không có tệp hoàn chỉnh được tạo. Thử lại cùng bản chốt; nếu bản chốt không còn khả dụng, cần làm mới báo cáo trước.</Note>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton>
            <ModalButton variant="primary" onClick={() => { void doExport() }}><Icon name="refresh" size={16} /> Thử lại xuất</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'het-han' && (
        <Modal title="Kết quả báo cáo không còn khả dụng" width={640} onClose={close}>
          <Note tone="warn">Bản chốt đã hết hạn hoặc không còn truy xuất được. Làm mới để tạo kết quả mới; không xuất số live khác dưới thời điểm chốt cũ.</Note>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton>
            <ModalButton variant="primary" onClick={() => { void refreshAndClose() }}><Icon name="refresh" size={16} /> Làm mới báo cáo</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'rong' && (
        <Modal title="Không có giao dịch trong kỳ" width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2"><RoField label="Bản chốt / thời điểm" value={snapshot} /><RoField label="Tiêu chí" value={`${formatDate(report.criteria.dateFrom).slice(0, 5)} – ${formatDate(report.criteria.dateTo)} · ${farmLabel}`} /></div>
            <RoField label="Tổng thu / tổng chi / ròng" value={`${formatVnd(s.totalIncome)} / ${formatVnd(s.totalExpense)} / ${formatMoney(s.netCashFlow)} VND`} />
            <Note tone="info">Chi tiết rỗng; bộ lọc và thời điểm chốt được giữ. XLSX vẫn có Tổng hợp số 0 và hàng tiêu đề Chi tiết.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={close}>Đổi bộ lọc</ModalButton>
            <ModalButton variant="primary" onClick={() => { void doExport() }}><Icon name="table-export" size={16} /> Xuất báo cáo rỗng</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'lam-moi' && (
        <Modal title="Đã làm mới báo cáo" width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <RoField label="Bản chốt / thời điểm" value={snapshot} />
            <RoField label="Tiêu chí" value={scopeLabel(report.criteria, farmLabel)} />
            <RoField label="Gói / thu khác / chi / ròng" value={`${formatVnd(s.subscriptionReceipts)} / ${formatVnd(s.otherIncome)} / ${formatVnd(s.totalExpense)} / ${formatMoney(s.netCashFlow)} VND`} />
            <Note tone="info">Đây là kết quả mới. Bản chốt trước vẫn giữ dữ liệu/thời điểm cũ; xuất dùng đúng bản chốt mới đang xem.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton>
            <ModalButton variant="primary" onClick={() => open('xuat')}>Xuất bản chốt mới</ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </Layout>
  )
}
