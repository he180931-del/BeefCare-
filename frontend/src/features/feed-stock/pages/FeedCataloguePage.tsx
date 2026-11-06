import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Button, Card, Field, Foot, Note, PageHeader, Radio, Segmented, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedCatalogue, listFeedSuppliers, saveFeedCatalogueItem, saveFeedSupplier, setFeedSupplierActive } from '../api/feedCatalogueApi'
import { listFeedStock } from '../api/feedStockApi'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { FEED_GROUP_LABELS, feedGroupLabel, formatNumber } from '../domain/feedLabels'
import type { FeedGroup, FeedStockRow } from '../types'
import type { FeedCatalogueInput, FeedCatalogueItem, FeedSupplier, FeedSupplierInput } from '../types/feedCatalogue'

type CatalogueSection = 'feeds' | 'suppliers'
const GROUPS = Object.entries(FEED_GROUP_LABELS) as Array<[FeedGroup, string]>
const PURCHASE_UNITS = ['kg', 'Bao', 'Cuộn', 'Bó', 'Thùng']
const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
const FOOT = 'Danh mục thức ăn (Chủ trại, Quản lý). Chọn một dòng để sửa ở khung bên phải. Quy cách nhập dùng để quy đổi bao, cuộn về kg khi lập phiếu nhập kho. Tab “Nhà cung cấp” quản lý tên, điện thoại, địa chỉ và công nợ nhà cung cấp.'

function suggestedCode(items: readonly FeedCatalogueItem[]) {
  const next = Math.max(0, ...items.map((item) => Number(item.code.match(/^TA-(\d+)$/i)?.[1] ?? 0))) + 1
  return `TA-${String(next).padStart(2, '0')}`
}

/** Giá BQ: weighted average cost from stock when there is stock, otherwise the catalogue's own average cost. */
function averageCost(item: FeedCatalogueItem, stock: FeedStockRow | undefined) {
  if (stock && stock.onHandKg > 0) return stock.stockValue / stock.onHandKg
  return item.averageUnitCost ?? null
}

export default function FeedCataloguePage() {
  const [params, setParams] = useSearchParams()
  const query = useQuery(async () => {
    const [items, suppliers, stock] = await Promise.all([listFeedCatalogue(), listFeedSuppliers(), listFeedStock()])
    return { items, suppliers, stock }
  }, [])
  const [section, setSection] = useState<CatalogueSection>('feeds')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<FeedGroup | 'ALL'>('ALL')
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [adding, setAdding] = useState(false)
  const [supplierDialog, setSupplierDialog] = useState<{ supplier?: FeedSupplier } | null>(null)
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
      && (!q || normalize(`${item.code} ${item.name} ${item.group} ${feedGroupLabel(item.group)}`).includes(q)))
  }, [group, items, search, status])
  const filteredSuppliers = useMemo(() => {
    const q = normalize(search.trim())
    return suppliers.filter((supplier) => (status === 'ALL' || (supplier.active ? 'ACTIVE' : 'INACTIVE') === status)
      && (!q || normalize(`${supplier.name} ${supplier.phone} ${supplier.area}`).includes(q)))
  }, [search, status, suppliers])
  // The selected row is kept in the URL (?feed=TA-06) so an edit can be linked; the first row opens by default.
  const selected = adding ? undefined : items.find((item) => item.code === params.get('feed')) ?? filteredFeeds[0]

  const perform = async (action: () => Promise<unknown>, successMessage: string) => {
    if (busyRef.current || backendMode === 'backend') return false
    busyRef.current = true
    setBusy(true)
    setActionError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
      await query.refetch()
      return true
    } catch (error) {
      setActionError(userFacingError(error, 'Không thể lưu thay đổi. Vui lòng kiểm tra thông tin.'))
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const select = (item: FeedCatalogueItem) => { setAdding(false); setActionError(''); setParams((current) => { const next = new URLSearchParams(current); next.set('feed', item.code); return next }) }
  const saveFeed = async (input: FeedCatalogueInput) => {
    const saved = await perform(async () => {
      const result = await saveFeedCatalogueItem(input)
      setAdding(false)
      setParams((current) => { const next = new URLSearchParams(current); next.set('feed', result.code); return next })
      // Keep the list filter from hiding the row that was just saved.
      if (!result.available && status === 'ACTIVE') setStatus('ALL')
      return result
    }, '')
    if (saved) setMessage(`${input.name.trim()} đã được lưu.`)
  }
  const saveSupplierRow = async (input: FeedSupplierInput) => {
    const saved = await perform(() => saveFeedSupplier(input), `${input.name.trim()} đã được lưu.`)
    if (saved) setSupplierDialog(null)
  }
  const toggleSupplier = (supplier: FeedSupplier) => perform(
    () => setFeedSupplierActive(supplier.id, !supplier.active),
    supplier.active ? `${supplier.name} đã ngừng hoạt động.` : `${supplier.name} đã hoạt động trở lại.`,
  )

  const errorMessage = query.error ? userFacingError(query.error, 'Không thể tải danh mục.') : ''
  const filterBar = (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="sr-only" htmlFor="feed-catalogue-search">Tìm kiếm</label>
      <input id="feed-catalogue-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={section === 'feeds' ? 'Tìm mã, tên…' : 'Tìm tên, điện thoại, khu vực…'} className={`${inputCls} sm:w-[240px]`} />
      {section === 'feeds' && (
        <>
          <label className="sr-only" htmlFor="feed-catalogue-group">Nhóm thức ăn</label>
          <Select id="feed-catalogue-group" value={group} onChange={(event) => setGroup(event.target.value as FeedGroup | 'ALL')} className="sm:w-[160px]"><option value="ALL">Nhóm: Tất cả</option>{GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </>
      )}
      <label className="sr-only" htmlFor="feed-catalogue-status">Trạng thái</label>
      <Select id="feed-catalogue-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="sm:w-[150px]">
        <option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Ngừng dùng</option><option value="ALL">Tất cả trạng thái</option>
      </Select>
    </div>
  )

  return (
    <Layout title="Thức ăn › Danh mục" user="manager">
      <PageHeader title="Danh mục thức ăn" sub="Thức ăn dùng trong phiếu nhập, khẩu phần và nhật ký cho ăn">
        <Button variant="primary" disabled={backendMode === 'backend'} title={backendMode === 'backend' ? 'Thao tác chưa sẵn sàng ở chế độ kết nối.' : undefined}
          onClick={() => { setActionError(''); if (section === 'feeds') setAdding(true); else setSupplierDialog({}) }}>
          <span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />{section === 'feeds' ? 'Thêm thức ăn' : 'Thêm nhà cung cấp'}</span>
        </Button>
      </PageHeader>
      <FeedManagementTabs />
      <Segmented
        value={section}
        onChange={(value) => { setSection(value as CatalogueSection); setGroup('ALL'); setStatus('ACTIVE'); setSearch(''); setAdding(false) }}
        options={[{ value: 'feeds', label: `Thức ăn (${items.length})` }, { value: 'suppliers', label: `Nhà cung cấp (${suppliers.length})` }]}
      />
      {backendMode === 'backend' && <Note tone="warn">Danh sách lấy từ hệ thống đã kết nối. Tạo, sửa và đổi trạng thái chưa sẵn sàng.</Note>}
      {message && <Note tone="ok">{message}</Note>}
      {actionError && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{actionError}</div>}

      <section role="tabpanel" aria-label="Danh mục thức ăn và nhà cung cấp" className="grid items-start gap-4 xl:grid-cols-[minmax(0,740px)_minmax(0,356px)]">
        <Card>
          {filterBar}
          {query.loading && !query.data && <div role="status" className="rounded-md border border-edge p-8 text-center text-sm text-muted">Đang tải danh mục…</div>}
          {errorMessage && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg p-4 text-sm text-err-fg"><span>{errorMessage}</span><Button size="sm" disabled={query.loading} onClick={() => query.refetch()}>{query.loading ? 'Đang tải…' : 'Thử tải lại'}</Button></div>}
          {!query.loading && !errorMessage && section === 'feeds' && filteredFeeds.length === 0 && <Note tone="info">{items.length ? 'Không tìm thấy thức ăn phù hợp.' : 'Chưa có thức ăn trong danh mục.'}</Note>}
          {!query.loading && !errorMessage && section === 'suppliers' && filteredSuppliers.length === 0 && <Note tone="info">{suppliers.length ? 'Không tìm thấy nhà cung cấp phù hợp.' : 'Chưa có nhà cung cấp trong danh mục.'}</Note>}

          {!query.loading && !errorMessage && section === 'feeds' && filteredFeeds.length > 0 && (
            <Table scroll stack={false}>
              <thead><tr><Th>Mã</Th><Th>Tên thức ăn</Th><Th>Nhóm</Th><Th>ĐVT</Th><Th>Quy cách nhập</Th><Th>Tối thiểu (kg)</Th><Th>Giá BQ</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>
                {filteredFeeds.map((item) => {
                  const cost = averageCost(item, stock.find((row) => row.feedItemId === item.id))
                  const active = selected?.id === item.id
                  return (
                    <tr key={item.id} aria-selected={active} onClick={() => select(item)} className={`cursor-pointer hover:bg-page ${active ? 'bg-[#eef4ef]' : ''}`}>
                      <Td className="whitespace-nowrap font-semibold text-brand">{item.code}</Td>
                      <Td className="min-w-[110px]">{item.name}</Td>
                      <Td className="whitespace-nowrap">{feedGroupLabel(item.group)}</Td>
                      <Td>{item.stockUnit}</Td>
                      <Td className="whitespace-nowrap">{item.kgPerPurchaseUnit <= 1 ? 'Theo kg' : `${item.purchaseUnit} ${formatNumber(item.kgPerPurchaseUnit, 3)} kg`}</Td>
                      <Td className="whitespace-nowrap">{formatNumber(item.minimumStockKg, 3)}</Td>
                      <Td className="whitespace-nowrap">{cost === null ? '—' : `${formatNumber(cost, 0)} đ`}</Td>
                      <Td className="whitespace-nowrap"><Badge tone={item.available ? 'ok' : 'warn'} icon={item.available ? 'circle-check' : undefined}>{item.available ? 'Đang dùng' : 'Ngừng dùng'}</Badge></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}

          {!query.loading && !errorMessage && section === 'suppliers' && filteredSuppliers.length > 0 && (
            <Table scroll stack={false}>
              <thead><tr><Th>Nhà cung cấp</Th><Th>Điện thoại</Th><Th>Khu vực / địa chỉ</Th><Th>Ghi chú</Th><Th>Trạng thái</Th><Th aria-label="Thao tác" /></tr></thead>
              <tbody>{filteredSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <Td className="font-semibold">{supplier.name}</Td><Td className="whitespace-nowrap">{supplier.phone || '—'}</Td><Td>{supplier.area || '—'}</Td><Td>{supplier.note || '—'}</Td>
                  <Td className="whitespace-nowrap"><Badge tone={supplier.active ? 'ok' : 'warn'}>{supplier.active ? 'Đang dùng' : 'Ngừng dùng'}</Badge></Td>
                  <Td><div className="flex gap-2 whitespace-nowrap"><Button variant="link" size="sm" disabled={backendMode === 'backend'} onClick={() => { setActionError(''); setSupplierDialog({ supplier }) }}>Sửa</Button><Button variant="link" size="sm" disabled={busy || backendMode === 'backend'} onClick={() => void toggleSupplier(supplier)}>{supplier.active ? 'Ngừng' : 'Kích hoạt'}</Button></div></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
          <p className="m-0 text-[11px] text-muted">
            {section === 'feeds'
              ? 'Giá BQ = giá nhập bình quân gia quyền, tự cập nhật khi lưu phiếu nhập kho. Mức tối thiểu dùng cho cảnh báo “Sắp hết”.'
              : 'Nhà cung cấp đã dùng trên phiếu cũ vẫn được giữ trong lịch sử. Nhà cung cấp ngừng dùng không xuất hiện khi lập phiếu mới.'}
          </p>
        </Card>

        {section === 'feeds' && query.data && (
          <FeedEditPanel
            key={adding ? 'new' : selected?.id ?? 'none'}
            item={selected}
            suggested={suggestedCode(items)}
            stock={stock}
            saving={busy}
            onCancel={() => { setAdding(false); setActionError('') }}
            onSave={(input) => void saveFeed(input)}
          />
        )}
      </section>
      <Foot>{FOOT}</Foot>
      {supplierDialog && <SupplierFormDialog supplier={supplierDialog.supplier} saving={busy} onClose={() => setSupplierDialog(null)} onSave={(input) => void saveSupplierRow(input)} />}
    </Layout>
  )
}

function FeedEditPanel({ item, suggested, stock, saving, onCancel, onSave }: {
  item?: FeedCatalogueItem
  suggested: string
  stock: readonly FeedStockRow[]
  saving: boolean
  onCancel: () => void
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
  const locked = Boolean(item && stockRow && stockRow.onHandKg > 0)
  const units = PURCHASE_UNITS.includes(purchaseUnit) ? PURCHASE_UNITS : [...PURCHASE_UNITS, purchaseUnit]

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

  return (
    <Card
      title={item ? `Sửa thức ăn ${item.code}` : 'Thêm thức ăn'}
      sub={item ? `${item.name}${locked ? ' · đang có giao dịch kho' : ''}` : 'Mã mới được gợi ý theo số thứ tự kế tiếp'}
    >
      {error && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mã *" id="feed-catalogue-code"><input id="feed-catalogue-code" maxLength={20} readOnly={saving || locked} value={code} onChange={(event) => setCode(event.target.value)} className={inputCls} /></Field>
        <Field label="Tên thức ăn *" id="feed-catalogue-name"><input id="feed-catalogue-name" maxLength={100} readOnly={saving} value={name} onChange={(event) => setName(event.target.value)} className={inputCls} /></Field>
        <Field label="Nhóm *" id="feed-catalogue-form-group"><Select id="feed-catalogue-form-group" disabled={saving} value={group} onChange={(event) => setGroup(event.target.value as FeedGroup | '')}><option value="">Chọn nhóm</option>{GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Đơn vị tính kho *" id="feed-catalogue-stock-unit"><input id="feed-catalogue-stock-unit" readOnly value="kg" className={inputCls} /></Field>
      </div>
      {locked && <p className="m-0 text-[11px] text-muted">Mã và đơn vị tính không đổi khi đã có giao dịch kho</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quy cách nhập" id="feed-catalogue-purchase-unit">
          <Select id="feed-catalogue-purchase-unit" disabled={saving} value={purchaseUnit} onChange={(event) => setPurchaseUnit(event.target.value)}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</Select>
        </Field>
        <Field label="Quy đổi" id="feed-catalogue-conversion">
          <div className="relative">
            <input id="feed-catalogue-conversion" type="number" min="0.001" step="0.001" readOnly={saving} value={kgPerPurchaseUnit} onChange={(event) => setKgPerPurchaseUnit(event.target.value)} className={`${inputCls} pr-[70px]`} />
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg / {purchaseUnit.toLocaleLowerCase('vi')}</span>
          </div>
        </Field>
      </div>
      <Field label="Mức tồn tối thiểu" id="feed-catalogue-minimum" hint="Tồn ≤ mức này → nhắc việc “Sắp hết thức ăn”">
        <div className="relative">
          <input id="feed-catalogue-minimum" type="number" min="0" step="0.001" readOnly={saving} value={minimumStockKg} onChange={(event) => setMinimumStockKg(event.target.value)} className={`${inputCls} pr-9`} />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg</span>
        </div>
      </Field>
      <Field label="Ghi chú dinh dưỡng" id="feed-catalogue-note"><Textarea id="feed-catalogue-note" rows={2} maxLength={500} readOnly={saving} value={nutritionNote} onChange={(event) => setNutritionNote(event.target.value)} /></Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Trạng thái</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <Radio name="feed-catalogue-active" checked={available} onChange={() => setAvailable(true)}>Đang dùng</Radio>
          <Radio name="feed-catalogue-active" checked={!available} onChange={() => setAvailable(false)}>Ngừng dùng</Radio>
        </div>
      </div>
      <Note tone="info">Thức ăn đã có giao dịch kho chỉ ngừng dùng, không xóa. Thức ăn ngừng dùng không chọn được trong phiếu nhập, khẩu phần và nhật ký mới.</Note>
      <div className="flex justify-end gap-2">
        <Button disabled={saving} onClick={onCancel}>Hủy</Button>
        <Button variant="primary" disabled={saving || backendMode === 'backend'} onClick={submit}>{saving ? 'Đang lưu…' : 'Lưu'}</Button>
      </div>
    </Card>
  )
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

  return (
    <Modal title={supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'} sub="Nhà cung cấp đang dùng xuất hiện khi lập phiếu nhập" topTitle="Thức ăn › Danh mục" width={560} onClose={onClose}>
      {error && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên nhà cung cấp *" id="feed-supplier-name"><input id="feed-supplier-name" maxLength={150} disabled={saving} value={name} onChange={(event) => setName(event.target.value)} className={inputCls} /></Field>
        <Field label="Điện thoại" id="feed-supplier-phone"><input id="feed-supplier-phone" maxLength={50} disabled={saving} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} /></Field>
        <Field label="Khu vực / địa chỉ" id="feed-supplier-area"><input id="feed-supplier-area" maxLength={255} disabled={saving} value={area} onChange={(event) => setArea(event.target.value)} className={inputCls} /></Field>
        <Field label="Ghi chú" id="feed-supplier-note"><Textarea id="feed-supplier-note" maxLength={500} disabled={saving} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <div className="flex items-center gap-x-5 text-[13px] sm:col-span-2">
          <Radio name="feed-supplier-active" checked={active} onChange={() => setActive(true)}>Đang dùng</Radio>
          <Radio name="feed-supplier-active" checked={!active} onChange={() => setActive(false)}>Ngừng dùng</Radio>
        </div>
      </div>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : 'Lưu nhà cung cấp'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
