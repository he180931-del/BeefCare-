import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Button, Foot, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { resolveCattle, type ScanResult } from '../api/scanApi'
import { Chip, chipIcon } from '../components/parts'

type Phase = { kind: 'idle' } | { kind: 'busy' } | { kind: 'unknown' } | { kind: 'found'; result: NonNullable<ScanResult> }

// SCR-22: quét thẻ tai QR. Trình duyệt mock không có camera nên nhập tay mã bò, số thẻ tai hoặc mã thẻ (MSG-FE05-07).
export default function ScanQrPage() {
  const nav = useNavigate()
  const technician = useLocation().pathname.startsWith('/kt')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const lookup = async () => {
    if (!code.trim()) return
    setPhase({ kind: 'busy' })
    const result = await resolveCattle(code)
    setPhase(result ? { kind: 'found', result } : { kind: 'unknown' })
  }
  const reset = () => { setCode(''); setPhase({ kind: 'idle' }) }

  const body: ReactNode = (
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3 leading-[normal]">
      <div className="grid h-[300px] place-items-center rounded-[18px] bg-[#1f2924]" aria-label="Khung quét">
        <div className="grid size-[180px] place-items-center rounded-2xl border-2 border-white p-3 text-center text-xs text-white">Đưa thẻ tai QR vào khung</div>
      </div>
      <p className="m-0 text-xs text-muted">Không dùng được camera. Hãy nhập mã bò hoặc số thẻ tai.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup() }}>
        <input className={`${inputCls} flex-1`} aria-label="Nhập mã thủ công" placeholder="Mã bò, số thẻ tai hoặc mã thẻ QR" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" variant="primary">Tra cứu</Button>
      </form>
      {phase.kind === 'unknown' && <p role="alert" className="m-0 rounded-md bg-err-bg p-3 text-xs text-err-fg">Mã này không phải thẻ tai của một trại bạn truy cập được.</p>}
      {phase.kind === 'found' && <Found result={phase.result} technician={technician} onOpen={(c) => nav(technician ? `/kt/dan-bo/${c}` : `/cattle/${c}`)} onReset={reset} />}
    </div>
  )

  return technician
    ? <TechnicianLayout title="Quét thẻ tai QR" back>{body}</TechnicianLayout>
    : <Layout title="Quét QR"><div className="flex flex-col gap-4">{body}<Foot>Quét thẻ chỉ mở được hồ sơ khi người quét là thành viên của trại.</Foot></div></Layout>
}

function Found({ result, onOpen, onReset }: { result: NonNullable<ScanResult>; technician: boolean; onOpen: (code: string) => void; onReset: () => void }) {
  const { cow, replacedTag } = result
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-edge bg-white p-4">
      <div className="text-[11px] font-semibold text-brand">Đã nhận diện</div>
      <div className="text-base font-semibold text-[#212121]">{cow.code}{cow.name ? ` · “${cow.name}”` : ''}</div>
      <div className="text-xs text-muted">{[cow.breed, cow.sex, cow.ageLong, cow.barn && `Chuồng ${cow.barn}`].filter(Boolean).join(' · ')}</div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="ok" icon="circle-check">{cow.status === 'ACTIVE' ? 'ACTIVE' : cow.status}</Chip>
        {cow.health && <Chip tone={cow.health.tone} icon={chipIcon(cow.health.label)}>{cow.health.label}</Chip>}
        {cow.repro && <Chip tone={cow.repro.tone} icon={chipIcon(cow.repro.label)}>{cow.repro.label}</Chip>}
      </div>
      {replacedTag && <p className="m-0 text-xs text-warn-fg">Thẻ này đã được thay. Thẻ hiện hành của {cow.code} là {cow.qr}.</p>}
      <Button variant="primary" block onClick={() => onOpen(cow.code)}>Mở hồ sơ</Button>
      <Button block onClick={onReset}><Icon name="scan" />Quét lại</Button>
    </div>
  )
}
