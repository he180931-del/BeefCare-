import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import ReproductionEvent from './reproduction-event';
import ReproductionEventDeleteDialog from './reproduction-event-delete-dialog';
import ReproductionEventDetail from './reproduction-event-detail';
import ReproductionEventUpdate from './reproduction-event-update';

const ReproductionEventRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<ReproductionEvent />} />
    <Route path="new" element={<ReproductionEventUpdate />} />
    <Route path=":id">
      <Route index element={<ReproductionEventDetail />} />
      <Route path="edit" element={<ReproductionEventUpdate />} />
      <Route path="delete" element={<ReproductionEventDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ReproductionEventRoutes;
