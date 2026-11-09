import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Button, Foot, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { scanCode, type ScanOutcome } from '../api/scanApi'
import { Chip, chipIcon } from '../components/parts'

type Phase = { kind: 'idle' } | { kind: 'busy' } | ScanOutcome

const REJECTED: Record<string, string> = {
  'MSG-FE05-09': 'Mã này không phải thẻ bò của trại bạn được truy cập.',
  'MSG-FE05-10': 'Thẻ này thuộc một con bê đang chờ đăng ký. Có thể đăng ký bằng phiếu nhập bê sinh tại trại.',
}

// SCR-22: quét thẻ tai QR. Trình duyệt chưa đọc được camera nên luôn có ô nhập mã thủ công (MSG-FE05-07, UC-05 AF1).
export default function ScanQrPage() {
  const nav = useNavigate()
  const technician = useLocation().pathname.startsWith('/kt')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const lookup = async () => {
    if (!code.trim()) return
    setPhase({ kind: 'busy' })
    setPhase((await scanCode(code)) ?? { kind: 'idle' })
  }
  const reset = () => { setCode(''); setPhase({ kind: 'idle' }) }

  const body: ReactNode = (
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3 leading-[normal]">
      <div className="grid h-[300px] place-items-center rounded-[18px] bg-[#1f2924]" aria-label="Khung quét">
        <div className="grid size-[180px] place-items-center rounded-2xl border-2 border-white p-3 text-center text-xs text-white">Đưa thẻ tai QR vào khung</div>
      </div>
      <p className="m-0 text-xs text-muted">Không dùng được camera. Hãy nhập mã bò hoặc số tai.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup() }}>
        <input className={`${inputCls} flex-1`} aria-label="Nhập mã thủ công" placeholder="Mã bò, số thẻ tai hoặc mã thẻ QR" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" variant="primary">Tra cứu</Button>
      </form>
      {phase.kind === 'busy' && <p className="m-0 text-xs text-muted">Đang tra cứu…</p>}
      {phase.kind === 'rejected' && <p role="alert" className="m-0 rounded-md bg-err-bg p-3 text-xs text-err-fg">{REJECTED[phase.code]}</p>}
      {phase.kind === 'otherFarm' && (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-warn-bg p-3 text-xs text-warn-fg">
          <span>Bò này thuộc một trại khác mà bạn là thành viên{phase.farmId != null ? ` (trại #${phase.farmId})` : ''}. Hãy chuyển sang trại đó rồi quét lại để mở hồ sơ.</span>
          <Button small onClick={reset}>Hủy</Button>
        </div>
      )}
      {phase.kind === 'found' && <Found outcome={phase} onOpen={(c) => nav(technician ? `/kt/dan-bo/${c}` : `/cattle/${c}`)} onReset={reset} />}
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
        {active ? <Chip tone="ok" icon="circle-check">ACTIVE</Chip> : <Chip tone={cow.status === 'VOIDED' ? 'err' : 'grey'}>{cow.status === 'VOIDED' ? 'Nhập nhầm – đã hủy' : cow.exitStatusLabel ?? cow.status}</Chip>}
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
