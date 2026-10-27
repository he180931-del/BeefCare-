import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PlanVersion from './plan-version';
import PlanVersionDeleteDialog from './plan-version-delete-dialog';
import PlanVersionDetail from './plan-version-detail';
import PlanVersionUpdate from './plan-version-update';

const PlanVersionRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PlanVersion />} />
    <Route path="new" element={<PlanVersionUpdate />} />
    <Route path=":id">
      <Route index element={<PlanVersionDetail />} />
      <Route path="edit" element={<PlanVersionUpdate />} />
      <Route path="delete" element={<PlanVersionDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PlanVersionRoutes;
