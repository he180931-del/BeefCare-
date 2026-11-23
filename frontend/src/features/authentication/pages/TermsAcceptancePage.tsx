import { useState } from 'react'
import { userFacingError } from '../../../shared/api/userFacingError'
import { LegalDialog } from '../components/LegalDialog'

export function TermsAcceptancePage({ onAccept, onLogout }: { onAccept: () => Promise<void>; onLogout: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onAccept()
    } catch (cause) {
      setError(userFacingError(cause, 'Không lưu được xác nhận. Vui lòng thử lại.'))
      setSaving(false)
    }
  }

  return <div className="min-h-screen bg-page">
    <LegalDialog
      initialKind="terms"
      onClose={() => { void onLogout() }}
      onConfirm={confirm}
      confirming={saving}
      error={error || undefined}
    />
  </div>
}
