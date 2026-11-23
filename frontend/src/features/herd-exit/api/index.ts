// Exit-specific façade. The shared domain API owns the atomic cattle/pen
export { exitPaymentVoidEnabled, voidExitPayment } from './herdExitApi'
// transitions while this module is the stable import point for exit flows.
export { herdExitApi, getExitDraftState, saveHerdExit, confirmHerdExit, downloadExitAttachment, removeExitAttachment, cancelHerdExit, dismissHerdExit, listExitBuyers, listSelectableExitCattle, exitCollectionDefaults, exitPenShift, newExitVoucherId, exitCancelDefaults, listExitCancelPens, exitVoidCheck, exitCancelLinks } from './herdExitApi'
