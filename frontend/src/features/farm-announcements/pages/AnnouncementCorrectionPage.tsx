import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, ErrorBlock, Field, Foot, inputCls, LoadingBlock, Note, PageHeader, Table, Td, Textarea, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { announcementsApi } from '../api/announcementsApi'
import { messageOf, useViewer } from '../components/shared'
import { AnnouncementError, canWrite, MESSAGES, REASON_MAX, validateText } from '../domain/announcementRules'
import { formatFull } from '../domain/format'

type Errors = Partial<Record<'title' | 'body' | 'reason', string>>
const TITLE = 'Đính chính thông báo'

export default function AnnouncementCorrectionPage() {
  const viewer = useViewer()
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const detail = useQuery(() => announcementsApi.get(id, viewer), [id, viewer])
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

  const next = a.version + 1
  const submit = async () => {
    const found = validateText({ title, body, reason })
    setErrors(found)
    if (found.title || found.body || found.reason) return
    setBusy(true)
    setBanner('')
    try {
      const result = await announcementsApi.correct(viewer, id, { title, body, reason, expectedVersion: a.version })
      navigate(`/thong-bao?tab=authored&id=${id}`, { state: { toast: MESSAGES.corrected(result.version) } })
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          <Card title={`Phiên bản ${next}`} actions={<Badge tone="warn">Đang soạn</Badge>}>
            <div className="flex flex-col gap-4">
              <Field label="Tiêu đề *" id="fix-title" hint={err(errors.title)}>
                <input id="fix-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Nội dung *" id="fix-body" hint={err(errors.body)}>
                <Textarea id="fix-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <Field label="Lý do đính chính *" id="fix-reason" hint={err(errors.reason) ?? `Tối đa ${REASON_MAX} ký tự`}>
                <Textarea id="fix-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card title="Lịch sử phiên bản">
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
