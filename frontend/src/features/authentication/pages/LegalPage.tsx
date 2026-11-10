import { Link } from 'react-router-dom'

const copy = {
  terms: {
    heading: 'Điều khoản sử dụng',
    lead: 'Điều khoản áp dụng khi bạn tạo hoặc sử dụng tài khoản BeefCare.',
    items: ['Bạn chịu trách nhiệm về tính chính xác của thông tin tài khoản và dữ liệu nhập vào.', 'Chỉ sử dụng tài khoản cho hoạt động được cấp quyền trong BeefCare.', 'Chúng tôi có thể cập nhật điều khoản khi pháp luật hoặc dịch vụ thay đổi.'],
  },
  data: {
    heading: 'Chính sách dữ liệu',
    lead: 'BeefCare sử dụng dữ liệu tài khoản và vận hành trại để cung cấp, bảo vệ và cải thiện dịch vụ.',
    items: ['Dữ liệu được truy cập theo quyền của từng tài khoản và từng trại.', 'Thông tin đăng nhập không được lưu dưới dạng mật khẩu thuần.', 'Bạn có thể liên hệ BeefCare khi cần hỗ trợ về dữ liệu tài khoản.'],
  },
} as const

export function LegalPage({ kind }: { kind: keyof typeof copy }) {
  const page = copy[kind]
  return <main className="mx-auto min-h-screen max-w-3xl bg-page px-5 py-12 text-ink sm:px-8">
    <Link to="/sign-in" className="text-sm font-bold text-brand underline">Quay lại đăng nhập</Link>
    <article className="mt-8 rounded-2xl border border-field bg-white p-7 shadow-sm">
      <h1 className="m-0 text-3xl font-bold">{page.heading}</h1>
      <p className="mt-4 text-subtle">{page.lead}</p>
      <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-6 text-subtle">{page.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>
  </main>
}
