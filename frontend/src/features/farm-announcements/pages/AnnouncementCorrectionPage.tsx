import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, Card, ErrorBlock, Field, Foot, Icon, inputCls, LoadingBlock, Note, PageHeader, Table, Td, Textarea, Th } from '../../../shared/ui'
import { RichTextEditor } from '../components/RichTextEditor'
import { messageOf, useViewer } from '../components/shared'
import { useAnnouncementUseCases } from '../hooks/useAnnouncementUseCases'
import { AnnouncementError, canWrite, MESSAGES } from '../domain/announcementRules'
import { formatFull } from '../domain/format'
import { BODY_MAX, REASON_MAX, validateText } from '../validation/announcementValidation'

type Errors = Partial<Record<'title' | 'body' | 'reason', string>>
const TITLE = 'Đính chính thông báo'

export default function AnnouncementCorrectionPage() {
  const viewer = useViewer()
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const { detail, correct } = useAnnouncementUseCases({ viewer, detailId: id })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [conflict, setConflict] = useState('')
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const loaded = useRef('')

  useEffect(() => {
    const d = detail.data
    if (!d || loaded.current === `${d.id}:${d.version}`) return
    loaded.current = `${d.id}:${d.version}`
    setTitle(d.title)
    setBody(d.body)
    setReason('')
    setConflict('')
  }, [detail.data])

  const back = `/thong-bao?tab=authored&id=${id}`
  const bodyLimitError = `Nội dung tối đa ${BODY_MAX.toLocaleString('vi-VN')} ký tự.`
  const bodyError = errors.body ?? (body.length > BODY_MAX ? bodyLimitError : undefined)
  if (detail.loading && !detail.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (detail.error != null || !detail.data) return <Layout title={TITLE}><ErrorBlock message={messageOf(detail.error, 'Không tải được thông báo.')} onRetry={detail.refetch} /></Layout>

  const a = detail.data
  if (!canWrite(viewer.role) || !a.canCorrect) {
    return (
      <Layout title={TITLE}>
        <div className="flex flex-col items-start gap-3">
          <Note tone="err">Chỉ tác giả của thông báo đã đăng mới đính chính được. {MESSAGES.forbidden}</Note>
          <Button onClick={() => navigate('/thong-bao')}>Quay lại danh sách</Button>
        </div>
      </Layout>
    )
  }

  const next = (a.versions[0]?.versionNo ?? 0) + 1
  const submit = async () => {
    const found = validateText({ title, body, reason })
    setErrors(found)
    if (found.title || found.body || found.reason) return
    setBusy(true)
    setBanner('')
    try {
      const result = await correct(id, { title, body, reason, expectedVersion: a.version })
      navigate(`/thong-bao?tab=authored&id=${id}`, { state: { toast: MESSAGES.corrected(result.versions[0]?.versionNo ?? next) } })
    } catch (e) {
      if (e instanceof AnnouncementError && e.code === 'CONFLICT') setConflict(e.message)
      else if (e instanceof AnnouncementError && e.field) setErrors({ [e.field]: e.message })
      else setBanner(messageOf(e, 'Không lưu được. Vui lòng thử lại.'))
    } finally { setBusy(false) }
  }

  const err = (text?: string) => (text ? <span role="alert" className="text-err-fg">{text}</span> : undefined)
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Đính chính thông báo" sub="Tạo phiên bản mới từ nội dung hiện tại; người nhận sẽ thấy phiên bản đã đính chính.">
          <Button onClick={() => navigate(back)}>Hủy</Button>
          <Button variant="primary" disabled={busy || Boolean(conflict)} onClick={submit}><Icon name="speakerphone" size={16} /> {`Đăng phiên bản ${next}`}</Button>
        </PageHeader>
        {conflict && (
          <Note tone="warn">
            <span className="flex flex-wrap items-center gap-3">{conflict}<Button size="sm" onClick={detail.refetch}>Tải lại</Button></span>
          </Note>
        )}
        {banner && <Note tone="err">{banner}</Note>}
        <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
          <Card variant="panel" title={`Phiên bản ${next}`} actions={<Badge tone="warn">Đang soạn</Badge>}>
            <div className="flex flex-col gap-4">
              <Field label="Tiêu đề *" id="fix-title" hint={err(errors.title)}>
                <input id="fix-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Nội dung *" id="fix-body" hint={bodyError
                ? <span id="fix-body-error" role="alert" className="text-err-fg">{bodyError}</span>
                : <span id="fix-body-hint">Tối đa {BODY_MAX.toLocaleString('vi-VN')} ký tự · {body.length}/{BODY_MAX} · in đậm, nghiêng, danh sách, liên kết</span>}>
                <RichTextEditor id="fix-body" label="Nội dung *" value={body} onChange={(next) => {
                  setBody(next)
                  setErrors((current) => ({ ...current, body: next.length > BODY_MAX ? bodyLimitError : undefined }))
                }} invalid={Boolean(bodyError)} describedBy={bodyError ? 'fix-body-error' : 'fix-body-hint'} />
              </Field>
              <Field label="Lý do đính chính *" id="fix-reason" hint={err(errors.reason) ?? `Tối đa ${REASON_MAX} ký tự`}>
                <Textarea id="fix-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card variant="panel" title="Lịch sử phiên bản">
            <Table stack={false}>
              <thead><tr><Th>Bản</Th><Th>Thời điểm</Th><Th>Người</Th></tr></thead>
              <tbody>
                <tr><Td className="font-medium">{`v${next}`}</Td><Td>Đang soạn</Td><Td>{a.authorName}</Td></tr>
                {[...a.versions].reverse().map((v) => (
                  <tr key={v.id}><Td className="font-medium">{`v${v.versionNo}`}</Td><Td>{formatFull(v.publishedTime)}</Td><Td>{a.authorName}</Td></tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
        <Foot>Phiên bản cũ được giữ nguyên kèm lý do đính chính; chỉ tác giả của thông báo đã đăng mới đính chính được.</Foot>
      </div>
    </Layout>
  )
}
