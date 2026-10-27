import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Vaccine from './vaccine';
import VaccineDeleteDialog from './vaccine-delete-dialog';
import VaccineDetail from './vaccine-detail';
import VaccineUpdate from './vaccine-update';

const VaccineRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Vaccine />} />
    <Route path="new" element={<VaccineUpdate />} />
    <Route path=":id">
      <Route index element={<VaccineDetail />} />
      <Route path="edit" element={<VaccineUpdate />} />
      <Route path="delete" element={<VaccineDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default VaccineRoutes;
