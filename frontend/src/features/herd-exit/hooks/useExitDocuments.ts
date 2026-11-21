import { useState } from 'react'
import { downloadExitAttachment, removeExitAttachment } from '../api/index'
import type { ExitDocument } from '../types'

export function isSupportedExitDocument(file: File) {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const jpg = ['image/jpeg', 'image/jpg'].includes(file.type) || /\.jpe?g$/i.test(file.name)
  return (pdf || jpg) && file.size <= 10 * 1024 * 1024
}

type ExitDocumentsArgs = {
  id: string
  persistedDocuments: ExitDocument[]
  canRemovePersisted: boolean
  documents: File[]
  setDocuments: (update: File[] | ((current: File[]) => File[])) => void
  removedAttachmentIds: number[]
  setRemovedAttachmentIds: (update: number[] | ((current: number[]) => number[])) => void
}

export function useExitDocuments({ id, persistedDocuments, canRemovePersisted, documents, setDocuments, setRemovedAttachmentIds }: ExitDocumentsArgs) {
  const [documentError, setDocumentError] = useState('')
  const selectedDocuments = documents.map((file) => ({ name: file.name, ext: file.type === 'application/pdf' ? 'PDF' : 'JPG', size: file.size }))
  const documentRows = [...persistedDocuments, ...selectedDocuments]

  const addDocuments = (files: File[]) => {
    const invalid = files.find((file) => !isSupportedExitDocument(file))
    if (invalid) {
      setDocumentError(`Tệp ${invalid.name} không hợp lệ. Chỉ nhận PDF/JPG tối đa 10MB.`)
      return
    }
    setDocumentError('')
    setDocuments((current) => [...current, ...files.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))])
  }

  const removeDocument = async (index: number) => {
    if (index < persistedDocuments.length) {
      const persisted = persistedDocuments[index]
      if (typeof persisted.id !== 'number' || persisted.id <= 0 || !canRemovePersisted) return
      try {
        await removeExitAttachment(id, persisted.id)
        setRemovedAttachmentIds((current) => [...current, persisted.id as number])
        setDocumentError('')
      } catch (error) {
        setDocumentError(error instanceof Error ? error.message : 'Không thể xóa chứng từ.')
      }
      return
    }
    setDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index - persistedDocuments.length))
  }

  const viewDocument = async (index: number) => {
    const persisted = persistedDocuments[index]
    if (persisted) {
      try {
        let url = typeof persisted.url === 'string' ? persisted.url : ''
        if (typeof persisted.id === 'number' && persisted.id > 0) url = URL.createObjectURL(await downloadExitAttachment(id, persisted.id))
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer')
          if (url.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
      } catch (error) {
        setDocumentError(error instanceof Error ? error.message : 'Không thể mở chứng từ.')
      }
      return
    }
    const file = documents[index - persistedDocuments.length]
    if (!file) return
    const url = URL.createObjectURL(file)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return { documentError, selectedDocuments, documentRows, addDocuments, removeDocument, viewDocument }
}
