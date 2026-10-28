import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import HerdExit from './herd-exit';
import HerdExitDeleteDialog from './herd-exit-delete-dialog';
import HerdExitDetail from './herd-exit-detail';
import HerdExitUpdate from './herd-exit-update';

const HerdExitRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<HerdExit />} />
    <Route path="new" element={<HerdExitUpdate />} />
    <Route path=":id">
      <Route index element={<HerdExitDetail />} />
      <Route path="edit" element={<HerdExitUpdate />} />
      <Route path="delete" element={<HerdExitDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default HerdExitRoutes;
