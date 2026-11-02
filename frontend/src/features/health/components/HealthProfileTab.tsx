import { useState } from 'react'
import { ErrorBlock, EmptyBlock, Button, Card, Foot, Info, LoadingBlock, Note, Table, Td, Th } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { userFacingError } from '../../../api/userFacingError'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { healthApi } from '../api/healthApi'
import { fmtDate, fmtMonth, OUTCOME_LABEL } from '../domain/healthFormat'
import { isWithdrawalActive, MSG } from '../domain/healthRules'
import type { HealthCaseCard, HealthTimelineRow, PendingExit } from '../types'
import CaseCard from './CaseCard'
import CorrectRecordDialog from './CorrectRecordDialog'
import DeathNoticeDialog from './DeathNoticeDialog'
import FollowUpDialog from './FollowUpDialog'
import { HealthStateBadge, useCanRecord, useHealthDialog, useToast } from './healthUi'
import OpenCaseDialog from './OpenCaseDialog'
import TreatmentDialog from './TreatmentDialog'
import UpdateStatusDialog from './UpdateStatusDialog'

const PAGE_NOTE = 'Tab Sức khỏe trong hồ sơ bò. Mỗi ca đang mở hoặc mạn tính có 1 thẻ với diễn biến theo thời gian. "Ngưng sử dụng thịt đến" là ngày muộn nhất từ các lần điều trị và mũi tiêm tại trại. Nút ghi chỉ hiện cho Quản lý; vai trò khác chỉ xem.'
const DIALOG_NOTES: Record<string, string> = {
  'open-case': 'Hộp thoại ghi một quan sát bất thường (chỉ Quản lý). Mặc định mở ca mới; chọn "Nối vào ca đang có" để thêm vào ca đang mở hoặc mạn tính của bò. Thân nhiệt không bắt buộc, trong khoảng 35,0 – 43,0 °C.',
  'follow-up': 'Hộp thoại ghi 1 lần theo dõi ca (chỉ Quản lý). Thời điểm không được trước lúc mở ca. Lần theo dõi được thêm vào "Diễn biến & điều trị" của ca.',
  treatment: 'Hộp thoại ghi 1 lần điều trị (chỉ Quản lý). Thuốc lấy từ danh mục; liều, đường dùng và số ngày ngưng được điền sẵn, có thể sửa. Hết ngưng = ngày dùng cuối + số ngày ngưng, dùng để tính ngày được xuất bán. Ca mạn tính hiện thêm lưu ý điều trị dài ngày.',
  'update-status': 'Hộp thoại cập nhật hoặc đóng ca (chỉ Quản lý). Ca OPEN: Giữ OPEN / Chuyển theo dõi mạn tính / Đóng ca. Ca mạn tính: Giữ mạn tính / Quay lại OPEN / Đóng ca. Kết quả và thời điểm đóng chỉ hiện khi chọn Đóng ca. Đóng với kết quả Chết hoặc Mất tích: hiện cảnh báo trước khi lưu, hệ thống tạo phiếu xuất "Chết / mất" ở trạng thái chờ để Chủ trại hoàn tất.',
  correct: 'Hộp thoại sửa hoặc hủy 1 lần điều trị hoặc theo dõi (chỉ Quản lý). Lần ghi mở ca chỉ sửa, không hủy.',
}

export default function HealthProfileTab({ cattleCode }: { cattleCode: string }) {
  const canRecord = useCanRecord()
  const demo = useDemoState()
  const dialog = useHealthDialog()
  const [toast, showToast] = useToast()
  const [notice, setNotice] = useState<PendingExit | null>(null)
  const { data: profile, loading, error, refetch } = useQuery(() => (demo === 'load-error' ? Promise.reject(new Error('Không tải được dữ liệu sức khỏe.')) : healthApi.getProfile(cattleCode)), [cattleCode, demo])
  const { data: options } = useQuery(() => healthApi.formOptions(), [])

  if (loading && !profile) return <LoadingBlock />
  if (error || !profile) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu sức khỏe.')} onRetry={refetch} />

  const { cattle, activeCases, previousCases, timeline, pendingExit } = profile
  const exited = cattle.status === 'EXITED'
  const canAdd = canRecord && !exited && !pendingExit
  const canEdit = canRecord && !exited
  const withdrawing = isWithdrawalActive(profile.withdrawalEndDate, healthApi.now())
  const saved = (message: string) => { showToast(message); dialog.close(); refetch() }

  const target: HealthCaseCard | undefined = activeCases.find((c) => c.caseCode === dialog.caseCode) ?? activeCases[0]
  const entry: HealthTimelineRow | undefined = timeline.find((r) => String(r.id) === dialog.entryId) ?? timeline.find((r) => r.type === 'TREATMENT' && r.status === 'VALID')
  const openDialog = (name: string, caseCode?: string) => dialog.open(name, caseCode ? { case: caseCode } : {})
  const openCaseButton = canAdd && <Button type="button" variant="primary" onClick={() => openDialog('open-case')}><Icon name="circle-plus" size={16} /> Mở ca sức khỏe</Button>

  const active = canRecord && options ? dialog.m : null
  return (
    <div className="flex flex-col gap-4">
      {exited && <Note tone="err">{MSG.exited(cattle.code, cattle.exitDate ?? '', cattle.exitType ?? 'Xuất')}</Note>}
      {pendingExit && !exited && <Note tone="warn">Chờ xác nhận chết / mất: {cattle.code} chưa nhận thêm sự kiện chăm sóc mới cho đến khi Chủ trại xác nhận hoặc bỏ qua phiếu xuất. Vẫn sửa hoặc hủy được các bản ghi đã có.</Note>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
        <div className="flex min-w-0 flex-col gap-4">
          {activeCases.length === 0 && <Card><EmptyBlock title="Chưa có ca sức khỏe đang mở" sub="Bò hiện không có ca đang mở hoặc theo dõi mạn tính." action={openCaseButton || undefined} /></Card>}
          {activeCases.map((c) => (
            <CaseCard key={c.id} card={c} rows={timeline.filter((r) => r.caseId === c.id)} canAdd={canAdd} canEdit={canEdit} onAction={openDialog} onEdit={(r) => dialog.open('correct', { entry: String(r.id) })} />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Tình trạng sức khỏe" actions={openCaseButton || undefined}>
            <Info cols={2} items={[
              ['Hiện tại', <HealthStateBadge key="s" state={profile.healthState} />],
              ['Ca đang mở', activeCases.filter((c) => c.status === 'OPEN').length],
              ['Ngưng sử dụng thịt đến', withdrawing ? fmtDate(profile.withdrawalEndDate) : '—'],
              ['Ca mạn tính', activeCases.filter((c) => c.status === 'CHRONIC').length],
            ]} />
            {withdrawing && <Note tone="warn">Không xuất bán trước ngày hết ngưng sử dụng thịt.</Note>}
          </Card>
          <Card title="Các ca trước">
            {previousCases.length === 0 ? <p className="m-0 text-xs text-muted">Chưa có ca nào đã đóng.</p> : (
              <Table>
                <thead><tr><Th>Mã ca</Th><Th>Dấu hiệu</Th><Th>Kết quả</Th></tr></thead>
                <tbody>
                  {previousCases.map((c) => (
                    <tr key={c.id}>
                      <Td className="font-medium">{c.caseCode}</Td>
                      <Td>{c.signs}</Td>
                      <Td>{c.outcome ? OUTCOME_LABEL[c.outcome] : '—'} · {fmtMonth(c.closedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
      <Foot>{PAGE_NOTE}</Foot>
      {active && DIALOG_NOTES[active] && <Foot>{DIALOG_NOTES[active]}</Foot>}

      {active === 'open-case' && canAdd && options && <OpenCaseDialog cattle={cattle} activeCases={activeCases} options={options} onClose={dialog.close} onSaved={saved} />}
      {active === 'follow-up' && canAdd && options && target && <FollowUpDialog card={target} cattleCode={cattle.code} options={options} onClose={dialog.close} onSaved={saved} />}
      {active === 'treatment' && canAdd && options && target && <TreatmentDialog card={target} cattleCode={cattle.code} options={options} onClose={dialog.close} onSaved={saved} />}
      {active === 'update-status' && canAdd && options && target && (
        <UpdateStatusDialog card={target} cattleCode={cattle.code} options={options} onClose={dialog.close} onSaved={(message, result) => { saved(message); if (result.deathVoucher) setNotice(result.deathVoucher) }} />
      )}
      {active === 'correct' && canEdit && options && entry && <CorrectRecordDialog row={entry} profile={profile} options={options} onClose={dialog.close} onSaved={saved} />}
      {notice && <DeathNoticeDialog voucher={notice} onClose={() => setNotice(null)} />}
      {toast}
    </div>
  )
}
