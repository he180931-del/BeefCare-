import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import FarmMembership from './farm-membership';
import FarmMembershipDeleteDialog from './farm-membership-delete-dialog';
import FarmMembershipDetail from './farm-membership-detail';
import FarmMembershipUpdate from './farm-membership-update';

const FarmMembershipRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<FarmMembership />} />
    <Route path="new" element={<FarmMembershipUpdate />} />
    <Route path=":id">
      <Route index element={<FarmMembershipDetail />} />
      <Route path="edit" element={<FarmMembershipUpdate />} />
      <Route path="delete" element={<FarmMembershipDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default FarmMembershipRoutes;
