import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../../src/features/authentication'
import type { AuthClient } from '../../../src/features/authentication/AuthContext'
import { createMockAuthClient } from '../../../src/features/authentication/data/mockAuthClient'
import { DEFAULT_FAQ, DEFAULT_FEATURES, STEPS } from '../../../src/features/authentication/constants/landingContent'

const renderGuest = (client: AuthClient, path: string) => render(<MemoryRouter initialEntries={[path]}><AuthProvider client={client}><div>Private content</div></AuthProvider></MemoryRouter>)

beforeEach(() => sessionStorage.clear())

describe('mock auth client', () => {
  it('returns real landing content and prices instead of throwing', async () => {
    const client = createMockAuthClient()
    const landing = await client.getPublicLanding!() as { features: unknown[]; faq: unknown[] }
    expect(landing.features).toHaveLength(6)
    expect(landing.faq).toHaveLength(5)
    expect(await client.getPublicPrices!()).toMatchObject({ price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000 })
  })

  it('reserves emails for the wrong-credentials and suspended frames and never signs them in', async () => {
    const client = createMockAuthClient()
    await expect(client.login('sai@beefcare.local', 'x')).rejects.toMatchObject({ code: 'MSG-FE01-01', status: 401 })
    await expect(client.login('tam-ngung@beefcare.local', 'x')).rejects.toMatchObject({ code: 'MSG-FE01-03', status: 403 })
    expect(await client.isAuthenticated()).toBe(false)
  })

  it('keeps the public landing explanations rich and publication-ready', () => {
    const descriptions = DEFAULT_FAQ.map(([, text]) => text)
    const sentenceCount = (text: string) => text.split(/[.!?](?:\s|$)/).filter(Boolean).length

    expect(descriptions.every((text) => sentenceCount(text) >= 3 && /[.!?]$/.test(text))).toBe(true)
    expect(DEFAULT_FEATURES.every(([, text]) => sentenceCount(text) === 1 && text.length <= 120 && /[.!?]$/.test(text))).toBe(true)
    expect(DEFAULT_FAQ.every(([, text]) => sentenceCount(text) === 3)).toBe(true)
    expect(STEPS.every(([, text]) => text.length <= 120 && sentenceCount(text) <= 2 && /[.!?]$/.test(text))).toBe(true)
  })
})

describe('public landing page', () => {
  it('shows the published features in order, including when fewer than six are published', async () => {
    const features = [
      { title: 'Hồ sơ cá thể', description: 'Xem lịch sử của từng con.' },
      { title: 'Theo dõi chuồng nhận', description: 'Xem sức chứa trong trại.' },
      { title: 'Việc đến hạn', description: 'Mở danh sách việc cần xử lý.' },
    ]
    const client: AuthClient = { ...createMockAuthClient(), getPublicLanding: async () => ({ features }) }
    renderGuest(client, '/')
    const featureArea = within(await screen.findByRole('region', { name: 'Mọi thông tin quan trọng, cùng một chỗ' }))
    await featureArea.findByRole('heading', { name: features[1].title })
    expect(featureArea.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(features.map(({ title }) => title))
    expect(featureArea.getByText('Dữ liệu minh họa')).toBeInTheDocument()
    // Ảnh sản phẩm là màn hình thật, không gắn vào thẻ tính năng đứng đầu (Admin đổi thứ tự không làm lệch ảnh).
    expect(featureArea.getByRole('img', { name: /Tab Tăng trưởng & BCS/ })).toBeInTheDocument()
    expect(featureArea.getAllByRole('listitem')).toHaveLength(features.length)
  })

  it('shows the three prices from the effective version and derived notes', async () => {
    renderGuest(createMockAuthClient(), '/')
    expect(await screen.findByText('1.200.000 đ')).toBeInTheDocument()
    expect(screen.getByText('2.160.000 đ')).toBeInTheDocument()
    expect(screen.getByText('3.060.000 đ')).toBeInTheDocument()
    expect(screen.getByText(/Trọn 24 tháng · tiết kiệm 10%/)).toBeInTheDocument()
    expect(screen.getByText(/Trọn 36 tháng · tiết kiệm 15%/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mỗi con bò một hồ sơ.')
    expect(screen.getByRole('link', { name: 'Bắt đầu quản lý trại' })).toHaveAttribute('href', '/dang-ky')
    expect(screen.getByRole('link', { name: 'Khám phá tính năng' })).toHaveAttribute('href', '#features')
    expect(screen.queryByRole('link', { name: 'Tiếp tục với Google' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Xem bảng giá' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Đăng nhập' })[0]).toHaveAttribute('href', '/dang-nhap')
  })

  it('opens the first FAQ item by default and toggles other answers', async () => {
    const user = userEvent.setup()
    renderGuest(createMockAuthClient(), '/')
    const firstQuestion = await screen.findByRole('button', { name: 'BeefCare phù hợp với quy mô trại nào?' })
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Tối ưu nhất cho trại bò thịt 150–300 con/)).toBeInTheDocument()

    const secondQuestion = screen.getByRole('button', { name: 'Có cần cài ứng dụng để sử dụng BeefCare không?' })
    expect(secondQuestion).toHaveAttribute('aria-expanded', 'false')
    const secondAnswer = screen.getByText(/BeefCare chạy trực tiếp trên trình duyệt/)
    expect(secondAnswer.closest('[aria-hidden="true"]')).not.toBeNull()

    await user.click(secondQuestion)
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    expect(secondQuestion).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Tối ưu nhất cho trại bò thịt 150–300 con/)).toBeInTheDocument()
    expect(secondAnswer.closest('[aria-hidden="false"]')).not.toBeNull()
  })

  it('renders each open FAQ answer as three meaningful bullet points', async () => {
    renderGuest(createMockAuthClient(), '/')
    await screen.findByRole('button', { name: 'BeefCare phù hợp với quy mô trại nào?' })
    const faq = within(document.getElementById('faq')!)
    const list = faq.getByRole('list')

    expect(list).not.toHaveClass('border-l-2')
    expect(list).not.toHaveClass('border-t')
    expect(faq.getAllByRole('listitem')).toHaveLength(3)
  })

  it('shows "—" prices, no invented numbers and a retry for ?demo=prices-unavailable', async () => {
    renderGuest(createMockAuthClient(), '/?demo=prices-unavailable')
    expect(await screen.findByText('Giá chưa khả dụng')).toBeInTheDocument()
    expect(screen.getAllByText('— đ')).toHaveLength(3)
    expect(screen.queryByText(/1\.200\.000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/100\.000 đ\/tháng/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('shows skeletons and the loading badge for ?demo=prices-loading', async () => {
    renderGuest(createMockAuthClient(), '/?demo=prices-loading')
    expect(await screen.findByText('Đang tải bảng giá…')).toBeInTheDocument()
    expect(screen.getByText('Gói 1 năm')).toBeInTheDocument()
    expect(screen.queryByText(/\d\.\d{3}\.\d{3} đ/)).not.toBeInTheDocument()
  })

  it('retries a failed price load and then shows the prices', async () => {
    const user = userEvent.setup()
    const getPublicPrices = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000 })
    const client: AuthClient = { ...createMockAuthClient(), getPublicPrices }
    renderGuest(client, '/')
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('1.200.000 đ')).toBeInTheDocument()
    expect(screen.queryByText('Giá chưa khả dụng')).not.toBeInTheDocument()
  })

  it('rejects an incomplete price response instead of showing partial prices', async () => {
    const client: AuthClient = { ...createMockAuthClient(), getPublicPrices: vi.fn().mockResolvedValue({ price1y: 1_200_000 }) }
    renderGuest(client, '/')
    expect(await screen.findByText('Giá chưa khả dụng')).toBeInTheDocument()
    expect(screen.queryByText(/1\.200\.000/)).not.toBeInTheDocument()
  })

  it('opens the mobile menu with the same links', async () => {
    const user = userEvent.setup()
    renderGuest(createMockAuthClient(), '/')
    await user.click(await screen.findByRole('button', { name: 'Mở menu' }))
    expect(screen.getAllByRole('link', { name: 'Bảng giá' })).toHaveLength(2)
  })
})

describe('mock sign-in failure frames', () => {
  it('shows the "Đăng nhập chưa thành công" state for the wrong-credentials email', async () => {
    const user = userEvent.setup()
    renderGuest(createMockAuthClient(), '/sign-in')
    await user.type(await screen.findByLabelText('Email'), 'sai@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu'), 'khong-dung')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('heading', { name: 'Đăng nhập chưa thành công' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu chưa chính xác.')
    expect(screen.getByText('Sau 5 lần sai liên tiếp, đăng nhập bị khóa 15 phút.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử đăng nhập lại' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Đăng ký ngay' })).toHaveAttribute('href', '/dang-ky')
  })

  it('opens the suspended-account state for the reserved suspended email', async () => {
    const user = userEvent.setup()
    renderGuest(createMockAuthClient(), '/sign-in')
    await user.type(await screen.findByLabelText('Email'), 'tam-ngung@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu'), 'mock-demo')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('heading', { name: 'Tài khoản đang tạm ngưng' })).toBeInTheDocument()
    expect(screen.getByText('tam-ngung@beefcare.local')).toBeInTheDocument()
  })

  it('still signs in with a mock account from the shared sign-in form', async () => {
    const user = userEvent.setup()
    renderGuest(createMockAuthClient(), '/sign-in')
    await user.type(await screen.findByLabelText('Email'), 'manager@beefcare.local')
    await user.type(screen.getByLabelText('Mật khẩu'), 'mock-demo')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByText('Private content')).toBeInTheDocument()
  })
})
