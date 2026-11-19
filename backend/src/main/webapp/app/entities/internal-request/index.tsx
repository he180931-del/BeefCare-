import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import InternalRequest from './internal-request';
import InternalRequestDeleteDialog from './internal-request-delete-dialog';
import InternalRequestDetail from './internal-request-detail';
import InternalRequestUpdate from './internal-request-update';

const InternalRequestRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<InternalRequest />} />
    <Route path="new" element={<InternalRequestUpdate />} />
    <Route path=":id">
      <Route index element={<InternalRequestDetail />} />
      <Route path="edit" element={<InternalRequestUpdate />} />
      <Route path="delete" element={<InternalRequestDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default InternalRequestRoutes;
