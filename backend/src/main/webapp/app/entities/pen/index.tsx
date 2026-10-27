import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Pen from './pen';
import PenDeleteDialog from './pen-delete-dialog';
import PenDetail from './pen-detail';
import PenUpdate from './pen-update';

const PenRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Pen />} />
    <Route path="new" element={<PenUpdate />} />
    <Route path=":id">
      <Route index element={<PenDetail />} />
      <Route path="edit" element={<PenUpdate />} />
      <Route path="delete" element={<PenDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PenRoutes;
