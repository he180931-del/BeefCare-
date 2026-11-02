import { useEffect, useState } from 'react'
import { userFacingError } from '../../../api/userFacingError'
import { useModalParam } from '../../../components/Modal'
import { FieldErrors, type FieldErrorMap } from '../domain/catalogueRules'

export interface EditorItem { id: number; name: string; available: boolean }

interface Config<I extends EditorItem, D extends { available: boolean }> {
  items: I[] | null | undefined
  canEdit: boolean
  newDraft: () => D
  toDraft: (item: I) => D
  save: (item: I | null, draft: D) => Promise<I>
  /** Số bản ghi đang tham chiếu mục; > 0 thì ngừng dùng phải xác nhận (MSG-FE18-03). */
  usage: (item: I) => number
  refetch: () => void
}

/**
 * Trạng thái của khung biên tập bên cạnh danh sách: chọn dòng, nháp, lỗi theo ô, lưu và xác nhận ngừng dùng.
 * `item = null` nghĩa là đang thêm mới.
 */
export function useCatalogueEditor<I extends EditorItem, D extends { available: boolean }>(cfg: Config<I, D>) {
  const [modalName, openModal, closeModal] = useModalParam()
  const [target, setTarget] = useState<{ item: I | null } | null>(null)
  const [draft, setDraft] = useState<D | null>(null)
  const [errors, setErrors] = useState<FieldErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const select = (item: I | null) => {
    setTarget({ item })
    setDraft(item ? cfg.toDraft(item) : cfg.newDraft())
    setErrors({})
    setFormError(null)
    setNotice(null)
  }
  useEffect(() => {
    if (!target && cfg.items && cfg.items.length > 0) select(cfg.items[0]!)
  }, [cfg.items])

  const item = target?.item ?? null
  const needsConfirm = Boolean(item && draft && item.available && !draft.available && cfg.usage(item) > 0)

  async function run(next: D) {
    if (!target || !cfg.canEdit) return
    setSaving(true)
    setErrors({})
    setFormError(null)
    try {
      const saved = await cfg.save(target.item, next)
      setTarget({ item: saved })
      setDraft(cfg.toDraft(saved))
      setNotice(`Đã lưu ${saved.name}.`) // MSG-FE18-01
      cfg.refetch()
    } catch (error) {
      if (error instanceof FieldErrors) setErrors(error.fields)
      else setFormError(userFacingError(error, 'Không lưu được. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return {
    item,
    isCreate: Boolean(target && !target.item),
    draft,
    errors,
    formError,
    saving,
    notice,
    modalName,
    openModal,
    closeModal,
    confirmOpen: modalName === 'ngung-dung' && Boolean(item && draft),
    select,
    startCreate: () => select(null),
    /** Bỏ chọn; khi danh sách tải lại, dòng đầu tiên được chọn (dùng sau khi xóa). */
    clear: () => { setTarget(null); setDraft(null); setErrors({}); setNotice(null) },
    cancel: () => {
      if (item) select(item)
      else if (cfg.items?.[0]) select(cfg.items[0])
      else { setTarget(null); setDraft(null); setErrors({}) }
    },
    setField<K extends keyof D>(key: K, value: D[K]) {
      setDraft((d) => (d ? { ...d, [key]: value } : d))
      setErrors((e) => {
        if (!(key as string in e)) return e
        const { [key as string]: _removed, ...rest } = e
        return rest
      })
    },
    submit() {
      if (!draft) return
      if (needsConfirm) openModal('ngung-dung')
      else void run(draft)
    },
    confirmDeactivate() {
      closeModal()
      if (draft) void run({ ...draft, available: false })
    },
  }
}
export type CatalogueEditor<I extends EditorItem, D extends { available: boolean }> = ReturnType<typeof useCatalogueEditor<I, D>>
