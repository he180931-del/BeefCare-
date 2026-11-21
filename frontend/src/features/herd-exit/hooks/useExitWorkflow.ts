import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '../../../shared/hooks/useMutation'
import { confirmHerdExit, herdExitApi, saveHerdExit } from '../api/index'
import type { ExitChecks } from '../api/herdExitBackendApi'
import type { HerdExit } from '../types'

export function isWorkflowCurrent(revision: number, snapshot: string, currentRevision: number, currentSnapshot: string) {
  return revision === currentRevision && snapshot === currentSnapshot
}

type WorkflowArgs<T extends { code: string }> = {
  baseId?: string
  initialSavedId?: string
  picked: T[]
  documents: File[]
  formSnapshot: () => string
  buildDraftRecord: () => Partial<HerdExit>
  beforeSave?: () => boolean
}

export function useExitWorkflow<T extends { code: string }>({ baseId, initialSavedId = '', picked, documents, formSnapshot, buildDraftRecord, beforeSave }: WorkflowArgs<T>) {
  const nav = useNavigate()
  const { mutate: persistExit, error: saveError, loading: saving } = useMutation(saveHerdExit)
  const savingRef = useRef(false)
  const formRevision = useRef(0)
  const [savedId, setSavedId] = useState(initialSavedId)
  const [checks, setChecks] = useState<ExitChecks | null>(null)
  const [checksError, setChecksError] = useState<unknown>(null)
  const [checking, setChecking] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmError, setConfirmError] = useState<unknown>(null)

  const snapshot = formSnapshot()
  useEffect(() => {
    formRevision.current += 1
    setChecks(null)
    setChecksError(null)
    setConfirmed(false)
    setConfirmError(null)
  }, [snapshot])

  const saveId = savedId || baseId
  const cattleRows = picked.map((cow) => ({ ...cow, barn: (cow as T & { barn?: string }).barn }))

  const saveDraftAndLoadChecks = async () => {
    if (savingRef.current || beforeSave?.()) return
    const revision = formRevision.current
    const savedSnapshot = formSnapshot()
    const current = () => isWorkflowCurrent(revision, savedSnapshot, formRevision.current, formSnapshot())
    savingRef.current = true
    setChecking(true)
    setChecks(null)
    setChecksError(null)
    setConfirmed(false)
    setConfirmError(null)
    try {
      const saved = await persistExit({ id: saveId, record: buildDraftRecord(), cattleRows, documents })
      const nextId = saved.id || savedId || baseId || ''
      setSavedId(nextId)
      if (!current() || !nextId) return
      const nextChecks = await herdExitApi.checks(nextId)
      if (!current()) return
      setChecks(nextChecks)
    } catch (error) {
      if (revision === formRevision.current) setChecksError(error)
    } finally {
      setChecking(false)
      savingRef.current = false
    }
  }

  const saveDraft = async () => {
    if (savingRef.current || beforeSave?.()) return
    savingRef.current = true
    try {
      await persistExit({ id: saveId, record: buildDraftRecord(), cattleRows, documents })
      nav('/herd-exit')
    } catch {
      // Keep the draft and selected files visible for a retry.
    } finally {
      savingRef.current = false
    }
  }

  const confirm = async () => {
    if (savingRef.current || !checks || !confirmed) return
    const id = savedId || baseId
    if (!id) return
    savingRef.current = true
    try {
      await confirmHerdExit(id, checks.version)
      nav('/herd-exit')
    } catch (error) {
      setConfirmError(error)
    } finally {
      savingRef.current = false
    }
  }

  return { savedId, saving, saveError, checks, checksError, checking, confirmed, setConfirmed, confirmError, saveDraftAndLoadChecks, saveDraft, confirm }
}
