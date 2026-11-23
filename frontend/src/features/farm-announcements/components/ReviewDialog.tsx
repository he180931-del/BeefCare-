import { useState } from 'react'
import { ErrorBlock, Icon, Info, LoadingBlock, Modal, ModalButton, ModalFooter, Panel } from '../../../shared/ui'
import { MESSAGES } from '../domain/announcementRules'
import { useAnnouncementUseCases } from '../hooks/useAnnouncementUseCases'
import { ROLE_LABEL } from '../domain/format'
import type { PublishResult, Viewer } from '../types'
import { messageOf, RichText } from './shared'

export default function ReviewDialog({ viewer, draftId, onBack, onPublished }: {
  viewer: Viewer
  draftId: number
  onBack: () => void
  onPublished: (result: PublishResult) => void
}) {
  const { preview, publish: publishAnnouncement } = useAnnouncementUseCases({ viewer, previewId: draftId })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const publish = async () => {
    if (!preview.data) return
    setBusy(true)
    setError('')
    try { onPublished(await publishAnnouncement(draftId, preview.data.announcement.version)) } catch (e) { setError(messageOf(e, 'Không đăng được thông báo. Vui lòng thử lại.')) } finally { setBusy(false) }
  }

  const a = preview.data?.announcement
  const people = preview.data?.recipients ?? []
  return (
    <Modal title="Xem lại trước khi đăng" sub="Kiểm tra nội dung và người nhận; sau khi đăng, chỉ sửa được bằng đính chính." width={620} dialogClassName="@container" onClose={onBack}>
      {preview.loading && !a && <LoadingBlock variant="panel" />}
      {preview.error != null && <ErrorBlock variant="panel" message={messageOf(preview.error, 'Không tải được bản xem lại.')} onRetry={preview.refetch} />}
      {a && (
        <div className="flex flex-col gap-4">
          <Panel title={a.title} headingAs="h3" className="gap-2! border-transparent bg-page! wrap-anywhere">
            <RichText text={a.body} className="text-[13px]" />
          </Panel>
          <div className="[&>dl]:grid-cols-1 [&_dd]:wrap-anywhere [&_dt]:text-label @min-[480px]:[&>dl]:grid-cols-2">
            <Info cols={2} items={[
              ['Tác giả', `${a.authorName} · ${ROLE_LABEL[a.authorRole]}`],
              ['Đối tượng', a.audienceLabel],
              ['Người nhận', people.length ? `${people.length} người · ${people.map((m) => m.name).join(', ')}` : '0 người'],
              ['Trang trại', a.farmName],
            ]} />
          </div>
          {people.length === 0 && <p role="alert" className="m-0 text-xs text-err-fg">{MESSAGES.noRecipient}</p>}
          {error && <p role="alert" className="m-0 text-xs text-err-fg">{error}</p>}
        </div>
      )}
      <ModalFooter className="px-0! pb-0! pt-0! [&>button]:w-full @min-[480px]:[&>button]:w-auto">
        <ModalButton onClick={onBack}><Icon name="arrow-left" size={16} /> Quay lại sửa</ModalButton>
        <ModalButton variant="primary" disabled={!a || people.length === 0 || busy} onClick={publish}><Icon name="speakerphone" size={16} /> Đăng thông báo</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
