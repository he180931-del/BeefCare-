import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Vaccination from './vaccination';
import VaccinationDeleteDialog from './vaccination-delete-dialog';
import VaccinationDetail from './vaccination-detail';
import VaccinationUpdate from './vaccination-update';

const VaccinationRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Vaccination />} />
    <Route path="new" element={<VaccinationUpdate />} />
    <Route path=":id">
      <Route index element={<VaccinationDetail />} />
      <Route path="edit" element={<VaccinationUpdate />} />
      <Route path="delete" element={<VaccinationDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default VaccinationRoutes;
