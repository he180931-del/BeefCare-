import { useState } from 'react'
import { downloadEntryAttachment, removeEntryAttachment } from '../api'
import type { EntryDocument } from '../types'
import { herdEntryError } from '../api/herdEntryError'

export function useEntryAttachments({ persistedRecordId, initialStored = [] }: { persistedRecordId: string | null; initialStored?: EntryDocument[] }) {
  const [documents, setDocuments] = useState<File[]>([])
  const [storedDocuments, setStoredDocuments] = useState<EntryDocument[]>(initialStored)
  const [error, setError] = useState<string | null>(null)

  const addDocuments = (files: File[]) => {
    const invalid = files.find((file) => !['application/pdf', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024)
    if (invalid) {
      setError(`Tệp ${invalid.name} không hợp lệ. Chỉ nhận PDF/JPG tối đa 10MB.`)
      return
    }
    setError(null)
    setDocuments((current) => [...current, ...files.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))])
  }

  const viewDocument = async (index: number) => {
    try {
      if (index < storedDocuments.length) {
        const document = storedDocuments[index]
        const attachmentId = Number(document.id)
        if (!persistedRecordId || !Number.isFinite(attachmentId)) throw new Error('Không xác định được chứng từ đã lưu')
        const blob = await downloadEntryAttachment(persistedRecordId, attachmentId)
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }
      const file = documents[index - storedDocuments.length]
      if (!file) return
      const url = URL.createObjectURL(file)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (nextError) {
      setError(herdEntryError(nextError))
    }
  }

  const removeDocument = async (index: number) => {
    try {
      if (index < storedDocuments.length) {
        const document = storedDocuments[index]
        const attachmentId = Number(document.id)
        if (!persistedRecordId || !Number.isFinite(attachmentId)) throw new Error('Không xác định được chứng từ đã lưu')
        await removeEntryAttachment(persistedRecordId, attachmentId)
        setStoredDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index))
        return
      }
      const localIndex = index - storedDocuments.length
      setDocuments((current) => current.filter((_, currentIndex) => currentIndex !== localIndex))
    } catch (nextError) {
      setError(herdEntryError(nextError))
    }
  }

  return { documents, storedDocuments, setStoredDocuments, resetDocuments: () => setDocuments([]), attachmentError: error, addDocuments, viewDocument, removeDocument }
}
