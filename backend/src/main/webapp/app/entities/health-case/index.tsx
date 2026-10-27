import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import HealthCase from './health-case';
import HealthCaseDeleteDialog from './health-case-delete-dialog';
import HealthCaseDetail from './health-case-detail';
import HealthCaseUpdate from './health-case-update';

const HealthCaseRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<HealthCase />} />
    <Route path="new" element={<HealthCaseUpdate />} />
    <Route path=":id">
      <Route index element={<HealthCaseDetail />} />
      <Route path="edit" element={<HealthCaseUpdate />} />
      <Route path="delete" element={<HealthCaseDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default HealthCaseRoutes;
