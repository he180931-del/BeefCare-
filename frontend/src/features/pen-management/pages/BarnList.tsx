import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, Note, PageHeader, Select, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { backendMode } from '../../../api/backendTransport'
import { useSession } from '../../authorization'
import { penApi, type PenCattle } from '../api/penApi'
import { useMutation, useQuery } from '../../../hooks/useApi'
import BarnTable from '../components/BarnTable'
import BarnPanel from '../components/BarnPanel'
import EditModal from '../components/EditModal'
import DisableModal from '../components/DisableModal'
import MoveDialog from '../components/MoveDialog'
import { cx } from '../components/parts'
import { headerSummary } from '../domain/penRules'
import type { Pen, PenStatus } from '../../../types'

const ALL_STATUS = 'all'
const STATUS_OPTIONS = [
  [ALL_STATUS, 'Trạng thái: Tất cả'],
  ['ACTIVE', 'ACTIVE'],
  ['INACTIVE', 'INACTIVE'],
] as const

// Bỏ dấu, đổi thường để tìm không phân biệt hoa/thường và dấu
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

/** SCR-17 Pens (UC-FE04-01 … 05). Technician only views (§2); the backend checks every command again. */
export default function BarnList() {
  const navigate = useNavigate()
  const session = useSession()
  // Không có session (vd. test từng trang) thì không ẩn nút; quyền thật do backend kiểm tra.
  const canManage = !session || session.role === 'OWNER' || session.role === 'MANAGER'
  const [params, setParams] = useSearchParams()
  const [modal, openModal, closeModal] = useModalParam()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS)
  const [notice, setNotice] = useState<string | null>(null)
  const [moving, setMoving] = useState<PenCattle[] | null>(null)

  const { data, loading, error: loadError, refetch } = useQuery(() => penApi.list(), [])
  const createPen = useMutation(penApi.create)
  const updatePen = useMutation(penApi.update)
  const availability = useMutation((input: { pen: Pen; status: PenStatus; note: { date: string; reason: string } }) => penApi.changeAvailability(input.pen, input.status, input.note))

  const barns = data ?? []
  const selected = barns.find((b) => b.code === params.get('barn')) ?? barns[0]
  const detailQuery = useQuery(() => (selected ? penApi.detail(selected) : Promise.resolve(null)), [selected?.code, selected?.lockVersion, selected?.count, selected?.status])

  const updateParams = (changes: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value == null ? next.delete(key) : next.set(key, value)))
    setParams(next)
  }

  const selectBarn = (code: string) => updateParams({ barn: code })

  const savePen = async (pen: Pen) => {
    setNotice(null)
    const exists = barns.some((b) => b.code === pen.code)
    try {
      await (exists ? updatePen.mutate(pen) : createPen.mutate(pen))
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
      await availability.mutate({ pen: selected, status, note })
    } catch {
      return // lỗi hiện trong popup
    }
    refetch()
    setNotice(`Chuồng ${selected.code} hiện là ${status}. Bò đang ở trong chuồng giữ nguyên.`)
    updateParams({ m: null })
  }

  const visibleBarns = useMemo(() => {
    const key = normalize(query.trim())
    return barns.filter(
      (b) =>
        (statusFilter === ALL_STATUS || b.status === statusFilter) &&
        (!key || normalize(b.code).includes(key) || normalize(b.name).includes(key)),
    )
  }, [barns, query, statusFilter])

  const header = headerSummary(barns)
  const viewAll = () => {
    if (!selected) return
    const pen = backendMode === 'backend' && selected.id != null ? String(selected.id) : selected.code
    navigate(`/cattle?pen=${encodeURIComponent(pen)}`)
  }

  return (
    <Layout title="Chuồng trại – danh sách & chi tiết" user="manager">
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
      {Boolean(loadError) && <Note tone="err">{userFacingError(loadError, 'Không tải được danh sách chuồng. Vui lòng thử lại.')}</Note>}

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[560px_minmax(0,1fr)]">
        <div className="min-w-0 rounded-md border border-[#bdbdbd] bg-white p-2 xl:w-[560px]">
          <BarnTable
            rows={visibleBarns}
            selected={selected?.code}
            onSelect={selectBarn}
            loading={loading && !data}
            emptyText={barns.length === 0 ? 'Trại chưa có chuồng.' : 'Không có kết quả phù hợp.'}
          />
        </div>
        <div className="min-w-0">
          {selected && (
            <BarnPanel
              key={selected.code}
              barn={selected}
              detail={detailQuery.data}
              loading={detailQuery.loading}
              canManage={canManage}
              onEdit={() => openModal('edit')}
              onToggle={() => openModal('disable')}
              onMove={(cattle) => setMoving(cattle)}
              onViewAll={viewAll}
            />
          )}
        </div>
      </div>

      <p className="m-0 text-[11px] text-[#67766c]">
        Chọn một chuồng để xem sức chứa, tiêu chí nhận bò theo phiên bản và bò đang ở; chuồng ngưng sử dụng không nhận bò mới.
      </p>

      {canManage && modal === 'edit' && selected && <EditModal barn={detailQuery.data ?? selected} barns={barns} onSave={savePen} onClose={closeModal} saving={updatePen.loading} saveError={updatePen.error} />}
      {canManage && modal === 'create' && <EditModal barn={null} barns={barns} onSave={savePen} onClose={closeModal} saving={createPen.loading} saveError={createPen.error} />}
      {canManage && modal === 'disable' && selected && (
        <DisableModal barn={selected} onConfirm={changePenStatus} onClose={closeModal} saving={availability.loading} saveError={availability.error} />
      )}
      {canManage && moving && selected && (
        <MoveDialog
          from={selected}
          cattle={moving}
          pens={barns}
          onClose={() => setMoving(null)}
          onMoved={(message) => { setMoving(null); setNotice(message); refetch() }}
        />
      )}
    </Layout>
  )
}
