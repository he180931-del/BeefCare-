import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useModalParam } from '../components/Modal'
import { Button, PageHeader, Select, inputCls } from '../components/ui'
import { initialBarns } from '../data/barnsData'
import BarnTable from './pens/BarnTable'
import BarnPanel from './pens/BarnPanel'
import EditModal from './pens/EditModal'
import DisableModal from './pens/DisableModal'
import { cx } from './pens/parts'

const ALL_STATUS = 'all'
const STATUS_OPTIONS = [
  [ALL_STATUS, 'Trạng thái: Tất cả'],
  ['ACTIVE', 'ACTIVE'],
  ['INACTIVE', 'INACTIVE'],
]

// Bỏ dấu, đổi thường để tìm không phân biệt hoa/thường và dấu
const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export default function BarnList() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [modal, openModal, closeModal] = useModalParam()
  const [barns, setBarns] = useState(initialBarns)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS)

  const selected = barns.find((b) => b.code === params.get('barn')) ?? barns[0]

  const updateParams = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value == null ? next.delete(key) : next.set(key, value)))
    setParams(next)
  }

  const selectBarn = (code) => updateParams({ barn: code })

  const saveBarn = (nextBarn) => {
    setBarns((list) =>
      list.some((b) => b.code === nextBarn.code)
        ? list.map((b) => (b.code === nextBarn.code ? nextBarn : b))
        : [...list, nextBarn],
    )
    updateParams({ barn: nextBarn.code, m: null })
  }

  const changeStatus = (status, note) => {
    setBarns((list) => list.map((b) => (b.code === selected.code ? { ...b, status, statusNote: note } : b)))
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

  const totalCount = barns.reduce((sum, b) => sum + b.count, 0)
  const totalCapacity = barns.reduce((sum, b) => sum + b.capacity, 0)

  return (
    <Layout title="Chuồng trại – danh sách & chi tiết" user="manager">
      <PageHeader title="Chuồng trại" sub={`${barns.length} chuồng · ${totalCount}/${totalCapacity} chỗ đang sử dụng`}>
        <Button variant="primary" className="!border-0" onClick={() => openModal('create')}>+ Tạo chuồng</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm mã / tên chuồng"
          className={cx(inputCls, 'w-[300px] placeholder:text-muted')}
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[200px]">
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[560px_minmax(0,1fr)]">
        <div className="min-w-0 rounded-md border border-[#bdbdbd] bg-white p-2 xl:w-[560px]">
          <BarnTable rows={visibleBarns} selected={selected.code} onSelect={selectBarn} />
        </div>
        <div className="min-w-0">
          <BarnPanel
            barn={selected}
            onEdit={() => openModal('edit')}
            onToggle={() => openModal('disable')}
            onMoveCow={(cowCode) => navigate(`/cattle/${cowCode}?m=move`)}
            onViewAll={() => navigate('/cattle')}
          />
        </div>
      </div>

      <p className="m-0 text-[11px] text-[#67766c]">
        Chọn một chuồng để xem sức chứa, tiêu chí tiếp nhận theo phiên bản và bò đang ở; chuồng ngừng sử dụng không nhận bò mới.
      </p>

      {modal === 'edit' && <EditModal barn={selected} barns={barns} onSave={saveBarn} onClose={closeModal} />}
      {modal === 'create' && <EditModal barn={null} barns={barns} onSave={saveBarn} onClose={closeModal} />}
      {modal === 'disable' && (
        <DisableModal
          barn={selected}
          onConfirm={(status, note) => changeStatus(status, note)}
          onClose={closeModal}
        />
      )}
    </Layout>
  )
}
