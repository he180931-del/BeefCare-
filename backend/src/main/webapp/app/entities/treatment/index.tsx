import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Treatment from './treatment';
import TreatmentDeleteDialog from './treatment-delete-dialog';
import TreatmentDetail from './treatment-detail';
import TreatmentUpdate from './treatment-update';

const TreatmentRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Treatment />} />
    <Route path="new" element={<TreatmentUpdate />} />
    <Route path=":id">
      <Route index element={<TreatmentDetail />} />
      <Route path="edit" element={<TreatmentUpdate />} />
      <Route path="delete" element={<TreatmentDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default TreatmentRoutes;
