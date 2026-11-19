import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PenAssignment from './pen-assignment';
import PenAssignmentDeleteDialog from './pen-assignment-delete-dialog';
import PenAssignmentDetail from './pen-assignment-detail';
import PenAssignmentUpdate from './pen-assignment-update';

const PenAssignmentRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PenAssignment />} />
    <Route path="new" element={<PenAssignmentUpdate />} />
    <Route path=":id">
      <Route index element={<PenAssignmentDetail />} />
      <Route path="edit" element={<PenAssignmentUpdate />} />
      <Route path="delete" element={<PenAssignmentDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PenAssignmentRoutes;
