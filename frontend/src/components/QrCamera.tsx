import { useEffect, useRef, useState } from 'react'
import { Button, Note, inputCls } from './ui'

function cameraError(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Chưa được cấp quyền camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.'
  if (name === 'NotFoundError') return 'Không tìm thấy camera. Hãy kết nối camera rồi thử lại hoặc quét từ ảnh.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'Không mở được camera. Hãy đóng ứng dụng đang sử dụng camera rồi thử lại.'
  if (name === 'OverconstrainedError') return 'Camera đã chọn không còn khả dụng. Hãy chọn camera khác hoặc thử lại.'
  return 'Không đọc được camera. Hãy thử lại, quét từ ảnh hoặc nhập mã thủ công.'
}

export default function QrCamera({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Đang mở camera…')
  useEffect(() => { onCodeRef.current = onCode }, [onCode])

  useEffect(() => {
    const player = video.current
    let stream: MediaStream | undefined
    let timer: number | undefined
    let closed = false
    let stopped = false
    let ended: (() => void) | undefined
    const stop = () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getVideoTracks().forEach((track) => {
        if (ended) track.removeEventListener('ended', ended)
      })
      stream?.getTracks().forEach((track) => track.stop())
      if (player && player.srcObject === stream) player.srcObject = null
    }
    const fail = (message: string) => {
      stop()
      if (!closed) { setStatus(''); setError(message) }
    }
    const start = async () => {
      setError('')
      setStatus('Đang mở camera…')
      if (window.isSecureContext === false) {
        fail('Camera cần HTTPS hoặc localhost. Nếu mở từ điện thoại, hãy dùng địa chỉ HTTPS của BeefCare.')
        return
      }
      if (!player || !navigator.mediaDevices?.getUserMedia) {
        fail('Trình duyệt không hỗ trợ camera. Hãy dùng trình duyệt có hỗ trợ camera, quét từ ảnh hoặc nhập mã thủ công.')
        return
      }
      const { default: decode } = await import('jsqr')
      if (closed) return
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1280 }, height: { ideal: 720 },
        },
      })
      if (closed || stopped) return stop()
      ended = () => fail('Camera đã ngắt kết nối. Hãy kết nối lại hoặc chọn camera khác.')
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', ended!))
      player.srcObject = stream
      await player.play()
      if (closed || stopped) return stop()
      setStatus('Đưa mã QR vào khung và giữ camera ổn định.')
      void navigator.mediaDevices.enumerateDevices?.().then((available) => {
        if (!closed && !stopped) setDevices(available.filter((device) => device.kind === 'videoinput'))
      }).catch(() => { /* Scanning still works when the browser cannot list devices. */ })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas unavailable')

      const readFrame = (x: number, y: number, width: number, height: number) => {
        const scale = Math.min(1, 1280 / Math.max(width, height))
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        context.drawImage(player, x, y, width, height, 0, 0, canvas.width, canvas.height)
        const frame = context.getImageData(0, 0, canvas.width, canvas.height)
        return decode(frame.data, frame.width, frame.height)?.data
      }
      const scan = () => {
        if (closed || stopped) return
        try {
          if (player.videoWidth && player.videoHeight) {
            const { videoWidth: width, videoHeight: height } = player
            const side = Math.round(Math.min(width, height) * 0.75)
            const code = readFrame((width - side) / 2, (height - side) / 2, side, side) || readFrame(0, 0, width, height)
            if (code) {
              stop()
              setStatus('Đã đọc mã QR.')
              onCodeRef.current(code)
              return
            }
          }
          timer = window.setTimeout(scan, 180)
        } catch (failure) {
          fail(cameraError(failure))
        }
      }
      timer = window.setTimeout(scan, 180)
    }
    void start().catch((failure) => fail(cameraError(failure)))
    return () => { closed = true; stop() }
  }, [attempt, deviceId])

  return (
    <div className="flex flex-col gap-2">
      <div className={error ? 'hidden' : 'relative overflow-hidden rounded-lg bg-black'}>
        <video ref={video} muted playsInline aria-label="Camera quét mã QR" className="max-h-72 w-full" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="aspect-square h-3/4 rounded-lg border-2 border-white/80" />
        </div>
      </div>
      {status && <p role="status" className="m-0 text-xs text-muted">{status}</p>}
      {devices.length > 1 && <label className="flex flex-col gap-1 text-xs font-medium">
        Camera
        <select className={inputCls} value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
          <option value="">Tự động chọn camera sau</option>
          {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
        </select>
      </label>}
      {error && <Note tone="warn"><span role="alert">{error}</span><Button small type="button" variant="link" onClick={() => setAttempt((current) => current + 1)}>Thử lại camera</Button></Note>}
    </div>
  )
}
