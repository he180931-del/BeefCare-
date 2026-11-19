import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { ErrorBlock, Info, LoadingBlock } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { announcementsApi } from '../api/announcementsApi'
import { ROLE_LABEL } from '../domain/format'
import type { PublishResult, Viewer } from '../types'
import { messageOf, RichText } from './shared'

export default function ReviewDialog({ viewer, draftId, onBack, onPublished }: {
  viewer: Viewer
  draftId: number
  onBack: () => void
  onPublished: (result: PublishResult) => void
}) {
  const preview = useQuery(() => announcementsApi.previewPublish(viewer, draftId), [viewer, draftId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const publish = async () => {
    if (!preview.data) return
    setBusy(true)
    setError('')
    try { onPublished(await announcementsApi.publish(viewer, draftId, preview.data.announcement.version)) } catch (e) { setError(messageOf(e, 'Không đăng được thông báo. Vui lòng thử lại.')) } finally { setBusy(false) }
  }

  const a = preview.data?.announcement
  const people = preview.data?.recipients ?? []
  return (
    <Modal title="Xem lại trước khi đăng" sub="Kiểm tra nội dung và người nhận; sau khi đăng, chỉ sửa được bằng đính chính." width={640} onClose={onBack}>
      {preview.loading && !a && <LoadingBlock />}
      {preview.error != null && <ErrorBlock message={messageOf(preview.error, 'Không tải được bản xem lại.')} onRetry={preview.refetch} />}
      {a && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md bg-page p-3.5">
            <div className="text-sm font-semibold text-[#212121]">{a.title}</div>
            <RichText text={a.body} className="text-[13px]" />
          </div>
          <Info cols={2} items={[
            ['Tác giả', `${a.authorName} · ${ROLE_LABEL[a.authorRole]}`],
            ['Đối tượng', a.audienceLabel],
            ['Người nhận', people.length ? `${people.length} người · ${people.map((m) => m.name).join(', ')}` : '0 người'],
            ['Trang trại', a.farmName],
          ]} />
          {error && <p role="alert" className="m-0 text-xs text-err-fg">{error}</p>}
        </div>
      )}
      <ModalFooter>
        <ModalButton onClick={onBack}><Icon name="arrow-left" size={16} /> Quay lại sửa</ModalButton>
        <ModalButton variant="primary" disabled={!a || busy} onClick={publish}><Icon name="speakerphone" size={16} /> Đăng thông báo</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
