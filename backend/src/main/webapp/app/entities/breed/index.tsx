import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Breed from './breed';
import BreedDeleteDialog from './breed-delete-dialog';
import BreedDetail from './breed-detail';
import BreedUpdate from './breed-update';

const BreedRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Breed />} />
    <Route path="new" element={<BreedUpdate />} />
    <Route path=":id">
      <Route index element={<BreedDetail />} />
      <Route path="edit" element={<BreedUpdate />} />
      <Route path="delete" element={<BreedDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default BreedRoutes;
