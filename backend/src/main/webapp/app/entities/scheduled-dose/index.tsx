import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import ScheduledDose from './scheduled-dose';
import ScheduledDoseDeleteDialog from './scheduled-dose-delete-dialog';
import ScheduledDoseDetail from './scheduled-dose-detail';
import ScheduledDoseUpdate from './scheduled-dose-update';

const ScheduledDoseRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<ScheduledDose />} />
    <Route path="new" element={<ScheduledDoseUpdate />} />
    <Route path=":id">
      <Route index element={<ScheduledDoseDetail />} />
      <Route path="edit" element={<ScheduledDoseUpdate />} />
      <Route path="delete" element={<ScheduledDoseDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ScheduledDoseRoutes;
