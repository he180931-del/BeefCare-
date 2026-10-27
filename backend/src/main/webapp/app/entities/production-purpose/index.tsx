import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import ProductionPurpose from './production-purpose';
import ProductionPurposeDeleteDialog from './production-purpose-delete-dialog';
import ProductionPurposeDetail from './production-purpose-detail';
import ProductionPurposeUpdate from './production-purpose-update';

const ProductionPurposeRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<ProductionPurpose />} />
    <Route path="new" element={<ProductionPurposeUpdate />} />
    <Route path=":id">
      <Route index element={<ProductionPurposeDetail />} />
      <Route path="edit" element={<ProductionPurposeUpdate />} />
      <Route path="delete" element={<ProductionPurposeDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ProductionPurposeRoutes;
