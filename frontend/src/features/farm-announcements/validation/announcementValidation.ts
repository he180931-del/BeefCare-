export const TITLE_MAX = 150
export const BODY_MAX = 5000
export const REASON_MAX = 500

type AnnouncementTextField = 'title' | 'body' | 'reason'

const FIELD: Record<AnnouncementTextField, string> = {
  title: 'Tiêu đề',
  body: 'Nội dung',
  reason: 'Lý do đính chính',
}

const MAX: Record<AnnouncementTextField, number> = {
  title: TITLE_MAX,
  body: BODY_MAX,
  reason: REASON_MAX,
}

/** MSG-COM-06 and field length rules for announcement forms. */
export function validateText(values: Partial<Record<AnnouncementTextField, string>>) {
  const errors: Partial<Record<AnnouncementTextField, string>> = {}
  for (const key of Object.keys(values) as AnnouncementTextField[]) {
    const text = values[key] ?? ''
    if (!text.trim()) errors[key] = `${FIELD[key]} là bắt buộc.`
    else if (text.length > MAX[key]) errors[key] = `${FIELD[key]} tối đa ${MAX[key].toLocaleString('vi-VN')} ký tự.`
  }
  return errors
}
