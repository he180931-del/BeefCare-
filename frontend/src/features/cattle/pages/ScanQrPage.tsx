import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Button, Foot, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import QrCamera from '../../../components/QrCamera'
import { userFacingError } from '../../../api/userFacingError'
import { enterFarm } from '../../farm-workspace/components/enterFarm'
import { scanCode, type ScanOutcome } from '../api/scanApi'
import { Chip, chipIcon } from '../components/parts'
import { scanImage } from '../domain/scanImage'

type Phase = { kind: 'idle' } | { kind: 'busy' } | ScanOutcome

const REJECTED: Record<string, string> = {
  'MSG-FE05-09': 'Mã này không phải thẻ bò của trại bạn được truy cập.',
  'MSG-FE05-10': 'Thẻ này thuộc một con bê đang chờ đăng ký. Có thể đăng ký bằng phiếu nhập bê sinh tại trại.',
}

const cattlePath = (code: string, technician: boolean) => `${technician ? '/kt/dan-bo' : '/cattle'}/${encodeURIComponent(code)}`

export default function ScanQrPage() {
  const nav = useNavigate()
  const technician = useLocation().pathname.startsWith('/kt')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [camera, setCamera] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const [params, setParams] = useSearchParams()
  const resumeCode = useRef(params.get('code'))

  const lookup = useCallback(async (read: () => string | null | Promise<string | null>, resume = false) => {
    if (busy.current) return
    busy.current = true
    setCamera(false)
    setError('')
    setPhase({ kind: 'busy' })
    try {
      const value = (await read())?.trim()
      if (!value) {
        setPhase({ kind: 'idle' })
        setError('Không tìm thấy mã QR trong ảnh. Vui lòng chọn ảnh rõ hơn.')
        return
      }
      setCode(value)
      const result = await scanCode(value)
      setPhase(result ?? { kind: 'idle' })
      if (resume && result?.kind === 'found' && !result.replaced) {
        nav(cattlePath(result.cow.code, technician), { replace: true })
      }
    } catch (failure) {
      setPhase({ kind: 'idle' })
      setError(userFacingError(failure, 'Không tra được mã bò. Vui lòng thử lại.'))
    } finally {
      busy.current = false
    }
  }, [nav, technician])

  useEffect(() => {
    const value = resumeCode.current
    if (!value) return
    resumeCode.current = null
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('code')
      return next
    }, { replace: true })
    void lookup(() => value, true)
  }, [lookup, setParams])

  const switchFarm = async () => {
    if (phase.kind !== 'otherFarm' || phase.farmId == null || switching) return
    setSwitching(true)
    setError('')
    try {
      const failure = await enterFarm(phase.farmId, (role) => {
        const target = role === 'TECHNICIAN' ? '/kt/quet-qr' : '/quet-qr'
        return `${target}?${new URLSearchParams({ code })}`
      })
      if (failure) setError(failure)
    } catch (failure) {
      setError(userFacingError(failure, 'Không chuyển được trại. Vui lòng thử lại.'))
    } finally {
      setSwitching(false)
    }
  }
  const reset = () => { setCode(''); setPhase({ kind: 'idle' }); setError('') }
  const loading = phase.kind === 'busy' || switching

  const body = (
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3 leading-[normal]">
      {camera && <QrCamera onCode={(value) => void lookup(() => value)} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loading} onClick={() => { setError(''); setCamera(!camera) }}><Icon name="scan" />{camera ? 'Tắt camera' : 'Bật camera'}</Button>
        <Button type="button" disabled={loading} onClick={() => fileInput.current?.click()}><Icon name="upload" />Quét từ ảnh</Button>
        <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label="Chọn ảnh chứa mã QR" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void lookup(() => scanImage(file))
        }} />
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void lookup(() => code) }}>
        <input className={`${inputCls} min-w-0 flex-1`} aria-label="Nhập mã thủ công" placeholder="Mã bò, số tai hoặc mã thẻ QR" maxLength={500} disabled={loading} value={code} onChange={(e) => {
          setCode(e.target.value)
          setPhase({ kind: 'idle' })
          setError('')
        }} />
        <Button type="submit" variant="primary" disabled={loading || !code.trim()}>Tra cứu</Button>
      </form>
      {phase.kind === 'busy' && <p className="m-0 text-xs text-muted">Đang tra cứu…</p>}
      {error && <p role="alert" className="m-0 rounded-md bg-err-bg p-3 text-xs text-err-fg">{error}</p>}
      {phase.kind === 'rejected' && <p role="alert" className="m-0 rounded-md bg-err-bg p-3 text-xs text-err-fg">{REJECTED[phase.code]}</p>}
      {phase.kind === 'otherFarm' && (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-warn-bg p-3 text-xs text-warn-fg">
          <span>Bò này thuộc một trại khác mà bạn là thành viên{phase.farmId != null ? ` (trại #${phase.farmId})` : ''}.</span>
          <div className="flex gap-2">
            {phase.farmId != null && <Button small variant="primary" disabled={switching} onClick={() => void switchFarm()}>Chuyển trại và mở hồ sơ</Button>}
            <Button small disabled={switching} onClick={reset}>Hủy</Button>
          </div>
        </div>
      )}
      {phase.kind === 'found' && <Found outcome={phase} onOpen={(c) => nav(cattlePath(c, technician))} onReset={reset} />}
    </div>
  )

  return technician
    ? <TechnicianLayout title="Quét thẻ tai QR" back>{body}</TechnicianLayout>
    : <Layout title="Quét QR"><div className="flex flex-col gap-4">{body}<Foot>Quét thẻ chỉ mở được hồ sơ khi người quét là thành viên của trại.</Foot></div></Layout>
}

function Found({ outcome, onOpen, onReset }: { outcome: Extract<ScanOutcome, { kind: 'found' }>; onOpen: (code: string) => void; onReset: () => void }) {
  const { cow, replaced } = outcome
  const active = cow.status === 'ACTIVE'
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-edge bg-white p-4">
      <div className="text-[11px] font-semibold text-brand">Đã nhận diện</div>
      <div className="text-base font-semibold text-[#212121]">{cow.code}{cow.name ? ` · “${cow.name}”` : ''}</div>
      <div className="text-xs text-muted">{[cow.tag ? `Số tai ${cow.tag}` : 'Gắn tai sau', cow.breed, cow.sex, cow.ageLong, cow.barn && `Chuồng ${cow.barn}`].filter(Boolean).join(' · ')}</div>
      <div className="flex flex-wrap gap-1.5">
        {active ? <Chip tone="ok" icon="circle-check">Đang hoạt động</Chip> : <Chip tone={cow.status === 'VOIDED' ? 'err' : 'grey'}>{cow.status === 'VOIDED' ? 'Nhập nhầm – đã hủy' : cow.exitStatusLabel ?? (cow.status === 'EXIT_PENDING' ? 'Chờ xuất đàn' : 'Đã xuất đàn')}</Chip>}
        {active && cow.health && <Chip tone={cow.health.tone} icon={chipIcon(cow.health.label)}>{cow.health.label}</Chip>}
        {active && cow.repro && <Chip tone={cow.repro.tone} icon={chipIcon(cow.repro.label)}>{cow.repro.label}</Chip>}
      </div>
      {replaced && (
        <p className="m-0 text-xs text-warn-fg">
          {`Thẻ này đã được thay${replaced.date ? ` ngày ${replaced.date}` : ''}.${replaced.currentTag ? ` Thẻ hiện tại của ${cow.code} là ${replaced.currentTag}.` : ''}`}
        </p>
      )}
      {cow.status === 'EXITED' && <p className="m-0 text-xs text-muted">Bò đã xuất đàn: hồ sơ chỉ xem, không thêm được sự kiện.</p>}
      <Button variant="primary" block onClick={() => onOpen(cow.code)}>Mở hồ sơ</Button>
      <Button block onClick={onReset}><Icon name="scan" />Quét lại</Button>
    </div>
  )
}
