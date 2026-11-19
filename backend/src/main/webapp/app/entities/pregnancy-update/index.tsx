import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PregnancyUpdate from './pregnancy-update';
import PregnancyUpdateDeleteDialog from './pregnancy-update-delete-dialog';
import PregnancyUpdateDetail from './pregnancy-update-detail';
import PregnancyUpdateUpdate from './pregnancy-update-update';

const PregnancyUpdateRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PregnancyUpdate />} />
    <Route path="new" element={<PregnancyUpdateUpdate />} />
    <Route path=":id">
      <Route index element={<PregnancyUpdateDetail />} />
      <Route path="edit" element={<PregnancyUpdateUpdate />} />
      <Route path="delete" element={<PregnancyUpdateDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PregnancyUpdateRoutes;
