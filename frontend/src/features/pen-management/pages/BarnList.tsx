import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Icon, inputCls, Note, PageHeader, Select } from '../../../shared/ui'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import TechnicianLayout from '../../../app/layouts/TechnicianLayout'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { penError } from '../api/penError'
import { useSession } from '../../../app/session/sessionContext'
import type { PenCattle } from '../api/penApi'
import BarnTable from '../components/BarnTable'
import BarnPanel from '../components/BarnPanel'
import EditModal from '../components/EditModal'
import DisableModal from '../components/DisableModal'
import MoveDialog from '../components/MoveDialog'
import { cx } from '../components/parts'
import { headerSummary, PEN_STATUS_LABELS } from '../domain/penRules'
import type { Pen, PenStatus } from '../types'
import { usePenCommands } from '../hooks/usePenCommands'
import { usePenDetail, usePenList } from '../hooks/usePenList'

const ALL_STATUS = 'all'
const STATUS_OPTIONS = [
  [ALL_STATUS, 'Trạng thái: Tất cả'],
  ['ACTIVE', PEN_STATUS_LABELS.ACTIVE],
  ['INACTIVE', PEN_STATUS_LABELS.INACTIVE],
] as const

// Bỏ dấu, đổi thường để tìm không phân biệt hoa/thường và dấu
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

/** SCR-17 Pens (UC-FE04-01 … 05). Technician only views (§2); the backend checks every command again. */
export default function BarnList() {
  const navigate = useNavigate()
  const session = useSession()
  const technician = session?.role === 'TECHNICIAN'
  // Không có session (vd. test từng trang) thì không ẩn nút; quyền thật do backend kiểm tra.
  const canManage = !session || session.role === 'OWNER' || session.role === 'MANAGER'
  const [params, setParams] = useSearchParams()
  const [modal, openModal, closeModal] = useModalParam()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS)
  const [notice, setNotice] = useState<string | null>(null)
  const [moving, setMoving] = useState<PenCattle[] | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const { data, loading, error: loadError, refetch, pens: barns } = usePenList()
  const visibleBarns = useMemo(() => {
    const key = normalize(query.trim())
    return barns.filter((b) => (statusFilter === ALL_STATUS || b.status === statusFilter) && (!key || normalize(b.code).includes(key) || normalize(b.name).includes(key)))
  }, [barns, query, statusFilter])
  const selected = visibleBarns.find((b) => b.code === params.get('barn')) ?? visibleBarns[0]
  const { data: detail, loading: detailLoading, error: detailError, refetch: refetchDetail } = usePenDetail(selected)
  const {
    createPen,
    creating,
    createError,
    updatePen,
    updating,
    updateError,
    changeAvailability: changeAvailabilityCommand,
    changingAvailability,
    availabilityError,
  } = usePenCommands()
  const updateParams = (changes: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value == null ? next.delete(key) : next.set(key, value)))
    setParams(next)
  }

  const selectBarn = (code: string) => updateParams({ barn: code })

  useEffect(() => {
    if (selected && selected.code !== params.get('barn')) updateParams({ barn: selected.code })
  }, [selected?.code])

  useEffect(() => {
    if (selected && typeof window !== 'undefined' && window.innerWidth < 880) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [selected?.code])

  const savePen = async (pen: Pen, isNew: boolean) => {
    setNotice(null)
    try {
      await (isNew ? createPen(pen) : updatePen(pen))
    } catch {
      return // lỗi hiện trong popup
    }
    refetch()
    setNotice(`Đã lưu chuồng ${pen.code}.`)
    updateParams({ barn: pen.code, m: null })
  }

  const changePenStatus = async (status: PenStatus, note: { date: string; reason: string }) => {
    if (!selected) return
    setNotice(null)
    try {
      await changeAvailabilityCommand({ pen: selected, status, note })
    } catch {
      return // lỗi hiện trong popup
    }
    refetch()
    setNotice(`Chuồng ${selected.code} hiện là ${PEN_STATUS_LABELS[status]}. Bò đang ở trong chuồng giữ nguyên.`)
    updateParams({ m: null })
  }

  const header = headerSummary(barns)
  const viewAll = () => {
    if (!selected) return
    // Backend pens filter by id; demo pens have no id and filter by code.
    const pen = selected.id != null ? String(selected.id) : selected.code
    navigate(`${technician ? '/kt/dan-bo' : '/cattle'}?pen=${encodeURIComponent(pen)}`)
  }

  const content = (
    <>
      <PageHeader title="Chuồng trại" sub={`${header.penCount} chuồng · ${header.used}/${header.total} chỗ`}>
        {canManage && (
          <Button variant="primary" className="!border-0" onClick={() => openModal('create')}><Icon name="circle-plus" size={16} />Tạo chuồng</Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm mã / tên chuồng"
          aria-label="Tìm mã / tên chuồng"
          className={cx(inputCls, 'max-w-[300px] placeholder:text-muted')}
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[200px]" aria-label="Trạng thái">
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      {notice && <div className="text-sm font-medium text-brand" role="status" aria-live="polite">{notice}</div>}
      {Boolean(loadError) && <Note tone="err">{penError(loadError, 'Không tải được danh sách chuồng. Vui lòng thử lại.')}</Note>}

      {/* Danh sách + chi tiết (Bento, Figma Tab 16 ③b): 7+5 khi vùng nội dung 880–1.023 px, 6+6 từ 1.024 px. */}
      <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @min-[1024px]:grid-cols-2 @min-[1024px]:gap-6">
        <div className="min-w-0 rounded-2xl border border-field bg-white p-2">
          <BarnTable
            rows={visibleBarns}
            selected={selected?.code}
            onSelect={selectBarn}
            loading={loading && !data}
            emptyText={barns.length === 0 ? 'Trại chưa có chuồng.' : 'Không có kết quả phù hợp.'}
          />
        </div>
        <div ref={detailRef} className="min-w-0">
          {selected && (
            <BarnPanel
              key={selected.code}
              barn={selected}
              detail={detail}
              detailError={detailError}
              onRetry={refetchDetail}
              loading={detailLoading}
              canManage={canManage}
              onEdit={() => openModal('edit')}
              onToggle={() => openModal('disable')}
              onMove={(cattle) => setMoving(cattle)}
              onViewAll={technician ? undefined : viewAll}
            />
          )}
        </div>
      </div>

      <p className="m-0 text-[11px] text-[#67766c]">
        Chọn một chuồng để xem sức chứa, tiêu chí nhận bò theo phiên bản và bò đang ở; chuồng ngưng sử dụng không nhận bò mới.
      </p>

      {canManage && modal === 'edit' && selected && <EditModal barn={detail ?? selected} barns={barns} onSave={savePen} onClose={closeModal} saving={updating} saveError={updateError} />}
      {canManage && modal === 'create' && <EditModal barn={null} barns={barns} onSave={savePen} onClose={closeModal} saving={creating} saveError={createError} />}
      {canManage && modal === 'disable' && selected && (
        <DisableModal barn={selected} onConfirm={changePenStatus} onClose={closeModal} saving={changingAvailability} saveError={availabilityError} />
      )}
      {canManage && moving && selected && (
        <MoveDialog
          from={selected}
          cattle={moving}
          pens={barns}
          onClose={() => setMoving(null)}
          onReload={() => { setMoving(null); refetchDetail(); refetch() }}
          onMoved={(message) => { setMoving(null); setNotice(message); refetchDetail(); refetch() }}
        />
      )}
    </>
  )
  return technician
    ? <TechnicianLayout title="Chuồng trại" back="/kt" wide>{content}</TechnicianLayout>
    : <Layout title="Chuồng trại – danh sách & chi tiết" user="manager">{content}</Layout>
}
