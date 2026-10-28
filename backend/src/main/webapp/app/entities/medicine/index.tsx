import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Medicine from './medicine';
import MedicineDeleteDialog from './medicine-delete-dialog';
import MedicineDetail from './medicine-detail';
import MedicineUpdate from './medicine-update';

const MedicineRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Medicine />} />
    <Route path="new" element={<MedicineUpdate />} />
    <Route path=":id">
      <Route index element={<MedicineDetail />} />
      <Route path="edit" element={<MedicineUpdate />} />
      <Route path="delete" element={<MedicineDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default MedicineRoutes;
