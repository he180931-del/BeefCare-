import { useEffect, useRef, useState } from 'react'
import type { BrowserQRCodeReader, IScannerControls } from '@zxing/browser'
import { useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition } from '../../../app/screenManifest'
import { Badge, Button, inputCls, PageHeader } from '../../../components/ui'
import { EmptyState, FixtureNotice, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import { identifiedCattle, technicianAnnouncements, technicianReminders } from '../data/technicianFixtures'
import { loadRations, markRationCompleted } from '../data/rationStore'
import { initialCows, type CowSeed } from '../../../data/cowsData'

const DEMO_KEY = 'beefcare-ui-demo'
const readCattle = (): CowSeed[] => {
  try {
    const root = JSON.parse(window.localStorage.getItem(DEMO_KEY) || '{}') as { account?: { 'cattle-preview'?: CowSeed[] } }
    const rows = root.account?.['cattle-preview']
    return Array.isArray(rows) && rows.length ? rows : initialCows
  } catch {
    return initialCows
  }
}

const normalizeScan = (value: string) => value.trim().replace(/^.*(?:code|cattle|cow|qr)[/:=]/i, '').replace(/[?#].*$/, '')
const findCattle = (value: string) => {
  const query = normalizeScan(value).toLowerCase()
  return readCattle().find((cow) => [cow.code, cow.tag, cow.qr].filter(Boolean).some((candidate) => String(candidate).toLowerCase() === query))
}

function Home({ screen }: { screen: ScreenDefinition }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const openCattle = () => {
    const found = findCattle(query)
    if (!found) return setError('Không tìm thấy bò theo mã đã nhập. Kiểm tra lại mã bò hoặc số thẻ tai.')
    setError('')
    navigate(`/ui/scr-27?code=${encodeURIComponent(found.code)}`)
  }
  return <div className="flex flex-col gap-5"><PageHeader title={screen.viTitle} sub="Trại bò Ba Vì · Thứ Ba, 03/11/2026" badge={<FixtureNotice />}><Button variant="primary" onClick={() => navigate('/ui/scr-32')}>Quét mã QR</Button></PageHeader><div className="border-y border-rule py-4"><p className="m-0 text-sm text-subtle">Chào An,</p><strong className="mt-1 block text-xl text-ink">Hôm nay có 3 việc cần theo dõi</strong><p className="mb-0 mt-1 text-xs text-subtle">Mọi thông tin trên trang chủ kỹ thuật viên chỉ để xem.</p></div><form role="search" onSubmit={(event) => { event.preventDefault(); openCattle() }} className="flex gap-2"><input type="search" aria-label="Tìm bò theo mã hoặc thẻ tai" className={`${inputCls} min-w-0 flex-1`} placeholder="Mã bò hoặc thẻ tai" value={query} onChange={(event) => { setQuery(event.target.value); setError('') }} /><Button type="submit">Mở hồ sơ bò</Button></form>{error && <InlineMessage tone="warn" title="Chưa tìm thấy hồ sơ">{error}</InlineMessage>}<WorkSection title="Thông báo mới" description="Tối đa 3 thông báo chưa đọc gần nhất." actions={<Button variant="link" small onClick={() => navigate('/ui/scr-38')}>Xem thông báo</Button>}><div className="divide-y divide-rule border-y border-rule">{technicianAnnouncements.map((item) => <article key={item.title} className="py-3"><h3 className="m-0 text-sm font-semibold text-ink">{item.title}</h3><p className="mb-0 mt-1 text-xs text-subtle">{item.author} · {item.time}</p></article>)}</div></WorkSection><WorkSection title="Nhắc việc hôm nay" description="Chạm một mục để mở chi tiết nhắc việc."><ol className="m-0 divide-y divide-rule border-y border-rule p-0">{technicianReminders.map((task) => <li key={task.id} className="flex items-center gap-3 py-3"><time className="w-12 shrink-0 text-sm font-bold text-brand">{task.due}</time><div className="min-w-0 flex-1"><strong className="block text-sm text-ink">{task.title}</strong><span className="mt-1 block text-xs text-subtle">{task.subject}</span></div><Badge tone={task.status === 'Quá hạn' ? 'err' : 'warn'}>{task.status}</Badge></li>)}</ol><Button small onClick={() => navigate('/ui/scr-73')}>Mở tất cả nhắc việc</Button></WorkSection><a href="/ui/scr-122" className="flex items-center justify-between border-y border-rule py-4 text-sm text-ink no-underline"><span><strong className="block">Khẩu phần hôm nay</strong><small className="mt-1 block text-subtle">2 phiên chưa ghi nhận</small></span><span className="font-semibold text-brand">Mở khẩu phần</span></a></div>
}

function Scanner({ screen }: { screen: ScreenDefinition }) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [camera, setCamera] = useState<'idle' | 'starting' | 'active' | 'error'>('idle')
  const [cameraError, setCameraError] = useState('')
  const [manual, setManual] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [cattle, setCattle] = useState<CowSeed | undefined>()

  const stopCamera = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    readerRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamera('idle')
  }
  useEffect(() => () => { controlsRef.current?.stop(); controlsRef.current = null; readerRef.current = null }, [])
  const resolve = (value: string) => {
    const found = findCattle(value)
    if (!found) { setCattle(undefined); setLookupError('Không tìm thấy bò đang hoạt động trong đàn. Kiểm tra lại mã bò, thẻ tai hoặc QR.'); return }
    if (found.status !== 'ACTIVE') { setCattle(undefined); setLookupError(`Bò ${found.code} không còn ở trạng thái đang nuôi.`); return }
    setCattle(found); setLookupError(''); setManual(found.qr || found.tag || found.code); stopCamera()
  }
  const startCamera = async () => {
    if (!videoRef.current) return
    setCamera('starting'); setCameraError(''); setLookupError('')
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      readerRef.current = reader
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => { if (result) resolve(result.getText()) })
      setCamera('active')
    } catch (cause) {
      controlsRef.current?.stop(); readerRef.current = null; controlsRef.current = null
      setCamera('error'); setCameraError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền camera. Cho phép camera trong cài đặt trình duyệt hoặc nhập mã thủ công.' : 'Không thể mở camera trên thiết bị này. Bạn có thể nhập mã thủ công.')
    }
  }
  const openProfile = () => { if (cattle) navigate(`/ui/scr-27?code=${encodeURIComponent(cattle.code)}`) }
  return <div className="flex flex-col gap-5"><PageHeader title={screen.viTitle} sub="Đưa mã QR thẻ tai vào khung hoặc nhập mã thủ công." badge={<FixtureNotice />}><Button onClick={camera === 'active' || camera === 'starting' ? stopCamera : startCamera}>{camera === 'active' || camera === 'starting' ? 'Dừng camera' : 'Bật camera'}</Button></PageHeader><div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start"><section aria-label="Khung quét mã QR" className="relative min-h-64 overflow-hidden bg-[#173a2d] text-white"><video ref={videoRef} className="h-full min-h-64 w-full object-cover" muted playsInline aria-label="Luồng camera quét QR" /><div className="pointer-events-none absolute inset-[18%] border-2 border-white/90" />{camera !== 'active' && <div className="absolute inset-0 grid place-items-center bg-[#173a2d]/90 px-5 text-center"><div className="max-w-sm text-sm leading-6">{camera === 'starting' ? 'Đang mở camera…' : 'Bật camera để quét QR thẻ tai.'}<br /><span className="text-white/75">Hoặc nhập mã thủ công ở bên cạnh.</span></div></div>}</section><div className="flex min-w-0 flex-col gap-4"><form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); resolve(manual) }}><label className="text-sm font-semibold text-ink" htmlFor="technician-manual-code">Mã bò, thẻ tai hoặc QR</label><div className="flex gap-2"><input id="technician-manual-code" aria-label="Nhập mã bò, thẻ tai hoặc mã QR" className={`${inputCls} min-w-0 flex-1`} placeholder="BC-000203, VN-0412 hoặc QR" value={manual} onChange={(event) => { setManual(event.target.value); setLookupError('') }} /><Button variant="primary" type="submit">Nhận diện</Button></div></form>{cameraError && <InlineMessage tone="err" title="Camera không khả dụng">{cameraError}</InlineMessage>}{lookupError && <InlineMessage tone="warn" title="Chưa nhận diện được">{lookupError}</InlineMessage>}<InlineMessage tone="info">Camera chỉ đọc mã QR; kết quả được đối chiếu với danh sách bò của trang trại hiện tại.</InlineMessage></div></div>{cattle && <WorkSection title={`Đã nhận diện bò ${cattle.code}`} description="Kết quả thuộc trang trại hiện tại; kiểm tra lại trước khi mở hồ sơ."><dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-3">{[['Thẻ tai',cattle.tag || '—'],['Giống',cattle.breed || '—'],['Giới tính',cattle.sex || '—'],['Tuổi',cattle.ageLong || cattle.ageShort || '—'],['Chuồng',cattle.barn || '—'],['Trạng thái đàn',cattle.status === 'ACTIVE' ? 'Đang nuôi' : cattle.status === 'EXIT_PENDING' ? 'Chờ xuất đàn' : cattle.status === 'EXITED' ? 'Đã xuất đàn' : 'Đã hủy'],['Sức khỏe',cattle.health?.label || '—'],['Sinh sản',cattle.repro?.label || '—']].map(([label,value]) => <div key={label}><dt className="text-xs text-subtle">{label}</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{value}</dd></div>)}</dl><div className="mt-5 flex flex-wrap justify-end gap-2"><Button onClick={() => { setCattle(undefined); setManual(''); setLookupError('') }}>Quét lại</Button><Button variant="primary" onClick={openProfile}>Mở hồ sơ bò</Button></div></WorkSection>}</div>
}

function Rations({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const [rows, setRows] = useState(loadRations)
  const [notice, setNotice] = useState('')
  const complete = (pen: string) => {
    const next = markRationCompleted(pen)
    setRows(next)
    setNotice(`Đã ghi nhận khẩu phần cho ${pen}.`)
  }
  return <div className="flex flex-col gap-5"><PageHeader title={screen.viTitle} sub="Theo dõi lượng thức ăn cần cấp cho từng chuồng trong ngày." badge={readOnly ? <span className="text-xs font-semibold text-subtle">Chỉ xem</span> : <FixtureNotice />} />{notice && <InlineMessage tone="ok">{notice}</InlineMessage>}<WorkSection title="Theo chuồng" description="Ghi nhận ngay tại chuồng để tránh nhập nhầm khẩu phần."><div className="divide-y divide-rule border-y border-rule">{rows.map((row) => <article key={row.pen} className="py-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="m-0 text-sm font-bold text-ink">{row.pen}</h3><p className="mb-0 mt-1 text-xs text-subtle">{row.count} · {row.ration}</p></div><strong className="text-sm text-brand">{row.amount}</strong></div><div className="mt-3 flex items-center gap-3"><span className="min-w-0 flex-1 text-xs font-semibold text-subtle">{row.status}</span>{!readOnly && row.status !== 'Đã hoàn tất' && <Button small variant="primary" onClick={() => complete(row.pen)}>Ghi nhận đã cho ăn</Button>}</div></article>)}</div></WorkSection></div>
}

export function TechnicianScreen({ screen, state }: { screen: ScreenDefinition; state: ReviewState }) {
  const navigate = useNavigate()
  let content
  if (state === 'loading') content = <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} rows={5} />
  else if (state === 'error') content = <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Kiểm tra kết nối rồi thử lại. Không có thao tác nào được ghi.</InlineMessage>
  else if (state === 'empty') {
    if (screen.id === 'SCR-104') content = <EmptyState title="Hôm nay chưa có thông báo hoặc nhắc việc" description="Bạn vẫn có thể quét mã QR hoặc tìm bò theo mã thẻ tai." actionLabel="Quét mã QR" onAction={() => navigate('/ui/scr-32')} />
    else if (screen.id === 'SCR-32') content = <EmptyState title="Chưa nhận diện mã QR" description="Đưa mã vào khung quét hoặc nhập mã bò, thẻ tai hay mã QR thủ công." actionLabel="Nhập mã thủ công" onAction={() => requestAnimationFrame(() => document.getElementById('technician-manual-code')?.focus())} />
    else content = <EmptyState title="Chưa có khẩu phần trong ngày" description="Quản lý cần lập khẩu phần trước khi kỹ thuật viên có thể ghi nhận." />
  }
  else if (screen.id === 'SCR-32') content = <Scanner screen={screen} />
  else if (screen.id === 'SCR-104') content = <Home screen={screen} />
  else if (screen.id === 'SCR-122' || screen.feature === 'feed') content = <Rations screen={screen} readOnly={state === 'read-only'} />
  else content = <div className="flex flex-col gap-5"><PageHeader title={screen.viTitle} sub="Nội dung kỹ thuật viên chỉ hiển thị trong phạm vi được phân công." badge={<FixtureNotice />} /><InlineMessage tone="info">Mở hồ sơ bò hoặc nhắc việc nguồn để xem thông tin chi tiết.</InlineMessage></div>
  return <div className="technician-ui min-w-0">{content}</div>
}
