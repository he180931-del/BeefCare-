import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import VaccinationSchedule from './vaccination-schedule';
import VaccinationScheduleDeleteDialog from './vaccination-schedule-delete-dialog';
import VaccinationScheduleDetail from './vaccination-schedule-detail';
import VaccinationScheduleUpdate from './vaccination-schedule-update';

const VaccinationScheduleRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<VaccinationSchedule />} />
    <Route path="new" element={<VaccinationScheduleUpdate />} />
    <Route path=":id">
      <Route index element={<VaccinationScheduleDetail />} />
      <Route path="edit" element={<VaccinationScheduleUpdate />} />
      <Route path="delete" element={<VaccinationScheduleDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default VaccinationScheduleRoutes;
