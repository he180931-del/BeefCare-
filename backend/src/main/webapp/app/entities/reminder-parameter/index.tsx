import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import ReminderParameter from './reminder-parameter';
import ReminderParameterDeleteDialog from './reminder-parameter-delete-dialog';
import ReminderParameterDetail from './reminder-parameter-detail';
import ReminderParameterUpdate from './reminder-parameter-update';

const ReminderParameterRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<ReminderParameter />} />
    <Route path="new" element={<ReminderParameterUpdate />} />
    <Route path=":id">
      <Route index element={<ReminderParameterDetail />} />
      <Route path="edit" element={<ReminderParameterUpdate />} />
      <Route path="delete" element={<ReminderParameterDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ReminderParameterRoutes;
