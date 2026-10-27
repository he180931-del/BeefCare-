import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Cattle from './cattle';
import CattleDeleteDialog from './cattle-delete-dialog';
import CattleDetail from './cattle-detail';
import CattleUpdate from './cattle-update';

const CattleRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Cattle />} />
    <Route path="new" element={<CattleUpdate />} />
    <Route path=":id">
      <Route index element={<CattleDetail />} />
      <Route path="edit" element={<CattleUpdate />} />
      <Route path="delete" element={<CattleDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default CattleRoutes;
