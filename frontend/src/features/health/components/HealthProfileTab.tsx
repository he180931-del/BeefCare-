import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, Icon, LoadingBlock, Note, Panel } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useDemoState } from '../../../demo/demoModules'
import { caseLabel, fmtDate, fmtMonth, OUTCOME_LABEL } from '../domain/healthFormat'
import { isWithdrawalActive, MSG } from '../domain/healthRules'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import { useHealthFormOptions, useHealthProfile } from '../hooks/useHealthProfile'
import type { CaseOutcome, HealthCaseCard, HealthTimelineRow, PendingExit } from '../types'
import CaseCard from './CaseCard'
import CaseViewDialog from './CaseViewDialog'
import CorrectRecordDialog from './CorrectRecordDialog'
import DeathNoticeDialog from './DeathNoticeDialog'
import HealthTimelineSource from './HealthTimelineSource'
import { HealthStateBadge, Meta, useCanRecord, useHealthDialog, useIsFarmOwner, useToast } from './healthUi'
import OpenCaseDialog from './OpenCaseDialog'
import ReopenCaseDialog from './ReopenCaseDialog'
import TreatmentDialog from './TreatmentDialog'
import UpdateCaseDialog from './UpdateCaseDialog'

/** Số ca đã đóng hiện sẵn ở khối "Các ca trước"; phần còn lại xem bằng "Xem thêm". */
const PREVIOUS_ROWS = 5
const OUTCOME_TONE: Record<CaseOutcome, 'ok' | 'err' | 'outline'> = { RECOVERED: 'ok', DIED: 'err', MISSING: 'err', CLOSED_BY_EXIT: 'outline' }

const PAGE_NOTE = 'Tab Sức khỏe trong hồ sơ bò. Mỗi ca đang mở hoặc mạn tính có 1 thẻ với diễn biến theo thời gian. "Ngưng sử dụng thịt đến" là ngày muộn nhất từ các lần điều trị và mũi tiêm tại trại. Nút ghi chỉ hiện cho Quản lý; vai trò khác chỉ xem.'
const DIALOG_NOTES: Record<string, string> = {
  'open-case': 'Mở ca mới cho một vấn đề mới. Diễn biến của ca đang có ghi ở "Cập nhật ca bệnh".',
  treatment: 'Hộp thoại ghi 1 lần điều trị (Chủ trại, Quản lý). Thuốc lấy từ danh mục; liều, đường dùng và số ngày ngưng được điền sẵn, có thể sửa. Hết ngưng = ngày dùng cuối + số ngày ngưng, dùng để tính ngày được xuất bán. Ca mạn tính hiện thêm lưu ý điều trị dài ngày.',
  'update-case': 'Ghi diễn biến và (nếu cần) đổi trạng thái ca trong một lần lưu.',
  'case-view': 'Xem lại ca đã đóng: tóm tắt, thuốc đã dùng và toàn bộ diễn biến.',
  reopen: 'Mở lại ca đã đóng Khỏi / Chết / Mất tích (Chết / Mất tích: chỉ Chủ trại). Ca đóng do xuất đàn không mở lại được.',
  correct: 'Hộp thoại sửa hoặc hủy 1 lần điều trị hoặc theo dõi (Chủ trại, Quản lý). Lần ghi mở ca chỉ sửa, không hủy.',
}

export default function HealthProfileTab({ cattleCode }: { cattleCode: string }) {
  const canRecord = useCanRecord()
  const owner = useIsFarmOwner()
  const demo = useDemoState()
  const dialog = useHealthDialog()
  const [params] = useSearchParams()
  const sourceId = dialog.m ? null : params.get('r')
  const caseId = sourceId == null ? null : params.get('case')
  const [toast, showToast] = useToast()
  const [notice, setNotice] = useState<PendingExit | null>(null)
  const [allPrevious, setAllPrevious] = useState(false)
  const { now } = useHealthCaseCommands()
  const { data: profile, loading, error, refetch } = useHealthProfile(cattleCode, caseId, demo)
  const { data: options } = useHealthFormOptions()

  if (loading && !profile) return <LoadingBlock />
  if (error || !profile) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu sức khỏe.')} onRetry={refetch} />
  if (sourceId != null) return loading ? <LoadingBlock /> : <HealthTimelineSource profile={profile} sourceId={sourceId} type={params.get('type')} caseId={caseId} />

  const { cattle, activeCases, previousCases, timeline, pendingExit } = profile
  const exited = cattle.status === 'EXITED'
  const canAdd = canRecord && !exited && !pendingExit
  const canEdit = canRecord && !exited
  const withdrawing = isWithdrawalActive(profile.withdrawalEndDate, now())
  const saved = (message: string) => { showToast(message); dialog.close(); refetch() }

  const target: HealthCaseCard | undefined = activeCases.find((c) => c.caseCode === dialog.caseCode) ?? activeCases[0]
  // D62: ca Khỏi mở lại khi bò còn nhận sự kiện; ca Chết / Mất tích chỉ Chủ trại mở lại, khi bò còn trong đàn (phiếu chờ xác nhận bị bác).
  const canReopen = (c: HealthCaseCard) => canEdit && !!c.outcome && c.outcome !== 'CLOSED_BY_EXIT' && (c.outcome === 'RECOVERED' ? !pendingExit : owner)
  const reopening = previousCases.find((c) => c.caseCode === dialog.caseCode)
  const entry: HealthTimelineRow | undefined = timeline.find((r) => String(r.id) === dialog.entryId) ?? timeline.find((r) => r.type === 'TREATMENT' && r.status === 'VALID')
  const openDialog = (name: string, caseCode?: string) => dialog.open(name, caseCode ? { case: caseCode } : {})
  const openCaseButton = canAdd && <Button type="button" variant="primary" onClick={() => openDialog('open-case')}><Icon name="circle-plus" size={16} /> Mở ca sức khỏe</Button>

  const active = canRecord && options ? dialog.m : null
  return (
    <div className="flex flex-col gap-4">
      {exited && <Note tone="err">{MSG.exited(cattle.code, cattle.exitDate ?? '', cattle.exitType ?? 'Xuất')}</Note>}
      {pendingExit && !exited && <Note tone="warn">Chờ xác nhận chết / mất: {cattle.code} chưa nhận thêm sự kiện chăm sóc mới cho đến khi Chủ trại xác nhận hoặc bỏ qua phiếu xuất. Vẫn sửa hoặc hủy được các bản ghi đã có.</Note>}
      <div className="grid items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          {activeCases.length === 0 && <Card variant="panel"><EmptyBlock title="Chưa có ca sức khỏe đang mở"  action={openCaseButton || undefined} /></Card>}
          {activeCases.map((c, i) => (
            <CaseCard key={c.id} defaultExpanded={i === 0} card={c} rows={timeline.filter((r) => r.caseId === c.id)} canAdd={canAdd} canEdit={canEdit} onAction={openDialog} onEdit={(r) => dialog.open('correct', { entry: String(r.id) })} />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {/* Bento (Figma Tab 17 ③b): khối tình trạng đỏ nhạt khi bò đang điều trị hoặc đang ngưng sử dụng thịt. */}
          <Panel tone={withdrawing || profile.healthState === 'UNDER_TREATMENT' ? 'err' : 'default'} title={<span className="text-sm font-semibold">Tình trạng sức khỏe</span>}>
            <div className="grid grid-cols-2 gap-3">
              <Meta label="Hiện tại"><HealthStateBadge state={profile.healthState} /></Meta>
              <Meta label="Ca đang mở">{activeCases.filter((c) => c.status === 'OPEN').length}</Meta>
              <Meta label="Ngưng sử dụng thịt đến">{withdrawing ? fmtDate(profile.withdrawalEndDate) : '—'}</Meta>
              <Meta label="Ca theo dõi dài hạn">{activeCases.filter((c) => c.status === 'CHRONIC').length}</Meta>
            </div>
            {withdrawing && <Note tone="warn">Không xuất bán trước ngày hết ngưng sử dụng thịt.</Note>}
          </Panel>
          <Card variant="panel" title="Các ca trước">
            {previousCases.length === 0 ? <p className="m-0 text-xs text-muted">Chưa có ca nào đã đóng.</p> : (
              <>
                <ul className="m-0 flex list-none flex-col divide-y divide-edge p-0">
                  {(allPrevious ? previousCases : previousCases.slice(0, PREVIOUS_ROWS)).map((c) => (
                    <li key={c.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-ink">{c.caseCode}</span>
                          <Badge tone={OUTCOME_TONE[c.outcome ?? 'CLOSED_BY_EXIT']}>{c.outcome ? OUTCOME_LABEL[c.outcome] : '—'}</Badge>
                          <span className="text-[11px] text-muted">{fmtMonth(c.closedAt)}</span>
                        </div>
                        <p className="m-0 truncate text-xs text-muted" title={caseLabel(c)}>{caseLabel(c)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="link" className="text-xs" aria-label={`Xem ca ${c.caseCode}`} onClick={() => openDialog('case-view', c.caseCode)}>Xem</Button>
                        {canReopen(c) && <Button type="button" variant="link" className="text-xs" onClick={() => openDialog('reopen', c.caseCode)}>Mở lại ca</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
                {previousCases.length > PREVIOUS_ROWS && (
                  <Button type="button" variant="link" className="self-start text-xs" onClick={() => setAllPrevious((v) => !v)}>
                    {allPrevious ? 'Thu gọn' : `Xem thêm ${previousCases.length - PREVIOUS_ROWS} ca`}
                  </Button>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
      <Foot>{PAGE_NOTE}</Foot>
      {active && DIALOG_NOTES[active] && <Foot>{DIALOG_NOTES[active]}</Foot>}

      {active === 'open-case' && canAdd && options && (
        <OpenCaseDialog cattle={cattle} activeCases={activeCases} options={options} onClose={dialog.close} onSaved={saved} onUpdateCase={(code) => openDialog('update-case', code)} />
      )}
      {active === 'treatment' && canAdd && options && target && <TreatmentDialog card={target} cattleCode={cattle.code} options={options} onClose={dialog.close} onSaved={saved} />}
      {active === 'update-case' && canAdd && options && target && (
        <UpdateCaseDialog key={target.id} card={target} cattleCode={cattle.code} options={options} onClose={dialog.close} onSaved={(message, result) => { saved(message); if (result.deathVoucher) setNotice(result.deathVoucher) }} />
      )}
      {dialog.m === 'case-view' && reopening && (
        <CaseViewDialog cattleCode={cattle.code} caseId={reopening.id} onClose={dialog.close} onReopen={canReopen(reopening) ? () => openDialog('reopen', reopening.caseCode) : undefined} />
      )}
      {active === 'reopen' && reopening && canReopen(reopening) && <ReopenCaseDialog card={reopening} cattleCode={cattle.code} onClose={dialog.close} onSaved={saved} />}
      {active === 'correct' && canEdit && options && entry && <CorrectRecordDialog row={entry} profile={profile} options={options} onClose={dialog.close} onSaved={saved} />}
      {notice && <DeathNoticeDialog voucher={notice} onClose={() => setNotice(null)} />}
      {toast}
    </div>
  )
}
