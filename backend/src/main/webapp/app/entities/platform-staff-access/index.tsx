import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PlatformStaffAccess from './platform-staff-access';
import PlatformStaffAccessDeleteDialog from './platform-staff-access-delete-dialog';
import PlatformStaffAccessDetail from './platform-staff-access-detail';
import PlatformStaffAccessUpdate from './platform-staff-access-update';

const PlatformStaffAccessRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PlatformStaffAccess />} />
    <Route path="new" element={<PlatformStaffAccessUpdate />} />
    <Route path=":id">
      <Route index element={<PlatformStaffAccessDetail />} />
      <Route path="edit" element={<PlatformStaffAccessUpdate />} />
      <Route path="delete" element={<PlatformStaffAccessDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PlatformStaffAccessRoutes;
