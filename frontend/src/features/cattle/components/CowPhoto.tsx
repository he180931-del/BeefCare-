import { useRef, useState } from 'react'
import { Icon } from '../../../components/Icon'
import Modal from '../../../components/Modal'

export default function CowPhoto({ code, photoUrl }: { code: string; photoUrl?: string }) {
  const [open, setOpen] = useState(false)
  const [failedUrl, setFailedUrl] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  if (!photoUrl || failedUrl === photoUrl) {
    return (
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-ok-bg text-brand" aria-label={photoUrl ? 'Không tải được ảnh bò' : 'Chưa có ảnh bò'} role="img">
        <Icon name="zebu-silhouette" size={30} />
      </span>
    )
  }

  return (
    <>
      <button ref={trigger} type="button" className="size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label={`Phóng to ảnh bò ${code}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <img src={photoUrl} alt={`Ảnh bò ${code}`} className="size-full object-cover" onError={() => setFailedUrl(photoUrl)} />
      </button>
      {open && (
        <Modal title={`Ảnh bò ${code}`} width={820} onClose={close}>
          <img src={photoUrl} alt={`Ảnh bò ${code}`} className="mx-auto max-h-[70dvh] w-full object-contain" />
        </Modal>
      )}
    </>
  )
}
