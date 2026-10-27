import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Button, PageHeader, Table, Foot, Select, inputCls } from '../components/ui'
import { BARNS0, BREEDS, EXPORTED_COUNT, STAGES, groupCount, useCowStore } from '../data/cowsData'
import { Chip, Panel, Th, Td } from './cows/parts'

const TAB_STAGE = { 'Tất cả': '', 'Khác': 'Chưa xác định' }
const SEX = ['Cái', 'Đực']
const BARN_CODES = Object.keys(BARNS0)
const EXPORTED = 'Đã xuất'

const healthChip = (h) => (h ? <Chip tone={h.tone}>{h.label}</Chip> : '—')

// Dòng bảng danh sách theo Figma (cột: Bò · Giống · Giới tính · Tuổi · Chuồng · Mục đích · Cân · Sức khỏe · Sinh sản).
function CowRow({ c, barnTag, onOpen }) {
  const weight = c.weight != null ? `${c.weight} kg${c.weightEst ? '*' : ''} · ${c.weightDate}` : '—'
  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(c.code)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(c.code)}
      className="cursor-pointer hover:bg-page focus:bg-page focus:outline-none"
    >
      <Td className="font-medium">{c.code}{c.name ? ` “${c.name}”` : ''}</Td>
      <Td>{c.breed}</Td>
      <Td>{c.sex} · {c.ageShort}</Td>
      <Td>{c.barn} · {barnTag}</Td>
      <Td>{c.purpose} · {c.stage}</Td>
      <Td>{weight}</Td>
      <Td>{healthChip(c.health)}</Td>
      <Td>{healthChip(c.repro)}</Td>
    </tr>
  )
}

export default function CowList() {
  const { cows, barns } = useCowStore()
  const nav = useNavigate()
  const searchRef = useRef(null)
  const [q, setQ] = useState('')
  const [breed, setBreed] = useState('')
  const [sex, setSex] = useState('')
  const [barn, setBarn] = useState('')
  const [stageSel, setStageSel] = useState('ALL')
  const [tab, setTab] = useState('Tất cả')

  const total = STAGES.reduce((sum, s) => sum + groupCount(cows, s), 0)
  const countOf = (stage) => groupCount(cows, stage)

  const tabs = [
    ['Tất cả', `Tất cả (${total})`],
    ['Bò cái sinh sản', `Bò cái sinh sản (${countOf('Bò cái sinh sản')})`],
    ['Bò tơ', `Bò tơ (${countOf('Bò tơ')})`],
    ['Vỗ béo', `Vỗ béo (${countOf('Vỗ béo')})`],
    ['Bê', `Bê (${countOf('Bê')})`],
    ['Đực giống', `Đực giống (${countOf('Đực giống')})`],
    ['Khác', `Khác (${countOf('Chưa xác định')})`],
    [EXPORTED, `Đã xuất (${EXPORTED_COUNT})`],
  ]

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (tab === EXPORTED) return []
    const stage = TAB_STAGE[tab] ?? tab
    return cows.filter(
      (c) =>
        c.inList &&
        c.status === 'ACTIVE' &&
        (!stage || c.stage === stage) &&
        (!breed || c.breed === breed) &&
        (!sex || c.sex === sex) &&
        (!barn || c.barn === barn) &&
        (!stageSel || stageSel === 'ALL' || c.stage === stageSel) &&
        (!kw || [c.code, c.tag, c.name].some((v) => v && v.toLowerCase().includes(kw))),
    )
  }, [cows, q, breed, sex, barn, stageSel, tab])

  const barnTagOf = (c) => c.barnTag || barns[c.barn]?.tag || ''

  return (
    <Layout title="Đàn bò – Danh sách" user="manager">
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader title="Đàn bò" sub={`${total} con đang nuôi · ${EXPORTED_COUNT} con đã xuất đàn`}>
          <Button className="leading-[normal]" onClick={() => searchRef.current?.focus()}>▣ Quét QR</Button>
          <Button variant="primary" className="leading-[normal]" onClick={() => nav('/nhap/moi')}>+ Nhập đàn</Button>
        </PageHeader>

        <div className="flex flex-wrap gap-2.5">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mã hiển thị, số tai, tên gọi…"
            className={`${inputCls} w-full !leading-[normal] sm:w-[300px]`}
          />
          <Select className="w-[calc(50%-5px)] sm:w-[170px] [&_select]:!leading-[normal]" value={breed} onChange={(e) => setBreed(e.target.value)}>
            <option value="">Giống: Tất cả</option>
            {BREEDS.map((b) => <option key={b} value={b}>Giống: {b}</option>)}
          </Select>
          <Select className="w-[calc(50%-5px)] sm:w-[170px] [&_select]:!leading-[normal]" value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">Giới tính: Tất cả</option>
            {SEX.map((s) => <option key={s} value={s}>Giới tính: {s}</option>)}
          </Select>
          <Select className="w-[calc(50%-5px)] sm:w-[170px] [&_select]:!leading-[normal]" value={barn} onChange={(e) => setBarn(e.target.value)}>
            <option value="">Chuồng: Tất cả</option>
            {BARN_CODES.map((b) => <option key={b} value={b}>Chuồng: {b}</option>)}
          </Select>
          <Select className="w-[calc(50%-5px)] sm:w-[170px] [&_select]:!leading-[normal]" value={stageSel} onChange={(e) => setStageSel(e.target.value)}>
            <option value="ALL">Giai đoạn: Tất cả</option>
            {STAGES.map((s) => <option key={s} value={s}>Giai đoạn: {s}</option>)}
          </Select>
        </div>

        <div className="flex max-w-full flex-wrap gap-[3px] self-start rounded-[5px] bg-chip p-[3px]">
          {tabs.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTab(v)}
              className={`cursor-pointer rounded border px-3.5 py-[7px] text-xs leading-[normal] ${
                v === tab ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Panel pad="p-2" gap="gap-0">
          <Table wide>
            <thead>
              <tr className="bg-chip">
                <Th className="w-[170px]">Bò</Th>
                <Th className="w-[100px]">Giống</Th>
                <Th className="w-[110px]">Giới tính · Tuổi</Th>
                <Th className="w-[120px]">Chuồng</Th>
                <Th className="w-[190px]">Mục đích · Giai đoạn</Th>
                <Th className="w-[110px]">Cân gần nhất</Th>
                <Th className="w-[100px]">Sức khỏe</Th>
                <Th className="w-[100px]">Sinh sản</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <CowRow key={c.code} c={c} barnTag={barnTagOf(c)} onOpen={(code) => nav(`/dan-bo/${code}`)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <Td colSpan={8} className="!py-6 text-center !text-[12px] text-muted">
                    Không có bò nào khớp bộ lọc
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
            <span className="text-[11px] text-muted">Hiển thị {rows.length ? `1–${rows.length}` : 0} trong {tab === EXPORTED ? EXPORTED_COUNT : total} · * cân ước tính</span>
            <span className="whitespace-pre text-[12px] font-semibold text-[#0b563c]">{'‹  1  2  3  …  36  ›'}</span>
          </div>
        </Panel>

        <Foot>
          Bấm một dòng để mở hồ sơ bò. Các tab nhóm đàn cộng lại bằng tổng bò đang nuôi; tab Khác luôn hiện kể cả khi bằng 0.
        </Foot>
      </div>
    </Layout>
  )
}
