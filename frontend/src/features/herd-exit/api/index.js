// Exit-specific façade. The shared domain API owns the atomic cattle/pen
// transitions while this module is the stable import point for exit flows.
export {
  cattle,
  pens,
  confirmCattleExit,
  cancelCattleExit,
} from '../../../api/herdDomainApi.js'
export { herdExitApi, getExitDraftState, saveHerdExit, cancelHerdExit } from './herdExitApi.js'
