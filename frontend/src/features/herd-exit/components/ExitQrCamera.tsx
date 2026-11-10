import { useEffect, useRef, useState } from 'react'
import { Note } from '../../../components/ui'

export default function ExitQrCamera({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  const [error, setError] = useState('')
  useEffect(() => { onCodeRef.current = onCode }, [onCode])

  useEffect(() => {
    const player = video.current
    let stream: MediaStream | undefined
    let timer: number | undefined
    let closed = false
    const stop = () => {
      window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
      if (player) player.srcObject = null
    }
    const start = async () => {
      if (!player || !navigator.mediaDevices?.getUserMedia) {
        setError('Camera không khả dụng. Bạn có thể nhập mã thẻ QR bên dưới.')
        return
      }
      const { default: decode } = await import('jsqr')
      if (closed) return
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      if (closed) return stop()
      player.srcObject = stream
      await player.play()
      if (closed) return
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas unavailable')
      timer = window.setInterval(() => {
        if (!player.videoWidth || !player.videoHeight) return
        canvas.width = Math.min(player.videoWidth, 800)
        canvas.height = Math.round(player.videoHeight * canvas.width / player.videoWidth)
        context.drawImage(player, 0, 0, canvas.width, canvas.height)
        const frame = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = decode(frame.data, frame.width, frame.height)?.data
        if (code) {
          stop()
          onCodeRef.current(code)
        }
      }, 180)
    }
    void start().catch(() => {
      stop()
      if (!closed) setError('Không mở được camera. Hãy kiểm tra quyền camera hoặc nhập mã thẻ QR.')
    })
    return () => { closed = true; stop() }
  }, [])

  return error ? <Note tone="warn">{error}</Note> :
    <video ref={video} muted playsInline aria-label="Camera quét mã QR" className="max-h-56 w-full rounded-lg bg-black" />
}
