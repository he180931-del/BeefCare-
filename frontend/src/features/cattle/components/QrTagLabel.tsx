import { useMemo, useState } from 'react'
import { Button, Icon, Note } from '../../../shared/ui'
import { QR_BORDER, tagQrModules } from '../domain/tagQr'

function labelPng(cowCode: string, modules: boolean[][]): string {
  const cell = 12
  const captionHeight = 46
  const size = (modules.length + QR_BORDER * 2) * cell
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = captionHeight + size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không thể tạo ảnh tem.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.font = 'bold 27px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(cowCode, size / 2, 35, size - 24)
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) ctx.fillRect((x + QR_BORDER) * cell, (y + QR_BORDER) * cell + captionHeight, cell, cell)
  }))
  return canvas.toDataURL('image/png')
}

export default function QrTagLabel({ cowCode, tagCode, trial = false, canExport }: {
  cowCode: string; tagCode: string; trial?: boolean; canExport: boolean
}) {
  const [error, setError] = useState('')
  const modules = useMemo(() => {
    try { return tagQrModules(tagCode) } catch { return null }
  }, [tagCode])
  if (!modules) return <Note tone="warn">Không thể tạo QR cho mã thẻ này.</Note>
  const size = modules.length + QR_BORDER * 2
  const path = modules.map((row, y) => row.map((dark, x) =>
    dark ? `M${x + QR_BORDER} ${y + QR_BORDER}h1v1h-1z` : '',
  ).join('')).join('')

  const print = () => {
    setError('')
    const popup = window.open('', '_blank', 'popup,width=500,height=620')
    if (!popup) return setError('Trình duyệt chặn cửa sổ in. Hãy tải ảnh tem để in.')
    popup.opener = null
    try {
      const image = popup.document.createElement('img')
      popup.document.title = `Thẻ QR – ${cowCode}`
      image.alt = `Tem QR của ${cowCode}`
      image.style.maxWidth = '100%'
      image.onload = () => {
        popup.focus()
        popup.print()
      }
      popup.document.body.append(image)
      image.src = labelPng(cowCode, modules)
    } catch {
      popup.close()
      setError('Không mở được bản in. Vui lòng thử tải ảnh tem.')
    }
  }

  const download = () => {
    setError('')
    try {
      const link = document.createElement('a')
      link.href = labelPng(cowCode, modules)
      link.download = `${cowCode}-QR${trial ? '-thu' : ''}.png`
      link.click()
    } catch {
      setError('Không tải được ảnh tem. Vui lòng thử lại.')
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <figure className="m-0 inline-flex flex-col items-center rounded-md border border-edge bg-white px-2 pb-1 pt-2 text-black">
        <figcaption className="text-sm font-bold">{cowCode}</figcaption>
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Mã QR thẻ ${tagCode}`} className="size-40" shapeRendering="crispEdges">
          <rect width={size} height={size} fill="white" />
          <path d={path} fill="black" />
        </svg>
      </figure>
      {trial && <p className="m-0 text-xs text-muted">Tem thử. Mã chỉ mở hồ sơ sau khi được cấp cho bò.</p>}
      {canExport && (
        <div className="flex flex-wrap gap-2">
          <Button small onClick={download}><Icon name="download" />Tải ảnh QR</Button>
          <Button small onClick={print}><Icon name="printer" />{trial ? 'In thẻ thử' : 'In thẻ'}</Button>
        </div>
      )}
      {error && <Note tone="warn">{error}</Note>}
    </div>
  )
}
