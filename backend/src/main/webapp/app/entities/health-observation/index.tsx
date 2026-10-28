import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import HealthObservation from './health-observation';
import HealthObservationDeleteDialog from './health-observation-delete-dialog';
import HealthObservationDetail from './health-observation-detail';
import HealthObservationUpdate from './health-observation-update';

const HealthObservationRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<HealthObservation />} />
    <Route path="new" element={<HealthObservationUpdate />} />
    <Route path=":id">
      <Route index element={<HealthObservationDetail />} />
      <Route path="edit" element={<HealthObservationUpdate />} />
      <Route path="delete" element={<HealthObservationDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default HealthObservationRoutes;
