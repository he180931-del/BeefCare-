import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Reminder from './reminder';
import ReminderDeleteDialog from './reminder-delete-dialog';
import ReminderDetail from './reminder-detail';
import ReminderUpdate from './reminder-update';

const ReminderRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Reminder />} />
    <Route path="new" element={<ReminderUpdate />} />
    <Route path=":id">
      <Route index element={<ReminderDetail />} />
      <Route path="edit" element={<ReminderUpdate />} />
      <Route path="delete" element={<ReminderDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ReminderRoutes;
