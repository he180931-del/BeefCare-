import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Note, PageHeader, Segmented, Table, Td, Th, inputCls } from '../../../components/ui'
import Modal, { ModalFooter } from '../../../components/Modal'
import { backendFarmId, backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { ROLE_PERMISSION_ROWS, type ChangeMemberInput, type FarmRole, type Membership } from '../types'
import { validateMemberChange, type FormErrors } from '../validation'
import { farmWorkspaceError, FormErrors as ErrorSummary, roleLabel } from '../components/WorkspaceUi'

const today = () => new Date().toISOString().slice(0, 10)
const roleBadge = (role: FarmRole) => role === 'OWNER' ? 'info' : role === 'MANAGER' ? 'ok' : 'outline'

export default function MembersPage() {
  const navigate = useNavigate()
  const params = useParams<{ farmId: string }>()
  const [search] = useSearchParams()
  const rawId = params.farmId ?? search.get('farmId') ?? backendFarmId
  const farmId = Number(rawId) > 0 ? Number(rawId) : Number(backendFarmId)
  const query = useQuery(async () => {
    const [farm, members] = await Promise.all([farmWorkspaceApi.getFarm(farmId), farmWorkspaceApi.listMembers(farmId)])
    return { farm, members }
  }, [farmId])
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<Membership | null>(null)
  const [action, setAction] = useState<ChangeMemberInput['action']>('CHANGE_ROLE')
  const [role, setRole] = useState<'MANAGER' | 'TECHNICIAN'>('TECHNICIAN')
  const [effectiveDate, setEffectiveDate] = useState(today())
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FormErrors<ChangeMemberInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const owner = query.data?.farm.role === 'OWNER'
  const members = query.data?.members ?? []
  const counts = useMemo(() => ({ ALL: members.filter((member) => member.status === 'ACTIVE').length, MANAGER: members.filter((member) => member.role === 'MANAGER' && member.status === 'ACTIVE').length, TECHNICIAN: members.filter((member) => member.role === 'TECHNICIAN' && member.status === 'ACTIVE').length, INACTIVE: members.filter((member) => member.status === 'INACTIVE').length }), [members])
  const visible = members.filter((member) => filter === 'ALL' ? member.status === 'ACTIVE' : filter === 'INACTIVE' ? member.status === 'INACTIVE' : member.status === 'ACTIVE' && member.role === filter)
  const openChange = (member: Membership, nextAction: ChangeMemberInput['action']) => {
    setSelected(member); setAction(nextAction); setRole(member.role === 'MANAGER' ? 'TECHNICIAN' : 'MANAGER'); setEffectiveDate(today()); setReason(''); setErrors({}); setError(null); setConfirming(false)
  }
  const close = () => { setSelected(null); setError(null); setErrors({}); setConfirming(false) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    const payload: ChangeMemberInput = { action, role, effectiveDate, reason }
    const nextErrors = validateMemberChange(payload)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (!confirming) { setConfirming(true); return }
    setSaving(true); setError(null)
    try { await farmWorkspaceApi.changeMember(farmId, selected.id, payload); await query.refetch(); setNotice('Đã cập nhật thành viên.'); close() }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể cập nhật thành viên.')) }
    finally { setSaving(false) }
  }
  return <Layout title="Thành viên & quyền" user={owner ? 'owner' : 'manager'}>
    <PageHeader title="Thành viên & vai trò" sub={query.data?.farm.name ?? 'Danh sách người được cấp quyền vào trang trại.'}>
      {owner && <><Button onClick={() => navigate(`/loi-moi?farmId=${farmId}`)}>Lời mời</Button><Button variant="primary" onClick={() => navigate(`/loi-moi?farmId=${farmId}&m=invite`)} disabled={query.data?.farm.serviceStatus !== 'ACTIVE'}>+ Mời thành viên</Button></>}
    </PageHeader>
    {backendMode === 'local' && <Note tone="info">Dữ liệu mô phỏng. Thay đổi chỉ lưu trong phiên này.</Note>}
    {error && !selected && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
    {query.loading && !query.data && <Note>Đang tải danh sách thành viên…</Note>}
    {Boolean(query.error) && <Note tone="err">Không tải được thành viên hoặc bạn không có quyền xem trang này.</Note>}
    {query.data && <>
      {!owner && <Note>Chế độ xem chỉ đọc. Chỉ Chủ trại được gửi lời mời hoặc thay đổi vai trò, trạng thái thành viên.</Note>}
      <Segmented value={filter} onChange={setFilter} options={[
        { value: 'ALL', label: `Tất cả (${counts.ALL})` }, { value: 'MANAGER', label: `Quản lý (${counts.MANAGER})` },
        { value: 'TECHNICIAN', label: `Kỹ thuật viên (${counts.TECHNICIAN})` }, ...(owner ? [{ value: 'INACTIVE', label: `Ngừng hoạt động (${counts.INACTIVE})` }] : []),
      ]} />
      <Table><thead><tr><Th>Thành viên</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Tham gia</Th>{owner && <Th>Thao tác</Th>}</tr></thead><tbody>
        {visible.map((member) => <tr key={member.id}><Td><strong className="block">{member.fullName || 'Chưa có tên'}</strong><span className="text-subtle">{member.email}</span></Td><Td><Badge tone={roleBadge(member.role)}>{roleLabel(member.role)}</Badge></Td><Td><Badge tone={member.status === 'ACTIVE' ? 'ok' : 'warn'}>{member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge></Td><Td>{member.joinedAt ? new Intl.DateTimeFormat('vi-VN', { month: '2-digit', year: 'numeric' }).format(new Date(member.joinedAt)) : 'Chưa có dữ liệu từ máy chủ'}</Td>{owner && <Td>{member.role !== 'OWNER' && (member.status === 'ACTIVE' ? <Button small onClick={() => openChange(member, 'CHANGE_ROLE')}>Đổi vai trò / ngừng hoạt động</Button> : <Button small onClick={() => openChange(member, 'REACTIVATE')}>Kích hoạt lại</Button>)}</Td>}</tr>)}
        {!visible.length && <tr><Td colSpan={owner ? 5 : 4} className="py-8 text-center text-subtle">Không có thành viên trong nhóm này.</Td></tr>}
      </tbody></Table>
      <Card title="Quyền theo vai trò" sub="Các quyền cố định theo tài liệu SRS.">
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-xs"><thead><tr className="bg-chip text-left"><th className="p-2.5">Khu vực</th><th className="p-2.5">Chủ trại</th><th className="p-2.5">Quản lý</th><th className="p-2.5">Kỹ thuật viên</th></tr></thead><tbody>{ROLE_PERMISSION_ROWS.map((row) => <tr key={row.area} className="border-b border-rule"><td className="p-2.5 font-medium">{row.area}</td><td className="p-2.5">{row.OWNER}</td><td className="p-2.5">{row.MANAGER}</td><td className="p-2.5">{row.TECHNICIAN}</td></tr>)}</tbody></table></div>
      </Card>
    </>}
    {selected && <Modal title="Thay đổi thành viên" sub={`${selected.fullName} · ${selected.email}`} onClose={close} width={640}>
      {error && <Note tone="err">{error}</Note>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="rounded-xl bg-page p-3 text-xs"><strong>{roleLabel(selected.role)}</strong><span className="px-2 text-faint">·</span>{selected.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0"><legend className="mb-2 text-xs font-medium">Thao tác *</legend>
          {selected.status === 'ACTIVE' && <><label className="flex items-center gap-2 text-xs"><input type="radio" name="member-action" checked={action === 'CHANGE_ROLE'} onChange={() => setAction('CHANGE_ROLE')} />Đổi vai trò</label><label className="flex items-center gap-2 text-xs"><input type="radio" name="member-action" checked={action === 'DEACTIVATE'} onChange={() => setAction('DEACTIVATE')} />Ngừng hoạt động</label></>}
          {selected.status === 'INACTIVE' && <label className="flex items-center gap-2 text-xs"><input type="radio" name="member-action" checked={action === 'REACTIVATE'} onChange={() => setAction('REACTIVATE')} />Kích hoạt lại</label>}
        </fieldset>
        {action === 'CHANGE_ROLE' && <fieldset className="m-0 flex gap-5 border-0 p-0"><legend className="mb-2 text-xs font-medium">Vai trò mới *</legend>{(['MANAGER', 'TECHNICIAN'] as const).filter((item) => item !== selected.role).map((item) => <label key={item} className="flex items-center gap-2 text-xs"><input type="radio" name="member-role" checked={role === item} onChange={() => setRole(item)} />{roleLabel(item)}</label>)}</fieldset>}
        <div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-xs font-medium">Ngày hiệu lực *<input type="date" max={today()} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className={inputCls} /></label><label className="flex flex-col gap-1.5 text-xs font-medium">Lý do *<textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={inputCls} rows={2} /></label></div>
        <ErrorSummary errors={errors as Record<string, string | undefined>} />
        {confirming && <Note tone="warn">Xác nhận {action === 'CHANGE_ROLE' ? `đổi vai trò sang ${roleLabel(role)}` : action === 'DEACTIVATE' ? 'ngừng hoạt động thành viên' : 'kích hoạt lại thành viên'} từ ngày {effectiveDate}?</Note>}
        <ModalFooter compact><Button onClick={confirming ? () => setConfirming(false) : close}>{confirming ? 'Quay lại' : 'Hủy'}</Button><Button type="submit" variant="primary" size="lg" disabled={saving}>{saving ? 'Đang lưu…' : confirming ? 'Xác nhận thay đổi' : 'Tiếp tục'}</Button></ModalFooter>
      </form>
    </Modal>}
  </Layout>
}
