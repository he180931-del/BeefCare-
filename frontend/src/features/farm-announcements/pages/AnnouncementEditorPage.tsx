import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, ErrorBlock, Field, Foot, inputCls, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { announcementsApi } from '../api/announcementsApi'
import RecipientsCard, { type EditorAudience } from '../components/RecipientsCard'
import ReviewDialog from '../components/ReviewDialog'
import { messageOf, Toast, useViewer } from '../components/shared'
import { AnnouncementError, BODY_MAX, canWrite, MESSAGES, resolveRecipients, TITLE_MAX, validateText } from '../domain/announcementRules'
import { applyFormat, type Format } from '../domain/richText'

type Errors = Partial<Record<'title' | 'body' | 'audience', string>>
const TITLE = 'Soạn thông báo'
const EMPTY: EditorAudience = { allManagers: false, allTechnicians: false, memberIds: [], namedOpen: false }
const TOOLS: Array<{ format: Format; label: string; content: 'B' | 'I' | '1.' | 'list' | 'link' }> = [
  { format: 'bold', label: 'In đậm', content: 'B' },
  { format: 'italic', label: 'In nghiêng', content: 'I' },
  { format: 'ul', label: 'Danh sách', content: 'list' },
  { format: 'ol', label: 'Danh sách số', content: '1.' },
  { format: 'link', label: 'Liên kết', content: 'link' },
]

export default function AnnouncementEditorPage() {
  const viewer = useViewer()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [m, , closeModal] = useModalParam()
  const draftParam = Number(params.get('nhap')) || null

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<EditorAudience>(EMPTY)
  const [draftId, setDraftId] = useState<number | null>(draftParam)
  const [version, setVersion] = useState<number | undefined>()
  const [errors, setErrors] = useState<Errors>({})
  const [banner, setBanner] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const loaded = useRef<number | null>(null)

  const options = useQuery(() => announcementsApi.listMembers(viewer), [viewer])
  const draft = useQuery(() => (draftParam ? announcementsApi.get(draftParam, viewer) : Promise.resolve(null)), [draftParam, viewer])

  useEffect(() => {
    const d = draft.data
    if (!d || loaded.current === d.id) return
    loaded.current = d.id
    if (d.state !== 'DRAFT' || !d.isAuthor) { setBanner(MESSAGES.forbidden); return }
    setTitle(d.draftTitle)
    setBody(d.draftBody)
    setAudience({ ...d.audience, namedOpen: d.audience.memberIds.length > 0 })
    setVersion(d.version)
    setDraftId(d.id)
  }, [draft.data])

  const resolved = useMemo(
    () => (options.data ? resolveRecipients(options.data.members, audience, { id: -1, name: viewer.name, role: viewer.role, active: true }).recipients : []),
    [options.data, audience, viewer],
  )

  if (!canWrite(viewer.role)) return <Layout title={TITLE}><Note tone="err">{MESSAGES.forbidden}</Note></Layout>
  if ((options.loading && !options.data) || (draft.loading && !draft.data && draftParam)) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (options.error != null || draft.error != null || !options.data) {
    return <Layout title={TITLE}><ErrorBlock message={messageOf(options.error ?? draft.error, 'Không tải được dữ liệu soạn thông báo.')} onRetry={() => { options.refetch(); draft.refetch() }} /></Layout>
  }

  const fail = (e: unknown) => {
    if (e instanceof AnnouncementError && e.field) setErrors({ [e.field]: e.message })
    else if (e instanceof AnnouncementError && e.code === 'NOT_ALLOWED') setErrors({ audience: e.message })
    else setBanner(messageOf(e, 'Không lưu được. Vui lòng thử lại.'))
  }

  const save = async () => {
    const found: Errors = { ...validateText({ title }), ...(body.trim() ? validateText({ body }) : {}) }
    setErrors(found)
    if (found.title || found.body) return null
    setBusy(true)
    setBanner('')
    try {
      const { namedOpen: _open, ...selection } = audience
      const saved = await announcementsApi.saveDraft(viewer, { id: draftId ?? undefined, title, body, audience: selection, expectedVersion: version })
      loaded.current = saved.id
      setDraftId(saved.id)
      setVersion(saved.version)
      if (draftParam !== saved.id) { const next = new URLSearchParams(params); next.set('nhap', String(saved.id)); setParams(next, { replace: true }) }
      return saved
    } catch (e) { fail(e); return null } finally { setBusy(false) }
  }

  const saveDraft = async () => { if (await save()) setToast(MESSAGES.draftSaved) }
  const review = async () => {
    const found = validateText({ title, body })
    if (found.title || found.body) { setErrors(found); return }
    const saved = await save()
    if (!saved) return
    const next = new URLSearchParams(params)
    next.set('nhap', String(saved.id))
    next.set('m', 'xem-lai')
    setParams(next)
  }

  const format = (f: Format) => {
    const el = bodyRef.current
    if (!el) return
    const next = applyFormat({ value: body, start: el.selectionStart, end: el.selectionEnd }, f)
    setBody(next.value)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.start, next.end) })
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Soạn thông báo" sub="Viết nội dung, chọn người nhận rồi lưu nháp hoặc xem lại trước khi đăng.">
          <Button disabled={busy} onClick={saveDraft}>Lưu nháp</Button>
          <Button variant="primary" disabled={busy} onClick={review}>Xem lại &amp; đăng</Button>
        </PageHeader>
        {banner && <Note tone="err">{banner}</Note>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          <Card title="Nội dung" actions={<Badge tone="outline">Bản nháp</Badge>}>
            <div className="flex flex-col gap-4">
              <Field label="Tiêu đề *" id="ann-title" hint={errors.title ? <span role="alert" className="text-err-fg">{errors.title}</span> : `Tối đa ${TITLE_MAX} ký tự · ${title.length}/${TITLE_MAX}`}>
                <input id="ann-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(errors.title)} />
              </Field>
              <Field label="Nội dung *" id="ann-body" hint={errors.body ? <span role="alert" className="text-err-fg">{errors.body}</span> : `Tối đa ${BODY_MAX.toLocaleString('vi-VN')} ký tự · in đậm, nghiêng, danh sách, liên kết`}>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1 rounded-[5px] bg-[#f0f0f0] p-1" role="toolbar" aria-label="Định dạng nội dung">
                    {TOOLS.map((t) => (
                      <button key={t.format} type="button" aria-label={t.label} title={t.label} onClick={() => format(t.format)} className="grid h-[21px] min-w-[25px] cursor-pointer place-items-center rounded bg-transparent px-1.5 text-xs font-semibold text-muted hover:bg-white">
                        {t.content === 'list' ? <Icon name="clipboard-list" size={14} /> : t.content === 'link' ? 'Liên kết' : t.content}
                      </button>
                    ))}
                  </div>
                  <textarea id="ann-body" ref={bodyRef} rows={9} className={`${inputCls} h-auto min-h-[180px] resize-y py-2.5 leading-6`} value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={Boolean(errors.body)} />
                </div>
              </Field>
            </div>
          </Card>
          <RecipientsCard viewer={viewer} options={options.data} audience={audience} resolved={resolved} error={errors.audience ?? ''} onChange={(next) => { setAudience(next); setErrors((e) => ({ ...e, audience: undefined })) }} />
        </div>
        <Foot>Trùng người nhận được tự loại bỏ. Quản lý chỉ gửi được cho Kỹ thuật viên; Chủ trại gửi được cho Quản lý và Kỹ thuật viên.</Foot>
      </div>
      {m === 'xem-lai' && draftId && (
        <ReviewDialog
          viewer={viewer}
          draftId={draftId}
          onBack={closeModal}
          onPublished={(result) => navigate(`/thong-bao?tab=authored&id=${result.announcement.id}`, { state: { toast: MESSAGES.published(result.recipientCount) } })}
        />
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </Layout>
  )
}
