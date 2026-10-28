import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import FarmInvitation from './farm-invitation';
import FarmInvitationDeleteDialog from './farm-invitation-delete-dialog';
import FarmInvitationDetail from './farm-invitation-detail';
import FarmInvitationUpdate from './farm-invitation-update';

const FarmInvitationRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<FarmInvitation />} />
    <Route path="new" element={<FarmInvitationUpdate />} />
    <Route path=":id">
      <Route index element={<FarmInvitationDetail />} />
      <Route path="edit" element={<FarmInvitationUpdate />} />
      <Route path="delete" element={<FarmInvitationDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default FarmInvitationRoutes;
