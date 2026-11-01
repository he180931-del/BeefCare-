import { useMemo, useRef, useState } from 'react'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, Note, PageHeader, Select, Table, Td, Th, Textarea, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedCatalogue, listFeedSuppliers, saveFeedCatalogueItem, saveFeedSupplier, setFeedCatalogueAvailability, setFeedSupplierActive } from '../api/feedCatalogueApi'
import { listFeedStock } from '../api/feedStockApi'
import FeedManagementTabs from '../components/FeedManagementTabs'
import type { FeedGroup, FeedStockRow } from '../types'
import type { FeedCatalogueInput, FeedCatalogueItem, FeedSupplier, FeedSupplierInput } from '../types/feedCatalogue'

type CatalogueSection = 'feeds' | 'suppliers'
type FeedDialogState = { kind: 'feed'; item?: FeedCatalogueItem }
type SupplierDialogState = { kind: 'supplier'; supplier?: FeedSupplier }
type DialogState = FeedDialogState | SupplierDialogState | null

const GROUP_LABELS: Record<FeedGroup, string> = {
  GREEN_ROUGHAGE: 'Thức ăn thô xanh',
  DRY_ROUGHAGE: 'Thức ăn thô khô',
  CONCENTRATE: 'Thức ăn tinh',
  TMR: 'Thức ăn hỗn hợp hoàn chỉnh',
  MINERAL_ADDITIVE: 'Khoáng bổ sung',
  CALF_FEED: 'Thức ăn bê',
}
const GROUPS = Object.entries(GROUP_LABELS) as Array<[FeedGroup, string]>
const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

function suggestedCode(items: readonly FeedCatalogueItem[]) {
  const next = Math.max(0, ...items.map((item) => Number(item.code.match(/^TA-(\d+)$/i)?.[1] ?? 0))) + 1
  return `TA-${String(next).padStart(2, '0')}`
}

export default function FeedCataloguePage() {
  const query = useQuery(async () => {
    const [items, suppliers, stock] = await Promise.all([listFeedCatalogue(), listFeedSuppliers(), listFeedStock()])
    return { items, suppliers, stock }
  }, [])
  const [section, setSection] = useState<CatalogueSection>('feeds')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<FeedGroup | 'ALL'>('ALL')
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const items = query.data?.items ?? []
  const suppliers = query.data?.suppliers ?? []
  const stock = query.data?.stock ?? []
  const filteredFeeds = useMemo(() => {
    const q = normalize(search.trim())
    return items.filter((item) => (group === 'ALL' || item.group === group)
      && (status === 'ALL' || (item.available ? 'ACTIVE' : 'INACTIVE') === status)
      && (!q || normalize(`${item.code} ${item.name} ${item.group}`).includes(q)))
  }, [group, items, search, status])
  const filteredSuppliers = useMemo(() => {
    const q = normalize(search.trim())
    return suppliers.filter((supplier) => (status === 'ALL' || (supplier.active ? 'ACTIVE' : 'INACTIVE') === status)
      && (!q || normalize(`${supplier.name} ${supplier.phone} ${supplier.area}`).includes(q)))
  }, [search, status, suppliers])

  const perform = async (action: () => Promise<unknown>, successMessage: string) => {
    if (busyRef.current || backendMode === 'backend') return
    busyRef.current = true
    setBusy(true)
    setActionError('')
    setMessage('')
    try {
      await action()
      setDialog(null)
      setMessage(successMessage)
      await query.refetch()
    } catch (error) {
      setActionError(userFacingError(error, 'Không thể lưu thay đổi. Vui lòng kiểm tra thông tin.'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const saveFeed = (input: FeedCatalogueInput) => perform(() => saveFeedCatalogueItem(input), input.id ? 'Đã cập nhật thức ăn trong bản demo.' : 'Đã thêm thức ăn vào bản demo.')
  const saveSupplierRow = (input: FeedSupplierInput) => perform(() => saveFeedSupplier(input), input.id ? 'Đã cập nhật nhà cung cấp trong bản demo.' : 'Đã thêm nhà cung cấp vào bản demo.')
  const toggleFeed = (item: FeedCatalogueItem) => perform(
    () => setFeedCatalogueAvailability(item.id, !item.available),
    item.available ? 'Đã ngừng hoạt động thức ăn trong bản demo.' : 'Đã kích hoạt thức ăn trong bản demo.',
  )
  const toggleSupplier = (supplier: FeedSupplier) => perform(
    () => setFeedSupplierActive(supplier.id, !supplier.active),
    supplier.active ? 'Đã ngừng hoạt động nhà cung cấp trong bản demo.' : 'Đã kích hoạt nhà cung cấp trong bản demo.',
  )

  const errorMessage = query.error ? userFacingError(query.error, 'Không thể tải danh mục.') : ''
  const currentTabCount = section === 'feeds' ? items.length : suppliers.length

  return (
    <Layout title="Thức ăn – Danh mục" user="manager">
      <PageHeader title="Danh mục thức ăn & nhà cung cấp" sub="Quản lý mặt hàng và nhà cung cấp dùng trong các nghiệp vụ thức ăn.">
        <Button variant="primary" disabled={backendMode === 'backend'} title={backendMode === 'backend' ? 'Thao tác chưa sẵn sàng ở chế độ kết nối.' : undefined}
          onClick={() => { setActionError(''); setDialog(section === 'feeds' ? { kind: 'feed' } : { kind: 'supplier' }) }}>
          {section === 'feeds' ? '+ Thêm thức ăn' : '+ Thêm nhà cung cấp'}
        </Button>
      </PageHeader>
      {backendMode === 'local' && <Badge tone="info">Dữ liệu minh họa</Badge>}
      <FeedManagementTabs />
      {backendMode === 'backend' && <Note tone="warn">Danh sách lấy từ hệ thống đã kết nối. Tạo, sửa và đổi trạng thái chưa sẵn sàng.</Note>}
      {message && <Note tone="ok">{message}</Note>}
      {actionError && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{actionError}</div>}

      <section role="tabpanel" aria-label="Danh mục thức ăn và nhà cung cấp" className="flex flex-col gap-4">
        <div role="tablist" aria-label="Loại danh mục" className="flex w-fit gap-1 border-b border-edge">
          <button type="button" role="tab" aria-selected={section === 'feeds'} onClick={() => { setSection('feeds'); setGroup('ALL'); setStatus('ALL'); setSearch('') }} className={`border-b-2 px-4 py-2.5 text-xs ${section === 'feeds' ? 'border-brand font-semibold text-brand-dark' : 'border-transparent text-muted'}`}>
            Thức ăn <span className="ml-1 rounded-full bg-chip px-1.5 py-0.5">{items.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={section === 'suppliers'} onClick={() => { setSection('suppliers'); setGroup('ALL'); setStatus('ALL'); setSearch('') }} className={`border-b-2 px-4 py-2.5 text-xs ${section === 'suppliers' ? 'border-brand font-semibold text-brand-dark' : 'border-transparent text-muted'}`}>
            Nhà cung cấp <span className="ml-1 rounded-full bg-chip px-1.5 py-0.5">{suppliers.length}</span>
          </button>
        </div>

        <Card title={section === 'feeds' ? 'Danh sách thức ăn' : 'Danh sách nhà cung cấp'} sub={`${currentTabCount} mục`}>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end">
            <Field label="Tìm kiếm" id="feed-catalogue-search">
              <input id="feed-catalogue-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={section === 'feeds' ? 'Tìm mã, tên thức ăn...' : 'Tìm tên, số điện thoại, khu vực...'} className={`${inputCls} sm:w-[310px]`} />
            </Field>
            {section === 'feeds' && <Field label="Nhóm thức ăn" id="feed-catalogue-group"><Select id="feed-catalogue-group" value={group} onChange={(event) => setGroup(event.target.value as FeedGroup | 'ALL')} className="sm:w-[240px]"><option value="ALL">Tất cả nhóm</option>{GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>}
            <Field label="Trạng thái" id="feed-catalogue-status"><Select id="feed-catalogue-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="sm:w-[190px]"><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></Select></Field>
            <span className="pb-2 text-xs text-muted">{section === 'feeds' ? filteredFeeds.length : filteredSuppliers.length} kết quả</span>
          </div>

          {query.loading && !query.data && <div role="status" className="rounded-md border border-edge p-8 text-center text-sm text-muted">Đang tải danh mục…</div>}
          {errorMessage && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg p-4 text-sm text-err-fg"><span>{errorMessage}</span><Button size="sm" disabled={query.loading} onClick={() => query.refetch()}>{query.loading ? 'Đang tải…' : 'Thử tải lại'}</Button></div>}
          {!query.loading && !errorMessage && section === 'feeds' && filteredFeeds.length === 0 && <Note tone="info">{items.length ? 'Không tìm thấy thức ăn phù hợp.' : 'Chưa có thức ăn trong danh mục.'}</Note>}
          {!query.loading && !errorMessage && section === 'suppliers' && filteredSuppliers.length === 0 && <Note tone="info">{suppliers.length ? 'Không tìm thấy nhà cung cấp phù hợp.' : 'Chưa có nhà cung cấp trong danh mục.'}</Note>}

          {!query.loading && !errorMessage && section === 'feeds' && filteredFeeds.length > 0 && <Table scroll>
            <thead><tr><Th>Mã</Th><Th>Thức ăn</Th><Th>Nhóm</Th><Th>Đơn vị tồn</Th><Th>Đơn vị nhập / quy đổi</Th><Th>Tồn tối thiểu</Th><Th>Giá bình quân</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></thead>
            <tbody>{filteredFeeds.map((item) => {
              const stockRow = stock.find((row) => row.feedItemId === item.id)
              const averageCost = stockRow && stockRow.onHandKg > 0 ? stockRow.stockValue / stockRow.onHandKg : null
              return <tr key={item.id}>
                <Td><strong>{item.code}</strong></Td><Td>{item.name}</Td><Td>{GROUP_LABELS[item.group as FeedGroup] ?? item.group}</Td><Td>{item.stockUnit}</Td>
                <Td>{item.purchaseUnit} · {quantity.format(item.kgPerPurchaseUnit)} kg/{item.purchaseUnit}</Td><Td>{quantity.format(item.minimumStockKg)} kg</Td>
                <Td>{averageCost === null ? '—' : `${money.format(averageCost)} ₫/kg`}</Td><Td><Badge tone={item.available ? 'ok' : 'warn'}>{item.available ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge></Td>
                <Td><div className="flex flex-wrap gap-1"><Button size="sm" disabled={backendMode === 'backend'} onClick={() => { setActionError(''); setDialog({ kind: 'feed', item }) }}>Sửa</Button><Button size="sm" disabled={busy || backendMode === 'backend'} onClick={() => void toggleFeed(item)}>{item.available ? 'Ngừng' : 'Kích hoạt'}</Button></div></Td>
              </tr>
            })}</tbody>
          </Table>}

          {!query.loading && !errorMessage && section === 'suppliers' && filteredSuppliers.length > 0 && <Table scroll>
            <thead><tr><Th>Nhà cung cấp</Th><Th>Điện thoại</Th><Th>Khu vực / địa chỉ</Th><Th>Ghi chú</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></thead>
            <tbody>{filteredSuppliers.map((supplier) => <tr key={supplier.id}>
              <Td><strong>{supplier.name}</strong></Td><Td>{supplier.phone || '—'}</Td><Td>{supplier.area || '—'}</Td><Td>{supplier.note || '—'}</Td>
              <Td><Badge tone={supplier.active ? 'ok' : 'warn'}>{supplier.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge></Td>
              <Td><div className="flex flex-wrap gap-1"><Button size="sm" disabled={backendMode === 'backend'} onClick={() => { setActionError(''); setDialog({ kind: 'supplier', supplier }) }}>Sửa</Button><Button size="sm" disabled={busy || backendMode === 'backend'} onClick={() => void toggleSupplier(supplier)}>{supplier.active ? 'Ngừng' : 'Kích hoạt'}</Button></div></Td>
            </tr>)}</tbody>
          </Table>}
        </Card>
        {section === 'feeds' && <Note tone="info">Giá bình quân được tính từ giá trị và lượng tồn hiện tại; khi chưa có giá trị để tính, hiển thị “—”. Mặt hàng và nhà cung cấp được ngừng hoạt động thay vì xóa.</Note>}
        {section === 'suppliers' && <Note tone="info">Nhà cung cấp đã dùng trên phiếu cũ vẫn được giữ trong lịch sử. Nhà cung cấp ngừng hoạt động không xuất hiện khi lập phiếu mới.</Note>}
      </section>

      {dialog?.kind === 'feed' && <FeedFormDialog item={dialog.item} suggested={suggestedCode(items)} stock={stock} saving={busy} onClose={() => setDialog(null)} onSave={(input) => void saveFeed(input)} />}
      {dialog?.kind === 'supplier' && <SupplierFormDialog supplier={dialog.supplier} saving={busy} onClose={() => setDialog(null)} onSave={(input) => void saveSupplierRow(input)} />}
    </Layout>
  )
}

function FeedFormDialog({ item, suggested, stock, saving, onClose, onSave }: {
  item?: FeedCatalogueItem
  suggested: string
  stock: readonly FeedStockRow[]
  saving: boolean
  onClose: () => void
  onSave: (input: FeedCatalogueInput) => void
}) {
  const [code, setCode] = useState(item?.code ?? suggested)
  const [name, setName] = useState(item?.name ?? '')
  const [group, setGroup] = useState<FeedGroup | ''>((item?.group as FeedGroup | undefined) ?? '')
  const [purchaseUnit, setPurchaseUnit] = useState(item?.purchaseUnit ?? 'kg')
  const [kgPerPurchaseUnit, setKgPerPurchaseUnit] = useState(String(item?.kgPerPurchaseUnit ?? 1))
  const [minimumStockKg, setMinimumStockKg] = useState(String(item?.minimumStockKg ?? 0))
  const [nutritionNote, setNutritionNote] = useState(item?.nutritionNote ?? '')
  const [available, setAvailable] = useState(item?.available ?? true)
  const [error, setError] = useState('')
  const stockRow = item ? stock.find((row) => row.feedItemId === item.id) : undefined
  const codeLocked = Boolean(item && stockRow && stockRow.onHandKg > 0)

  const submit = () => {
    const conversion = Number(kgPerPurchaseUnit)
    const minimum = Number(minimumStockKg)
    if (!/^TA-\d{2,}$/i.test(code.trim())) return setError('Mã thức ăn theo dạng TA-nn.')
    if (!name.trim()) return setError('Nhập tên thức ăn.')
    if (!group) return setError('Chọn nhóm thức ăn.')
    if (!purchaseUnit.trim()) return setError('Nhập đơn vị nhập.')
    if (!Number.isFinite(conversion) || conversion <= 0) return setError('Quy đổi phải lớn hơn 0.')
    if (!Number.isFinite(minimum) || minimum < 0) return setError('Mức tồn tối thiểu phải là số không âm.')
    if (nutritionNote.length > 500) return setError('Ghi chú dinh dưỡng tối đa 500 ký tự.')
    setError('')
    onSave({ ...(item ? { id: item.id } : {}), code, name, group, purchaseUnit, kgPerPurchaseUnit: conversion, minimumStockKg: minimum, nutritionNote, available })
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-2 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={item ? 'Sửa thức ăn' : 'Thêm thức ăn'} className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
      <header className="mb-4 flex items-start gap-3"><div><h2 className="m-0 text-lg font-semibold">{item ? 'Sửa thức ăn' : 'Thêm thức ăn'}</h2><p className="mb-0 mt-1 text-xs text-muted">Thông tin này dùng chung trong tồn kho và các phiếu thức ăn.</p></div><span className="flex-1" /><Button size="sm" disabled={saving} aria-label="Đóng" onClick={onClose}>Đóng</Button></header>
      {error && <div role="alert" className="mb-3 rounded border border-err-bg bg-err-bg p-3 text-xs text-err-fg">{error}</div>}
      {codeLocked && <Note tone="info">Mã không thể đổi vì mặt hàng đã có tồn kho. Mặt hàng có phát sinh sẽ được giữ lại và chỉ có thể ngừng hoạt động.</Note>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mã thức ăn *" id="feed-catalogue-code"><input id="feed-catalogue-code" maxLength={20} disabled={saving || codeLocked} value={code} onChange={(event) => setCode(event.target.value)} className={inputCls} /></Field>
        <Field label="Tên thức ăn *" id="feed-catalogue-name"><input id="feed-catalogue-name" maxLength={100} disabled={saving} value={name} onChange={(event) => setName(event.target.value)} className={inputCls} /></Field>
        <Field label="Nhóm thức ăn *" id="feed-catalogue-form-group"><Select id="feed-catalogue-form-group" disabled={saving} value={group} onChange={(event) => setGroup(event.target.value as FeedGroup | '')}><option value="">Chọn nhóm</option>{GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Đơn vị tồn" id="feed-catalogue-stock-unit"><input id="feed-catalogue-stock-unit" readOnly value="kg" className={inputCls} /></Field>
        <Field label="Đơn vị nhập *" id="feed-catalogue-purchase-unit"><input id="feed-catalogue-purchase-unit" maxLength={30} disabled={saving} value={purchaseUnit} onChange={(event) => setPurchaseUnit(event.target.value)} className={inputCls} /></Field>
        <Field label="Quy đổi (kg / đơn vị nhập) *" id="feed-catalogue-conversion"><input id="feed-catalogue-conversion" type="number" min="0.001" step="0.001" disabled={saving} value={kgPerPurchaseUnit} onChange={(event) => setKgPerPurchaseUnit(event.target.value)} className={inputCls} /></Field>
        <Field label="Mức tồn tối thiểu (kg)" id="feed-catalogue-minimum"><input id="feed-catalogue-minimum" type="number" min="0" step="0.001" disabled={saving} value={minimumStockKg} onChange={(event) => setMinimumStockKg(event.target.value)} className={inputCls} /></Field>
        <Field label="Ghi chú dinh dưỡng" id="feed-catalogue-note"><Textarea id="feed-catalogue-note" rows={2} maxLength={500} disabled={saving} value={nutritionNote} onChange={(event) => setNutritionNote(event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" disabled={saving} checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Đang hoạt động · thức ăn ngừng hoạt động không được chọn trong phiếu mới</label>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button disabled={saving} onClick={onClose}>Hủy</Button><Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : 'Lưu thức ăn'}</Button></div>
    </section>
  </div>
}

function SupplierFormDialog({ supplier, saving, onClose, onSave }: {
  supplier?: FeedSupplier
  saving: boolean
  onClose: () => void
  onSave: (input: FeedSupplierInput) => void
}) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [area, setArea] = useState(supplier?.area ?? '')
  const [note, setNote] = useState(supplier?.note ?? '')
  const [active, setActive] = useState(supplier?.active ?? true)
  const [error, setError] = useState('')

  const submit = () => {
    if (!name.trim()) return setError('Nhập tên nhà cung cấp.')
    if (name.trim().length > 150) return setError('Tên nhà cung cấp tối đa 150 ký tự.')
    if (phone.length > 50) return setError('Số điện thoại tối đa 50 ký tự.')
    if (area.length > 255) return setError('Khu vực hoặc địa chỉ tối đa 255 ký tự.')
    if (note.length > 500) return setError('Ghi chú tối đa 500 ký tự.')
    setError('')
    onSave({ ...(supplier ? { id: supplier.id } : {}), name, phone, area, note, active })
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-2 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'} className="my-auto max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
      <header className="mb-4 flex items-start gap-3"><div><h2 className="m-0 text-lg font-semibold">{supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h2><p className="mb-0 mt-1 text-xs text-muted">Nhà cung cấp đang hoạt động xuất hiện khi lập phiếu nhập.</p></div><span className="flex-1" /><Button size="sm" disabled={saving} aria-label="Đóng" onClick={onClose}>Đóng</Button></header>
      {error && <div role="alert" className="mb-3 rounded border border-err-bg bg-err-bg p-3 text-xs text-err-fg">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên nhà cung cấp *" id="feed-supplier-name"><input id="feed-supplier-name" maxLength={150} disabled={saving} value={name} onChange={(event) => setName(event.target.value)} className={inputCls} /></Field>
        <Field label="Điện thoại" id="feed-supplier-phone"><input id="feed-supplier-phone" maxLength={50} disabled={saving} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} /></Field>
        <Field label="Khu vực / địa chỉ" id="feed-supplier-area"><input id="feed-supplier-area" maxLength={255} disabled={saving} value={area} onChange={(event) => setArea(event.target.value)} className={inputCls} /></Field>
        <Field label="Ghi chú" id="feed-supplier-note"><Textarea id="feed-supplier-note" maxLength={500} disabled={saving} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" disabled={saving} checked={active} onChange={(event) => setActive(event.target.checked)} /> Đang hoạt động</label>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button disabled={saving} onClick={onClose}>Hủy</Button><Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : 'Lưu nhà cung cấp'}</Button></div>
    </section>
  </div>
}
