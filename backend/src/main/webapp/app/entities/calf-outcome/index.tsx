import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import CalfOutcome from './calf-outcome';
import CalfOutcomeDeleteDialog from './calf-outcome-delete-dialog';
import CalfOutcomeDetail from './calf-outcome-detail';
import CalfOutcomeUpdate from './calf-outcome-update';

const CalfOutcomeRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<CalfOutcome />} />
    <Route path="new" element={<CalfOutcomeUpdate />} />
    <Route path=":id">
      <Route index element={<CalfOutcomeDetail />} />
      <Route path="edit" element={<CalfOutcomeUpdate />} />
      <Route path="delete" element={<CalfOutcomeDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default CalfOutcomeRoutes;
