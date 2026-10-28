import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PenReceptionCriteria from './pen-reception-criteria';
import PenReceptionCriteriaDeleteDialog from './pen-reception-criteria-delete-dialog';
import PenReceptionCriteriaDetail from './pen-reception-criteria-detail';
import PenReceptionCriteriaUpdate from './pen-reception-criteria-update';

const PenReceptionCriteriaRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PenReceptionCriteria />} />
    <Route path="new" element={<PenReceptionCriteriaUpdate />} />
    <Route path=":id">
      <Route index element={<PenReceptionCriteriaDetail />} />
      <Route path="edit" element={<PenReceptionCriteriaUpdate />} />
      <Route path="delete" element={<PenReceptionCriteriaDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PenReceptionCriteriaRoutes;
