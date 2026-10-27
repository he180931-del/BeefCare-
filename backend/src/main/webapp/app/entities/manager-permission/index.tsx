import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import ManagerPermission from './manager-permission';
import ManagerPermissionDeleteDialog from './manager-permission-delete-dialog';
import ManagerPermissionDetail from './manager-permission-detail';
import ManagerPermissionUpdate from './manager-permission-update';

const ManagerPermissionRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<ManagerPermission />} />
    <Route path="new" element={<ManagerPermissionUpdate />} />
    <Route path=":id">
      <Route index element={<ManagerPermissionDetail />} />
      <Route path="edit" element={<ManagerPermissionUpdate />} />
      <Route path="delete" element={<ManagerPermissionDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ManagerPermissionRoutes;
