import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Growth from './growth';
import GrowthDeleteDialog from './growth-delete-dialog';
import GrowthDetail from './growth-detail';
import GrowthUpdate from './growth-update';

const GrowthRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Growth />} />
    <Route path="new" element={<GrowthUpdate />} />
    <Route path=":id">
      <Route index element={<GrowthDetail />} />
      <Route path="edit" element={<GrowthUpdate />} />
      <Route path="delete" element={<GrowthDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default GrowthRoutes;
