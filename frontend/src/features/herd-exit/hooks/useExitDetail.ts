import { useState } from 'react'
import { downloadExitAttachment, exitCancelLinks, herdExitApi } from '../api/index'
import { useQuery } from '../../../shared/hooks/useQuery'
import type { ExitDetail, HerdExit } from '../types'

export type ExitCancelLinks = Awaited<ReturnType<typeof exitCancelLinks>>

export function canCancelExit(record: HerdExit, detail: ExitDetail, links?: ExitCancelLinks): boolean {
  if (record.status !== 'Đã xuất' || !(detail.cows ?? []).length || !links) return false
  return links.serverChecked ? true : detail.cows!.every((row) => links.cattle.some((cow) => cow.code === row.code && cow.exitVoucherId === record.id))
}

export function useExitDetail(recordId: string) {
  const { data: record, loading, refetch, setData } = useQuery<HerdExit>(() => herdExitApi.get(recordId), [recordId])
  const { data: links } = useQuery<ExitCancelLinks>(() => exitCancelLinks(), [])
  const [documentError, setDocumentError] = useState('')

  const viewDocument = async (index: number) => {
    const document = record?.detail?.docs?.[index]
    if (!document) return
    try {
      let url = typeof document.url === 'string' ? document.url : ''
      if (typeof document.id === 'number' && document.id > 0) {
        url = URL.createObjectURL(await downloadExitAttachment(recordId, document.id))
      }
      if (!url) return
      window.open(url, '_blank', 'noopener,noreferrer')
      if (url.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setDocumentError('')
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Không thể mở chứng từ.')
    }
  }

  const reload = async () => { const latest = await herdExitApi.get(recordId); setData(latest) }
  return { record, loading, refetch, reload, links, documentError, canCancel: record ? canCancelExit(record, record.detail ?? {}, links ?? undefined) : false, viewDocument }
}
