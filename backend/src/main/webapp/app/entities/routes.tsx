import React from 'react';
import { Route } from 'react-router'; // eslint-disable-line

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import AnnouncementRecipient from './announcement-recipient';
import AnnouncementVersion from './announcement-version';
import AppUser from './app-user';
import AuditLog from './audit-log';
import BankTransferEvidence from './bank-transfer-evidence';
import Breed from './breed';
import CalfOutcome from './calf-outcome';
import CalvingEvent from './calving-event';
import CashReportSnapshot from './cash-report-snapshot';
import EvidenceReview from './evidence-review';
import Farm from './farm';
import FarmMembership from './farm-membership';
import ManagerPermission from './manager-permission';
import FarmInvitation from './farm-invitation';
import PlanVersion from './plan-version';
import ProductionPurpose from './production-purpose';
import Subscription from './subscription';
import Payment from './payment';
import ManualFinanceRecord from './manual-finance-record';
import SupportHistory from './support-history';
import SupportTicket from './support-ticket';
import TicketMessage from './ticket-message';
import InternalRequest from './internal-request';
import Pen from './pen';
import PenReceptionCriteria from './pen-reception-criteria';
import PenAssignment from './pen-assignment';
import Cattle from './cattle';
import CattleQrTag from './cattle-qr-tag';
import HerdEntry from './herd-entry';
import HerdExit from './herd-exit';
import CattleProfileChange from './cattle-profile-change';
import Treatment from './treatment';
import Vaccination from './vaccination';
import VaccinationSchedule from './vaccination-schedule';
import Vaccine from './vaccine';
import Medicine from './medicine';
import ReminderParameter from './reminder-parameter';
import Growth from './growth';
import ScheduledDose from './scheduled-dose';
import HealthCase from './health-case';
import HealthObservation from './health-observation';
import ReproductionEvent from './reproduction-event';
import PregnancyEpisode from './pregnancy-episode';
import PregnancyUpdate from './pregnancy-update';
import RecordRevision from './record-revision';
import FarmAnnouncement from './farm-announcement';
import Reminder from './reminder';
import Notification from './notification';
import PlatformStaffAccess from './platform-staff-access';
/* jhipster-needle-add-route-import - JHipster will add routes here */

export default () => {
  return (
    <div>
      <ErrorBoundaryRoutes>
        {/* prettier-ignore */}
        <Route path="/app-user/*" element={<AppUser />} />
        <Route path="/platform-staff-access/*" element={<PlatformStaffAccess />} />
        <Route path="/farm/*" element={<Farm />} />
        <Route path="/farm-membership/*" element={<FarmMembership />} />
        <Route path="/manager-permission/*" element={<ManagerPermission />} />
        <Route path="/farm-invitation/*" element={<FarmInvitation />} />
        <Route path="/audit-log/*" element={<AuditLog />} />
        <Route path="/plan-version/*" element={<PlanVersion />} />
        <Route path="/subscription/*" element={<Subscription />} />
        <Route path="/payment/*" element={<Payment />} />
        <Route path="/bank-transfer-evidence/*" element={<BankTransferEvidence />} />
        <Route path="/evidence-review/*" element={<EvidenceReview />} />
        <Route path="/manual-finance-record/*" element={<ManualFinanceRecord />} />
        <Route path="/cash-report-snapshot/*" element={<CashReportSnapshot />} />
        <Route path="/support-ticket/*" element={<SupportTicket />} />
        <Route path="/ticket-message/*" element={<TicketMessage />} />
        <Route path="/internal-request/*" element={<InternalRequest />} />
        <Route path="/support-history/*" element={<SupportHistory />} />
        <Route path="/pen/*" element={<Pen />} />
        <Route path="/pen-reception-criteria/*" element={<PenReceptionCriteria />} />
        <Route path="/pen-assignment/*" element={<PenAssignment />} />
        <Route path="/cattle/*" element={<Cattle />} />
        <Route path="/cattle-qr-tag/*" element={<CattleQrTag />} />
        <Route path="/herd-entry/*" element={<HerdEntry />} />
        <Route path="/herd-exit/*" element={<HerdExit />} />
        <Route path="/cattle-profile-change/*" element={<CattleProfileChange />} />
        <Route path="/breed/*" element={<Breed />} />
        <Route path="/production-purpose/*" element={<ProductionPurpose />} />
        <Route path="/vaccine/*" element={<Vaccine />} />
        <Route path="/medicine/*" element={<Medicine />} />
        <Route path="/reminder-parameter/*" element={<ReminderParameter />} />
        <Route path="/growth/*" element={<Growth />} />
        <Route path="/vaccination/*" element={<Vaccination />} />
        <Route path="/vaccination-schedule/*" element={<VaccinationSchedule />} />
        <Route path="/scheduled-dose/*" element={<ScheduledDose />} />
        <Route path="/health-case/*" element={<HealthCase />} />
        <Route path="/treatment/*" element={<Treatment />} />
        <Route path="/health-observation/*" element={<HealthObservation />} />
        <Route path="/reproduction-event/*" element={<ReproductionEvent />} />
        <Route path="/pregnancy-episode/*" element={<PregnancyEpisode />} />
        <Route path="/pregnancy-update/*" element={<PregnancyUpdate />} />
        <Route path="/calving-event/*" element={<CalvingEvent />} />
        <Route path="/calf-outcome/*" element={<CalfOutcome />} />
        <Route path="/record-revision/*" element={<RecordRevision />} />
        <Route path="/farm-announcement/*" element={<FarmAnnouncement />} />
        <Route path="/announcement-version/*" element={<AnnouncementVersion />} />
        <Route path="/announcement-recipient/*" element={<AnnouncementRecipient />} />
        <Route path="/reminder/*" element={<Reminder />} />
        <Route path="/notification/*" element={<Notification />} />
        {/* jhipster-needle-add-route-path - JHipster will add routes here */}
      </ErrorBoundaryRoutes>
    </div>
  );
};
