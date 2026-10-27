import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Farm from './farm';
import FarmDeleteDialog from './farm-delete-dialog';
import FarmDetail from './farm-detail';
import FarmUpdate from './farm-update';

const FarmRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Farm />} />
    <Route path="new" element={<FarmUpdate />} />
    <Route path=":id">
      <Route index element={<FarmDetail />} />
      <Route path="edit" element={<FarmUpdate />} />
      <Route path="delete" element={<FarmDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default FarmRoutes;
