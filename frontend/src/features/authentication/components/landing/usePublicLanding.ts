import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthClient } from '../../types'
import { DEFAULT_FAQ, DEFAULT_FEATURES } from '../../data/landingContent'

export type Prices = { price1y: number; price2y: number; price3y: number }
export type PriceState = { status: 'loading' | 'ready' | 'unavailable'; prices: Prices | null }
type Published = { introduction?: string; features?: Array<{ title?: string; description?: string }>; faq?: Array<{ question?: string; answer?: string }>; contactEmail?: string; contactPhone?: string }

const isPrice = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

export function parsePrices(value: unknown): Prices | null {
  const row = (value ?? {}) as Partial<Record<keyof Prices, unknown>>
  return isPrice(row.price1y) && isPrice(row.price2y) && isPrice(row.price3y) ? { price1y: row.price1y, price2y: row.price2y, price3y: row.price3y } : null
}

/** Bảng giá công khai: không bao giờ hiển thị giá cũ hoặc giá tự đặt khi tải lỗi (GBR-87). `demo` chỉ dùng ở chế độ mô phỏng. */
export function usePublicPrices(client: AuthClient, demo: string | null) {
  const [state, setState] = useState<PriceState>({ status: 'loading', prices: null })
  const run = useRef(0)
  const load = useCallback(async () => {
    const id = ++run.current
    const done = (next: PriceState) => { if (id === run.current) setState(next) }
    if (demo === 'prices-loading') return done({ status: 'loading', prices: null })
    if (demo === 'prices-unavailable') return done({ status: 'unavailable', prices: null })
    done({ status: 'loading', prices: null })
    try {
      if (!client.getPublicPrices) throw new Error('Bảng giá chưa được nối với máy chủ.')
      const prices = parsePrices(await client.getPublicPrices())
      done(prices ? { status: 'ready', prices } : { status: 'unavailable', prices: null })
    } catch { done({ status: 'unavailable', prices: null }) }
  }, [client, demo])
  useEffect(() => { void load() }, [load])
  return { state, retry: load }
}

export function usePublishedLanding(client: AuthClient) {
  const [published, setPublished] = useState<Published | null>(null)
  useEffect(() => {
    let active = true
    client.getPublicLanding?.().then((result) => { if (active && result && typeof result === 'object') setPublished(result as Published) })
      .catch(() => { /* nội dung tĩnh vẫn hiển thị; giá không bao giờ dùng nội dung dự phòng */ })
    return () => { active = false }
  }, [client])
  const features = published?.features?.filter((item) => item.title?.trim()).slice(0, 6).map((item, index): readonly [string, string] => [item.title as string, item.description || DEFAULT_FEATURES[index]?.[1] || ''])
  const faq = published?.faq?.filter((item) => item.question?.trim() && item.answer?.trim()).map((item): readonly [string, string] => [item.question as string, item.answer as string])
  return {
    features: features?.length ? features : DEFAULT_FEATURES,
    faq: faq?.length ? faq : DEFAULT_FAQ,
    contactEmail: published?.contactEmail?.trim() || undefined,
    contactPhone: published?.contactPhone?.trim() || undefined,
  }
}
