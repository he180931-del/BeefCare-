import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import SupportHistory from './support-history';
import SupportHistoryDeleteDialog from './support-history-delete-dialog';
import SupportHistoryDetail from './support-history-detail';
import SupportHistoryUpdate from './support-history-update';

const SupportHistoryRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<SupportHistory />} />
    <Route path="new" element={<SupportHistoryUpdate />} />
    <Route path=":id">
      <Route index element={<SupportHistoryDetail />} />
      <Route path="edit" element={<SupportHistoryUpdate />} />
      <Route path="delete" element={<SupportHistoryDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default SupportHistoryRoutes;
