import announcementRecipient from 'app/entities/announcement-recipient/announcement-recipient.reducer';
import announcementVersion from 'app/entities/announcement-version/announcement-version.reducer';
import appUser from 'app/entities/app-user/app-user.reducer';
import auditLog from 'app/entities/audit-log/audit-log.reducer';
import bankTransferEvidence from 'app/entities/bank-transfer-evidence/bank-transfer-evidence.reducer';
import breed from 'app/entities/breed/breed.reducer';
import calfOutcome from 'app/entities/calf-outcome/calf-outcome.reducer';
import calvingEvent from 'app/entities/calving-event/calving-event.reducer';
import cashReportSnapshot from 'app/entities/cash-report-snapshot/cash-report-snapshot.reducer';
import evidenceReview from 'app/entities/evidence-review/evidence-review.reducer';
import farm from 'app/entities/farm/farm.reducer';
import farmMembership from 'app/entities/farm-membership/farm-membership.reducer';
import managerPermission from 'app/entities/manager-permission/manager-permission.reducer';
import farmInvitation from 'app/entities/farm-invitation/farm-invitation.reducer';
import planVersion from 'app/entities/plan-version/plan-version.reducer';
import productionPurpose from 'app/entities/production-purpose/production-purpose.reducer';
import subscription from 'app/entities/subscription/subscription.reducer';
import payment from 'app/entities/payment/payment.reducer';
import manualFinanceRecord from 'app/entities/manual-finance-record/manual-finance-record.reducer';
import supportHistory from 'app/entities/support-history/support-history.reducer';
import supportTicket from 'app/entities/support-ticket/support-ticket.reducer';
import ticketMessage from 'app/entities/ticket-message/ticket-message.reducer';
import internalRequest from 'app/entities/internal-request/internal-request.reducer';
import pen from 'app/entities/pen/pen.reducer';
import penReceptionCriteria from 'app/entities/pen-reception-criteria/pen-reception-criteria.reducer';
import penAssignment from 'app/entities/pen-assignment/pen-assignment.reducer';
import cattle from 'app/entities/cattle/cattle.reducer';
import cattleQrTag from 'app/entities/cattle-qr-tag/cattle-qr-tag.reducer';
import herdEntry from 'app/entities/herd-entry/herd-entry.reducer';
import herdExit from 'app/entities/herd-exit/herd-exit.reducer';
import cattleProfileChange from 'app/entities/cattle-profile-change/cattle-profile-change.reducer';
import treatment from 'app/entities/treatment/treatment.reducer';
import vaccination from 'app/entities/vaccination/vaccination.reducer';
import vaccinationSchedule from 'app/entities/vaccination-schedule/vaccination-schedule.reducer';
import vaccine from 'app/entities/vaccine/vaccine.reducer';
import medicine from 'app/entities/medicine/medicine.reducer';
import reminderParameter from 'app/entities/reminder-parameter/reminder-parameter.reducer';
import growth from 'app/entities/growth/growth.reducer';
import scheduledDose from 'app/entities/scheduled-dose/scheduled-dose.reducer';
import healthCase from 'app/entities/health-case/health-case.reducer';
import healthObservation from 'app/entities/health-observation/health-observation.reducer';
import reproductionEvent from 'app/entities/reproduction-event/reproduction-event.reducer';
import pregnancyEpisode from 'app/entities/pregnancy-episode/pregnancy-episode.reducer';
import pregnancyUpdate from 'app/entities/pregnancy-update/pregnancy-update.reducer';
import recordRevision from 'app/entities/record-revision/record-revision.reducer';
import farmAnnouncement from 'app/entities/farm-announcement/farm-announcement.reducer';
import reminder from 'app/entities/reminder/reminder.reducer';
import notification from 'app/entities/notification/notification.reducer';
import platformStaffAccess from 'app/entities/platform-staff-access/platform-staff-access.reducer';
/* jhipster-needle-add-reducer-import - JHipster will add reducer here */

const entitiesReducers = {
  appUser,
  platformStaffAccess,
  farm,
  farmMembership,
  managerPermission,
  farmInvitation,
  auditLog,
  planVersion,
  subscription,
  payment,
  bankTransferEvidence,
  evidenceReview,
  manualFinanceRecord,
  cashReportSnapshot,
  supportTicket,
  ticketMessage,
  internalRequest,
  supportHistory,
  pen,
  penReceptionCriteria,
  penAssignment,
  cattle,
  cattleQrTag,
  herdEntry,
  herdExit,
  cattleProfileChange,
  breed,
  productionPurpose,
  vaccine,
  medicine,
  reminderParameter,
  growth,
  vaccination,
  vaccinationSchedule,
  scheduledDose,
  healthCase,
  treatment,
  healthObservation,
  reproductionEvent,
  pregnancyEpisode,
  pregnancyUpdate,
  calvingEvent,
  calfOutcome,
  recordRevision,
  farmAnnouncement,
  announcementVersion,
  announcementRecipient,
  reminder,
  notification,
  /* jhipster-needle-add-reducer-combine - JHipster will add reducer here */
};

export default entitiesReducers;
