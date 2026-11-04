import { useMemo, useState, type FormEvent } from 'react'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition } from '../../../app/screenManifest'
import { Button, Field, inputCls, Textarea } from '../../../components/ui'
import { FixtureNotice, InlineMessage, LoadingState, StickyActions } from '../../../components/workspace'
import { ConditionalField } from '../components/ConditionalField'
import { FormOverlay } from '../components/FormOverlay'

interface FieldDef { label: string; type?: 'text' | 'date' | 'number' | 'select' | 'textarea'; required?: boolean; options?: string[]; hint?: string }
const common: FieldDef[] = [{ label: 'Ngày ghi nhận', type: 'date', required: true }, { label: 'Người thực hiện', required: true }, { label: 'Ghi chú', type: 'textarea' }]
const byFeature: Record<string, FieldDef[]> = {
  vaccination: [{ label: 'Tên vaccine', required: true }, { label: 'Ngày tiêm', type: 'date', required: true }, { label: 'Số lô vaccine' }, { label: 'Liều lượng' }, { label: 'Người thực hiện', required: true }],
  health: [{ label: 'Ngày phát hiện', type: 'date', required: true }, { label: 'Triệu chứng chính', required: true }, { label: 'Chẩn đoán ban đầu' }, { label: 'Mức độ', type: 'select', options: ['Nhẹ', 'Trung bình', 'Nặng'] }, { label: 'Ghi chú', type: 'textarea' }],
  reproduction: [{ label: 'Ngày ghi nhận', type: 'date', required: true }, { label: 'Phương pháp / kết quả', type: 'select', options: ['Theo dõi', 'Phối trực tiếp', 'Thụ tinh nhân tạo', 'Có thai', 'Không có thai'] }, { label: 'Người thực hiện', required: true }, { label: 'Ghi chú', type: 'textarea' }],
  feed: [{ label: 'Ngày thực hiện', type: 'date', required: true }, { label: 'Loại thức ăn', required: true }, { label: 'Khối lượng (kg)', type: 'number', required: true }, { label: 'Chuồng áp dụng', type: 'select', options: ['A1 · Bò cái sinh sản', 'B1 · Vỗ béo', 'C2 · Bê cai sữa'] }, { label: 'Ghi chú', type: 'textarea' }],
  announcement: [{ label: 'Tiêu đề', required: true }, { label: 'Nội dung', type: 'textarea', required: true }, { label: 'Đối tượng nhận', type: 'select', options: ['Toàn trại', 'Quản lý', 'Kỹ thuật viên'] }, { label: 'Thời điểm phát hành', type: 'date' }],
}

export function FormScreen({ screen, state }: { screen: ScreenDefinition; state: ReviewState }) {
  const [submitted, setSubmitted] = useState(false)
  const [pregnancy, setPregnancy] = useState('none')
  const fields = useMemo(() => byFeature[screen.feature] ?? common, [screen.feature])
  if (state === 'loading') return <LoadingState label={`Đang tải biểu mẫu ${screen.viTitle.toLowerCase()}…`} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể mở biểu mẫu.">Dữ liệu nền chưa tải xong. Vui lòng thử lại.</InlineMessage>
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true) }
  const missing = screen.id === 'SCR-55' ? 'Vui lòng nhập Ngày phát hiện và Triệu chứng chính.' : 'Vui lòng kiểm tra các trường bắt buộc được đánh dấu *.'
  return <FormOverlay title={screen.viTitle} description="Thông tin được nhóm theo nghiệp vụ, trường có điều kiện nằm cạnh lựa chọn kích hoạt."><div className="mb-4"><FixtureNotice /></div><form onSubmit={submit} noValidate className="grid min-w-0 gap-4 md:grid-cols-2">{screen.id === 'SCR-65' && <><Field label="Tình trạng thai kỳ *" id="pregnancy-status"><select id="pregnancy-status" aria-label="Tình trạng thai kỳ" className={inputCls} value={pregnancy} onChange={(event) => setPregnancy(event.target.value)}><option value="none">Chưa xác định</option><option value="pregnant">Đang mang thai</option><option value="not-pregnant">Không mang thai</option></select></Field><ConditionalField active={pregnancy === 'pregnant'}><Field label="Số tháng mang thai *" id="pregnancy-months"><input id="pregnancy-months" aria-label="Số tháng mang thai" className={inputCls} type="number" min="1" max="10" required /></Field></ConditionalField></>}{fields.map((field) => { const id = `form-${field.label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`; return <Field key={field.label} id={id} label={`${field.label}${field.required ? ' *' : ''}`} hint={field.hint}>{field.type === 'textarea' ? <Textarea id={id} rows={4} required={field.required} /> : field.type === 'select' ? <select id={id} className={inputCls} required={field.required}><option value="">Chọn {field.label.toLowerCase()}</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input id={id} className={inputCls} type={field.type ?? 'text'} required={field.required} placeholder={`Nhập ${field.label.toLowerCase()}`} />}</Field> })}<div className="md:col-span-2">{submitted && <InlineMessage tone="err">{missing}</InlineMessage>}<StickyActions message="Các trường có dấu * là bắt buộc" actions={<><Button>Hủy</Button><Button type="submit" variant="primary" disabled={state === 'read-only'}>Lưu thông tin</Button></>} /></div></form></FormOverlay>
}
