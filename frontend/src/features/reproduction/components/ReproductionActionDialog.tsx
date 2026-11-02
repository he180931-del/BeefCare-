import type { ReproductionAction } from '../domain/reproductionRules'
import type { CalvingRecord, ReproductionCommand, ReproductionEvent, ReproductionFemale } from '../types'
import RecordDialog from './RecordDialogs'
import ReviseDialog, { type ReviseTarget } from './ReviseDialog'

export type ReproductionDialogTarget =
  | { mode: 'record'; action: Exclude<ReproductionAction, 'RECORD_CALVING'> }
  | ReviseTarget

/** Routes a profile-tab dialog target to the record dialogs or the correct / void dialogs of the Figma frames. */
export default function ReproductionActionDialog({
  target, profile, onClose, onRecord, onCorrectEvent, onVoidEvent, onCorrectCalving, onVoidCalving, onVoidCalf,
}: {
  target: ReproductionDialogTarget
  profile: ReproductionFemale
  onClose: () => void
  onRecord: (command: ReproductionCommand) => Promise<void>
  onCorrectEvent: (eventId: string, patch: Partial<ReproductionEvent>, reason: string) => Promise<void>
  onVoidEvent: (eventId: string, reason: string) => Promise<void>
  onCorrectCalving: (calvingId: string, patch: Partial<CalvingRecord>, reason: string) => Promise<void>
  onVoidCalving: (calvingId: string, reason: string) => Promise<void>
  onVoidCalf: (calvingId: string, calfId: string, reason: string) => Promise<void>
}) {
  if (target.mode === 'record') return <RecordDialog action={target.action} profile={profile} onClose={onClose} onRecord={onRecord} />
  return (
    <ReviseDialog
      target={target} profile={profile} onClose={onClose} onCorrectEvent={onCorrectEvent} onVoidEvent={onVoidEvent}
      onCorrectCalving={onCorrectCalving} onVoidCalving={onVoidCalving} onVoidCalf={onVoidCalf}
    />
  )
}
